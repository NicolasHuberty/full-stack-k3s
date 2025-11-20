import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getRAGService } from '@/lib/rag/service'
import { getAgentService } from '@/lib/agents/service'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

// Increase timeout to 180 seconds for complex agent workflows
export const maxDuration = 180

const chatSchema = z.object({
  message: z.string().min(1, 'Message is required'),
  collectionId: z.string().optional().nullable(),
  sessionId: z.string().optional().nullable(),
  agentId: z.string().optional().nullable(),
  actionState: z.record(z.string(), z.unknown()).optional().nullable(),
  model: z.string().optional().nullable(),
  maxTokens: z.number().min(1).max(4000).optional().nullable(),
})

export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = chatSchema.parse(body)

    // If agentId is provided, use agent execution
    if (validatedData.agentId && validatedData.collectionId) {
      // Check if client wants streaming (via Accept header or query param)
      const acceptHeader = request.headers.get('accept')
      const wantsStream = acceptHeader?.includes('text/event-stream') ||
        request.nextUrl.searchParams.get('stream') === 'true'

      const agentService = getAgentService()

      // If streaming is requested, use Server-Sent Events
      if (wantsStream) {
        const encoder = new TextEncoder()
        const stream = new TransformStream()
        const writer = stream.writable.getWriter()

        // Helper to send SSE event
        const sendEvent = async (event: string, data: unknown) => {
          try {
            const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
            await writer.write(encoder.encode(message))
          } catch (error) {
            console.error('[SSE] ❌ Error writing to stream:', error)
            throw error
          }
        }

          // Execute agent with streaming in background
          ; (async () => {
            try {
              const agentResult = await agentService.executeAgent(
                validatedData.agentId!,
                validatedData.message,
                session.user.id,
                validatedData.collectionId!,
                validatedData.actionState || undefined,
                validatedData.sessionId || undefined,
                // Progress callback for streaming
                async (progress) => {
                  try {
                    await sendEvent('progress', progress)
                  } catch (e) {
                    console.error('[SSE] Failed to send progress event:', e)
                  }
                }
              )
              // Get or create session
              let chatSession
              if (validatedData.sessionId) {
                chatSession = await prisma.chatSession.findUnique({
                  where: { id: validatedData.sessionId },
                })
              }

              if (!chatSession) {
                chatSession = await prisma.chatSession.create({
                  data: {
                    userId: session.user.id,
                    collectionId: validatedData.collectionId!,
                    agentId: validatedData.agentId!,
                    title: validatedData.message.substring(0, 100),
                  },
                })
              }

              // Save user message
              await prisma.chatMessage.create({
                data: {
                  sessionId: chatSession.id,
                  role: 'USER',
                  content: validatedData.message,
                  agentId: validatedData.agentId!,
                  modelUsed: validatedData.model,
                  actionState: validatedData.actionState
                    ? JSON.parse(JSON.stringify(validatedData.actionState))
                    : undefined,
                },
              })

              // Save assistant message
              await prisma.chatMessage.create({
                data: {
                  sessionId: chatSession.id,
                  role: 'ASSISTANT',
                  content: agentResult.answer,
                  documentChunks: JSON.parse(JSON.stringify(agentResult.sources)),
                  agentId: validatedData.agentId!,
                  modelUsed: validatedData.model,
                  actionState: validatedData.actionState
                    ? JSON.parse(JSON.stringify(validatedData.actionState))
                    : undefined,
                  promptTokens: agentResult.inputTokens,
                  completionTokens: agentResult.outputTokens,
                },
              })

              // Send final result
              await sendEvent('complete', {
                sessionId: chatSession.id,
                message: agentResult.answer,
                chunks: agentResult.sources,
                usage: {
                  promptTokens: agentResult.inputTokens,
                  completionTokens: agentResult.outputTokens,
                  totalTokens: agentResult.inputTokens + agentResult.outputTokens,
                },
              })
            } catch (error) {
              await sendEvent('error', {
                message: error instanceof Error ? error.message : 'Unknown error',
              })
            } finally {
              await writer.close()
            }
          })()

        return new Response(stream.readable, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
          },
        })
      }

      // Non-streaming execution (original behavior)
      const agentResult = await agentService.executeAgent(
        validatedData.agentId,
        validatedData.message,
        session.user.id,
        validatedData.collectionId,
        validatedData.actionState || undefined,
        validatedData.sessionId || undefined
      )

      // Get or create session
      let chatSession
      if (validatedData.sessionId) {
        chatSession = await prisma.chatSession.findUnique({
          where: { id: validatedData.sessionId },
        })
      }

      if (!chatSession) {
        chatSession = await prisma.chatSession.create({
          data: {
            userId: session.user.id,
            collectionId: validatedData.collectionId,
            agentId: validatedData.agentId,
            title: validatedData.message.substring(0, 100),
          },
        })
      }

      // Save user message
      await prisma.chatMessage.create({
        data: {
          sessionId: chatSession.id,
          role: 'USER',
          content: validatedData.message,
          agentId: validatedData.agentId,
          modelUsed: validatedData.model,
          actionState: validatedData.actionState
            ? JSON.parse(JSON.stringify(validatedData.actionState))
            : undefined,
        },
      })

      // Save assistant message
      await prisma.chatMessage.create({
        data: {
          sessionId: chatSession.id,
          role: 'ASSISTANT',
          content: agentResult.answer,
          documentChunks: JSON.parse(JSON.stringify(agentResult.sources)),
          agentId: validatedData.agentId,
          modelUsed: validatedData.model,
          actionState: validatedData.actionState
            ? JSON.parse(JSON.stringify(validatedData.actionState))
            : undefined,
          promptTokens: agentResult.inputTokens,
          completionTokens: agentResult.outputTokens,
        },
      })

      return NextResponse.json({
        sessionId: chatSession.id,
        message: agentResult.answer,
        chunks: agentResult.sources,
        usage: {
          promptTokens: agentResult.inputTokens,
          completionTokens: agentResult.outputTokens,
          totalTokens: agentResult.inputTokens + agentResult.outputTokens,
        },
      })
    }

    // Default: use standard RAG service
    const ragService = getRAGService()
    const response = await ragService.chat({
      message: validatedData.message,
      userId: session.user.id,
      collectionId: validatedData.collectionId || undefined,
      sessionId: validatedData.sessionId || undefined,
      model: validatedData.model || undefined,
      maxTokens: validatedData.maxTokens || undefined,
    })

    return NextResponse.json(response)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Chat failed:', error)

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ error: 'Chat failed' }, { status: 500 })
  }
}

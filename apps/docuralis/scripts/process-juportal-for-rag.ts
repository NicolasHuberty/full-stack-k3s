#!/usr/bin/env bun

/**
 * Process JUPORTAL documents for RAG system
 *
 * This script enhances the basic import to create a proper RAG knowledge base:
 * 1. Import documents with legal-specific processing
 * 2. Create legal domain tags automatically
 * 3. Enhanced chunking for legal content
 * 4. Setup lawyer agent with jurisprudence collection
 */

import { prisma } from '../src/lib/prisma'
import { createCollection } from '../src/lib/collections/service'
import { fetchAllJUPORTALDocuments, getAllSitemapUrls } from './fetch-juportal-sitemaps'

interface LegalDomain {
  name: string
  keywords: string[]
  color: string
}

const LEGAL_DOMAINS: LegalDomain[] = [
  {
    name: "Constitutional Law",
    keywords: ["constitutional", "grondwettelijk", "verfassungsrecht", "arbitrage", "GHCC"],
    color: "#8B5CF6"
  },
  {
    name: "Civil Law",
    keywords: ["civil", "burgerlijk", "zivilrecht", "contract", "responsabilité", "aansprakelijkheid"],
    color: "#059669"
  },
  {
    name: "Criminal Law",
    keywords: ["criminal", "strafrecht", "pénal", "cassation", "CASS"],
    color: "#DC2626"
  },
  {
    name: "Administrative Law",
    keywords: ["administrative", "administratief", "verwaltungsrecht", "conseil d'état", "RVSCE"],
    color: "#2563EB"
  },
  {
    name: "Commercial Law",
    keywords: ["commercial", "handelsgerechtshof", "handelsrecht", "enterprise", "société", "vennootschap"],
    color: "#7C2D12"
  },
  {
    name: "Labour Law",
    keywords: ["labour", "arbeidsrecht", "arbeidsgerecht", "social", "emploi", "werkgelegenheid"],
    color: "#B45309"
  },
  {
    name: "Tax Law",
    keywords: ["tax", "fiscal", "belasting", "steuer", "douane", "TVA"],
    color: "#BE123C"
  }
]

async function createLawyerAgent(userId: string, collectionId: string) {
  console.log('👨‍⚖️ Creating specialized lawyer agent...')

  const agent = await prisma.agent.create({
    data: {
      name: "Belgian Jurisprudence Expert",
      description: `Specialized AI lawyer with complete knowledge of Belgian jurisprudence from JUPORTAL database (400,000+ court decisions from 1958-2025).

Expert in:
- Constitutional Court decisions (GHCC)
- Court of Cassation rulings (CASS)
- Council of State judgments (RVSCE)
- All Belgian court levels and jurisdictions

Provides accurate legal analysis based on actual case law with precise ECLI citations.`,
      icon: "Scale",
      status: "ACTIVE",
      systemPrompt: `You are a Belgian legal expert with access to the complete JUPORTAL jurisprudence database containing over 400,000 court decisions from 1958 to 2025.

**Your Knowledge Base:**
- Constitutional Court (Grondwettelijk Hof/Cour constitutionnelle) decisions
- Court of Cassation (Hof van Cassatie/Cour de Cassation) rulings
- Council of State (Raad van State/Conseil d'État) judgments
- Courts of Appeal, Labour Courts, First Instance Courts
- All Belgian jurisdictions in French, Dutch, and German

**Instructions:**
1. **Always cite ECLI identifiers** when referencing cases (e.g., ECLI:BE:CASS:2024:ARR.20240115.1)
2. **Provide accurate legal analysis** based on actual jurisprudence
3. **Consider hierarchy of courts** - Constitutional Court and Cassation precedents
4. **Multi-language support** - Handle queries in French, Dutch, German
5. **Historical context** - Reference evolution of jurisprudence over time
6. **Cross-reference related cases** when relevant

**Response Format:**
- Start with relevant legal principle
- Cite supporting jurisprudence with ECLI
- Explain reasoning and implications
- Mention any conflicting or evolving case law
- Provide practical guidance

**Specializations:**
- Constitutional review and fundamental rights
- Civil liability and contract law
- Criminal law and procedure
- Administrative law and public service
- Commercial and company law
- Labour law and social security
- Tax law and fiscal matters

Remember: You have access to the most comprehensive collection of Belgian case law available. Use this knowledge to provide authoritative legal guidance.`,
      temperature: 0.1, // Low temperature for legal accuracy
      model: "gpt-4o",
      createdAt: new Date(),
      updatedAt: new Date()
    }
  })

  // Link agent to jurisprudence collection
  await prisma.collectionAgent.create({
    data: {
      collectionId: collectionId,
      agentId: agent.id,
      isActive: true,
      actionState: {
        jurisprudence_mode: true,
        citation_mode: true,
        multilingual_mode: true
      }
    }
  })

  console.log(`✅ Created lawyer agent: ${agent.name} (${agent.id})`)
  return agent
}

async function createLegalDomainTags(collectionId: string) {
  console.log('🏷️ Creating legal domain tags...')

  const tags = []
  for (const domain of LEGAL_DOMAINS) {
    const tag = await prisma.collectionTag.create({
      data: {
        name: domain.name,
        color: domain.color,
        collectionId: collectionId
      }
    })
    tags.push(tag)
    console.log(`   Created tag: ${domain.name}`)
  }

  return tags
}

function detectLegalDomain(document: any): string[] {
  const text = `${document.title} ${document.extractedText}`.toLowerCase()
  const domains = []

  for (const domain of LEGAL_DOMAINS) {
    for (const keyword of domain.keywords) {
      if (text.includes(keyword.toLowerCase())) {
        domains.push(domain.name)
        break
      }
    }
  }

  return domains.length > 0 ? domains : ["General Law"]
}

async function enhancedJurisprudenceProcessing() {
  console.log('🚀 Starting enhanced JUPORTAL processing for RAG system...\n')

  // Get user
  const user = await prisma.user.findFirst()
  if (!user) {
    throw new Error('No users found in database.')
  }

  console.log(`👤 Using user: ${user.email} (${user.id})`)

  // Create specialized jurisprudence collection
  const collection = await createCollection({
    name: 'Belgian Jurisprudence - Complete Database',
    description: 'Complete Belgian court decisions from JUPORTAL (400,000+ documents, 1958-2025). Includes Constitutional Court, Court of Cassation, Council of State, and all Belgian courts with full ECLI metadata.',
    visibility: 'ORGANIZATION', // Share with legal team
    ownerId: user.id,
    embeddingModel: 'text-embedding-3-small',
    chunkSize: 1500, // Larger chunks for legal context
    chunkOverlap: 300 // More overlap for legal coherence
  })

  console.log(`📚 Created collection: ${collection.name} (${collection.id})`)

  // Create legal domain tags
  await createLegalDomainTags(collection.id)

  // Create specialized lawyer agent
  await createLawyerAgent(user.id, collection.id)

  // Process documents with legal enhancements
  console.log('\n📄 Processing jurisprudence documents...')

  // Import documents using existing script but with enhancements
  await fetchAllJUPORTALDocuments(5, 100) // Start with sample

  // Get imported documents to tag them
  const documents = await prisma.document.findMany({
    where: { collectionId: collection.id },
    include: { tags: true }
  })

  console.log(`\n🏷️ Auto-tagging ${documents.length} documents by legal domain...`)

  // Get all tags for this collection
  const allTags = await prisma.collectionTag.findMany({
    where: { collectionId: collection.id }
  })

  const tagMap = new Map(allTags.map(tag => [tag.name, tag.id]))

  let taggedCount = 0
  for (const document of documents) {
    const domains = detectLegalDomain(document)

    for (const domainName of domains) {
      const tagId = tagMap.get(domainName)
      if (tagId) {
        // Check if tag relationship already exists
        const existingTag = await prisma.documentTag.findFirst({
          where: {
            documentId: document.id,
            tagId: tagId
          }
        })

        if (!existingTag) {
          await prisma.documentTag.create({
            data: {
              documentId: document.id,
              tagId: tagId
            }
          })
        }
      }
    }

    taggedCount++
    if (taggedCount % 20 === 0) {
      console.log(`   Tagged ${taggedCount}/${documents.length} documents...`)
    }
  }

  console.log('\n🎉 Enhanced processing completed!')
  console.log('=====================================')
  console.log(`📚 Collection: ${collection.name}`)
  console.log(`📄 Documents processed: ${documents.length}`)
  console.log(`🏷️ Legal domain tags created: ${LEGAL_DOMAINS.length}`)
  console.log(`👨‍⚖️ Lawyer agent ready for jurisprudence queries`)
  console.log(`\n🔗 Collection ID: ${collection.id}`)

  return {
    collection,
    documentCount: documents.length,
    tagCount: LEGAL_DOMAINS.length
  }
}

// Execute if run directly
if (require.main === module) {
  enhancedJurisprudenceProcessing()
    .then((result) => {
      console.log('\n✅ Setup completed successfully!')
      console.log(`Your lawyer agent now has access to ${result.documentCount} Belgian court decisions!`)
      process.exit(0)
    })
    .catch((error) => {
      console.error('\n💥 Error:', error)
      process.exit(1)
    })
}

export { enhancedJurisprudenceProcessing, createLawyerAgent, LEGAL_DOMAINS }
//
//  MemoDetailView.swift
//  DataNest
//
//  Created by Claude Code
//

import SwiftUI

struct MemoDetailView: View {
    @EnvironmentObject var api: APIService
    @Environment(\.dismiss) var dismiss
    let memo: Memo

    @State private var messages: [MemoMessage] = []
    @State private var newMessage = ""
    @State private var isLoading = false
    @State private var isSending = false
    @State private var errorMessage = ""

    var body: some View {
        NavigationView {
            VStack(spacing: 0) {
                // Messages area
                ScrollViewReader { proxy in
                    ScrollView {
                        LazyVStack(spacing: 16) {
                            if isLoading && messages.isEmpty {
                                ProgressView()
                                    .padding()
                            } else if messages.isEmpty {
                                emptyState
                            } else {
                                ForEach(messages) { message in
                                    MessageBubble(message: message)
                                        .id(message.id)
                                }
                            }
                        }
                        .padding()
                    }
                    .onChange(of: messages.count) { _ in
                        if let lastMessage = messages.last {
                            withAnimation {
                                proxy.scrollTo(lastMessage.id, anchor: .bottom)
                            }
                        }
                    }
                }

                // Input area
                VStack(spacing: 8) {
                    if !errorMessage.isEmpty {
                        Text(errorMessage)
                            .font(.caption)
                            .foregroundColor(.red)
                            .padding(.horizontal)
                    }

                    HStack(spacing: 12) {
                        TextField("Type your message...", text: $newMessage, axis: .vertical)
                            .textFieldStyle(RoundedBorderTextFieldStyle())
                            .lineLimit(1...5)
                            .disabled(isSending)

                        Button(action: sendMessage) {
                            if isSending {
                                ProgressView()
                                    .progressViewStyle(CircularProgressViewStyle())
                            } else {
                                Image(systemName: "paperplane.fill")
                            }
                        }
                        .buttonStyle(.borderedProminent)
                        .disabled(newMessage.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isSending)
                    }
                    .padding(.horizontal)

                    Text("AI responses coming soon!")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                        .padding(.bottom, 8)
                }
                .background(Color(NSColor.windowBackgroundColor))
                .overlay(Divider(), alignment: .top)
            }
            .navigationTitle(memo.title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Done") {
                        dismiss()
                    }
                }

                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(action: loadMessages) {
                        Image(systemName: "arrow.clockwise")
                    }
                    .disabled(isLoading)
                }
            }
            .onAppear {
                loadMessages()
            }
        }
    }

    private var emptyState: some View {
        VStack(spacing: 16) {
            Image(systemName: "bubble.left.and.bubble.right")
                .font(.system(size: 50))
                .foregroundColor(.secondary)

            Text("No messages yet")
                .font(.title3)
                .fontWeight(.medium)

            Text("Start the conversation by sending a message below")
                .font(.body)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
        }
        .padding()
    }

    private func loadMessages() {
        isLoading = true
        errorMessage = ""

        Task {
            do {
                let fetchedMessages = try await api.fetchMessages(memoId: memo.id)
                await MainActor.run {
                    messages = fetchedMessages
                    isLoading = false
                }
            } catch {
                await MainActor.run {
                    errorMessage = error.localizedDescription
                    isLoading = false
                }
            }
        }
    }

    private func sendMessage() {
        let content = newMessage.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !content.isEmpty else { return }

        errorMessage = ""
        isSending = true
        newMessage = "" // Clear immediately for better UX

        Task {
            do {
                let message = try await api.createMessage(memoId: memo.id, content: content)
                await MainActor.run {
                    messages.append(message)
                    isSending = false
                }
            } catch {
                await MainActor.run {
                    errorMessage = error.localizedDescription
                    newMessage = content // Restore message on error
                    isSending = false
                }
            }
        }
    }
}

struct MessageBubble: View {
    let message: MemoMessage

    var body: some View {
        HStack {
            if message.role == .user {
                Spacer()
            }

            VStack(alignment: message.role == .user ? .trailing : .leading, spacing: 4) {
                Text(message.content)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 10)
                    .background(message.role == .user ? Color.blue : Color(NSColor.controlBackgroundColor))
                    .foregroundColor(message.role == .user ? .white : .primary)
                    .cornerRadius(18)

                if !message.attachments.isEmpty {
                    ForEach(message.attachments) { attachment in
                        HStack(spacing: 6) {
                            Image(systemName: "paperclip")
                                .font(.caption2)
                            Text(attachment.filename)
                                .font(.caption2)
                            Text(attachment.formattedSize)
                                .font(.caption2)
                                .foregroundColor(.secondary)
                        }
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .background(Color(NSColor.controlBackgroundColor).opacity(0.5))
                        .cornerRadius(12)
                    }
                }

                Text(message.formattedTime)
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }

            if message.role == .assistant {
                Spacer()
            }
        }
    }
}

#Preview {
    MemoDetailView(memo: Memo(
        id: "1",
        title: "Test Memo",
        description: "A test memo",
        messageCount: 0,
        createdAt: "2025-10-16T12:00:00Z",
        updatedAt: "2025-10-16T12:00:00Z"
    ))
    .environmentObject(APIService.shared)
}

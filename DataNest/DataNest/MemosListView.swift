//
//  MemosListView.swift
//  DataNest
//
//  Created by Claude Code
//

import SwiftUI

struct MemosListView: View {
    @EnvironmentObject var api: APIService
    @State private var memos: [Memo] = []
    @State private var isLoading = false
    @State private var errorMessage = ""
    @State private var showCreateMemo = false
    @State private var selectedMemo: Memo?

    var body: some View {
        NavigationView {
            Group {
                if isLoading && memos.isEmpty {
                    ProgressView("Loading memos...")
                } else if memos.isEmpty {
                    emptyState
                } else {
                    memosList
                }
            }
            .navigationTitle("Memos")
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    if let user = api.currentUser {
                        Text(user.email)
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }

                ToolbarItem(placement: .navigationBarTrailing) {
                    HStack {
                        Button(action: loadMemos) {
                            Image(systemName: "arrow.clockwise")
                        }
                        .disabled(isLoading)

                        Button(action: { showCreateMemo = true }) {
                            Image(systemName: "plus")
                        }

                        Button("Logout") {
                            Task {
                                await api.logout()
                            }
                        }
                    }
                }
            }
            .onAppear {
                loadMemos()
            }
            .sheet(isPresented: $showCreateMemo) {
                CreateMemoView(onCreated: { memo in
                    memos.insert(memo, at: 0)
                })
                .environmentObject(api)
            }
            .sheet(item: $selectedMemo) { memo in
                MemoDetailView(memo: memo)
                    .environmentObject(api)
            }
            .alert("Error", isPresented: .constant(!errorMessage.isEmpty)) {
                Button("OK") {
                    errorMessage = ""
                }
            } message: {
                Text(errorMessage)
            }
        }
    }

    private var emptyState: some View {
        VStack(spacing: 20) {
            Image(systemName: "doc.text.magnifyingglass")
                .font(.system(size: 70))
                .foregroundColor(.secondary)

            Text("No Memos Yet")
                .font(.title2)
                .fontWeight(.semibold)

            Text("Create your first memo to start taking notes")
                .font(.body)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)

            Button("Create Memo") {
                showCreateMemo = true
            }
            .buttonStyle(.borderedProminent)
        }
        .padding()
    }

    private var memosList: some View {
        List {
            ForEach(memos) { memo in
                MemoRow(memo: memo)
                    .contentShape(Rectangle())
                    .onTapGesture {
                        selectedMemo = memo
                    }
                    .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                        Button(role: .destructive) {
                            deleteMemo(memo)
                        } label: {
                            Label("Delete", systemImage: "trash")
                        }
                    }
            }
        }
        .refreshable {
            loadMemos()
        }
    }

    private func loadMemos() {
        isLoading = true
        errorMessage = ""

        Task {
            do {
                let fetchedMemos = try await api.fetchMemos()
                await MainActor.run {
                    memos = fetchedMemos
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

    private func deleteMemo(_ memo: Memo) {
        Task {
            do {
                try await api.deleteMemo(id: memo.id)
                await MainActor.run {
                    memos.removeAll { $0.id == memo.id }
                }
            } catch {
                await MainActor.run {
                    errorMessage = error.localizedDescription
                }
            }
        }
    }
}

struct MemoRow: View {
    let memo: Memo

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(memo.title)
                .font(.headline)

            if let description = memo.description {
                Text(description)
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .lineLimit(2)
            }

            HStack {
                Label("\(memo.messageCount)", systemImage: "bubble.left.and.bubble.right")
                    .font(.caption)
                    .foregroundColor(.secondary)

                Spacer()

                Text(memo.formattedDate)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
        .padding(.vertical, 4)
    }
}

#Preview {
    MemosListView()
        .environmentObject(APIService.shared)
}

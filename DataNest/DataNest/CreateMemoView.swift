//
//  CreateMemoView.swift
//  DataNest
//
//  Created by Claude Code
//

import SwiftUI

struct CreateMemoView: View {
    @EnvironmentObject var api: APIService
    @Environment(\.dismiss) var dismiss
    @State private var title = ""
    @State private var description = ""
    @State private var isLoading = false
    @State private var errorMessage = ""

    let onCreated: (Memo) -> Void

    var body: some View {
        NavigationView {
            Form {
                Section(header: Text("Memo Details")) {
                    TextField("Title", text: $title)
                        .textFieldStyle(RoundedBorderTextFieldStyle())

                    TextField("Description (optional)", text: $description, axis: .vertical)
                        .textFieldStyle(RoundedBorderTextFieldStyle())
                        .lineLimit(3...6)
                }

                if !errorMessage.isEmpty {
                    Section {
                        Text(errorMessage)
                            .foregroundColor(.red)
                            .font(.caption)
                    }
                }
            }
            .navigationTitle("New Memo")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") {
                        dismiss()
                    }
                    .disabled(isLoading)
                }

                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Create") {
                        createMemo()
                    }
                    .disabled(title.isEmpty || isLoading)
                }
            }
        }
    }

    private func createMemo() {
        errorMessage = ""
        isLoading = true

        Task {
            do {
                let newMemo = try await api.createMemo(
                    title: title,
                    description: description.isEmpty ? nil : description
                )
                await MainActor.run {
                    onCreated(newMemo)
                    dismiss()
                }
            } catch {
                await MainActor.run {
                    errorMessage = error.localizedDescription
                    isLoading = false
                }
            }
        }
    }
}

#Preview {
    CreateMemoView { _ in }
        .environmentObject(APIService.shared)
}

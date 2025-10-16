//
//  Models.swift
//  DataNest
//
//  Created by Claude Code
//

import Foundation

// MARK: - User & Auth Models

struct User: Codable, Identifiable {
    let id: String
    let email: String
}

struct AuthResponse: Codable {
    let accessToken: String
    let refreshToken: String
    let tokenType: String
    let expiresIn: Int
    let user: User

    enum CodingKeys: String, CodingKey {
        case accessToken = "access_token"
        case refreshToken = "refresh_token"
        case tokenType = "token_type"
        case expiresIn = "expires_in"
        case user
    }
}

struct LoginRequest: Codable {
    let email: String
    let password: String
}

struct RegisterRequest: Codable {
    let email: String
    let password: String
}

struct RefreshRequest: Codable {
    let refreshToken: String

    enum CodingKeys: String, CodingKey {
        case refreshToken = "refresh_token"
    }
}

// MARK: - Memo Models

struct Memo: Codable, Identifiable {
    let id: String
    let title: String
    let description: String?
    let messageCount: Int
    let createdAt: String
    let updatedAt: String

    enum CodingKeys: String, CodingKey {
        case id, title, description
        case messageCount = "message_count"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }

    var formattedDate: String {
        let formatter = ISO8601DateFormatter()
        guard let date = formatter.date(from: createdAt) else {
            return "Unknown date"
        }

        let displayFormatter = DateFormatter()
        displayFormatter.dateStyle = .medium
        displayFormatter.timeStyle = .short
        return displayFormatter.string(from: date)
    }
}

struct CreateMemoRequest: Codable {
    let title: String
    let description: String?
}

struct MemoMessage: Codable, Identifiable {
    let id: String
    let content: String
    let role: MessageRole
    let attachments: [MemoAttachment]
    let createdAt: String

    enum CodingKeys: String, CodingKey {
        case id, content, role, attachments
        case createdAt = "created_at"
    }

    var formattedTime: String {
        let formatter = ISO8601DateFormatter()
        guard let date = formatter.date(from: createdAt) else {
            return "Unknown"
        }

        let now = Date()
        let diffSeconds = Int(now.timeIntervalSince(date))
        let diffMinutes = diffSeconds / 60
        let diffHours = diffMinutes / 60
        let diffDays = diffHours / 24

        if diffSeconds < 60 {
            return "Just now"
        } else if diffMinutes < 60 {
            return "\(diffMinutes)m ago"
        } else if diffHours < 24 {
            return "\(diffHours)h ago"
        } else if diffDays < 7 {
            return "\(diffDays)d ago"
        } else {
            let displayFormatter = DateFormatter()
            displayFormatter.dateStyle = .short
            return displayFormatter.string(from: date)
        }
    }
}

enum MessageRole: String, Codable {
    case user
    case assistant
}

struct CreateMessageRequest: Codable {
    let content: String
}

struct MemoAttachment: Codable, Identifiable {
    let id: String
    let filename: String
    let mimeType: String?
    let fileSize: Int
    let createdAt: String

    enum CodingKeys: String, CodingKey {
        case id, filename
        case mimeType = "mime_type"
        case fileSize = "file_size"
        case createdAt = "created_at"
    }

    var formattedSize: String {
        let kb = Double(fileSize) / 1024.0
        if kb < 1024 {
            return String(format: "%.1f KB", kb)
        } else {
            let mb = kb / 1024.0
            return String(format: "%.1f MB", mb)
        }
    }
}

// MARK: - Error Response

struct ErrorResponse: Codable {
    let error: String
}

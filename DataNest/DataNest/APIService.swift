//
//  APIService.swift
//  DataNest
//
//  Created by Claude Code
//

import Foundation

class APIService: ObservableObject {
    static let shared = APIService()

    private let baseURL = "https://api-dev.huberty.pro"
    private var refreshTask: Task<Void, Error>?

    @Published var isAuthenticated = false
    @Published var currentUser: User?

    private init() {
        loadAuthState()
    }

    // MARK: - Token Management

    private func loadAuthState() {
        if let _ = getAccessToken(), let userData = UserDefaults.standard.data(forKey: "user") {
            do {
                currentUser = try JSONDecoder().decode(User.self, from: userData)
                isAuthenticated = true
            } catch {
                print("Failed to decode user: \(error)")
            }
        }
    }

    private func saveAuthData(_ authResponse: AuthResponse) {
        UserDefaults.standard.set(authResponse.accessToken, forKey: "access_token")
        UserDefaults.standard.set(authResponse.refreshToken, forKey: "refresh_token")
        UserDefaults.standard.set(Date().timeIntervalSince1970 + Double(authResponse.expiresIn), forKey: "token_expires_at")

        if let userData = try? JSONEncoder().encode(authResponse.user) {
            UserDefaults.standard.set(userData, forKey: "user")
        }

        DispatchQueue.main.async {
            self.currentUser = authResponse.user
            self.isAuthenticated = true
        }
    }

    private func clearAuthData() {
        UserDefaults.standard.removeObject(forKey: "access_token")
        UserDefaults.standard.removeObject(forKey: "refresh_token")
        UserDefaults.standard.removeObject(forKey: "token_expires_at")
        UserDefaults.standard.removeObject(forKey: "user")

        DispatchQueue.main.async {
            self.currentUser = nil
            self.isAuthenticated = false
        }
    }

    private func getAccessToken() -> String? {
        return UserDefaults.standard.string(forKey: "access_token")
    }

    private func getRefreshToken() -> String? {
        return UserDefaults.standard.string(forKey: "refresh_token")
    }

    // MARK: - Token Refresh

    private func refreshTokenIfNeeded() async throws {
        // If refresh is already in progress, wait for it
        if let task = refreshTask {
            try await task.value
            return
        }

        // Check if token needs refresh
        let expiresAt = UserDefaults.standard.double(forKey: "token_expires_at")
        let now = Date().timeIntervalSince1970
        let bufferTime: Double = 300 // Refresh 5 minutes before expiry

        guard now + bufferTime >= expiresAt else {
            return // Token is still valid
        }

        guard let refreshToken = getRefreshToken() else {
            throw APIError.unauthorized
        }

        // Create refresh task
        let task = Task<Void, Error> {
            let request = RefreshRequest(refreshToken: refreshToken)
            let url = URL(string: "\(baseURL)/api/auth/refresh")!

            var urlRequest = URLRequest(url: url)
            urlRequest.httpMethod = "POST"
            urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
            urlRequest.httpBody = try JSONEncoder().encode(request)

            let (data, response) = try await URLSession.shared.data(for: urlRequest)

            guard let httpResponse = response as? HTTPURLResponse else {
                throw APIError.invalidResponse
            }

            if httpResponse.statusCode == 200 {
                let authResponse = try JSONDecoder().decode(AuthResponse.self, from: data)
                saveAuthData(authResponse)
            } else {
                clearAuthData()
                throw APIError.unauthorized
            }
        }

        refreshTask = task

        do {
            try await task.value
        } catch {
            refreshTask = nil
            throw error
        }

        refreshTask = nil
    }

    // MARK: - HTTP Request Helper

    private func makeRequest<T: Decodable>(
        endpoint: String,
        method: String = "GET",
        body: Encodable? = nil,
        requiresAuth: Bool = true
    ) async throws -> T {
        if requiresAuth {
            try await refreshTokenIfNeeded()
        }

        let url = URL(string: "\(baseURL)\(endpoint)")!
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        if requiresAuth, let token = getAccessToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        if let body = body {
            request.httpBody = try JSONEncoder().encode(body)
        }

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        if httpResponse.statusCode == 401 && requiresAuth {
            // Token refresh failed or invalid, try one more time
            try await refreshTokenIfNeeded()

            if let token = getAccessToken() {
                request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
                let (retryData, retryResponse) = try await URLSession.shared.data(for: request)

                guard let retryHttpResponse = retryResponse as? HTTPURLResponse else {
                    throw APIError.invalidResponse
                }

                if retryHttpResponse.statusCode >= 200 && retryHttpResponse.statusCode < 300 {
                    return try JSONDecoder().decode(T.self, from: retryData)
                }
            }

            clearAuthData()
            throw APIError.unauthorized
        }

        guard httpResponse.statusCode >= 200 && httpResponse.statusCode < 300 else {
            if let errorResponse = try? JSONDecoder().decode(ErrorResponse.self, from: data) {
                throw APIError.serverError(errorResponse.error)
            }
            throw APIError.httpError(httpResponse.statusCode)
        }

        return try JSONDecoder().decode(T.self, from: data)
    }

    // MARK: - Authentication

    func register(email: String, password: String) async throws {
        let request = RegisterRequest(email: email, password: password)
        let response: AuthResponse = try await makeRequest(
            endpoint: "/api/auth/register",
            method: "POST",
            body: request,
            requiresAuth: false
        )
        saveAuthData(response)
    }

    func login(email: String, password: String) async throws {
        let request = LoginRequest(email: email, password: password)
        let response: AuthResponse = try await makeRequest(
            endpoint: "/api/auth/login",
            method: "POST",
            body: request,
            requiresAuth: false
        )
        saveAuthData(response)
    }

    func logout() async {
        do {
            let _: EmptyResponse = try await makeRequest(
                endpoint: "/api/auth/logout",
                method: "POST"
            )
        } catch {
            print("Logout error: \(error)")
        }
        clearAuthData()
    }

    // MARK: - Memos

    func fetchMemos() async throws -> [Memo] {
        return try await makeRequest(endpoint: "/api/memos")
    }

    func createMemo(title: String, description: String?) async throws -> Memo {
        let request = CreateMemoRequest(title: title, description: description)
        return try await makeRequest(
            endpoint: "/api/memos",
            method: "POST",
            body: request
        )
    }

    func getMemo(id: String) async throws -> Memo {
        return try await makeRequest(endpoint: "/api/memos/\(id)")
    }

    func deleteMemo(id: String) async throws {
        let _: EmptyResponse = try await makeRequest(
            endpoint: "/api/memos/\(id)",
            method: "DELETE"
        )
    }

    // MARK: - Memo Messages

    func fetchMessages(memoId: String) async throws -> [MemoMessage] {
        return try await makeRequest(endpoint: "/api/memos/\(memoId)/messages")
    }

    func createMessage(memoId: String, content: String) async throws -> MemoMessage {
        let request = CreateMessageRequest(content: content)
        return try await makeRequest(
            endpoint: "/api/memos/\(memoId)/messages",
            method: "POST",
            body: request
        )
    }
}

// MARK: - API Errors

enum APIError: LocalizedError {
    case invalidResponse
    case unauthorized
    case serverError(String)
    case httpError(Int)

    var errorDescription: String? {
        switch self {
        case .invalidResponse:
            return "Invalid response from server"
        case .unauthorized:
            return "Unauthorized. Please log in again."
        case .serverError(let message):
            return message
        case .httpError(let code):
            return "HTTP error: \(code)"
        }
    }
}

// MARK: - Helper Types

private struct EmptyResponse: Codable {}

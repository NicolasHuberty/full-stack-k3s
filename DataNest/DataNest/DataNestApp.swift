//
//  DataNestApp.swift
//  DataNest
//
//  Created by Nicolas Huberty on 15/10/2025.
//

import SwiftUI

@main
struct DataNestApp: App {
    @StateObject private var api = APIService.shared

    var body: some Scene {
        WindowGroup {
            Group {
                if api.isAuthenticated {
                    MemosListView()
                } else {
                    LoginView()
                }
            }
            .environmentObject(api)
        }
    }
}

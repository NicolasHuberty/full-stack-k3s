//
//  ContentView.swift
//  DataNest
//
//  Created by Nicolas Huberty on 15/10/2025.
//

import SwiftUI

struct ContentView: View {
    @State private var userName = ""
    @State private var clickCount = 0
    @State private var showGreeting = false
    
    var body: some View {
        NavigationView {
            VStack(spacing: 30) {
                // Header with animated icon
                VStack {
                    Image(systemName: showGreeting ? "hand.wave.fill" : "globe")
                        .imageScale(.large)
                        .foregroundStyle(.tint)
                        .font(.system(size: 60))
                        .rotationEffect(.degrees(showGreeting ? 20 : 0))
                        .animation(.easeInOut(duration: 0.5), value: showGreeting)
                    
                    Text(showGreeting ? "Hello, \(userName.isEmpty ? "Friend" : userName)!" : "Hello, World!")
                        .font(.largeTitle)
                        .fontWeight(.bold)
                        .multilineTextAlignment(.center)
                }
                
                // User input section
                VStack(spacing: 15) {
                    TextField("Enter your name", text: $userName)
                        .textFieldStyle(RoundedBorderTextFieldStyle())
                        .onSubmit {
                            withAnimation {
                                showGreeting = true
                            }
                        }
                    
                    Button("Say Hello!") {
                        withAnimation {
                            showGreeting = true
                            clickCount += 1
                        }
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(userName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
                
                // Interactive counter
                VStack {
                    Text("Button pressed: \(clickCount) time\(clickCount == 1 ? "" : "s")")
                        .foregroundStyle(.secondary)
                    
                    if clickCount > 0 {
                        Button("Reset") {
                            withAnimation {
                                clickCount = 0
                                showGreeting = false
                                userName = ""
                            }
                        }
                        .buttonStyle(.bordered)
                    }
                }
                
                Spacer()
            }
            .padding()
            .navigationTitle("DataNest")
        }
    }
}

#Preview {
    ContentView()
}

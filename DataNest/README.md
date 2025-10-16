# DataNest - Native macOS Memos App

A native macOS application for managing memos, built with SwiftUI and connected to the K3s Memos API.

## Features

- ✅ User authentication (Login/Register)
- ✅ Automatic token refresh
- ✅ View all memos
- ✅ Create new memos
- ✅ View memo messages in chat-style interface
- ✅ Send messages to memos
- ✅ Delete memos
- ✅ Pull to refresh
- ✅ Swipe to delete

## Setup Instructions

### 1. Add New Files to Xcode Project

The following new Swift files have been created but need to be added to the Xcode project:

1. Open `DataNest.xcodeproj` in Xcode
2. Right-click on the "DataNest" folder in the Project Navigator
3. Select "Add Files to 'DataNest'..."
4. Select these files (⌘-click to select multiple):
   - `Models.swift`
   - `APIService.swift`
   - `LoginView.swift`
   - `RegisterView.swift`
   - `MemosListView.swift`
   - `CreateMemoView.swift`
   - `MemoDetailView.swift`
5. Make sure "Copy items if needed" is unchecked (files are already in the right location)
6. Make sure "Add to targets: DataNest" is checked
7. Click "Add"

### 2. Update Build Settings (if needed)

If you get provisioning profile errors:

1. Select the project in Project Navigator
2. Select the "DataNest" target
3. Go to "Signing & Capabilities"
4. Uncheck "Automatically manage signing"
5. Set "Signing Certificate" to "Sign to Run Locally"

### 3. Build and Run

Press ⌘+R or click the Run button to build and launch the app.

## Architecture

### API Service (`APIService.swift`)

- Singleton service managing all API communication
- Automatic token refresh before expiration
- Handles authentication state
- Published properties for SwiftUI reactivity

### Token Refresh Logic

The app automatically refreshes access tokens:

1. Before each API request, checks if token expires within 5 minutes
2. If needed, uses refresh token to get new access token
3. Stores tokens in UserDefaults
4. If refresh fails, user is logged out automatically
5. On 401 errors, attempts one token refresh retry

### Views

1. **LoginView**: Email/password authentication with link to register
2. **RegisterView**: New user registration form
3. **MemosListView**: List of all memos with pull-to-refresh and swipe-to-delete
4. **CreateMemoView**: Form to create new memo
5. **MemoDetailView**: Chat-style interface for viewing and sending messages

### Models

All data models match the backend API:
- `User`, `AuthResponse`
- `Memo`, `MemoMessage`, `MemoAttachment`
- ISO8601 date parsing with relative time formatting

## API Endpoints Used

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - Logout
- `GET /api/memos` - List all memos
- `POST /api/memos` - Create memo
- `GET /api/memos/{id}` - Get memo details
- `DELETE /api/memos/{id}` - Delete memo
- `GET /api/memos/{id}/messages` - Get messages
- `POST /api/memos/{id}/messages` - Send message

## Configuration

The app is configured to connect to:
- **API Base URL**: `https://api-dev.huberty.pro`

To change the environment, edit the `baseURL` property in `APIService.swift`.

## Testing

1. Launch the app
2. Create a new account or login with existing credentials
3. Create a memo
4. Click on the memo to view details
5. Send messages in the chat interface
6. Try pull-to-refresh and swipe-to-delete

## Token Storage

Tokens are stored in UserDefaults:
- `access_token` - JWT access token (1 hour expiry)
- `refresh_token` - JWT refresh token (30 day expiry)
- `token_expires_at` - Timestamp for access token expiration
- `user` - JSON encoded user object

## Future Enhancements

- [ ] File attachments
- [ ] Audio recording and transcription
- [ ] Search functionality
- [ ] Offline support with local caching
- [ ] AI response integration
- [ ] Push notifications
- [ ] Export memos

## Troubleshooting

### "Type 'APIService' does not conform to protocol 'ObservableObject'"

This error means the new Swift files haven't been added to the Xcode project yet. Follow the "Setup Instructions" above to add them.

### "Provisioning profile" errors

The app is configured for iOS but should work on macOS. To fix:
1. Change the deployment target to macOS in project settings
2. Or set signing to "Sign to Run Locally"

### "Connection failed" errors

Make sure the backend API is running at `https://api-dev.huberty.pro` and accessible from your Mac.

## Credits

Built with SwiftUI and Combine
Backend: Rust/Actix-web API

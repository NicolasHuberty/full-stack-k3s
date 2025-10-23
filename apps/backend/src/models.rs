use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use utoipa::ToSchema;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, FromRow, ToSchema)]
pub struct User {
    pub id: Uuid,
    pub email: String,
    #[serde(skip_serializing)]
    pub password_hash: String,
    pub created_at: chrono::NaiveDateTime,
    pub updated_at: chrono::NaiveDateTime,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct RegisterRequest {
    pub email: String,
    pub password: String,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct AuthResponse {
    pub access_token: String,
    pub refresh_token: String,
    pub token_type: String,
    pub expires_in: i64,
    pub user: UserResponse,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct RefreshRequest {
    pub refresh_token: String,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct UserResponse {
    pub id: Uuid,
    pub email: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,
    pub email: String,
    pub exp: usize,
}

#[derive(Debug, Serialize, Deserialize, FromRow, ToSchema)]
pub struct File {
    pub id: Uuid,
    pub user_id: Uuid,
    pub filename: String,
    pub minio_path: String,
    pub file_size: i64,
    pub mime_type: Option<String>,
    pub status: String,
    pub created_at: chrono::NaiveDateTime,
    pub updated_at: chrono::NaiveDateTime,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct FileResponse {
    pub id: Uuid,
    pub filename: String,
    pub file_size: i64,
    pub mime_type: Option<String>,
    pub status: String,
    pub created_at: chrono::NaiveDateTime,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct SearchRequest {
    pub query: String,
    pub limit: Option<usize>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct SearchResponse {
    pub results: Vec<SearchResult>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct SearchResult {
    pub file_id: Uuid,
    pub filename: String,
    pub chunk_text: String,
    pub score: f32,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct RagQueryRequest {
    pub query: String,
    pub context_limit: Option<usize>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct RagQueryResponse {
    pub answer: String,
    pub sources: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct ErrorResponse {
    pub error: String,
}

// Memos models
#[derive(Debug, Serialize, Deserialize, FromRow, ToSchema)]
pub struct Memo {
    pub id: Uuid,
    pub user_id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub created_at: chrono::NaiveDateTime,
    pub updated_at: chrono::NaiveDateTime,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct MemoResponse {
    pub id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub message_count: i64,
    pub created_at: chrono::NaiveDateTime,
    pub updated_at: chrono::NaiveDateTime,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct CreateMemoRequest {
    pub title: String,
    pub description: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, FromRow, ToSchema)]
pub struct MemoMessage {
    pub id: Uuid,
    pub memo_id: Uuid,
    pub user_id: Uuid,
    pub content: String,
    pub role: String, // "user" or "assistant"
    pub created_at: chrono::NaiveDateTime,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct MemoMessageResponse {
    pub id: Uuid,
    pub content: String,
    pub role: String,
    pub attachments: Vec<MemoAttachmentResponse>,
    pub created_at: chrono::NaiveDateTime,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct CreateMemoMessageRequest {
    pub content: String,
}

#[derive(Debug, Serialize, Deserialize, FromRow, ToSchema)]
pub struct MemoAttachment {
    pub id: Uuid,
    pub message_id: Uuid,
    pub file_id: Uuid,
    pub created_at: chrono::NaiveDateTime,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct MemoAttachmentResponse {
    pub id: Uuid,
    pub filename: String,
    pub mime_type: Option<String>,
    pub file_size: i64,
    pub created_at: chrono::NaiveDateTime,
}

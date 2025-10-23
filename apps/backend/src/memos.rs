use crate::db;
use crate::models::{
    Claims, CreateMemoMessageRequest, CreateMemoRequest, MemoAttachmentResponse,
    MemoMessageResponse, MemoResponse,
};
use actix_web::{web, Error, HttpResponse};
use sqlx::{Pool, Postgres};
use uuid::Uuid;

#[utoipa::path(
    post,
    path = "/api/memos",
    request_body = CreateMemoRequest,
    responses(
        (status = 200, description = "Memo created successfully", body = MemoResponse),
        (status = 401, description = "Unauthorized")
    ),
    security(
        ("bearer" = [])
    ),
    tag = "memos"
)]
pub async fn create_memo(
    pool: web::Data<Pool<Postgres>>,
    claims: web::ReqData<Claims>,
    req: web::Json<CreateMemoRequest>,
) -> Result<HttpResponse, Error> {
    let user_id = Uuid::parse_str(&claims.sub).map_err(|e| {
        log::error!("UUID parse error: {}", e);
        actix_web::error::ErrorBadRequest("Invalid user ID")
    })?;

    let memo = db::create_memo(&pool, &user_id, &req.title, req.description.as_deref())
        .await
        .map_err(|e| {
            log::error!("Database error: {}", e);
            actix_web::error::ErrorInternalServerError("Database error")
        })?;

    let message_count = 0;

    Ok(HttpResponse::Ok().json(MemoResponse {
        id: memo.id,
        title: memo.title,
        description: memo.description,
        message_count,
        created_at: memo.created_at,
        updated_at: memo.updated_at,
    }))
}

#[utoipa::path(
    get,
    path = "/api/memos",
    responses(
        (status = 200, description = "List of user memos", body = Vec<MemoResponse>),
        (status = 401, description = "Unauthorized")
    ),
    security(
        ("bearer" = [])
    ),
    tag = "memos"
)]
pub async fn list_memos(
    pool: web::Data<Pool<Postgres>>,
    claims: web::ReqData<Claims>,
) -> Result<HttpResponse, Error> {
    let user_id = Uuid::parse_str(&claims.sub).map_err(|e| {
        log::error!("UUID parse error: {}", e);
        actix_web::error::ErrorBadRequest("Invalid user ID")
    })?;

    let memos = db::get_user_memos(&pool, &user_id).await.map_err(|e| {
        log::error!("Database error: {}", e);
        actix_web::error::ErrorInternalServerError("Database error")
    })?;

    let mut responses = Vec::new();
    for memo in memos {
        let message_count = db::get_memo_message_count(&pool, &memo.id)
            .await
            .unwrap_or(0);

        responses.push(MemoResponse {
            id: memo.id,
            title: memo.title,
            description: memo.description,
            message_count,
            created_at: memo.created_at,
            updated_at: memo.updated_at,
        });
    }

    Ok(HttpResponse::Ok().json(responses))
}

#[utoipa::path(
    get,
    path = "/api/memos/{memo_id}",
    params(
        ("memo_id" = Uuid, Path, description = "Memo ID")
    ),
    responses(
        (status = 200, description = "Memo details", body = MemoResponse),
        (status = 404, description = "Memo not found"),
        (status = 401, description = "Unauthorized")
    ),
    security(
        ("bearer" = [])
    ),
    tag = "memos"
)]
pub async fn get_memo(
    pool: web::Data<Pool<Postgres>>,
    claims: web::ReqData<Claims>,
    memo_id: web::Path<Uuid>,
) -> Result<HttpResponse, Error> {
    let user_id = Uuid::parse_str(&claims.sub).map_err(|e| {
        log::error!("UUID parse error: {}", e);
        actix_web::error::ErrorBadRequest("Invalid user ID")
    })?;

    let memo = db::get_memo_by_id(&pool, &memo_id, &user_id)
        .await
        .map_err(|e| {
            log::error!("Database error: {}", e);
            actix_web::error::ErrorInternalServerError("Database error")
        })?;

    match memo {
        Some(m) => {
            let message_count = db::get_memo_message_count(&pool, &m.id).await.unwrap_or(0);

            Ok(HttpResponse::Ok().json(MemoResponse {
                id: m.id,
                title: m.title,
                description: m.description,
                message_count,
                created_at: m.created_at,
                updated_at: m.updated_at,
            }))
        }
        None => Ok(HttpResponse::NotFound().json(serde_json::json!({
            "error": "Memo not found"
        }))),
    }
}

#[utoipa::path(
    delete,
    path = "/api/memos/{memo_id}",
    params(
        ("memo_id" = Uuid, Path, description = "Memo ID")
    ),
    responses(
        (status = 200, description = "Memo deleted successfully"),
        (status = 404, description = "Memo not found"),
        (status = 401, description = "Unauthorized")
    ),
    security(
        ("bearer" = [])
    ),
    tag = "memos"
)]
pub async fn delete_memo(
    pool: web::Data<Pool<Postgres>>,
    claims: web::ReqData<Claims>,
    memo_id: web::Path<Uuid>,
) -> Result<HttpResponse, Error> {
    let user_id = Uuid::parse_str(&claims.sub).map_err(|e| {
        log::error!("UUID parse error: {}", e);
        actix_web::error::ErrorBadRequest("Invalid user ID")
    })?;

    let deleted = db::delete_memo(&pool, &memo_id, &user_id)
        .await
        .map_err(|e| {
            log::error!("Database error: {}", e);
            actix_web::error::ErrorInternalServerError("Database error")
        })?;

    if deleted {
        Ok(HttpResponse::Ok().json(serde_json::json!({
            "message": "Memo deleted successfully"
        })))
    } else {
        Ok(HttpResponse::NotFound().json(serde_json::json!({
            "error": "Memo not found"
        })))
    }
}

#[utoipa::path(
    get,
    path = "/api/memos/{memo_id}/messages",
    params(
        ("memo_id" = Uuid, Path, description = "Memo ID")
    ),
    responses(
        (status = 200, description = "List of memo messages", body = Vec<MemoMessageResponse>),
        (status = 404, description = "Memo not found"),
        (status = 401, description = "Unauthorized")
    ),
    security(
        ("bearer" = [])
    ),
    tag = "memos"
)]
pub async fn get_memo_messages(
    pool: web::Data<Pool<Postgres>>,
    claims: web::ReqData<Claims>,
    memo_id: web::Path<Uuid>,
) -> Result<HttpResponse, Error> {
    let user_id = Uuid::parse_str(&claims.sub).map_err(|e| {
        log::error!("UUID parse error: {}", e);
        actix_web::error::ErrorBadRequest("Invalid user ID")
    })?;

    let messages = db::get_memo_messages(&pool, &memo_id, &user_id)
        .await
        .map_err(|e| {
            log::error!("Database error: {}", e);
            actix_web::error::ErrorInternalServerError("Database error")
        })?;

    let mut responses = Vec::new();
    for message in messages {
        let attachments_data = db::get_message_attachments(&pool, &message.id)
            .await
            .unwrap_or_default();

        let attachments: Vec<MemoAttachmentResponse> = attachments_data
            .into_iter()
            .map(|(att, file)| MemoAttachmentResponse {
                id: att.id,
                filename: file.filename,
                mime_type: file.mime_type,
                file_size: file.file_size,
                created_at: att.created_at,
            })
            .collect();

        responses.push(MemoMessageResponse {
            id: message.id,
            content: message.content,
            role: message.role,
            attachments,
            created_at: message.created_at,
        });
    }

    Ok(HttpResponse::Ok().json(responses))
}

#[utoipa::path(
    post,
    path = "/api/memos/{memo_id}/messages",
    params(
        ("memo_id" = Uuid, Path, description = "Memo ID")
    ),
    request_body = CreateMemoMessageRequest,
    responses(
        (status = 200, description = "Message created successfully", body = MemoMessageResponse),
        (status = 404, description = "Memo not found"),
        (status = 401, description = "Unauthorized")
    ),
    security(
        ("bearer" = [])
    ),
    tag = "memos"
)]
pub async fn create_memo_message(
    pool: web::Data<Pool<Postgres>>,
    claims: web::ReqData<Claims>,
    memo_id: web::Path<Uuid>,
    req: web::Json<CreateMemoMessageRequest>,
) -> Result<HttpResponse, Error> {
    let user_id = Uuid::parse_str(&claims.sub).map_err(|e| {
        log::error!("UUID parse error: {}", e);
        actix_web::error::ErrorBadRequest("Invalid user ID")
    })?;

    // Verify memo exists and belongs to user
    let memo = db::get_memo_by_id(&pool, &memo_id, &user_id)
        .await
        .map_err(|e| {
            log::error!("Database error: {}", e);
            actix_web::error::ErrorInternalServerError("Database error")
        })?;

    if memo.is_none() {
        return Ok(HttpResponse::NotFound().json(serde_json::json!({
            "error": "Memo not found"
        })));
    }

    let message = db::create_memo_message(&pool, &memo_id, &user_id, &req.content, "user")
        .await
        .map_err(|e| {
            log::error!("Database error: {}", e);
            actix_web::error::ErrorInternalServerError("Database error")
        })?;

    // TODO: In the future, here we would:
    // 1. Process the message with AI
    // 2. Generate a response
    // 3. Create an assistant message

    Ok(HttpResponse::Ok().json(MemoMessageResponse {
        id: message.id,
        content: message.content,
        role: message.role,
        attachments: vec![],
        created_at: message.created_at,
    }))
}

#[utoipa::path(
    post,
    path = "/api/memos/{memo_id}/messages/{message_id}/attach/{file_id}",
    params(
        ("memo_id" = Uuid, Path, description = "Memo ID"),
        ("message_id" = Uuid, Path, description = "Message ID"),
        ("file_id" = Uuid, Path, description = "File ID")
    ),
    responses(
        (status = 200, description = "File attached successfully"),
        (status = 404, description = "Not found"),
        (status = 401, description = "Unauthorized")
    ),
    security(
        ("bearer" = [])
    ),
    tag = "memos"
)]
pub async fn attach_file_to_message(
    pool: web::Data<Pool<Postgres>>,
    claims: web::ReqData<Claims>,
    path: web::Path<(Uuid, Uuid, Uuid)>,
) -> Result<HttpResponse, Error> {
    let user_id = Uuid::parse_str(&claims.sub).map_err(|e| {
        log::error!("UUID parse error: {}", e);
        actix_web::error::ErrorBadRequest("Invalid user ID")
    })?;

    let (memo_id, message_id, file_id) = path.into_inner();

    // Verify memo belongs to user
    let memo = db::get_memo_by_id(&pool, &memo_id, &user_id)
        .await
        .map_err(|e| {
            log::error!("Database error: {}", e);
            actix_web::error::ErrorInternalServerError("Database error")
        })?;

    if memo.is_none() {
        return Ok(HttpResponse::NotFound().json(serde_json::json!({
            "error": "Memo not found"
        })));
    }

    // Verify file belongs to user
    let file = db::get_file_by_id(&pool, &file_id, &user_id)
        .await
        .map_err(|e| {
            log::error!("Database error: {}", e);
            actix_web::error::ErrorInternalServerError("Database error")
        })?;

    if file.is_none() {
        return Ok(HttpResponse::NotFound().json(serde_json::json!({
            "error": "File not found"
        })));
    }

    db::create_memo_attachment(&pool, &message_id, &file_id)
        .await
        .map_err(|e| {
            log::error!("Database error: {}", e);
            actix_web::error::ErrorInternalServerError("Database error")
        })?;

    Ok(HttpResponse::Ok().json(serde_json::json!({
        "message": "File attached successfully"
    })))
}

use crate::db;
use crate::minio_service::MinioClient;
use crate::models::Claims;
use crate::models::FileResponse;
use crate::qdrant_service::{create_mock_embedding, QdrantService};
use actix_multipart::Multipart;
use actix_web::{web, Error, HttpResponse};
use futures_util::StreamExt;
use sqlx::{Pool, Postgres};
use uuid::Uuid;

#[utoipa::path(
    post,
    path = "/api/files/upload",
    responses(
        (status = 200, description = "File uploaded successfully", body = FileResponse),
        (status = 401, description = "Unauthorized")
    ),
    security(
        ("bearer" = [])
    )
)]
pub async fn upload_file(
    pool: web::Data<Pool<Postgres>>,
    minio: web::Data<MinioClient>,
    qdrant: web::Data<QdrantService>,
    claims: web::ReqData<Claims>,
    mut payload: Multipart,
) -> Result<HttpResponse, Error> {
    let user_id = Uuid::parse_str(&claims.sub).map_err(|e| {
        log::error!("UUID parse error: {}", e);
        actix_web::error::ErrorBadRequest("Invalid user ID")
    })?;

    let mut filename = String::new();
    let mut file_data = Vec::new();

    while let Some(item) = payload.next().await {
        let mut field = item.map_err(|e| {
            log::error!("Multipart error: {}", e);
            actix_web::error::ErrorBadRequest("Invalid multipart data")
        })?;

        let content_disposition = field.content_disposition();
        if let Some(name) = content_disposition.get_filename() {
            filename = name.to_string();
        }

        while let Some(chunk) = field.next().await {
            let data = chunk.map_err(|e| {
                log::error!("Chunk error: {}", e);
                actix_web::error::ErrorBadRequest("Invalid chunk data")
            })?;
            file_data.extend_from_slice(&data);
        }
    }

    if filename.is_empty() || file_data.is_empty() {
        return Ok(HttpResponse::BadRequest().json(serde_json::json!({
            "error": "No file uploaded"
        })));
    }

    if let Err(e) = qdrant.ensure_collection_exists(&user_id).await {
        log::error!("Qdrant error: {}", e);
        return Ok(HttpResponse::InternalServerError().json(serde_json::json!({
            "error": "Vector DB error"
        })));
    }

    let minio_path = match minio.upload_file(&user_id, &filename, &file_data).await {
        Ok(path) => path,
        Err(e) => {
            log::error!("MinIO error: {}", e);
            return Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Storage error"
            })));
        }
    };

    let file_size = file_data.len() as i64;
    let mime_type = Some(guess_mime_type(&filename));

    let file = match db::create_file(
        &pool,
        &user_id,
        &filename,
        &minio_path,
        file_size,
        mime_type,
    )
    .await
    {
        Ok(f) => f,
        Err(e) => {
            log::error!("Database error: {}", e);
            return Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Database error"
            })));
        }
    };

    let text_content = String::from_utf8_lossy(&file_data).to_string();
    let chunks = chunk_text(&text_content, 500);

    let mut embeddings = Vec::new();
    for (idx, chunk) in chunks.iter().enumerate() {
        let embedding = create_mock_embedding(chunk).await;
        embeddings.push((idx, chunk.clone(), embedding));
    }

    if let Err(e) = qdrant.upsert_vectors(&user_id, &file.id, embeddings).await {
        log::error!("Qdrant error: {}", e);
        return Ok(HttpResponse::InternalServerError().json(serde_json::json!({
            "error": "Vector DB error"
        })));
    }

    Ok(HttpResponse::Ok().json(FileResponse {
        id: file.id,
        filename: file.filename,
        file_size: file.file_size,
        mime_type: file.mime_type,
        status: file.status,
        created_at: file.created_at,
    }))
}

#[utoipa::path(
    get,
    path = "/api/files",
    responses(
        (status = 200, description = "List of user files", body = Vec<FileResponse>),
        (status = 401, description = "Unauthorized")
    ),
    security(
        ("bearer" = [])
    )
)]
pub async fn list_files(
    pool: web::Data<Pool<Postgres>>,
    claims: web::ReqData<Claims>,
) -> Result<HttpResponse, Error> {
    let user_id = Uuid::parse_str(&claims.sub).map_err(|e| {
        log::error!("UUID parse error: {}", e);
        actix_web::error::ErrorBadRequest("Invalid user ID")
    })?;

    let files = match db::get_user_files(&pool, &user_id).await {
        Ok(files) => files,
        Err(e) => {
            log::error!("Database error: {}", e);
            return Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Database error"
            })));
        }
    };

    let response: Vec<FileResponse> = files
        .into_iter()
        .map(|f| FileResponse {
            id: f.id,
            filename: f.filename,
            file_size: f.file_size,
            mime_type: f.mime_type,
            status: f.status,
            created_at: f.created_at,
        })
        .collect();

    Ok(HttpResponse::Ok().json(response))
}

#[utoipa::path(
    delete,
    path = "/api/files/{file_id}",
    responses(
        (status = 200, description = "File deleted successfully"),
        (status = 404, description = "File not found"),
        (status = 401, description = "Unauthorized")
    ),
    params(
        ("file_id" = String, Path, description = "File ID")
    ),
    security(
        ("bearer" = [])
    )
)]
pub async fn delete_file(
    pool: web::Data<Pool<Postgres>>,
    minio: web::Data<MinioClient>,
    qdrant: web::Data<QdrantService>,
    claims: web::ReqData<Claims>,
    file_id: web::Path<Uuid>,
) -> Result<HttpResponse, Error> {
    let user_id = Uuid::parse_str(&claims.sub).map_err(|e| {
        log::error!("UUID parse error: {}", e);
        actix_web::error::ErrorBadRequest("Invalid user ID")
    })?;

    let file = match db::get_file_by_id(&pool, &file_id, &user_id).await {
        Ok(file) => file,
        Err(e) => {
            log::error!("Database error: {}", e);
            return Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Database error"
            })));
        }
    };

    let file = match file {
        Some(f) => f,
        None => {
            return Ok(HttpResponse::NotFound().json(serde_json::json!({
                "error": "File not found"
            })));
        }
    };

    minio.delete_file(&file.minio_path).await.ok();

    qdrant.delete_file_vectors(&user_id, &file_id).await.ok();

    if let Err(e) = db::delete_file(&pool, &file_id, &user_id).await {
        log::error!("Database error: {}", e);
        return Ok(HttpResponse::InternalServerError().json(serde_json::json!({
            "error": "Database error"
        })));
    }

    Ok(HttpResponse::Ok().json(serde_json::json!({
        "message": "File deleted successfully"
    })))
}

#[utoipa::path(
    get,
    path = "/api/files/{file_id}/download",
    responses(
        (status = 200, description = "File content"),
        (status = 404, description = "File not found"),
        (status = 401, description = "Unauthorized")
    ),
    params(
        ("file_id" = String, Path, description = "File ID")
    ),
    security(
        ("bearer" = [])
    )
)]
pub async fn download_file(
    pool: web::Data<Pool<Postgres>>,
    minio: web::Data<MinioClient>,
    claims: web::ReqData<Claims>,
    file_id: web::Path<Uuid>,
) -> Result<HttpResponse, Error> {
    let user_id = Uuid::parse_str(&claims.sub).map_err(|e| {
        log::error!("UUID parse error: {}", e);
        actix_web::error::ErrorBadRequest("Invalid user ID")
    })?;

    let file = match db::get_file_by_id(&pool, &file_id, &user_id).await {
        Ok(Some(f)) => f,
        Ok(None) => {
            return Ok(HttpResponse::NotFound().json(serde_json::json!({
                "error": "File not found"
            })));
        }
        Err(e) => {
            log::error!("Database error: {}", e);
            return Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Database error"
            })));
        }
    };

    let file_data = match minio.download_file(&file.minio_path).await {
        Ok(data) => data,
        Err(e) => {
            log::error!("MinIO error: {}", e);
            return Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Storage error"
            })));
        }
    };

    let content_type = file
        .mime_type
        .unwrap_or_else(|| "application/octet-stream".to_string());

    Ok(HttpResponse::Ok()
        .content_type(content_type)
        .insert_header((
            "Content-Disposition",
            format!("inline; filename=\"{}\"", file.filename),
        ))
        .body(file_data))
}

fn guess_mime_type(filename: &str) -> &'static str {
    let extension = filename.split('.').last().unwrap_or("");
    match extension.to_lowercase().as_str() {
        "pdf" => "application/pdf",
        "txt" => "text/plain",
        "md" => "text/markdown",
        "json" => "application/json",
        "xml" => "application/xml",
        "html" | "htm" => "text/html",
        "css" => "text/css",
        "js" => "application/javascript",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "svg" => "image/svg+xml",
        "webp" => "image/webp",
        "mp4" => "video/mp4",
        "mp3" => "audio/mpeg",
        "wav" => "audio/wav",
        "zip" => "application/zip",
        "tar" => "application/x-tar",
        "gz" => "application/gzip",
        "csv" => "text/csv",
        "doc" => "application/msword",
        "docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "xls" => "application/vnd.ms-excel",
        "xlsx" => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "ppt" => "application/vnd.ms-powerpoint",
        "pptx" => "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        _ => "application/octet-stream",
    }
}

fn chunk_text(text: &str, chunk_size: usize) -> Vec<String> {
    let words: Vec<&str> = text.split_whitespace().collect();
    let mut chunks = Vec::new();
    let mut current_chunk = String::new();

    for word in words {
        if current_chunk.len() + word.len() + 1 > chunk_size && !current_chunk.is_empty() {
            chunks.push(current_chunk.clone());
            current_chunk.clear();
        }
        if !current_chunk.is_empty() {
            current_chunk.push(' ');
        }
        current_chunk.push_str(word);
    }

    if !current_chunk.is_empty() {
        chunks.push(current_chunk);
    }

    chunks
}

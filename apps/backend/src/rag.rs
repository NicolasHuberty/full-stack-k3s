use crate::db;
use crate::models::Claims;
use crate::models::{
    RagQueryRequest, RagQueryResponse, SearchRequest, SearchResponse, SearchResult,
};
use crate::qdrant_service::{create_mock_embedding, QdrantService};
use actix_web::{web, Error, HttpResponse};
use sqlx::{Pool, Postgres};
use uuid::Uuid;

#[utoipa::path(
    post,
    path = "/api/search",
    request_body = SearchRequest,
    responses(
        (status = 200, description = "Search results", body = SearchResponse),
        (status = 401, description = "Unauthorized")
    ),
    security(
        ("bearer" = [])
    )
)]
pub async fn search(
    pool: web::Data<Pool<Postgres>>,
    qdrant: web::Data<QdrantService>,
    claims: web::ReqData<Claims>,
    req: web::Json<SearchRequest>,
) -> Result<HttpResponse, Error> {
    let user_id = Uuid::parse_str(&claims.sub).map_err(|e| {
        log::error!("UUID parse error: {}", e);
        actix_web::error::ErrorBadRequest("Invalid user ID")
    })?;

    let query_embedding = create_mock_embedding(&req.query).await;
    let limit = req.limit.unwrap_or(10);

    let search_results = qdrant
        .search(&user_id, query_embedding, limit)
        .await
        .map_err(|e| {
            log::error!("Qdrant search error: {}", e);
            actix_web::error::ErrorInternalServerError("Search error")
        })?;

    let mut results = Vec::new();
    for (file_id, chunk_text, score) in search_results {
        if let Some(file) = db::get_file_by_id(&pool, &file_id, &user_id)
            .await
            .ok()
            .flatten()
        {
            results.push(SearchResult {
                file_id,
                filename: file.filename,
                chunk_text,
                score,
            });
        }
    }

    Ok(HttpResponse::Ok().json(SearchResponse { results }))
}

#[utoipa::path(
    post,
    path = "/api/rag/query",
    request_body = RagQueryRequest,
    responses(
        (status = 200, description = "RAG query response", body = RagQueryResponse),
        (status = 401, description = "Unauthorized")
    ),
    security(
        ("bearer" = [])
    )
)]
pub async fn rag_query(
    pool: web::Data<Pool<Postgres>>,
    qdrant: web::Data<QdrantService>,
    claims: web::ReqData<Claims>,
    req: web::Json<RagQueryRequest>,
) -> Result<HttpResponse, Error> {
    let user_id = Uuid::parse_str(&claims.sub).map_err(|e| {
        log::error!("UUID parse error: {}", e);
        actix_web::error::ErrorBadRequest("Invalid user ID")
    })?;

    let query_embedding = create_mock_embedding(&req.query).await;
    let context_limit = req.context_limit.unwrap_or(5);

    let search_results = qdrant
        .search(&user_id, query_embedding, context_limit)
        .await
        .map_err(|e| {
            log::error!("Qdrant search error: {}", e);
            actix_web::error::ErrorInternalServerError("Search error")
        })?;

    let mut context_parts = Vec::new();
    let mut sources = Vec::new();

    for (file_id, chunk_text, _score) in search_results {
        context_parts.push(chunk_text);
        if let Some(file) = db::get_file_by_id(&pool, &file_id, &user_id)
            .await
            .ok()
            .flatten()
        {
            if !sources.contains(&file.filename) {
                sources.push(file.filename);
            }
        }
    }

    let context = context_parts.join("\n\n");
    let answer = generate_answer(&req.query, &context);

    db::save_chat_message(&pool, &user_id, "user", &req.query)
        .await
        .ok();
    db::save_chat_message(&pool, &user_id, "assistant", &answer)
        .await
        .ok();

    Ok(HttpResponse::Ok().json(RagQueryResponse { answer, sources }))
}

#[utoipa::path(
    get,
    path = "/api/rag/history",
    responses(
        (status = 200, description = "Chat history"),
        (status = 401, description = "Unauthorized")
    ),
    security(
        ("bearer" = [])
    )
)]
pub async fn get_history(
    pool: web::Data<Pool<Postgres>>,
    claims: web::ReqData<Claims>,
) -> Result<HttpResponse, Error> {
    let user_id = Uuid::parse_str(&claims.sub).map_err(|e| {
        log::error!("UUID parse error: {}", e);
        actix_web::error::ErrorBadRequest("Invalid user ID")
    })?;

    let messages = db::get_chat_history(&pool, &user_id, 50)
        .await
        .map_err(|e| {
            log::error!("Database error: {}", e);
            actix_web::error::ErrorInternalServerError("Database error")
        })?;

    let chat_messages: Vec<serde_json::Value> = messages
        .into_iter()
        .rev()
        .map(|(role, content)| {
            serde_json::json!({
                "role": role,
                "content": content
            })
        })
        .collect();

    Ok(HttpResponse::Ok().json(chat_messages))
}

fn generate_answer(query: &str, context: &str) -> String {
    if context.is_empty() {
        return format!(
            "I don't have enough information in your uploaded documents to answer: \"{}\".\n\n\
             Please upload relevant documents first.",
            query
        );
    }

    format!(
        "Based on your documents, here's what I found regarding \"{}\":\n\n\
         {}\n\n\
         Note: This is a simple RAG implementation. For production, integrate with OpenAI or another LLM API.",
        query,
        &context[..context.len().min(500)]
    )
}

mod auth;
mod db;
mod files;
mod memos;
mod minio_service;
mod models;
mod qdrant_service;
mod rag;
mod redis_service;

use actix_cors::Cors;
use actix_web::{middleware, web, App, HttpResponse, HttpServer, Responder};
use actix_web_httpauth::middleware::HttpAuthentication;
use minio_service::MinioClient;
use qdrant_service::QdrantService;
use sqlx::postgres::PgPoolOptions;
use std::env;
use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;

#[derive(OpenApi)]
#[openapi(
    paths(
        health,
        // Auth endpoints
        auth::register,
        auth::login,
        auth::refresh,
        auth::logout,
        auth::me,
        // File endpoints
        files::upload_file,
        files::list_files,
        files::delete_file,
        files::download_file,
        // RAG endpoints
        rag::search,
        rag::rag_query,
        rag::get_history,
        // Memos endpoints
        memos::create_memo,
        memos::list_memos,
        memos::get_memo,
        memos::delete_memo,
        memos::get_memo_messages,
        memos::create_memo_message,
        memos::attach_file_to_message,
    ),
    components(
        schemas(
            // Auth models
            models::RegisterRequest,
            models::LoginRequest,
            models::RefreshRequest,
            models::AuthResponse,
            models::UserResponse,
            // File models
            models::FileResponse,
            // RAG models
            models::SearchRequest,
            models::SearchResponse,
            models::SearchResult,
            models::RagQueryRequest,
            models::RagQueryResponse,
            models::ChatMessage,
            // Memos models
            models::CreateMemoRequest,
            models::MemoResponse,
            models::CreateMemoMessageRequest,
            models::MemoMessageResponse,
            models::MemoAttachmentResponse,
            // Error models
            models::ErrorResponse,
        )
    ),
    tags(
        (name = "auth", description = "Authentication and authorization endpoints with JWT refresh token support"),
        (name = "files", description = "File upload and management endpoints"),
        (name = "rag", description = "RAG query and vector search endpoints"),
        (name = "memos", description = "Memos (conversation-based notes) with AI assistance")
    ),
    info(
        title = "K3s Memos API",
        version = "0.2.0",
        description = "Multi-tenant Memos application with authentication, file attachments, and AI-powered conversations"
    ),
    servers(
        (url = "/", description = "Current server")
    )
)]
struct ApiDoc;

#[utoipa::path(
    get,
    path = "/api/health",
    responses(
        (status = 200, description = "API is healthy")
    ),
    tag = "health"
)]
async fn health() -> impl Responder {
    HttpResponse::Ok().json(serde_json::json!({
        "status": "healthy",
        "service": "k3s-memos-backend",
        "version": "0.2.0",
        "environment": env::var("ENVIRONMENT").unwrap_or_else(|_| "unknown".to_string())
    }))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    env_logger::init();

    let database_url = env::var("DATABASE_URL").expect("DATABASE_URL must be set");

    log::info!("Connecting to database...");
    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await
        .expect("Failed to connect to database");

    log::info!("Database connected successfully");

    log::info!("Connecting to Redis...");
    let redis_client = redis_service::create_redis_client().expect("Failed to create Redis client");
    log::info!("Redis client created successfully");

    log::info!("Initializing MinIO client...");
    let minio = MinioClient::new().expect("Failed to initialize MinIO client");
    minio
        .ensure_bucket_exists()
        .await
        .expect("Failed to ensure bucket exists");
    log::info!("MinIO client initialized");

    log::info!("Initializing Qdrant client...");
    let qdrant = QdrantService::new()
        .await
        .expect("Failed to initialize Qdrant client");
    log::info!("Qdrant client initialized");

    let host = env::var("HOST").unwrap_or_else(|_| "0.0.0.0".to_string());
    let port = env::var("PORT").unwrap_or_else(|_| "8080".to_string());
    let bind_address = format!("{}:{}", host, port);

    log::info!("Starting server at {}", bind_address);
    log::info!(
        "Environment: {}",
        env::var("ENVIRONMENT").unwrap_or_else(|_| "unknown".to_string())
    );

    HttpServer::new(move || {
        let cors = Cors::permissive();

        let bearer_middleware = HttpAuthentication::bearer(auth::validator);

        App::new()
            .app_data(web::Data::new(pool.clone()))
            .app_data(web::Data::new(redis_client.clone()))
            .app_data(web::Data::new(minio.clone()))
            .app_data(web::Data::new(qdrant.clone()))
            .wrap(middleware::Logger::default())
            .wrap(cors)
            .service(
                web::scope("/api")
                    .service(web::resource("/health").route(web::get().to(health)))
                    // Auth routes
                    .service(
                        web::scope("/auth")
                            .route("/register", web::post().to(auth::register))
                            .route("/login", web::post().to(auth::login))
                            .route("/refresh", web::post().to(auth::refresh))
                            .service(
                                web::scope("")
                                    .wrap(bearer_middleware.clone())
                                    .route("/logout", web::post().to(auth::logout))
                                    .route("/me", web::get().to(auth::me)),
                            ),
                    )
                    // File routes
                    .service(
                        web::scope("/files")
                            .wrap(bearer_middleware.clone())
                            .route("/upload", web::post().to(files::upload_file))
                            .route("", web::get().to(files::list_files))
                            .route("/{file_id}", web::delete().to(files::delete_file))
                            .route("/{file_id}/download", web::get().to(files::download_file)),
                    )
                    // Memos routes
                    .service(
                        web::scope("/memos")
                            .wrap(bearer_middleware.clone())
                            .route("", web::post().to(memos::create_memo))
                            .route("", web::get().to(memos::list_memos))
                            .route("/{memo_id}", web::get().to(memos::get_memo))
                            .route("/{memo_id}", web::delete().to(memos::delete_memo))
                            .route(
                                "/{memo_id}/messages",
                                web::get().to(memos::get_memo_messages),
                            )
                            .route(
                                "/{memo_id}/messages",
                                web::post().to(memos::create_memo_message),
                            )
                            .route(
                                "/{memo_id}/messages/{message_id}/attach/{file_id}",
                                web::post().to(memos::attach_file_to_message),
                            ),
                    )
                    // RAG routes (legacy, kept for compatibility)
                    .service(
                        web::scope("/rag")
                            .wrap(bearer_middleware.clone())
                            .route("/query", web::post().to(rag::rag_query))
                            .route("/history", web::get().to(rag::get_history)),
                    )
                    .service(
                        web::resource("/search")
                            .wrap(bearer_middleware.clone())
                            .route(web::post().to(rag::search)),
                    ),
            )
            .service(
                SwaggerUi::new("/docs/{_:.*}").url("/api-docs/openapi.json", ApiDoc::openapi()),
            )
    })
    .bind(&bind_address)?
    .run()
    .await
}

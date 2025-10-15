mod auth;
mod db;
mod files;
mod minio_service;
mod models;
mod qdrant_service;
mod rag;

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
        auth::register,
        auth::login,
        auth::me,
        files::upload_file,
        files::list_files,
        files::delete_file,
        files::download_file,
        rag::search,
        rag::rag_query,
        rag::get_history,
    ),
    components(
        schemas(
            models::RegisterRequest,
            models::LoginRequest,
            models::AuthResponse,
            models::UserResponse,
            models::FileResponse,
            models::SearchRequest,
            models::SearchResponse,
            models::SearchResult,
            models::RagQueryRequest,
            models::RagQueryResponse,
            models::ChatMessage,
            models::ErrorResponse,
        )
    ),
    tags(
        (name = "auth", description = "Authentication endpoints"),
        (name = "files", description = "File management endpoints"),
        (name = "rag", description = "RAG query endpoints")
    ),
    info(
        title = "K3s RAG API",
        version = "0.1.1",
        description = "Multi-tenant RAG application with authentication, file upload, and vector search"
    )
)]
struct ApiDoc;

#[utoipa::path(
    get,
    path = "/api/health",
    responses(
        (status = 200, description = "API is healthy")
    )
)]
async fn health() -> impl Responder {
    HttpResponse::Ok().json(serde_json::json!({
        "status": "healthy",
        "service": "k3s-backend",
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
            .app_data(web::Data::new(minio.clone()))
            .app_data(web::Data::new(qdrant.clone()))
            .wrap(middleware::Logger::default())
            .wrap(cors)
            .service(
                web::scope("/api")
                    .service(web::resource("/health").route(web::get().to(health)))
                    .service(
                        web::scope("/auth")
                            .route("/register", web::post().to(auth::register))
                            .route("/login", web::post().to(auth::login))
                            .service(
                                web::resource("/me")
                                    .wrap(bearer_middleware.clone())
                                    .route(web::get().to(auth::me)),
                            ),
                    )
                    .service(
                        web::scope("/files")
                            .wrap(bearer_middleware.clone())
                            .route("/upload", web::post().to(files::upload_file))
                            .route("", web::get().to(files::list_files))
                            .route("/{file_id}", web::delete().to(files::delete_file))
                            .route("/{file_id}/download", web::get().to(files::download_file)),
                    )
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

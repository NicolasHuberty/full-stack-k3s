use actix_cors::Cors;
use actix_web::{web, App, HttpResponse, HttpServer, Responder};
use serde::{Deserialize, Serialize};
use std::env;
use utoipa::{OpenApi, ToSchema};
use utoipa_swagger_ui::SwaggerUi;

#[derive(Serialize, Deserialize, ToSchema)]
struct HealthResponse {
    status: String,
    version: String,
    environment: String,
    timestamp: String,
}

#[derive(Serialize, Deserialize, ToSchema)]
struct ApiResponse<T> {
    success: bool,
    data: Option<T>,
    message: String,
}

#[derive(Serialize, Deserialize, ToSchema)]
struct User {
    id: u32,
    name: String,
    email: String,
}

#[derive(OpenApi)]
#[openapi(
    paths(
        health,
        get_users,
        get_user,
    ),
    components(
        schemas(HealthResponse, ApiResponse<Vec<User>>, ApiResponse<User>, User)
    ),
    tags(
        (name = "health", description = "Health check endpoints"),
        (name = "users", description = "User management endpoints")
    ),
    info(
        title = "K3s Backend API",
        version = "0.1.0",
        description = "Backend API for K3s GitOps Demo",
        contact(
            name = "Nicolas Huberty",
            email = "nicolas@datanest.be"
        )
    )
)]
struct ApiDoc;

/// Health check endpoint
#[utoipa::path(
    get,
    path = "/api/health",
    tag = "health",
    responses(
        (status = 200, description = "Service is healthy", body = HealthResponse)
    )
)]
async fn health() -> impl Responder {
    let environment = env::var("ENVIRONMENT").unwrap_or_else(|_| "unknown".to_string());
    let version = env::var("VERSION").unwrap_or_else(|_| "0.1.0".to_string());

    HttpResponse::Ok().json(HealthResponse {
        status: "healthy".to_string(),
        version,
        environment,
        timestamp: chrono::Utc::now().to_rfc3339(),
    })
}

/// Get all users
#[utoipa::path(
    get,
    path = "/api/users",
    tag = "users",
    responses(
        (status = 200, description = "List of users", body = ApiResponse<Vec<User>>)
    )
)]
async fn get_users() -> impl Responder {
    let users = vec![
        User {
            id: 1,
            name: "Alice".to_string(),
            email: "alice@example.com".to_string(),
        },
        User {
            id: 2,
            name: "Bob".to_string(),
            email: "bob@example.com".to_string(),
        },
    ];

    HttpResponse::Ok().json(ApiResponse {
        success: true,
        data: Some(users),
        message: "Users retrieved successfully".to_string(),
    })
}

/// Get user by ID
#[utoipa::path(
    get,
    path = "/api/users/{id}",
    tag = "users",
    params(
        ("id" = u32, Path, description = "User ID")
    ),
    responses(
        (status = 200, description = "User found", body = ApiResponse<User>),
        (status = 404, description = "User not found")
    )
)]
async fn get_user(id: web::Path<u32>) -> impl Responder {
    let user = User {
        id: *id,
        name: "Sample User".to_string(),
        email: format!("user{}@example.com", id),
    };

    HttpResponse::Ok().json(ApiResponse {
        success: true,
        data: Some(user),
        message: "User retrieved successfully".to_string(),
    })
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    env_logger::init();
    dotenv::dotenv().ok();

    let host = env::var("HOST").unwrap_or_else(|_| "0.0.0.0".to_string());
    let port = env::var("PORT").unwrap_or_else(|_| "8080".to_string());
    let bind_address = format!("{}:{}", host, port);

    log::info!("Starting server on {}", bind_address);
    log::info!("API documentation available at /docs");
    log::info!(
        "Environment: {}",
        env::var("ENVIRONMENT").unwrap_or_else(|_| "unknown".to_string())
    );

    HttpServer::new(|| {
        let cors = Cors::default()
            .allow_any_origin()
            .allow_any_method()
            .allow_any_header()
            .max_age(3600);

        App::new()
            .wrap(cors)
            .service(
                SwaggerUi::new("/docs/{_:.*}").url("/api-docs/openapi.json", ApiDoc::openapi()),
            )
            .route("/api/health", web::get().to(health))
            .route("/api/users", web::get().to(get_users))
            .route("/api/users/{id}", web::get().to(get_user))
    })
    .bind(&bind_address)?
    .run()
    .await
}

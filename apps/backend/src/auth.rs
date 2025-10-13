use crate::db;
use crate::models::{AuthResponse, Claims, LoginRequest, RegisterRequest, UserResponse};
use actix_web::{dev::ServiceRequest, web, Error, HttpMessage, HttpResponse};
use actix_web_httpauth::extractors::bearer::BearerAuth;
use bcrypt::{hash, verify, DEFAULT_COST};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use sqlx::{Pool, Postgres};
use std::env;
use uuid::Uuid;

const JWT_SECRET: &str = "your-secret-key-change-in-production";

pub fn get_jwt_secret() -> String {
    env::var("JWT_SECRET").unwrap_or_else(|_| JWT_SECRET.to_string())
}

pub fn create_jwt(user_id: &Uuid, email: &str) -> Result<String, jsonwebtoken::errors::Error> {
    let expiration = chrono::Utc::now()
        .checked_add_signed(chrono::Duration::hours(24))
        .expect("valid timestamp")
        .timestamp() as usize;

    let claims = Claims {
        sub: user_id.to_string(),
        email: email.to_string(),
        exp: expiration,
    };

    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(get_jwt_secret().as_bytes()),
    )
}

pub fn verify_jwt(token: &str) -> Result<Claims, jsonwebtoken::errors::Error> {
    decode::<Claims>(
        token,
        &DecodingKey::from_secret(get_jwt_secret().as_bytes()),
        &Validation::default(),
    )
    .map(|data| data.claims)
}

#[utoipa::path(
    post,
    path = "/api/auth/register",
    request_body = RegisterRequest,
    responses(
        (status = 200, description = "User registered successfully", body = AuthResponse),
        (status = 400, description = "Invalid request"),
        (status = 409, description = "User already exists")
    )
)]
pub async fn register(
    pool: web::Data<Pool<Postgres>>,
    req: web::Json<RegisterRequest>,
) -> Result<HttpResponse, Error> {
    let existing_user = db::get_user_by_email(&pool, &req.email)
        .await
        .map_err(|e| {
            log::error!("Database error: {}", e);
            actix_web::error::ErrorInternalServerError("Database error")
        })?;

    if existing_user.is_some() {
        return Ok(HttpResponse::Conflict().json(serde_json::json!({
            "error": "User already exists"
        })));
    }

    let password_hash = hash(&req.password, DEFAULT_COST).map_err(|e| {
        log::error!("Hash error: {}", e);
        actix_web::error::ErrorInternalServerError("Hash error")
    })?;

    let user = db::create_user(&pool, &req.email, &password_hash)
        .await
        .map_err(|e| {
            log::error!("Database error: {}", e);
            actix_web::error::ErrorInternalServerError("Database error")
        })?;

    let token = create_jwt(&user.id, &user.email).map_err(|e| {
        log::error!("JWT error: {}", e);
        actix_web::error::ErrorInternalServerError("JWT error")
    })?;

    Ok(HttpResponse::Ok().json(AuthResponse {
        token,
        user: UserResponse {
            id: user.id,
            email: user.email,
        },
    }))
}

#[utoipa::path(
    post,
    path = "/api/auth/login",
    request_body = LoginRequest,
    responses(
        (status = 200, description = "Login successful", body = AuthResponse),
        (status = 401, description = "Invalid credentials")
    )
)]
pub async fn login(
    pool: web::Data<Pool<Postgres>>,
    req: web::Json<LoginRequest>,
) -> Result<HttpResponse, Error> {
    let user = db::get_user_by_email(&pool, &req.email)
        .await
        .map_err(|e| {
            log::error!("Database error: {}", e);
            actix_web::error::ErrorInternalServerError("Database error")
        })?;

    let user = match user {
        Some(u) => u,
        None => {
            return Ok(HttpResponse::Unauthorized().json(serde_json::json!({
                "error": "Invalid credentials"
            })));
        }
    };

    let valid = verify(&req.password, &user.password_hash).map_err(|e| {
        log::error!("Verify error: {}", e);
        actix_web::error::ErrorInternalServerError("Verify error")
    })?;

    if !valid {
        return Ok(HttpResponse::Unauthorized().json(serde_json::json!({
            "error": "Invalid credentials"
        })));
    }

    let token = create_jwt(&user.id, &user.email).map_err(|e| {
        log::error!("JWT error: {}", e);
        actix_web::error::ErrorInternalServerError("JWT error")
    })?;

    Ok(HttpResponse::Ok().json(AuthResponse {
        token,
        user: UserResponse {
            id: user.id,
            email: user.email,
        },
    }))
}

#[utoipa::path(
    get,
    path = "/api/auth/me",
    responses(
        (status = 200, description = "Current user", body = UserResponse),
        (status = 401, description = "Unauthorized")
    ),
    security(
        ("bearer" = [])
    )
)]
pub async fn me(
    pool: web::Data<Pool<Postgres>>,
    claims: web::ReqData<Claims>,
) -> Result<HttpResponse, Error> {
    let user_id = Uuid::parse_str(&claims.sub).map_err(|e| {
        log::error!("UUID parse error: {}", e);
        actix_web::error::ErrorBadRequest("Invalid user ID")
    })?;

    let user = db::get_user_by_id(&pool, &user_id)
        .await
        .map_err(|e| {
            log::error!("Database error: {}", e);
            actix_web::error::ErrorInternalServerError("Database error")
        })?;

    match user {
        Some(u) => Ok(HttpResponse::Ok().json(UserResponse {
            id: u.id,
            email: u.email,
        })),
        None => Ok(HttpResponse::Unauthorized().json(serde_json::json!({
            "error": "User not found"
        }))),
    }
}

pub async fn validator(
    req: ServiceRequest,
    credentials: BearerAuth,
) -> Result<ServiceRequest, (Error, ServiceRequest)> {
    match verify_jwt(credentials.token()) {
        Ok(claims) => {
            req.extensions_mut().insert(claims);
            Ok(req)
        }
        Err(e) => {
            log::error!("JWT validation error: {}", e);
            Err((actix_web::error::ErrorUnauthorized("Invalid token"), req))
        }
    }
}

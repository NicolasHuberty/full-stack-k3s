use crate::db;
use crate::models::{
    AuthResponse, Claims, LoginRequest, RefreshRequest, RegisterRequest, UserResponse,
};
use actix_web::{dev::ServiceRequest, web, Error, HttpMessage, HttpResponse};
use actix_web_httpauth::extractors::bearer::BearerAuth;
use bcrypt::{hash, verify, DEFAULT_COST};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use redis::AsyncCommands;
use sqlx::{Pool, Postgres};
use std::env;
use uuid::Uuid;

const JWT_SECRET: &str = "your-secret-key-change-in-production";
const ACCESS_TOKEN_EXPIRY_HOURS: i64 = 1; // 1 hour for access token
const REFRESH_TOKEN_EXPIRY_DAYS: i64 = 30; // 30 days for refresh token

pub fn get_jwt_secret() -> String {
    env::var("JWT_SECRET").unwrap_or_else(|_| JWT_SECRET.to_string())
}

pub fn create_access_token(
    user_id: &Uuid,
    email: &str,
) -> Result<String, jsonwebtoken::errors::Error> {
    let expiration = chrono::Utc::now()
        .checked_add_signed(chrono::Duration::hours(ACCESS_TOKEN_EXPIRY_HOURS))
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

pub fn create_refresh_token(
    user_id: &Uuid,
    email: &str,
) -> Result<String, jsonwebtoken::errors::Error> {
    let expiration = chrono::Utc::now()
        .checked_add_signed(chrono::Duration::days(REFRESH_TOKEN_EXPIRY_DAYS))
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

async fn store_refresh_token(
    redis_client: &redis::Client,
    user_id: &Uuid,
    refresh_token: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    let mut con = redis_client.get_async_connection().await?;
    let key = format!("refresh_token:{}", user_id);
    let ttl = REFRESH_TOKEN_EXPIRY_DAYS * 24 * 3600; // Convert to seconds

    con.set_ex::<_, _, ()>(&key, refresh_token, ttl as u64)
        .await?;
    Ok(())
}

async fn verify_refresh_token(
    redis_client: &redis::Client,
    user_id: &Uuid,
    refresh_token: &str,
) -> Result<bool, Box<dyn std::error::Error>> {
    let mut con = redis_client.get_async_connection().await?;
    let key = format!("refresh_token:{}", user_id);

    let stored_token: Option<String> = con.get(&key).await?;
    Ok(stored_token.as_deref() == Some(refresh_token))
}

async fn delete_refresh_token(
    redis_client: &redis::Client,
    user_id: &Uuid,
) -> Result<(), Box<dyn std::error::Error>> {
    let mut con = redis_client.get_async_connection().await?;
    let key = format!("refresh_token:{}", user_id);

    con.del::<_, ()>(&key).await?;
    Ok(())
}

#[utoipa::path(
    post,
    path = "/api/auth/register",
    request_body = RegisterRequest,
    responses(
        (status = 200, description = "User registered successfully", body = AuthResponse),
        (status = 400, description = "Invalid request"),
        (status = 409, description = "User already exists")
    ),
    tag = "auth"
)]
pub async fn register(
    pool: web::Data<Pool<Postgres>>,
    redis_client: web::Data<redis::Client>,
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

    let access_token = create_access_token(&user.id, &user.email).map_err(|e| {
        log::error!("JWT error: {}", e);
        actix_web::error::ErrorInternalServerError("JWT error")
    })?;

    let refresh_token = create_refresh_token(&user.id, &user.email).map_err(|e| {
        log::error!("JWT error: {}", e);
        actix_web::error::ErrorInternalServerError("JWT error")
    })?;

    store_refresh_token(&redis_client, &user.id, &refresh_token)
        .await
        .map_err(|e| {
            log::error!("Redis error: {}", e);
            actix_web::error::ErrorInternalServerError("Redis error")
        })?;

    Ok(HttpResponse::Ok().json(AuthResponse {
        access_token,
        refresh_token,
        token_type: "Bearer".to_string(),
        expires_in: ACCESS_TOKEN_EXPIRY_HOURS * 3600,
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
    ),
    tag = "auth"
)]
pub async fn login(
    pool: web::Data<Pool<Postgres>>,
    redis_client: web::Data<redis::Client>,
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

    let access_token = create_access_token(&user.id, &user.email).map_err(|e| {
        log::error!("JWT error: {}", e);
        actix_web::error::ErrorInternalServerError("JWT error")
    })?;

    let refresh_token = create_refresh_token(&user.id, &user.email).map_err(|e| {
        log::error!("JWT error: {}", e);
        actix_web::error::ErrorInternalServerError("JWT error")
    })?;

    store_refresh_token(&redis_client, &user.id, &refresh_token)
        .await
        .map_err(|e| {
            log::error!("Redis error: {}", e);
            actix_web::error::ErrorInternalServerError("Redis error")
        })?;

    Ok(HttpResponse::Ok().json(AuthResponse {
        access_token,
        refresh_token,
        token_type: "Bearer".to_string(),
        expires_in: ACCESS_TOKEN_EXPIRY_HOURS * 3600,
        user: UserResponse {
            id: user.id,
            email: user.email,
        },
    }))
}

#[utoipa::path(
    post,
    path = "/api/auth/refresh",
    request_body = RefreshRequest,
    responses(
        (status = 200, description = "Token refreshed successfully", body = AuthResponse),
        (status = 401, description = "Invalid refresh token")
    ),
    tag = "auth"
)]
pub async fn refresh(
    pool: web::Data<Pool<Postgres>>,
    redis_client: web::Data<redis::Client>,
    req: web::Json<RefreshRequest>,
) -> Result<HttpResponse, Error> {
    let claims = verify_jwt(&req.refresh_token).map_err(|e| {
        log::error!("JWT validation error: {}", e);
        actix_web::error::ErrorUnauthorized("Invalid refresh token")
    })?;

    let user_id = Uuid::parse_str(&claims.sub).map_err(|e| {
        log::error!("UUID parse error: {}", e);
        actix_web::error::ErrorBadRequest("Invalid user ID")
    })?;

    // Verify the refresh token is stored in Redis
    let is_valid = verify_refresh_token(&redis_client, &user_id, &req.refresh_token)
        .await
        .map_err(|e| {
            log::error!("Redis error: {}", e);
            actix_web::error::ErrorInternalServerError("Redis error")
        })?;

    if !is_valid {
        return Err(actix_web::error::ErrorUnauthorized("Invalid refresh token"));
    }

    let user = db::get_user_by_id(&pool, &user_id).await.map_err(|e| {
        log::error!("Database error: {}", e);
        actix_web::error::ErrorInternalServerError("Database error")
    })?;

    let user = match user {
        Some(u) => u,
        None => {
            return Err(actix_web::error::ErrorUnauthorized("User not found"));
        }
    };

    let access_token = create_access_token(&user.id, &user.email).map_err(|e| {
        log::error!("JWT error: {}", e);
        actix_web::error::ErrorInternalServerError("JWT error")
    })?;

    let new_refresh_token = create_refresh_token(&user.id, &user.email).map_err(|e| {
        log::error!("JWT error: {}", e);
        actix_web::error::ErrorInternalServerError("JWT error")
    })?;

    store_refresh_token(&redis_client, &user.id, &new_refresh_token)
        .await
        .map_err(|e| {
            log::error!("Redis error: {}", e);
            actix_web::error::ErrorInternalServerError("Redis error")
        })?;

    Ok(HttpResponse::Ok().json(AuthResponse {
        access_token,
        refresh_token: new_refresh_token,
        token_type: "Bearer".to_string(),
        expires_in: ACCESS_TOKEN_EXPIRY_HOURS * 3600,
        user: UserResponse {
            id: user.id,
            email: user.email,
        },
    }))
}

#[utoipa::path(
    post,
    path = "/api/auth/logout",
    responses(
        (status = 200, description = "Logged out successfully"),
        (status = 401, description = "Unauthorized")
    ),
    security(
        ("bearer" = [])
    ),
    tag = "auth"
)]
pub async fn logout(
    redis_client: web::Data<redis::Client>,
    claims: web::ReqData<Claims>,
) -> Result<HttpResponse, Error> {
    let user_id = Uuid::parse_str(&claims.sub).map_err(|e| {
        log::error!("UUID parse error: {}", e);
        actix_web::error::ErrorBadRequest("Invalid user ID")
    })?;

    delete_refresh_token(&redis_client, &user_id)
        .await
        .map_err(|e| {
            log::error!("Redis error: {}", e);
            actix_web::error::ErrorInternalServerError("Redis error")
        })?;

    Ok(HttpResponse::Ok().json(serde_json::json!({
        "message": "Logged out successfully"
    })))
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
    ),
    tag = "auth"
)]
pub async fn me(
    pool: web::Data<Pool<Postgres>>,
    claims: web::ReqData<Claims>,
) -> Result<HttpResponse, Error> {
    let user_id = Uuid::parse_str(&claims.sub).map_err(|e| {
        log::error!("UUID parse error: {}", e);
        actix_web::error::ErrorBadRequest("Invalid user ID")
    })?;

    let user = db::get_user_by_id(&pool, &user_id).await.map_err(|e| {
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

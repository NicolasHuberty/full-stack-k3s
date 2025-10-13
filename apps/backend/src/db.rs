use crate::models::{File, User};
use sqlx::{Pool, Postgres, Row};
use uuid::Uuid;

pub async fn create_user(
    pool: &Pool<Postgres>,
    email: &str,
    password_hash: &str,
) -> Result<User, sqlx::Error> {
    let user = sqlx::query_as::<_, User>(
        "INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING *",
    )
    .bind(email)
    .bind(password_hash)
    .fetch_one(pool)
    .await?;

    Ok(user)
}

pub async fn get_user_by_email(
    pool: &Pool<Postgres>,
    email: &str,
) -> Result<Option<User>, sqlx::Error> {
    let user = sqlx::query_as::<_, User>("SELECT * FROM users WHERE email = $1")
        .bind(email)
        .fetch_optional(pool)
        .await?;

    Ok(user)
}

pub async fn get_user_by_id(
    pool: &Pool<Postgres>,
    user_id: &Uuid,
) -> Result<Option<User>, sqlx::Error> {
    let user = sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = $1")
        .bind(user_id)
        .fetch_optional(pool)
        .await?;

    Ok(user)
}

pub async fn create_file(
    pool: &Pool<Postgres>,
    user_id: &Uuid,
    filename: &str,
    minio_path: &str,
    file_size: i64,
    mime_type: Option<&str>,
) -> Result<File, sqlx::Error> {
    let file = sqlx::query_as::<_, File>(
        "INSERT INTO files (user_id, filename, minio_path, file_size, mime_type, status)
         VALUES ($1, $2, $3, $4, $5, 'uploaded') RETURNING *",
    )
    .bind(user_id)
    .bind(filename)
    .bind(minio_path)
    .bind(file_size)
    .bind(mime_type)
    .fetch_one(pool)
    .await?;

    Ok(file)
}

pub async fn get_user_files(
    pool: &Pool<Postgres>,
    user_id: &Uuid,
) -> Result<Vec<File>, sqlx::Error> {
    let files = sqlx::query_as::<_, File>(
        "SELECT * FROM files WHERE user_id = $1 ORDER BY created_at DESC",
    )
    .bind(user_id)
    .fetch_all(pool)
    .await?;

    Ok(files)
}

pub async fn get_file_by_id(
    pool: &Pool<Postgres>,
    file_id: &Uuid,
    user_id: &Uuid,
) -> Result<Option<File>, sqlx::Error> {
    let file = sqlx::query_as::<_, File>(
        "SELECT * FROM files WHERE id = $1 AND user_id = $2",
    )
    .bind(file_id)
    .bind(user_id)
    .fetch_optional(pool)
    .await?;

    Ok(file)
}

pub async fn delete_file(
    pool: &Pool<Postgres>,
    file_id: &Uuid,
    user_id: &Uuid,
) -> Result<bool, sqlx::Error> {
    let result = sqlx::query("DELETE FROM files WHERE id = $1 AND user_id = $2")
        .bind(file_id)
        .bind(user_id)
        .execute(pool)
        .await?;

    Ok(result.rows_affected() > 0)
}

pub async fn save_chat_message(
    pool: &Pool<Postgres>,
    user_id: &Uuid,
    role: &str,
    content: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query("INSERT INTO chat_history (user_id, role, content) VALUES ($1, $2, $3)")
        .bind(user_id)
        .bind(role)
        .bind(content)
        .execute(pool)
        .await?;

    Ok(())
}

pub async fn get_chat_history(
    pool: &Pool<Postgres>,
    user_id: &Uuid,
    limit: i64,
) -> Result<Vec<(String, String)>, sqlx::Error> {
    let messages = sqlx::query(
        "SELECT role, content FROM chat_history WHERE user_id = $1
         ORDER BY created_at DESC LIMIT $2",
    )
    .bind(user_id)
    .bind(limit)
    .fetch_all(pool)
    .await?;

    let result = messages
        .into_iter()
        .map(|row| (row.get(0), row.get(1)))
        .collect();

    Ok(result)
}

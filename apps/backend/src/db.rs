use crate::models::{File, Memo, MemoAttachment, MemoMessage, User};
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
    let file = sqlx::query_as::<_, File>("SELECT * FROM files WHERE id = $1 AND user_id = $2")
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

// Memos database functions
pub async fn create_memo(
    pool: &Pool<Postgres>,
    user_id: &Uuid,
    title: &str,
    description: Option<&str>,
) -> Result<Memo, sqlx::Error> {
    let memo = sqlx::query_as::<_, Memo>(
        "INSERT INTO memos (user_id, title, description) VALUES ($1, $2, $3) RETURNING *",
    )
    .bind(user_id)
    .bind(title)
    .bind(description)
    .fetch_one(pool)
    .await?;

    Ok(memo)
}

pub async fn get_user_memos(
    pool: &Pool<Postgres>,
    user_id: &Uuid,
) -> Result<Vec<Memo>, sqlx::Error> {
    let memos = sqlx::query_as::<_, Memo>(
        "SELECT * FROM memos WHERE user_id = $1 ORDER BY updated_at DESC",
    )
    .bind(user_id)
    .fetch_all(pool)
    .await?;

    Ok(memos)
}

pub async fn get_memo_by_id(
    pool: &Pool<Postgres>,
    memo_id: &Uuid,
    user_id: &Uuid,
) -> Result<Option<Memo>, sqlx::Error> {
    let memo = sqlx::query_as::<_, Memo>("SELECT * FROM memos WHERE id = $1 AND user_id = $2")
        .bind(memo_id)
        .bind(user_id)
        .fetch_optional(pool)
        .await?;

    Ok(memo)
}

#[allow(dead_code)]
pub async fn update_memo(
    pool: &Pool<Postgres>,
    memo_id: &Uuid,
    user_id: &Uuid,
    title: &str,
    description: Option<&str>,
) -> Result<Option<Memo>, sqlx::Error> {
    let memo = sqlx::query_as::<_, Memo>(
        "UPDATE memos SET title = $1, description = $2, updated_at = CURRENT_TIMESTAMP
         WHERE id = $3 AND user_id = $4 RETURNING *",
    )
    .bind(title)
    .bind(description)
    .bind(memo_id)
    .bind(user_id)
    .fetch_optional(pool)
    .await?;

    Ok(memo)
}

pub async fn delete_memo(
    pool: &Pool<Postgres>,
    memo_id: &Uuid,
    user_id: &Uuid,
) -> Result<bool, sqlx::Error> {
    let result = sqlx::query("DELETE FROM memos WHERE id = $1 AND user_id = $2")
        .bind(memo_id)
        .bind(user_id)
        .execute(pool)
        .await?;

    Ok(result.rows_affected() > 0)
}

pub async fn get_memo_message_count(
    pool: &Pool<Postgres>,
    memo_id: &Uuid,
) -> Result<i64, sqlx::Error> {
    let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM memo_messages WHERE memo_id = $1")
        .bind(memo_id)
        .fetch_one(pool)
        .await?;

    Ok(count.0)
}

pub async fn create_memo_message(
    pool: &Pool<Postgres>,
    memo_id: &Uuid,
    user_id: &Uuid,
    content: &str,
    role: &str,
) -> Result<MemoMessage, sqlx::Error> {
    let message = sqlx::query_as::<_, MemoMessage>(
        "INSERT INTO memo_messages (memo_id, user_id, content, role) VALUES ($1, $2, $3, $4) RETURNING *",
    )
    .bind(memo_id)
    .bind(user_id)
    .bind(content)
    .bind(role)
    .fetch_one(pool)
    .await?;

    // Update memo's updated_at timestamp
    sqlx::query("UPDATE memos SET updated_at = CURRENT_TIMESTAMP WHERE id = $1")
        .bind(memo_id)
        .execute(pool)
        .await?;

    Ok(message)
}

pub async fn get_memo_messages(
    pool: &Pool<Postgres>,
    memo_id: &Uuid,
    user_id: &Uuid,
) -> Result<Vec<MemoMessage>, sqlx::Error> {
    // First verify the memo belongs to the user
    let memo = get_memo_by_id(pool, memo_id, user_id).await?;
    if memo.is_none() {
        return Ok(vec![]);
    }

    let messages = sqlx::query_as::<_, MemoMessage>(
        "SELECT * FROM memo_messages WHERE memo_id = $1 ORDER BY created_at ASC",
    )
    .bind(memo_id)
    .fetch_all(pool)
    .await?;

    Ok(messages)
}

pub async fn create_memo_attachment(
    pool: &Pool<Postgres>,
    message_id: &Uuid,
    file_id: &Uuid,
) -> Result<MemoAttachment, sqlx::Error> {
    let attachment = sqlx::query_as::<_, MemoAttachment>(
        "INSERT INTO memo_attachments (message_id, file_id) VALUES ($1, $2)
         ON CONFLICT (message_id, file_id) DO UPDATE SET created_at = CURRENT_TIMESTAMP
         RETURNING *",
    )
    .bind(message_id)
    .bind(file_id)
    .fetch_one(pool)
    .await?;

    Ok(attachment)
}

pub async fn get_message_attachments(
    pool: &Pool<Postgres>,
    message_id: &Uuid,
) -> Result<Vec<(MemoAttachment, File)>, sqlx::Error> {
    let attachments = sqlx::query(
        "SELECT ma.*, f.* FROM memo_attachments ma
         JOIN files f ON f.id = ma.file_id
         WHERE ma.message_id = $1
         ORDER BY ma.created_at ASC",
    )
    .bind(message_id)
    .fetch_all(pool)
    .await?;

    let result = attachments
        .into_iter()
        .map(|row| {
            let attachment = MemoAttachment {
                id: row.get("id"),
                message_id: row.get("message_id"),
                file_id: row.get("file_id"),
                created_at: row.get("created_at"),
            };
            let file = File {
                id: row.get("id"),
                user_id: row.get("user_id"),
                filename: row.get("filename"),
                minio_path: row.get("minio_path"),
                file_size: row.get("file_size"),
                mime_type: row.get("mime_type"),
                status: row.get("status"),
                created_at: row.get("created_at"),
                updated_at: row.get("updated_at"),
            };
            (attachment, file)
        })
        .collect();

    Ok(result)
}

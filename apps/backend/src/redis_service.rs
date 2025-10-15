use redis::Client;
use std::env;

pub fn create_redis_client() -> Result<Client, redis::RedisError> {
    let redis_url = env::var("REDIS_URL").unwrap_or_else(|_| "redis://127.0.0.1:6379".to_string());

    log::info!("Connecting to Redis at {}", redis_url);
    Client::open(redis_url)
}

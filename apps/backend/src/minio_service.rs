use s3::bucket::Bucket;
use s3::creds::Credentials;
use s3::region::Region;
use std::env;
use uuid::Uuid;

#[derive(Clone)]
pub struct MinioClient {
    bucket: Bucket,
}

impl MinioClient {
    pub fn new() -> Result<Self, Box<dyn std::error::Error>> {
        let endpoint = env::var("MINIO_ENDPOINT").unwrap_or_else(|_| "localhost:9000".to_string());
        let access_key = env::var("MINIO_ACCESS_KEY").unwrap_or_else(|_| "minioadmin".to_string());
        let secret_key =
            env::var("MINIO_SECRET_KEY").unwrap_or_else(|_| "minioadmin123".to_string());
        let bucket_name = env::var("MINIO_BUCKET").unwrap_or_else(|_| "rag-files".to_string());

        let region = Region::Custom {
            region: "us-east-1".to_string(),
            endpoint: format!("http://{}", endpoint),
        };

        let credentials = Credentials::new(Some(&access_key), Some(&secret_key), None, None, None)?;

        let bucket = Bucket::new(&bucket_name, region, credentials)?;

        Ok(MinioClient { bucket })
    }

    pub async fn upload_file(
        &self,
        user_id: &Uuid,
        filename: &str,
        content: &[u8],
    ) -> Result<String, Box<dyn std::error::Error>> {
        let object_path = format!("user-{}/{}", user_id, filename);

        self.bucket
            .put_object(&object_path, content)
            .await
            .map_err(|e| format!("MinIO upload error: {}", e))?;

        Ok(object_path)
    }

    pub async fn download_file(
        &self,
        object_path: &str,
    ) -> Result<Vec<u8>, Box<dyn std::error::Error>> {
        let response = self
            .bucket
            .get_object(object_path)
            .await
            .map_err(|e| format!("MinIO download error: {}", e))?;

        Ok(response.bytes().to_vec())
    }

    pub async fn delete_file(&self, object_path: &str) -> Result<(), Box<dyn std::error::Error>> {
        self.bucket
            .delete_object(object_path)
            .await
            .map_err(|e| format!("MinIO delete error: {}", e))?;

        Ok(())
    }

    pub async fn ensure_bucket_exists(&self) -> Result<(), Box<dyn std::error::Error>> {
        // Try to list objects to check if bucket exists
        // If it fails, the bucket doesn't exist (or we don't have permissions)
        // In production, create the bucket manually or via terraform
        match self.bucket.list("".to_string(), None).await {
            Ok(_) => Ok(()),
            Err(e) => {
                log::warn!("Bucket check failed: {}. Assuming bucket exists.", e);
                Ok(())
            }
        }
    }
}

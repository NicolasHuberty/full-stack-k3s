use qdrant_client::prelude::*;
use qdrant_client::qdrant::vectors_config::Config;
use qdrant_client::qdrant::{
    CreateCollection, Distance, SearchPoints, VectorParams, VectorsConfig,
};
use std::env;
use std::sync::Arc;
use uuid::Uuid;

#[derive(Clone)]
pub struct QdrantService {
    client: Arc<QdrantClient>,
}

impl QdrantService {
    pub async fn new() -> Result<Self, Box<dyn std::error::Error>> {
        let url = env::var("QDRANT_URL").unwrap_or_else(|_| "http://localhost:6333".to_string());

        let client = Arc::new(QdrantClient::from_url(&url).build()?);

        Ok(QdrantService { client })
    }

    pub async fn ensure_collection_exists(
        &self,
        user_id: &Uuid,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let collection_name = format!("user_{}", user_id.to_string().replace("-", "_"));

        match self.client.collection_info(&collection_name).await {
            Ok(_) => Ok(()),
            Err(_) => {
                self.client
                    .create_collection(&CreateCollection {
                        collection_name: collection_name.clone(),
                        vectors_config: Some(VectorsConfig {
                            config: Some(Config::Params(VectorParams {
                                size: 1536,
                                distance: Distance::Cosine.into(),
                                ..Default::default()
                            })),
                        }),
                        ..Default::default()
                    })
                    .await?;
                Ok(())
            }
        }
    }

    pub async fn upsert_vectors(
        &self,
        user_id: &Uuid,
        file_id: &Uuid,
        chunks: Vec<(usize, String, Vec<f32>)>,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let collection_name = format!("user_{}", user_id.to_string().replace("-", "_"));

        use qdrant_client::qdrant::Value;
        use std::collections::HashMap;

        let points: Vec<PointStruct> = chunks
            .into_iter()
            .map(|(idx, text, embedding)| {
                let mut payload: HashMap<String, Value> = HashMap::new();
                payload.insert("file_id".to_string(), Value::from(file_id.to_string()));
                payload.insert("chunk_index".to_string(), Value::from(idx as i64));
                payload.insert("text".to_string(), Value::from(text));

                PointStruct::new(
                    Uuid::new_v4().to_string(),
                    embedding,
                    Payload::from(payload),
                )
            })
            .collect();

        self.client
            .upsert_points_blocking(&collection_name, None, points, None)
            .await?;

        Ok(())
    }

    pub async fn search(
        &self,
        user_id: &Uuid,
        query_vector: Vec<f32>,
        limit: usize,
    ) -> Result<Vec<(Uuid, String, f32)>, Box<dyn std::error::Error>> {
        let collection_name = format!("user_{}", user_id.to_string().replace("-", "_"));

        let search_result = self
            .client
            .search_points(&SearchPoints {
                collection_name,
                vector: query_vector,
                limit: limit as u64,
                with_payload: Some(true.into()),
                ..Default::default()
            })
            .await?;

        let results = search_result
            .result
            .into_iter()
            .filter_map(|point| {
                let file_id = point
                    .payload
                    .get("file_id")
                    .and_then(|v| v.as_str())
                    .and_then(|s| Uuid::parse_str(s).ok())?;

                let text = point
                    .payload
                    .get("text")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string())?;

                Some((file_id, text, point.score))
            })
            .collect();

        Ok(results)
    }

    pub async fn delete_file_vectors(
        &self,
        user_id: &Uuid,
        file_id: &Uuid,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let collection_name = format!("user_{}", user_id.to_string().replace("-", "_"));

        // Delete all points with this file_id using a filter
        use qdrant_client::qdrant::{Condition, Filter};

        let filter = Filter::must([Condition::matches(
            "file_id",
            file_id.to_string(),
        )]);

        self.client
            .delete_points(&collection_name, None, &filter.into(), None)
            .await?;

        Ok(())
    }
}

pub async fn create_mock_embedding(_text: &str) -> Vec<f32> {
    vec![0.1; 1536]
}

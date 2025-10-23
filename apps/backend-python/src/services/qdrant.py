from qdrant_client import AsyncQdrantClient
from qdrant_client.models import Distance, PointStruct, VectorParams
from sentence_transformers import SentenceTransformer

from src.config import settings


class QdrantService:
    def __init__(self):
        self.client = AsyncQdrantClient(url=settings.qdrant_url)
        self.collection = settings.qdrant_collection
        self.encoder = SentenceTransformer("all-MiniLM-L6-v2")

    async def ensure_collection(self) -> None:
        collections = await self.client.get_collections()
        collection_names = [col.name for col in collections.collections]

        if self.collection not in collection_names:
            await self.client.create_collection(
                collection_name=self.collection,
                vectors_config=VectorParams(
                    size=settings.qdrant_vector_size, distance=Distance.COSINE
                ),
            )

    def encode(self, text: str) -> list[float]:
        return self.encoder.encode(text).tolist()

    async def index_document(
        self, doc_id: str, text: str, metadata: dict[str, str | int | float]
    ) -> None:
        vector = self.encode(text)
        point = PointStruct(id=doc_id, vector=vector, payload={"text": text, **metadata})
        await self.client.upsert(collection_name=self.collection, points=[point])

    async def search(self, query: str, limit: int = 5, user_id: str | None = None) -> list[dict]:
        vector = self.encode(query)

        search_filter = None
        if user_id:
            from qdrant_client.models import FieldCondition, Filter, MatchValue

            search_filter = Filter(
                must=[FieldCondition(key="user_id", match=MatchValue(value=user_id))]
            )

        results = await self.client.search(
            collection_name=self.collection,
            query_vector=vector,
            limit=limit,
            query_filter=search_filter,
        )

        return [
            {
                "id": str(result.id),
                "score": result.score,
                "text": result.payload.get("text", ""),
                "metadata": {k: v for k, v in result.payload.items() if k != "text"},
            }
            for result in results
        ]

    async def delete_document(self, doc_id: str) -> None:
        from qdrant_client.models import PointIdsList

        await self.client.delete(
            collection_name=self.collection, points_selector=PointIdsList(points=[doc_id])
        )

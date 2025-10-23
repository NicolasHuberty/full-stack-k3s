from anthropic import AsyncAnthropic

from src.config import settings
from src.schemas.rag import RagQueryRequest, RagQueryResponse, SearchResult
from src.services.qdrant import QdrantService


class RagService:
    def __init__(self, qdrant: QdrantService):
        self.qdrant = qdrant
        self.anthropic = AsyncAnthropic(api_key=settings.anthropic_api_key)

    async def search(
        self, query: str, limit: int = 5, user_id: str | None = None
    ) -> list[SearchResult]:
        results = await self.qdrant.search(query, limit, user_id)
        return [SearchResult(**result) for result in results]

    async def query(self, request: RagQueryRequest, user_id: str | None = None) -> RagQueryResponse:
        search_results = await self.search(request.query, limit=5, user_id=user_id)

        context = "\n\n".join(
            [f"Source {i+1}:\n{result.text}" for i, result in enumerate(search_results)]
        )

        messages = [{"role": msg.role, "content": msg.content} for msg in request.chat_history]

        system_prompt = f"""You are a helpful assistant. Answer the user's question based on the following context.
If the context doesn't contain relevant information, say so.

Context:
{context}
"""

        messages.append({"role": "user", "content": request.query})

        response = await self.anthropic.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=2048,
            system=system_prompt,
            messages=messages,
        )

        answer = response.content[0].text if response.content else "No response generated"

        return RagQueryResponse(answer=answer, sources=search_results)

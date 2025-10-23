from fastapi import APIRouter, Depends

from src.api.deps import CurrentUser, get_qdrant
from src.schemas.rag import RagQueryRequest, RagQueryResponse, SearchRequest, SearchResponse
from src.services.qdrant import QdrantService
from src.services.rag import RagService

router = APIRouter()


@router.post("/search", response_model=SearchResponse)
async def search(
    data: SearchRequest,
    qdrant: QdrantService = Depends(get_qdrant),
    current_user: CurrentUser = None,
):
    service = RagService(qdrant)
    results = await service.search(data.query, data.limit, current_user.id)
    return SearchResponse(results=results)


@router.post("/query", response_model=RagQueryResponse)
async def rag_query(
    data: RagQueryRequest,
    qdrant: QdrantService = Depends(get_qdrant),
    current_user: CurrentUser = None,
):
    service = RagService(qdrant)
    return await service.query(data, current_user.id)

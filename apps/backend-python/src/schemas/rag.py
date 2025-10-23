from pydantic import BaseModel


class SearchRequest(BaseModel):
    query: str
    limit: int = 5


class SearchResult(BaseModel):
    id: str
    score: float
    text: str
    metadata: dict[str, str | int | float]


class SearchResponse(BaseModel):
    results: list[SearchResult]


class ChatMessage(BaseModel):
    role: str
    content: str


class RagQueryRequest(BaseModel):
    query: str
    chat_history: list[ChatMessage] = []


class RagQueryResponse(BaseModel):
    answer: str
    sources: list[SearchResult]

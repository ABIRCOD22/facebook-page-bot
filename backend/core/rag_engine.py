import hashlib
import logging
from dataclasses import dataclass

import chromadb
from chromadb.config import Settings

logger = logging.getLogger(__name__)


@dataclass
class SearchResult:
    content: str
    category: str
    score: float
    metadata: dict
    title: str = ""


class RAGEngine:
    """Vector search via ChromaDB (local, free, built-in embeddings)."""

    _client = None

    @classmethod
    def _get_client(cls):
        if cls._client is None:
            cls._client = chromadb.PersistentClient(
                path="./data/chromadb",
                settings=Settings(anonymized_telemetry=False, allow_reset=True),
            )
        return cls._client

    def __init__(self, user_id: str):
        self.user_id = user_id
        safe_name = hashlib.md5(user_id.encode()).hexdigest()[:16]
        self.collection_name = f"user_{safe_name}"

        client = self._get_client()
        self.collection = client.get_or_create_collection(
            name=self.collection_name,
            metadata={"hnsw:space": "cosine"},
        )

    def add_document(
        self,
        doc_id: str,
        title: str,
        content: str,
        category: str = "general",
        extra_metadata: dict = None,
    ):
        metadata = {"category": category, "title": title, "user_id": self.user_id}
        if extra_metadata:
            metadata.update(extra_metadata)

        self.collection.upsert(
            documents=[f"{title}\n{content}"],
            ids=[doc_id],
            metadatas=[metadata],
        )
        logger.info("Added doc '%s' to KB for user %s...", title, self.user_id[:8])

    def add_product(
        self,
        product_id: str,
        name: str,
        description: str,
        price: str,
        currency: str = "BDT",
        availability: str = "in_stock",
        category: str = "",
        variants: str = "",
    ):
        full_text = (
            f"Product: {name}\nDescription: {description}\nPrice: {price} {currency}\n"
            f"Availability: {availability}\nCategory: {category}\nVariants: {variants}"
        )

        self.collection.upsert(
            documents=[full_text],
            ids=[product_id],
            metadatas={
                "category": "product",
                "title": name,
                "price": price,
                "availability": availability,
                "user_id": self.user_id,
            },
        )
        logger.info("Added product '%s' to KB", name)

    def search(self, query: str, top_k: int = 5, category_filter: str = None) -> list[SearchResult]:
        count = self.collection.count()
        if count == 0:
            return []

        where_filter = {"category": category_filter} if category_filter else None

        try:
            results = self.collection.query(
                query_texts=[query],
                n_results=min(top_k, count),
                where=where_filter,
            )

            search_results = []
            if results and results["documents"] and results["documents"][0]:
                for i, doc in enumerate(results["documents"][0]):
                    meta = results["metadatas"][0][i] if results["metadatas"] else {}
                    distance = results["distances"][0][i] if results["distances"] else 1.0
                    search_results.append(
                        SearchResult(
                            content=doc,
                            category=meta.get("category", "general"),
                            score=max(0, 1 - distance),
                            metadata=meta,
                            title=meta.get("title", ""),
                        )
                    )
            return search_results
        except Exception as e:
            logger.error("RAG search error: %s", e)
            return []

    def delete_document(self, doc_id: str):
        try:
            self.collection.delete(ids=[doc_id])
        except Exception as e:
            logger.error("Delete error: %s", e)

    def get_stats(self) -> dict:
        return {
            "total_documents": self.collection.count(),
            "collection_name": self.collection_name,
        }

    def clear_all(self):
        client = self._get_client()
        try:
            client.delete_collection(self.collection_name)
            self.collection = client.get_or_create_collection(
                name=self.collection_name,
                metadata={"hnsw:space": "cosine"},
            )
        except Exception as e:
            logger.error("Clear KB error: %s", e)

import math
import hashlib
from typing import List, Dict, Any, Optional
from pathlib import Path
from ..config import CHROMA_DIR

def fast_fallback_vector(text: str, dim: int = 128) -> List[float]:
    """Generate a fast deterministic normalized vector for offline/instant indexing."""
    vec = [0.0] * dim
    words = text.lower().split()
    if not words:
        words = ["empty"]
    for w in words:
        h = int(hashlib.md5(w.encode("utf-8")).hexdigest(), 16)
        idx = h % dim
        vec[idx] += 1.0
    norm = math.sqrt(sum(x * x for x in vec))
    if norm > 0:
        vec = [round(x / norm, 6) for x in vec]
    return vec

class ChromaService:
    def __init__(self):
        self.client = None
        self.collection = None
        self._init_client()

    def _init_client(self):
        try:
            import chromadb
            from chromadb.config import Settings
            self.client = chromadb.PersistentClient(
                path=str(CHROMA_DIR),
                settings=Settings(anonymized_telemetry=False)
            )
            self.collection = self.client.get_or_create_collection(
                name="file_embeddings",
                metadata={"hnsw:space": "cosine"}
            )
        except Exception:
            self.client = None
            self.collection = None

    def add_file(
        self,
        file_id: str,
        document_text: str,
        metadata: Dict[str, Any],
        embedding: Optional[List[float]] = None
    ):
        """Add or update file document and its vector embedding in ChromaDB."""
        if not self.collection:
            self._init_client()
        if not self.collection:
            return

        text_to_index = document_text.strip() if document_text and document_text.strip() else metadata.get("original_name", "")
        clean_meta = {}
        for k, v in metadata.items():
            if v is not None and isinstance(v, (str, int, float, bool)):
                clean_meta[k] = v
            elif v is not None:
                clean_meta[k] = str(v)

        # Use Ollama embedding if available; otherwise use fast instant local vector
        vector_to_use = embedding if embedding is not None else fast_fallback_vector(text_to_index)

        try:
            self.collection.upsert(
                ids=[file_id],
                embeddings=[vector_to_use],
                documents=[text_to_index],
                metadatas=[clean_meta]
            )
        except Exception as e:
            print("Chroma upsert error:", e)

    def search_semantic(
        self,
        query_text: str,
        query_embedding: Optional[List[float]] = None,
        n_results: int = 15
    ) -> List[Dict[str, Any]]:
        """Search ChromaDB for documents closest to the query."""
        if not self.collection:
            self._init_client()
        if not self.collection:
            return []

        try:
            count = self.collection.count()
            if count == 0:
                return []

            actual_n = min(n_results, count)
            search_vector = query_embedding if query_embedding is not None else fast_fallback_vector(query_text)

            results = self.collection.query(
                query_embeddings=[search_vector],
                n_results=actual_n,
                include=["metadatas", "documents", "distances"]
            )

            hits = []
            if results and results.get("ids") and len(results["ids"]) > 0:
                ids = results["ids"][0]
                metas = results["metadatas"][0] if results.get("metadatas") else [{}] * len(ids)
                docs = results["documents"][0] if results.get("documents") else [""] * len(ids)
                dists = results["distances"][0] if results.get("distances") else [0.0] * len(ids)

                for fid, meta, doc, dist in zip(ids, metas, docs, dists):
                    similarity = max(0.0, min(1.0, 1.0 - (dist if dist is not None else 0.5)))
                    score_pct = round(similarity * 100, 1)

                    hits.append({
                        "file_id": fid,
                        "score": score_pct,
                        "metadata": meta,
                        "snippet": doc[:250] if doc else ""
                    })

            return hits
        except Exception as e:
            print("Chroma search error:", e)
            return []

    def delete_file(self, file_id: str):
        if not self.collection:
            return
        try:
            self.collection.delete(ids=[file_id])
        except Exception:
            pass

    def clear(self):
        if not self.client:
            return
        try:
            self.client.delete_collection("file_embeddings")
            self.collection = self.client.create_collection(
                name="file_embeddings",
                metadata={"hnsw:space": "cosine"}
            )
        except Exception:
            pass

chroma_service = ChromaService()

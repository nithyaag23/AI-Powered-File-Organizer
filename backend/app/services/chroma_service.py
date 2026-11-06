import math
import hashlib
from typing import List, Dict, Any, Optional
from ..config import CHROMA_DIR

COLLECTION_PREFIX = "file_embeddings_"

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
    """
    One Chroma collection per vector size. Ollama vectors (e.g. 768-dim) and the
    offline fallback (128-dim) cannot share a collection, so each size gets its own.
    """

    def __init__(self):
        self.client = None
        self._init_client()

    def _init_client(self):
        try:
            import chromadb
            from chromadb.config import Settings
            self.client = chromadb.PersistentClient(
                path=str(CHROMA_DIR),
                settings=Settings(anonymized_telemetry=False)
            )
        except Exception:
            self.client = None

    def _collection(self, dim: int, create: bool = True):
        if not self.client:
            self._init_client()
        if not self.client:
            return None
        name = f"{COLLECTION_PREFIX}{dim}"
        try:
            if create:
                return self.client.get_or_create_collection(name=name, metadata={"hnsw:space": "cosine"})
            return self.client.get_collection(name=name)
        except Exception:
            return None

    def _all_collections(self):
        if not self.client:
            return []
        try:
            return [c for c in self.client.list_collections() if c.name.startswith(COLLECTION_PREFIX)]
        except Exception:
            return []

    def add_file(
        self,
        file_id: str,
        document_text: str,
        metadata: Dict[str, Any],
        embedding: Optional[List[float]] = None
    ):
        """Add or update file document and its vector embedding in ChromaDB."""
        text_to_index = document_text.strip() if document_text and document_text.strip() else metadata.get("original_name", "")
        clean_meta = {}
        for k, v in metadata.items():
            if v is not None and isinstance(v, (str, int, float, bool)):
                clean_meta[k] = v
            elif v is not None:
                clean_meta[k] = str(v)

        vector = embedding if embedding is not None else fast_fallback_vector(text_to_index)
        collection = self._collection(len(vector))
        if not collection:
            return
        try:
            collection.upsert(
                ids=[file_id],
                embeddings=[vector],
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
        """
        Search every collection that can be compared with the query: the query's own
        vector size, plus the offline fallback size, so files indexed while Ollama was
        down are still found. Results are merged and sorted by score.
        """
        query_vectors = []
        if query_embedding is not None:
            query_vectors.append(query_embedding)
        query_vectors.append(fast_fallback_vector(query_text))

        hits: List[Dict[str, Any]] = []
        seen_dims = set()
        for qv in query_vectors:
            dim = len(qv)
            if dim in seen_dims:
                continue
            seen_dims.add(dim)
            collection = self._collection(dim, create=False)
            if not collection:
                continue
            try:
                count = collection.count()
                if count == 0:
                    continue
                results = collection.query(
                    query_embeddings=[qv],
                    n_results=min(n_results, count),
                    include=["metadatas", "documents", "distances"]
                )
            except Exception as e:
                print("Chroma search error:", e)
                continue

            if not results or not results.get("ids"):
                continue
            ids = results["ids"][0]
            metas = results["metadatas"][0] if results.get("metadatas") else [{}] * len(ids)
            docs = results["documents"][0] if results.get("documents") else [""] * len(ids)
            dists = results["distances"][0] if results.get("distances") else [0.0] * len(ids)
            for fid, meta, doc, dist in zip(ids, metas, docs, dists):
                similarity = max(0.0, min(1.0, 1.0 - (dist if dist is not None else 0.5)))
                hits.append({
                    "file_id": fid,
                    "score": round(similarity * 100, 1),
                    "metadata": meta,
                    "snippet": doc[:250] if doc else ""
                })

        hits.sort(key=lambda h: h["score"], reverse=True)
        # Keep the best hit per file when it appears in more than one collection
        best: Dict[str, Dict[str, Any]] = {}
        for h in hits:
            if h["file_id"] not in best:
                best[h["file_id"]] = h
        return list(best.values())[:n_results]

    def total_count(self) -> int:
        total = 0
        for c in self._all_collections():
            try:
                total += c.count()
            except Exception:
                pass
        return total

    def delete_file(self, file_id: str):
        for c in self._all_collections():
            try:
                c.delete(ids=[file_id])
            except Exception:
                pass

    def clear(self):
        for c in self._all_collections():
            try:
                self.client.delete_collection(c.name)
            except Exception:
                pass

chroma_service = ChromaService()

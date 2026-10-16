import re
from fastapi import APIRouter, Query
from typing import List, Dict, Any
from ..services.ollama_service import ollama_service
from ..services.chroma_service import chroma_service
from ..database import get_file_by_id, list_files

router = APIRouter(prefix="/api/search", tags=["search"])

@router.get("/semantic")
def semantic_search(
    q: str = Query(..., description="Natural language search query"),
    limit: int = Query(15, ge=1, le=50)
):
    query_text = q.strip()
    if not query_text:
        return {"query": q, "results": [], "total": 0, "method": "none"}

    # 1. Attempt embedding generation via Ollama (or fast local vector fallback)
    query_embedding = ollama_service.generate_embedding(query_text)
    
    # 2. Query ChromaDB vector space
    hits = chroma_service.search_semantic(
        query_text=query_text,
        query_embedding=query_embedding,
        n_results=limit * 2
    )

    enriched_results = []
    seen_ids = set()

    for hit in hits:
        fid = hit["file_id"]
        file_info = get_file_by_id(fid)
        if file_info:
            seen_ids.add(fid)
            enriched_results.append({
                **file_info,
                "similarity_score": hit["score"],
                "snippet": hit.get("snippet", "")
            })

    # 3. Comprehensive keyword, token, and partial match fallback across all vault files
    all_stored_files = list_files()
    query_tokens = [t.lower() for t in re.findall(r"\w+", query_text) if len(t) >= 2]

    for f in all_stored_files:
        if f["id"] not in seen_ids:
            searchable_corpus = f"{f.get('original_name', '')} {f.get('clean_name', '')} {f.get('topic', '')} {f.get('subfolder', '')} {f.get('category', '')} {f.get('tags', '')} {f.get('extracted_text', '')}".lower()
            
            # Check for matches
            matched_tokens = [t for t in query_tokens if t in searchable_corpus]
            is_substring_match = query_text.lower() in searchable_corpus

            if matched_tokens or is_substring_match:
                seen_ids.add(f["id"])
                
                # Calculate match percentage
                match_ratio = len(matched_tokens) / max(1, len(query_tokens))
                score = 50.0 + (match_ratio * 40.0)
                if is_substring_match:
                    score = max(score, 85.0)

                snippet = f.get("extracted_text", "")[:250]
                if not snippet:
                    snippet = f"{f.get('clean_name')} • Classified in {f.get('subfolder')}"

                enriched_results.append({
                    **f,
                    "similarity_score": round(min(99.0, score), 1),
                    "snippet": snippet
                })

    # Sort results by similarity score descending
    enriched_results.sort(key=lambda x: x["similarity_score"], reverse=True)
    final_results = enriched_results[:limit]

    method_used = "ollama_chromadb" if query_embedding is not None else "chromadb_hybrid"

    return {
        "query": q,
        "results": final_results,
        "total": len(final_results),
        "method": method_used
    }

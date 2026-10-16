import time
import requests
from typing import List, Optional, Dict, Any
from ..config import OLLAMA_BASE_URL, DEFAULT_EMBED_MODEL

class OllamaService:
    def __init__(self, base_url: str = OLLAMA_BASE_URL, default_model: str = DEFAULT_EMBED_MODEL):
        self.base_url = base_url.rstrip("/")
        self.default_model = default_model
        self._last_check_time = 0
        self._is_connected = False
        self._cached_health: Optional[Dict[str, Any]] = None

    def check_health(self, force: bool = False) -> Dict[str, Any]:
        """Check if Ollama server is running and get installed models (cached for 5s)."""
        now = time.time()
        if not force and self._cached_health and (now - self._last_check_time < 5):
            return self._cached_health

        self._last_check_time = now
        try:
            # 0.5s connect timeout, 2s read timeout
            resp = requests.get(f"{self.base_url}/api/tags", timeout=(0.5, 2))
            if resp.status_code == 200:
                data = resp.json()
                models = [m.get("name", "") for m in data.get("models", [])]
                self._is_connected = True
                self._cached_health = {
                    "connected": True,
                    "url": self.base_url,
                    "models": models,
                    "default_model": self.default_model,
                    "model_available": any(self.default_model in m for m in models)
                }
                return self._cached_health
            self._is_connected = False
            self._cached_health = {
                "connected": False,
                "url": self.base_url,
                "error": f"Ollama returned status code {resp.status_code}",
                "models": []
            }
            return self._cached_health
        except requests.exceptions.RequestException:
            self._is_connected = False
            self._cached_health = {
                "connected": False,
                "url": self.base_url,
                "error": "Ollama server is not reachable at " + self.base_url,
                "models": []
            }
            return self._cached_health

    def generate_embedding(self, text: str, model: Optional[str] = None) -> Optional[List[float]]:
        """Generate embedding vector using Ollama's embeddings API."""
        if not text or not text.strip():
            return None

        # Check health cache first; if offline, return None immediately to avoid blocking
        health = self.check_health()
        if not health["connected"]:
            return None

        chosen_model = model or self.default_model
        try:
            resp = requests.post(
                f"{self.base_url}/api/embeddings",
                json={"model": chosen_model, "prompt": text[:4000]},
                timeout=(0.5, 10)
            )
            if resp.status_code == 200:
                data = resp.json()
                embedding = data.get("embedding")
                if embedding and isinstance(embedding, list):
                    return embedding
        except Exception:
            pass

        return None

ollama_service = OllamaService()

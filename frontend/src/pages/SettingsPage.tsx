import React, { useState, useEffect } from 'react';
import {
  Settings,
  Server,
  HardDrive,
  Bot,
  Database,
  Trash2,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Terminal
} from 'lucide-react';
import { fetchSystemStatus, clearAllData } from '../api/client';
import { SystemStatus } from '../types';
import { formatBytes } from '../utils/formatters';

interface SettingsPageProps {
  onRefreshStats: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ onRefreshStats }) => {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadStatus = async () => {
    setLoading(true);
    setMsg(null);
    try {
      const data = await fetchSystemStatus();
      setStatus(data);
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message || 'Failed to connect to backend server.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const handleClearAll = async () => {
    if (!window.confirm('WARNING: Are you sure you want to permanently clear all uploaded files, SQLite records, and ChromaDB vector embeddings? This cannot be undone.')) {
      return;
    }
    setResetting(true);
    try {
      const res = await clearAllData();
      setMsg({ type: 'success', text: res.message });
      await loadStatus();
      onRefreshStats();
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message || 'Failed to clear storage.' });
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">System & AI Settings</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Monitor API endpoints, local storage directories, vector database health, and Ollama configuration
          </p>
        </div>
        <button onClick={loadStatus} className="btn-secondary">
          <RefreshCw className="w-4 h-4" />
          Refresh Status
        </button>
      </div>

      {msg && (
        <div className={`p-4 rounded-xl border text-sm flex items-center gap-2 ${
          msg.type === 'success'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
            : 'bg-rose-50 border-rose-200 text-rose-800'
        }`}>
          {msg.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          <span>{msg.text}</span>
        </div>
      )}

      {loading && !status ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#7CA7A6]"></div>
        </div>
      ) : (
        <div className="space-y-5">
          {/* FastAPI Backend */}
          <div className="card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#7CA7A6]/10 text-[#7CA7A6] flex items-center justify-center">
                  <Server className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">FastAPI Backend</h3>
                  <p className="text-xs text-slate-500">http://127.0.0.1:8000</p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                Connected
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs bg-slate-50 p-3 rounded-xl border border-slate-100">
              <div>
                <span className="text-slate-400 font-medium">Framework:</span>
                <div className="font-bold text-slate-700 mt-0.5">Python + FastAPI</div>
              </div>
              <div>
                <span className="text-slate-400 font-medium">API Version:</span>
                <div className="font-bold text-slate-700 mt-0.5">{status?.backend?.version || '1.0.0'}</div>
              </div>
              <div>
                <span className="text-slate-400 font-medium">Interactive Docs:</span>
                <div className="mt-0.5">
                  <a
                    href="http://127.0.0.1:8000/docs"
                    target="_blank"
                    rel="noreferrer"
                    className="font-bold text-[#7CA7A6] hover:underline inline-flex items-center gap-1"
                  >
                    Open Swagger <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Ollama AI Embeddings */}
          <div className="card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Ollama AI Embeddings</h3>
                  <p className="text-xs text-slate-500">{status?.ollama?.base_url || 'http://127.0.0.1:11434'}</p>
                </div>
              </div>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${
                status?.ollama?.connected
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${status?.ollama?.connected ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                {status?.ollama?.connected ? 'Ollama Online' : 'Local Fallback'}
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Target Embedding Model:</span>
                <span className="font-mono font-bold text-slate-800">{status?.ollama?.active_model || 'nomic-embed-text'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Detected Installed Models:</span>
                <span className="font-mono text-slate-700">
                  {status?.ollama?.models && status.ollama.models.length > 0
                    ? status.ollama.models.join(', ')
                    : 'None detected'}
                </span>
              </div>

              {!status?.ollama?.connected && (
                <div className="pt-2 border-t border-[#ECE6DE]/60 text-slate-600 space-y-1.5">
                  <p className="font-medium text-slate-700 flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5 text-[#7CA7A6]" />
                    How to enable local Ollama embeddings:
                  </p>
                  <p className="text-slate-500">1. Download and start Ollama from <a href="https://ollama.com" target="_blank" rel="noreferrer" className="text-[#7CA7A6] underline">ollama.com</a>.</p>
                  <p className="text-slate-500">2. Run in terminal: <code className="bg-slate-200 px-1.5 py-0.5 rounded font-mono text-slate-800">ollama pull nomic-embed-text</code></p>
                  <p className="text-xs text-[#7CA7A6] font-semibold mt-1">
                    Note: Semantic search works right now using ChromaDB's built-in text vector indexing!
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* ChromaDB Vector Database */}
          <div className="card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">ChromaDB Vector Store</h3>
                  <p className="text-xs text-slate-500 truncate max-w-sm">{status?.chromadb?.path}</p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                Initialized
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3 rounded-xl border border-slate-100">
              <div>
                <span className="text-slate-400 font-medium">Vector Index Collection:</span>
                <div className="font-bold text-slate-800 mt-0.5">file_embeddings (Cosine space)</div>
              </div>
              <div>
                <span className="text-slate-400 font-medium">Total Vector Documents:</span>
                <div className="font-bold text-indigo-600 mt-0.5">
                  {status?.chromadb?.collection_count ?? 0} vectors
                </div>
              </div>
            </div>
          </div>

          {/* Local Storage Directory */}
          <div className="card p-5 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
                <HardDrive className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Local Storage Directory</h3>
                <p className="text-xs text-slate-500 truncate max-w-sm">{status?.storage?.upload_dir}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3 rounded-xl border border-slate-100">
              <div>
                <span className="text-slate-400 font-medium">Stored Files:</span>
                <div className="font-bold text-slate-800 mt-0.5">{status?.storage?.total_files ?? 0} files</div>
              </div>
              <div>
                <span className="text-slate-400 font-medium">Disk Space Consumed:</span>
                <div className="font-bold text-slate-800 mt-0.5">{formatBytes(status?.storage?.total_size ?? 0)}</div>
              </div>
            </div>
          </div>

          {/* Danger Zone: Reset Data */}
          <div className="card p-5 border-rose-200 space-y-3">
            <div>
              <h3 className="font-bold text-rose-700 text-sm flex items-center gap-2">
                <Trash2 className="w-4 h-4" />
                Data Reset & Clean
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Permanently wipes all uploaded files from disk, resets SQLite file registry, and empties ChromaDB vectors.
              </p>
            </div>
            <button
              onClick={handleClearAll}
              disabled={resetting}
              className="btn-danger"
            >
              {resetting ? 'Resetting...' : 'Reset All Files & Database'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

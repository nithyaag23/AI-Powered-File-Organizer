import React, { useState } from 'react';
import {
  Sparkles,
  Search,
  Download,
  Trash2,
  FileText,
  Loader2,
  Bot,
  Lightbulb,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { searchSemantic, deleteFile, getDownloadUrl } from '../api/client';
import { SemanticSearchResult } from '../types';
import { formatBytes, formatDate, getCategoryBadgeColor } from '../utils/formatters';

interface AISearchPageProps {
  onRefreshStats: () => void;
  ollamaOnline: boolean;
}

const SAMPLE_PROMPTS = [
  'Find my resume or job application',
  'Quarterly budget report or invoices',
  'Project architecture presentation slides',
  'Python automation scripts',
  'Travel photos or vacation images',
  'Meeting notes and agenda',
];

export const AISearchPage: React.FC<AISearchPageProps> = ({ onRefreshStats, ollamaOnline }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SemanticSearchResult[]>([]);
  const [searchMethod, setSearchMethod] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async (queryString: string) => {
    const q = queryString.trim();
    if (!q) return;
    setLoading(true);
    setHasSearched(true);
    try {
      const data = await searchSemantic(q, 15);
      setResults(data.results);
      setSearchMethod(data.method);
    } catch (err: any) {
      alert(err.message || 'AI Search request failed');
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch(query);
  };

  const handleDelete = async (fileId: string, name: string) => {
    if (window.confirm(`Delete "${name}"?`)) {
      try {
        await deleteFile(fileId);
        setResults((prev) => prev.filter((r) => r.id !== fileId));
        onRefreshStats();
      } catch (err: any) {
        alert(err.message || 'Failed to delete file');
      }
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#7FA080]/15 text-[#3F6241] border border-[#7FA080]/30 text-xs font-bold uppercase tracking-wider mb-2">
          <Sparkles className="w-3.5 h-3.5" />
          Neural Vector Search
        </div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">AI Semantic Search</h1>
        <p className="text-slate-500 text-sm mt-0.5">
          Ask for files using everyday human language. Understands content meaning via Ollama embeddings and ChromaDB vector space.
        </p>
      </div>

      {/* Search Input Box */}
      <div className="card p-5 space-y-4 shadow-sm border-[#ECE6DE]">
        <form onSubmit={handleFormSubmit} className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. Find documents discussing machine learning algorithms and arrays..."
            className="w-full pl-11 pr-28 py-3.5 rounded-xl bg-slate-50 border border-[#ECE6DE] text-slate-900 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#7CA7A6]/20 focus:border-[#7CA7A6] font-medium"
          />
          <Sparkles className="w-5 h-5 text-[#7CA7A6] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="btn-primary absolute right-2 top-1/2 -translate-y-1/2 py-2 px-4"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search AI'}
          </button>
        </form>

        {/* Prompt Suggestions */}
        <div className="flex items-center gap-2 flex-wrap pt-1">
          <div className="flex items-center gap-1 text-xs text-slate-400 font-semibold mr-1">
            <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
            Try searching:
          </div>
          {SAMPLE_PROMPTS.map((prompt, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setQuery(prompt);
                handleSearch(prompt);
              }}
              className="text-xs px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-[#7CA7A6]/10 hover:text-[#406665] text-slate-600 font-medium transition-colors"
            >
              "{prompt}"
            </button>
          ))}
        </div>
      </div>

      {/* AI Engine Status Banner */}
      <div className="p-3.5 rounded-xl bg-slate-100/70 border border-[#ECE6DE]/80 flex items-center justify-between text-xs text-slate-600">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-[#7CA7A6] shrink-0" />
          <span>
            {searchMethod === 'ollama_chromadb'
              ? 'Query analyzed with Ollama neural embeddings + ChromaDB cosine distance.'
              : 'Indexed via ChromaDB vector database. Full semantic match enabled.'}
          </span>
        </div>
        <span className="font-semibold text-slate-700">
          {ollamaOnline ? 'Ollama: Connected' : 'Local Vector Engine: Active'}
        </span>
      </div>

      {/* Results Section */}
      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[250px] gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#7CA7A6]"></div>
          <p className="text-xs text-slate-400 font-medium">Computing neural vector similarity across ChromaDB...</p>
        </div>
      ) : hasSearched && results.length === 0 ? (
        <div className="card p-12 text-center space-y-2">
          <Search className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="font-bold text-slate-700">No semantically matching files found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Try rephrasing your search query, or upload more documents containing text content.
          </p>
        </div>
      ) : results.length > 0 ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 px-1">
            <span>Found {results.length} ranked match{results.length > 1 ? 'es' : ''}</span>
            <span>Ranked by similarity score</span>
          </div>

          {results.map((item, idx) => {
            const badge = getCategoryBadgeColor(item.category);
            const score = item.similarity_score;

            return (
              <div key={item.id} className="card p-4 card-hover space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-[#7CA7A6]/10 text-[#7CA7A6] flex items-center justify-center shrink-0 mt-0.5">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-slate-900 text-sm truncate">{item.original_name}</h3>
                        <span className={`px-2 py-0.5 rounded text-[11px] font-medium border ${badge.bg} ${badge.text} ${badge.border}`}>
                          {item.category}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-3">
                        <span>{formatBytes(item.file_size)}</span>
                        <span>•</span>
                        <span>Added {formatDate(item.created_at)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Similarity Score Pill */}
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-extrabold text-xs bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {score}% Match
                      </div>
                    </div>
                    <div className="flex items-center gap-1 border-l border-slate-100 pl-3">
                      <a
                        href={getDownloadUrl(item.id)}
                        download={item.original_name}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-[#7CA7A6] hover:bg-[#7CA7A6]/10"
                        title="Download"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                      <button
                        onClick={() => handleDelete(item.id, item.original_name)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Content Snippet / Context */}
                {item.snippet && (
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-600 leading-relaxed font-mono">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1 font-sans">
                      Content Snippet Context:
                    </span>
                    {item.snippet}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
};

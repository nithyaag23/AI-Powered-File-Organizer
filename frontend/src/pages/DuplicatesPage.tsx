import React, { useState, useEffect } from 'react';
import { Copy, Trash2, CheckCircle2, ShieldCheck, Download, AlertCircle, RefreshCw } from 'lucide-react';
import { fetchDuplicates, cleanupDuplicates, deleteFile, getDownloadUrl } from '../api/client';
import { DuplicateGroup } from '../types';
import { formatBytes, formatDate, getCategoryBadgeColor } from '../utils/formatters';

interface DuplicatesPageProps {
  onRefreshStats: () => void;
}

export const DuplicatesPage: React.FC<DuplicatesPageProps> = ({ onRefreshStats }) => {
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [cleaning, setCleaning] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadDuplicates = async () => {
    setLoading(true);
    setSuccessMsg(null);
    try {
      const data = await fetchDuplicates();
      setDuplicateGroups(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDuplicates();
  }, []);

  const handleAutoClean = async (strategy: 'keep_first' | 'keep_latest') => {
    if (!window.confirm(`Clean up all redundant copies (Strategy: ${strategy === 'keep_first' ? 'Keep oldest original' : 'Keep newest copy'})?`)) {
      return;
    }
    setCleaning(true);
    try {
      const res = await cleanupDuplicates(strategy);
      setSuccessMsg(`Cleaned ${res.deleted_count} duplicate files and reclaimed ${formatBytes(res.freed_bytes)} of disk space!`);
      await loadDuplicates();
      onRefreshStats();
    } catch (err: any) {
      alert(err.message || 'Duplicate cleanup failed');
    } finally {
      setCleaning(false);
    }
  };

  const handleDeleteSingle = async (fileId: string, name: string) => {
    if (window.confirm(`Delete this specific copy "${name}"?`)) {
      try {
        await deleteFile(fileId);
        await loadDuplicates();
        onRefreshStats();
      } catch (err: any) {
        alert(err.message || 'Failed to delete copy');
      }
    }
  };

  const totalWastedBytes = duplicateGroups.reduce((acc, g) => acc + g.wasted_size, 0);
  const totalDuplicateCopies = duplicateGroups.reduce((acc, g) => acc + (g.count - 1), 0);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Duplicate Detection</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Bit-for-bit exact duplicate identification powered by cryptographic SHA-256 hash matching
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadDuplicates}
            className="btn-secondary"
            title="Refresh Scan"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          {duplicateGroups.length > 0 && (
            <button
              onClick={() => handleAutoClean('keep_first')}
              disabled={cleaning}
              className="btn-danger"
            >
              <Trash2 className="w-4 h-4" />
              Auto-Clean All ({totalDuplicateCopies} Copies)
            </button>
          )}
        </div>
      </div>

      {successMsg && (
        <div className="p-4 rounded-xl bg-[#7FA080]/15 border border-emerald-200 text-[#3F6241] text-sm flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Summary KPI Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-4">
          <span className="text-xs font-semibold text-slate-500 uppercase">Duplicate Groups</span>
          <div className="text-2xl font-extrabold text-slate-900 mt-1">{duplicateGroups.length}</div>
          <p className="text-xs text-slate-400 mt-0.5">Unique file contents duplicated</p>
        </div>

        <div className="card p-4">
          <span className="text-xs font-semibold text-slate-500 uppercase">Redundant Copies</span>
          <div className="text-2xl font-extrabold text-[#C49A70] mt-1">{totalDuplicateCopies}</div>
          <p className="text-xs text-slate-400 mt-0.5">Files safe to remove</p>
        </div>

        <div className="card p-4">
          <span className="text-xs font-semibold text-slate-500 uppercase">Reclaimable Space</span>
          <div className="text-2xl font-extrabold text-[#7FA080] mt-1">{formatBytes(totalWastedBytes)}</div>
          <p className="text-xs text-slate-400 mt-0.5">Space wasted by extra copies</p>
        </div>
      </div>

      {/* Duplicates List */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#7CA7A6]"></div>
        </div>
      ) : duplicateGroups.length === 0 ? (
        <div className="card p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-[#7FA080]/15 text-[#7FA080] flex items-center justify-center mx-auto">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-slate-800 text-base">Zero Duplicates Detected</h3>
          <p className="text-sm text-slate-500 max-w-sm mx-auto">
            All stored files have unique SHA-256 hashes. Your file vault is 100% clean and optimized.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {duplicateGroups.map((group, groupIdx) => (
            <div key={group.hash} className="card overflow-hidden">
              <div className="bg-slate-50/80 px-5 py-3 border-b border-[#ECE6DE] flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-md bg-[#C49A70]/20 text-[#82552B] font-bold text-xs flex items-center justify-center">
                    {groupIdx + 1}
                  </span>
                  <span className="text-xs font-mono text-slate-600 font-semibold truncate max-w-xs md:max-w-md">
                    SHA-256: {group.hash}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="font-semibold text-slate-700">
                    {group.count} Identical Copies ({formatBytes(group.file_size)} each)
                  </span>
                  <span className="px-2 py-0.5 rounded bg-[#C49A70]/20 text-[#82552B] font-bold">
                    {formatBytes(group.wasted_size)} Wasted
                  </span>
                </div>
              </div>

              <div className="divide-y divide-slate-100">
                {group.files.map((file, idx) => {
                  const badge = getCategoryBadgeColor(file.category);
                  const isOriginal = idx === 0;

                  return (
                    <div
                      key={file.id}
                      className={`p-4 flex items-center justify-between transition-colors ${
                        isOriginal ? 'bg-[#7FA080]/15/20' : 'hover:bg-slate-50/60'
                      }`}
                    >
                      <div className="flex items-center gap-3 truncate max-w-md">
                        <Copy className={`w-4 h-4 shrink-0 ${isOriginal ? 'text-[#7FA080]' : 'text-slate-400'}`} />
                        <div className="truncate">
                          <div className="font-semibold text-slate-800 text-sm truncate flex items-center gap-2">
                            <span>{file.original_name}</span>
                            {isOriginal ? (
                              <span className="px-1.5 py-0.5 rounded text-[10px] uppercase font-bold bg-[#7FA080]/20 text-[#3F6241]">
                                Original (Earliest)
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded text-[10px] uppercase font-bold bg-[#C49A70]/20 text-[#82552B]">
                                Duplicate Copy
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-400 mt-0.5">
                            Uploaded: {formatDate(file.created_at)}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <span className={`hidden sm:inline-flex px-2 py-0.5 rounded text-xs font-medium border ${badge.bg} ${badge.text} ${badge.border}`}>
                          {file.category}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <a
                            href={getDownloadUrl(file.id)}
                            download={file.original_name}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-[#7CA7A6] hover:bg-[#F4EFEA]"
                            title="Download Copy"
                          >
                            <Download className="w-4 h-4" />
                          </a>
                          <button
                            onClick={() => handleDeleteSingle(file.id, file.original_name)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                            title="Delete this copy"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  Download,
  FileCheck,
  Copy,
  FolderTree,
  RotateCcw,
  AlertCircle,
  FileText,
  Layers,
  ChevronRight,
  ChevronDown,
  Trash2,
  HardDrive
} from 'lucide-react';
import { processBatchFiles, getBatchDownloadUrl } from '../api/client';
import { BatchProcessResult } from '../types';

export const BatchOrganizerPage: React.FC = () => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [removeDuplicates, setRemoveDuplicates] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BatchProcessResult | null>(null);
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({});

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const filesArray = Array.from(e.target.files);
      setSelectedFiles((prev) => [...prev, ...filesArray]);
      setError(null);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const filesArray = Array.from(e.dataTransfer.files);
      setSelectedFiles((prev) => [...prev, ...filesArray]);
      setError(null);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const removeSelectedFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const clearAllSelected = () => {
    setSelectedFiles([]);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleProcess = async () => {
    if (selectedFiles.length === 0) {
      setError('Please select or drop at least one file to organize.');
      return;
    }

    setProcessing(true);
    setError(null);
    try {
      const res = await processBatchFiles(selectedFiles, removeDuplicates);
      setResult(res);
      // Open all folders by default in tree
      const initialOpen: Record<string, boolean> = {};
      res.folders.forEach((f) => {
        initialOpen[f.subfolder] = true;
      });
      setOpenFolders(initialOpen);
    } catch (err: any) {
      setError(err.message || 'Failed to process files. Please check backend connection.');
    } finally {
      setProcessing(false);
    }
  };

  const handleReset = () => {
    setSelectedFiles([]);
    setResult(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const toggleFolder = (subfolder: string) => {
    setOpenFolders((prev) => ({
      ...prev,
      [subfolder]: !prev[subfolder],
    }));
  };

  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const totalSelectedSize = selectedFiles.reduce((acc, f) => acc + f.size, 0);

  return (
    <div className="max-w-4xl mx-auto space-y-8 select-none py-4">
      {/* Page Title & Mission */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0f2952] tracking-tight">
          Batch File Organizer & Deduplicator
        </h1>
        <p className="text-sm text-slate-600 max-w-xl mx-auto leading-relaxed">
          Upload any <strong className="text-slate-900">N files</strong> at a time. The system
          detects and eliminates duplicate files using SHA-256 hashes, organizes unique files into
          smart subfolders, and generates a single downloadable ZIP archive.
        </p>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <span className="font-medium">{error}</span>
        </div>
      )}

      {/* Main Container */}
      {!result ? (
        <div className="space-y-6">
          {/* Minimalist Dropzone */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            className="border-2 border-dashed border-slate-300 hover:border-[#0f2952] rounded-2xl p-8 sm:p-12 text-center bg-white transition-all cursor-pointer shadow-sm group"
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              multiple
              className="hidden"
            />
            <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-200 text-[#0f2952] mx-auto flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
              <UploadCloud className="w-7 h-7" />
            </div>
            <div className="text-base font-bold text-slate-800">
              Drag and drop your batch of N files here
            </div>
            <p className="text-xs text-slate-500 mt-1">
              or <span className="text-[#0f2952] font-semibold underline">browse files from your computer</span>
            </p>
            <p className="text-[11px] text-slate-400 mt-3">
              Supports documents, PDF, images, audio, video, code, archives & any mixed file types
            </p>
          </div>

          {/* Staged File List */}
          {selectedFiles.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-slate-800">
                    Selected Batch: {selectedFiles.length} files
                  </span>
                  <span className="text-xs text-slate-500">
                    ({formatSize(totalSelectedSize)})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={clearAllSelected}
                  className="text-xs text-rose-600 hover:text-rose-700 font-medium flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear List</span>
                </button>
              </div>

              {/* Scrollable list */}
              <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
                {selectedFiles.map((file, idx) => (
                  <div
                    key={`${file.name}-${idx}`}
                    className="p-2 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="font-medium text-slate-700 truncate">{file.name}</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-2">
                      <span className="text-slate-400">{formatSize(file.size)}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeSelectedFile(idx);
                        }}
                        className="text-slate-400 hover:text-rose-600 p-0.5"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Processing Options */}
              <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs border-t border-slate-100">
                <label className="flex items-center gap-2 cursor-pointer select-none text-slate-700 font-medium">
                  <input
                    type="checkbox"
                    checked={removeDuplicates}
                    onChange={(e) => setRemoveDuplicates(e.target.checked)}
                    className="rounded text-[#0f2952] focus:ring-[#0f2952]"
                  />
                  <span>Automatically purge exact duplicate files (SHA-256)</span>
                </label>
              </div>

              {/* Action Button */}
              <button
                type="button"
                onClick={handleProcess}
                disabled={processing}
                className="w-full py-3 px-4 rounded-xl bg-[#0f2952] hover:bg-[#1a3a6b] text-white font-bold text-sm shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {processing ? (
                  <span>Analyzing, Deduplicating & Packaging...</span>
                ) : (
                  <>
                    <Layers className="w-4 h-4" />
                    <span>Organize & Deduplicate {selectedFiles.length} Files →</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      ) : (
        /* Results View */
        <div className="space-y-6 animate-in fade-in duration-200">
          
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-xl bg-white border border-slate-200 text-center shadow-sm">
              <div className="text-2xl font-black text-[#0f2952]">{result.total_files}</div>
              <div className="text-xs font-semibold text-slate-500 mt-0.5">Input Files</div>
            </div>

            <div className="p-4 rounded-xl bg-white border border-slate-200 text-center shadow-sm">
              <div className="text-2xl font-black text-emerald-600">{result.unique_files_count}</div>
              <div className="text-xs font-semibold text-slate-500 mt-0.5">Unique Files Kept</div>
            </div>

            <div className="p-4 rounded-xl bg-white border border-slate-200 text-center shadow-sm">
              <div className="text-2xl font-black text-rose-600">{result.duplicates_removed_count}</div>
              <div className="text-xs font-semibold text-slate-500 mt-0.5">Duplicates Purged</div>
            </div>

            <div className="p-4 rounded-xl bg-white border border-slate-200 text-center shadow-sm">
              <div className="text-2xl font-black text-indigo-600">{formatSize(result.wasted_bytes_saved)}</div>
              <div className="text-xs font-semibold text-slate-500 mt-0.5">Disk Space Saved</div>
            </div>
          </div>

          {/* Primary Action: Download Single Output ZIP File */}
          <div className="p-6 rounded-2xl bg-[#0f2952] text-white shadow-md flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold">Your Organized Files Are Ready</h3>
              <p className="text-xs text-slate-200 mt-1">
                All {result.unique_files_count} unique files sorted into {result.folders.length} subfolders in a single package.
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <a
                href={getBatchDownloadUrl(result.session_id)}
                download="Organized_Files.zip"
                className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm shadow-md transition-all flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                <span>Download Organized ZIP</span>
              </a>

              <button
                onClick={handleReset}
                className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-colors"
                title="Process another batch"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Organized Subfolder Structure Preview */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h4 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                <FolderTree className="w-4 h-4 text-[#0f2952]" />
                <span>Organized Folder Tree Preview</span>
              </h4>
              <span className="text-xs text-slate-500 font-medium">
                {result.folders.length} Subfolders
              </span>
            </div>

            <div className="space-y-2">
              {result.folders.map((folder) => {
                const isOpen = openFolders[folder.subfolder] ?? true;
                return (
                  <div key={folder.subfolder} className="border border-slate-200 rounded-xl overflow-hidden">
                    <button
                      onClick={() => toggleFolder(folder.subfolder)}
                      className="w-full p-3 bg-slate-50 hover:bg-slate-100/70 flex items-center justify-between text-left transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        {isOpen ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                        <span className="font-bold text-xs text-[#0f2952]">📁 {folder.subfolder}</span>
                        <span className="text-[11px] text-slate-500">({folder.count} files)</span>
                      </div>
                      <span className="text-xs text-slate-400 font-mono">{formatSize(folder.total_size)}</span>
                    </button>

                    {isOpen && (
                      <div className="p-3 bg-white space-y-1.5 border-t border-slate-100">
                        {folder.files.map((file, fIdx) => (
                          <div key={fIdx} className="flex items-center justify-between text-xs py-1 px-2 rounded hover:bg-slate-50">
                            <div className="flex items-center gap-2 truncate">
                              <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="text-slate-700 truncate">{file.name}</span>
                            </div>
                            <span className="text-slate-400 font-mono shrink-0 ml-2">{formatSize(file.size)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Duplicate Purge Report (Proof of deduplication) */}
          {result.duplicate_files.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h4 className="font-bold text-sm text-rose-700 flex items-center gap-2">
                  <Copy className="w-4 h-4" />
                  <span>Exact Duplicates Purged ({result.duplicate_files.length})</span>
                </h4>
                <span className="text-xs text-slate-500 font-medium">
                  {formatSize(result.wasted_bytes_saved)} space reclaimed
                </span>
              </div>

              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {result.duplicate_files.map((dup, dIdx) => (
                  <div
                    key={dIdx}
                    className="p-2.5 rounded-lg bg-rose-50/50 border border-rose-100 flex items-center justify-between text-xs text-rose-900"
                  >
                    <div className="truncate">
                      <span className="font-semibold line-through text-slate-500 mr-2">{dup.original_name}</span>
                      <span className="text-emerald-700 text-[11px]">→ Duplicate of {dup.duplicate_of}</span>
                    </div>
                    <span className="font-mono text-slate-500 shrink-0 ml-2">-{formatSize(dup.file_size)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bottom Action to Reset and Process Another Batch */}
          <div className="text-center pt-2">
            <button
              onClick={handleReset}
              className="px-6 py-2.5 rounded-xl border border-slate-300 hover:border-slate-400 text-slate-700 text-xs font-bold transition-colors inline-flex items-center gap-2 shadow-sm bg-white"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Process Another Batch of N Files</span>
            </button>
          </div>

        </div>
      )}
    </div>
  );
};

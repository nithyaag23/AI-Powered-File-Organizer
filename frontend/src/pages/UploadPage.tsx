import React, { useState, useRef } from 'react';
import { UploadCloud, CheckCircle2, AlertTriangle, File, X, Loader2, ArrowRight } from 'lucide-react';
import { uploadFiles } from '../api/client';
import { formatBytes } from '../utils/formatters';
import { FileItem } from '../types';
import { PageId } from '../components/Sidebar';

interface UploadPageProps {
  onUploadSuccess: () => void;
  onNavigate: (page: PageId) => void;
}

export const UploadPage: React.FC<UploadPageProps> = ({ onUploadSuccess, onNavigate }) => {
  const [dragOver, setDragOver] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadedResults, setUploadedResults] = useState<FileItem[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(Array.from(e.target.files));
    }
  };

  const addFiles = (newFiles: File[]) => {
    setSelectedFiles((prev) => [...prev, ...newFiles]);
    setErrorMsg(null);
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const startUpload = async () => {
    if (selectedFiles.length === 0) return;
    setUploading(true);
    setErrorMsg(null);
    try {
      const res = await uploadFiles(selectedFiles);
      setUploadedResults(res.files);
      setSelectedFiles([]);
      onUploadSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to upload files to backend.');
    } finally {
      setUploading(false);
    }
  };

  const duplicateUploaded = uploadedResults.filter((f) => f.is_duplicate);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Upload Local Files</h1>
        <p className="text-slate-500 text-sm mt-0.5">
          Drag and drop files to automatically categorize, compute SHA-256 hashes, and index for semantic search
        </p>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Drag & Drop Box */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleFileDrop}
        className={`card p-10 border-2 border-dashed text-center transition-all ${
          dragOver ? 'border-blue-500 bg-blue-50/50' : 'border-slate-300 hover:border-slate-400'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileInput}
        />
        <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-4">
          <UploadCloud className="w-7 h-7" />
        </div>
        <h3 className="text-base font-bold text-slate-800">Drag & Drop files here</h3>
        <p className="text-xs text-slate-500 mt-1">
          Supports Documents (PDF, DOCX, TXT), Images, Videos, Audio, and ZIP Archives
        </p>
        <div className="mt-5">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="btn-primary"
          >
            Browse Files from Computer
          </button>
        </div>
      </div>

      {/* Selected Files Queue */}
      {selectedFiles.length > 0 && (
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="font-bold text-slate-800 text-sm">
              Ready to Upload ({selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''})
            </h3>
            <button
              onClick={() => setSelectedFiles([])}
              className="text-xs text-slate-400 hover:text-rose-600 transition-colors"
            >
              Clear All
            </button>
          </div>

          <div className="max-h-60 overflow-y-auto space-y-2">
            {selectedFiles.map((file, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200/60 text-sm"
              >
                <div className="flex items-center gap-3 truncate">
                  <File className="w-4 h-4 text-blue-600 shrink-0" />
                  <span className="font-medium text-slate-800 truncate">{file.name}</span>
                  <span className="text-xs text-slate-400">{formatBytes(file.size)}</span>
                </div>
                <button
                  onClick={() => removeFile(idx)}
                  className="p-1 text-slate-400 hover:text-rose-600 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <div className="pt-2 flex justify-end">
            <button
              onClick={startUpload}
              disabled={uploading}
              className="btn-primary px-6"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Uploading & Hashing...
                </>
              ) : (
                <>
                  <UploadCloud className="w-4 h-4" />
                  Upload {selectedFiles.length} File{selectedFiles.length > 1 ? 's' : ''}
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Upload Results Summary */}
      {uploadedResults.length > 0 && (
        <div className="card p-5 space-y-4 border-emerald-200 bg-emerald-50/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm">
              <CheckCircle2 className="w-5 h-5" />
              <span>Successfully uploaded {uploadedResults.length} file{uploadedResults.length > 1 ? 's' : ''}!</span>
            </div>
            <button
              onClick={() => onNavigate('all-files')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              View in All Files <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {duplicateUploaded.length > 0 && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  {duplicateUploaded.length} of the uploaded file{duplicateUploaded.length > 1 ? 's are' : ' is an'} exact duplicate!
                </span>
              </div>
              <button
                onClick={() => onNavigate('duplicates')}
                className="font-bold underline ml-2 text-amber-900"
              >
                Inspect Duplicates
              </button>
            </div>
          )}

          <div className="divide-y divide-slate-100 text-xs">
            {uploadedResults.map((f) => (
              <div key={f.id} className="py-2.5 flex items-center justify-between">
                <div>
                  <span className="font-semibold text-slate-800">{f.original_name}</span>
                  <span className="ml-2 px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                    {f.category}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-slate-500 font-mono">SHA-256: {f.file_hash.substring(0, 10)}…</span>
                  <span className="text-slate-600 font-semibold">{formatBytes(f.file_size)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

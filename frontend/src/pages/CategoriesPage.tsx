import React, { useState, useEffect } from 'react';
import {
  FileText,
  Image as ImageIcon,
  Film,
  Music,
  Archive,
  Folder,
  FolderOpen,
  Download,
  Trash2,
  HardDrive,
  Files,
  Sparkles,
  ArrowRight,
  Package
} from 'lucide-react';
import { fetchFiles, deleteFile, getDownloadUrl, getOrganizedZipUrl, reorganizeFiles } from '../api/client';
import { CategoryName, FileItem, DashboardStats, SubfolderStat } from '../types';
import { formatBytes, formatDate, getCategoryBadgeColor } from '../utils/formatters';

interface CategoriesPageProps {
  stats: DashboardStats | null;
  onRefreshStats: () => void;
}

const CATEGORY_CONFIG: {
  id: CategoryName;
  name: string;
  icon: React.FC<{ className?: string }>;
  description: string;
}[] = [
  { id: 'Documents', name: 'Documents', icon: FileText, description: 'PDF, DOCX, Coursework, Presentations, Notes' },
  { id: 'Images', name: 'Images', icon: ImageIcon, description: 'PNG, JPG, SVG, WebP, Graphics & Assets' },
  { id: 'Videos', name: 'Videos', icon: Film, description: 'MP4, MKV, MOV, WebM Recordings' },
  { id: 'Audio', name: 'Audio', icon: Music, description: 'MP3, WAV, Podcasts & Audio' },
  { id: 'Archives', name: 'Archives', icon: Archive, description: 'ZIP, TAR, GZ, Compressed packages' },
  { id: 'Other', name: 'Other', icon: Folder, description: 'Code scripts, system binaries' },
];

export const CategoriesPage: React.FC<CategoriesPageProps> = ({ stats, onRefreshStats }) => {
  const [selectedCategory, setSelectedCategory] = useState<CategoryName | 'All'>('All');
  const [selectedSubfolder, setSelectedSubfolder] = useState<string | null>(null);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [reorganizing, setReorganizing] = useState(false);

  const loadCategoryFiles = async () => {
    setLoading(true);
    try {
      const data = await fetchFiles({
        category: selectedCategory === 'All' ? undefined : selectedCategory,
        subfolder: selectedSubfolder || undefined,
      });
      setFiles(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategoryFiles();
  }, [selectedCategory, selectedSubfolder]);

  const handleReorganize = async () => {
    setReorganizing(true);
    try {
      await reorganizeFiles();
      await loadCategoryFiles();
      onRefreshStats();
    } catch (err: any) {
      alert(err.message || 'Failed to reorganize files');
    } finally {
      setReorganizing(false);
    }
  };

  const handleDelete = async (fileId: string, name: string) => {
    if (window.confirm(`Delete "${name}"?`)) {
      try {
        await deleteFile(fileId);
        setFiles((prev) => prev.filter((f) => f.id !== fileId));
        onRefreshStats();
      } catch (err: any) {
        alert(err.message || 'Failed to delete file');
      }
    }
  };

  const subfoldersList: SubfolderStat[] = stats?.subfolders ?? [];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header and Download Organized ZIP Button */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">AI Folders & Categories</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Files automatically analyzed and grouped into smart academic, event, and media folders
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleReorganize}
            disabled={reorganizing}
            className="btn-secondary"
            title="Re-run AI topic classification"
          >
            <Sparkles className={`w-4 h-4 text-blue-600 ${reorganizing ? 'animate-spin' : ''}`} />
            {reorganizing ? 'Organizing...' : 'Re-Run AI Sort'}
          </button>

          <a
            href={getOrganizedZipUrl()}
            className="btn-primary"
            title="Download ZIP with all files structured into folders"
          >
            <Package className="w-4 h-4" />
            Download Organized ZIP
          </a>
        </div>
      </div>

      {/* Smart Subfolder Explorer Bar */}
      {subfoldersList.length > 0 && (
        <div className="card p-5 bg-gradient-to-r from-blue-50/60 via-slate-50 to-indigo-50/40 border-blue-200/70 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                AI Detected Folder Hierarchy
              </span>
            </div>
            {selectedSubfolder && (
              <button
                onClick={() => setSelectedSubfolder(null)}
                className="text-xs font-semibold text-blue-600 hover:underline"
              >
                Clear Folder Filter (Show All)
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
            {subfoldersList.map((sf) => {
              const isSelected = selectedSubfolder === sf.subfolder;
              return (
                <button
                  key={sf.subfolder}
                  onClick={() => setSelectedSubfolder(isSelected ? null : sf.subfolder)}
                  className={`flex items-center justify-between p-3 rounded-xl border text-left transition-all ${
                    isSelected
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                      : 'bg-white hover:bg-slate-50 border-slate-200/90 text-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <Folder className={`w-4 h-4 shrink-0 ${isSelected ? 'text-white' : 'text-blue-600'}`} />
                    <div className="truncate">
                      <div className="font-bold text-xs truncate leading-snug">{sf.subfolder}</div>
                      <div className={`text-[11px] truncate ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>
                        {formatBytes(sf.size)}
                      </div>
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-bold ml-2 ${
                    isSelected ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {sf.count} file{sf.count > 1 ? 's' : ''}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Categories Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => {
            setSelectedCategory('All');
            setSelectedSubfolder(null);
          }}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
            selectedCategory === 'All' && !selectedSubfolder
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          All Vaults
        </button>

        {CATEGORY_CONFIG.map((cat) => {
          const Icon = cat.icon;
          const stat = stats?.categories?.[cat.id] ?? { count: 0, size: 0 };
          const isSelected = selectedCategory === cat.id;

          return (
            <button
              key={cat.id}
              onClick={() => {
                setSelectedCategory(cat.id);
                setSelectedSubfolder(null);
              }}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 ${
                isSelected
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{cat.name}</span>
              <span className={`px-1.5 py-0.2 rounded-md text-[10px] ${
                isSelected ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-500'
              }`}>
                {stat.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Files List in Category / Subfolder */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[250px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : files.length === 0 ? (
        <div className="card p-12 text-center space-y-2">
          <Folder className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="font-bold text-slate-700">No files found</h3>
          <p className="text-xs text-slate-400">
            {selectedSubfolder ? `No files in "${selectedSubfolder}"` : 'Upload files to populate this folder.'}
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/80 border-b border-slate-200/80 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3">Organized Name & Topic</th>
                  <th className="px-5 py-3">AI Subfolder</th>
                  <th className="px-5 py-3">Category</th>
                  <th className="px-5 py-3">Size</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {files.map((file) => {
                  const badge = getCategoryBadgeColor(file.category);

                  return (
                    <tr key={file.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="font-bold text-slate-900 text-sm">
                          {file.clean_name || file.original_name}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
                            {file.topic || 'General'}
                          </span>
                          {file.original_name !== file.clean_name && (
                            <span className="text-[11px] text-slate-400 truncate max-w-xs">
                              Original: {file.original_name}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-semibold bg-slate-100 text-slate-700">
                          <Folder className="w-3 h-3 text-blue-500" />
                          {file.subfolder || 'General'}
                        </span>
                      </td>

                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${badge.bg} ${badge.text} ${badge.border}`}>
                          {file.category}
                        </span>
                      </td>

                      <td className="px-5 py-3.5 font-medium text-slate-600">{formatBytes(file.file_size)}</td>

                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <a
                            href={getDownloadUrl(file.id)}
                            download={file.clean_name || file.original_name}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                            title="Download with Clean Name"
                          >
                            <Download className="w-4 h-4" />
                          </a>
                          <button
                            onClick={() => handleDelete(file.id, file.original_name)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

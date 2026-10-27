import React from 'react';
import {
  Files,
  Copy,
  HardDrive,
  Sparkles,
  ArrowUpRight,
  UploadCloud,
  FileText,
  Image as ImageIcon,
  Film,
  Music,
  Archive,
  Folder,
  FolderOpen,
  Download,
  Trash2,
  Package
} from 'lucide-react';
import { DashboardStats, CategoryName, FileItem } from '../types';
import { formatBytes, formatDate, getCategoryBadgeColor } from '../utils/formatters';
import { PageId } from '../components/Sidebar';
import { getDownloadUrl, getOrganizedZipUrl } from '../api/client';

interface DashboardPageProps {
  stats: DashboardStats | null;
  loading: boolean;
  onNavigate: (page: PageId) => void;
  onDeleteFile: (fileId: string) => void;
}

const CATEGORY_ICONS: Record<CategoryName, React.FC<{ className?: string }>> = {
  Documents: FileText,
  Images: ImageIcon,
  Videos: Film,
  Audio: Music,
  Archives: Archive,
  Other: Folder,
};

export const DashboardPage: React.FC<DashboardPageProps> = ({
  stats,
  loading,
  onNavigate,
  onDeleteFile,
}) => {
  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#7CA7A6]"></div>
      </div>
    );
  }

  const totalFiles = stats?.total_files ?? 0;
  const totalSize = stats?.total_size ?? 0;
  const duplicateCount = stats?.duplicate_files_count ?? 0;
  const duplicateWasted = stats?.duplicate_wasted_size ?? 0;
  const categories = stats?.categories ?? {
    Documents: { count: 0, size: 0 },
    Images: { count: 0, size: 0 },
    Videos: { count: 0, size: 0 },
    Audio: { count: 0, size: 0 },
    Archives: { count: 0, size: 0 },
    Other: { count: 0, size: 0 },
  };
  const subfolders = stats?.subfolders ?? [];
  const recentFiles = stats?.recent_files ?? [];

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Dashboard</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Real-time local file statistics, duplicate detection, and smart folder organization
          </p>
        </div>
        <div className="flex items-center gap-3">
          {totalFiles > 0 && (
            <a href={getOrganizedZipUrl()} className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#7FA080] hover:bg-[#6E936F] text-white font-semibold text-sm shadow-xs transition-all" title="Download all files neatly sorted into folders">
              <Package className="w-4 h-4 text-[#7CA7A6]" />
              Download Organized ZIP
            </a>
          )}
          <button onClick={() => onNavigate('upload')} className="btn-primary">
            <UploadCloud className="w-4 h-4" />
            Upload Files
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Files */}
        <div className="card p-5 card-hover">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Files</span>
            <div className="w-9 h-9 rounded-xl bg-[#7CA7A6]/15 text-[#7CA7A6] flex items-center justify-center">
              <Files className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-extrabold text-slate-900">{totalFiles.toLocaleString()}</div>
            <p className="text-xs text-slate-400 mt-1">Organized in local vault</p>
          </div>
        </div>

        {/* Duplicate Files */}
        <div className="card p-5 card-hover">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Duplicate Files</span>
            <div className="w-9 h-9 rounded-xl bg-[#B8748C]/15 text-[#B8748C] flex items-center justify-center">
              <Copy className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-extrabold text-[#B8748C]">{duplicateCount.toLocaleString()}</div>
            <p className="text-xs text-slate-400 mt-1">
              {duplicateWasted > 0 ? `${formatBytes(duplicateWasted)} reclaimable` : 'No wasted space'}
            </p>
          </div>
        </div>

        {/* Total Storage Used */}
        <div className="card p-5 card-hover">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Storage Used</span>
            <div className="w-9 h-9 rounded-xl bg-[#7FA080]/15 text-[#7FA080] flex items-center justify-center">
              <HardDrive className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-extrabold text-slate-900">{formatBytes(totalSize)}</div>
            <p className="text-xs text-slate-400 mt-1">Local disk allocation</p>
          </div>
        </div>

        {/* AI Folders Count */}
        <div className="card p-5 card-hover">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">AI Subfolders</span>
            <div className="w-9 h-9 rounded-xl bg-[#C49A70]/15 text-[#C49A70] flex items-center justify-center">
              <FolderOpen className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-extrabold text-[#C49A70]">{subfolders.length}</div>
            <p className="text-xs text-slate-400 mt-1">Topic folders created</p>
          </div>
        </div>
      </div>

      {/* AI Subfolder Structure Card */}
      {subfolders.length > 0 && (
        <div className="card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-[#7CA7A6]" />
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                AI Detected Subfolders
              </h2>
            </div>
            <button onClick={() => onNavigate('categories')} className="text-xs font-semibold text-[#7CA7A6] hover:underline flex items-center gap-1">
              Explore All Folders <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {subfolders.map((sf) => (
              <div
                key={sf.subfolder}
                onClick={() => onNavigate('categories')}
                className="flex items-center justify-between p-3 rounded-xl bg-[#FAF8F5] border border-[#ECE6DE] hover:bg-[#7CA7A6]/15/40 hover:border-[#7CA7A6]/30 cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-2.5 truncate">
                  <Folder className="w-4 h-4 text-[#7CA7A6] shrink-0" />
                  <div className="truncate">
                    <span className="font-bold text-xs text-slate-800">{sf.subfolder}</span>
                    <span className="block text-[11px] text-slate-400">{formatBytes(sf.size)}</span>
                  </div>
                </div>
                <span className="text-xs font-bold text-slate-600 bg-white px-2 py-0.5 rounded-full border border-[#ECE6DE]">
                  {sf.count}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* File Categories Breakdown */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">File Categories</h2>
          <button onClick={() => onNavigate('categories')} className="text-sm font-semibold text-[#7CA7A6] hover:text-[#689493] flex items-center gap-1">
            View All Categories <ArrowUpRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
          {(Object.keys(categories) as CategoryName[]).map((catName) => {
            const data = categories[catName];
            const Icon = CATEGORY_ICONS[catName] || Folder;
            const badge = getCategoryBadgeColor(catName);

            return (
              <div
                key={catName}
                onClick={() => onNavigate('categories')}
                className="card p-4 card-hover cursor-pointer flex flex-col justify-between"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className={`w-8 h-8 rounded-lg ${badge.bg} ${badge.text} flex items-center justify-center`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold text-slate-400">{data.count}</span>
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">{catName}</h3>
                  <p className="text-xs text-slate-500 mt-0.5 font-medium">{formatBytes(data.size)}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Files Table */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Recent Files</h2>
          <button onClick={() => onNavigate('all-files')} className="text-sm font-semibold text-[#7CA7A6] hover:text-[#689493] flex items-center gap-1">
            Browse All Files <ArrowUpRight className="w-4 h-4" />
          </button>
        </div>

        {recentFiles.length === 0 ? (
          <div className="card p-10 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-[#7CA7A6]/15 text-[#7CA7A6] flex items-center justify-center mx-auto">
              <UploadCloud className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-800">No files uploaded yet</h3>
            <p className="text-sm text-slate-500 max-w-sm mx-auto">
              Drop your documents, images, or archives to see live AI organization in action.
            </p>
            <button onClick={() => onNavigate('upload')} className="btn-primary mt-2">
              Upload Files Now
            </button>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#FAF8F5]/80 border-b border-[#ECE6DE] text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3">Clean Name & Topic</th>
                    <th className="px-5 py-3">AI Subfolder</th>
                    <th className="px-5 py-3">Category</th>
                    <th className="px-5 py-3">Size</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentFiles.map((f: FileItem) => {
                    const badge = getCategoryBadgeColor(f.category);
                    return (
                      <tr key={f.id} className="hover:bg-[#FAF8F5]/60 transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="font-bold text-slate-900 truncate max-w-sm">
                            {f.clean_name || f.original_name}
                          </div>
                          <div className="text-xs text-[#7CA7A6] font-medium">
                            {f.topic || 'General'}
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-mono font-medium bg-slate-100 text-slate-700">
                            <Folder className="w-3 h-3 text-[#7CA7A6]" />
                            {f.subfolder || 'General'}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${badge.bg} ${badge.text} ${badge.border}`}>
                            {f.category}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-slate-600 font-medium">{formatBytes(f.file_size)}</td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <a
                              href={getDownloadUrl(f.id)}
                              download={f.clean_name || f.original_name}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-[#7CA7A6] hover:bg-[#7CA7A6]/15 transition-colors"
                              title="Download"
                            >
                              <Download className="w-4 h-4" />
                            </a>
                            <button
                              onClick={() => onDeleteFile(f.id)}
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
    </div>
  );
};

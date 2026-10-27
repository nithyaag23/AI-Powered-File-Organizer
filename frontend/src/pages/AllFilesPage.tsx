import React, { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  Download,
  Trash2,
  Folder,
  ArrowUpDown,
  Package,
  Tag
} from 'lucide-react';
import { fetchFiles, deleteFile, getDownloadUrl, getOrganizedZipUrl } from '../api/client';
import { FileItem, CategoryName } from '../types';
import { formatBytes, formatDate, getCategoryBadgeColor } from '../utils/formatters';

interface AllFilesPageProps {
  onRefreshStats: () => void;
}

const CATEGORIES: (CategoryName | 'All')[] = [
  'All',
  'Documents',
  'Images',
  'Videos',
  'Audio',
  'Archives',
  'Other',
];

export const AllFilesPage: React.FC<AllFilesPageProps> = ({ onRefreshStats }) => {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<CategoryName | 'All'>('All');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  const loadFiles = async () => {
    setLoading(true);
    try {
      const data = await fetchFiles({
        category: selectedCategory === 'All' ? undefined : selectedCategory,
        search: search.trim() || undefined,
        sortBy,
        sortOrder,
      });
      setFiles(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Debounced search on keystroke
  useEffect(() => {
    const timer = setTimeout(() => {
      loadFiles();
    }, 200);
    return () => clearTimeout(timer);
  }, [search, selectedCategory, sortBy, sortOrder]);

  const handleDelete = async (fileId: string, name: string) => {
    if (window.confirm(`Are you sure you want to permanently delete "${name}"?`)) {
      try {
        await deleteFile(fileId);
        setFiles((prev) => prev.filter((f) => f.id !== fileId));
        onRefreshStats();
      } catch (err: any) {
        alert(err.message || 'Failed to delete file');
      }
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">All Files</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Browse, filter, search, and manage your files with AI-suggested clean names and topics
          </p>
        </div>

        <div>
          <a
            href={getOrganizedZipUrl()}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#7FA080] hover:bg-[#6E936F] text-white font-semibold text-sm shadow-xs transition-all"
            title="Download ZIP with all files structured into folders"
          >
            <Package className="w-4 h-4" />
            Download Organized ZIP
          </a>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="card p-4 space-y-4">
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="relative w-full md:w-96">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Live search by filename, topic, or content..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 border border-[#ECE6DE] text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#7CA7A6]/20 focus:border-[#7CA7A6]"
            />
          </div>

          {/* Sort Controls */}
          <div className="flex items-center gap-2 w-full md:w-auto justify-end">
            <span className="text-xs text-slate-400 font-medium">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-slate-50 border border-[#ECE6DE] text-xs font-semibold text-slate-700 focus:outline-none"
            >
              <option value="created_at">Date Uploaded</option>
              <option value="clean_name">Clean Name</option>
              <option value="original_name">Original Name</option>
              <option value="subfolder">AI Subfolder</option>
              <option value="file_size">File Size</option>
              <option value="category">Category</option>
            </select>
            <button
              onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
              className="p-2 rounded-xl bg-slate-50 border border-[#ECE6DE] text-slate-600 hover:bg-slate-100"
              title={`Order: ${sortOrder.toUpperCase()}`}
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1" />
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all shrink-0 ${
                selectedCategory === cat
                  ? 'bg-[#7CA7A6] text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Files Table */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#7CA7A6]"></div>
        </div>
      ) : files.length === 0 ? (
        <div className="card p-12 text-center space-y-2">
          <Folder className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="font-bold text-slate-700">No files found</h3>
          <p className="text-xs text-slate-400">
            {search ? `No results matching "${search}"` : 'Try uploading files or selecting another category.'}
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/80 border-b border-[#ECE6DE]/80 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3">File & Topic</th>
                  <th className="px-5 py-3">Assigned Subfolder</th>
                  <th className="px-5 py-3">Category</th>
                  <th className="px-5 py-3">Size</th>
                  <th className="px-5 py-3">Date Added</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {files.map((file) => {
                  const badge = getCategoryBadgeColor(file.category);
                  return (
                    <tr key={file.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="font-bold text-slate-900 truncate max-w-sm">
                          {file.clean_name || file.original_name}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          {file.topic && (
                            <span className="text-[11px] font-semibold text-[#4F7350] bg-[#7FA080]/15 px-2 py-0.5 rounded-md">
                              {file.topic}
                            </span>
                          )}
                          {file.tags && file.tags.length > 0 && (
                            <div className="flex items-center gap-1">
                              {file.tags.slice(0, 2).map((t) => (
                                <span key={t} className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                  #{t}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>

                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-slate-100 text-slate-700">
                          <Folder className="w-3.5 h-3.5 text-[#7CA7A6]" />
                          {file.subfolder || 'General'}
                        </span>
                      </td>

                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${badge.bg} ${badge.text} ${badge.border}`}>
                          {file.category}
                        </span>
                      </td>

                      <td className="px-5 py-3.5 font-medium text-slate-600">{formatBytes(file.file_size)}</td>
                      <td className="px-5 py-3.5 text-xs text-slate-500">{formatDate(file.created_at)}</td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <a
                            href={getDownloadUrl(file.id)}
                            download={file.clean_name || file.original_name}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-[#7CA7A6] hover:bg-[#7FA080]/15 transition-colors"
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

import React, { useState } from 'react';
import {
  LayoutDashboard,
  UploadCloud,
  FolderOpen,
  Copy,
  Layers,
  Sparkles,
  Settings,
  HardDrive,
  Cpu,
  LogOut,
  Shield,
  User as UserIcon,
  Globe,
  Accessibility,
  ArrowLeft
} from 'lucide-react';
import { User } from '../types';
import { AccessibilityControls } from './AccessibilityControls';

export type PageId = 'batch-organizer' | 'dashboard' | 'upload' | 'all-files' | 'duplicates' | 'categories' | 'ai-search' | 'settings';

interface SidebarProps {
  currentPage: PageId;
  onNavigate: (page: PageId) => void;
  backendOnline: boolean;
  ollamaOnline: boolean;
  totalFiles: number;
  currentUser?: User | null;
  onLogout?: () => void;
  onGoToLanding?: () => void;
  onGoBack?: () => void;
  previousPageTitle?: string | null;
  canGoBack?: boolean;
  textSize?: string;
  setTextSize?: (size: string) => void;
  darkContrast?: boolean;
  setDarkContrast?: (val: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentPage,
  onNavigate,
  backendOnline,
  ollamaOnline,
  totalFiles,
  currentUser,
  onLogout,
  onGoToLanding,
  onGoBack,
  previousPageTitle,
  canGoBack = false,
  textSize = 'base',
  setTextSize,
  darkContrast = false,
  setDarkContrast,
}) => {
  const [showAccessibility, setShowAccessibility] = useState(false);

  const navItems = [
    { id: 'batch-organizer' as PageId, label: 'Batch Organizer (ZIP)', icon: Layers, badge: 'Main' },
    { id: 'dashboard' as PageId, label: 'Overview Vault', icon: LayoutDashboard },
    { id: 'all-files' as PageId, label: 'All Files', icon: FolderOpen },
    { id: 'duplicates' as PageId, label: 'Duplicates', icon: Copy },
    { id: 'categories' as PageId, label: 'Categories', icon: UploadCloud },
    { id: 'ai-search' as PageId, label: 'AI Search', icon: Sparkles, badge: 'AI' },
    { id: 'settings' as PageId, label: 'Settings', icon: Settings },
  ];

  const isAdmin = currentUser?.role === 'admin';

  return (
    <aside
      className={`w-64 flex flex-col h-screen sticky top-0 shrink-0 select-none border-r transition-colors duration-200 relative ${
        darkContrast
          ? 'bg-black text-white border-white/20'
          : 'bg-white text-slate-800 border-slate-200/90'
      }`}
    >
      {/* Brand Header */}
      <div
        className={`p-6 border-b flex items-center justify-between transition-colors ${
          darkContrast ? 'border-white/20' : 'border-slate-100'
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-md transition-colors ${
              darkContrast
                ? 'bg-white text-black shadow-white/10'
                : 'bg-blue-600 text-white shadow-blue-500/20'
            }`}
          >
            <HardDrive className="w-5 h-5" />
          </div>
          <div>
            <h1
              className={`font-bold text-base leading-tight transition-colors ${
                darkContrast ? 'text-white' : 'text-slate-900'
              }`}
            >
              FileOrganizer
            </h1>
            <p
              className={`text-xs font-semibold tracking-wide transition-colors ${
                darkContrast ? 'text-zinc-400' : 'text-blue-600'
              }`}
            >
              AI-POWERED
            </p>
          </div>
        </div>

        {/* Accessibility Toggle in Sidebar Header */}
        {setTextSize && setDarkContrast && (
          <button
            onClick={() => setShowAccessibility(!showAccessibility)}
            className={`p-1.5 rounded-lg border transition-colors shadow-sm ${
              darkContrast
                ? 'border-white/40 text-white bg-zinc-900 hover:bg-zinc-800'
                : 'border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
            title="Accessibility settings"
            aria-label="Accessibility settings"
          >
            <Accessibility className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
        {canGoBack && onGoBack && (
          <button
            onClick={onGoBack}
            className={`w-full flex items-center gap-2.5 px-3.5 py-2 mb-2 rounded-xl text-xs font-semibold border transition-all ${
              darkContrast
                ? 'border-white/20 text-zinc-300 hover:bg-zinc-900 hover:text-white'
                : 'border-slate-200 text-slate-700 bg-slate-50 hover:bg-slate-100 hover:text-slate-900 shadow-sm'
            }`}
            title={`Go back to ${previousPageTitle || 'previous page'}`}
          >
            <ArrowLeft className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="truncate">Back to {previousPageTitle || 'Previous'}</span>
          </button>
        )}
        <div
          className={`text-[11px] font-bold px-3 uppercase tracking-wider mb-2 ${
            darkContrast ? 'text-zinc-400' : 'text-slate-400'
          }`}
        >
          Navigation
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                isActive
                  ? darkContrast
                    ? 'bg-white text-black font-bold shadow-sm'
                    : 'bg-blue-50 text-blue-600 shadow-sm shadow-blue-100/50'
                  : darkContrast
                  ? 'text-zinc-300 hover:bg-zinc-900 hover:text-white'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon
                  className={`w-4 h-4 ${
                    isActive
                      ? darkContrast
                        ? 'text-black'
                        : 'text-blue-600'
                      : darkContrast
                      ? 'text-zinc-400'
                      : 'text-slate-400'
                  }`}
                />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span
                  className={`text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-md ${
                    darkContrast
                      ? 'bg-zinc-800 text-zinc-200'
                      : 'bg-blue-100 text-blue-700'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}

        {onGoToLanding && (
          <button
            onClick={onGoToLanding}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
              darkContrast
                ? 'text-zinc-300 hover:bg-zinc-900 hover:text-white'
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <Globe className="w-4 h-4 text-slate-400" />
            <span>View Landing Page</span>
          </button>
        )}
      </nav>

      {/* User Session Profile Card */}
      {currentUser && (
        <div className="px-4 pb-2">
          <div
            className={`p-3 rounded-2xl border flex items-center justify-between transition-colors ${
              darkContrast
                ? 'bg-zinc-950 border-white/20'
                : 'bg-slate-50 border-slate-200/90'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                  darkContrast
                    ? 'bg-zinc-800 text-white'
                    : isAdmin
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'bg-blue-100 text-blue-700'
                }`}
              >
                {isAdmin ? <Shield className="w-4 h-4" /> : <UserIcon className="w-4 h-4" />}
              </div>
              <div className="min-w-0">
                <div
                  className={`text-xs font-bold truncate ${
                    darkContrast ? 'text-white' : 'text-slate-900'
                  }`}
                >
                  {currentUser.email.split('@')[0]}
                </div>
                <div className="flex items-center gap-1">
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded ${
                      darkContrast
                        ? 'bg-zinc-800 text-zinc-300'
                        : isAdmin
                        ? 'bg-indigo-100 text-indigo-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}
                  >
                    {currentUser.role}
                  </span>
                </div>
              </div>
            </div>

            {onLogout && (
              <button
                onClick={onLogout}
                title="Log out"
                className={`p-1.5 rounded-lg transition-colors ${
                  darkContrast
                    ? 'text-zinc-400 hover:text-rose-400 hover:bg-zinc-800'
                    : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                }`}
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* System Status Summary Widget */}
      <div
        className={`p-4 m-4 mt-1 rounded-2xl border space-y-2 text-xs transition-colors ${
          darkContrast
            ? 'bg-zinc-950 border-white/20 text-zinc-300'
            : 'bg-slate-50 border-slate-200/80 text-slate-700'
        }`}
      >
        <div className="flex items-center justify-between font-semibold">
          <span className="flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-slate-400" />
            System Status
          </span>
          <span className={darkContrast ? 'text-zinc-400' : 'text-slate-500'}>{totalFiles} files</span>
        </div>

        <div
          className={`space-y-1.5 pt-1 border-t ${
            darkContrast ? 'border-white/10' : 'border-slate-200/60'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={darkContrast ? 'text-zinc-400' : 'text-slate-500'}>FastAPI Backend</span>
            <span className="flex items-center gap-1 font-medium">
              <span className={`w-2 h-2 rounded-full ${backendOnline ? 'bg-emerald-500' : 'bg-rose-500'}`} />
              <span className={backendOnline ? 'text-emerald-500 font-semibold' : 'text-rose-500 font-semibold'}>
                {backendOnline ? 'Online' : 'Offline'}
              </span>
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className={darkContrast ? 'text-zinc-400' : 'text-slate-500'}>Ollama AI</span>
            <span className="flex items-center gap-1 font-medium">
              <span className={`w-2 h-2 rounded-full ${ollamaOnline ? 'bg-emerald-500' : 'bg-amber-400'}`} />
              <span className={ollamaOnline ? 'text-emerald-500 font-semibold' : 'text-amber-500 font-semibold'}>
                {ollamaOnline ? 'Ready' : 'Local Standby'}
              </span>
            </span>
          </div>
        </div>
      </div>

      {/* Accessibility popup when opened from sidebar */}
      {setTextSize && setDarkContrast && (
        <AccessibilityControls
          isOpen={showAccessibility}
          onClose={() => setShowAccessibility(false)}
          textSize={textSize}
          setTextSize={setTextSize}
          darkContrast={darkContrast}
          setDarkContrast={setDarkContrast}
        />
      )}
    </aside>
  );
};

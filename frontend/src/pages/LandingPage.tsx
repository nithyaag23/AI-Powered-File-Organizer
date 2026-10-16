import React, { useState, useEffect } from 'react';
import {
  Shield,
  FolderOpen,
  ArrowRight,
  Accessibility,
  User as UserIcon,
  LogOut,
  ArrowLeft
} from 'lucide-react';
import { AuthModals, AuthModalType } from '../components/auth/AuthModals';
import { AccessibilityControls } from '../components/AccessibilityControls';
import { User } from '../types';

interface LandingPageProps {
  onLoginSuccess: (user: User, token: string) => void;
  backendOnline: boolean;
  totalFiles: number;
  currentUser?: User | null;
  onEnterWorkspace?: () => void;
  onLogout?: () => void;
  onGoBack?: () => void;
  canGoBack?: boolean;
  previousPageTitle?: string | null;
  textSize?: string;
  setTextSize?: (size: string) => void;
  darkContrast?: boolean;
  setDarkContrast?: (val: boolean) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onLoginSuccess,
  backendOnline,
  totalFiles,
  currentUser,
  onEnterWorkspace,
  onLogout,
  onGoBack,
  canGoBack = false,
  previousPageTitle,
  textSize: propTextSize,
  setTextSize: propSetTextSize,
  darkContrast: propDarkContrast,
  setDarkContrast: propSetDarkContrast,
}) => {
  const [activeModal, setActiveModal] = useState<AuthModalType>(null);
  const [showAccessibility, setShowAccessibility] = useState(false);

  // Text size state (synced with localStorage & root HTML font size)
  const [localTextSize, setLocalTextSize] = useState<string>(() => {
    try {
      return localStorage.getItem('accessibility_textSize') || 'base';
    } catch {
      return 'base';
    }
  });

  // Dark contrast state (synced with localStorage)
  const [localDarkContrast, setLocalDarkContrast] = useState<boolean>(() => {
    try {
      return localStorage.getItem('accessibility_darkContrast') === 'true';
    } catch {
      return false;
    }
  });

  const activeTextSize = propTextSize ?? localTextSize;
  const setActiveTextSize = propSetTextSize ?? setLocalTextSize;

  const activeDarkContrast = propDarkContrast ?? localDarkContrast;
  const setActiveDarkContrast = propSetDarkContrast ?? setLocalDarkContrast;

  // Real-time font size scaling across all rem-based Tailwind styles
  useEffect(() => {
    const scales: Record<string, string> = {
      sm: '13px',   // A-
      base: '16px', // A
      lg: '19.5px', // A+
      xl: '23px',   // A++
    };
    const size = scales[activeTextSize] || '16px';
    document.documentElement.style.setProperty('font-size', size, 'important');
    try {
      localStorage.setItem('accessibility_textSize', activeTextSize);
    } catch {}
  }, [activeTextSize]);

  // Persist dark contrast preference
  useEffect(() => {
    try {
      localStorage.setItem('accessibility_darkContrast', activeDarkContrast ? 'true' : 'false');
    } catch {}
  }, [activeDarkContrast]);

  const handleOpenModal = (type: AuthModalType) => {
    setActiveModal(type);
    setShowAccessibility(false);
  };

  return (
    <div
      className={`min-h-screen flex flex-col font-sans select-none transition-colors duration-200 ${
        activeDarkContrast ? 'bg-black text-white' : 'bg-white text-slate-800'
      }`}
    >
      {/* Top Navbar - Clean & Minimalist (No redundant duplicate auth buttons) */}
      <header
        className={`w-full py-3.5 px-6 md:px-12 flex items-center justify-between border-b relative z-40 transition-colors ${
          activeDarkContrast
            ? 'bg-black border-white/30 text-white'
            : 'bg-white border-slate-200 text-slate-800'
        }`}
      >
        {/* Left: Brand */}
        <div className="flex items-center gap-3">
          <div
            className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-colors ${
              activeDarkContrast
                ? 'border-white text-white bg-zinc-900'
                : 'border-slate-300 text-[#0f2952] bg-white'
            }`}
          >
            <Shield className="w-4 h-4" />
          </div>
          <div>
            <h1
              className={`font-bold text-sm md:text-base leading-tight transition-colors ${
                activeDarkContrast ? 'text-white' : 'text-[#0f2952]'
              }`}
            >
              FileOrganizer.ai
            </h1>
            <p
              className={`text-[11px] leading-none mt-0.5 transition-colors ${
                activeDarkContrast ? 'text-zinc-300' : 'text-slate-500'
              }`}
            >
              AI-Powered File Organizer
            </p>
          </div>
        </div>

        {/* Right: Back Button (if visited from workspace) + Accessibility Controls (+ Workspace / Sign Out if already logged in) */}
        <div className="flex items-center gap-2 sm:gap-3">
          {canGoBack && onGoBack && (
            <button
              onClick={onGoBack}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5 shadow-sm ${
                activeDarkContrast
                  ? 'border-white/40 text-white hover:bg-zinc-900'
                  : 'border-slate-300 text-slate-700 bg-white hover:bg-slate-50'
              }`}
              title={`Go back to ${previousPageTitle || 'Workspace'}`}
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to {previousPageTitle || 'Workspace'}</span>
            </button>
          )}

          {/* Universal Accessibility Button */}
          <button
            onClick={() => setShowAccessibility(!showAccessibility)}
            className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-colors shadow-sm ${
              activeDarkContrast
                ? 'border-2 border-white text-white bg-black hover:bg-zinc-800'
                : 'border border-slate-300 hover:border-slate-400 text-slate-800 bg-white hover:bg-slate-50'
            }`}
            title="Accessibility controls"
            aria-label="Accessibility controls"
          >
            <Accessibility className="w-4 h-4" />
          </button>

          {currentUser && onEnterWorkspace && (
            <div className="flex items-center gap-2">
              <button
                onClick={onEnterWorkspace}
                className={`px-4 py-1.5 rounded-lg text-xs sm:text-sm font-semibold shadow-sm transition-all flex items-center gap-2 ${
                  activeDarkContrast
                    ? 'bg-white text-black hover:bg-zinc-200 border-2 border-white font-bold'
                    : 'bg-[#0f2952] hover:bg-[#1a3a6b] text-white'
                }`}
              >
                <FolderOpen className="w-4 h-4" />
                <span>Open Workspace</span>
              </button>
              {onLogout && (
                <button
                  onClick={onLogout}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5 ${
                    activeDarkContrast
                      ? 'border-white/40 text-white hover:bg-zinc-900'
                      : 'border-slate-300 text-slate-700 hover:bg-slate-100'
                  }`}
                  title="Sign out of current account"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Accessibility controls popup */}
        <AccessibilityControls
          isOpen={showAccessibility}
          onClose={() => setShowAccessibility(false)}
          textSize={activeTextSize}
          setTextSize={setActiveTextSize}
          darkContrast={activeDarkContrast}
          setDarkContrast={setActiveDarkContrast}
        />
      </header>

      {/* Main Center Section - Spacious, Minimalistic & Elegant (Original clean layout) */}
      <main className="flex-1 flex flex-col items-center justify-center text-center px-4 py-16 md:py-24 max-w-3xl mx-auto w-full">
        {/* Project Title */}
        <h1
          className={`text-4xl sm:text-5xl md:text-6xl font-black tracking-tight transition-colors ${
            activeDarkContrast ? 'text-white' : 'text-[#0f2952]'
          }`}
        >
          FileOrganizer.ai
        </h1>

        {/* Project Subtitle */}
        <h2
          className={`text-xl sm:text-2xl font-bold mt-3 transition-colors ${
            activeDarkContrast ? 'text-zinc-100' : 'text-slate-900'
          }`}
        >
          AI-Powered File Organization System
        </h2>

        {/* Project Tagline */}
        <p
          className={`text-sm sm:text-base mt-2 max-w-xl mx-auto leading-relaxed transition-colors ${
            activeDarkContrast ? 'text-zinc-300' : 'text-slate-600'
          }`}
        >
          Intelligent, local-first file management with automatic subfolder categorization,
          SHA-256 duplicate elimination, and semantic natural language search.
        </p>

        {/* Sleek Center Divider Line */}
        <div
          className={`w-14 h-1 rounded-full mt-5 mb-8 transition-colors ${
            activeDarkContrast ? 'bg-white' : 'bg-[#0f2952]'
          }`}
        />

        {/* Clean, Non-Repetitive Action Buttons (Only shown here, not duplicated in navbar) */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          {currentUser && onEnterWorkspace ? (
            <div className="flex items-center gap-3">
              <button
                onClick={onEnterWorkspace}
                className={`inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold shadow-sm transition-all ${
                  activeDarkContrast
                    ? 'bg-white text-black hover:bg-zinc-200 border-2 border-white font-bold'
                    : 'bg-[#0f2952] hover:bg-[#1a3a6b] text-white'
                }`}
              >
                <FolderOpen className="w-4 h-4" />
                <span>Go to Workspace</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              {onLogout && (
                <button
                  onClick={onLogout}
                  className={`px-4 py-2.5 rounded-lg border text-sm font-semibold transition-all flex items-center gap-1.5 ${
                    activeDarkContrast
                      ? 'border-white text-white hover:bg-zinc-900'
                      : 'border-slate-300 hover:border-slate-400 bg-white text-slate-700'
                  }`}
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              )}
            </div>
          ) : (
            <>
              {/* 1. User: Create Account (Primary action) */}
              <button
                onClick={() => handleOpenModal('create-account')}
                className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold shadow-sm transition-all ${
                  activeDarkContrast
                    ? 'bg-white text-black hover:bg-zinc-200 border-2 border-white font-bold'
                    : 'bg-[#0f2952] hover:bg-[#1a3a6b] text-white'
                }`}
              >
                <span>Create Account</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              {/* 2. User: User Sign In (Standard user sign-in button) */}
              <button
                onClick={() => handleOpenModal('user-signin')}
                className={`inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg border text-sm font-semibold transition-all shadow-sm ${
                  activeDarkContrast
                    ? 'border-2 border-white bg-black text-white hover:bg-zinc-900 font-bold'
                    : 'border-slate-300 hover:border-slate-400 bg-white text-slate-800'
                }`}
              >
                <UserIcon className="w-4 h-4 text-slate-500" />
                <span>User Sign In</span>
              </button>

              {/* 3. Admin: Distinct Admin Login (Differentiated styling with Shield & Amber tint) */}
              <button
                onClick={() => handleOpenModal('admin-login')}
                className={`inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg border text-sm font-semibold transition-all shadow-sm ${
                  activeDarkContrast
                    ? 'border-2 border-amber-400 bg-black text-amber-300 hover:bg-zinc-900 font-bold'
                    : 'border-amber-300 bg-amber-50/70 hover:bg-amber-100 text-amber-900'
                }`}
              >
                <Shield className="w-4 h-4 text-amber-600" />
                <span>Admin Login</span>
              </button>
            </>
          )}
        </div>
      </main>

      {/* Footer - Clean Full Width Bar matching reference scheme */}
      <footer
        className={`w-full py-4 px-6 md:px-12 mt-auto border-t transition-colors ${
          activeDarkContrast
            ? 'bg-black border-white/20 text-white'
            : 'bg-[#0f2952] border-transparent text-white'
        }`}
      >
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-end justify-between gap-3 text-xs">
          {/* Useful links & copyright */}
          <div className="space-y-1.5">
            <div>
              <span
                className={`text-[11px] font-semibold block mb-0.5 ${
                  activeDarkContrast ? 'text-zinc-200' : 'text-slate-300'
                }`}
              >
                Useful links
              </span>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                <button
                  onClick={() => handleOpenModal('user-signin')}
                  className="hover:underline flex items-center gap-1 text-white"
                >
                  <span className={activeDarkContrast ? 'text-white' : 'text-slate-400'}>›</span> User Sign In
                </button>
                <button
                  onClick={() => handleOpenModal('create-account')}
                  className="hover:underline flex items-center gap-1 text-white"
                >
                  <span className={activeDarkContrast ? 'text-white' : 'text-slate-400'}>›</span> Create Account
                </button>
                <button
                  onClick={() => handleOpenModal('admin-login')}
                  className="hover:underline flex items-center gap-1 text-white"
                >
                  <span className={activeDarkContrast ? 'text-white' : 'text-slate-400'}>›</span> Admin Login
                </button>
                <button
                  onClick={() => alert('For password resets, contact support@fileorganizer.ai')}
                  className="hover:underline flex items-center gap-1 text-white"
                >
                  <span className={activeDarkContrast ? 'text-white' : 'text-slate-400'}>›</span> Forgot password
                </button>
                <button
                  onClick={() => alert('FileOrganizer.ai classifies documents into smart subfolders, detects exact duplicates, and supports semantic vector search.')}
                  className="hover:underline flex items-center gap-1 text-white"
                >
                  <span className={activeDarkContrast ? 'text-white' : 'text-slate-400'}>›</span> FAQ
                </button>
                <button
                  onClick={() => alert('Contact: support@fileorganizer.ai')}
                  className="hover:underline flex items-center gap-1 text-white"
                >
                  <span className={activeDarkContrast ? 'text-white' : 'text-slate-400'}>›</span> Contact us
                </button>
              </div>
            </div>

            <div className={`text-[11px] pt-0.5 ${activeDarkContrast ? 'text-zinc-400' : 'text-slate-300'}`}>
              &copy; 2026 FileOrganizer.ai. All rights reserved. 100% Local & Private.
            </div>
          </div>

          {/* Right Column: Status info */}
          <div className={`text-[11px] ${activeDarkContrast ? 'text-zinc-400' : 'text-slate-300'}`}>
            AI-Powered File Organizer Vault
          </div>
        </div>
      </footer>

      {/* Authentication Modals (Admin Login, User Sign In, Create Account) */}
      <AuthModals
        activeModal={activeModal}
        onClose={() => setActiveModal(null)}
        onAuthSuccess={onLoginSuccess}
        onSwitchModal={handleOpenModal}
      />
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import {
  Shield,
  FolderOpen,
  ArrowRight,
  Accessibility,
  User as UserIcon,
  LogOut,
  ArrowLeft,
  Sparkles,
  UserPlus
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
  initialModal?: AuthModalType;
  onClearInitialModal?: () => void;
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
  initialModal,
  onClearInitialModal,
  textSize: propTextSize,
  setTextSize: propSetTextSize,
  darkContrast: propDarkContrast,
  setDarkContrast: propSetDarkContrast,
}) => {
  const [activeModal, setActiveModal] = useState<AuthModalType>(initialModal || null);
  const [showAccessibility, setShowAccessibility] = useState(false);

  useEffect(() => {
    if (initialModal) {
      setActiveModal(initialModal);
      if (onClearInitialModal) onClearInitialModal();
    }
  }, [initialModal]);

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
        activeDarkContrast ? 'bg-black text-white' : 'bg-[#FAF8F5] text-slate-800'
      }`}
    >
      {/* Top Navbar */}
      <header
        className={`w-full py-3.5 px-6 md:px-12 flex items-center justify-between border-b relative z-40 transition-colors ${
          activeDarkContrast
            ? 'bg-black border-white/30 text-white'
            : 'bg-[#FAF8F5]/90 backdrop-blur-sm border-[#ECE6DE] text-slate-800'
        }`}
      >
        {/* Left: Brand */}
        <div className="flex items-center gap-3">
          <div
            className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-colors ${
              activeDarkContrast
                ? 'border-white text-white bg-zinc-900'
                : 'border-[#7FA080]/40 text-[#7FA080] bg-white shadow-xs'
            }`}
          >
            <Shield className="w-4 h-4" />
          </div>
          <div>
            <h1
              className={`font-bold text-sm md:text-base leading-tight transition-colors ${
                activeDarkContrast ? 'text-white' : 'text-slate-900'
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

        {/* Right: Back Button + Accessibility Controls (+ Workspace / Sign Out if already logged in) */}
        <div className="flex items-center gap-2 sm:gap-3">
          {canGoBack && onGoBack && (
            <button
              onClick={onGoBack}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5 shadow-sm ${
                activeDarkContrast
                  ? 'border-white/40 text-white hover:bg-zinc-900'
                  : 'border-[#ECE6DE] text-slate-700 bg-white hover:bg-[#F4EFEA]'
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
                : 'border border-[#ECE6DE] hover:border-slate-400 text-slate-800 bg-white hover:bg-[#F4EFEA]'
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
                    : 'bg-[#7CA7A6] hover:bg-[#689493] text-white'
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
                      : 'border-[#ECE6DE] text-slate-700 hover:bg-slate-100 bg-white'
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

      {/* Main Center Section - Spacious, Minimalist & Centered */}
      <main className="flex-1 flex flex-col items-center justify-center text-center px-4 py-12 sm:py-16 md:py-20 max-w-4xl mx-auto w-full my-auto">
        {/* Pill Badge with suitable muted green shade */}
        <div
          className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold mb-6 shadow-xs border transition-colors ${
            activeDarkContrast
              ? 'bg-zinc-900 border-zinc-700 text-zinc-200'
              : 'bg-[#7FA080]/15 border-[#7FA080]/40 text-[#355A36]'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-[#7FA080]" />
          <span>Intelligent Desktop File Organizer</span>
        </div>

        {/* Main Heading */}
        <h1
          className={`text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black tracking-tight leading-[1.18] transition-colors ${
            activeDarkContrast ? 'text-white' : 'text-slate-900'
          }`}
        >
          Organize, Deduplicate &amp;
          <br className="hidden sm:inline" /> Search Your Files with AI
        </h1>

        {/* Action Buttons Row: Enter Workspace, Create Account, User Sign In, Admin Login */}
        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 mt-8 sm:mt-10">
          {/* 1. Enter Workspace */}
          <button
            onClick={onEnterWorkspace}
            className={`inline-flex items-center gap-2 px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl text-sm font-semibold shadow-sm transition-all hover:shadow hover:-translate-y-0.5 active:translate-y-0 ${
              activeDarkContrast
                ? 'bg-white text-black hover:bg-zinc-200 border-2 border-white font-bold'
                : 'bg-[#7CA7A6] hover:bg-[#689493] text-white'
            }`}
          >
            <FolderOpen className="w-4 h-4" />
            <span>Enter Workspace</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          {/* 2. Create Account */}
          <button
            onClick={() => handleOpenModal('create-account')}
            className={`inline-flex items-center gap-2 px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl border text-sm font-semibold transition-all shadow-xs hover:shadow hover:-translate-y-0.5 active:translate-y-0 ${
              activeDarkContrast
                ? 'border-2 border-white bg-black text-white hover:bg-zinc-900 font-bold'
                : 'border-[#B8748C]/50 hover:border-[#B8748C] bg-white hover:bg-[#B8748C]/10 text-[#8C465D]'
            }`}
          >
            <UserPlus className="w-4 h-4 text-[#B8748C]" />
            <span>Create Account</span>
          </button>

          {/* 3. User Sign In */}
          <button
            onClick={() => handleOpenModal('user-signin')}
            className={`inline-flex items-center gap-2 px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl border text-sm font-semibold transition-all shadow-xs hover:shadow hover:-translate-y-0.5 active:translate-y-0 ${
              activeDarkContrast
                ? 'border-2 border-white bg-black text-white hover:bg-zinc-900 font-bold'
                : 'border-[#7FA080]/50 hover:border-[#7FA080] bg-white hover:bg-[#7FA080]/10 text-[#436444]'
            }`}
          >
            <UserIcon className="w-4 h-4 text-[#7FA080]" />
            <span>User Sign In</span>
          </button>

          {/* 4. Admin Login */}
          <button
            onClick={() => handleOpenModal('admin-login')}
            className={`inline-flex items-center gap-2 px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl border text-sm font-semibold transition-all shadow-xs hover:shadow hover:-translate-y-0.5 active:translate-y-0 ${
              activeDarkContrast
                ? 'border-2 border-amber-400 bg-black text-amber-300 hover:bg-zinc-900 font-bold'
                : 'border-[#C49A70]/50 hover:border-[#C49A70] bg-white hover:bg-[#C49A70]/10 text-[#82552B]'
            }`}
          >
            <Shield className="w-4 h-4 text-[#C49A70]" />
            <span>Admin Login</span>
          </button>
        </div>

        {/* If user is logged in, show status & quick sign out */}
        {currentUser && (
          <div className="mt-6 flex items-center justify-center gap-2 text-xs">
            <span className={activeDarkContrast ? 'text-zinc-400' : 'text-slate-500'}>
              Signed in as <strong className={activeDarkContrast ? 'text-zinc-200' : 'text-slate-700'}>{currentUser.email}</strong>
              {currentUser.role ? ` (${currentUser.role})` : ''}
            </span>
            {onLogout && (
              <button
                onClick={onLogout}
                className={`ml-2 underline font-semibold flex items-center gap-1 ${
                  activeDarkContrast ? 'text-zinc-300 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <LogOut className="w-3 h-3" />
                <span>Sign Out</span>
              </button>
            )}
          </div>
        )}
      </main>

      {/* Footer - Clean Full Width Bar matching muted theme */}
      <footer
        className={`w-full py-4 px-6 md:px-12 mt-auto border-t transition-colors ${
          activeDarkContrast
            ? 'bg-black border-white/20 text-white'
            : 'bg-[#21272A] border-transparent text-slate-200'
        }`}
      >
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-end justify-between gap-3 text-xs">
          {/* Useful links & copyright */}
          <div className="space-y-1.5">
            <div>
              <span
                className={`text-[11px] font-semibold block mb-0.5 ${
                  activeDarkContrast ? 'text-zinc-200' : 'text-slate-400'
                }`}
              >
                Useful links
              </span>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                <button
                  onClick={() => handleOpenModal('user-signin')}
                  className="hover:underline flex items-center gap-1 text-slate-200 hover:text-white"
                >
                  <span className={activeDarkContrast ? 'text-white' : 'text-[#7CA7A6]'}>›</span> User Sign In
                </button>
                <button
                  onClick={() => handleOpenModal('create-account')}
                  className="hover:underline flex items-center gap-1 text-slate-200 hover:text-white"
                >
                  <span className={activeDarkContrast ? 'text-white' : 'text-[#B8748C]'}>›</span> Create Account
                </button>
                <button
                  onClick={() => handleOpenModal('admin-login')}
                  className="hover:underline flex items-center gap-1 text-slate-200 hover:text-white"
                >
                  <span className={activeDarkContrast ? 'text-white' : 'text-[#C49A70]'}>›</span> Admin Login
                </button>
                <button
                  onClick={() => alert('For password resets, contact support@fileorganizer.ai')}
                  className="hover:underline flex items-center gap-1 text-slate-200 hover:text-white"
                >
                  <span className={activeDarkContrast ? 'text-white' : 'text-[#7FA080]'}>›</span> Forgot password
                </button>
                <button
                  onClick={() => alert('FileOrganizer.ai classifies documents into smart subfolders, detects exact duplicates, and supports semantic vector search.')}
                  className="hover:underline flex items-center gap-1 text-slate-200 hover:text-white"
                >
                  <span className={activeDarkContrast ? 'text-white' : 'text-[#7CA7A6]'}>›</span> FAQ
                </button>
                <button
                  onClick={() => alert('Contact: support@fileorganizer.ai')}
                  className="hover:underline flex items-center gap-1 text-slate-200 hover:text-white"
                >
                  <span className={activeDarkContrast ? 'text-white' : 'text-slate-400'}>›</span> Contact us
                </button>
              </div>
            </div>

            <div className={`text-[11px] pt-0.5 ${activeDarkContrast ? 'text-zinc-400' : 'text-slate-400'}`}>
              &copy; 2026 FileOrganizer.ai. All rights reserved. 100% Local &amp; Private.
            </div>
          </div>

          {/* Right Column: Status info */}
          <div className={`text-[11px] ${activeDarkContrast ? 'text-zinc-400' : 'text-slate-400'}`}>
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

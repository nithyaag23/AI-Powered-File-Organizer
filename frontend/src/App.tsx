import React, { useState, useEffect } from 'react';
import { Sidebar, PageId } from './components/Sidebar';
import { DashboardPage } from './pages/DashboardPage';
import { UploadPage } from './pages/UploadPage';
import { AllFilesPage } from './pages/AllFilesPage';
import { DuplicatesPage } from './pages/DuplicatesPage';
import { CategoriesPage } from './pages/CategoriesPage';
import { AISearchPage } from './pages/AISearchPage';
import { SettingsPage } from './pages/SettingsPage';
import { LandingPage } from './pages/LandingPage';
import { BatchOrganizerPage } from './pages/BatchOrganizerPage';
import { VerifyEmailPage } from './pages/VerifyEmailPage';
import { AuthModalType } from './components/auth/AuthModals';
import { fetchStats, fetchSystemStatus, deleteFile } from './api/client';
import { DashboardStats, SystemStatus, User } from './types';
import {
  saveSession,
  getActiveSession,
  clearSession,
  updateSessionActivity,
  SESSION_TIMEOUT_MS
} from './utils/session';
import { Menu, X, AlertCircle, ArrowLeft, ChevronRight } from 'lucide-react';
import {
  NavigationLocation,
  parseLocationFromHash,
  buildHash,
  PAGE_TITLES
} from './utils/navigation';

export default function App() {
  // Navigation State with URL Hash & HTML5 History synchronization
  const [currentLocation, setCurrentLocation] = useState<NavigationLocation>(() => {
    if (typeof window !== 'undefined') {
      return parseLocationFromHash(window.location.hash);
    }
    return { view: 'landing', page: 'batch-organizer' };
  });

  const [visitedStack, setVisitedStack] = useState<NavigationLocation[]>([currentLocation]);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [initialAuthModal, setInitialAuthModal] = useState<AuthModalType>(null);

  const showingLanding = currentLocation.view === 'landing';
  const currentPage = currentLocation.page;

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [backendOnline, setBackendOnline] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Authentication State - checks 15-minute inactivity timeout
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const active = getActiveSession();
    return active ? active.user : null;
  });

  // Accessibility state
  const [textSize, setTextSize] = useState<string>(() => {
    try {
      return localStorage.getItem('accessibility_textSize') || 'base';
    } catch {
      return 'base';
    }
  });

  const [darkContrast, setDarkContrast] = useState<boolean>(() => {
    try {
      return localStorage.getItem('accessibility_darkContrast') === 'true';
    } catch {
      return false;
    }
  });

  // Synchronize with HTML5 History API & listen to popstate (browser back/forward)
  useEffect(() => {
    const initialLoc = parseLocationFromHash(window.location.hash);
    const initialHash = buildHash(initialLoc.view, initialLoc.page, initialLoc.token);

    // Initialize the root entry with step 0
    window.history.replaceState(
      { view: initialLoc.view, page: initialLoc.page, token: initialLoc.token, step: 0 },
      '',
      initialHash
    );

    const handlePopState = (event: PopStateEvent) => {
      const state = event.state as { view?: 'landing' | 'workspace' | 'verify-email'; page?: PageId; token?: string; step?: number } | null;
      if (state && typeof state.step === 'number' && state.view && state.page) {
        setCurrentStep(state.step);
        setCurrentLocation({ view: state.view, page: state.page, token: state.token });
      } else {
        const parsed = parseLocationFromHash(window.location.hash);
        setCurrentLocation(parsed);
        setVisitedStack((prev) => {
          const idx = prev.findIndex((item) => item.view === parsed.view && item.page === parsed.page && item.token === parsed.token);
          if (idx !== -1) {
            setCurrentStep(idx);
            return prev;
          } else {
            const next = [...prev, parsed];
            setCurrentStep(next.length - 1);
            return next;
          }
        });
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateTo = (view: 'landing' | 'workspace' | 'verify-email', page: PageId, token?: string) => {
    // If already at requested location, do not create duplicate history entry
    if (currentLocation.view === view && currentLocation.page === page && currentLocation.token === token) {
      return;
    }

    const newLoc: NavigationLocation = { view, page, token };
    const nextStep = currentStep + 1;
    const newVisited = visitedStack.slice(0, currentStep + 1);
    newVisited.push(newLoc);

    setVisitedStack(newVisited);
    setCurrentStep(nextStep);
    setCurrentLocation(newLoc);

    const hash = buildHash(view, page, token);
    window.history.pushState(
      { view, page, token, step: nextStep },
      '',
      hash
    );
  };

  const handleNavigate = (page: PageId) => {
    setMobileMenuOpen(false);
    navigateTo('workspace', page);
  };

  const handleGoToLanding = () => {
    setMobileMenuOpen(false);
    navigateTo('landing', currentPage);
  };

  const handleEnterWorkspace = () => {
    navigateTo('workspace', currentPage || 'batch-organizer');
  };

  const handleGoBack = () => {
    setMobileMenuOpen(false);
    if (currentStep > 0) {
      window.history.back();
    } else {
      // Edge case: No previous page in session (e.g. direct load of a deep link)
      // Navigate to sensible default home page
      if (currentLocation.view === 'workspace') {
        if (currentLocation.page !== 'batch-organizer') {
          navigateTo('workspace', 'batch-organizer');
        } else {
          navigateTo('landing', 'batch-organizer');
        }
      } else {
        navigateTo('workspace', 'batch-organizer');
      }
    }
  };

  // Determine previous page title and availability
  const canGoBack = currentStep > 0 || (currentLocation.view === 'workspace');

  const previousLoc = currentStep > 0 ? visitedStack[currentStep - 1] : null;
  const previousPageTitle = previousLoc
    ? previousLoc.view === 'landing'
      ? 'Landing Page'
      : PAGE_TITLES[previousLoc.page] || previousLoc.page
    : currentLocation.view === 'workspace'
    ? currentLocation.page !== 'batch-organizer'
      ? 'Batch Organizer'
      : 'Landing Page'
    : null;

  // Real-time font size scaling across all rem-based Tailwind styles
  useEffect(() => {
    const scales: Record<string, string> = {
      sm: '13px',
      base: '16px',
      lg: '19.5px',
      xl: '23px',
    };
    const size = scales[textSize] || '16px';
    document.documentElement.style.setProperty('font-size', size, 'important');
    try {
      localStorage.setItem('accessibility_textSize', textSize);
    } catch {}
  }, [textSize]);

  // Persist dark contrast preference
  useEffect(() => {
    try {
      localStorage.setItem('accessibility_darkContrast', darkContrast ? 'true' : 'false');
    } catch {}
  }, [darkContrast]);

  const loadData = async () => {
    try {
      const [statsData, statusData] = await Promise.all([
        fetchStats(),
        fetchSystemStatus(),
      ]);
      setStats(statsData);
      setSystemStatus(statusData);
      setBackendOnline(true);
    } catch (err) {
      console.error('Failed to connect to backend', err);
      setBackendOnline(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 15000); // Polling every 15s to keep stats fresh
    return () => clearInterval(interval);
  }, []);

  // Track user activity & enforce 15-minute inactivity session timeout
  useEffect(() => {
    const handleUserActivity = () => {
      updateSessionActivity();
    };

    window.addEventListener('pointerdown', handleUserActivity);
    window.addEventListener('keydown', handleUserActivity);

    // Inactivity expiration check timer running every 10 seconds
    const timeoutChecker = setInterval(() => {
      if (currentUser) {
        const active = getActiveSession();
        if (!active) {
          setCurrentUser(null);
          navigateTo('landing', 'batch-organizer');
          alert('Your session has timed out after 15 minutes of inactivity. Please sign in again.');
        }
      }
    }, 10000);

    return () => {
      window.removeEventListener('pointerdown', handleUserActivity);
      window.removeEventListener('keydown', handleUserActivity);
      clearInterval(timeoutChecker);
    };
  }, [currentUser, currentLocation, currentStep, visitedStack]);

  const handleLoginSuccess = (user: User, token: string) => {
    setCurrentUser(user);
    saveSession(user, token);
    navigateTo('workspace', 'batch-organizer');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    clearSession();
    navigateTo('landing', 'batch-organizer');
  };

  const handleDeleteFile = async (fileId: string) => {
    if (window.confirm('Delete this file?')) {
      try {
        await deleteFile(fileId);
        await loadData();
      } catch (err: any) {
        alert(err.message || 'Failed to delete file');
      }
    }
  };

  // Render Email Verification Page if on verify-email route
  if (currentLocation.view === 'verify-email') {
    return (
      <VerifyEmailPage
        token={currentLocation.token}
        onGoToSignIn={() => {
          setInitialAuthModal('user-signin');
          navigateTo('landing', 'batch-organizer');
        }}
        onGoToHome={() => {
          navigateTo('landing', 'batch-organizer');
        }}
        darkContrast={darkContrast}
      />
    );
  }

  // Render Landing Page if requested or not logged in
  if (showingLanding) {
    return (
      <LandingPage
        onLoginSuccess={handleLoginSuccess}
        backendOnline={backendOnline}
        totalFiles={stats?.total_files ?? 0}
        currentUser={currentUser}
        onEnterWorkspace={handleEnterWorkspace}
        onLogout={handleLogout}
        onGoBack={handleGoBack}
        canGoBack={canGoBack}
        previousPageTitle={previousPageTitle}
        initialModal={initialAuthModal}
        onClearInitialModal={() => setInitialAuthModal(null)}
        textSize={textSize}
        setTextSize={setTextSize}
        darkContrast={darkContrast}
        setDarkContrast={setDarkContrast}
      />
    );
  }

  return (
    <div
      className={`min-h-screen flex flex-col md:flex-row font-sans transition-colors duration-200 ${
        darkContrast ? 'bg-black text-white' : 'bg-slate-50 text-slate-800'
      }`}
    >
      {/* Mobile Header */}
      <div
        className={`md:hidden p-4 flex items-center justify-between sticky top-0 z-50 border-b ${
          darkContrast ? 'bg-black border-white/20 text-white' : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        <div className="flex items-center gap-2">
          {canGoBack && (
            <button
              onClick={handleGoBack}
              className={`p-1.5 rounded-lg border transition-colors ${
                darkContrast
                  ? 'border-white/20 text-white hover:bg-zinc-900'
                  : 'border-slate-200 text-slate-700 bg-white hover:bg-slate-50 shadow-sm'
              }`}
              title={`Go back to ${previousPageTitle || 'Previous'}`}
              aria-label="Go Back"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div className="font-bold text-base">FileOrganizer AI</div>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className={`p-2 rounded-lg ${darkContrast ? 'bg-zinc-900 text-white' : 'bg-slate-100 text-slate-700'}`}
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Sidebar for Desktop */}
      <div className="hidden md:block">
        <Sidebar
          currentPage={currentPage}
          onNavigate={handleNavigate}
          backendOnline={backendOnline}
          ollamaOnline={systemStatus?.ollama?.connected ?? false}
          totalFiles={stats?.total_files ?? 0}
          currentUser={currentUser}
          onLogout={handleLogout}
          onGoToLanding={handleGoToLanding}
          onGoBack={handleGoBack}
          canGoBack={canGoBack}
          previousPageTitle={previousPageTitle}
          textSize={textSize}
          setTextSize={setTextSize}
          darkContrast={darkContrast}
          setDarkContrast={setDarkContrast}
        />
      </div>

      {/* Sidebar Drawer for Mobile */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm">
          <div className="w-64 h-full">
            <Sidebar
              currentPage={currentPage}
              onNavigate={handleNavigate}
              backendOnline={backendOnline}
              ollamaOnline={systemStatus?.ollama?.connected ?? false}
              totalFiles={stats?.total_files ?? 0}
              currentUser={currentUser}
              onLogout={handleLogout}
              onGoToLanding={handleGoToLanding}
              onGoBack={handleGoBack}
              canGoBack={canGoBack}
              previousPageTitle={previousPageTitle}
              textSize={textSize}
              setTextSize={setTextSize}
              darkContrast={darkContrast}
              setDarkContrast={setDarkContrast}
            />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 p-5 md:p-10 max-w-7xl w-full overflow-y-auto">
        {/* Navigation Breadcrumb & Back Bar */}
        <div className="flex items-center justify-between pb-3.5 mb-6 border-b border-slate-200/80">
          <div className="flex items-center gap-3">
            {canGoBack && (
              <button
                onClick={handleGoBack}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold shadow-sm transition-all ${
                  darkContrast
                    ? 'border-white/20 bg-zinc-900 text-white hover:bg-zinc-800'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100/80 hover:text-slate-900 hover:border-slate-300'
                }`}
                title={`Go back to ${previousPageTitle || 'Previous'}`}
              >
                <ArrowLeft className="w-4 h-4 text-slate-400 shrink-0" />
                <span>Back to {previousPageTitle || 'Previous'}</span>
              </button>
            )}

            <div className={`text-xs flex items-center gap-1.5 font-medium ${darkContrast ? 'text-zinc-400' : 'text-slate-400'}`}>
              <span>Workspace</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
              <span className={`font-semibold ${darkContrast ? 'text-zinc-200' : 'text-slate-700'}`}>
                {PAGE_TITLES[currentPage] || currentPage}
              </span>
            </div>
          </div>
        </div>

        {!backendOnline && !loading && (
          <div className="mb-6 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
              <span>
                Backend server is connecting at <strong>http://127.0.0.1:8000</strong>. If the server is still booting up, stats will sync automatically.
              </span>
            </div>
            <button
              onClick={loadData}
              className="text-xs font-bold underline ml-3 shrink-0"
            >
              Retry Connection
            </button>
          </div>
        )}

        {currentPage === 'batch-organizer' && (
          <BatchOrganizerPage />
        )}

        {currentPage === 'dashboard' && (
          <DashboardPage
            stats={stats}
            loading={loading}
            onNavigate={handleNavigate}
            onDeleteFile={handleDeleteFile}
          />
        )}

        {currentPage === 'upload' && (
          <UploadPage
            onUploadSuccess={loadData}
            onNavigate={handleNavigate}
          />
        )}

        {currentPage === 'all-files' && (
          <AllFilesPage onRefreshStats={loadData} />
        )}

        {currentPage === 'duplicates' && (
          <DuplicatesPage onRefreshStats={loadData} />
        )}

        {currentPage === 'categories' && (
          <CategoriesPage
            stats={stats}
            onRefreshStats={loadData}
          />
        )}

        {currentPage === 'ai-search' && (
          <AISearchPage
            onRefreshStats={loadData}
            ollamaOnline={systemStatus?.ollama?.connected ?? false}
          />
        )}

        {currentPage === 'settings' && (
          <SettingsPage onRefreshStats={loadData} />
        )}
      </main>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Mail,
  ArrowRight,
  Shield,
  Home,
  RefreshCw
} from 'lucide-react';
import { verifyEmail, resendVerification } from '../api/client';

interface VerifyEmailPageProps {
  token?: string;
  onGoToSignIn: () => void;
  onGoToHome: () => void;
  darkContrast?: boolean;
}

export const VerifyEmailPage: React.FC<VerifyEmailPageProps> = ({
  token,
  onGoToSignIn,
  onGoToHome,
  darkContrast = false,
}) => {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);

  // Resend state
  const [resendEmail, setResendEmail] = useState('');
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMsg, setResendMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    let timer: any;
    if (cooldown > 0) {
      timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [cooldown]);

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('No verification token was provided in the link. Please check your email or enter your address below to request a new link.');
      return;
    }

    let isMounted = true;
    const executeVerification = async () => {
      try {
        const res = await verifyEmail(token);
        if (isMounted) {
          setStatus('success');
          setMessage(res.message || 'Your email address has been successfully verified! You can now log in.');
          if (res.email) setVerifiedEmail(res.email);
        }
      } catch (err: any) {
        if (isMounted) {
          setStatus('error');
          setMessage(err.message || 'Verification failed. The link may be invalid or expired.');
        }
      }
    };

    executeVerification();
    return () => {
      isMounted = false;
    };
  }, [token]);

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resendEmail || !resendEmail.includes('@')) {
      setResendMsg({ type: 'error', text: 'Please enter a valid email address.' });
      return;
    }

    setResendLoading(true);
    setResendMsg(null);
    try {
      const res = await resendVerification(resendEmail.trim().toLowerCase());
      setResendMsg({ type: 'success', text: res.message || 'Verification email resent! Please check your inbox.' });
      setCooldown(60);
    } catch (err: any) {
      setResendMsg({ type: 'error', text: err.message || 'Failed to resend verification email.' });
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div
      className={`min-h-screen flex flex-col font-sans select-none transition-colors duration-200 ${
        darkContrast ? 'bg-black text-white' : 'bg-slate-50 text-slate-800'
      }`}
    >
      {/* Top Navbar */}
      <header
        className={`w-full py-4 px-6 md:px-12 flex items-center justify-between border-b ${
          darkContrast ? 'bg-black border-white/20' : 'bg-white border-slate-200 shadow-sm'
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-8 h-8 rounded-lg border flex items-center justify-center ${
              darkContrast ? 'border-white text-white bg-zinc-900' : 'border-slate-300 text-[#0f2952] bg-white'
            }`}
          >
            <Shield className="w-4 h-4" />
          </div>
          <div>
            <span className={`font-bold text-sm md:text-base leading-tight ${darkContrast ? 'text-white' : 'text-[#0f2952]'}`}>
              FileOrganizer.ai
            </span>
            <span className={`block text-[11px] leading-none mt-0.5 ${darkContrast ? 'text-zinc-400' : 'text-slate-500'}`}>
              Account Verification
            </span>
          </div>
        </div>

        <button
          onClick={onGoToHome}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5 ${
            darkContrast
              ? 'border-white/30 text-white hover:bg-zinc-900'
              : 'border-slate-300 text-slate-700 bg-white hover:bg-slate-50'
          }`}
        >
          <Home className="w-3.5 h-3.5" />
          <span>Home</span>
        </button>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div
          className={`w-full max-w-lg rounded-2xl border p-8 md:p-10 shadow-xl transition-all ${
            darkContrast ? 'bg-zinc-950 border-white/20' : 'bg-white border-slate-200'
          }`}
        >
          {/* 1. LOADING STATE */}
          {status === 'loading' && (
            <div className="text-center py-8 space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto shadow-sm">
                <Loader2 className="w-7 h-7 animate-spin" />
              </div>
              <h2 className={`text-xl font-bold ${darkContrast ? 'text-white' : 'text-slate-900'}`}>
                Verifying Your Email...
              </h2>
              <p className={`text-xs sm:text-sm max-w-sm mx-auto leading-relaxed ${darkContrast ? 'text-zinc-400' : 'text-slate-500'}`}>
                Please wait while we validate your single-use verification token with the security registry.
              </p>
            </div>
          )}

          {/* 2. SUCCESS STATE */}
          {status === 'success' && (
            <div className="text-center py-4 space-y-5">
              <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto shadow-sm border border-emerald-100">
                <CheckCircle2 className="w-9 h-9 stroke-[2.5]" />
              </div>
              <div>
                <h2 className={`text-2xl font-bold tracking-tight ${darkContrast ? 'text-white' : 'text-slate-900'}`}>
                  Email Verified Successfully!
                </h2>
                <p className={`text-xs sm:text-sm mt-2 max-w-md mx-auto leading-relaxed ${darkContrast ? 'text-zinc-300' : 'text-slate-600'}`}>
                  {message}
                </p>
                {verifiedEmail && (
                  <p className="mt-1 text-xs font-semibold text-blue-600">
                    Account: {verifiedEmail}
                  </p>
                )}
              </div>

              <div className="pt-3 flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={onGoToSignIn}
                  className={`w-full sm:w-auto px-6 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-sm flex items-center justify-center gap-2 ${
                    darkContrast
                      ? 'bg-white text-black hover:bg-zinc-200 font-bold'
                      : 'bg-[#0f2952] hover:bg-[#1a3a6b] text-white'
                  }`}
                >
                  <span>Sign In Now</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  onClick={onGoToHome}
                  className={`w-full sm:w-auto px-5 py-2.5 rounded-xl font-semibold text-sm border transition-all ${
                    darkContrast
                      ? 'border-white/30 text-white hover:bg-zinc-900'
                      : 'border-slate-300 text-slate-700 bg-white hover:bg-slate-50'
                  }`}
                >
                  Return to Home
                </button>
              </div>
            </div>
          )}

          {/* 3. ERROR / EXPIRED / INVALID STATE */}
          {status === 'error' && (
            <div className="space-y-6">
              <div className="text-center space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto shadow-sm border border-rose-100">
                  <AlertTriangle className="w-7 h-7" />
                </div>
                <h2 className={`text-xl font-bold tracking-tight ${darkContrast ? 'text-white' : 'text-slate-900'}`}>
                  Verification Link Invalid or Expired
                </h2>
                <p className={`text-xs sm:text-sm leading-relaxed ${darkContrast ? 'text-zinc-400' : 'text-slate-600'}`}>
                  {message}
                </p>
              </div>

              {/* Resend Verification Form */}
              <div
                className={`p-5 rounded-xl border space-y-3 ${
                  darkContrast ? 'bg-zinc-900/60 border-white/10' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-blue-600" />
                  <span className={`text-xs font-bold uppercase tracking-wider ${darkContrast ? 'text-zinc-200' : 'text-slate-700'}`}>
                    Request a New Verification Link
                  </span>
                </div>
                <p className={`text-xs leading-relaxed ${darkContrast ? 'text-zinc-400' : 'text-slate-500'}`}>
                  Enter the email address used during registration. We'll send you a fresh, secure link.
                </p>

                {resendMsg && (
                  <div
                    className={`p-3 rounded-lg text-xs font-medium border ${
                      resendMsg.type === 'success'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : 'bg-rose-50 text-rose-800 border-rose-200'
                    }`}
                  >
                    {resendMsg.text}
                  </div>
                )}

                <form onSubmit={handleResend} className="space-y-3">
                  <input
                    type="email"
                    value={resendEmail}
                    onChange={(e) => setResendEmail(e.target.value)}
                    placeholder="name@example.com"
                    required
                    className={`w-full px-3.5 py-2 text-xs sm:text-sm rounded-lg border focus:outline-none focus:ring-1 focus:ring-[#0f2952] ${
                      darkContrast
                        ? 'bg-black border-white/20 text-white placeholder-zinc-500'
                        : 'bg-white border-slate-300 text-slate-800'
                    }`}
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="submit"
                      disabled={resendLoading || cooldown > 0}
                      className={`flex-1 py-2 px-4 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50 ${
                        darkContrast
                          ? 'bg-white text-black hover:bg-zinc-200 font-bold'
                          : 'bg-[#0f2952] hover:bg-[#1a3a6b] text-white'
                      }`}
                    >
                      {resendLoading ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Sending...</span>
                        </>
                      ) : cooldown > 0 ? (
                        <span>Resend available in {cooldown}s</span>
                      ) : (
                        <>
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Resend Verification Email</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={onGoToSignIn}
                      className={`py-2 px-3 rounded-lg text-xs font-semibold border transition-all ${
                        darkContrast
                          ? 'border-white/30 text-white hover:bg-zinc-800'
                          : 'border-slate-300 text-slate-700 bg-white hover:bg-slate-100'
                      }`}
                    >
                      Sign In
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

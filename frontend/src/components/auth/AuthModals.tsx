import React, { useState, useEffect } from 'react';
import {
  X,
  Eye,
  EyeOff,
  Check,
  Shield,
  AlertTriangle,
  Mail,
  RefreshCw,
  Loader2,
  ArrowRight,
  KeyRound
} from 'lucide-react';
import {
  loginUser,
  registerUser,
  resendVerification,
  verifyLoginOtp,
  resendLoginOtp
} from '../../api/client';
import { User } from '../../types';

export type AuthModalType =
  | 'admin-login'
  | 'user-signin'
  | 'create-account'
  | 'verification-sent'
  | 'login-otp'
  | null;

interface AuthModalsProps {
  activeModal: AuthModalType;
  onClose: () => void;
  onAuthSuccess: (user: User, token: string) => void;
  onSwitchModal: (type: AuthModalType) => void;
}

export const AuthModals: React.FC<AuthModalsProps> = ({
  activeModal,
  onClose,
  onAuthSuccess,
  onSwitchModal,
}) => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Email verification state after registration
  const [registeredEmail, setRegisteredEmail] = useState('');
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMsg, setResendMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [cooldown, setCooldown] = useState(0);

  // Login OTP state (Two-Factor authentication)
  const [loginChallengeId, setLoginChallengeId] = useState('');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginRole, setLoginRole] = useState<'user' | 'admin'>('user');
  const [otpCode, setOtpCode] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpResendMsg, setOtpResendMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [otpCooldown, setOtpCooldown] = useState(0);

  // Cooldown countdown timer for registration verification
  useEffect(() => {
    let timer: any;
    if (cooldown > 0) {
      timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [cooldown]);

  // Cooldown countdown timer for login OTP resends
  useEffect(() => {
    let timer: any;
    if (otpCooldown > 0) {
      timer = setTimeout(() => setOtpCooldown(otpCooldown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [otpCooldown]);

  // Clear fields whenever modal changes (except when transitioning to sub-screens)
  useEffect(() => {
    setError(null);
    setResendMsg(null);
    setOtpError(null);
    setOtpResendMsg(null);

    if (activeModal !== 'verification-sent' && activeModal !== 'login-otp') {
      setEmail('');
      setPassword('');
      setFullName('');
      setShowPassword(false);
      setOtpCode('');
    }
  }, [activeModal]);

  if (!activeModal) return null;

  // The 5 visual conditions matching page 3 of user manual
  const hasMinLength = password.length >= 10;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>_+=~`\-/\\[\]]/.test(password);

  const isPasswordValid = hasMinLength && (hasUppercase || hasLowercase) && hasDigit && hasSpecial;

  // Handle Password submission (Initiates Login or Registration)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResendMsg(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }

    if (activeModal === 'create-account' && !isPasswordValid) {
      setError('Password must satisfy all conditions listed below.');
      return;
    }

    setLoading(true);
    try {
      if (activeModal === 'admin-login' || activeModal === 'user-signin') {
        const role = activeModal === 'admin-login' ? 'admin' : 'user';
        const challenge = await loginUser(cleanEmail, password, role);

        // Transition to OTP Entry screen with active challenge
        setLoginChallengeId(challenge.challenge_id);
        setLoginEmail(challenge.email);
        setLoginRole(role);
        setOtpCode('');
        setOtpError(null);
        setOtpCooldown(60); // 60s cooldown before next resend
        onSwitchModal('login-otp');
      } else if (activeModal === 'create-account') {
        // Register user -> dispatches 6-digit OTP to email, stages account without touching users DB
        const res = await registerUser(cleanEmail, password, 'user');
        if (res.challenge_id) {
          setLoginChallengeId(res.challenge_id);
          setLoginEmail(cleanEmail);
          setLoginRole('user');
          setOtpCode('');
          setOtpError(null);
          setOtpCooldown(60);
          onSwitchModal('login-otp');
        } else {
          setRegisteredEmail(cleanEmail);
          setCooldown(60);
          onSwitchModal('verification-sent');
        }
      }
    } catch (err: any) {
      const errMsg = err.message || 'Authentication failed. Please verify credentials.';
      setError(errMsg);
      if (errMsg.toLowerCase().includes('not been verified') || errMsg.toLowerCase().includes('verification link')) {
        setRegisteredEmail(cleanEmail);
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle OTP Submission (Step 2 of Login)
  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setOtpError(null);
    setOtpResendMsg(null);

    const cleanOtp = otpCode.trim();
    if (!cleanOtp || cleanOtp.length !== 6 || !/^\d{6}$/.test(cleanOtp)) {
      setOtpError('Please enter a valid 6-digit verification code.');
      return;
    }

    setOtpLoading(true);
    try {
      const res = await verifyLoginOtp(loginChallengeId, cleanOtp);

      if (loginRole === 'admin' && res.user.role !== 'admin') {
        setOtpError('This sign-in accepts Admin accounts only. Access refused with AUTH_FORBIDDEN.');
        setOtpLoading(false);
        return;
      }

      onAuthSuccess(res.user, res.token);
      onClose();
    } catch (err: any) {
      setOtpError(err.message || 'Invalid or expired verification code.');
    } finally {
      setOtpLoading(false);
    }
  };

  // Resend Login OTP
  const handleResendOtp = async () => {
    if (!loginChallengeId) return;
    setOtpLoading(true);
    setOtpError(null);
    setOtpResendMsg(null);
    try {
      const res = await resendLoginOtp(loginChallengeId);
      setOtpResendMsg({ type: 'success', text: res.message || 'A new verification code has been sent to your email.' });
      setOtpCooldown(60);
    } catch (err: any) {
      setOtpResendMsg({ type: 'error', text: err.message || 'Failed to resend login code.' });
    } finally {
      setOtpLoading(false);
    }
  };

  // Resend Registration Email Verification
  const handleResendClick = async (targetEmail: string) => {
    if (!targetEmail) return;
    setResendLoading(true);
    setResendMsg(null);
    try {
      const res = await resendVerification(targetEmail);
      setResendMsg({ type: 'success', text: res.message || 'Verification email resent! Please check your inbox.' });
      setCooldown(60);
    } catch (err: any) {
      setResendMsg({ type: 'error', text: err.message || 'Failed to resend verification email.' });
    } finally {
      setResendLoading(false);
    }
  };

  const isUnverifiedLoginError = error && (error.toLowerCase().includes('not been verified') || error.toLowerCase().includes('verification link'));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-md bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden text-slate-800">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors z-10"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-8">

          {/* ======================================================== */}
          {/* 1. OTP VERIFICATION SCREEN (Registration & 2FA Login)     */}
          {/* ======================================================== */}
          {activeModal === 'login-otp' && (() => {
            const isReg = loginChallengeId.startsWith('reg_');
            return (
              <div className="py-1">
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 tracking-tight leading-none">
                      {isReg ? 'Verify Your Account' : 'Two-Factor Authentication'}
                    </h2>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {isReg ? 'Enter verification code to complete account creation' : 'Step 2: Enter one-time email code'}
                    </p>
                  </div>
                </div>

                <p className="text-xs text-slate-600 mt-2 mb-4 leading-relaxed">
                  A 6-digit verification code was sent to <strong className="text-slate-900">{loginEmail}</strong>. Code expires in 5 minutes.
                </p>

                {otpError && (
                  <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                    {otpError}
                  </div>
                )}

                {otpResendMsg && (
                  <div
                    className={`mb-4 p-3 rounded-lg text-xs font-medium border ${
                      otpResendMsg.type === 'success'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : 'bg-rose-50 text-rose-800 border-rose-200'
                    }`}
                  >
                    {otpResendMsg.text}
                  </div>
                )}

                <form onSubmit={handleOtpSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1 text-center">
                      Enter 6-Digit Code
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      pattern="\d{6}"
                      value={otpCode}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                        setOtpCode(val);
                      }}
                      placeholder="123456"
                      required
                      autoFocus
                      className="w-full text-center text-2xl font-bold font-mono tracking-[10px] py-3 bg-slate-50 border-2 border-slate-300 focus:border-[#0f2952] rounded-xl focus:outline-none focus:bg-white transition-all text-slate-900"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={otpLoading || otpCode.trim().length !== 6}
                    className="w-full py-2.5 px-4 rounded-lg bg-[#0f2952] hover:bg-[#1a3a6b] text-white font-semibold text-sm transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {otpLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Verifying code...</span>
                      </>
                    ) : (
                      <span>{isReg ? 'Verify & Create Account' : 'Verify & Sign In'}</span>
                    )}
                  </button>
                </form>

                <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <button
                    type="button"
                    disabled={otpLoading || otpCooldown > 0}
                    onClick={handleResendOtp}
                    className="text-blue-600 hover:underline font-medium disabled:text-slate-400 disabled:no-underline flex items-center gap-1"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>
                      {otpCooldown > 0 ? `Resend code (${otpCooldown}s)` : 'Resend code'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onSwitchModal(isReg ? 'create-account' : loginRole === 'admin' ? 'admin-login' : 'user-signin')}
                    className="text-slate-500 hover:text-slate-800"
                  >
                    {isReg ? 'Change details' : 'Change email / password'}
                  </button>
                </div>
              </div>
            );
          })()}

          {/* ======================================================== */}
          {/* 2. VERIFICATION SENT NOTIFICATION SCREEN (Registration)  */}
          {/* ======================================================== */}
          {activeModal === 'verification-sent' && (
            <div className="text-center py-2 space-y-5">
              <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto shadow-sm border border-blue-100">
                <Mail className="w-8 h-8" />
              </div>

              <div>
                <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                  Check your email
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  We sent a verification link to
                </p>
                <div className="mt-1 px-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 inline-block max-w-full truncate">
                  {registeredEmail}
                </div>
              </div>

              <div className="text-left text-xs text-slate-600 bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1.5 leading-relaxed">
                <p className="font-semibold text-slate-700">What to do next:</p>
                <div className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold">1.</span>
                  <span>Open your email inbox and find the email from <strong>FileOrganizer AI</strong>.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold">2.</span>
                  <span>Click the <strong>"Verify Email Address"</strong> button in the email.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold">3.</span>
                  <span>Return here to sign in with your email and password.</span>
                </div>
                <p className="text-[11px] text-slate-400 pt-1">
                  The verification link is single-use and expires in 24 hours.
                </p>
              </div>

              {resendMsg && (
                <div
                  className={`p-3 rounded-lg text-xs font-medium border text-left ${
                    resendMsg.type === 'success'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : 'bg-rose-50 text-rose-800 border-rose-200'
                  }`}
                >
                  {resendMsg.text}
                </div>
              )}

              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  onClick={() => onSwitchModal('user-signin')}
                  className="w-full py-2.5 px-4 rounded-lg bg-[#0f2952] hover:bg-[#1a3a6b] text-white font-semibold text-sm transition-colors shadow-sm flex items-center justify-center gap-2"
                >
                  <span>Go to Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  disabled={resendLoading || cooldown > 0}
                  onClick={() => handleResendClick(registeredEmail)}
                  className="w-full py-2 px-4 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {resendLoading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Resending email...</span>
                    </>
                  ) : cooldown > 0 ? (
                    <span>Resend available in {cooldown}s</span>
                  ) : (
                    <>
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Resend verification email</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* 3. CREATE ACCOUNT (Page 3 of Manual)                     */}
          {/* ======================================================== */}
          {activeModal === 'create-account' && (
            <div>
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                Create Account
              </h2>
              <p className="text-xs text-slate-500 mt-1 mb-6">
                Fields marked * are required. A 6-digit OTP code will be sent to your email to verify and create your account.
              </p>

              {error && (
                <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
                <input type="text" style={{ position: 'fixed', top: -9999, left: -9999, opacity: 0 }} tabIndex={-1} aria-hidden="true" autoComplete="off" readOnly />
                <input type="password" style={{ position: 'fixed', top: -9999, left: -9999, opacity: 0 }} tabIndex={-1} aria-hidden="true" autoComplete="off" readOnly />

                {/* Full name */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Full name *
                  </label>
                  <input
                    type="text"
                    name="signup_fullname_nofill"
                    autoComplete="off"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Enter your full name"
                    required
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[#0f2952] focus:border-[#0f2952]"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Email *
                  </label>
                  <input
                    type="email"
                    name="signup_email_nofill"
                    autoComplete="new-password"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email address"
                    required
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[#0f2952] focus:border-[#0f2952]"
                  />
                </div>

                {/* Password */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Password *
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="signup_password_nofill"
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      required
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm pr-9 focus:outline-none focus:ring-1 focus:ring-[#0f2952] focus:border-[#0f2952]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Password conditions */}
                <div className="py-2 space-y-1 text-xs">
                  <div className={`flex items-center gap-1.5 ${hasMinLength ? 'text-emerald-700 font-medium' : 'text-slate-500'}`}>
                    <Check className={`w-3.5 h-3.5 ${hasMinLength ? 'text-emerald-600 stroke-[3]' : 'text-slate-300'}`} />
                    <span>at least 10 characters</span>
                  </div>

                  <div className={`flex items-center gap-1.5 ${hasUppercase ? 'text-emerald-700 font-medium' : 'text-slate-500'}`}>
                    <Check className={`w-3.5 h-3.5 ${hasUppercase ? 'text-emerald-600 stroke-[3]' : 'text-slate-300'}`} />
                    <span>an uppercase letter</span>
                  </div>

                  <div className={`flex items-center gap-1.5 ${hasLowercase ? 'text-emerald-700 font-medium' : 'text-slate-500'}`}>
                    <Check className={`w-3.5 h-3.5 ${hasLowercase ? 'text-emerald-600 stroke-[3]' : 'text-slate-300'}`} />
                    <span>a lowercase letter</span>
                  </div>

                  <div className={`flex items-center gap-1.5 ${hasDigit ? 'text-emerald-700 font-medium' : 'text-slate-500'}`}>
                    <Check className={`w-3.5 h-3.5 ${hasDigit ? 'text-emerald-600 stroke-[3]' : 'text-slate-300'}`} />
                    <span>a digit</span>
                  </div>

                  <div className={`flex items-center gap-1.5 ${hasSpecial ? 'text-emerald-700 font-medium' : 'text-slate-500'}`}>
                    <Check className={`w-3.5 h-3.5 ${hasSpecial ? 'text-emerald-600 stroke-[3]' : 'text-slate-300'}`} />
                    <span>a special character (e.g. ! @ # $ %)</span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 px-4 rounded-lg bg-[#0f2952] hover:bg-[#1a3a6b] text-white font-semibold text-sm transition-colors shadow-sm disabled:opacity-50"
                >
                  {loading ? 'Creating account & sending email...' : 'Create account'}
                </button>
              </form>

              <div className="mt-5 text-center text-xs text-slate-600">
                Already registered?{' '}
                <button
                  type="button"
                  onClick={() => onSwitchModal('user-signin')}
                  className="text-blue-600 hover:underline font-medium"
                >
                  Sign in
                </button>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* 4. USER SIGN IN (Step 1: Email + Password)               */}
          {/* ======================================================== */}
          {activeModal === 'user-signin' && (
            <div>
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                Sign In
              </h2>
              <p className="text-xs text-slate-500 mt-1 mb-6">
                Fields marked * are required. Verification code will be sent to your email.
              </p>

              {error && (
                <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium space-y-2">
                  <div>{error}</div>
                  {isUnverifiedLoginError && registeredEmail && (
                    <div className="pt-1">
                      <button
                        type="button"
                        disabled={resendLoading || cooldown > 0}
                        onClick={() => handleResendClick(registeredEmail)}
                        className="text-xs font-bold text-blue-700 hover:underline flex items-center gap-1"
                      >
                        {resendLoading ? 'Sending verification email...' : cooldown > 0 ? `Resend available in ${cooldown}s` : 'Resend verification email now \u2192'}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {resendMsg && (
                <div
                  className={`mb-4 p-3 rounded-lg text-xs font-medium border ${
                    resendMsg.type === 'success'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : 'bg-rose-50 text-rose-800 border-rose-200'
                  }`}
                >
                  {resendMsg.text}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
                <input type="text" style={{ position: 'fixed', top: -9999, left: -9999, opacity: 0 }} tabIndex={-1} aria-hidden="true" autoComplete="off" readOnly />
                <input type="password" style={{ position: 'fixed', top: -9999, left: -9999, opacity: 0 }} tabIndex={-1} aria-hidden="true" autoComplete="off" readOnly />

                {/* Email */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Email *
                  </label>
                  <input
                    type="email"
                    name="login_email_clean"
                    id="login_email_clean"
                    autoComplete="new-password"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    required
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[#0f2952] focus:border-[#0f2952]"
                  />
                </div>

                {/* Password with Forgot password link */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-medium text-slate-700">
                      Password *
                    </label>
                    <button
                      type="button"
                      onClick={() => alert('To reset your password, contact support@fileorganizer.ai')}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="login_password_clean"
                      id="login_password_clean"
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      required
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm pr-9 focus:outline-none focus:ring-1 focus:ring-[#0f2952] focus:border-[#0f2952]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 px-4 rounded-lg bg-[#0f2952] hover:bg-[#1a3a6b] text-white font-semibold text-sm transition-colors shadow-sm disabled:opacity-50"
                >
                  {loading ? 'Verifying password & sending code...' : 'Continue to Verification Code \u2192'}
                </button>
              </form>

              <div className="mt-4 space-y-1.5 text-center text-xs text-slate-600">
                <div>
                  No account?{' '}
                  <button
                    type="button"
                    onClick={() => onSwitchModal('create-account')}
                    className="text-blue-600 hover:underline font-medium"
                  >
                    Create one
                  </button>
                </div>
                <div>
                  Administrator?{' '}
                  <button
                    type="button"
                    onClick={() => onSwitchModal('admin-login')}
                    className="text-blue-600 hover:underline font-medium"
                  >
                    Use the Administrator Portal
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* 5. ADMINISTRATOR PORTAL                                   */}
          {/* ======================================================== */}
          {activeModal === 'admin-login' && (
            <div>
              <div className="flex items-center gap-2.5 mb-1">
                <div className="w-7 h-7 rounded-lg border border-slate-300 flex items-center justify-center text-slate-700">
                  <Shield className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900 tracking-tight leading-none">
                    Administrator Portal
                  </h2>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Elevated privilege authentication (F.3)
                  </p>
                </div>
              </div>

              <div className="my-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs leading-relaxed flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="block font-semibold mb-0.5">Administrators only.</strong>
                  Admin login requires password + one-time email OTP verification code.
                </div>
              </div>

              <p className="text-xs text-slate-500 mb-4">
                Fields marked * are required.
              </p>

              {error && (
                <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
                <input type="text" style={{ position: 'fixed', top: -9999, left: -9999, opacity: 0 }} tabIndex={-1} aria-hidden="true" autoComplete="off" readOnly />
                <input type="password" style={{ position: 'fixed', top: -9999, left: -9999, opacity: 0 }} tabIndex={-1} aria-hidden="true" autoComplete="off" readOnly />

                {/* Admin Email */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Admin Email *
                  </label>
                  <input
                    type="email"
                    name="admin_email_clean"
                    id="admin_email_clean"
                    autoComplete="new-password"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter administrator email"
                    required
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[#0f2952] focus:border-[#0f2952]"
                  />
                </div>

                {/* Master Password */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-medium text-slate-700">
                      Master Password *
                    </label>
                    <button
                      type="button"
                      onClick={() => alert('Admin master password recovery must be executed via server console.')}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="admin_password_clean"
                      id="admin_password_clean"
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      required
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm pr-9 focus:outline-none focus:ring-1 focus:ring-[#0f2952] focus:border-[#0f2952]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 px-4 rounded-lg bg-[#0f2952] hover:bg-[#1a3a6b] text-white font-semibold text-sm transition-colors shadow-sm disabled:opacity-50"
                >
                  {loading ? 'Verifying admin credentials...' : 'Continue to Admin Verification Code \u2192'}
                </button>
              </form>

              <div className="mt-4 text-center text-xs text-slate-600">
                Not an administrator?{' '}
                <button
                  type="button"
                  onClick={() => onSwitchModal('user-signin')}
                  className="text-blue-600 hover:underline font-medium"
                >
                  User sign-in
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

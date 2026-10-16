import React, { useState, useEffect } from 'react';
import {
  X,
  Eye,
  EyeOff,
  Check,
  Shield,
  AlertTriangle
} from 'lucide-react';
import { loginUser, registerUser } from '../../api/client';
import { User } from '../../types';

export type AuthModalType = 'admin-login' | 'user-signin' | 'create-account' | null;

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

  // Clear every single field immediately whenever the modal opens or switches
  useEffect(() => {
    setError(null);
    setEmail('');
    setPassword('');
    setFullName('');
    setShowPassword(false);
  }, [activeModal]);

  if (!activeModal) return null;

  // The 5 visual conditions matching page 3 of user manual
  const hasMinLength = password.length >= 10;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>_+=~`\-/\\[\]]/.test(password);

  const isPasswordValid = hasMinLength && (hasUppercase || hasLowercase) && hasDigit && hasSpecial;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

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
        const res = await loginUser(cleanEmail, password);
        if (activeModal === 'admin-login' && res.user.role !== 'admin') {
          setError('This sign-in accepts Admin accounts only. Access refused with AUTH_FORBIDDEN.');
          setLoading(false);
          return;
        }
        onAuthSuccess(res.user, res.token);
      } else {
        const res = await registerUser(cleanEmail, password, 'user');
        onAuthSuccess(res.user, res.token);
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

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
          {/* 1. CREATE ACCOUNT (Page 3 of Manual)                     */}
          {/* ======================================================== */}
          {activeModal === 'create-account' && (
            <div>
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                Create Account
              </h2>
              <p className="text-xs text-slate-500 mt-1 mb-6">
                Fields marked * are required.
              </p>

              {error && (
                <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
                {/* Decoys to block browser autofill */}
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
                    placeholder="Enter your email"
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

                {/* CONDITIONS FOR THE PASSWORD (Displayed directly as in manual Page 3) */}
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

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 px-4 rounded-lg bg-[#0f2952] hover:bg-[#1a3a6b] text-white font-semibold text-sm transition-colors shadow-sm disabled:opacity-50"
                >
                  {loading ? 'Creating account...' : 'Create account'}
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
          {/* 2. USER SIGN IN (Page 3 of Manual)                       */}
          {/* ======================================================== */}
          {activeModal === 'user-signin' && (
            <div>
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                Sign In
              </h2>
              <p className="text-xs text-slate-500 mt-1 mb-6">
                Fields marked * are required.
              </p>

              {error && (
                <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
                {/* Decoys to block browser autofill */}
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

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 px-4 rounded-lg bg-[#0f2952] hover:bg-[#1a3a6b] text-white font-semibold text-sm transition-colors shadow-sm disabled:opacity-50"
                >
                  {loading ? 'Signing in...' : 'Sign in'}
                </button>
              </form>

              {/* Bottom links matching page 3 */}
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
          {/* 3. ADMINISTRATOR PORTAL (Page 9 of Manual)               */}
          {/* ======================================================== */}
          {activeModal === 'admin-login' && (
            <div>
              {/* Header with Shield Icon */}
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

              {/* Yellow Warning Callout Box (Page 9 of manual) */}
              <div className="my-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs leading-relaxed flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="block font-semibold mb-0.5">Administrators only.</strong>
                  This sign-in accepts Admin accounts only. Any other account is refused with
                  AUTH_FORBIDDEN, and the attempt is recorded in the audit log.
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
                {/* Decoys to block browser autofill */}
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

                {/* Password conditions reminder */}
                <div className="text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-200 space-y-0.5">
                  <span className="font-semibold block text-slate-600">Password Requirements:</span>
                  <div>&bull; At least 10 characters</div>
                  <div>&bull; Uppercase & lowercase letters</div>
                  <div>&bull; At least one digit and special character (!@#$%)</div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 px-4 rounded-lg bg-[#0f2952] hover:bg-[#1a3a6b] text-white font-semibold text-sm transition-colors shadow-sm disabled:opacity-50"
                >
                  {loading ? 'Verifying admin credentials...' : 'Sign in as administrator'}
                </button>
              </form>

              {/* Link back to user sign-in matching page 9 */}
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

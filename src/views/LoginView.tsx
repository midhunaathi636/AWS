import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { ApiError } from '../services/api';
import { ShieldCheck, Lock, Mail, ArrowRight, Eye, EyeOff, CheckCircle2, Shield, Network, KeyRound } from 'lucide-react';

export const LoginView: React.FC = () => {
  const { login, users } = useApp();
  const [email, setEmail] = useState('vikram.sharma@apollohospitals.demo');
  const [password, setPassword] = useState('Demo@123');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSubmitted, setForgotSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [challengeToken, setChallengeToken] = useState('');
  const [otpCode, setOtpCode] = useState('');

  const authenticate = async (userEmail: string, userPassword: string, options?: { challengeToken?: string; otp?: string }) => {
    const activeChallenge = options?.challengeToken ?? (challengeToken || undefined);
    const activeOtp = options?.otp ?? (activeChallenge ? otpCode : undefined);

    const result = await login(
      userEmail.trim(),
      userPassword,
      activeChallenge,
      activeOtp
    );

    if (result.twoFactorRequired) {
      setChallengeToken(result.challengeToken || '');
      setOtpCode('');
      setError('');
      return { requiresTwoFactor: true as const };
    }

    setChallengeToken('');
    setOtpCode('');
    setError('');
    return { requiresTwoFactor: false as const };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    setIsLoading(true);
    setError('');

    try {
      if (challengeToken && otpCode.length !== 6) {
        setError('Enter the 6-digit authenticator code.');
        return;
      }
      await authenticate(email, password);
    } catch (reason) {
<<<<<<< HEAD
      setError(reason instanceof ApiError ? reason.message : (reason instanceof Error ? reason.message : 'Unable to sign in. Check that the API is reachable.'));
=======
      setError(reason instanceof ApiError ? reason.message : 'Unable to sign in.');
>>>>>>> 514487f1417facee680f6075cc0a134e4bea40df
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickPersona = async (userEmail: string) => {
    if (isLoading) return;

    setEmail(userEmail);
    setPassword('Demo@123');
    setChallengeToken('');
    setOtpCode('');
    setIsLoading(true);
    setError('');

    try {
      await authenticate(userEmail, 'Demo@123', { challengeToken: undefined, otp: undefined });
    } catch (reason) {
<<<<<<< HEAD
      setError(reason instanceof ApiError ? reason.message : (reason instanceof Error ? reason.message : 'Unable to sign in. Check that the API is reachable.'));
=======
      setError(reason instanceof ApiError ? reason.message : 'Unable to sign in.');
>>>>>>> 514487f1417facee680f6075cc0a134e4bea40df
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Left Column: Visual Security Collaboration Presentation */}
      <div className="lg:w-1/2 p-8 lg:p-14 bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white flex flex-col justify-between relative overflow-hidden">
        {/* Subtle background circuit pattern */}
        <div className="absolute inset-0 opacity-10 pointer-events-none bg-[radial-gradient(#2563eb_1px,transparent_1px)] [background-size:16px_16px]" />

        {/* Top brand */}
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight block">
                Secure Collaborative Learning Platform
              </span>
              <span className="text-xs text-blue-200/80 block">
                Privacy-Preserving Cloud Data Sharing & Federated Machine Learning
              </span>
            </div>
          </div>
        </div>

        {/* Architectural Illustration / Key pillars */}
        <div className="relative z-10 my-10 space-y-6">
          <div className="space-y-2">
            <h2 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-white leading-tight">
              Collaborative Medical AI Without Moving Sensitive Patient Records
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed max-w-lg">
              Explore collaborative model training with encrypted dataset storage and auditable access controls. Production privacy and compliance review is still required.
            </p>
          </div>

          {/* Privacy Guarantees Cards */}
          <div className="grid sm:grid-cols-2 gap-3.5 pt-2">
            <div className="p-3.5 rounded-lg bg-white/5 border border-white/10 backdrop-blur-xs">
              <div className="flex items-center gap-2 text-blue-400 font-semibold text-xs mb-1">
                <Shield className="w-4 h-4" />
                <span>Encrypted Dataset Storage</span>
              </div>
              <p className="text-xs text-slate-300 leading-snug">
                Uploaded files are encrypted at rest with AES-256-GCM.
              </p>
            </div>

            <div className="p-3.5 rounded-lg bg-white/5 border border-white/10 backdrop-blur-xs">
              <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs mb-1">
                <Network className="w-4 h-4" />
                <span>Federated Averaging</span>
              </div>
              <p className="text-xs text-slate-300 leading-snug">
                The current trainer runs locally after decrypting selected datasets on the API host.
              </p>
            </div>

            <div className="p-3.5 rounded-lg bg-white/5 border border-white/10 backdrop-blur-xs">
              <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs mb-1">
                <KeyRound className="w-4 h-4" />
                <span>Differential Privacy (DP)</span>
              </div>
              <p className="text-xs text-slate-300 leading-snug">
                Optional simulation noise is available; no formal privacy budget is calculated.
              </p>
            </div>

            <div className="p-3.5 rounded-lg bg-white/5 border border-white/10 backdrop-blur-xs">
              <div className="flex items-center gap-2 text-purple-400 font-semibold text-xs mb-1">
                <CheckCircle2 className="w-4 h-4" />
                <span>Audit Verification</span>
              </div>
              <p className="text-xs text-slate-300 leading-snug">
                Audit record hashes can be checked. New records are hash chained locally.
              </p>
            </div>
          </div>
        </div>

        {/* Bottom trust footer */}
        <div className="relative z-10 pt-4 border-t border-white/10 text-xs text-slate-400 flex items-center justify-between">
          <span>Enterprise Health Data Federation</span>
          <span>Version 2.4.0 (Production)</span>
        </div>
      </div>

      {/* Right Column: Clean SaaS Sign In Form */}
      <div className="lg:w-1/2 p-8 lg:p-14 flex flex-col justify-between items-center bg-white dark:bg-slate-900">
        <div className="w-full max-w-md my-auto">
          {/* Form Header */}
          <div className="mb-7">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Platform Authentication
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Enter your enterprise credentials to access the federated workspace
            </p>
          </div>

          {/* Quick Demo Personas */}
          <div className="mb-6 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
            <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 block mb-2">
              Select Demo Persona (Instant Test):
            </span>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleQuickPersona('vikram.sharma@apollohospitals.demo')}
                className="p-2 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-left hover:border-blue-500 transition-colors shadow-xs"
              >
                <span className="text-[11px] font-bold text-slate-900 dark:text-white block truncate">
                  Admin User
                </span>
                <span className="text-[10px] text-blue-600 dark:text-blue-400 block truncate">
                  Apollo Hospital
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickPersona('rajesh.kulkarni@fortishealthcare.demo')}
                className="p-2 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-left hover:border-blue-500 transition-colors shadow-xs"
              >
                <span className="text-[11px] font-bold text-slate-900 dark:text-white block truncate">
                  Doctor
                </span>
                <span className="text-[10px] text-blue-600 dark:text-blue-400 block truncate">
                  Fortis Health
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickPersona('ananya.iyer@abcresearch.demo')}
                className="p-2 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-left hover:border-blue-500 transition-colors shadow-xs"
              >
                <span className="text-[11px] font-bold text-slate-900 dark:text-white block truncate">
                  Researcher
                </span>
                <span className="text-[10px] text-blue-600 dark:text-blue-400 block truncate">
                  ABC Labs
                </span>
              </button>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700" role="alert">{error}</p>}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Work Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={Boolean(challengeToken)}
                  placeholder="name@organization.com"
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={Boolean(challengeToken)}
                  placeholder="••••••••••••"
                  className="w-full pl-9 pr-10 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {challengeToken && <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Authenticator code</label>
              <input type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" required value={otpCode} onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="6-digit code" className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white" />
              <button type="button" onClick={() => { setChallengeToken(''); setOtpCode(''); setError(''); }} className="mt-1 text-[11px] text-blue-600 hover:underline">Restart sign-in</button>
            </div>}

            <div className="flex items-center justify-between text-xs">
              <label className="flex items-center gap-2 cursor-pointer text-slate-600 dark:text-slate-400 select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span>Remember this terminal</span>
              </label>

              <button
                type="button"
                onClick={() => {
                  setShowForgotPasswordModal(true);
                  setForgotSubmitted(false);
                }}
                className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
              >
                Forgot Password?
              </button>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isLoading ? (
                <span>Validating Credentials...</span>
              ) : (
                <>
                  <span>{challengeToken ? 'Verify Code' : 'Sign In to Federation'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            {/* Google Sign In UI Only */}
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200 dark:border-slate-800" />
              </div>
              <div className="relative flex justify-center text-[10px] uppercase">
                <span className="bg-white dark:bg-slate-900 px-2 text-slate-400">
                  Or continue with Single Sign-On
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleQuickPersona('vikram.sharma@apollohospitals.demo')}
              className="w-full py-2 px-3 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Sign In with Google Workspace</span>
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="w-full text-center text-xs text-slate-400 pt-6 border-t border-slate-100 dark:border-slate-800">
          <span>Secure Collaboration Platform © 2026. All rights reserved.</span>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
              Reset Security Credentials
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Enter your verified healthcare organization email to receive an asymmetric cryptographic recovery token.
            </p>

            {forgotSubmitted ? (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg text-xs text-emerald-800 dark:text-emerald-300 space-y-2">
                <p className="font-semibold">Recovery Dispatch Sent</p>
                <p>If the account exists, hardware token verification instructions have been transmitted.</p>
                <button
                  type="button"
                  onClick={() => setShowForgotPasswordModal(false)}
                  className="w-full mt-2 py-1.5 bg-emerald-600 text-white rounded text-xs font-semibold"
                >
                  Return to Login
                </button>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setForgotSubmitted(true);
                }}
                className="space-y-3"
              >
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Registered Email
                  </label>
                  <input
                    type="email"
                    required
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="name@apollohospitals.demo"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowForgotPasswordModal(false)}
                    className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Send Recovery Token
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

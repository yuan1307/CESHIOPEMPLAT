
import React, { useState } from 'react';
import { User, Teacher, FeatureFlags } from '../types';
import { ADMIN_ID, DEFAULT_FLAGS, SUPER_ADMIN_ID_2 } from '../constants';
import { db } from '../services/db';
import { audit } from '../services/audit';
import { GraduationCap, BookOpen, AlertCircle, Loader2, RefreshCw, CheckCircle2, ArrowRight, Lock, User as UserIcon, Mail, KeyRound, X, Settings, Power } from 'lucide-react';
import { useLanguage } from '../LanguageContext';

interface AuthProps {
  onLogin: (user: User, remember: boolean) => void;
}

const Auth: React.FC<AuthProps> = ({ onLogin }) => {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'student' | 'teacher'>('student');
  
  // Form States
  const [isRegister, setIsRegister] = useState(false);
  const [id, setId] = useState(''); 
  const [email, setEmail] = useState(''); 
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [remember, setRemember] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [pendingApproval, setPendingApproval] = useState(false);
  
  // New Flow States
  const [showEmailConfirm, setShowEmailConfirm] = useState(false);
  const [showForgotPass, setShowForgotPass] = useState(false);
  const [resetEmailInput, setResetEmailInput] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreed) return;

    setError('');
    setLoading(true);

    const cleanId = id.trim();
    let userKey = `basis_user_${cleanId.toLowerCase()}`;
    if (activeTab === 'student' && !cleanId.includes('@')) {
        userKey = `basis_user_${cleanId}`;
    }

    try {
        // Fetch latest flags directly from DB to ensure lockdown check is accurate
        const flags = await db.getItem<FeatureFlags>('basis_feature_flags') || DEFAULT_FLAGS;

        if (isRegister) {
            if (flags.isSystemLockdown) {
                setError("System is currently under maintenance. New registrations are disabled.");
                setLoading(false);
                return;
            }
            if (!email.includes('@')) { setError("Please provide a valid email address."); setLoading(false); return; }

            let role: any = activeTab === 'student' ? (cleanId === ADMIN_ID ? 'admin' : 'student') : 'teacher';
            
            if (activeTab === 'teacher') {
                const teachers = await db.getItem<Teacher[]>('basis_teachers') || [];
                const matched = teachers.find(t => t.email.toLowerCase() === email.toLowerCase());
                if (!matched) { setError(t.auth.errorEmail); setLoading(false); return; }
            }

            try {
                await db.auth.signUp(email, password, { id: cleanId, name, role });
            } catch (authError: any) {
                if (authError.message.includes("already registered")) { setError(t.auth.errorExists); } else { setError(authError.message); }
                setLoading(false); return;
            }

            const profileKey = activeTab === 'student' ? `basis_user_${cleanId}` : `basis_user_${email.toLowerCase()}`;
            const newUserProfile: User = {
                id: activeTab === 'student' ? cleanId : email.toLowerCase(),
                name,
                role,
                email: email.toLowerCase(),
                isBanned: false,
                isApproved: activeTab !== 'teacher'
            };
            
            await db.setItem(profileKey, newUserProfile);

            if (activeTab === 'teacher') { setPendingApproval(true); } else { setShowEmailConfirm(true); }

        } else {
            const isEmailLogin = cleanId.includes('@');
            let loginEmail = isEmailLogin ? cleanId : '';
            let userProfile: User | null = null;

            if (!isEmailLogin) {
                userProfile = await db.getItem<User>(userKey);
            } else {
                const allUsers = await db.scan<User>('basis_user_');
                const match = allUsers.find(u => u.value.email?.toLowerCase() === loginEmail.toLowerCase() || u.value.id.toLowerCase() === loginEmail.toLowerCase());
                if (match) userProfile = match.value;
            }

            if (userProfile && userProfile.email) { loginEmail = userProfile.email; }

            // CRITICAL: Check Lockdown State - ONLY Role 'admin' can bypass
            if (flags.isSystemLockdown) {
                if (!userProfile || userProfile.role !== 'admin') {
                    setError("PLATFORM UNDER MAINTENANCE: Access is currently restricted to primary Administrators only.");
                    setLoading(false);
                    return;
                }
            }

            try {
                if (loginEmail) { await db.auth.signIn(loginEmail, password); } else { throw new Error("No email associated with this ID."); }
            } catch (authError: any) {
                if (userProfile && userProfile.password === password) {
                    console.log("Fallback login successful via local password match.");
                } else {
                    if (authError.message.includes("Invalid login")) { setError(t.auth.errorPass); } 
                    else if (authError.message.includes("Email not confirmed")) { setError("Please verify your email address before logging in."); } 
                    else { setError("Login failed. " + authError.message); }
                    setLoading(false); return;
                }
            }

            if (!userProfile) {
                if (!isEmailLogin) { userProfile = await db.getItem<User>(userKey); } 
                else {
                     const allUsers = await db.scan<User>('basis_user_');
                     const match = allUsers.find(u => u.value.email?.toLowerCase() === loginEmail.toLowerCase());
                     if (match) userProfile = match.value;
                }
            }

            if (!userProfile) { setError(t.auth.errorUserNotFound); setLoading(false); return; }
            
            // SECURITY PATCH: Immunity for primary admins
            const isPrimaryAdmin = userProfile.id === ADMIN_ID || userProfile.id === SUPER_ADMIN_ID_2;
            
            if (userProfile.isBanned && !isPrimaryAdmin) { 
                setError(t.auth.errorBanned); 
                setLoading(false); 
                return; 
            }

            // AUTO-FIX: If a primary admin was banned, restore their status immediately upon login
            if (userProfile.isBanned && isPrimaryAdmin) {
                userProfile.isBanned = false;
                await db.setItem(userKey, userProfile);
            }

            if (userProfile.role === 'teacher' && userProfile.isApproved === false) { setError(t.auth.errorPending); setLoading(false); return; }

            await audit.logAction(userProfile, 'LOGIN');
            onLogin(userProfile, remember);
        }
    } catch (err) {
        console.error(err);
        setError("Network error. Please try syncing.");
    } finally {
        setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!resetEmailInput) return;
      setResetLoading(true);
      setError('');
      try {
          await db.auth.resetPasswordEmail(resetEmailInput);
          alert("Password reset instructions have been sent to your email.");
          setShowForgotPass(false);
          setResetEmailInput('');
      } catch (err: any) {
          alert("Error: " + (err.message || "Failed to send reset email."));
      } finally {
          setResetLoading(false);
      }
  };

  const handleSync = async () => {
      setSyncing(true);
      try {
          const count = await db.pullCloudData();
          alert(`${t.auth.syncSuccess} (Updated ${count} items)`);
      } catch (e) {
          setError("Sync failed. Check internet.");
      } finally {
          setSyncing(false);
      }
  };

  if (showEmailConfirm) return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6 font-sans">
          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-3xl shadow-soft border border-white/50 dark:border-slate-800 w-full max-w-md p-8 text-center animate-in zoom-in-95">
              <div className="w-16 h-16 bg-brand-50 dark:bg-brand-900/30 rounded-full flex items-center justify-center text-brand-600 dark:text-brand-400 mb-6 mx-auto"><Mail size={32}/></div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Check Your Email</h2>
              <p className="text-slate-600 dark:text-slate-300 mb-8 leading-relaxed text-sm">We've sent a confirmation link to <strong>{email}</strong>. Please confirm to activate your account.</p>
              <button onClick={() => { setShowEmailConfirm(false); setIsRegister(false); setEmail(''); setPassword(''); }} className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-semibold py-3 rounded-xl hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors shadow-lg shadow-slate-200/50 dark:shadow-none">{t.auth.backLogin}</button>
          </div>
      </div>
  );

  if (pendingApproval) return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6 font-sans">
          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-3xl shadow-soft border border-white/50 dark:border-slate-800 w-full max-w-md p-8 text-center animate-in zoom-in-95">
              <div className="w-16 h-16 bg-green-50 dark:bg-green-900/30 rounded-full flex items-center justify-center text-green-600 dark:text-green-400 mb-6 mx-auto"><CheckCircle2 size={32}/></div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">{t.auth.regSuccessTitle}</h2>
              <p className="text-slate-600 dark:text-slate-300 mb-8 leading-relaxed text-sm">{t.auth.regSuccessMsg}</p>
              <button onClick={() => { setPendingApproval(false); setIsRegister(false); }} className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-semibold py-3 rounded-xl hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors shadow-lg shadow-slate-200/50 dark:shadow-none">{t.auth.backLogin}</button>
          </div>
      </div>
  );

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 font-sans relative overflow-hidden transition-colors duration-200">
      {/* Decorative Background Elements */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-brand-200 dark:bg-brand-900/30 rounded-full blur-[120px] opacity-30 pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-5%] w-[400px] h-[400px] bg-indigo-200 dark:bg-indigo-900/30 rounded-full blur-[100px] opacity-30 pointer-events-none"></div>

      <div className="w-full max-w-md bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl rounded-[2rem] shadow-soft border border-white/50 dark:border-slate-800 overflow-hidden relative z-10 transition-colors duration-200">
        <div className="p-8 pb-6 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-br from-brand-500 to-brand-700 rounded-xl text-white mb-6 shadow-glow"><GraduationCap size={24} /></div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">{t.auth.title}</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-2 font-medium tracking-wide">{t.auth.subtitle}</p>
        </div>

        <div className="px-8 mb-6">
            <div className="flex bg-slate-100/50 dark:bg-slate-800/50 p-1 rounded-2xl border border-slate-200/50 dark:border-slate-700/50">
                <button onClick={() => { setActiveTab('student'); setIsRegister(false); setError(''); setId(''); setPassword(''); setEmail(''); setAgreed(false); }} className={`flex-1 py-2.5 text-sm font-semibold rounded-xl flex items-center justify-center gap-2 transition-all duration-200 ${activeTab === 'student' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'}`}><UserIcon size={16} /> {t.auth.studentLogin}</button>
                <button onClick={() => { setActiveTab('teacher'); setIsRegister(false); setError(''); setId(''); setPassword(''); setEmail(''); setAgreed(false); }} className={`flex-1 py-2.5 text-sm font-semibold rounded-xl flex items-center justify-center gap-2 transition-all duration-200 ${activeTab === 'teacher' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'}`}><BookOpen size={16} /> {t.auth.teacherLogin}</button>
            </div>
        </div>

        <div className="px-8 pb-8">
            <form onSubmit={handleSubmit} className="space-y-5">
                {isRegister && (
                    <div className="space-y-1.5 animate-in slide-in-from-top-2">
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider ml-1">{activeTab === 'teacher' ? `${t.auth.fullName} (${t.auth.teacherNameHint})` : t.auth.fullName}</label>
                        <div className="relative"><UserIcon className="absolute left-4 top-3.5 text-slate-400 dark:text-slate-500" size={18} /><input type="text" required value={name} onChange={e => setName(e.target.value)} className="w-full pl-11 pr-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500/20 dark:focus:ring-brand-500/40 focus:border-brand-500 outline-none text-sm font-medium transition-all shadow-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500" placeholder={activeTab === 'teacher' ? "Registered Name" : "John Doe"}/></div>
                    </div>
                )}
                
                <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider ml-1">{activeTab === 'student' ? (isRegister ? t.auth.studentId : "Student ID or Email") : t.auth.emailInput}</label>
                    <div className="relative">
                        <div className="absolute left-4 top-3.5 text-slate-400 dark:text-slate-500 font-bold text-xs">{activeTab === 'student' && !id.includes('@') ? '#' : '@'}</div>
                        <input type={activeTab === 'teacher' || (activeTab === 'student' && id.includes('@')) ? "email" : "text"} required value={id} onChange={e => setId(e.target.value)} className="w-full pl-11 pr-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500/20 dark:focus:ring-brand-500/40 focus:border-brand-500 outline-none text-sm font-medium transition-all shadow-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500" placeholder={activeTab === 'student' ? (isRegister ? "e.g. 14548" : "ID or name@example.com") : "name@basischina.com"} />
                    </div>
                </div>

                {isRegister && activeTab === 'student' && (
                    <div className="space-y-1.5 animate-in slide-in-from-top-2">
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider ml-1">{t.auth.emailInput}</label>
                        <div className="relative"><Mail className="absolute left-4 top-3.5 text-slate-400 dark:text-slate-500" size={18} /><input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full pl-11 pr-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500/20 dark:focus:ring-brand-500/40 focus:border-brand-500 outline-none text-sm font-medium transition-all shadow-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500" placeholder="name@example.com" /></div>
                    </div>
                )}

                <div className="space-y-1.5">
                    <div className="flex justify-between items-center ml-1"><label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t.common.password}</label>{!isRegister && <button type="button" onClick={() => setShowForgotPass(true)} className="text-[10px] text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 font-bold tracking-wide">FORGOT?</button>}</div>
                    <div className="relative"><Lock className="absolute left-4 top-3.5 text-slate-400 dark:text-slate-500" size={18} /><input type="password" required value={password} onChange={e => setPassword(e.target.value)} className="w-full pl-11 pr-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500/20 dark:focus:ring-brand-500/40 focus:border-brand-500 outline-none text-sm font-medium transition-all shadow-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500" placeholder="••••••••"/></div>
                </div>

                <div className="flex items-center gap-2 ml-1 mt-2">
                    <input type="checkbox" id="remember" checked={remember} onChange={e => setRemember(e.target.checked)} className="rounded text-brand-600 focus:ring-brand-500 w-4 h-4 border-slate-300 dark:border-slate-600 cursor-pointer"/>
                    <label htmlFor="remember" className="text-sm text-slate-600 dark:text-slate-400 font-medium cursor-pointer select-none">{t.auth.rememberMe}</label>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 p-3 rounded-xl flex items-start gap-3">
                    <input type="checkbox" id="agree" checked={agreed} onChange={e => setAgreed(e.target.checked)} className="mt-0.5 rounded text-brand-600 focus:ring-brand-500 w-4 h-4 border-slate-300 dark:border-slate-600 cursor-pointer" />
                    <label htmlFor="agree" className="text-[10px] text-slate-500 dark:text-slate-400 leading-snug cursor-pointer select-none">{t.auth.acknowledge}</label>
                </div>

                {error && <div className="text-red-600 dark:text-red-400 text-xs font-bold bg-red-50 dark:bg-red-900/20 p-3 rounded-xl border border-red-100 dark:border-red-900/30 flex items-center gap-2 animate-in shake"><AlertCircle size={16} className="shrink-0" /> {error}</div>}

                <button type="submit" disabled={loading || !agreed} className="w-full bg-brand-600 hover:bg-brand-700 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-brand-500/30 hover:shadow-brand-500/40 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                    {loading ? <Loader2 className="animate-spin" size={20} /> : <>{isRegister ? t.auth.createAccount : t.auth.signIn} <ArrowRight size={18} /></>}
                </button>
            </form>

            <div className="mt-6 flex flex-col gap-4">
                <button onClick={() => { setIsRegister(!isRegister); setError(''); setAgreed(false); }} className="text-sm text-slate-500 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 font-bold transition-colors text-center">{isRegister ? t.auth.alreadyHave : t.auth.firstTime}</button>
                <div className="border-t border-slate-100 dark:border-slate-800 pt-4 flex justify-center">
                    <button onClick={handleSync} disabled={syncing} className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-bold flex items-center gap-1.5 hover:text-brand-600 dark:hover:text-brand-400 transition-colors bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700">
                        {syncing ? <Loader2 className="animate-spin" size={10} /> : <RefreshCw size={10} />} {t.auth.sync}
                    </button>
                </div>
            </div>
        </div>
      </div>
      
      {showForgotPass && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in">
              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-6 w-full max-w-sm relative border border-white/20 dark:border-slate-800">
                  <button onClick={() => setShowForgotPass(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"><X size={20}/></button>
                  <div className="text-center mb-6">
                      <div className="w-12 h-12 bg-brand-50 dark:bg-brand-900/30 rounded-full flex items-center justify-center text-brand-600 dark:text-brand-400 mx-auto mb-3"><KeyRound size={24}/></div>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white">Reset Password</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Enter your email for a recovery link.</p>
                  </div>
                  <form onSubmit={handleResetPassword} className="space-y-4">
                      <input required type="email" value={resetEmailInput} onChange={e => setResetEmailInput(e.target.value)} className="w-full border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-xl p-3 text-sm focus:ring-2 focus:ring-brand-500/20 dark:focus:ring-brand-500/40 outline-none placeholder-slate-400 dark:placeholder-slate-500" placeholder="Email Address"/>
                      <button type="submit" disabled={resetLoading} className="w-full bg-brand-600 text-white font-bold py-3 rounded-xl hover:bg-brand-700 transition-colors flex justify-center items-center gap-2">
                          {resetLoading ? <Loader2 className="animate-spin" size={18} /> : "Send Link"}
                      </button>
                  </form>
              </div>
          </div>
      )}
    </div>
  );
};

export default Auth;

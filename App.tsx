
import * as React from 'react';
import { useState, useEffect } from 'react';
import Auth from './components/Auth';
import AdminDashboard from './components/AdminDashboard';
import TeacherDashboard from './components/TeacherDashboard';
import ClassModal from './components/ClassModal';
import ToDoPage from './components/ToDoPage';
import CommunityPage from './components/CommunityPage';
import GPACalculator from './components/GPACalculator';
import ContactUs from './components/ContactUs';
import AssessmentCalendar from './components/AssessmentCalendar';
import ResetPasswordModal from './components/ResetPasswordModal';
import UserProfileModal from './components/UserProfileModal';
import ScheduleGrid from './components/ScheduleGrid';
import AIImportModal from './components/AIImportModal';
import StudentAIHub from './components/StudentAIHub';
import MorningBriefing from './components/MorningBriefing';
import { User, ClassPeriod, AppState, Teacher, Warning, Broadcast, FeatureFlags, CommunityPost, AssessmentEvent, ScheduleMap, SystemAnnouncement } from './types';
import { WEEKDAYS, DEFAULT_TEACHERS, DEFAULT_SUBJECTS, ADMIN_ID, DEFAULT_FLAGS, SUPER_ADMIN_ID_2, LANGUAGES, DEFAULT_PASSWORD } from './constants';
import { db } from './services/db';
import { LogOut, Calculator, ShieldCheck, CheckSquare, CalendarDays, KeyRound, Eye, MessageSquare, AlertTriangle, GraduationCap, Radio, Loader2, Wifi, WifiOff, Calendar, Globe, RefreshCw, Menu, X, Download, Sparkles, User as UserIcon, Sun, Moon, Shield, Bell, Briefcase } from 'lucide-react';
import { useLanguage } from './LanguageContext';

const App: React.FC = () => {
  const { language, setLanguage, t } = useLanguage();
  const [state, setState] = useState<AppState>({
    user: null,
    schedule: {},
    grades: [],
    view: 'student'
  });

  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [resetPassModalOpen, setResetPassModalOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [activeCell, setActiveCell] = useState<{day: string, slot: number} | null>(null);
  const [activeWarning, setActiveWarning] = useState<Warning | null>(null);
  const [activeBroadcast, setActiveBroadcast] = useState<Broadcast | null>(null);
  const [loading, setLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [flags, setFlags] = useState<FeatureFlags>(DEFAULT_FLAGS);
  const [adminNotificationCount, setAdminNotificationCount] = useState(0);
  const [aiImportOpen, setAiImportOpen] = useState(false);
  const [studentAIHubOpen, setStudentAIHubOpen] = useState(false);
  const [aiInitialMessage, setAiInitialMessage] = useState<string | undefined>(undefined);
  const [announcements, setAnnouncements] = useState<SystemAnnouncement[]>([]);
  const [dismissedAnnouncements, setDismissedAnnouncements] = useState<string[]>([]);
  
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
      if (typeof localStorage !== 'undefined' && localStorage.getItem('theme')) {
          return localStorage.getItem('theme') as 'light' | 'dark';
      }
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
      return 'light';
  });

  useEffect(() => {
      if (theme === 'dark') document.documentElement.classList.add('dark');
      else document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

  useEffect(() => {
    if (!state.user || state.spectatingUserId) return;
    const updatePresence = async () => {
        const userId = state.user?.id;
        if (!userId) return;
        const userKey = `basis_user_${userId}`;
        const freshUser = await db.getItem<User>(userKey);
        if (freshUser) await db.setItem(userKey, { ...freshUser, lastSeen: Date.now() });
    };
    updatePresence();
    const interval = setInterval(updatePresence, 60000);
    return () => clearInterval(interval);
  }, [state.user, state.spectatingUserId]);

  useEffect(() => {
    const init = async () => {
        setLoading(true);
        const connected = await db.checkConnection();
        setIsConnected(connected);

        let savedTeachers = await db.getItem<Teacher[]>('basis_teachers');
        if (!savedTeachers) {
            await db.setItem('basis_teachers', DEFAULT_TEACHERS);
            savedTeachers = DEFAULT_TEACHERS;
        }
        setTeachers(savedTeachers);

        let savedSubjects = await db.getItem<string[]>('basis_subjects');
        if (!savedSubjects) {
            await db.setItem('basis_subjects', DEFAULT_SUBJECTS);
            savedSubjects = DEFAULT_SUBJECTS;
        }
        setSubjects(savedSubjects);
        
        const savedFlags = await db.getItem<FeatureFlags>('basis_feature_flags');
        if (savedFlags) setFlags(savedFlags);
        else await db.setItem('basis_feature_flags', DEFAULT_FLAGS);

        const savedAnnouncements = await db.getItem<SystemAnnouncement[]>('basis_system_announcements');
        if (savedAnnouncements) setAnnouncements(savedAnnouncements);

        const rememberedId = localStorage.getItem('basis_remembered_uid');
        if (rememberedId) {
            await loadUserData({ id: rememberedId } as User);
        } else {
            const sessionUserStr = sessionStorage.getItem('basis_current_user');
            if (sessionUserStr) {
                try {
                    const sessionUser = JSON.parse(sessionUserStr);
                    await loadUserData(sessionUser);
                } catch (e) {
                    handleLogout();
                }
            }
        }
        setLoading(false);
    };
    init();

    const { data: authListener } = db.auth.onAuthStateChange(async (event, session) => {
        if (event === 'PASSWORD_RECOVERY') setResetPassModalOpen(true); 
        if ((event === 'SIGNED_IN' || event === 'PASSWORD_RECOVERY') && session?.user && !state.user) {
            const userId = session.user.user_metadata?.id || session.user.email;
            if (userId) {
                let profile = await db.getItem<User>(`basis_user_${userId}`);
                if (!profile && session.user.email) profile = await db.getItem<User>(`basis_user_${session.user.email}`);
                if (profile) await loadUserData(profile);
            }
        }
    });
    return authListener?.subscription.unsubscribe;
  }, []);

  useEffect(() => {
      const poll = async () => {
          if (!state.user || !isConnected) return;
          const freshUser = await db.getItem<User>(`basis_user_${state.user?.id}`);
          if (freshUser) {
              const unackWarning = freshUser.warnings?.find((w: Warning) => !w.acknowledged);
              if (unackWarning && (!activeWarning || activeWarning.id !== unackWarning.id)) setActiveWarning(unackWarning);
              if (!activeWarning && !unackWarning) {
                  const unackBroadcast = freshUser.broadcasts?.find((b: Broadcast) => !b.acknowledged);
                  if (unackBroadcast && (!activeBroadcast || activeBroadcast.id !== unackBroadcast.id)) setActiveBroadcast(unackBroadcast);
              }
          }

          const currentFlags = await db.getItem<FeatureFlags>('basis_feature_flags') || DEFAULT_FLAGS;
          setFlags(currentFlags);

          if (currentFlags.isSystemLockdown && state.user && state.user.role !== 'admin') {
              alert("PLATFORM UNDER MAINTENANCE: The system has been locked by a Super Administrator. Logging out.");
              handleLogout();
              return;
          }

          const currentAnnouncements = await db.getItem<SystemAnnouncement[]>('basis_system_announcements') || [];
          setAnnouncements(currentAnnouncements);

          if (state.user && (state.user.role === 'admin' || state.user.role === 'secondary_admin')) {
              const posts = await db.getItem<CommunityPost[]>('basis_community_posts') || [];
              const events = await db.getItem<AssessmentEvent[]>('basis_assessment_events') || [];
              const tickets = await db.getItem<any[]>('basis_support_tickets') || [];
              setAdminNotificationCount(posts.filter(p => p.status === 'pending').length + events.filter(e => e.status === 'pending').length + tickets.filter(t => t.status === 'open').length);
          }
      };
      const interval = setInterval(poll, 10000);
      return () => interval && clearInterval(interval);
  }, [state.user, isConnected, activeWarning, activeBroadcast]);

  const loadUserData = async (potentialUser: User) => {
      let realUser: User | null = null;
      const online = await db.checkConnection();
      if (online) {
          realUser = await db.verifyUserStrict(potentialUser.id);
          if (!realUser) { handleLogout(); return; }
      } else {
          realUser = await db.getItem<User>(`basis_user_${potentialUser.id}`);
      }
      if (!realUser) { handleLogout(); return; }
      if (potentialUser.password && realUser.password !== potentialUser.password) { handleLogout(); return; }
      const currentUser = realUser;

      // IMMUNITY CHECK: Admins cannot be banned
      const isPrimaryAdmin = currentUser.id === ADMIN_ID || currentUser.id === SUPER_ADMIN_ID_2;
      if (currentUser.isBanned && !isPrimaryAdmin) { handleLogout(); return; }

      const currentFlags = await db.getItem<FeatureFlags>('basis_feature_flags') || DEFAULT_FLAGS;
      if (currentFlags.isSystemLockdown && currentUser.role !== 'admin') {
          handleLogout();
          return;
      }

      const scheduleKey = `basis_schedule_${currentUser.id}`;
      const savedSchedule = await db.getItem<any>(scheduleKey);
      const isRegisteredTeacher = teachers.some(t => t.email.toLowerCase() === currentUser.id.toLowerCase() || t.id === currentUser.id);
      const shouldUseTeacherView = currentUser.role === 'teacher' || isRegisteredTeacher;
      setState(prev => ({
          ...prev,
          user: currentUser,
          schedule: savedSchedule || {},
          view: currentUser.id === SUPER_ADMIN_ID_2 ? 'admin' : (shouldUseTeacherView ? 'teacher_dashboard' : 'student'),
          spectatingUserId: undefined,
          impersonatedUser: undefined
      }));
  };

  const handleLogin = async (user: User, remember: boolean) => {
    sessionStorage.setItem('basis_current_user', JSON.stringify(user));
    if (remember) localStorage.setItem('basis_remembered_uid', user.id);
    else localStorage.removeItem('basis_remembered_uid');
    await loadUserData(user);
  };

  const handleLogout = () => {
    db.clearLocalData();
    db.auth.signOut().catch(console.error);
    setState(prev => ({ ...prev, user: null, schedule: {}, impersonatedUser: undefined }));
    setActiveWarning(null);
    setActiveBroadcast(null);
  };

  const updateSchedule = async (period: ClassPeriod) => {
    const updatedSchedule = { ...state.schedule };
    updatedSchedule[period.id] = period;
    if (period.subject) {
        Object.keys(updatedSchedule).forEach(key => {
            const p = updatedSchedule[key];
            if (p.subject === period.subject) {
                updatedSchedule[key] = { ...p, teacherName: period.teacherName, teacherId: period.teacherId, room: period.room, tasks: period.tasks };
            }
        });
    }
    const targetUserId = state.impersonatedUser?.id || state.spectatingUserId || state.user?.id;
    if (targetUserId) {
        await db.setItem(`basis_schedule_${targetUserId}`, updatedSchedule);
        setState(prev => ({ ...prev, schedule: updatedSchedule }));
    }
    setModalOpen(false);
  };
  
  const handleBulkScheduleUpdate = async (newSchedule: ScheduleMap) => {
      const mergedSchedule = { ...state.schedule };
      Object.keys(newSchedule).forEach(key => {
          const newItem = newSchedule[key];
          const existing = mergedSchedule[key] || { id: key, tasks: [] };
          mergedSchedule[key] = { ...existing, subject: newItem.subject || '', teacherName: newItem.teacherName, teacherId: newItem.teacherId, room: newItem.room, tasks: newItem.tasks || existing.tasks || [] };
      });
      const targetUserId = state.impersonatedUser?.id || state.spectatingUserId || state.user?.id;
      if (targetUserId) {
          await db.setItem(`basis_schedule_${targetUserId}`, mergedSchedule);
          setState(prev => ({ ...prev, schedule: mergedSchedule }));
      }
  };

  const deleteTask = async (periodId: string, taskId: string) => {
      const period = state.schedule[periodId];
      if (!period) return;
      const updatedPeriod = { ...period, tasks: period.tasks.filter(t => t.id !== taskId) };
      await updateSchedule(updatedPeriod);
  };

  const copyDay = async (fromDay: string) => {
    const targetDay = prompt(t.schedule.copyPrompt.replace('{day}', fromDay));
    if (!targetDay || !WEEKDAYS.includes(targetDay)) return;
    const newSchedule = { ...state.schedule };
    for (let i = 0; i < 8; i++) {
        const srcId = `${fromDay}-${i}`;
        const destId = `${targetDay}-${i}`;
        const srcPeriod = newSchedule[srcId];
        if (srcPeriod) newSchedule[destId] = { ...srcPeriod, id: destId, tasks: [] };
    }
    const targetUserId = state.impersonatedUser?.id || state.spectatingUserId || state.user?.id;
    if (targetUserId) {
        await db.setItem(`basis_schedule_${targetUserId}`, newSchedule);
        setState(prev => ({ ...prev, schedule: newSchedule }));
    }
  };

  const handleAddTeacher = async (teacher: Teacher, createAccount: boolean) => {
    const newTeachers = [...teachers, teacher];
    setTeachers(newTeachers);
    await db.setItem('basis_teachers', newTeachers);

    if (createAccount) {
      const newUser: User = {
        id: teacher.email.toLowerCase(),
        name: teacher.name,
        role: 'teacher',
        email: teacher.email.toLowerCase(),
        isBanned: false,
        isApproved: true,
        password: DEFAULT_PASSWORD
      };
      await db.setItem(`basis_user_${newUser.id}`, newUser);
    }
  };

  const handleDeleteTeacher = async (id: string) => {
    if (!window.confirm(t.modals.areYouSure)) return;
    const newTeachers = teachers.filter(t => t.id !== id);
    setTeachers(newTeachers);
    await db.setItem('basis_teachers', newTeachers);
  };

  const handleAddSubject = async (newSubs: string[]) => {
    const updated = [...subjects, ...newSubs.filter(s => !subjects.includes(s))];
    setSubjects(updated);
    await db.setItem('basis_subjects', updated);
  };

  const handleDeleteSubject = async (sub: string) => {
    if (!window.confirm(t.modals.areYouSure)) return;
    const updated = subjects.filter(s => s !== sub);
    setSubjects(updated);
    await db.setItem('basis_subjects', updated);
  };

  const handleStressDetected = () => {
      setAiInitialMessage("I noticed you've been feeling stressed lately. Want me to break down the latest topic into simpler terms or help you plan your study time?");
      setStudentAIHubOpen(true);
  };

  const acknowledgeWarning = async () => {
      if (!state.user || !activeWarning) return;
      const updatedWarnings = state.user.warnings?.map(w => w.id === activeWarning.id ? { ...w, acknowledged: true, acknowledgedDate: new Date().toISOString() } : w);
      const updatedUser = { ...state.user, warnings: updatedWarnings };
      await db.setItem(`basis_user_${state.user.id}`, updatedUser);
      setState(prev => ({ ...prev, user: updatedUser }));
      setActiveWarning(null);
  };

  const acknowledgeBroadcast = async () => {
      if (!state.user || !activeBroadcast) return;
      const updatedBroadcasts = state.user.broadcasts?.map(b => b.id === activeBroadcast.id ? { ...b, acknowledged: true, acknowledgedDate: new Date().toISOString() } : b);
      const updatedUser = { ...state.user, broadcasts: updatedBroadcasts };
      await db.setItem(`basis_user_${state.user.id}`, updatedUser);
      setState(prev => ({ ...prev, user: updatedUser }));
      setActiveBroadcast(null);
  };

  const dismissAnnouncement = (id: string) => {
      setDismissedAnnouncements(prev => [...prev, id]);
  };

  const getPeriod = (day: string, slot: number): ClassPeriod => { const id = `${day}-${slot}`; return state.schedule[id] || { id, subject: '', tasks: [] }; };
  
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950"><Loader2 className="animate-spin text-brand-600" size={48} /></div>;

  if (!state.user) return (
      <>
          <div className="fixed top-4 right-4 z-[110] flex gap-2">
               <button onClick={toggleTheme} className="text-slate-600 dark:text-white hover:text-brand-400 p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 bg-white/50 dark:bg-black/50 backdrop-blur transition-colors shadow-sm">{theme === 'light' ? <Moon size={20}/> : <Sun size={20}/>}</button>
               <div className="relative group z-50">
                  <button className="text-slate-600 dark:text-white hover:text-brand-400 p-2 rounded hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors" title="Switch Language"><Globe size={20}/></button>
                  <div className="absolute right-0 top-full pt-2 hidden group-hover:block min-w-[140px] z-50">
                      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl py-1 animate-in fade-in zoom-in-95">
                          {LANGUAGES.map(l => (<button key={l.code} onClick={() => setLanguage(l.code as any)} className={`block w-full text-left px-4 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-800 ${language === l.code ? 'font-bold text-brand-400 bg-slate-50 dark:bg-slate-800' : 'text-slate-700 dark:text-slate-300'}`}>{l.label}</button>))}
                      </div>
                  </div>
               </div>
          </div>
          <Auth onLogin={handleLogin} />
      </>
  );

  const isImpersonating = !!state.impersonatedUser;
  const isRegisteredTeacher = teachers.some(t => t.email.toLowerCase() === state.user?.id.toLowerCase() || t.id === state.user?.id);
  const isTeacherLogically = state.user.role === 'teacher' || isRegisteredTeacher;
  const isAdminLogically = state.user.role === 'admin' || state.user.role === 'secondary_admin';

  // HANDLE ADMIN VIEW
  if ((state.view === 'admin' || state.user.id === SUPER_ADMIN_ID_2) && !isImpersonating && isAdminLogically) {
    return (
      <div className="bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 min-h-screen transition-colors duration-200">
        <div className={`fixed bottom-4 right-4 z-[100] px-3 py-1.5 rounded-full text-[10px] font-bold flex items-center gap-2 shadow-lg ${isConnected ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'}`}>{isConnected ? <Wifi size={12} /> : <WifiOff size={12} />}{isConnected ? t.status.cloudConnected : t.status.offline}</div>
        <AdminDashboard currentUser={state.user} onLogout={handleLogout} onSwitchView={() => setState(prev => ({ ...prev, view: isTeacherLogically ? 'teacher_dashboard' : 'student' }))} onSpectate={async (uid) => { const sch = await db.getItem<any>(`basis_schedule_${uid}`); setState(p => ({ ...p, view: 'spectate', spectatingUserId: uid, schedule: sch || {} })); }} onImpersonate={async (uid) => { const tu = await db.getItem<User>(`basis_user_${uid}`); const sch = await db.getItem<any>(`basis_schedule_${uid}`); if(tu) setState(p => ({ ...p, impersonatedUser: tu, schedule: sch || {}, view: tu.role === 'teacher' ? 'teacher_dashboard' : 'student' })); }} teachers={teachers} onAddTeacher={handleAddTeacher} onDeleteTeacher={handleDeleteTeacher} subjects={subjects} onAddSubject={handleAddSubject} onDeleteSubject={handleDeleteSubject} />
      </div>
    );
  }

  // SHARED GLOBAL VIEWS (Privacy, Terms, Contact)
  const sharedViews = ['contact_us', 'privacy', 'terms'];
  const isViewingShared = sharedViews.includes(state.view);

  if (isViewingShared) {
      return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col font-sans text-slate-900 dark:text-slate-100 transition-colors duration-200">
             <header className="sticky top-0 z-40 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="w-full px-4 md:px-8 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setState(p => ({...p, view: isTeacherLogically ? 'teacher_dashboard' : 'student'}))}>
                            <div className="w-9 h-9 bg-brand-600 rounded-lg flex items-center justify-center text-white font-bold text-xl shadow-glow">
                                <GraduationCap size={22} />
                            </div>
                            <span className="font-black text-lg md:text-xl tracking-tighter text-slate-900 dark:text-white">OPEN PLATFORM</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <button onClick={() => setState(prev => ({ ...prev, view: isTeacherLogically ? 'teacher_dashboard' : 'student' }))} className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors border border-slate-200 dark:border-slate-700">
                           <Briefcase size={16}/> {t.common.back}
                        </button>
                    </div>
                </div>
             </header>
             <main className="flex-1 overflow-x-hidden">
                {state.view === 'contact_us' && <ContactUs currentUser={state.user!} featureFlags={flags} />}
                {state.view === 'privacy' && (
                    <div className="max-w-3xl mx-auto p-8 text-slate-700 dark:text-slate-300 leading-relaxed animate-in fade-in slide-in-from-bottom-2">
                        <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-6">Privacy Policy</h2>
                        <div className="space-y-6">
                            <p>Open Platform is a student-developed educational management tool. We value your privacy and aim to be transparent about how data is handled within this experimental environment.</p>
                            <section>
                                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">1. Data Storage</h3>
                                <p>Your academic schedule, tasks, and grades are stored in two primary locations: your browser's local storage for offline access, and a secure Supabase instance to enable cross-device synchronization.</p>
                            </section>
                            <section>
                                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">2. Information Collection</h3>
                                <p>We only collect the data you explicitly provide: Student ID, Name, and academic data. We do not track location or use cookies for advertising purposes.</p>
                            </section>
                            <section>
                                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">3. Data Security</h3>
                                <p>While we use standard encryption for data in transit, please remember this is an experimental project. Users are encouraged to use unique credentials.</p>
                            </section>
                        </div>
                    </div>
                )}
                {state.view === 'terms' && (
                    <div className="max-w-3xl mx-auto p-8 text-slate-700 dark:text-slate-300 leading-relaxed animate-in fade-in slide-in-from-bottom-2">
                        <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-6">Terms of Service</h2>
                        <div className="space-y-6">
                            <p>By using Open Platform, you agree to the following terms regarding this experimental educational project.</p>
                            <section>
                                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">1. Experimental Nature</h3>
                                <p>This software is provided "as is" without warranty of any kind. It is developed by students for educational purposes and may contain bugs or experience periods of downtime.</p>
                            </section>
                            <section>
                                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">2. Limitation of Liability</h3>
                                <p>The developers shall not be held liable for any data loss, account discrepancies, or academic consequences resulting from the use of this software. Users are responsible for maintaining backups of their own schedules.</p>
                            </section>
                            <section>
                                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">3. Acceptable Use</h3>
                                <p>Users must adhere to standard school conduct when using community features. AI-based moderation is active to prevent inappropriate content.</p>
                            </section>
                        </div>
                    </div>
                )}
             </main>
             <footer className="bg-white dark:bg-slate-950 text-slate-900 dark:text-white py-16 px-4 border-t border-slate-200 dark:border-slate-800 no-print">
                <div className="max-w-7xl mx-auto flex flex-col items-center text-center">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-9 h-9 bg-brand-600 rounded-lg flex items-center justify-center text-white shadow-glow">
                            <GraduationCap size={22} />
                        </div>
                        <span className="font-black text-xl tracking-tighter">OPEN PLATFORM</span>
                    </div>
                    <div className="flex flex-wrap justify-center gap-x-10 gap-y-4 text-[10px] font-black tracking-[0.2em] text-slate-500 dark:text-slate-400 uppercase">
                        <button onClick={() => setState(prev => ({...prev, view: 'contact_us'}))} className="hover:text-brand-600 dark:hover:text-brand-400 transition-colors">Contact Support</button>
                        <button onClick={() => setState(prev => ({...prev, view: 'privacy'}))} className="hover:text-brand-600 dark:hover:text-brand-400 transition-colors">PRIVACY POLICY</button>
                        <button onClick={() => setState(prev => ({...prev, view: 'terms'}))} className="hover:text-brand-600 dark:hover:text-brand-400 transition-colors">TERMS OF SERVICE</button>
                    </div>
                </div>
            </footer>
        </div>
      );
  }
  
  // TEACHER PORTAL
  if (state.view === 'teacher_dashboard' || (isTeacherLogically && !isImpersonating) || (state.impersonatedUser?.role === 'teacher')) {
    return (
        <div className="bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 min-h-screen transition-colors duration-200">
            {isImpersonating && <div className="bg-purple-600 text-white p-2 text-center font-bold text-sm sticky top-0 z-[110]">{t.nav.viewing} {state.impersonatedUser?.name}. <button onClick={() => setState(p => ({...p, impersonatedUser: undefined, view: 'admin'}))} className="underline ml-2">{t.nav.exit}</button></div>}
            <TeacherDashboard 
                user={state.impersonatedUser || state.user!} 
                onLogout={state.impersonatedUser ? () => setState(p => ({...p, impersonatedUser: undefined, view: 'admin'})) : handleLogout} 
                onSwitchToCommunity={() => {}} 
                onSwitchToAdmin={() => setState(prev => ({ ...prev, view: 'admin' }))} 
                toggleTheme={toggleTheme} 
                theme={theme}
                onSwitchView={(v: any) => setState(prev => ({ ...prev, view: v }))} 
            />
        </div>
    );
  }

  const activeAnnouncements = announcements.filter(a => !dismissedAnnouncements.includes(a.id));

  // STUDENT PORTAL (Standard)
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col font-sans text-slate-900 dark:text-slate-100 transition-colors duration-200">
      <div className={`fixed bottom-4 right-4 z-[100] px-3 py-1.5 rounded-full text-[10px] font-bold flex items-center gap-2 shadow-lg ${isConnected ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'}`}>{isConnected ? <Wifi size={12} /> : <WifiOff size={12} />}{isConnected ? t.status.cloudConnected : t.status.offline}</div>
      
      {activeWarning && <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4 backdrop-blur-sm"><div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 text-slate-900"><div className="bg-orange-600 text-white p-6 flex flex-col items-center"><div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mb-3"><AlertTriangle size={40} /></div><h2 className="text-2xl font-bold">Administrator Message</h2></div><div className="p-8 text-slate-800 dark:text-slate-200"><div className="bg-orange-50 dark:bg-orange-900/20 border-l-4 border-orange-500 p-4 mb-6"><p className="text-orange-800 dark:text-orange-200 leading-relaxed">{activeWarning.message}</p></div><button onClick={acknowledgeWarning} className="w-full px-6 py-3 bg-orange-600 text-white font-bold rounded-xl hover:bg-orange-700">{t.common.confirm}</button></div></div></div>}
      {activeBroadcast && <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4 backdrop-blur-sm"><div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 text-slate-900"><div className="bg-brand-600 text-white p-6 flex flex-col items-center"><div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mb-3"><Radio size={32} /></div><h2 className="text-2xl font-bold">{t.teacher.newBroadcast}</h2><p className="text-brand-100 mt-1">{t.common.teacher}: {activeBroadcast.teacherName}</p></div><div className="p-8 text-slate-800 dark:text-slate-200"><div className="bg-brand-50 dark:bg-brand-900/20 border-l-4 border-brand-500 p-4 mb-6"><p className="font-bold text-brand-800 dark:text-brand-200 text-lg mb-2">{activeBroadcast.title}</p><p className="text-brand-600 dark:text-brand-300 leading-relaxed text-sm">{activeBroadcast.message}</p></div><button onClick={acknowledgeBroadcast} className="w-full px-6 py-3 bg-brand-600 text-white font-bold rounded-xl hover:bg-orange-700">{t.common.confirm}</button></div></div></div>}

      {flags.enableAITutor && studentAIHubOpen && <StudentAIHub isOpen={true} onClose={() => { setStudentAIHubOpen(false); setAiInitialMessage(undefined); }} schedule={state.schedule} currentUser={state.user!} initialAutoMessage={aiInitialMessage} />}
      {flags.enableAITutor && <div className="fixed bottom-6 left-6 z-50 no-print animate-in fade-in slide-in-from-bottom-4"><button onClick={() => setStudentAIHubOpen(true)} className="bg-brand-600 text-white p-4 rounded-full shadow-xl hover:bg-brand-700 transition-all flex items-center gap-2 group"><Sparkles size={24} /><span className="font-semibold hidden md:inline">{t.ai.hub}</span></button></div>}

      <header className="sticky top-0 z-40 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="w-full px-4 md:px-8 py-3 flex items-center justify-between">
            <div className="flex items-center gap-6">
                <div className="flex items-center gap-3 cursor-pointer" onClick={() => setState(p => ({...p, view: 'student'}))}>
                    <div className="w-9 h-9 bg-brand-600 rounded-lg flex items-center justify-center text-white font-bold text-xl shadow-glow">
                        <GraduationCap size={22} />
                    </div>
                    <span className="font-black text-lg md:text-xl tracking-tighter text-slate-900 dark:text-white">OPEN PLATFORM</span>
                </div>
                <nav className="hidden md:flex bg-slate-100 dark:bg-slate-800/50 p-1 rounded-xl gap-1 border border-slate-200 dark:border-slate-800">
                    {[
                        {id: 'schedule', icon: <CalendarDays size={18}/>}, 
                        {id: 'todo', icon: <CheckSquare size={18}/>}, 
                        {id: 'calendar', icon: <Calendar size={18}/>}, 
                        {id: 'community', icon: <MessageSquare size={18}/>}, 
                        {id: 'gpa', icon: <Calculator size={18}/>}
                    ].map(v => (
                        (v.id !== 'calendar' || flags.enableCalendar) && (v.id !== 'gpa' || flags.enableGPA) && (v.id !== 'community' || flags.enableCommunity) &&
                        <button 
                            key={v.id} 
                            onClick={() => setState(p => ({...p, view: v.id === 'schedule' ? 'student' : v.id as any}))} 
                            className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${(state.view === 'student' && v.id === 'schedule') || state.view === v.id ? 'bg-brand-600 text-white shadow-lg' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-white dark:hover:bg-slate-800'}`}
                        >
                            {v.icon} {t.nav[v.id as keyof typeof t.nav] || v.id}
                        </button>
                    ))}
                </nav>
            </div>
            <div className="flex items-center gap-4">
                <button onClick={toggleTheme} className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors" title="Toggle Theme">{theme === 'light' ? <Moon size={20}/> : <Sun size={20}/>}</button>
                {isAdminLogically && (
                    <button 
                      onClick={() => setState(prev => ({ ...prev, view: 'admin' }))} 
                      className="text-slate-500 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors p-1.5" 
                      title="Admin Dashboard"
                    >
                        <Shield size={20} />
                    </button>
                )}
                <button onClick={() => setProfileModalOpen(true)} className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 transition-all border border-slate-200 dark:border-slate-700 shadow-sm"><UserIcon size={18} /></button>
                <button onClick={handleLogout} className="text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-500 transition-colors"><LogOut size={20} /></button>
            </div>
        </div>
      </header>

      <div className="no-print pointer-events-none flex flex-col items-center gap-2 pt-2 px-2 md:px-4 sticky top-[60px] z-[35]">
          {activeAnnouncements.map(ann => (
              <div key={ann.id} className="pointer-events-auto w-full bg-red-600/95 dark:bg-red-700/90 backdrop-blur-md text-white px-5 py-3.5 flex items-center justify-between rounded-2xl shadow-xl shadow-red-600/10 animate-in slide-in-from-top-4 border border-white/20">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="bg-white/20 p-2 rounded-xl shrink-0">
                        <Bell size={18} />
                      </div>
                      <p className="text-sm md:text-base font-black tracking-tight leading-tight truncate md:whitespace-normal">
                        {ann.message}
                      </p>
                  </div>
                  <button 
                    onClick={() => dismissAnnouncement(ann.id)} 
                    className="p-2 hover:bg-white/20 rounded-xl transition-all ml-4 shrink-0 active:scale-90"
                    aria-label="Dismiss announcement"
                  >
                      <X size={20} strokeWidth={3} />
                  </button>
              </div>
          ))}
      </div>
      
      <main className="flex-1 overflow-x-hidden">
        {state.view === 'todo' && <ToDoPage schedule={state.schedule} onDeleteTask={deleteTask} onUpdateSchedule={handleBulkScheduleUpdate} />}
        {state.view === 'community' && <CommunityPage currentUser={state.user!} subjects={subjects} teachers={teachers} />}
        {state.view === 'calendar' && flags.enableCalendar && <AssessmentCalendar currentUser={state.user!} schedule={state.schedule} subjects={subjects} teachers={teachers} onScheduleUpdate={handleBulkScheduleUpdate}/>}
        {state.view === 'gpa' && flags.enableGPA && <GPACalculator userId={state.user!.id} />}
        
        {(state.view === 'student' || state.view === 'spectate') && (
            <div className="p-4 md:p-6 max-w-[1600px] mx-auto w-full">
                {state.user && flags.enableBriefing && <MorningBriefing schedule={state.schedule} user={state.user} />}
                <div className="flex justify-end gap-3 mb-4 no-print">
                    {flags.enableAIImport && <button onClick={() => setAiImportOpen(true)} className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg font-bold text-sm shadow-md flex items-center gap-2 transition-all"><Sparkles size={16} />{t.schedule.aiImport}</button>}
                    <button onClick={() => window.print()} className="bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 px-4 py-2 rounded-lg font-bold text-sm shadow-sm flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"><Download size={16} /> {t.nav.exportPdf}</button>
                </div>
                <ScheduleGrid schedule={state.schedule} onCellClick={(day, slot) => { setActiveCell({ day, slot }); setModalOpen(true); }} onCopyDay={copyDay} currentUser={state.user || undefined} onStressDetected={handleStressDetected} />
            </div>
        )}
      </main>

      <footer className="bg-white dark:bg-slate-950 text-slate-900 dark:text-white py-16 px-4 border-t border-slate-200 dark:border-slate-800 no-print">
          <div className="max-w-7xl mx-auto flex flex-col items-center text-center">
              <div className="flex items-center gap-3 mb-6">
                  <div className="w-9 h-9 bg-brand-600 rounded-lg flex items-center justify-center text-white shadow-glow">
                      <GraduationCap size={22} />
                  </div>
                  <span className="font-black text-xl tracking-tighter">OPEN PLATFORM</span>
              </div>
              <p className="text-slate-500 dark:text-slate-400 text-sm max-w-md mb-10 leading-relaxed font-medium">
                  Designed to simplify academic life for students and teachers alike.
              </p>
              <div className="flex flex-wrap justify-center gap-x-10 gap-y-4 text-[10px] font-black tracking-[0.2em] text-slate-500 dark:text-slate-400 uppercase">
                  <button onClick={() => setState(prev => ({...prev, view: 'contact_us'}))} className="hover:text-brand-600 dark:hover:text-brand-400 transition-colors">Contact Support</button>
                  <button onClick={() => setState(prev => ({...prev, view: 'privacy'}))} className="hover:text-brand-600 dark:hover:text-brand-400 transition-colors">PRIVACY POLICY</button>
                  <button onClick={() => setState(prev => ({...prev, view: 'terms'}))} className="hover:text-brand-600 dark:hover:text-brand-400 transition-colors">TERMS OF SERVICE</button>
              </div>
          </div>
      </footer>

      {modalOpen && activeCell && <ClassModal period={getPeriod(activeCell.day, activeCell.slot)} isOpen={modalOpen} onClose={() => setModalOpen(false)} onSave={updateSchedule} day={activeCell.day} slotIndex={activeCell.slot} availableTeachers={teachers} availableSubjects={subjects} currentUserRole={state.user!.role} currentUserName={state.user!.name} />}
      {profileModalOpen && state.user && <UserProfileModal isOpen={profileModalOpen} onClose={() => setProfileModalOpen(false)} currentUser={state.user} onUpdateUser={(u) => { setState(p => ({ ...p, user: u })); sessionStorage.setItem('basis_current_user', JSON.stringify(u)); }} />}
      {aiImportOpen && <AIImportModal isOpen={aiImportOpen} onClose={() => setAiImportOpen(false)} onSave={handleBulkScheduleUpdate} availableTeachers={teachers} />}
    </div>
  );
};

export default App;

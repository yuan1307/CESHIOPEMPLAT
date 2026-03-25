
import React, { useState, useEffect } from 'react';
import { User, ScheduleMap, Task, Importance, Urgency, TaskCategory, ClassPeriod, Teacher, FeatureFlags, AppState } from '../types';
import { db } from '../services/db';
import { audit } from '../services/audit';
import { Users, Calendar, Megaphone, Trash2, Search, MessageSquare, History, Filter, Loader2, BarChart2, MapPin, ShieldCheck, Globe, RefreshCw, Sparkles, Sun, Moon, GraduationCap } from 'lucide-react';
import { TASK_CATEGORIES, WEEKDAYS, getSubjectColor, LANGUAGES, DEFAULT_FLAGS } from '../constants';
import { ConfirmBroadcastModal, ConfirmRemoveStudentModal, BroadcastStatusModal, ConfirmClearBroadcastsModal } from './AdminModals';
import AssessmentCalendar from './AssessmentCalendar';
import CommunityPage from './CommunityPage';
import ClassModal from './ClassModal';
import TeacherAIHub from './TeacherAIHub';
import { useLanguage } from '../LanguageContext';

interface TeacherDashboardProps { 
    user: User; 
    onLogout: () => void; 
    onSwitchToCommunity: () => void; 
    onSwitchToAdmin: () => void; 
    toggleTheme?: () => void; 
    theme?: 'light' | 'dark'; 
    onSwitchView: (v: 'contact_us' | 'privacy' | 'terms') => void;
}

interface EnrolledStudent { id: string; name: string; periods: string[]; subjects: string[]; }
interface BroadcastRecord { id: string; title: string; targetCount: number; date: string; filters: string; }

const TeacherDashboard: React.FC<TeacherDashboardProps> = ({ user, onLogout, onSwitchToAdmin, toggleTheme, theme, onSwitchView }) => {
  const { t, language, setLanguage } = useLanguage();
  const [activeTab, setActiveTab] = useState<'schedule' | 'roster' | 'broadcast' | 'community' | 'calendar'>('broadcast');
  const [roster, setRoster] = useState<EnrolledStudent[]>([]);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskCategory, setTaskCategory] = useState<TaskCategory>('Homework');
  const [taskDue, setTaskDue] = useState('');
  const [availableSubjects, setAvailableSubjects] = useState<string[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [selectedPeriods, setSelectedPeriods] = useState<string[]>([]);
  const [broadcastHistory, setBroadcastHistory] = useState<BroadcastRecord[]>([]);
  const [broadcastConfirmOpen, setBroadcastConfirmOpen] = useState(false);
  const [removeStudentData, setRemoveStudentData] = useState<{id: string, name: string} | null>(null);
  
  const [schedule, setSchedule] = useState<ScheduleMap>({});
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [activeCell, setActiveCell] = useState<{day: string, slot: number} | null>(null);
  const [allSubjects, setAllSubjects] = useState<string[]>([]);
  const [allTeachers, setAllTeachers] = useState<Teacher[]>([]);
  const [broadcastSearch, setBroadcastSearch] = useState('');
  const [trackBroadcastId, setTrackBroadcastId] = useState<string | null>(null);
  const [clearHistoryOpen, setClearHistoryOpen] = useState(false);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [featureFlags, setFeatureFlags] = useState<FeatureFlags>(DEFAULT_FLAGS);
  const [isAIHubOpen, setIsAIHubOpen] = useState(false);
  const [isDataLoading, setIsDataLoading] = useState(true);
  
  const canAccessAdmin = user.role === 'admin' || user.role === 'secondary_admin';

  useEffect(() => {
    const init = async () => {
        setIsDataLoading(true);
        if (activeTab === 'roster' || activeTab === 'broadcast') { 
            await Promise.all([fetchRoster(), loadBroadcastHistory()]); 
        }
        if (activeTab === 'schedule') { 
            await Promise.all([loadSchedule(), loadGlobalData()]); 
        }
        await loadFlags();
        setIsDataLoading(false);
    };
    init();
  }, [activeTab]);

  const loadFlags = async () => { const flags = await db.getItem<FeatureFlags>('basis_feature_flags'); if(flags) setFeatureFlags(flags); };
  const loadGlobalData = async () => { setAllSubjects(await db.getItem<string[]>('basis_subjects') || []); setAllTeachers(await db.getItem<Teacher[]>('basis_teachers') || []); };
  const loadSchedule = async () => { setSchedule(await db.getItem<ScheduleMap>(`basis_schedule_${user.id}`) || {}); };
  const loadBroadcastHistory = async () => { setBroadcastHistory(await db.getItem<BroadcastRecord[]>(`basis_broadcast_history_${user.id}`) || []); };

  const fetchRoster = async () => {
      setRosterLoading(true);
      const students: EnrolledStudent[] = [];
      const teacherName = user.name || '';
      const subjectsSet = new Set<string>();
      const schedules = await db.scan<ScheduleMap>('basis_schedule_');
      for (const { key, value: schedule } of schedules) {
          const studentId = key.replace('basis_schedule_', '');
          const userKey = `basis_user_${studentId}`;
          const studentUser = await db.getItem<User>(userKey);
          const studentName = studentUser?.name || 'Unknown';
          const periods: string[] = [];
          const studentSubjects: string[] = [];
          Object.values(schedule).forEach(period => {
              if (period.teacherName && (period.teacherName.toLowerCase() === teacherName.toLowerCase() || period.teacherName.toLowerCase().includes(teacherName.toLowerCase()))) {
                  periods.push(period.id);
                  if(period.subject) { subjectsSet.add(period.subject); if (!studentSubjects.includes(period.subject)) studentSubjects.push(period.subject); }
              }
          });
          if (periods.length > 0) { students.push({ id: studentId, name: studentName, periods, subjects: studentSubjects }); }
      }
      setRoster(students); setAvailableSubjects(Array.from(subjectsSet)); setRosterLoading(false);
  };

  const updateSchedule = async (period: ClassPeriod) => { const updatedSchedule = { ...schedule }; updatedSchedule[period.id] = period; setSchedule(updatedSchedule); await db.setItem(`basis_schedule_${user.id}`, updatedSchedule); setScheduleModalOpen(false); };
  const getPeriod = (day: string, slot: number): ClassPeriod => { const id = `${day}-${slot}`; return schedule[id] || { id, subject: '', tasks: [] }; };

  const confirmRemoveStudent = async () => {
      if (removeStudentData) {
          const scheduleKey = `basis_schedule_${removeStudentData.id}`;
          const schedule = await db.getItem<ScheduleMap>(scheduleKey);
          if (schedule) {
              const teacherName = user.name || '';
              Object.keys(schedule).forEach(key => {
                  const period = schedule[key];
                  if (period.teacherName && (period.teacherName.toLowerCase() === teacherName.toLowerCase() || period.teacherName.toLowerCase().includes(teacherName.toLowerCase()))) {
                      schedule[key] = { ...period, subject: '', teacherId: undefined, teacherName: undefined, tasks: [] };
                  }
              });
              await db.setItem(scheduleKey, schedule);
              fetchRoster();
          }
      }
  };

  const targetedStudents = (selectedSubjects.length === 0 && selectedPeriods.length === 0) ? roster : roster.filter(student => (selectedSubjects.length === 0 || student.subjects.some(s => selectedSubjects.includes(s))) && (selectedPeriods.length === 0 || student.periods.some(p => selectedPeriods.includes(p))));

  const confirmBroadcast = async () => {
      setIsBroadcasting(true);
      let count = 0;
      const today = new Date().toISOString().split('T')[0];
      const broadcastId = `b-${Date.now()}-${Math.random()}`;
      
      const BATCH_SIZE = 10;
      const studentsToProcess = [...targetedStudents];
      
      try {
          for (let i = 0; i < studentsToProcess.length; i += BATCH_SIZE) {
              const batch = studentsToProcess.slice(i, i + BATCH_SIZE);
              
              await Promise.all(batch.map(async (student) => {
                  let success = false;
                  const scheduleKey = `basis_schedule_${student.id}`;
                  const schedule = await db.getItem<ScheduleMap>(scheduleKey);
                  if (schedule) {
                      let updated = false;
                      student.periods.forEach(periodId => { 
                          if (schedule[periodId]) { 
                              schedule[periodId].tasks.push({ 
                                  id: `t-broad-${Date.now()}-${Math.random()}`, 
                                  title: taskTitle, 
                                  description: taskDesc, 
                                  category: taskCategory, 
                                  importance: Importance.High, 
                                  urgency: Urgency.High, 
                                  dueDate: taskDue, 
                                  completed: false, 
                                  source: 'teacher' 
                              }); 
                              updated = true; 
                          } 
                      });
                      if (updated) { 
                          await db.setItem(scheduleKey, schedule); 
                          success = true; 
                      }
                  }
                  
                  const userKey = `basis_user_${student.id}`;
                  const sUser = await db.getItem<User>(userKey);
                  if (sUser) { 
                      await db.setItem(userKey, { 
                          ...sUser, 
                          broadcasts: [...(sUser.broadcasts || []), { 
                              id: broadcastId, 
                              teacherName: user.name || 'Teacher', 
                              title: taskTitle, 
                              message: `New ${taskCategory}: ${taskDesc}`, 
                              date: today, 
                              acknowledged: false 
                          }] 
                      }); 
                  }
                  
                  if (success) count++;
              }));
          }

          const record: BroadcastRecord = { id: broadcastId, title: taskTitle, targetCount: count, date: new Date().toLocaleString(), filters: [selectedSubjects.length > 0 ? `Subj: ${selectedSubjects.join(', ')}` : 'All Subj', selectedPeriods.length > 0 ? `Per: ${selectedPeriods.join(', ')}` : 'All Per'].join(' | ') };
          const newHistory = [record, ...broadcastHistory];
          setBroadcastHistory(newHistory); 
          await db.setItem(`basis_broadcast_history_${user.id}`, newHistory);
          await audit.logAction(user, 'BROADCAST_TASK', undefined, undefined, `${taskTitle} to ${count} students`);
          
          alert(t.teacher.broadcastSent.replace('{count}', count.toString())); 
          setTaskTitle(''); setTaskDesc(''); setTaskDue(''); setSelectedSubjects([]); setSelectedPeriods([]);
      } catch (err) {
          console.error("Broadcast failed:", err);
          alert("An error occurred during broadcast. Some students may not have received the task.");
      } finally {
          setIsBroadcasting(false);
          setBroadcastConfirmOpen(false);
      }
  };

  const confirmClearBroadcasts = async () => {
      await db.setItem(`basis_broadcast_history_${user.id}`, []);
      setBroadcastHistory([]);
  };

  const HeaderLanguageSelector = () => (
    <div className="relative group">
        <button className="text-slate-600 dark:text-slate-300 hover:text-brand-600 dark:hover:text-brand-400 p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" title="Switch Language">
            <Globe size={20}/>
        </button>
        <div className="absolute right-0 top-full pt-2 hidden group-hover:block min-w-[140px] z-50">
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl py-1 animate-in fade-in zoom-in-95 text-slate-800 dark:text-slate-200">
                {LANGUAGES.map(l => (
                    <button key={l.code} onClick={() => setLanguage(l.code as any)} className={`block w-full text-left px-4 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 ${language === l.code ? 'font-bold text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-slate-700' : 'text-slate-700 dark:text-slate-300'}`}>
                        {l.label}
                    </button>
                ))}
            </div>
        </div>
    </div>
  );

  const filteredHistory = broadcastHistory.filter(r => r.title.toLowerCase().includes(broadcastSearch.toLowerCase()) || r.filters.toLowerCase().includes(broadcastSearch.toLowerCase()));

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100 flex flex-col relative">
      {(isDataLoading) && (
          <div className="absolute inset-0 bg-white/50 dark:bg-slate-950/50 z-[100] flex items-center justify-center backdrop-blur-sm">
              <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-xl flex items-center gap-4 border border-slate-100 dark:border-slate-700 animate-in zoom-in-95">
                  <Loader2 className="animate-spin text-brand-600" size={32} />
                  <div className="flex flex-col">
                      <span className="font-black text-slate-800 dark:text-white text-lg tracking-tight">Syncing Portal...</span>
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Hydrating school records</span>
                  </div>
              </div>
          </div>
      )}

      <ConfirmBroadcastModal isOpen={broadcastConfirmOpen} onClose={() => setBroadcastConfirmOpen(false)} count={targetedStudents.length} onConfirm={confirmBroadcast} />
      <ConfirmRemoveStudentModal isOpen={!!removeStudentData} onClose={() => setRemoveStudentData(null)} studentName={removeStudentData?.name || ''} onConfirm={confirmRemoveStudent} />
      <BroadcastStatusModal isOpen={!!trackBroadcastId} onClose={() => setTrackBroadcastId(null)} broadcastId={trackBroadcastId || ''} title={broadcastHistory.find(b => b.id === trackBroadcastId)?.title || ''} />
      <ConfirmClearBroadcastsModal isOpen={clearHistoryOpen} onClose={() => setClearHistoryOpen(false)} onConfirm={confirmClearBroadcasts} />
      
      <TeacherAIHub isOpen={isAIHubOpen} onClose={() => setIsAIHubOpen(false)} currentUser={user} />

      <nav className="bg-white dark:bg-slate-900 shadow-sm border-b border-slate-200 dark:border-slate-800 px-4 md:px-8 py-4 flex justify-between items-center sticky top-0 z-10">
          <div className="flex items-center gap-3"><div className="bg-brand-600 text-white p-2 rounded-lg"><Megaphone size={20} /></div><div><h1 className="text-lg md:text-xl font-bold text-slate-800 dark:text-white tracking-tight">{t.nav.teacherPortal}</h1><div className="text-xs text-slate-500 dark:text-slate-400 font-medium hidden md:block">{t.teacher.welcome}, {user.name}</div></div></div>
          <div className="flex items-center gap-2 md:gap-3">
            {toggleTheme && (
                <button onClick={toggleTheme} className="text-slate-600 dark:text-slate-300 hover:text-brand-600 dark:hover:text-brand-400 p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                    {theme === 'light' ? <Moon size={20}/> : <Sun size={20}/>}
                </button>
            )}
            <HeaderLanguageSelector />
            {canAccessAdmin && <button onClick={onSwitchToAdmin} className="text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 p-2 rounded-lg hover:bg-brand-50 dark:hover:bg-slate-800"><ShieldCheck size={20} /></button>}
            <button onClick={onLogout} className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 px-3 md:px-4 py-2 rounded-lg font-medium bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 text-sm md:text-base">{t.nav.logout}</button>
          </div>
      </nav>

      <div className="max-w-7xl mx-auto p-4 md:p-8 relative flex-1 w-full">
          <div className="flex gap-4 mb-6 overflow-x-auto pb-2 scrollbar-hide">
              {['schedule', 'roster', 'broadcast', 'community', 'calendar'].map((tab) => (
                  <button key={tab} onClick={() => setActiveTab(tab as any)} className={`flex-shrink-0 p-4 rounded-xl border font-bold text-left flex items-center gap-3 transition-colors ${activeTab === tab ? 'bg-white dark:bg-slate-800 border-brand-500 dark:border-brand-500 ring-1 ring-brand-500 shadow-sm text-slate-900 dark:text-white' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'}`}>
                      {tab === 'schedule' && <Calendar className={activeTab === tab ? 'text-brand-600 dark:text-brand-400' : 'text-slate-400'} />}
                      {tab === 'roster' && <Users className={activeTab === tab ? 'text-brand-600 dark:text-brand-400' : 'text-slate-400'} />}
                      {tab === 'broadcast' && <Megaphone className={activeTab === tab ? 'text-brand-600 dark:text-brand-400' : 'text-slate-400'} />}
                      {tab === 'community' && <MessageSquare className={activeTab === tab ? 'text-brand-600 dark:text-brand-400' : 'text-slate-400'} />}
                      {tab === 'calendar' && <Calendar className={activeTab === tab ? 'text-brand-600 dark:text-brand-400' : 'text-slate-400'} />}
                      <span className="capitalize whitespace-nowrap">{t.teacher[tab as keyof typeof t.teacher]}</span>
                  </button>
              ))}
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4 md:p-6 min-h-[500px]">
              {activeTab === 'schedule' && (
                   <div className="overflow-x-auto">
                        <div className="min-w-[800px] grid grid-cols-6 gap-0 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm bg-white dark:bg-slate-900 schedule-grid">
                            <div className="bg-slate-50 dark:bg-slate-800 p-2 border-b border-r border-slate-200 dark:border-slate-700 font-bold text-slate-500 dark:text-slate-400 text-center text-xs uppercase tracking-wider flex items-center justify-center">{t.schedule.period}</div>
                            {WEEKDAYS.map(day => (<div key={day} className="bg-slate-50 dark:bg-slate-800 p-2 border-b border-r border-slate-200 dark:border-slate-700 font-bold text-slate-700 dark:text-slate-300 text-center uppercase tracking-wider last:border-r-0 flex justify-between items-center group"><span className="flex-1 text-sm">{t.weekdays[day as keyof typeof t.weekdays]}</span></div>))}
                            {Array.from({ length: 8 }).map((_, i) => (
                                <React.Fragment key={i}>
                                    <div className="border-b border-r border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 p-2 flex items-center justify-center font-bold text-slate-400 dark:text-slate-500 text-xs">P{i + 1}</div>
                                    {WEEKDAYS.map(day => {
                                        const period = getPeriod(day, i);
                                        const hasSubject = !!period.subject;
                                        const bgColor = getSubjectColor(period.subject);
                                        return (
                                            <div key={`${day}-${i}`} onClick={() => { setActiveCell({ day, slot: i }); setScheduleModalOpen(true); }} className={`min-h-[5rem] border-b border-r border-slate-200 dark:border-slate-700 p-1 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 flex flex-col schedule-cell last:border-r-0 ${hasSubject ? '' : 'bg-white dark:bg-slate-900'}`} style={{ backgroundColor: hasSubject ? bgColor : undefined }}>
                                                {hasSubject ? (<><div className="font-bold text-xs leading-tight line-clamp-2 text-slate-800">{period.subject}</div>{period.room && <div className="text-[10px] text-slate-600 flex items-center gap-1 mt-1"><MapPin size={10}/> {period.room}</div>}</>) : <div className="h-full flex items-center justify-center opacity-0 hover:opacity-100 text-slate-300 dark:text-slate-600 text-[10px] uppercase font-bold">{t.schedule.free}</div>}
                                            </div>
                                        );
                                    })}
                                </React.Fragment>
                            ))}
                        </div>
                        {activeCell && <ClassModal isOpen={scheduleModalOpen} onClose={() => setScheduleModalOpen(false)} onSave={updateSchedule} day={activeCell.day} slotIndex={activeCell.slot} period={getPeriod(activeCell.day, activeCell.slot)} availableTeachers={allTeachers} availableSubjects={allSubjects} currentUserRole={user.role} currentUserName={user.name} />}
                   </div>
              )}
              {activeTab === 'calendar' && 
                <AssessmentCalendar 
                    currentUser={user} 
                    schedule={{}} 
                    subjects={availableSubjects} 
                    teachers={allTeachers} 
                    onScheduleUpdate={() => {}} 
                />
              }
              {activeTab === 'community' && <CommunityPage currentUser={user} subjects={availableSubjects} />}
              {activeTab === 'roster' && (
                  <div>
                      <div className="flex justify-between items-center mb-4">
                          <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2"><Users className="text-brand-600 dark:text-brand-400" size={20}/> {t.teacher.roster} ({roster.length})</h2>
                          <button onClick={fetchRoster} disabled={rosterLoading} className="text-xs bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 transition-colors">
                              <RefreshCw size={14} className={rosterLoading ? 'animate-spin' : ''}/> {t.nav.sync}
                          </button>
                      </div>
                      {rosterLoading ? <div className="text-center py-10 dark:text-slate-300"><Loader2 className="animate-spin inline mr-2"/>{t.common.loading}</div> : roster.length === 0 ? <div className="text-center py-10 text-slate-400 dark:text-slate-500">{t.teacher.noStudents}</div> : (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{roster.map(student => (<div key={student.id} className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg relative group bg-white dark:bg-slate-900"><div className="flex justify-between items-start"><div><div className="font-bold text-slate-800 dark:text-white">{student.name}</div><div className="text-xs text-slate-500 dark:text-slate-400 mb-2">ID: {student.id}</div></div><button onClick={() => setRemoveStudentData({id: student.id, name: student.name})} className="text-slate-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 p-1"><Trash2 size={16} /></button></div><div className="flex flex-col gap-1 mt-1">{student.subjects.map(subj => <div key={subj} className="text-xs font-bold text-brand-700 dark:text-brand-300">{subj}</div>)}<div className="flex flex-wrap gap-1">{student.periods.map(p => <span key={p} className="text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-300 font-mono">{p}</span>)}</div></div></div>))}</div>
                      )}
                  </div>
              )}
              {activeTab === 'broadcast' && (
                  <div className="flex flex-col lg:flex-row gap-8">
                      <div className="flex-1">
                          <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-4">{t.teacher.newBroadcast}</h2>
                          <div className="space-y-4 bg-slate-50 dark:bg-slate-900 p-4 md:p-6 rounded-xl border border-slate-200 dark:border-slate-700">
                                <div className="mb-4 bg-white dark:bg-slate-800 p-4 rounded-lg border border-slate-200 dark:border-slate-700"><div className="flex items-center gap-2 mb-2 font-bold text-sm text-slate-700 dark:text-slate-200"><Filter size={16} /> {t.teacher.targetAudience} ({targetedStudents.length})</div><div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><div><label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase mb-1 block">{t.common.subject}</label><div className="max-h-32 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-900 p-2 space-y-1">{availableSubjects.map(s => <label key={s} className="flex items-center gap-2 text-xs cursor-pointer dark:text-slate-300"><input type="checkbox" checked={selectedSubjects.includes(s)} onChange={() => setSelectedSubjects(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])} />{s}</label>)}</div></div><div><label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase mb-1 block">{t.schedule.period}</label><div className="max-h-32 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-900 p-2 space-y-1">{(Array.from(new Set(roster.flatMap(s => s.periods))) as string[]).sort().map(p => <label key={p} className="flex items-center gap-2 text-xs cursor-pointer dark:text-slate-300"><input type="checkbox" checked={selectedPeriods.includes(p)} onChange={() => setSelectedPeriods(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])} />{p}</label>)}</div></div></div></div>
                                <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">{t.common.title} <span className="text-red-500">*</span></label><input type="text" value={taskTitle} onChange={e => setTaskTitle(e.target.value)} className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-white rounded-lg p-2 text-sm" /></div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">{t.common.category}</label><select value={taskCategory} onChange={e => setTaskCategory(e.target.value as TaskCategory)} className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-white rounded-lg p-2 text-sm bg-white">{TASK_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div><div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">{t.common.dueDate} <span className="text-red-500">*</span></label><input type="date" value={taskDue} onChange={e => setTaskDue(e.target.value)} className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-white rounded-lg p-2 text-sm bg-white" /></div></div>
                                <div><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">{t.common.description}</label><textarea value={taskDesc} onChange={e => setTaskDesc(e.target.value)} className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-white rounded-lg p-2 text-sm h-20 resize-none" /></div>
                                <button onClick={() => setBroadcastConfirmOpen(true)} disabled={targetedStudents.length === 0 || isBroadcasting} className="w-full bg-brand-600 text-white font-bold py-2.5 rounded-lg hover:bg-brand-700 disabled:opacity-50 flex items-center justify-center gap-2">
                                    {isBroadcasting && <Loader2 className="animate-spin" size={16}/>}
                                    {t.teacher.broadcast}
                                </button>
                          </div>
                      </div>
                      <div className="w-full lg:w-80 border-t lg:border-t-0 lg:border-l border-slate-100 dark:border-slate-700 pt-6 lg:pt-0 lg:pl-8">
                          <div className="flex justify-between items-center mb-4">
                              <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2"><History size={20} /> {t.teacher.history}</h2>
                              <button onClick={() => setClearHistoryOpen(true)} className="text-xs text-red-500 hover:text-red-700 font-bold flex items-center gap-1"><Trash2 size={12}/> {t.teacher.clearHistory}</button>
                          </div>
                          <div className="mb-4 relative"><input type="text" placeholder={t.common.search} value={broadcastSearch} onChange={e => setBroadcastSearch(e.target.value)} className="w-full pl-8 p-2 border border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white rounded-lg text-sm" /><Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" /></div>
                          <div className="space-y-3 max-h-[600px] overflow-y-auto">{filteredHistory.map(rec => (<div key={rec.id} className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm"><div className="font-bold text-sm text-slate-800 dark:text-white">{rec.title}</div><div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{rec.date}</div><div className="text-xs text-brand-600 dark:text-brand-400 mt-1 font-medium">{rec.filters}</div><div className="flex justify-between items-center mt-2 border-t border-slate-100 dark:border-slate-800 pt-2"><span className="text-xs text-slate-500 dark:text-slate-400">{t.teacher.sentTo}: {rec.targetCount}</span><button onClick={() => setTrackBroadcastId(rec.id)} className="text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-2 py-1 rounded flex items-center gap-1"><BarChart2 size={12}/> {t.teacher.track}</button></div></div>))}</div>
                      </div>
                  </div>
              )}
          </div>
          
          {featureFlags.enableTeacherAI && (
              <button 
                  onClick={() => setIsAIHubOpen(true)}
                  className="fixed bottom-6 left-6 bg-purple-600 text-white p-4 rounded-full shadow-xl hover:bg-purple-700 transition-transform hover:scale-105 z-50 flex items-center gap-2 animate-in fade-in zoom-in"
                  title="Teacher AI Hub"
              >
                  <Sparkles size={24} />
                  <span className="font-bold hidden md:inline">{t.ai.hub}</span>
              </button>
          )}
      </div>

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
                  <button onClick={() => onSwitchView('contact_us')} className="hover:text-brand-600 dark:hover:text-brand-400 transition-colors">Contact Support</button>
                  <button onClick={() => onSwitchView('privacy')} className="hover:text-brand-600 dark:hover:text-brand-400 transition-colors">PRIVACY POLICY</button>
                  <button onClick={() => onSwitchView('terms')} className="hover:text-brand-600 dark:hover:text-brand-400 transition-colors">TERMS OF SERVICE</button>
              </div>
          </div>
      </footer>
    </div>
  );
};
export default TeacherDashboard;

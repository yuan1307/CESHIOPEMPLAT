
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { User, AssessmentEvent, ScheduleMap, Teacher, FeatureFlags, ClassPeriod, Importance, Urgency } from '../types';
import { db } from '../services/db';
import { audit } from '../services/audit';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, Search, Trash2, Filter, ChevronDown, Clock, User as UserIcon, PlusCircle, Megaphone, Loader2 } from 'lucide-react';
import { AddAssessmentModal, ConfirmDeleteAssessmentModal, ConfirmAddToToDoModal, ViewAssessmentModal } from './AssessmentModals';
import { GRADE_LEVELS, DEFAULT_FLAGS } from '../constants';
import { useLanguage } from '../LanguageContext';

interface AssessmentCalendarProps { currentUser: User; schedule: ScheduleMap; subjects: string[]; teachers: Teacher[]; onScheduleUpdate: (newSchedule: ScheduleMap) => void; }

const AssessmentCalendar: React.FC<AssessmentCalendarProps> = ({ currentUser, schedule, subjects, teachers, onScheduleUpdate }) => {
  const { t, language } = useLanguage();
  const [events, setEvents] = useState<AssessmentEvent[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState('');
  const [gradeFilter, setGradeFilter] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [deleteEvent, setDeleteEvent] = useState<AssessmentEvent | null>(null);
  const [showPendingAlert, setShowPendingAlert] = useState(false);
  const [addToDoEvent, setAddToDoEvent] = useState<AssessmentEvent | null>(null);
  const [editingEvent, setEditingEvent] = useState<AssessmentEvent | null>(null);
  const [viewingEvent, setViewingEvent] = useState<AssessmentEvent | null>(null);
  const [featureFlags, setFeatureFlags] = useState<FeatureFlags>(DEFAULT_FLAGS);
  const [showRelatedOnly, setShowRelatedOnly] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const lastSaveTime = useRef<number>(0);
  const isMounted = useRef(true);
  const intervalRef = useRef<any>(null);

  const isAdmin = currentUser.role === 'admin' || currentUser.role === 'secondary_admin';
  const isTeacherIdentity = currentUser.role === 'teacher' || currentUser.id.includes('@basischina.com');
  const isStudentIdentity = !isTeacherIdentity && !isAdmin;

  const loadEvents = async () => { 
      if (Date.now() - lastSaveTime.current < 8000) return;
      if (!isMounted.current) return;
      const saved = await db.getItem<AssessmentEvent[]>('basis_assessment_events'); 
      if (saved && isMounted.current) setEvents(saved);
  };
  
  useEffect(() => { 
      isMounted.current = true;
      loadEvents();
      db.getItem<FeatureFlags>('basis_feature_flags').then(f => f && (setFeatureFlags(f)));
      intervalRef.current = setInterval(loadEvents, 10000);
      return () => { isMounted.current = false; if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  const handleSaveEvent = async (eventData: Omit<AssessmentEvent, 'id' | 'creatorId' | 'creatorName'>) => {
    setIsSaving(true);
    lastSaveTime.current = Date.now();
    try {
        let finalStatus = (eventData.eventType === 'personal' || isAdmin || isTeacherIdentity || featureFlags.autoApproveRequests) ? 'approved' : 'pending';
        let newEvents = [...events];
        if (editingEvent?.id) {
            newEvents = newEvents.map(e => e.id === editingEvent.id ? { ...editingEvent, ...eventData, status: finalStatus as any } : e);
        } else {
            const newEvt = { ...eventData, id: `evt-${Date.now()}`, creatorId: currentUser.id, creatorName: currentUser.name || 'User', status: finalStatus as any };
            newEvents.push(newEvt);
            if (finalStatus === 'pending') setShowPendingAlert(true);
        }
        setEvents(newEvents);
        await db.setItem('basis_assessment_events', newEvents);
        if (eventData.eventType !== 'personal') {
            await audit.logAction(currentUser, eventData.eventType === 'school' ? 'EDIT_EVENT_CALENDAR' : 'EDIT_ASSESSMENT_CALENDAR', undefined, undefined, eventData.title);
        }
    } finally { setIsSaving(false); setEditingEvent(null); setIsAddOpen(false); }
  };

  const handleDeleteEvent = async () => { 
      if (!deleteEvent) return;
      lastSaveTime.current = Date.now();
      const updated = events.filter(e => e.id !== deleteEvent.id); 
      setEvents(updated); 
      await db.setItem('basis_assessment_events', updated); 
      setDeleteEvent(null); 
  };

  const filteredEvents = useMemo(() => {
      const isFuzzy = (s1: string, s2: string) => (s1||"").toLowerCase().includes((s2||"").toLowerCase()) || (s2||"").toLowerCase().includes((s1||"").toLowerCase());
      return events.filter(evt => {
          if (evt.eventType === 'personal') return evt.creatorId === currentUser.id;
          if (evt.status === 'pending' && !isAdmin && !isTeacherIdentity && evt.creatorId !== currentUser.id) return false;
          if (evt.status === 'rejected') return false;
          if (showRelatedOnly && (isStudentIdentity || isAdmin) && evt.eventType === 'academic') {
              const matches = (Object.values(schedule) as ClassPeriod[]).some(p => p.subject && isFuzzy(evt.subject, p.subject) && (!evt.teacherName || evt.teacherName === '' || evt.teacherName.split(',').some(et => isFuzzy(et.trim(), p.teacherName || ''))));
              if (!matches) return false;
          }
          if (searchQuery && !isFuzzy(evt.title, searchQuery) && !isFuzzy(evt.subject, searchQuery)) return false;
          if (gradeFilter && !evt.gradeLevels?.includes(gradeFilter)) return false;
          return true;
      });
  }, [events, isStudentIdentity, isTeacherIdentity, isAdmin, schedule, searchQuery, gradeFilter, currentUser.id, showRelatedOnly]);

  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8">
      {(isAddOpen || editingEvent) && <AddAssessmentModal isOpen={true} onClose={() => { setIsAddOpen(false); setEditingEvent(null); }} onSave={handleSaveEvent} subjects={subjects} currentUserRole={currentUser.role} currentUserName={currentUser.name || ''} teachers={teachers} eventToEdit={editingEvent || undefined} />}
      {viewingEvent && <ViewAssessmentModal isOpen={true} onClose={() => setViewingEvent(null)} event={viewingEvent} />}
      <ConfirmDeleteAssessmentModal isOpen={!!deleteEvent} onClose={() => setDeleteEvent(null)} onConfirm={handleDeleteEvent} title={deleteEvent?.title || ''} />
      <div className="flex flex-col md:flex-row justify-between mb-6 gap-4">
          <div><h1 className="text-xl md:text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2"><CalendarIcon className="text-brand-600 dark:text-brand-400" /> {t.calendar.header}</h1></div>
          <div className="flex flex-wrap gap-3">
                <input type="text" placeholder={t.common.search} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="px-3 py-2 border rounded-lg text-sm outline-none focus:ring-1 focus:ring-brand-500 dark:bg-slate-900 dark:text-white" />
                {(isStudentIdentity || isAdmin) && <button onClick={() => setShowRelatedOnly(!showRelatedOnly)} className={`px-4 py-2 rounded-lg text-sm font-bold border ${showRelatedOnly ? 'bg-brand-600 text-white' : 'bg-white dark:bg-slate-800'}`}>{t.calendar.showRelatedOnly}</button>}
                <button onClick={() => setIsAddOpen(true)} className="bg-brand-600 text-white px-4 py-2 rounded-lg font-bold text-sm">{isTeacherIdentity || isAdmin ? t.calendar.addEvent : t.calendar.requestEvent}</button>
          </div>
      </div>
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="p-4 flex justify-between items-center bg-slate-50 dark:bg-slate-800 border-b">
              <button onClick={prevMonth} className="p-2"><ChevronLeft/></button>
              <h2 className="font-bold">{currentDate.toLocaleString(language === 'zh' ? 'zh-CN' : 'en-US', { month: 'long', year: 'numeric' })}</h2>
              <button onClick={nextMonth} className="p-2"><ChevronRight/></button>
          </div>
          <div className="grid grid-cols-7 bg-slate-100 dark:bg-slate-900">{[t.weekdays.Sun, t.weekdays.Mon, t.weekdays.Tue, t.weekdays.Wed, t.weekdays.Thu, t.weekdays.Fri, t.weekdays.Sat].map(d => <div key={d} className="p-2 text-center text-xs font-bold text-slate-400">{d}</div>)}</div>
          <div className="grid grid-cols-7 auto-rows-[minmax(120px,auto)] bg-slate-200 dark:bg-slate-700 gap-px">
              {Array.from({ length: firstDay }).map((_, i) => <div key={i} className="bg-slate-50/50 dark:bg-slate-900/50" />)}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                  const d = i + 1;
                  const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth()+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
                  const dayEvts = filteredEvents.filter(e => e.date === dateStr);
                  return (
                      <div key={d} className="bg-white dark:bg-slate-800 p-2 min-h-[120px] relative group" onClick={() => !isSaving && setEditingEvent({ id: '', date: dateStr, status: 'approved' } as any)}>
                          <div className="text-sm font-bold text-slate-400 mb-2">{d}</div>
                          <div className="space-y-1">{dayEvts.map(evt => (
                              <div key={evt.id} onClick={(e) => { e.stopPropagation(); (isAdmin || evt.creatorId === currentUser.id) ? setEditingEvent(evt) : setViewingEvent(evt); }} className={`p-1 rounded text-[10px] font-bold shadow-sm cursor-pointer ${evt.eventType === 'personal' ? 'bg-blue-50 text-blue-800 border border-blue-200' : evt.eventType === 'school' ? 'bg-purple-50 text-purple-800 border border-purple-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
                                  {evt.title}
                              </div>
                          ))}</div>
                      </div>
                  );
              })}
          </div>
      </div>
    </div>
  );
};
export default AssessmentCalendar;

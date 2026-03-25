
import React, { useMemo, useState, useEffect } from 'react';
import { ScheduleMap, ClassPeriod, User } from '../types';
import { WEEKDAYS, getSubjectColor } from '../constants';
import { MapPin, AlertTriangle, Copy, Plus, ChevronDown } from 'lucide-react';
import { useLanguage } from '../LanguageContext';
import MoodLogger from './MoodLogger';

interface ScheduleGridProps {
  schedule: ScheduleMap;
  onCellClick?: (day: string, slot: number) => void;
  onCopyDay?: (day: string) => void;
  readOnly?: boolean;
  currentUser?: User;
  onStressDetected?: () => void;
}

const ScheduleGrid: React.FC<ScheduleGridProps> = ({ schedule, onCellClick, onCopyDay, readOnly = false, currentUser, onStressDetected }) => {
  const { t } = useLanguage();
  const [currentTimeInfo, setCurrentTimeInfo] = useState<{ day: string, slot: number } | null>(null);
  
  // Mobile accordion state
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({});

  useEffect(() => {
      // Determine today's day for auto-expansion
      const dayIdx = new Date().getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
      const todayShort = (dayIdx === 0 || dayIdx === 6) ? 'Mon' : WEEKDAYS[dayIdx - 1];
      
      setExpandedDays({ [todayShort]: true });

      // Live period detection
      const updateCurrentPeriod = () => {
          const now = new Date();
          const dIdx = now.getDay();
          if (dIdx === 0 || dIdx === 6) { setCurrentTimeInfo(null); return; }
          const day = WEEKDAYS[dIdx - 1];
          const mins = now.getHours() * 60 + now.getMinutes();

          const periods = [
              { idx: 0, start: 480, end: 525 }, { idx: 1, start: 530, end: 575 },
              { idx: 2, start: 590, end: 635 }, { idx: 3, start: 640, end: 685 },
              { idx: 4, start: 760, end: 805 }, { idx: 5, start: 810, end: 855 },
              { idx: 6, start: 865, end: 910 }, { idx: 7, start: 915, end: 960 }
          ];
          const found = periods.find(p => mins >= p.start && mins <= p.end);
          setCurrentTimeInfo(found ? { day, slot: found.idx } : null);
      };

      updateCurrentPeriod();
      const intv = setInterval(updateCurrentPeriod, 60000);
      return () => clearInterval(intv);
  }, []);

  const toggleDay = (day: string) => {
      setExpandedDays(prev => ({
          ...prev,
          [day]: !prev[day]
      }));
  };

  const getPeriod = (day: string, slot: number): ClassPeriod => { 
    const id = `${day}-${slot}`; 
    return schedule[id] || { id, subject: '', tasks: [] }; 
  };

  const checkHasOverdue = (period: ClassPeriod) => { 
    const today = new Date(); 
    today.setHours(0, 0, 0, 0); 
    return (period.tasks || []).some(t => t.dueDate ? new Date(t.dueDate) < today : false); 
  };

  // Mobile Card Component
  const MobilePeriodCard = React.memo(({ day, slot }: { day: string, slot: number }) => {
      const period = getPeriod(day, slot);
      const hasSubject = !!period.subject;
      const bgColor = getSubjectColor(period.subject);
      const hasOverdue = checkHasOverdue(period);
      const isCurrent = currentTimeInfo?.day === day && currentTimeInfo?.slot === slot;
      const safeTasks = period.tasks || [];
      const assessmentsCount = safeTasks.filter(t => t.category === 'Test' || t.category === 'Quiz').length;
      const assignmentsCount = safeTasks.filter(t => ['Project', 'Homework', 'Presentation', 'Others'].includes(t.category)).length;

      if (!hasSubject) {
          if (readOnly) return null;
          return (
            <div onClick={() => onCellClick && onCellClick(day, slot)} className="mb-3 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 p-1 overflow-hidden cursor-pointer active:scale-[0.98] transition-all">
                <div className="flex items-center p-3 gap-4">
                    <div className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-xs font-bold text-slate-400 dark:text-slate-500">P{slot + 1}</div>
                    <div className="flex-1 text-slate-400 dark:text-slate-500 text-sm font-medium flex items-center gap-2"><Plus size={16} /> {t.schedule.free}</div>
                </div>
            </div>
          );
      }

      return (
          <div onClick={() => !readOnly && onCellClick && onCellClick(day, slot)} className={`mb-3 rounded-2xl border shadow-soft bg-white dark:bg-slate-900 overflow-hidden active:scale-[0.98] transition-all ${isCurrent ? 'ring-2 ring-brand-500 border-transparent shadow-glow' : 'border-slate-100 dark:border-slate-800'}`}>
              <div className="flex h-full">
                  <div className="w-2" style={{ backgroundColor: bgColor }}></div>
                  <div className="flex-1 p-4">
                      <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-3">
                              <span className={`text-xs font-bold uppercase tracking-wider ${isCurrent ? 'text-brand-600 dark:text-brand-400' : 'text-slate-400 dark:text-slate-500'}`}>Period {slot + 1} {isCurrent && '(Now)'}</span>
                              {hasOverdue && <AlertTriangle size={14} className="text-red-500"/>}
                          </div>
                      </div>
                      <h4 className="font-bold text-slate-800 dark:text-white text-lg mb-1">{period.subject}</h4>
                      <div className="flex justify-between items-end">
                          <div className="text-sm text-slate-500 dark:text-slate-400 space-y-0.5">
                              {period.teacherName && <div className="font-medium">{period.teacherName}</div>}
                              {period.room && <div className="flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500"><MapPin size={12}/> {period.room}</div>}
                          </div>
                          <div className="flex gap-1.5">
                              {assessmentsCount > 0 && <span className="text-[10px] bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-2 py-1 rounded-lg border border-red-100 dark:border-red-900/50 font-bold shadow-sm">{assessmentsCount} {t.schedule.asmtShort}</span>}
                              {assignmentsCount > 0 && <span className="text-[10px] bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-2 py-1 rounded-lg border border-red-100 dark:border-red-900/50 font-bold shadow-sm">{assignmentsCount} {t.schedule.asgnShort}</span>}
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      );
  });

  return (
    <div className="w-full pb-8">
      <div className="hidden md:block w-full pb-4">
        <div className="w-[96%] max-w-[1600px] mx-auto grid grid-cols-[60px_1fr_1fr_1fr_1fr_1fr] gap-x-2 bg-transparent">
            <div className="pb-3 font-bold text-slate-400 dark:text-slate-500 text-center text-[10px] uppercase tracking-widest flex items-end justify-center">
                {t.schedule.period}
            </div>
            {WEEKDAYS.map(day => (
                <div key={day} className="pb-3 flex justify-between items-end px-2 border-b border-slate-200 dark:border-slate-800 mb-1">
                    <span className="font-bold text-slate-800 dark:text-slate-200 text-xs uppercase tracking-wide">{t.weekdays[day as keyof typeof t.weekdays]}</span>
                    {!readOnly && onCopyDay && <button onClick={() => onCopyDay(day)} className="text-slate-300 hover:text-indigo-600 dark:text-slate-600 dark:hover:text-indigo-400 transition-colors" title={t.schedule.copyDay}><Copy size={12} /></button>}
                </div>
            ))}
            {Array.from({ length: 8 }).map((_, i) => (
                <React.Fragment key={`p-row-${i}`}>
                    <div className="flex items-center justify-center py-1">
                        <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold text-[10px] flex items-center justify-center border border-slate-200/50 dark:border-slate-700/50">
                            {i + 1}
                        </div>
                    </div>
                    {WEEKDAYS.map(day => {
                        const period = getPeriod(day, i);
                        const hasSubject = !!period.subject;
                        const bgColor = getSubjectColor(period.subject);
                        const hasOverdue = checkHasOverdue(period);
                        const isCurrent = currentTimeInfo?.day === day && currentTimeInfo?.slot === i;
                        const assessmentsCount = (period.tasks || []).filter(t => t.category === 'Test' || t.category === 'Quiz').length;
                        const assignmentsCount = (period.tasks || []).filter(t => ['Project', 'Homework', 'Presentation', 'Others'].includes(t.category)).length;
                        return (
                            <div 
                              key={`${day}-${i}`} 
                              onClick={() => !readOnly && onCellClick && onCellClick(day, i)} 
                              className={`min-h-[4.5rem] p-2 rounded-xl mb-1.5 transition-all relative group border ${!readOnly ? 'cursor-pointer' : ''} ${isCurrent ? 'ring-2 ring-brand-500 shadow-glow z-10' : ''} ${hasSubject ? 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:shadow-lg hover:border-brand-300 dark:hover:border-brand-600' : 'bg-transparent border-transparent hover:bg-slate-100 dark:hover:bg-slate-900 hover:border-dashed hover:border-slate-300 dark:hover:border-slate-700'}`}
                            >
                                {hasSubject ? (
                                    <div className="flex flex-col h-full">
                                        <div className="w-1.5 h-1.5 rounded-full absolute top-2 right-2" style={{ backgroundColor: bgColor.replace('93%', '60%') }}></div>
                                        <div className="font-bold text-[11px] md:text-xs text-slate-900 dark:text-white leading-tight line-clamp-2 mb-1 pr-2">{period.subject}</div>
                                        <div className="space-y-0.5 mb-1.5">
                                            {period.teacherName && <div className="text-[9px] text-slate-500 dark:text-slate-400 font-medium truncate">{period.teacherName}</div>}
                                            {period.room && <div className="text-[9px] text-slate-400 dark:text-slate-500 flex items-center gap-1"><MapPin size={8}/> {period.room}</div>}
                                        </div>
                                        <div className="flex flex-wrap gap-1 mt-auto">
                                            {assessmentsCount > 0 && <div className="text-[8px] font-bold px-1 py-0.5 rounded bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-300 border border-red-100 dark:border-red-900/50">{assessmentsCount} {t.schedule.asmtShort}</div>}
                                            {assignmentsCount > 0 && <div className="text-[8px] font-bold px-1 py-0.5 rounded bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-900/50">{assignmentsCount} {t.schedule.asgnShort}</div>}
                                        </div>
                                        {hasOverdue && <div className="absolute bottom-1.5 right-1.5 text-red-500 animate-pulse"><AlertTriangle size={10} /></div>}
                                    </div>
                                ) : (
                                    !readOnly && <div className="h-full flex items-center justify-center opacity-0 group-hover:opacity-100 text-slate-300 dark:text-slate-600 transition-opacity"><Plus size={16} /></div>
                                )}
                            </div>
                        );
                    })}
                </React.Fragment>
            ))}
        </div>
      </div>

      <div className="md:hidden space-y-4">
          {WEEKDAYS.map(day => {
              const isOpen = expandedDays[day];
              return (
                <div key={day} className="overflow-hidden">
                    <button 
                        onClick={() => toggleDay(day)}
                        className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all ${isOpen ? 'bg-slate-100 dark:bg-slate-800 shadow-sm' : 'bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                    >
                        <h3 className="font-bold text-slate-800 dark:text-white text-lg flex items-center gap-2 pl-1">
                            <span className={`w-1 h-5 rounded-full transition-colors ${isOpen ? 'bg-brand-500' : 'bg-slate-300 dark:bg-slate-600'}`}></span>
                            {t.weekdays[day as keyof typeof t.weekdays]}
                        </h3>
                        <ChevronDown className={`text-slate-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} size={20}/>
                    </button>
                    <div className={`transition-all duration-300 ease-in-out ${isOpen ? 'max-h-[2000px] opacity-100 mt-3' : 'max-h-0 opacity-0 pointer-events-none'}`}>
                        <div className="space-y-2">
                            {Array.from({ length: 8 }).map((_, i) => (
                                <MobilePeriodCard key={`${day}-${i}`} day={day} slot={i} />
                            ))}
                        </div>
                    </div>
                </div>
              );
          })}
      </div>

      {!readOnly && currentUser && onStressDetected && (
          <div className="mt-8 pt-8 border-t border-dashed border-slate-200 dark:border-slate-800">
              <MoodLogger currentUser={currentUser} onStressPatternDetected={onStressDetected} />
          </div>
      )}
    </div>
  );
};

export default ScheduleGrid;

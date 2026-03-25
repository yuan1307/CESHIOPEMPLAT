
import React, { useState, useEffect } from 'react';
import { Sun, Loader2, Sparkles, X, ChevronRight, BookOpen, Coffee, Sunrise, Sunset, AlertCircle, Calendar, GraduationCap } from 'lucide-react';
import { ScheduleMap, Task, User, ClassPeriod, AssessmentEvent } from '../types';
import { generateDailyBriefing } from '../services/geminiService';
import { db } from '../services/db';
import { useLanguage } from '../LanguageContext';

interface MorningBriefingProps {
    schedule: ScheduleMap;
    user: User;
}

const MorningBriefing: React.FC<MorningBriefingProps> = ({ schedule, user }) => {
    const { t } = useLanguage();
    const [briefing, setBriefing] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [isDismissed, setIsDismissed] = useState(false); // Session-based dismissal

    // Helper for fuzzy matching
    const isFuzzyMatch = (str1: string, str2: string) => {
        if (!str1 || !str2) return false;
        const normalize = (s: string) => s.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"").trim();
        const s1 = normalize(str1);
        const s2 = normalize(str2);
        return s1.includes(s2) || s2.includes(s1);
    };

    useEffect(() => {
        const loadBriefing = async () => {
            const todayStr = new Date().toISOString().split('T')[0];
            // Cache by user and day, but dismissal is session-only
            const cacheKey = `basis_briefing_list_v3_${user.id}_${todayStr}`;
            
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
                try {
                    setBriefing(JSON.parse(cached));
                    setLoading(false);
                    return;
                } catch (e) { /* corrupted cache */ }
            }

            setLoading(true);
            const allTasks: Task[] = [];
            Object.values(schedule).forEach((p: ClassPeriod) => {
                if (p.tasks) allTasks.push(...p.tasks);
            });

            // Fetch ALL calendar events
            const rawEvents = await db.getItem<AssessmentEvent[]>('basis_assessment_events') || [];
            
            // Filter events logic: Strictly "My Classes Only"
            const filteredCalendarEvents = rawEvents.filter(evt => {
                if (evt.status !== 'approved' && evt.creatorId !== user.id) return false;
                if (evt.eventType === 'personal') return evt.creatorId === user.id;
                if (evt.eventType === 'school') return true;

                if (evt.eventType === 'academic') {
                    const myClasses = Object.values(schedule) as ClassPeriod[];
                    return myClasses.some(p => {
                        if (!p.subject) return false;
                        if (!isFuzzyMatch(evt.subject, p.subject)) return false;
                        if (!evt.teacherName || evt.teacherName.trim() === '' || evt.teacherName === 'School') return true;
                        const myTeacher = p.teacherName || '';
                        const eventTeachers = evt.teacherName.split(',').map(t => t.trim());
                        return eventTeachers.some(et => isFuzzyMatch(et, myTeacher));
                    });
                }
                return false;
            });

            const resultStr = await generateDailyBriefing(schedule, allTasks, filteredCalendarEvents, user.name || 'Student');
            if (resultStr) {
                const points = resultStr.split('|').map(p => p.trim()).filter(p => p.length > 0);
                setBriefing(points);
                localStorage.setItem(cacheKey, JSON.stringify(points));
            }
            setLoading(false);
        };

        loadBriefing();
    }, [schedule, user.id, user.name]);

    const handleDismiss = () => {
        setIsDismissed(true);
    };

    const getGreetingInfo = () => {
        const hr = new Date().getHours();
        if (hr < 12) return { text: t.briefing.goodMorning, icon: <Sunrise size={18}/>, gradient: "from-orange-400 to-amber-500", glass: "from-orange-100/30 via-amber-50/20 to-white/10" };
        if (hr < 18) return { text: t.briefing.goodAfternoon, icon: <Sun size={18}/>, gradient: "from-blue-400 to-indigo-500", glass: "from-blue-100/30 via-indigo-50/20 to-white/10" };
        return { text: t.briefing.goodEvening, icon: <Sunset size={18}/>, gradient: "from-purple-500 to-blue-800", glass: "from-purple-900/10 via-blue-900/5 to-black/20" };
    };

    const info = getGreetingInfo();

    if (isDismissed || (briefing.length === 0 && !loading)) return null;

    return (
        <div className="mb-6 p-0.5 rounded-2xl bg-gradient-to-br from-white/20 to-transparent dark:from-white/5 dark:to-transparent shadow-md animate-in slide-in-from-top-4 duration-500">
            <div className={`bg-gradient-to-br ${info.glass} dark:bg-slate-900/60 backdrop-blur-xl rounded-[1rem] p-4 border border-white/40 dark:border-white/5 relative overflow-hidden`}>
                <div className="flex flex-col md:flex-row items-start md:items-center gap-4 relative z-10">
                    <div className={`bg-gradient-to-br ${info.gradient} text-white p-2.5 rounded-xl shadow-sm shrink-0`}>
                        {loading ? <Loader2 className="animate-spin" size={18}/> : info.icon}
                    </div>
                    <div className="flex-1 w-full">
                        <div className="flex justify-between items-start mb-2">
                            <div>
                                <h2 className="text-lg font-black text-slate-800 dark:text-white tracking-tight leading-none mb-1">
                                    {info.text}, {user.name?.split(' ')[0]}
                                </h2>
                                <p className="text-[9px] text-slate-400 dark:text-slate-500 font-black uppercase tracking-[0.2em]">{t.briefing.title}</p>
                            </div>
                            <button 
                                onClick={handleDismiss}
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors p-1"
                            >
                                <X size={16}/>
                            </button>
                        </div>
                        
                        {loading ? (
                            <div className="mt-2 space-y-2">
                                <div className="h-1.5 w-3/4 bg-slate-200 dark:bg-slate-700/50 rounded-full animate-pulse"></div>
                                <div className="h-1.5 w-1/2 bg-slate-200 dark:bg-slate-700/50 rounded-full animate-pulse delay-75"></div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-2">
                                {briefing.map((item, idx) => (
                                    <div 
                                        key={idx} 
                                        className="flex items-center gap-2 bg-white/50 dark:bg-white/5 p-2 rounded-lg border border-white/60 dark:border-white/5 transition-transform hover:scale-[1.01]"
                                    >
                                        <div className="shrink-0">
                                            {item.toLowerCase().includes('quiz') || item.toLowerCase().includes('test') || item.toLowerCase().includes('deadline') || item.toLowerCase().includes('exam') ? (
                                                <AlertCircle size={12} className="text-red-500" />
                                            ) : item.toLowerCase().includes('event') || item.toLowerCase().includes('performance') || item.toLowerCase().includes('rehearsal') ? (
                                                <Calendar size={12} className="text-purple-500" />
                                            ) : (
                                                <Sparkles size={12} className="text-amber-500" />
                                            )}
                                        </div>
                                        <span className="text-slate-700 dark:text-slate-200 text-[11px] font-bold leading-tight">
                                            {item}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MorningBriefing;


import React, { useState, useEffect, useMemo } from 'react';
import { Smile, Meh, Frown, Coffee, Check, Loader2, Calendar, History, BarChart2, Info } from 'lucide-react';
import { User, MoodType, MoodEntry } from '../types';
import { db } from '../services/db';
import { useLanguage } from '../LanguageContext';

interface MoodLoggerProps {
    currentUser: User;
    onStressPatternDetected: () => void;
}

const MoodLogger: React.FC<MoodLoggerProps> = ({ currentUser, onStressPatternDetected }) => {
    const { t } = useLanguage();
    const [selectedMood, setSelectedMood] = useState<MoodType | null>(null);
    const [note, setNote] = useState('');
    const [hasLoggedToday, setHasLoggedToday] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [showHistory, setShowHistory] = useState(false);

    useEffect(() => {
        if (currentUser.moodLogs) {
            const today = new Date().toISOString().split('T')[0];
            const log = currentUser.moodLogs.find(l => l.date === today);
            if (log) {
                setHasLoggedToday(true);
                setSelectedMood(log.mood);
            }
        }
    }, [currentUser]);

    const handleMoodSelect = (mood: MoodType) => {
        if (hasLoggedToday) return;
        setSelectedMood(mood);
    };

    const handleSave = async () => {
        if (!selectedMood || isSaving) return;
        setIsSaving(true);

        const today = new Date().toISOString().split('T')[0];
        const newEntry: MoodEntry = { date: today, mood: selectedMood, note: note.trim() };
        
        const existingLogs = currentUser.moodLogs || [];
        const updatedLogs = [...existingLogs, newEntry];
        
        await db.setItem(`basis_user_${currentUser.id}`, { ...currentUser, moodLogs: updatedLogs });
        
        const recentLogs = updatedLogs.slice(-3);
        const stressCount = recentLogs.filter(l => l.mood === 'Stressed').length;
        
        setHasLoggedToday(true);
        setIsSaving(false);

        if (stressCount >= 3 && selectedMood === 'Stressed') {
            onStressPatternDetected();
        }
    };

    const getMoodColor = (mood: MoodType) => {
        switch(mood) {
            case 'Happy': return 'bg-green-500';
            case 'Neutral': return 'bg-blue-400';
            case 'Stressed': return 'bg-orange-500';
            case 'Tired': return 'bg-slate-400';
            default: return 'bg-slate-100 dark:bg-slate-800';
        }
    };

    const MoodMap = () => {
        const logs = currentUser.moodLogs || [];
        const days = 28; // Show last 4 weeks
        const grid = [];
        const today = new Date();

        for (let i = days - 1; i >= 0; i--) {
            const date = new Date();
            date.setDate(today.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            const log = logs.find(l => l.date === dateStr);
            grid.push({ date: dateStr, mood: log?.mood });
        }

        return (
            <div className="animate-in fade-in slide-in-from-top-2">
                <div className="flex flex-wrap gap-2 justify-center mb-6">
                    {grid.map((item, idx) => (
                        <div 
                            key={idx} 
                            className={`w-4 h-4 rounded-sm transition-all hover:scale-125 cursor-help ${item.mood ? getMoodColor(item.mood) : 'bg-slate-100 dark:bg-slate-800'}`}
                            title={`${item.date}: ${item.mood || 'No Entry'}`}
                        />
                    ))}
                </div>
                <div className="flex justify-center gap-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500"></span> {t.wellness.moods.Happy}</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400"></span> {t.wellness.moods.Neutral}</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500"></span> {t.wellness.moods.Stressed}</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-400"></span> {t.wellness.moods.Tired}</span>
                </div>
            </div>
        );
    };

    const moods: { type: MoodType; icon: React.ElementType; color: string; hover: string }[] = [
        { type: 'Happy', icon: Smile, color: 'text-green-500', hover: 'hover:bg-green-50 dark:hover:bg-green-900/20' },
        { type: 'Neutral', icon: Meh, color: 'text-blue-500', hover: 'hover:bg-blue-50 dark:hover:bg-blue-900/20' },
        { type: 'Stressed', icon: Frown, color: 'text-orange-500', hover: 'hover:bg-orange-50 dark:hover:bg-orange-900/20' },
        { type: 'Tired', icon: Coffee, color: 'text-slate-500', hover: 'hover:bg-slate-50 dark:hover:bg-slate-800' },
    ];

    return (
        <div className="mt-12 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md border border-white/60 dark:border-white/5 rounded-[2rem] p-8 shadow-sm transition-all no-print">
            <div className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-2">
                    <div className="w-1.5 h-6 bg-brand-500 rounded-full"></div>
                    <h3 className="text-sm font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em]">
                        Wellness Pulse
                    </h3>
                </div>
                <button 
                    onClick={() => setShowHistory(!showHistory)}
                    className={`p-2 rounded-xl transition-all ${showHistory ? 'bg-brand-100 text-brand-600 dark:bg-brand-900/30 dark:text-brand-400' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                    title={t.wellness.viewMap}
                >
                    <BarChart2 size={20}/>
                </button>
            </div>
            
            {showHistory ? (
                <div className="p-4 bg-white/50 dark:bg-slate-800/30 rounded-2xl border border-white/50 dark:border-white/5">
                    <div className="text-center mb-4 font-bold text-slate-700 dark:text-slate-200 text-sm flex items-center justify-center gap-2">
                        <Calendar size={16}/> {t.wellness.viewMap}
                    </div>
                    <MoodMap />
                </div>
            ) : hasLoggedToday ? (
                <div className="bg-green-50/50 dark:bg-green-900/10 border border-green-100 dark:border-green-800/50 rounded-2xl p-6 flex flex-col items-center gap-3 animate-in fade-in duration-500">
                    <div className="bg-green-100 dark:bg-green-800/50 p-3 rounded-full text-green-600 dark:text-green-300">
                        <Check size={24}/>
                    </div>
                    <div className="text-center">
                        <span className="font-extrabold text-green-800 dark:text-green-200 block">{t.wellness.saved}</span>
                        <p className="text-xs text-green-600/70 dark:text-green-400/50 mt-1">See you tomorrow!</p>
                    </div>
                </div>
            ) : (
                <div className="space-y-8 animate-in fade-in">
                    <p className="text-center text-xl font-bold text-slate-700 dark:text-slate-200">{t.wellness.title}</p>
                    <div className="flex justify-center flex-wrap gap-4 md:gap-8">
                        {moods.map(({ type, icon: Icon, color, hover }) => (
                            <button
                                key={type}
                                onClick={() => handleMoodSelect(type)}
                                className={`group p-5 md:p-6 rounded-[2rem] transition-all duration-300 flex flex-col items-center gap-3 min-w-[100px] border-2 ${selectedMood === type ? 'bg-white dark:bg-slate-800 scale-110 shadow-xl border-brand-500' : `border-transparent grayscale opacity-60 hover:opacity-100 hover:grayscale-0 hover:scale-105 ${hover} ${color}`}`}
                            >
                                <Icon size={40} className={`${selectedMood === type ? color : ''} transition-colors group-hover:animate-bounce-slow`} />
                                <span className="text-xs font-black uppercase tracking-tighter">{t.wellness.moods[type]}</span>
                            </button>
                        ))}
                    </div>

                    {selectedMood && (
                        <div className="animate-in slide-in-from-top-4 max-w-lg mx-auto">
                            <div className="relative mb-4">
                                <textarea
                                    value={note}
                                    onChange={(e) => setNote(e.target.value)}
                                    placeholder={t.wellness.placeholder}
                                    className="w-full bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 text-sm md:text-base focus:ring-2 focus:ring-brand-500 outline-none shadow-inner resize-none h-24 dark:text-white"
                                />
                                <div className="absolute right-3 bottom-3 opacity-20"><Info size={16}/></div>
                            </div>
                            <button 
                                onClick={handleSave} 
                                disabled={isSaving}
                                className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black py-4 rounded-2xl hover:bg-slate-800 dark:hover:bg-slate-100 flex items-center justify-center gap-3 shadow-lg transition-all active:scale-95 disabled:opacity-50"
                            >
                                {isSaving ? <Loader2 className="animate-spin" size={20}/> : <Check size={20}/>}
                                {t.common.save.toUpperCase()}
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default MoodLogger;

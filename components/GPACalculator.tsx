
import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Calculator, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { GradeCourse, ScheduleMap } from '../types';
import { calculateGPA } from '../constants';
import { db } from '../services/db';
import { useLanguage } from '../LanguageContext';

interface GPACalculatorProps { userId: string; }

const GPACalculator: React.FC<GPACalculatorProps> = ({ userId }) => {
  const { t } = useLanguage();
  const [courses, setCourses] = useState<GradeCourse[]>([]);
  const [newName, setNewName] = useState('');
  const [newGrade, setNewGrade] = useState('');
  const [expandedCourseId, setExpandedCourseId] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [hasCleared, setHasCleared] = useState(false); // Guard against auto-refetching after clear

  useEffect(() => {
    const load = async () => {
        // If the user has just cleared, don't auto-populate from schedule
        if (hasCleared) return;

        const schedule = await db.getItem<ScheduleMap>(`basis_schedule_${userId}`);
        const scheduledSubjects = new Set<string>();
        if (schedule) { Object.values(schedule).forEach(period => { if (period.subject) scheduledSubjects.add(period.subject); }); }
        
        let saved = await db.getItem<GradeCourse[]>(`basis_grades_${userId}`) || [];
        let hasChanges = false;
        
        scheduledSubjects.forEach(sub => {
            const exists = saved.find(c => c.name.toLowerCase() === sub.toLowerCase());
            if (!exists) { 
                saved.push({ id: Date.now().toString() + Math.random().toString().slice(2), name: sub, gradePercent: 0 }); 
                hasChanges = true; 
            }
        });
        
        setCourses(saved);
        if (hasChanges) { await db.setItem(`basis_grades_${userId}`, saved); }
    };
    load();
  }, [userId, hasCleared]);

  const saveCourses = async (newCourses: GradeCourse[]) => { setCourses(newCourses); await db.setItem(`basis_grades_${userId}`, newCourses); };
  const addCourse = () => { if (!newName || !newGrade) return; const numGrade = parseFloat(newGrade); if (isNaN(numGrade) || numGrade < 0 || numGrade > 100) return; saveCourses([...courses, { id: Date.now().toString(), name: newName, gradePercent: numGrade }]); setNewName(''); setNewGrade(''); };
  const updateGrade = (id: string, percent: number) => { const updated = courses.map(c => c.id === id ? { ...c, gradePercent: percent } : c); saveCourses(updated); };
  const removeCourse = (id: string) => { saveCourses(courses.filter(c => c.id !== id)); };
  
  const clearAllCourses = async () => {
      setHasCleared(true); // Set flag to prevent auto-repopulation
      await saveCourses([]); // Explicitly save empty array
      setShowClearConfirm(false);
  };

  const totalGPA = courses.length > 0 ? (courses.reduce((acc, curr) => acc + calculateGPA(curr.gradePercent).point, 0) / courses.length).toFixed(2) : "0.00";

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-10">
      {showClearConfirm && (
          <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95">
                  <div className="bg-red-600 text-white p-4 flex justify-between items-center"><h3 className="font-bold flex items-center gap-2"><AlertTriangle size={18}/> {t.gpa.clearAll}</h3></div>
                  <div className="p-6 text-center"><p className="text-gray-700 mb-6">{t.gpa.clearConfirm}</p><div className="flex gap-3"><button onClick={() => setShowClearConfirm(false)} className="flex-1 border py-2 rounded text-gray-600 hover:bg-gray-50">{t.common.cancel}</button><button onClick={clearAllCourses} className="flex-1 bg-red-600 text-white py-2 rounded font-bold hover:bg-red-700">{t.common.confirm}</button></div></div>
              </div>
          </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col lg:flex-row min-h-[600px]">
        <div className="flex-1 p-6 md:p-8 overflow-y-auto border-r border-slate-100">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><Calculator className="text-brand-600"/> {t.gpa.title}</h2>
                {courses.length > 0 && <button onClick={() => setShowClearConfirm(true)} className="text-xs font-bold text-red-500 hover:text-red-700 flex items-center gap-1 border border-red-200 bg-red-50 px-3 py-1.5 rounded-lg hover:bg-red-100 transition-colors"><Trash2 size={14}/> {t.gpa.clearAll}</button>}
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3 mb-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex-1"><label className="block text-xs font-bold text-slate-400 uppercase mb-1">{t.common.subject}</label><input type="text" placeholder="e.g. AP Calculus BC" value={newName} onChange={e => setNewName(e.target.value)} className="w-full border border-slate-300 rounded-lg p-2.5 text-sm outline-none" /></div>
                <div className="w-full sm:w-24"><label className="block text-xs font-bold text-slate-400 uppercase mb-1">Grade %</label><input type="number" placeholder="0-100" value={newGrade} onChange={e => setNewGrade(e.target.value)} className="w-full border border-slate-300 rounded-lg p-2.5 text-sm outline-none" /></div>
                <div className="flex items-end"><button onClick={addCourse} className="w-full sm:w-auto bg-brand-600 text-white p-2.5 rounded-lg hover:bg-brand-700 shadow-lg flex justify-center"><Plus size={20} /></button></div>
            </div>

            <div className="space-y-3">
                {courses.map(course => {
                    const gpa = calculateGPA(course.gradePercent);
                    const isExpanded = expandedCourseId === course.id;
                    
                    return (
                        <div key={course.id} className={`bg-white rounded-xl border transition-all duration-200 ${isExpanded ? 'border-brand-300 shadow-md' : 'border-slate-200 shadow-sm hover:border-brand-200'}`}>
                            <div className="flex items-center justify-between p-4 cursor-pointer" onClick={() => setExpandedCourseId(isExpanded ? null : course.id)}>
                                <div className="flex-1 mr-4">
                                    <div className="font-bold text-slate-800 mb-1 flex items-center gap-2">
                                        {course.name}
                                    </div>
                                    <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-2">
                                        <span className="text-xs text-slate-500 font-bold uppercase">{t.gpa.current}:</span>
                                        <input type="number" value={course.gradePercent} onChange={(e) => updateGrade(course.id, parseFloat(e.target.value) || 0)} className="w-16 border border-slate-200 rounded px-2 py-1 text-sm font-medium focus:ring-1 focus:ring-brand-500 outline-none"/>
                                    </div>
                                </div>
                                <div className="flex items-center gap-6">
                                    <div className="text-right w-12">
                                        <div className={`text-xl font-bold ${gpa.point >= 3 ? 'text-green-600' : gpa.point >= 2 ? 'text-yellow-600' : 'text-red-600'}`}>{gpa.grade}</div>
                                        <div className="text-xs text-slate-400 font-medium">{gpa.point.toFixed(2)}</div>
                                    </div>
                                    <button onClick={(e) => { e.stopPropagation(); removeCourse(course.id); }} className="text-slate-300 hover:text-red-500 p-2 bg-slate-50 rounded-full"><Trash2 size={16} /></button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
        <div className="w-full lg:w-80 bg-slate-900 text-white p-8 flex flex-col justify-center items-center text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-brand-600/20 to-transparent"></div>
            <div className="relative z-10 w-full">
                <h3 className="text-brand-200 font-bold uppercase tracking-widest text-xs mb-4">{t.gpa.cumulative}</h3>
                <div className="text-7xl font-bold mb-4 tracking-tighter text-white">{totalGPA}</div>
                <div className="inline-block bg-white/10 px-4 py-1 rounded-full text-sm font-medium backdrop-blur-sm border border-white/10 mb-8">{courses.length} {t.gpa.coursesTracked}</div>
                <div className="text-left w-full space-y-1 text-xs text-slate-300 bg-white/5 p-5 rounded-xl border border-white/5 backdrop-blur-sm max-h-[350px] overflow-y-auto"><p className="flex justify-between"><strong>A (93-100)</strong> <span>4.00</span></p><p className="flex justify-between"><strong>A- (90-92)</strong> <span>3.67</span></p><p className="flex justify-between"><strong>B+ (87-89)</strong> <span>3.33</span></p><p className="flex justify-between"><strong>B (83-86)</strong> <span>3.00</span></p><p className="flex justify-between"><strong>B- (80-82)</strong> <span>2.67</span></p><p className="flex justify-between"><strong>C+ (77-79)</strong> <span>2.33</span></p><p className="flex justify-between"><strong>C (73-76)</strong> <span>2.00</span></p><p className="flex justify-between"><strong>C- (70-72)</strong> <span>1.67</span></p><p className="flex justify-between"><strong>D+ (67-69)</strong> <span>1.33</span></p><p className="flex justify-between"><strong>D (63-66)</strong> <span>1.00</span></p><p className="flex justify-between"><strong>D- (60-62)</strong> <span>0.67</span></p><p className="flex justify-between text-red-300"><strong>F (&lt;60)</strong> <span>0.00</span></p></div>
            </div>
        </div>
      </div>
    </div>
  );
};
export default GPACalculator;

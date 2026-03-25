
import React, { useState, useEffect, useRef } from 'react';
import { X, Trash2, Search, Calendar, ChevronDown, Mail, MapPin } from 'lucide-react';
import { ClassPeriod, Task, Importance, Urgency, Teacher, TaskCategory, UserRole } from '../types';
import { TASK_CATEGORIES } from '../constants';
import { useLanguage } from '../LanguageContext';

interface ClassModalProps {
  period: ClassPeriod;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedPeriod: ClassPeriod) => void;
  day: string;
  slotIndex: number;
  availableTeachers: Teacher[];
  availableSubjects: string[];
  currentUserRole?: UserRole; 
  currentUserName?: string; 
}

const ClassModal: React.FC<ClassModalProps> = ({ 
  period, isOpen, onClose, onSave, day, slotIndex, availableTeachers, availableSubjects, currentUserRole, currentUserName
}) => {
  const { t } = useLanguage();
  const [data, setData] = useState<ClassPeriod>(period);
  
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskCategory, setTaskCategory] = useState<TaskCategory>('Homework');
  const [taskImp, setTaskImp] = useState<Importance>(Importance.Medium);
  const [taskUrg, setTaskUrg] = useState<Urgency>(Urgency.Medium);
  const [taskDue, setTaskDue] = useState('');

  const [teacherSearch, setTeacherSearch] = useState('');
  const [showTeacherDropdown, setShowTeacherDropdown] = useState(false);
  const [subjectSearch, setSubjectSearch] = useState('');
  const [showSubjectDropdown, setShowSubjectDropdown] = useState(false);
  const [room, setRoom] = useState('');
  
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const teacherRef = useRef<HTMLDivElement>(null);
  const subjectRef = useRef<HTMLDivElement>(null);
  
  const isTeacherRole = currentUserRole === 'teacher';

  useEffect(() => {
    setData(period);
    setTeacherSearch(period.teacherName || '');
    setSubjectSearch(period.subject || '');
    setRoom(period.room || '');
    
    if (isTeacherRole && currentUserName) {
        if (!period.teacherName) {
            setTeacherSearch(currentUserName);
            setData(prev => ({ ...prev, teacherName: currentUserName }));
        }
    }
  }, [period, isTeacherRole, currentUserName]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (teacherRef.current && !teacherRef.current.contains(event.target as Node)) setShowTeacherDropdown(false);
      if (subjectRef.current && !subjectRef.current.contains(event.target as Node)) setShowSubjectDropdown(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!isOpen) return null;

  const handleChange = (field: keyof ClassPeriod, value: any) => setData(prev => ({ ...prev, [field]: value }));
  const handleTeacherSelect = (t: Teacher) => { handleChange('teacherId', t.id); handleChange('teacherName', t.name); setTeacherSearch(t.name); setShowTeacherDropdown(false); };
  const handleSubjectSelect = (sub: string) => { handleChange('subject', sub); setSubjectSearch(sub); setShowSubjectDropdown(false); };

  const constructNewTask = (): Task | null => {
      if (!taskTitle.trim()) return null;
      return { id: Date.now().toString(), title: taskTitle, description: taskDesc, category: taskCategory, importance: taskImp, urgency: taskUrg, dueDate: taskDue, completed: false };
  };

  const handleSave = () => {
    let updatedPeriod = { ...data };
    updatedPeriod.teacherName = teacherSearch;
    updatedPeriod.subject = subjectSearch;
    updatedPeriod.room = room;
    
    const newTask = constructNewTask();
    if (newTask) { 
        updatedPeriod.tasks = [...updatedPeriod.tasks, newTask]; 
        setTaskTitle(''); setTaskDesc(''); setTaskDue(''); 
    }
    
    onSave(updatedPeriod);
  };

  const performClear = () => {
      setSubjectSearch('');
      setTeacherSearch(isTeacherRole && currentUserName ? currentUserName : '');
      setRoom('');
      
      // Explicitly construct cleared object using prop ID to ensure integrity
      const cleared: ClassPeriod = { 
          id: period.id,
          subject: '', 
          teacherName: isTeacherRole && currentUserName ? currentUserName : '', 
          teacherId: undefined, 
          room: '', 
          tasks: [] 
      };
      
      onSave(cleared);
  };

  const removeTask = (taskId: string) => setData(prev => ({ ...prev, tasks: prev.tasks.filter(t => t.id !== taskId) }));

  const filteredTeachers = availableTeachers.filter(t => t.name.toLowerCase().includes(teacherSearch.toLowerCase()) || t.email.toLowerCase().includes(teacherSearch.toLowerCase()));
  const filteredSubjects = availableSubjects.filter(s => s.toLowerCase().includes(subjectSearch.toLowerCase()));

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200 relative">
        {showClearConfirm && (
            <div className="absolute inset-0 bg-white/95 dark:bg-slate-900/95 z-[60] flex flex-col items-center justify-center p-8 text-center animate-in fade-in">
                <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center text-red-600 dark:text-red-400 mb-4"><Trash2 size={32}/></div>
                <h3 className="font-bold text-xl text-gray-800 dark:text-white mb-2">{t.schedule.clearPeriod}?</h3>
                <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-sm">{t.modals.areYouSure}</p>
                <div className="flex gap-3">
                    <button onClick={() => setShowClearConfirm(false)} className="px-6 py-2.5 rounded-lg border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-300 font-bold hover:bg-gray-50 dark:hover:bg-slate-800">{t.common.cancel}</button>
                    <button onClick={() => { performClear(); setShowClearConfirm(false); }} className="px-6 py-2.5 rounded-lg bg-red-600 text-white font-bold hover:bg-red-700">{t.common.confirm}</button>
                </div>
            </div>
        )}

        <div className="bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800 p-5 flex justify-between items-center">
          <div><h2 className="text-xl font-bold text-gray-800 dark:text-white">{t.schedule.editTitle}</h2><p className="text-xs text-gray-500 dark:text-gray-400 font-medium">{day} - {t.schedule.period} {slotIndex + 1}</p></div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors p-1 bg-gray-50 dark:bg-slate-800 rounded-full"><X size={20} /></button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-gray-50/30 dark:bg-slate-950/30">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="relative" ref={subjectRef}>
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1.5 ml-1">{t.common.subject}</label>
              <div className="relative"><input type="text" value={subjectSearch} onChange={e => { setSubjectSearch(e.target.value); setShowSubjectDropdown(true); handleChange('subject', e.target.value); }} onFocus={() => setShowSubjectDropdown(true)} className="w-full border border-gray-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-lg p-2.5 shadow-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none text-sm font-medium" placeholder="..."/><ChevronDown className="absolute right-3 top-3.5 text-gray-400 pointer-events-none" size={14} /></div>
              {showSubjectDropdown && filteredSubjects.length > 0 && (<div className="absolute z-20 w-full bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-lg shadow-xl max-h-48 overflow-y-auto mt-2">{filteredSubjects.map(s => (<button key={s} onClick={() => handleSubjectSelect(s)} className="w-full text-left px-4 py-2.5 hover:bg-brand-50 dark:hover:bg-slate-700 text-sm border-b border-gray-50 dark:border-slate-700 last:border-0 text-gray-700 dark:text-gray-200 font-medium">{s}</button>))}</div>)}
            </div>

            <div className="relative" ref={teacherRef}>
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1.5 ml-1">{isTeacherRole ? t.schedule.teacherYou : t.common.teacher}</label>
              <div className="relative"><input type="text" value={teacherSearch} onChange={e => { setTeacherSearch(e.target.value); setShowTeacherDropdown(true); handleChange('teacherName', e.target.value); }} onFocus={() => !isTeacherRole && setShowTeacherDropdown(true)} disabled={isTeacherRole} className={`w-full border border-gray-200 dark:border-slate-700 rounded-lg p-2.5 pl-9 shadow-sm outline-none text-sm font-medium ${isTeacherRole ? 'bg-gray-100 dark:bg-slate-800 text-gray-500 cursor-not-allowed' : 'dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-transparent'}`} placeholder="..."/><Search className="absolute left-3 top-3 text-gray-400 pointer-events-none" size={16} /></div>
              {!isTeacherRole && showTeacherDropdown && (<div className="absolute z-20 w-full bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-lg shadow-xl max-h-48 overflow-y-auto mt-2">{filteredTeachers.length > 0 ? (filteredTeachers.map(t => (<button key={t.id} onClick={() => handleTeacherSelect(t)} className="w-full text-left px-4 py-2 hover:bg-brand-50 dark:hover:bg-slate-700 text-sm border-b border-gray-50 dark:border-slate-700 last:border-0"><div className="font-bold text-gray-800 dark:text-gray-200">{t.name}</div><div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1"><Mail size={10} /> {t.email}</div></button>))) : (<div className="p-3 text-sm text-gray-500 text-center">{t.common.search}</div>)}</div>)}
            </div>

            <div className="md:col-span-2">
                 <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1.5 ml-1">{t.common.room}</label>
                 <div className="relative"><input type="text" value={room} onChange={e => setRoom(e.target.value)} className="w-full border border-gray-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-lg p-2.5 pl-9 shadow-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none text-sm font-medium"/><MapPin className="absolute left-3 top-3 text-gray-400 pointer-events-none" size={16} /></div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-bold text-gray-800 dark:text-white mb-3 flex items-center gap-2">{t.schedule.taskMgmt}</h3>
            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm mb-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                    <div className="md:col-span-2"><label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">{t.common.title}</label><input type="text" value={taskTitle} onChange={e => setTaskTitle(e.target.value)} className="w-full border border-gray-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg p-2 text-sm focus:ring-2 focus:ring-brand-500 outline-none"/></div>
                    <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">{t.common.category}</label><select value={taskCategory} onChange={e => setTaskCategory(e.target.value as TaskCategory)} className="w-full border border-gray-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg p-2 text-sm focus:ring-2 focus:ring-brand-500 outline-none bg-white">{TASK_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                    <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">{t.common.dueDate}</label><input type="date" value={taskDue} onChange={e => setTaskDue(e.target.value)} className="w-full border border-gray-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg p-2 text-sm focus:ring-2 focus:ring-brand-500 outline-none"/></div>
                </div>
                <div className="mb-4"><label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">{t.common.description}</label><input type="text" value={taskDesc} onChange={e => setTaskDesc(e.target.value)} className="w-full border border-gray-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg p-2 text-sm focus:ring-2 focus:ring-brand-500 outline-none"/></div>
                <div className="grid grid-cols-2 gap-4">
                        <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Importance</label><select value={taskImp} onChange={e => setTaskImp(e.target.value as Importance)} className="w-full border border-gray-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg p-2 text-sm focus:ring-2 focus:ring-brand-500 outline-none bg-white">{Object.values(Importance).map(v => <option key={v} value={v}>{v}</option>)}</select></div>
                        <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Urgency</label><select value={taskUrg} onChange={e => setTaskUrg(e.target.value as Urgency)} className="w-full border border-gray-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg p-2 text-sm focus:ring-2 focus:ring-brand-500 outline-none bg-white">{Object.values(Urgency).map(v => <option key={v} value={v}>{v}</option>)}</select></div>
                </div>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {data.tasks.map(task => (
                <div key={task.id} className={`flex items-start justify-between p-3 rounded-lg border shadow-sm ${task.category === 'Test' || task.category === 'Quiz' ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-100 dark:border-orange-900/30' : task.category === 'Personal' ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-100 dark:border-purple-900/30' : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700'}`}>
                    <div className="flex flex-col w-full">
                    <div className="flex justify-between items-center mb-1"><span className="font-bold text-sm text-gray-800 dark:text-gray-200">{task.title}</span><span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${task.category === 'Test' || task.category === 'Quiz' ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300' : task.category === 'Personal' ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300' : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300'}`}>{task.category}</span></div>
                    {task.description && <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{task.description}</p>}
                    <div className="flex gap-2 items-center">{task.dueDate && (<span className="text-[10px] flex items-center gap-1 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-slate-700 px-2 py-0.5 rounded border border-gray-100 dark:border-slate-600 font-medium"><Calendar size={10} />{task.dueDate}</span>)}</div>
                    </div>
                    <button onClick={() => removeTask(task.id)} className="text-gray-300 hover:text-red-500 transition-colors ml-3 mt-1"><Trash2 size={16} /></button>
                </div>
                ))}
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 flex justify-between items-center gap-3 border-t border-gray-100 dark:border-slate-800">
            <button onClick={() => setShowClearConfirm(true)} className="text-red-500 hover:text-red-700 text-xs font-bold px-2 py-1 flex items-center gap-1"><Trash2 size={14} /> {t.schedule.clearPeriod}</button>
            <div className="flex gap-3"><button onClick={onClose} className="px-5 py-2.5 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg font-medium text-sm transition-colors">{t.common.cancel}</button><button onClick={handleSave} className="px-6 py-2.5 bg-brand-600 text-white rounded-lg hover:bg-brand-700 font-bold text-sm shadow-lg shadow-brand-500/20 transition-all">{t.schedule.saveChanges}</button></div>
        </div>
      </div>
    </div>
  );
};
export default ClassModal;

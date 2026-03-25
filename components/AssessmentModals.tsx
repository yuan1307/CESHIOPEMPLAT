
import React, { useState, useEffect, useRef } from 'react';
import { X, Calendar, ChevronDown, Check, Search, User, School, ClipboardList, Info, FileText, Megaphone } from 'lucide-react';
import { AssessmentEvent, UserRole, Teacher } from '../types';
import { GRADE_LEVELS } from '../constants';
import { useLanguage } from '../LanguageContext';

interface AddAssessmentModalProps { isOpen: boolean; onClose: () => void; onSave: (event: Omit<AssessmentEvent, 'id' | 'creatorId' | 'creatorName'>) => void; subjects: string[]; currentUserRole: UserRole; currentUserName: string; teachers: Teacher[]; eventToEdit?: AssessmentEvent; }

export const AddAssessmentModal: React.FC<AddAssessmentModalProps> = ({ isOpen, onClose, onSave, subjects, currentUserRole, currentUserName, teachers, eventToEdit }) => {
  const { t } = useLanguage();
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  
  // Teacher selection state
  const [teacherSearch, setTeacherSearch] = useState('');
  const [selectedTeachers, setSelectedTeachers] = useState<string[]>([]);
  
  const [date, setDate] = useState('');
  const [selectedGrades, setSelectedGrades] = useState<string[]>([]);
  const [eventType, setEventType] = useState<'academic' | 'personal' | 'school'>('academic');
  const [category, setCategory] = useState<string>('Test');
  const [description, setDescription] = useState('');
  
  const [showSubjectDropdown, setShowSubjectDropdown] = useState(false);
  const [showTeacherDropdown, setShowTeacherDropdown] = useState(false); 
  const subjectRef = useRef<HTMLDivElement>(null);
  const teacherRef = useRef<HTMLDivElement>(null); 

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => { if (subjectRef.current && !subjectRef.current.contains(event.target as Node)) { setShowSubjectDropdown(false); } if (teacherRef.current && !teacherRef.current.contains(event.target as Node)) { setShowTeacherDropdown(false); } };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => { 
      if (isOpen) {
          if (eventToEdit) {
              setTitle(eventToEdit.title);
              setSubject(eventToEdit.subject === 'Personal' || eventToEdit.subject === 'School Event' ? '' : eventToEdit.subject);
              setDate(eventToEdit.date);
              setSelectedGrades(eventToEdit.gradeLevels || []);
              setEventType(eventToEdit.eventType || 'academic');
              setCategory(eventToEdit.category || 'Test');
              setDescription(eventToEdit.description || '');
              
              if (eventToEdit.teacherName && eventToEdit.teacherName !== 'Self' && eventToEdit.teacherName !== 'School') {
                  setSelectedTeachers(eventToEdit.teacherName.split(', '));
              } else {
                  setSelectedTeachers([]);
              }
          } else {
            // New Event
            if (currentUserRole === 'teacher') { 
                // Auto include teacher
                setSelectedTeachers([currentUserName]);
                setTeacherSearch('');
            } else { 
                setSelectedTeachers([]);
                setTeacherSearch('');
            } 
            setEventType('academic'); setTitle(''); setSubject(''); setDate(''); setSelectedGrades([]); setCategory('Test'); setDescription('');
          }
      } 
  }, [isOpen, currentUserRole, currentUserName, eventToEdit]);

  if (!isOpen) return null;
  
  const isStudent = currentUserRole === 'student';
  const canCreateSchoolEvent = currentUserRole === 'admin' || currentUserRole === 'secondary_admin' || currentUserRole === 'teacher';
  
  const isPersonal = eventType === 'personal';
  const isSchoolEvent = eventType === 'school';
  const isAssessment = eventType === 'academic'; // "Academic" is now "Assessment" UI
  
  const handleSubmit = (e: React.FormEvent) => { 
      e.preventDefault(); 
      if (!title || !date) { alert(t.common.required); return; }
      // Teacher is explicitly NOT required for assessments per user request
      if (isAssessment && (!subject)) { alert(t.common.required); return; }
      
      let finalSubject = subject;
      if (isPersonal) finalSubject = 'Personal';
      if (isSchoolEvent) finalSubject = 'School Event';

      let finalTeacherName = selectedTeachers.join(', ');
      if (isPersonal) finalTeacherName = 'Self';
      if (isSchoolEvent) finalTeacherName = 'School';

      onSave({ 
          title, 
          subject: finalSubject, 
          teacherName: finalTeacherName, // Allowed to be empty string
          date, 
          gradeLevels: isPersonal ? [] : selectedGrades, 
          status: isPersonal ? 'approved' : (isStudent && isAssessment ? 'pending' : 'approved'),
          eventType,
          category: isPersonal ? undefined : category as any,
          description
      }); 
      onClose(); 
  };
  const toggleGrade = (g: string) => { setSelectedGrades(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g]); };
  const toggleHighSchool = () => { const hs = ['G9', 'G10', 'G11', 'G12']; const allHs = hs.every(g => selectedGrades.includes(g)); if (allHs) { setSelectedGrades(prev => prev.filter(g => !hs.includes(g))); } else { setSelectedGrades(prev => Array.from(new Set([...prev, ...hs]))); } };
  const toggleAllGrades = () => {
      if (selectedGrades.length === GRADE_LEVELS.length) {
          setSelectedGrades([]);
      } else {
          setSelectedGrades([...GRADE_LEVELS]);
      }
  };

  const filteredSubjects = subjects.filter(s => s.toLowerCase().includes(subject.toLowerCase()));
  const filteredTeachers = teachers.filter(t => 
      t.name.toLowerCase().includes(teacherSearch.toLowerCase()) && 
      !selectedTeachers.includes(t.name)
  );

  const addTeacher = (name: string) => {
      if (!selectedTeachers.includes(name)) {
          setSelectedTeachers(prev => [...prev, name]);
      }
      setTeacherSearch('');
      setShowTeacherDropdown(false);
  };

  const removeTeacher = (name: string) => {
      if (currentUserRole === 'teacher' && name === currentUserName) {
          alert("You cannot remove yourself from the assessment.");
          return;
      }
      setSelectedTeachers(prev => prev.filter(t => t !== name));
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[80] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 max-h-[90vh] flex flex-col">
        <div className="bg-brand-600 text-white p-4 flex justify-between items-center shrink-0"><h3 className="font-bold flex items-center gap-2"><Calendar size={18}/> {eventToEdit ? 'Edit Event' : (isStudent ? t.calendar.requestEvent : t.calendar.addEvent)}</h3><button onClick={onClose}><X size={20} /></button></div>
        
        <div className="flex border-b border-gray-100 dark:border-slate-800 shrink-0 overflow-x-auto">
            <button 
                onClick={() => { setEventType('academic'); setCategory('Test'); }} 
                className={`flex-1 py-3 px-2 text-sm font-bold flex items-center justify-center gap-2 whitespace-nowrap ${isAssessment ? 'text-brand-600 border-b-2 border-brand-600 bg-brand-50 dark:bg-brand-900/20' : 'text-gray-400'}`}
            >
                <School size={16}/> {t.calendar.academicEvent}
            </button>
            {canCreateSchoolEvent && (
                <button 
                    onClick={() => { setEventType('school'); setCategory('Event'); }} 
                    className={`flex-1 py-3 px-2 text-sm font-bold flex items-center justify-center gap-2 whitespace-nowrap ${isSchoolEvent ? 'text-purple-600 border-b-2 border-purple-600 bg-purple-50 dark:bg-purple-900/20' : 'text-gray-400'}`}
                >
                    <Megaphone size={16}/> {t.calendar.schoolEvent}
                </button>
            )}
            <button 
                onClick={() => { setEventType('personal'); }} 
                className={`flex-1 py-3 px-2 text-sm font-bold flex items-center justify-center gap-2 whitespace-nowrap ${isPersonal ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50 dark:bg-blue-900/20' : 'text-gray-400'}`}
            >
                <User size={16}/> {t.calendar.personalEvent}
            </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
            <div><label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">{t.common.title} <span className="text-red-500">*</span></label><input required type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full border p-2 rounded text-sm outline-none focus:ring-1 focus:ring-brand-500 dark:bg-slate-800 dark:border-slate-700 dark:text-white"/></div>
            
            <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">{t.common.date} <span className="text-red-500">*</span></label><input required type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full border p-2 rounded text-sm outline-none focus:ring-1 focus:ring-brand-500 dark:bg-slate-800 dark:border-slate-700 dark:text-white"/></div>
                {!isPersonal && (
                    <div>
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">{t.common.category} <span className="text-red-500">*</span></label>
                        <select value={category} onChange={e => setCategory(e.target.value)} className="w-full border p-2 rounded text-sm bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-white">
                            {isSchoolEvent ? (
                                <>
                                    <option value="Performance">{t.calendar.performance}</option>
                                    <option value="Event">{t.calendar.event}</option>
                                    <option value="Other">{t.calendar.other}</option>
                                </>
                            ) : (
                                <>
                                    <option value="Test">{t.calendar.test}</option>
                                    <option value="Quiz">{t.calendar.quiz}</option>
                                </>
                            )}
                        </select>
                    </div>
                )}
            </div>
            
            {isAssessment && (
                <>
                    <div className="relative" ref={subjectRef}><label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">{t.common.subject} <span className="text-red-500">*</span></label><div className="relative"><input required type="text" value={subject} onChange={e => { setSubject(e.target.value); setShowSubjectDropdown(true); }} onFocus={() => setShowSubjectDropdown(true)} className="w-full border p-2 rounded text-sm outline-none focus:ring-1 focus:ring-brand-500 dark:bg-slate-800 dark:border-slate-700 dark:text-white"/><ChevronDown className="absolute right-3 top-2.5 text-gray-400 pointer-events-none" size={14} /></div>{showSubjectDropdown && filteredSubjects.length > 0 && (<div className="absolute z-20 w-full bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-lg shadow-xl max-h-40 overflow-y-auto mt-1">{filteredSubjects.map(s => (<button type="button" key={s} onClick={() => { setSubject(s); setShowSubjectDropdown(false); }} className="w-full text-left px-4 py-2 hover:bg-brand-50 dark:hover:bg-slate-700 text-sm border-b border-gray-50 dark:border-slate-700 text-gray-700 dark:text-gray-200">{s}</button>))}</div>)}</div>
                    
                    <div className="relative" ref={teacherRef}>
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">{t.common.teacher} ({t.common.optional})</label>
                        {selectedTeachers.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-2">
                                {selectedTeachers.map(tName => (
                                    <span key={tName} className="bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 text-xs px-2 py-1 rounded flex items-center gap-1 border border-brand-100 dark:border-brand-800 font-bold">
                                        {tName}
                                        <button type="button" onClick={() => removeTeacher(tName)} className="hover:text-red-500"><X size={12}/></button>
                                    </span>
                                ))}
                            </div>
                        )}
                        <div className="relative">
                            <input type="text" value={teacherSearch} onChange={e => { setTeacherSearch(e.target.value); setShowTeacherDropdown(true); }} onFocus={() => setShowTeacherDropdown(true)} className={`w-full border p-2 rounded text-sm outline-none focus:ring-1 focus:ring-brand-500 dark:bg-slate-800 dark:border-slate-700 dark:text-white`} placeholder={t.common.search}/>
                            <Search className="absolute right-3 top-2.5 text-gray-400 pointer-events-none" size={14} />
                        </div>
                        {showTeacherDropdown && filteredTeachers.length > 0 && (
                            <div className="absolute z-20 w-full bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-lg shadow-xl max-h-40 overflow-y-auto mt-1">
                                {filteredTeachers.map(t => (
                                    <button type="button" key={t.id} onClick={() => addTeacher(t.name)} className="w-full text-left px-4 py-2 hover:bg-brand-50 dark:hover:bg-slate-700 text-sm border-b border-gray-50 dark:border-slate-700 text-gray-700 dark:text-gray-200">{t.name}</button>
                                ))}
                            </div>
                        )}
                    </div>
                </>
            )}
            
            {!isPersonal && (
                <div>
                    <div className="flex justify-between items-center mb-2">
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">{t.common.grade}s ({t.common.optional})</label>
                        <div className="flex gap-2">
                            <button type="button" onClick={toggleAllGrades} className="text-xs font-bold text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-900/20 px-2 py-0.5 rounded hover:bg-brand-100 dark:hover:bg-brand-900/30">All</button>
                            <button type="button" onClick={toggleHighSchool} className="text-xs font-bold text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-900/20 px-2 py-0.5 rounded hover:bg-brand-100 dark:hover:bg-brand-900/30">HS (G9-12)</button>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2">{GRADE_LEVELS.map(g => (<button key={g} type="button" onClick={() => toggleGrade(g)} className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${selectedGrades.includes(g) ? 'bg-brand-600 text-white border-brand-600' : 'bg-white dark:bg-slate-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-slate-700 hover:border-brand-300'}`}>{g}</button>))}</div>
                </div>
            )}

            <div><label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">{t.common.description} ({t.common.optional})</label><textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full border p-2 rounded text-sm h-24 resize-none outline-none focus:ring-1 focus:ring-brand-500 dark:bg-slate-800 dark:border-slate-700 dark:text-white" placeholder="Topics covered, event details, etc." /></div>
            
            <button type="submit" className="w-full bg-brand-600 text-white py-2.5 rounded-lg font-bold hover:bg-brand-700 shadow-md">{isStudent && isAssessment ? t.calendar.requestEvent : t.common.confirm}</button>
        </form>
      </div>
    </div>
  );
};

interface ViewAssessmentModalProps { isOpen: boolean; onClose: () => void; event: AssessmentEvent; }

export const ViewAssessmentModal: React.FC<ViewAssessmentModalProps> = ({ isOpen, onClose, event }) => {
    const { t } = useLanguage();
    if (!isOpen) return null;

    let typeLabel = '';
    if (event.eventType === 'personal') typeLabel = t.calendar.personalEvent;
    else if (event.eventType === 'school') typeLabel = t.calendar.schoolEvent;
    else typeLabel = t.calendar.academicEvent;

    return (
        <div className="fixed inset-0 bg-black/50 z-[80] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95">
                <div className="bg-slate-800 text-white p-4 flex justify-between items-center">
                    <h3 className="font-bold flex items-center gap-2"><Info size={18}/> {t.calendar.viewEvent}</h3>
                    <button onClick={onClose}><X size={20} /></button>
                </div>
                <div className="p-6 space-y-4">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-1">{event.title}</h2>
                        <div className="flex gap-2">
                            {event.category && <span className={`text-xs font-bold px-2 py-0.5 rounded ${event.category === 'Quiz' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300' : event.eventType === 'school' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'}`}>{event.category}</span>}
                            <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded font-medium">{typeLabel}</span>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div><div className="text-xs text-slate-400 dark:text-slate-500 uppercase font-bold mb-1">{t.common.date}</div><div className="font-medium dark:text-slate-200">{event.date}</div></div>
                        {event.subject && event.subject !== 'Personal' && event.subject !== 'School Event' && <div><div className="text-xs text-slate-400 dark:text-slate-500 uppercase font-bold mb-1">{t.common.subject}</div><div className="font-medium dark:text-slate-200">{event.subject}</div></div>}
                    </div>

                    {event.teacherName && event.teacherName !== 'Self' && event.teacherName !== 'School' && <div><div className="text-xs text-slate-400 dark:text-slate-500 uppercase font-bold mb-1">{t.common.teacher}</div><div className="font-medium text-sm dark:text-slate-200">{event.teacherName}</div></div>}
                    
                    {event.gradeLevels && event.gradeLevels.length > 0 && (
                        <div><div className="text-xs text-slate-400 dark:text-slate-500 uppercase font-bold mb-1">{t.common.grade}</div><div className="flex flex-wrap gap-1">{event.gradeLevels.map(g => <span key={g} className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-300">{g}</span>)}</div></div>
                    )}

                    {event.description && (
                        <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-lg border border-slate-100 dark:border-slate-700">
                            <div className="text-xs text-slate-400 dark:text-slate-500 uppercase font-bold mb-1 flex items-center gap-1"><FileText size={10}/> {t.common.description}</div>
                            <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">{event.description}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

interface ConfirmDeleteAssessmentModalProps { isOpen: boolean; onClose: () => void; onConfirm: () => void; title: string; }

export const ConfirmDeleteAssessmentModal: React.FC<ConfirmDeleteAssessmentModalProps> = ({ isOpen, onClose, onConfirm, title }) => {
    const { t } = useLanguage();
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/50 z-[80] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95">
                <div className="bg-red-600 text-white p-4 flex justify-between items-center"><h3 className="font-bold">{t.modals.deleteAssessment}</h3><button onClick={onClose}><X size={20} /></button></div>
                <div className="p-6 text-center"><p className="text-gray-700 dark:text-gray-300 mb-6">{t.modals.areYouSure} <strong>{title}</strong>?</p><div className="flex gap-3"><button onClick={onClose} className="flex-1 border py-2 rounded text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800">{t.common.cancel}</button><button onClick={onConfirm} className="flex-1 bg-red-600 text-white py-2 rounded font-bold hover:bg-red-700">{t.common.delete}</button></div></div>
            </div>
        </div>
    );
};

interface ConfirmAddToToDoModalProps { isOpen: boolean; onClose: () => void; onConfirm: () => void; }

export const ConfirmAddToToDoModal: React.FC<ConfirmAddToToDoModalProps> = ({ isOpen, onClose, onConfirm }) => {
    const { t } = useLanguage();
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/50 z-[80] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95">
                <div className="bg-brand-600 text-white p-4 flex justify-between items-center"><h3 className="font-bold flex items-center gap-2"><ClipboardList size={18}/> {t.modals.addToToDo}</h3><button onClick={onClose}><X size={20} /></button></div>
                <div className="p-6 text-center"><p className="text-gray-700 dark:text-gray-300 mb-6">{t.modals.addToToDoMsg}</p><div className="flex gap-3"><button onClick={onClose} className="flex-1 border py-2 rounded text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800">{t.common.cancel}</button><button onClick={onConfirm} className="flex-1 bg-brand-600 text-white py-2 rounded font-bold hover:bg-brand-700">{t.common.confirm}</button></div></div>
            </div>
        </div>
    );
};

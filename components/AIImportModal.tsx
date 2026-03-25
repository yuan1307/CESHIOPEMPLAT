
import React, { useState, useRef, useEffect } from 'react';
import { X, Upload, Loader2, Check, AlertTriangle, Sparkles, Trash2, Search, FileText } from 'lucide-react';
import { parseScheduleFromImage } from '../services/geminiService';
import { ClassPeriod, Teacher, ScheduleMap } from '../types';
import { WEEKDAYS } from '../constants';
import { useLanguage } from '../LanguageContext';

interface AIImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (newSchedule: ScheduleMap) => void;
  availableTeachers: Teacher[];
}

interface ParsedItem {
  day: string;
  periodIndex: number;
  subject: string;
  teacher: string;
  room: string;
}

const AIImportModal: React.FC<AIImportModalProps> = ({ isOpen, onClose, onSave, availableTeachers }) => {
  const { t } = useLanguage();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [parsedData, setParsedData] = useState<ParsedItem[] | null>(null);
  const [focusedRowIndex, setFocusedRowIndex] = useState<number | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
            setFocusedRowIndex(null);
        }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      setFile(selected);
      
      if (selected.type.startsWith('image/')) {
          const url = URL.createObjectURL(selected);
          setPreviewUrl(url);
      } else {
          setPreviewUrl(null); // No preview for PDF
      }
      
      setError('');
      setParsedData(null);
    }
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setLoading(true);
    setError('');

    try {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        const base64 = (evt.target?.result as string).split(',')[1];
        try {
          const result = await parseScheduleFromImage(base64, file.type);
          setParsedData(result);
        } catch (err) {
          setError("Failed to analyze file. Please ensure it's a clear schedule image or PDF.");
        } finally {
          setLoading(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setError("Error processing file.");
      setLoading(false);
    }
  };

  const isChinese = (text: string) => /[\u4e00-\u9fa5]/.test(text);

  const findBestTeacherMatch = (rawName: string): string => {
    if (!rawName) return '';
    if (isChinese(rawName)) return ''; 

    const normalizedRaw = rawName.toLowerCase().replace('.', '').trim();
    
    // 1. Exact match email or name
    const exact = availableTeachers.find(t => t.name.toLowerCase() === normalizedRaw || t.email.toLowerCase().includes(normalizedRaw));
    if (exact) return exact.name;

    // 2. Last name match
    const partial = availableTeachers.find(t => {
        const parts = t.name.toLowerCase().split(' ');
        const lastName = parts[parts.length - 1];
        return normalizedRaw.includes(lastName);
    });
    
    if (partial) return partial.name;

    return rawName; // Fallback
  };

  const handleUpdateRow = (index: number, field: keyof ParsedItem, value: any) => {
      if (!parsedData) return;
      
      let newData = [...parsedData];
      const oldValue = newData[index][field];
      
      // Update the specific row
      newData[index] = { ...newData[index], [field]: value };

      // Auto-propagate teacher name changes to all rows with the same original name
      if (field === 'teacher') {
          newData = newData.map(item => {
              if (item.teacher === oldValue) {
                  return { ...item, teacher: value };
              }
              return item;
          });
      }
      
      setParsedData(newData);
  };

  const handleTeacherSelect = (index: number, teacherName: string) => {
     handleUpdateRow(index, 'teacher', teacherName);
     setFocusedRowIndex(null);
  };

  const handleDeleteRow = (index: number) => {
      if (!parsedData) return;
      const newData = [...parsedData];
      newData.splice(index, 1);
      setParsedData(newData);
  };

  const handleConfirm = () => {
    if (!parsedData) return;

    // Validation: Enforce English names
    const hasNonEnglish = parsedData.some(item => isChinese(item.teacher));

    if (hasNonEnglish) {
        alert("Please select English names for all teachers (dropdown) before importing.");
        return;
    }

    const newSchedule: ScheduleMap = {};

    // Initialize empty schedule first
    WEEKDAYS.forEach(day => {
        for(let i=0; i<8; i++) {
            const id = `${day}-${i}`;
            newSchedule[id] = { id, subject: '', tasks: [] };
        }
    });

    parsedData.forEach(item => {
        // Normalize day
        const dayMap: {[key:string]: string} = { 'Monday': 'Mon', 'Tuesday': 'Tue', 'Wednesday': 'Wed', 'Thursday': 'Thu', 'Friday': 'Fri' };
        let shortDay = item.day.length > 3 ? dayMap[item.day] || item.day.substring(0,3) : item.day;
        
        // Capitalize first letter
        shortDay = shortDay.charAt(0).toUpperCase() + shortDay.slice(1).toLowerCase();

        if (WEEKDAYS.includes(shortDay) && item.periodIndex >= 0 && item.periodIndex < 8) {
            const id = `${shortDay}-${item.periodIndex}`;
            
            // Final check on teacher name match
            let teacherName = item.teacher;
            const matchedTeacher = availableTeachers.find(t => t.name === teacherName);
            const finalTeacherName = matchedTeacher ? matchedTeacher.name : findBestTeacherMatch(teacherName);

            newSchedule[id] = {
                id,
                subject: item.subject,
                teacherName: finalTeacherName,
                teacherId: matchedTeacher?.id || availableTeachers.find(t => t.name === finalTeacherName)?.id,
                room: item.room,
                tasks: [] 
            };
        }
    });

    onSave(newSchedule);
    onClose();
  };

  // Sort teachers alphabetically for the dropdown
  const sortedTeachers = [...availableTeachers].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="fixed inset-0 bg-black/60 z-[90] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[90vh]">
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6 flex justify-between items-center">
            <div>
                <h3 className="font-bold text-xl flex items-center gap-2"><Sparkles size={24} className="text-yellow-300"/> {t.aiImport.title}</h3>
                <p className="text-indigo-100 text-sm mt-1">{t.aiImport.subtitle}</p>
            </div>
            <button onClick={onClose} className="hover:bg-white/20 p-2 rounded-full transition-colors"><X size={24} /></button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 bg-slate-50">
            {!parsedData ? (
                <div className="flex flex-col items-center justify-center h-full min-h-[300px] gap-6">
                    {file ? (
                         <div className="relative w-full max-w-sm bg-gray-100 rounded-lg overflow-hidden shadow-md border border-gray-200 p-4 flex flex-col items-center justify-center">
                             {previewUrl ? (
                                <img src={previewUrl} alt="Preview" className="w-full h-48 object-contain mb-2" />
                             ) : (
                                <div className="w-full h-48 flex flex-col items-center justify-center text-slate-400">
                                    <FileText size={48} className="mb-2"/>
                                    <span className="text-sm font-bold">PDF Document</span>
                                </div>
                             )}
                             <p className="text-sm font-bold text-slate-700 truncate w-full text-center">{file.name}</p>
                             <button onClick={() => { setFile(null); setPreviewUrl(null); }} className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white p-1 rounded-full"><X size={16}/></button>
                         </div>
                    ) : (
                        <div 
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full max-w-sm aspect-video border-2 border-dashed border-indigo-300 bg-indigo-50 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:bg-indigo-100 transition-colors group"
                        >
                            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4 group-hover:scale-110 transition-transform">
                                <Upload size={32} className="text-indigo-500"/>
                            </div>
                            <p className="font-bold text-indigo-700">{t.aiImport.dragDrop}</p>
                            <p className="text-xs text-indigo-400 mt-1">Supports JPG, PNG, PDF</p>
                        </div>
                    )}
                    
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*,application/pdf" className="hidden" />

                    {error && <div className="text-red-600 bg-red-50 px-4 py-2 rounded-lg border border-red-100 flex items-center gap-2 text-sm"><AlertTriangle size={16}/> {error}</div>}

                    <div className="w-full max-w-sm">
                        <button 
                            onClick={handleAnalyze} 
                            disabled={!file || loading}
                            className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold text-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/30 transition-all"
                        >
                            {loading ? <><Loader2 className="animate-spin"/> {t.aiImport.analyzing}</> : <>{t.aiImport.analyzeBtn}</>}
                        </button>
                    </div>
                    {loading && <p className="text-xs text-slate-400 animate-pulse">{t.aiImport.waitMsg}</p>}
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                         <h4 className="font-bold text-slate-800 flex items-center gap-2"><Check className="text-green-500"/> {t.aiImport.previewTitle}</h4>
                         <button onClick={() => setParsedData(null)} className="text-xs text-slate-500 underline hover:text-indigo-600">{t.aiImport.reupload}</button>
                    </div>
                    <div className="bg-white rounded-xl border border-slate-200 overflow-visible shadow-sm">
                        <div className="grid grid-cols-12 bg-slate-100 p-2 font-bold text-xs text-slate-500 uppercase border-b border-slate-200 gap-2">
                            <div className="col-span-1">Day</div>
                            <div className="col-span-1">Per</div>
                            <div className="col-span-3">Subject</div>
                            <div className="col-span-4">Teacher</div>
                            <div className="col-span-2">Room</div>
                            <div className="col-span-1 text-center">Del</div>
                        </div>
                        <div className="max-h-[400px] overflow-y-auto">
                            {parsedData.map((item, idx) => {
                                const isRowFocused = focusedRowIndex === idx;
                                const currentTeacherValue = item.teacher;
                                const hasChineseName = isChinese(currentTeacherValue);
                                const filteredTeachers = sortedTeachers.filter(t => t.name.toLowerCase().includes(currentTeacherValue.toLowerCase()));

                                return (
                                    <div key={idx} className="grid grid-cols-12 p-2 text-sm border-b border-slate-100 last:border-0 hover:bg-slate-50 gap-2 items-center relative">
                                        <div className="col-span-1 font-medium text-slate-700 truncate">{item.day}</div>
                                        <div className="col-span-1 text-slate-500">{item.periodIndex}</div>
                                        <div className="col-span-3">
                                            <input 
                                                type="text" 
                                                value={item.subject} 
                                                onChange={(e) => handleUpdateRow(idx, 'subject', e.target.value)} 
                                                className="w-full border border-slate-200 rounded px-2 py-1 text-xs font-bold text-indigo-700 focus:ring-1 focus:ring-indigo-500 outline-none"
                                            />
                                        </div>
                                        <div className="col-span-4 relative flex items-center gap-1">
                                            <div className="relative w-full">
                                                <input 
                                                    type="text" 
                                                    value={currentTeacherValue} 
                                                    onChange={(e) => { handleUpdateRow(idx, 'teacher', e.target.value); setFocusedRowIndex(idx); }}
                                                    onFocus={() => setFocusedRowIndex(idx)}
                                                    className={`w-full border rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-indigo-500 ${hasChineseName ? 'border-red-300 text-red-800 bg-red-50' : 'border-slate-200 text-slate-600'}`}
                                                />
                                                {isRowFocused && (
                                                    <div ref={dropdownRef} className="absolute z-[100] w-full bg-white border border-slate-200 rounded-lg shadow-xl max-h-40 overflow-y-auto mt-1 left-0">
                                                        {filteredTeachers.length > 0 ? (
                                                            filteredTeachers.map(t => (
                                                                <button 
                                                                    key={t.id} 
                                                                    onClick={() => handleTeacherSelect(idx, t.name)} 
                                                                    className="w-full text-left px-3 py-2 hover:bg-indigo-50 text-xs border-b border-slate-50 text-slate-700"
                                                                >
                                                                    {t.name}
                                                                </button>
                                                            ))
                                                        ) : (
                                                            <div className="px-3 py-2 text-xs text-slate-400">No matches</div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                            {hasChineseName && <span className="text-red-600 font-bold text-lg select-none" title="English Name Required">*</span>}
                                        </div>
                                        <div className="col-span-2">
                                            <input 
                                                type="text" 
                                                value={item.room} 
                                                onChange={(e) => handleUpdateRow(idx, 'room', e.target.value)}
                                                className="w-full border border-slate-200 rounded px-2 py-1 text-xs text-slate-400 focus:ring-1 focus:ring-indigo-500 outline-none"
                                            />
                                        </div>
                                        <div className="col-span-1 text-center">
                                            <button onClick={() => handleDeleteRow(idx)} className="text-slate-300 hover:text-red-500 p-1"><Trash2 size={14} /></button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                    <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-100 text-xs text-yellow-800 flex gap-2">
                        <AlertTriangle size={16} className="shrink-0"/>
                        {t.aiImport.disclaimer}
                    </div>
                </div>
            )}
        </div>

        {parsedData && (
            <div className="p-4 bg-white border-t border-slate-200 flex justify-end gap-3">
                <button onClick={onClose} className="px-6 py-2 rounded-lg font-bold text-slate-500 hover:bg-slate-100 transition-colors">{t.common.cancel}</button>
                <button onClick={handleConfirm} className="px-6 py-2 rounded-lg font-bold bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-500/20 transition-all">{t.aiImport.importBtn}</button>
            </div>
        )}
      </div>
    </div>
  );
};

export default AIImportModal;

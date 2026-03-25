
import React, { useMemo, useState, useEffect } from 'react';
import { ScheduleMap, Task, ClassPeriod, Importance, Urgency, TaskCategory } from '../types';
import { CheckCircle2, Calendar, AlertCircle, GraduationCap, ClipboardList, ShieldCheck, User, Plus, X, Edit2, Clock, AlarmClock } from 'lucide-react';
import { useLanguage } from '../LanguageContext';
import { TASK_CATEGORIES } from '../constants';

interface ToDoPageProps {
  schedule: ScheduleMap;
  onDeleteTask: (periodId: string, taskId: string) => void;
  onUpdateSchedule: (newSchedule: ScheduleMap) => void;
}

type AddTaskContext = 'assessment' | 'assignment' | 'personal';

const ToDoPage: React.FC<ToDoPageProps> = ({ schedule, onDeleteTask, onUpdateSchedule }) => {
  const { t } = useLanguage();
  const [addTaskModalOpen, setAddTaskModalOpen] = useState(false);
  const [addContext, setAddContext] = useState<AddTaskContext>('personal');
  const [editingTask, setEditingTask] = useState<{task: Task, periodId: string} | null>(null);
  
  const isOverdue = (dateStr?: string) => {
    if (!dateStr) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dateStr);
    return due < today;
  };

  const { assessments, tasks, personalTasks, urgentItem } = useMemo(() => {
    const rawAssessments: (Task & { subject: string; periodId: string })[] = [];
    const rawTasks: (Task & { subject: string; periodId: string })[] = [];
    const rawPersonal: (Task & { subject: string; periodId: string })[] = [];
    const processedIds = new Set<string>();
    const today = new Date();
    today.setHours(0,0,0,0);

    let nearestItem: { task: Task, daysLeft: number } | null = null;

    (Object.values(schedule) as ClassPeriod[]).forEach((period) => {
      period.tasks.forEach(task => {
        if (!processedIds.has(task.id)) {
          processedIds.add(task.id);
          const enrichedTask = { ...task, subject: task.subject || period.subject || 'Untitled', periodId: period.id };
          
          // Logic for Urgent Item Banner
          if ((task.category === 'Test' || task.category === 'Quiz' || task.category === 'Project') && task.dueDate && !task.completed) {
              const due = new Date(task.dueDate);
              due.setHours(0,0,0,0);
              const diffTime = due.getTime() - today.getTime();
              const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              
              if (daysLeft >= 0) { // Only future or today
                  if (!nearestItem || daysLeft < nearestItem.daysLeft) {
                      nearestItem = { task: enrichedTask, daysLeft };
                  }
              }
          }

          if (task.category === 'Test' || task.category === 'Quiz') { 
              rawAssessments.push(enrichedTask); 
          } else if (task.category === 'Personal') {
              rawPersonal.push(enrichedTask);
          } else { 
              rawTasks.push(enrichedTask); 
          }
        }
      });
    });

    const sortFn = (a: any, b: any) => {
        const aOver = isOverdue(a.dueDate);
        const bOver = isOverdue(b.dueDate);
        if (aOver && !bOver) return -1;
        if (!aOver && bOver) return 1;
        if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
        return 0;
    };
    return { 
        assessments: rawAssessments.sort(sortFn), 
        tasks: rawTasks.sort(sortFn),
        personalTasks: rawPersonal.sort(sortFn),
        urgentItem: nearestItem
    };
  }, [schedule]);

  const renderTaskCard = (tsk: Task & { subject: string; periodId: string }) => {
      const overdue = isOverdue(tsk.dueDate);
      const isPersonal = tsk.category === 'Personal';
      return (
        <div key={tsk.id} className={`p-4 rounded-xl border mb-3 transition-all ${overdue ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-900/50' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-brand-300 dark:hover:border-brand-700'} group relative`}>
            <div className="flex justify-between items-start">
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                        <h4 className={`font-bold ${overdue ? 'text-red-700 dark:text-red-400' : 'text-slate-800 dark:text-white'}`}>{tsk.title}</h4>
                        {tsk.source === 'teacher' && <span className="flex items-center gap-1 text-[10px] bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full font-bold"><ShieldCheck size={10} /> {t.todo.teacherAssigned}</span>}
                        <span className="text-[10px] uppercase font-bold bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 px-2 py-0.5 rounded">{tsk.category}</span>
                    </div>
                    {/* Hide subject for personal tasks */}
                    {!isPersonal && tsk.subject && tsk.subject !== 'Untitled' && <div className="text-sm text-slate-600 dark:text-slate-300 font-medium mb-1">{tsk.subject}</div>}
                    {tsk.description && <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">{tsk.description}</p>}
                    <div className="flex gap-3 text-xs text-slate-400 dark:text-slate-500">
                        {tsk.dueDate && (<span className={`flex items-center gap-1 ${overdue ? 'text-red-600 dark:text-red-400 font-bold' : ''}`}><Calendar size={12} /> {tsk.dueDate} {overdue && `(${t.todo.overdue})`}</span>)}
                        <span className="flex items-center gap-1"><AlertCircle size={12} /> {tsk.importance} / {tsk.urgency}</span>
                    </div>
                </div>
                <div className="flex flex-col gap-1">
                    <button onClick={() => onDeleteTask(tsk.periodId, tsk.id)} className="text-slate-300 hover:text-green-600 transition-colors p-2" title="Mark Complete"><CheckCircle2 size={24} /></button>
                    <button onClick={() => setEditingTask({task: tsk, periodId: tsk.periodId})} className="text-slate-300 hover:text-brand-600 transition-colors p-2 opacity-0 group-hover:opacity-100"><Edit2 size={18} /></button>
                </div>
            </div>
        </div>
      );
  };

  const AddTaskModal = () => {
      let allowedCategories: TaskCategory[] = [];
      let initialCategory: TaskCategory = 'Personal';

      if (addContext === 'assessment') {
          allowedCategories = ['Test', 'Quiz'];
          initialCategory = 'Test';
      } else if (addContext === 'assignment') {
          allowedCategories = ['Project', 'Homework', 'Presentation', 'Others'];
          initialCategory = 'Homework';
      } else {
          allowedCategories = ['Personal'];
          initialCategory = 'Personal';
      }

      const [title, setTitle] = useState('');
      const [desc, setDesc] = useState('');
      const [date, setDate] = useState('');
      const [importance, setImportance] = useState<Importance>(Importance.Medium);
      const [urgency, setUrgency] = useState<Urgency>(Urgency.Medium);
      const [category, setCategory] = useState<TaskCategory>(initialCategory);
      const [subject, setSubject] = useState('');

      const handleSave = () => {
          if (!title) return;
          const newTask: Task = {
              id: `t-personal-${Date.now()}`,
              title,
              description: desc,
              category,
              importance,
              urgency,
              dueDate: date,
              completed: false,
              source: 'student',
              subject: subject.trim() || undefined
          };

          const newSchedule = { ...schedule };
          
          if (subject.trim()) {
              let foundSubject = false;
              // Add to ALL matching periods to ensure synchronization
              Object.keys(newSchedule).forEach(key => {
                  if (newSchedule[key].subject && newSchedule[key].subject.toLowerCase() === subject.trim().toLowerCase()) {
                      newSchedule[key] = {
                          ...newSchedule[key],
                          tasks: [...newSchedule[key].tasks, newTask]
                      };
                      foundSubject = true;
                  }
              });

              if (!foundSubject) {
                  // Fallback: Add to Mon-0 if subject not found in schedule
                  if (!newSchedule['Mon-0']) {
                      newSchedule['Mon-0'] = { id: 'Mon-0', subject: '', tasks: [] };
                  }
                  newSchedule['Mon-0'].tasks.push(newTask);
              }
          } else {
              // No subject: Add to Mon-0
              if (!newSchedule['Mon-0']) {
                  newSchedule['Mon-0'] = { id: 'Mon-0', subject: '', tasks: [] };
              }
              newSchedule['Mon-0'].tasks.push(newTask);
          }

          onUpdateSchedule(newSchedule);
          setAddTaskModalOpen(false);
      };

      return (
          <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95">
                  <div className="bg-brand-600 text-white p-4 flex justify-between items-center"><h3 className="font-bold flex items-center gap-2"><Plus size={18}/> {t.todo.addTask}</h3><button onClick={() => setAddTaskModalOpen(false)}><X size={20}/></button></div>
                  <div className="p-6 space-y-4">
                      <div><label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">{t.common.title} <span className="text-red-500">*</span></label><input required type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full border p-2 rounded text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-white"/></div>
                      <div>
                          <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">{t.common.category}</label>
                          {addContext === 'personal' ? (
                              <div className="w-full border border-gray-200 dark:border-slate-700 bg-gray-100 dark:bg-slate-800 rounded p-2 text-sm text-gray-600 dark:text-gray-300 font-medium">Personal</div>
                          ) : (
                              <select value={category} onChange={e => setCategory(e.target.value as TaskCategory)} className="w-full border border-slate-200 dark:border-slate-700 rounded p-2 text-sm bg-white dark:bg-slate-800 dark:text-white">
                                  {allowedCategories.map(c => <option key={c} value={c}>{c}</option>)}
                              </select>
                          )}
                      </div>
                      <div><label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">{t.common.date}</label><input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full border p-2 rounded text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-white"/></div>
                      <div><label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">{t.common.subject} ({t.common.optional})</label><input type="text" value={subject} onChange={e => setSubject(e.target.value)} className="w-full border p-2 rounded text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-white"/></div>
                      <div><label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">{t.common.description}</label><textarea value={desc} onChange={e => setDesc(e.target.value)} className="w-full border p-2 rounded text-sm h-16 resize-none dark:bg-slate-800 dark:border-slate-700 dark:text-white"/></div>
                      <div className="grid grid-cols-2 gap-4">
                          <div><label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Importance</label><select value={importance} onChange={e => setImportance(e.target.value as Importance)} className="w-full border p-2 rounded text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-white"><option value="High">High</option><option value="Medium">Medium</option><option value="Low">Low</option></select></div>
                          <div><label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Urgency</label><select value={urgency} onChange={e => setUrgency(e.target.value as Urgency)} className="w-full border p-2 rounded text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-white"><option value="High">High</option><option value="Medium">Medium</option><option value="Low">Low</option></select></div>
                      </div>
                      <button onClick={handleSave} className="w-full bg-brand-600 text-white py-2 rounded font-bold hover:bg-brand-700">{t.common.save}</button>
                  </div>
              </div>
          </div>
      );
  };

  const EditTaskModal = () => {
      if (!editingTask) return null;
      const { task, periodId } = editingTask;
      const [title, setTitle] = useState(task.title);
      const [desc, setDesc] = useState(task.description || '');
      const [date, setDate] = useState(task.dueDate || '');
      const [importance, setImportance] = useState(task.importance);
      const [urgency, setUrgency] = useState(task.urgency);
      const [category, setCategory] = useState<TaskCategory>(task.category);

      const handleUpdate = () => {
          const updatedSchedule = { ...schedule };
          const period = updatedSchedule[periodId];
          
          if (period) {
              const subject = period.subject;
              
              const updateTaskInPeriod = (p: ClassPeriod) => ({
                  ...p,
                  tasks: p.tasks.map(t => t.id === task.id ? { ...t, title, description: desc, dueDate: date, importance, urgency, category } : t)
              });

              if (subject) {
                  // Propagate to ALL periods with same subject to fix synchronization
                  Object.keys(updatedSchedule).forEach(key => {
                      if (updatedSchedule[key].subject === subject) {
                          updatedSchedule[key] = updateTaskInPeriod(updatedSchedule[key]);
                      }
                  });
              } else {
                  // Single period update (e.g. Free period task)
                  updatedSchedule[periodId] = updateTaskInPeriod(period);
              }

              onUpdateSchedule(updatedSchedule);
          }
          setEditingTask(null);
      };

      return (
          <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95">
                  <div className="bg-brand-600 text-white p-4 flex justify-between items-center"><h3 className="font-bold flex items-center gap-2"><Edit2 size={18}/> {t.todo.editTask}</h3><button onClick={() => setEditingTask(null)}><X size={20}/></button></div>
                  <div className="p-6 space-y-4">
                      <div><label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">{t.common.title}</label><input required type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full border p-2 rounded text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-white"/></div>
                      <div>
                          <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">{t.common.category}</label>
                          <select value={category} onChange={e => setCategory(e.target.value as TaskCategory)} className="w-full border border-slate-200 dark:border-slate-700 rounded p-2 text-sm bg-white dark:bg-slate-800 dark:text-white">
                              {TASK_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                      </div>
                      <div><label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">{t.common.date}</label><input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full border p-2 rounded text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-white"/></div>
                      <div><label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">{t.common.description}</label><textarea value={desc} onChange={e => setDesc(e.target.value)} className="w-full border p-2 rounded text-sm h-16 resize-none dark:bg-slate-800 dark:border-slate-700 dark:text-white"/></div>
                      <div className="grid grid-cols-2 gap-4">
                          <div><label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Importance</label><select value={importance} onChange={e => setImportance(e.target.value as Importance)} className="w-full border p-2 rounded text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-white"><option value="High">High</option><option value="Medium">Medium</option><option value="Low">Low</option></select></div>
                          <div><label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Urgency</label><select value={urgency} onChange={e => setUrgency(e.target.value as Urgency)} className="w-full border p-2 rounded text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-white"><option value="High">High</option><option value="Medium">Medium</option><option value="Low">Low</option></select></div>
                      </div>
                      <button onClick={handleUpdate} className="w-full bg-brand-600 text-white py-2 rounded font-bold hover:bg-brand-700">{t.common.save}</button>
                  </div>
              </div>
          </div>
      );
  };

  const openAddModal = (context: AddTaskContext) => {
      setAddContext(context);
      setAddTaskModalOpen(true);
  };

  return (
    <div className="max-w-[1600px] mx-auto p-4 md:p-10">
      {addTaskModalOpen && <AddTaskModal />}
      {editingTask && <EditTaskModal />}
      
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div><h1 className="text-xl md:text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2"><CheckCircle2 className="text-brand-600 dark:text-brand-400" /> {t.todo.header}</h1><p className="text-slate-500 dark:text-slate-400 text-sm mt-1">{t.todo.subtitle}</p></div>
          
          {urgentItem && (
              <div className="bg-gradient-to-r from-red-600 to-orange-500 text-white p-3 md:p-4 rounded-xl shadow-lg flex items-center gap-3 md:gap-4 animate-in slide-in-from-right-4 w-full md:w-auto">
                  <div className="p-2 bg-white/20 rounded-lg"><AlarmClock size={24} className="animate-pulse"/></div>
                  <div>
                      <div className="text-[10px] md:text-xs font-bold uppercase tracking-wider opacity-90">{t.todo.nextBigThing}</div>
                      <div className="font-bold text-base md:text-lg">{urgentItem.task.title}</div>
                      <div className="text-xs md:text-sm font-medium opacity-90">
                          {urgentItem.daysLeft === 0 ? t.todo.today : urgentItem.daysLeft === 1 ? t.todo.tomorrow : `${urgentItem.daysLeft} ${t.todo.daysLeft}`}
                      </div>
                  </div>
              </div>
          )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          <div className="bg-slate-50/50 dark:bg-slate-900/50 p-4 md:p-6 rounded-2xl border border-slate-200 dark:border-slate-700">
              <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-lg text-slate-700 dark:text-white flex items-center gap-2"><GraduationCap className="text-brand-600 dark:text-brand-400" /> {t.todo.assessments}<span className="bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 px-2 py-0.5 rounded-full text-xs">{assessments.length}</span></h3>
                  <button onClick={() => openAddModal('assessment')} className="text-brand-600 hover:bg-brand-50 dark:hover:bg-slate-800 p-1.5 rounded transition-colors"><Plus size={20}/></button>
              </div>
              {assessments.length === 0 ? <div className="text-center py-12 text-slate-400 dark:text-slate-500"><Calendar size={48} className="mx-auto mb-4 opacity-20" /> {t.todo.noAssessments}</div> : assessments.map(renderTaskCard)}
          </div>
          <div className="bg-slate-50/50 dark:bg-slate-900/50 p-4 md:p-6 rounded-2xl border border-slate-200 dark:border-slate-700">
              <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-lg text-slate-700 dark:text-white flex items-center gap-2"><ClipboardList className="text-brand-600 dark:text-brand-400" /> {t.todo.priorityTasks}<span className="bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 px-2 py-0.5 rounded-full text-xs">{tasks.length}</span></h3>
                  <button onClick={() => openAddModal('assignment')} className="text-brand-600 hover:bg-brand-50 dark:hover:bg-slate-800 p-1.5 rounded transition-colors"><Plus size={20}/></button>
              </div>
              {tasks.length === 0 ? <div className="text-center py-12 text-slate-400 dark:text-slate-500"><CheckCircle2 size={48} className="mx-auto mb-4 opacity-20" /> {t.todo.noTasks}</div> : tasks.map(renderTaskCard)}
          </div>
          <div className="bg-slate-50/50 dark:bg-slate-900/50 p-4 md:p-6 rounded-2xl border border-slate-200 dark:border-slate-700">
              <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-lg text-slate-700 dark:text-white flex items-center gap-2"><User className="text-brand-600 dark:text-brand-400" /> {t.todo.personalTasks}<span className="bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 px-2 py-0.5 rounded-full text-xs">{personalTasks.length}</span></h3>
                  <button onClick={() => openAddModal('personal')} className="text-brand-600 hover:bg-brand-50 dark:hover:bg-slate-800 p-1.5 rounded transition-colors"><Plus size={20}/></button>
              </div>
              {personalTasks.length === 0 ? <div className="text-center py-12 text-slate-400 dark:text-slate-500"><CheckCircle2 size={48} className="mx-auto mb-4 opacity-20" /> {t.todo.noTasks}</div> : personalTasks.map(renderTaskCard)}
          </div>
      </div>
    </div>
  );
};
export default ToDoPage;

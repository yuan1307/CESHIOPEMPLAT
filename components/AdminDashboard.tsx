
import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { User, Teacher, UserRole, CommunityPost, Warning, FeatureFlags, SystemRecord, ActionType, AssessmentEvent, ScheduleMap, GradeCourse, SupportTicket, Attachment, SystemAnnouncement } from '../types';
import { db } from '../services/db';
import { audit } from '../services/audit';
import { LayoutDashboard, Trash2, Eye, Search, Plus, Ban, KeyRound, Database, Shield, LogOut, AlertTriangle, CheckCircle2, Inbox, Briefcase, Edit2, Download, Upload, LogIn, Settings, Sliders, ToggleLeft, ToggleRight, Calendar, PlusCircle, Globe, FileText, Filter, X, CheckSquare, Square, ShieldAlert, MessageSquare, Circle, Ticket, Send, LifeBuoy, CornerDownLeft, Paperclip, Bell, Power, Lock, RefreshCw, Unlock, Loader2, GraduationCap } from 'lucide-react';
import { AddTeacherModal, AddSubjectModal, ConfirmDeleteModal, SendWarningModal, WarningHistoryModal, EditUserModal, AdminChangePasswordModal, RejectPostModal, ChangeRoleModal, BanUserModal, EditTeacherModal, EditSubjectModal, ConfirmCreateAccountModal, AddRecordModal, EditRecordModal, ConfirmDeleteRecordModal, ConfirmDeleteAllRecordsModal, ConfirmMultiBanModal, ManageSuperAdminModal, ConfirmGenericModal, ImportSelectionModal } from './AdminModals';
import { ADMIN_ID, DEFAULT_FLAGS, SUPER_ADMIN_ID_2, LANGUAGES } from '../constants';
import { useLanguage } from '../LanguageContext';
import { checkContentSafety } from '../services/geminiService';
import ScheduleGrid from './ScheduleGrid';
import SystemLogs from './admin/SystemLogs';

interface AdminDashboardProps { onLogout: () => void; onSwitchView: () => void; onSpectate: (userId: string) => void; onImpersonate: (userId: string) => void; currentUser: User; teachers: Teacher[]; onAddTeacher: (t: Teacher, createAccount: boolean) => void; onDeleteTeacher: (id: string) => void; subjects: string[]; onAddSubject: (s: string[]) => void; onDeleteSubject: (s: string) => void; }
interface EnrolledUser { user: User; key: string; }

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onLogout, onSwitchView, onSpectate, onImpersonate, currentUser, teachers, onAddTeacher, onDeleteTeacher, subjects, onAddSubject, onDeleteSubject }) => {
  const { t, language, setLanguage } = useLanguage();
  const [userSearch, setUserSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'users' | 'moderation' | 'database' | 'management' | 'tickets'>('users');
  const [userList, setUserList] = useState<EnrolledUser[]>([]);
  const [teacherSearch, setTeacherSearch] = useState('');
  const [subjectSearch, setSubjectSearch] = useState('');
  const [pendingPosts, setPendingPosts] = useState<CommunityPost[]>([]);
  const [pendingAssessments, setPendingAssessments] = useState<AssessmentEvent[]>([]);
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);
  const [userTypeFilter, setUserTypeFilter] = useState<'student' | 'staff'>('student');
  const [featureFlags, setFeatureFlags] = useState<FeatureFlags>(DEFAULT_FLAGS);
  
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [systemRecords, setSystemRecords] = useState<SystemRecord[]>([]);

  const [isSuperAdminMode, setIsSuperAdminMode] = useState(false);
  const [isManageSuperAdminOpen, setIsManageSuperAdminOpen] = useState(false);
  const [superAdminActionType, setSuperAdminActionType] = useState<'grant' | 'revoke'>('grant');

  const [selectedTeacherIds, setSelectedTeacherIds] = useState<string[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);

  const [isAddTeacherOpen, setIsAddTeacherOpen] = useState(false);
  const [isAddSubjectOpen, setIsAddSubjectOpen] = useState(false);
  const [isWarningOpen, setIsWarningOpen] = useState(false);
  const [viewHistoryUser, setViewHistoryUser] = useState<User | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [rejectingPost, setRejectingPost] = useState<CommunityPost | null>(null);
  const [roleChangeData, setRoleChangeData] = useState<{user: User, key: string, role: UserRole} | null>(null);
  const [banUserData, setBanUserData] = useState<{user: User, key: string} | null>(null);
  const [deleteModal, setDeleteModal] = useState<{isOpen: boolean; title: string; message: string; onConfirm: () => void;}>({ isOpen: false, title: '', message: '', onConfirm: () => {} });
  
  const [editTeacherData, setEditTeacherData] = useState<Teacher | null>(null);
  const [editSubjectData, setEditSubjectData] = useState<string | null>(null);
  
  const [bulkActionModal, setBulkActionModal] = useState<{isOpen: boolean; title: string; message: string; onConfirm: () => void; type: 'danger' | 'success'}>({ isOpen: false, title: '', message: '', onConfirm: () => {}, type: 'danger' });

  const [addRecordOpen, setAddRecordOpen] = useState(false);
  const [editRecordData, setEditRecordData] = useState<SystemRecord | null>(null);
  const [deleteRecordData, setDeleteRecordData] = useState<SystemRecord | null>(null);
  const [deleteAllRecordsOpen, setDeleteAllRecordsOpen] = useState(false);

  const [viewScheduleUser, setViewScheduleUser] = useState<User | null>(null);
  const [viewScheduleData, setViewScheduleData] = useState<ScheduleMap | null>(null);

  const [viewingTicket, setViewingTicket] = useState<SupportTicket | null>(null);
  const [ticketReplyText, setTicketReplyText] = useState('');
  const [ticketReplyFile, setTicketReplyFile] = useState<Attachment | null>(null);
  const [ticketLoading, setTicketLoading] = useState(false);
  const [ticketToDeleteId, setTicketToDeleteId] = useState<string | null>(null);

  const [announcements, setAnnouncements] = useState<SystemAnnouncement[]>([]);
  const [newAnnouncementMsg, setNewAnnouncementMsg] = useState('');
  const [announcementToDeleteId, setAnnouncementToDeleteId] = useState<string | null>(null);

  const [isLockdownModalOpen, setIsLockdownModalOpen] = useState(false);
  const [lockdownStep, setLockdownStep] = useState<1 | 2 | 3>(1);
  const [lockdownPassword, setLockdownPassword] = useState('');

  const [pendingImportData, setPendingImportData] = useState<Record<string, any> | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  
  const [isDataLoading, setIsDataLoading] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const ticketReplyFileInputRef = useRef<HTMLInputElement>(null);

  const isSuperAdmin = currentUser.id === ADMIN_ID || currentUser.hasSuperAdminPrivilege || currentUser.id === SUPER_ADMIN_ID_2;

  useEffect(() => { 
      const init = async () => {
          setIsDataLoading(true);
          await Promise.all([
              refreshUserList(), 
              refreshPendingPosts(), 
              refreshPendingAssessments(), 
              refreshTickets(),
              refreshFlags(), 
              refreshRecords(), 
              refreshAnnouncements()
          ]);
          setIsDataLoading(false);
      };
      init();

      const userRefreshInterval = setInterval(refreshUserList, 30000); 
      return () => clearInterval(userRefreshInterval);
  }, []);
  
  useEffect(() => {
      const loadTabData = async () => {
          setIsDataLoading(true);
          if (activeTab === 'moderation' || activeTab === 'tickets') {
              await Promise.all([refreshPendingPosts(), refreshPendingAssessments(), refreshTickets()]);
          }
          if (activeTab === 'management') {
              await Promise.all([refreshAnnouncements(), refreshFlags()]);
          }
          if (activeTab === 'database') {
              await refreshRecords();
          }
          setIsDataLoading(false);
      };
      loadTabData();
  }, [activeTab]);

  useEffect(() => {
    if (viewScheduleUser) {
        db.getItem<ScheduleMap>(`basis_schedule_${viewScheduleUser.id}`).then(s => setViewScheduleData(s || {}));
    } else {
        setViewScheduleData(null);
    }
  }, [viewScheduleUser]);

  const refreshUserList = async () => { const results = await db.scan<User>('basis_user_'); const enriched = results.map(r => ({ user: r.value, key: r.key })); enriched.sort((a,b) => a.user.id.localeCompare(b.user.id)); setUserList(enriched); };
  const refreshPendingPosts = async () => { const posts = await db.getItem<CommunityPost[]>('basis_community_posts'); if (posts) setPendingPosts(posts.filter(p => p.status === 'pending')); };
  const refreshPendingAssessments = async () => { const events = await db.getItem<AssessmentEvent[]>('basis_assessment_events'); if (events) setPendingAssessments(events.filter(e => e.status === 'pending')); };
  const refreshTickets = async () => { const tickets = await db.getItem<SupportTicket[]>('basis_support_tickets') || []; setSupportTickets(tickets.sort((a,b) => b.timestamp - a.timestamp)); };
  const refreshFlags = async () => { 
      const flags = await db.getItem<FeatureFlags>('basis_feature_flags'); 
      if (flags) setFeatureFlags({ ...DEFAULT_FLAGS, ...flags }); 
  };
  const refreshRecords = async () => { const records = await audit.getRecords(); setSystemRecords(records.sort((a, b) => b.timestamp - a.timestamp)); }; 
  const refreshAnnouncements = async () => { const saved = await db.getItem<SystemAnnouncement[]>('basis_system_announcements') || []; setAnnouncements(saved); };

  const handleCreateAnnouncement = async () => {
      if (!newAnnouncementMsg.trim()) return;
      const newAnn: SystemAnnouncement = {
          id: `ann-${Date.now()}`,
          message: newAnnouncementMsg,
          timestamp: Date.now(),
          creatorName: currentUser.name || 'Admin'
      };
      const updated = [newAnn, ...announcements];
      await db.setItem('basis_system_announcements', updated);
      await audit.logAction(currentUser, 'ANNOUNCEMENT_CREATE', newAnn.id, undefined, newAnnouncementMsg);
      setAnnouncements(updated);
      setNewAnnouncementMsg('');
  };

  const executeDeleteAnnouncement = async () => {
      if (!announcementToDeleteId) return;
      const updated = announcements.filter(a => a.id !== announcementToDeleteId);
      await db.setItem('basis_system_announcements', updated);
      await audit.logAction(currentUser, 'ANNOUNCEMENT_DELETE', announcementToDeleteId, undefined, 'Deleted system alert');
      setAnnouncements(updated);
      setAnnouncementToDeleteId(null);
  };

  const handlePostAction = async (post: CommunityPost, action: 'approved' | 'rejected', reason?: string) => {
      const posts = await db.getItem<CommunityPost[]>('basis_community_posts') || [];
      const updated = posts.map(p => p.id === post.id ? { ...p, status: action, rejectionReason: reason } : p);
      await db.setItem('basis_community_posts', updated);
      await audit.logAction(currentUser, action === 'approved' ? 'APPROVE_POST' : 'REJECT_POST', undefined, undefined, `${post.title} (${post.authorName})`);
      refreshPendingPosts();
  };

  const handleAssessmentAction = async (event: AssessmentEvent, action: 'approved' | 'rejected') => {
      const events = await db.getItem<AssessmentEvent[]>('basis_assessment_events') || [];
      const updatedEvents = events.map(e => e.id === event.id ? { ...e, status: action === 'approved' ? 'approved' : 'rejected' } : e);
      if (action === 'rejected') {
          await db.setItem('basis_assessment_events', updatedEvents.filter(e => e.id !== event.id));
      } else {
          await db.setItem('basis_assessment_events', updatedEvents);
          const requestor: User = { id: event.creatorId, name: event.creatorName, role: 'student' }; 
          const logType = event.eventType === 'school' ? 'EDIT_EVENT_CALENDAR' : 'EDIT_ASSESSMENT_CALENDAR';
          await audit.logAction(requestor, logType, undefined, undefined, `${event.title} (Approved by ${currentUser.name})`);
      }
      refreshPendingAssessments();
  };

  const toggleFlag = async (key: keyof FeatureFlags) => {
      if (key === 'isSystemLockdown') {
          setIsLockdownModalOpen(true);
          return;
      }
      const newFlags = { ...featureFlags, [key]: !featureFlags[key] };
      setFeatureFlags(newFlags);
      await db.setItem('basis_feature_flags', newFlags);
      if (key === 'autoApprovePosts' || key === 'autoApproveRequests' || key === 'enableAIContentCheck' || key === 'enableBriefing' || key === 'enableTickets') {
          await audit.logAction(currentUser, 'FEATURE_TOGGLE', undefined, undefined, `${key} -> ${newFlags[key]}`);
      }
  };

  const handleExecuteLockdown = async () => {
      if (lockdownPassword !== currentUser.password) {
          alert("Incorrect password. Verification failed.");
          setIsLockdownModalOpen(false);
          setLockdownStep(1);
          setLockdownPassword('');
          return;
      }

      const isActivating = !featureFlags.isSystemLockdown;
      const newFlags = { ...featureFlags, isSystemLockdown: isActivating };
      setFeatureFlags(newFlags);
      await db.setItem('basis_feature_flags', newFlags);
      await audit.logAction(currentUser, isActivating ? 'SYSTEM_LOCKDOWN' : 'SYSTEM_RESTORE');
      
      setIsLockdownModalOpen(false);
      setLockdownStep(1);
      setLockdownPassword('');
      alert(isActivating ? "System shutdown complete. Access restricted to Admin only." : "System restored. Normal operations resumed.");
  };

  const handleExport = async () => {
      const data = await db.exportAll();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `basis_backup_${new Date().toISOString().split('T')[0]}.json`; a.click();
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const reader = new FileReader();
          reader.onload = async (ev) => {
              try {
                  const data = JSON.parse(ev.target?.result as string);
                  setPendingImportData(data);
                  setIsImportModalOpen(true);
                  if (fileInputRef.current) fileInputRef.current.value = '';
              } catch (err) { alert("Import Failed: Invalid JSON"); }
          };
          reader.readAsText(e.target.files[0]);
      }
  };

  const handleExecuteImport = async (selections: any) => {
      if (!pendingImportData) return;
      try {
          await db.importAll(pendingImportData);
          alert("Import Successful. Reloading...");
          window.location.reload();
      } catch (err) { alert("Import execution failed."); }
  };

  const handleSendWarnings = async (userIds: string[], message: string) => {
      const date = new Date().toISOString().split('T')[0];
      for (const uid of userIds) {
          const userKey = `basis_user_${uid}`;
          const latestUser = await db.getItem<User>(userKey);
          if (latestUser) {
              const newWarning: Warning = { id: Date.now().toString() + Math.random(), message, date, acknowledged: false };
              const updatedUser = { ...latestUser, warnings: [...(latestUser.warnings || []), newWarning] };
              await db.setItem(userKey, updatedUser);
          }
      }
      await audit.logAction(currentUser, 'SEND_WARNING', undefined, undefined, `Sent to ${userIds.length} users: ${message}`);
      alert(`${t.admin.warningsSent}: ${userIds.length}`);
      refreshUserList();
  };

  const handleTicketFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          const reader = new FileReader();
          reader.onload = (evt) => {
              setTicketReplyFile({
                  name: file.name,
                  type: file.type,
                  data: evt.target?.result as string
              });
          };
          reader.readAsDataURL(file);
      }
  };

  const handleTicketReply = async () => {
      if (!viewingTicket || (!ticketReplyText.trim() && !ticketReplyFile)) return;
      setTicketLoading(true);
      if (ticketReplyText.trim()) {
          const safety = await checkContentSafety(ticketReplyText);
          if (!safety.isSafe) { alert("Your reply was flagged by AI as inappropriate."); setTicketLoading(false); return; }
      }
      const all = await db.getItem<SupportTicket[]>('basis_support_tickets') || [];
      const updated = all.map(tk => {
          if (tk.id === viewingTicket.id) {
              return {
                  ...tk,
                  replies: [...tk.replies, {
                      authorName: currentUser.name || 'Admin',
                      text: ticketReplyText,
                      timestamp: Date.now(),
                      role: currentUser.role,
                      attachments: ticketReplyFile ? [ticketReplyFile] : []
                  }]
              };
          }
          return tk;
      });
      await db.setItem('basis_support_tickets', updated);
      await audit.logAction(currentUser, 'TICKET_REPLY', viewingTicket.id, undefined, `Reply to ${viewingTicket.userName}`);
      setTicketReplyText(''); setTicketReplyFile(null); setViewingTicket(updated.find(t => t.id === viewingTicket.id) || null); refreshTickets(); setTicketLoading(false);
  };

  const resolveTicket = async (id: string) => {
      const all = await db.getItem<SupportTicket[]>('basis_support_tickets') || [];
      const updated = all.map(tk => tk.id === id ? { ...tk, status: 'resolved' as const } : tk);
      await db.setItem('basis_support_tickets', updated);
      refreshTickets();
      if (viewingTicket?.id === id) setViewingTicket(null);
  };

  const deleteTicket = async () => {
      if (!ticketToDeleteId) return;
      const all = await db.getItem<SupportTicket[]>('basis_support_tickets') || [];
      const updated = all.filter(tk => tk.id !== ticketToDeleteId);
      await db.setItem('basis_support_tickets', updated);
      refreshTickets();
      if (viewingTicket?.id === ticketToDeleteId) setViewingTicket(null);
      setTicketToDeleteId(null);
  };

  const handleBulkDeleteTeachers = async () => {
      const newTeachers = teachers.filter(t => !selectedTeacherIds.includes(t.id));
      await db.setItem('basis_teachers', newTeachers);
      await audit.logAction(currentUser, 'EDIT_TEACHER_DATABASE', undefined, undefined, `Bulk deleted ${selectedTeacherIds.length} teachers`);
      setSelectedTeacherIds([]);
      window.location.reload();
  };

  const confirmBulkDeleteTeachers = () => {
      setBulkActionModal({ isOpen: true, title: "Bulk Delete Teachers", message: `Are you sure you want to delete ${selectedTeacherIds.length} teachers from the database?`, onConfirm: handleBulkDeleteTeachers, type: 'danger' });
  };

  const handleBulkDeleteSubjects = async () => {
      if(!window.confirm(`Delete ${selectedSubjects.length} subjects?`)) return;
      const newSubjects = subjects.filter(s => !selectedSubjects.includes(s));
      await db.setItem('basis_subjects', newSubjects);
      await audit.logAction(currentUser, 'EDIT_SUBJECT_DATABASE', undefined, undefined, `Bulk deleted ${selectedSubjects.length} subjects`);
      setSelectedSubjects([]);
      window.location.reload();
  };

  const handleBulkDeleteStaff = async () => {
      await Promise.all(selectedUserIds.map(uid => handleFullDeleteUser(uid, false)));
      await audit.logAction(currentUser, 'DELETE_USER', 'BULK', undefined, `Bulk deleted ${selectedUserIds.length} accounts`);
      setSelectedUserIds([]);
      refreshUserList();
  };

  const confirmBulkDeleteStaff = () => {
      setBulkActionModal({ isOpen: true, title: "Bulk Delete Staff Accounts", message: `WARNING: You are about to delete ${selectedUserIds.length} accounts. This will wipe all data for these users. Are you sure?`, onConfirm: handleBulkDeleteStaff, type: 'danger' });
  };

  const handleDeleteAllRecords = async () => { await audit.clearAllRecords(); refreshRecords(); };
  const handleSaveRecord = async (record: SystemRecord) => { const current = await audit.getRecords(); if (editRecordData) { await audit.saveRecords(current.map(r => r.id === record.id ? record : r)); } else { await audit.saveRecords([record, ...current]); } refreshRecords(); };
  const handleDeleteRecord = async () => { if (deleteRecordData) { const current = await audit.getRecords(); await audit.saveRecords(current.filter(r => r.id !== deleteRecordData.id)); setDeleteRecordData(null); refreshRecords(); } };

  const handleSubjectRename = async (oldName: string, newName: string) => {
      const newSubjects = subjects.map(s => s === oldName ? newName : s);
      await db.setItem('basis_subjects', newSubjects);
      const allSchedules = await db.scan<ScheduleMap>('basis_schedule_');
      for (const { key, value: schedule } of allSchedules) {
          let updated = false;
          const newSchedule = { ...schedule };
          Object.keys(newSchedule).forEach(k => {
              if (newSchedule[k].subject === oldName) {
                  newSchedule[k].subject = newName;
                  newSchedule[k].tasks = newSchedule[k].tasks.map(t => t.subject === oldName ? { ...t, subject: newName } : t);
                  updated = true;
              }
          });
          if (updated) await db.setItem(key, newSchedule);
      }
      const events = await db.getItem<AssessmentEvent[]>('basis_assessment_events') || [];
      let eventsChanged = false;
      const updatedEvents = events.map(e => {
          if (e.subject === oldName) { eventsChanged = true; return { ...e, subject: newName }; }
          return e;
      });
      if (eventsChanged) await db.setItem('basis_assessment_events', updatedEvents);
      const allGrades = await db.scan<GradeCourse[]>('basis_grades_');
      for (const { key, value: grades } of allGrades) {
          const hasOldSubject = grades.some(g => g.name === oldName);
          if (hasOldSubject) {
              const newGrades = grades.map(g => { if (g.name === oldName) return { ...g, name: newName }; return g; });
              await db.setItem(key, newGrades);
          }
      }
      await audit.logAction(currentUser, 'EDIT_SUBJECT_DATABASE', undefined, undefined, `Renamed Subject: ${oldName} -> ${newName} (Propagated)`);
      window.location.reload();
  };

  const handleFullDeleteUser = async (userId: string, refresh = true) => {
      await db.removeItem(`basis_user_${userId}`);
      await db.removeItem(`basis_schedule_${userId}`);
      await db.removeItem(`basis_grades_${userId}`);
      await db.removeItem(`basis_broadcast_history_${userId}`);
      if (refresh) { await audit.logAction(currentUser, 'DELETE_USER', userId, undefined, 'Full Account Wipe'); refreshUserList(); }
  };

  const toggleSelectUser = (id: string) => setSelectedUserIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const selectAll = () => { if (selectedUserIds.length === filteredUsers.length) setSelectedUserIds([]); else setSelectedUserIds(filteredUsers.map(u => u.user.id)); };

  const checkIsStaff = (u: User) => {
      return u.role === 'teacher' || teachers.some(t => t.id === u.id || t.email.toLowerCase() === u.id.toLowerCase()) || u.id.includes('@basischina.com');
  };

  const filteredUsers = userList.filter(({ user }) => {
      const isStaff = checkIsStaff(user);
      if (userTypeFilter === 'student' && isStaff) return false;
      if (userTypeFilter === 'staff' && !isStaff) return false;
      return user.name?.toLowerCase().includes(userSearch.toLowerCase()) || user.id.includes(userSearch);
  });

  const filteredTeachers = teachers.filter(t => t.name.toLowerCase().includes(teacherSearch.toLowerCase()) || t.subject.toLowerCase().includes(teacherSearch.toLowerCase()));
  const filteredSubjects = subjects.filter(s => s.toLowerCase().includes(subjectSearch.toLowerCase()));
  
  const canManageRecords = isSuperAdminMode || currentUser.id === SUPER_ADMIN_ID_2;
  const canDeleteAccounts = currentUser.role === 'admin';

  const determineNaturalRole = (uid: string): UserRole => {
      if (uid.includes('@basischina.com')) return 'teacher';
      return 'student'; 
  };

  const isStaffAdmin = checkIsStaff(currentUser);

  const handleManageSuperAdminPrivilege = async () => {
      const isGrant = superAdminActionType === 'grant';
      for (const uid of selectedUserIds) {
          if (uid === ADMIN_ID || uid === SUPER_ADMIN_ID_2) continue; 
          
          const userKey = `basis_user_${uid}`;
          const targetUserEnrolled = userList.find(u => u.user.id === uid);
          if (targetUserEnrolled) {
              const updatedUser = { ...targetUserEnrolled.user, hasSuperAdminPrivilege: isGrant };
              await db.setItem(userKey, updatedUser);
          }
      }
      await audit.logAction(currentUser, 'CHANGE_ROLE', 'BULK', undefined, `${isGrant ? 'Granted' : 'Revoked'} Super Admin privileges for ${selectedUserIds.length} users`);
      setIsManageSuperAdminOpen(false);
      setSelectedUserIds([]);
      refreshUserList();
  };

  const handleShieldClick = () => {
      if ((currentUser.id === ADMIN_ID || currentUser.hasSuperAdminPrivilege) && isSuperAdminMode && selectedUserIds.length > 0) {
          const selectedUsersList = userList.filter(u => selectedUserIds.includes(u.user.id));
          const allHavePrivilege = selectedUsersList.every(u => u.user.hasSuperAdminPrivilege);
          setSuperAdminActionType(allHavePrivilege ? 'revoke' : 'grant');
          setIsManageSuperAdminOpen(true);
      } else {
          if (currentUser.id === ADMIN_ID || currentUser.hasSuperAdminPrivilege) {
              setIsSuperAdminMode(prev => !prev);
          }
      }
  };

  const StudentScheduleModal = () => {
    if (!viewScheduleUser || !viewScheduleData) return null;
    return (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl overflow-hidden animate-in zoom-in-95 h-[90vh] flex flex-col text-slate-900">
                <div className="bg-slate-900 text-white p-4 flex justify-between items-center">
                    <h3 className="font-bold text-lg flex items-center gap-2"><Calendar size={20}/> Schedule: {viewScheduleUser.name} ({viewScheduleUser.id})</h3>
                    <button onClick={() => setViewScheduleUser(null)} className="hover:bg-slate-700 p-2 rounded"><X size={20} /></button>
                </div>
                <div className="flex-1 overflow-auto p-6 bg-slate-50">
                    <ScheduleGrid schedule={viewScheduleData} readOnly={true} />
                </div>
            </div>
        </div>
    );
  };

  const HeaderLanguageSelector = () => (
    <div className="relative group">
        <button className="text-slate-400 hover:text-white p-2 rounded transition-colors" title="Switch Language">
            <Globe size={20}/>
        </button>
        <div className="absolute right-0 top-full pt-2 hidden group-hover:block min-w-[140px] z-50">
            <div className="bg-white border border-slate-200 rounded-lg shadow-xl py-1 animate-in fade-in zoom-in-95 text-slate-800">
                {LANGUAGES.map(l => (
                    <button key={l.code} onClick={() => setLanguage(l.code as any)} className={`block w-full text-left px-4 py-2 text-sm hover:bg-slate-50 ${language === l.code ? 'font-bold text-brand-600 bg-brand-50' : 'text-slate-700'}`}>
                        {l.label}
                    </button>
                ))}
            </div>
        </div>
    </div>
  );

  const renderManagementTab = () => (
      <div className="space-y-8 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-soft">
                <div className="flex items-center gap-4 mb-6">
                    <div className="bg-red-50 dark:bg-red-900/30 p-3 rounded-2xl">
                        <Bell className="text-red-600 dark:text-red-400" size={28}/>
                    </div>
                    <div>
                        <h3 className="font-black text-slate-800 dark:text-white text-2xl tracking-tight">{t.admin.announcements.title}</h3>
                        <p className="text-sm text-slate-400 font-medium">Broadcast critical alerts to all active platform users</p>
                    </div>
                </div>
                
                <div className="flex flex-col gap-6">
                    <div className="flex flex-col sm:flex-row gap-3">
                        <input 
                            value={newAnnouncementMsg}
                            onChange={e => setNewAnnouncementMsg(e.target.value)}
                            placeholder={t.admin.announcements.placeholder}
                            className="flex-1 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl px-6 py-4 outline-none focus:ring-4 focus:ring-red-500/10 dark:focus:ring-red-500/20 dark:text-white font-medium transition-all"
                        />
                        <button 
                            onClick={handleCreateAnnouncement}
                            disabled={!newAnnouncementMsg.trim()}
                            className="bg-red-600 text-white px-10 py-4 rounded-2xl font-black hover:bg-red-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-red-600/20 active:scale-95"
                        >
                            <Send size={20}/> {t.admin.announcements.create.toUpperCase()}
                        </button>
                    </div>

                    <div className="space-y-4 pt-8 border-t border-slate-100 dark:border-slate-800">
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] mb-4 ml-1">{t.admin.announcements.history}</div>
                        {announcements.length === 0 ? (
                            <div className="text-center py-12 bg-slate-50/50 dark:bg-slate-800/20 rounded-[2rem] border border-dashed border-slate-200 dark:border-slate-800">
                                <p className="text-sm text-slate-400 font-bold italic">{t.admin.announcements.noActive}</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {announcements.map(ann => (
                                    <div key={ann.id} className="group flex items-center justify-between bg-white dark:bg-slate-800 border border-red-100 dark:border-red-900/30 p-5 rounded-[1.5rem] transition-all hover:shadow-xl hover:border-red-200 dark:hover:border-red-800/50 hover:-translate-y-0.5">
                                        <div className="flex-1 min-w-0 pr-4">
                                            <p className="text-sm text-slate-900 dark:text-red-100 font-black leading-snug line-clamp-2">{ann.message}</p>
                                            <div className="text-[9px] text-slate-400 dark:text-slate-500 mt-2 font-black uppercase tracking-widest flex items-center gap-2">
                                                <div className="w-1 h-1 bg-red-400 rounded-full"></div>
                                                {ann.creatorName} • {new Date(ann.timestamp).toLocaleString()}
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => setAnnouncementToDeleteId(ann.id)}
                                            className="p-3 text-slate-300 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-2xl transition-all active:scale-90"
                                            title="Remove Announcement"
                                        >
                                            <Trash2 size={20}/>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
          </div>

          {(currentUser.id === ADMIN_ID || currentUser.id === SUPER_ADMIN_ID_2) && (
              <div className="bg-slate-900 text-white p-8 rounded-[2rem] flex flex-col md:flex-row items-center justify-between gap-6 shadow-soft">
                  <div className="flex items-center gap-4">
                    <div className="bg-white/10 p-3 rounded-2xl">
                        <Database size={24} className="text-brand-400"/>
                    </div>
                    <div>
                        <h3 className="font-black text-xl mb-1">{t.admin.systemBackup}</h3>
                        <p className="text-slate-400 text-xs font-medium">Export or restore the entire database state</p>
                    </div>
                  </div>
                  <div className="flex gap-3 w-full md:w-auto">
                      <button onClick={handleExport} className="flex-1 md:flex-none px-6 py-3 bg-brand-600 rounded-2xl font-black text-sm hover:bg-brand-700 flex items-center justify-center gap-2 transition-all shadow-lg shadow-brand-600/20"><Download size={18}/> {t.admin.exportData}</button>
                      <div className="flex-1 md:flex-none relative"><input type="file" ref={fileInputRef} onChange={handleImport} accept=".json" className="hidden"/><button onClick={() => fileInputRef.current?.click()} className="w-full px-6 py-3 bg-slate-800 rounded-2xl font-black text-sm hover:bg-slate-700 flex items-center justify-center gap-2 border border-slate-700 transition-all"><Upload size={18}/> {t.admin.importData}</button></div>
                  </div>
              </div>
          )}

          <div className="bg-white dark:bg-slate-900 p-8 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-soft">
                <h3 className="font-black text-slate-800 dark:text-white text-xl mb-6 flex items-center gap-3"><Sliders size={22} className="text-brand-600"/> Feature Toggles</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {['autoApprovePosts', 'autoApproveRequests', 'enableAIContentCheck', 'enableBriefing', 'enableTickets'].map((key) => (
                        <div key={key} className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 transition-all hover:border-brand-200">
                            <span className="font-bold text-sm text-slate-600 dark:text-slate-300">
                                {key === 'enableAIContentCheck' ? 'AI Check Posts' : (t.admin.features[key.replace('enable', '').toLowerCase() as keyof typeof t.admin.features] || key)}
                            </span>
                            <button onClick={() => toggleFlag(key as keyof FeatureFlags)} className={`text-3xl transition-all ${featureFlags[key as keyof FeatureFlags] ? 'text-green-500 scale-110' : 'text-slate-300'}`}>
                                {featureFlags[key as keyof FeatureFlags] ? <ToggleRight size={32}/> : <ToggleLeft size={32}/>}
                            </button>
                        </div>
                    ))}
                    
                    {(currentUser.id === ADMIN_ID || currentUser.id === SUPER_ADMIN_ID_2) && (
                        ['enableCommunity', 'enableGPA', 'enableCalendar', 'enableAIImport', 'enableTeacherAI', 'enableAITutor'].map((key) => (
                            <div key={key} className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 transition-all hover:border-brand-200">
                                <span className="font-bold text-sm text-slate-600 dark:text-slate-300">
                                    {key === 'enableAIImport' ? 'AI Import Feature' : 
                                     key === 'enableTeacherAI' ? 'Teacher AI Hub' : 
                                     key === 'enableAITutor' ? 'Student AI Hub' :
                                     (t.admin.features[key.replace('enable', '').toLowerCase() as keyof typeof t.admin.features] || key)}
                                </span>
                                <button onClick={() => toggleFlag(key as keyof FeatureFlags)} className={`text-3xl transition-all ${featureFlags[key as keyof FeatureFlags] ? 'text-green-500 scale-110' : 'text-slate-300'}`}>
                                    {featureFlags[key as keyof FeatureFlags] ? <ToggleRight size={32}/> : <ToggleLeft size={32}/>}
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>

          {isSuperAdmin && (
              <div className={`bg-white dark:bg-slate-900 p-6 rounded-[1.5rem] border shadow-lg shadow-red-500/5 relative overflow-hidden group/lock transition-colors ${featureFlags.isSystemLockdown ? 'border-green-500' : 'border-red-500'}`}>
                    <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className={`p-2.5 rounded-xl shadow-md ${featureFlags.isSystemLockdown ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
                                {featureFlags.isSystemLockdown ? <Unlock size={24}/> : <Power size={24}/>}
                            </div>
                            <div>
                                <h3 className="font-black text-lg text-slate-800 dark:text-white tracking-tight leading-none mb-1">
                                    {featureFlags.isSystemLockdown ? "Restoration Protocol" : "Lockdown Protocol"}
                                </h3>
                                <p className="text-[11px] text-slate-500 font-medium max-w-xs">
                                    {featureFlags.isSystemLockdown 
                                        ? "Platform is locked. Restore access for all users." 
                                        : "Immediately restrict access to primary Administrators."}
                                </p>
                            </div>
                        </div>
                        <button 
                            onClick={() => toggleFlag('isSystemLockdown')}
                            className={`px-6 py-2.5 rounded-xl font-black text-xs transition-all flex items-center gap-2 shadow-md active:scale-95 ${featureFlags.isSystemLockdown ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-red-600 text-white hover:bg-red-700 shadow-red-600/30'}`}
                        >
                            {featureFlags.isSystemLockdown ? <><RefreshCw size={14}/> RESTORE SYSTEM</> : <><Power size={14}/> SHUTDOWN SYSTEM</>}
                        </button>
                    </div>
              </div>
          )}

          <SystemLogs 
              records={systemRecords}
              currentUser={currentUser}
              isSuperAdminMode={isSuperAdminMode}
              onAddRecord={() => setAddRecordOpen(true)}
              onEditRecord={(rec) => setEditRecordData(rec)}
              onDeleteRecord={(rec) => setDeleteRecordData(rec)}
              onDeleteAllRecords={() => setDeleteAllRecordsOpen(true)}
              canManage={canManageRecords}
          />
      </div>
  );

  const getPresenceColor = (user: User) => {
      if (user.isBanned) return 'text-red-500';
      if (!user.lastSeen) return 'text-slate-300';
      const isOnline = Date.now() - user.lastSeen < 5 * 60 * 1000; // 5 mins
      return isOnline ? 'text-green-500' : 'text-slate-400';
  };

  const getPresenceTitle = (user: User) => {
      if (user.isBanned) return 'Banned Account';
      if (!user.lastSeen) return 'Never seen';
      const isOnline = Date.now() - user.lastSeen < 5 * 60 * 1000;
      if (isOnline) return 'Online Now';
      return `Last seen: ${new Date(user.lastSeen).toLocaleString()}`;
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100 flex flex-col relative">
      {isDataLoading && (
          <div className="absolute inset-0 bg-white/50 dark:bg-slate-950/50 z-[200] flex items-center justify-center backdrop-blur-sm">
              <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-xl flex items-center gap-4 border border-slate-100 dark:border-slate-700 animate-in zoom-in-95">
                  <Loader2 className="animate-spin text-purple-600" size={32} />
                  <div className="flex flex-col">
                      <span className="font-black text-slate-800 dark:text-white text-lg tracking-tight">Accessing Database...</span>
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Initial retrieval in progress</span>
                  </div>
              </div>
          </div>
      )}

      <AddTeacherModal isOpen={isAddTeacherOpen} onClose={() => setIsAddTeacherOpen(false)} onSave={onAddTeacher} />
      <AddSubjectModal isOpen={isAddSubjectOpen} onClose={() => setIsAddSubjectOpen(false)} onSave={onAddSubject} />
      <SendWarningModal isOpen={isWarningOpen} onClose={() => setIsWarningOpen(false)} users={selectedUserIds.length > 0 ? userList.filter(u => selectedUserIds.includes(u.user.id)) : userList} onSend={handleSendWarnings} />
      <WarningHistoryModal isOpen={!!viewHistoryUser} onClose={() => setViewHistoryUser(null)} user={viewHistoryUser} />
      <EditUserModal isOpen={!!editingUser} onClose={() => setEditingUser(null)} user={editingUser} onSave={async (name) => { if(editingUser) { const updated = { ...editingUser, name }; await db.setItem(`basis_user_${editingUser.id}`, updated); await audit.logAction(currentUser, 'UPDATE_USER_NAME', editingUser.id, name); refreshUserList(); } }} />
      <RejectPostModal isOpen={!!rejectingPost} onClose={() => setRejectingPost(null)} onConfirm={(r) => rejectingPost && handlePostAction(rejectingPost, 'rejected', r)} />
      <ChangeRoleModal isOpen={!!roleChangeData} onClose={() => setRoleChangeData(null)} user={roleChangeData?.user || null} role={roleChangeData?.role || 'student'} onConfirm={async () => { if(roleChangeData) { const updated = { ...roleChangeData.user, role: roleChangeData.role }; await db.setItem(roleChangeData.key, updated); await audit.logAction(currentUser, 'CHANGE_ROLE', updated.id, undefined, roleChangeData.role); refreshUserList(); } }} />
      <BanUserModal isOpen={!!banUserData} onClose={() => setBanUserData(null)} user={banUserData?.user || null} onConfirm={async () => { if(banUserData) { const updated = { ...banUserData.user, isBanned: !banUserData.user.isBanned }; await db.setItem(banUserData.key, updated); await audit.logAction(currentUser, 'BAN_USER', updated.id, undefined, 'Account Ban'); refreshUserList(); } }} />
      <ConfirmDeleteModal isOpen={deleteModal.isOpen} onClose={() => setDeleteModal({ ...deleteModal, isOpen: false })} title={deleteModal.title} message={deleteModal.message} onConfirm={deleteModal.onConfirm} />
      <ConfirmGenericModal isOpen={bulkActionModal.isOpen} onClose={() => setBulkActionModal({ ...bulkActionModal, isOpen: false })} title={bulkActionModal.title} message={bulkActionModal.message} onConfirm={bulkActionModal.onConfirm} type={bulkActionModal.type} />
      <EditTeacherModal isOpen={!!editTeacherData} onClose={() => setEditTeacherData(null)} teacher={editTeacherData} onSave={async (t) => { const newTeachers = teachers.map(x => x.id === t.id ? t : x); await db.setItem('basis_teachers', newTeachers); await audit.logAction(currentUser, 'EDIT_TEACHER_DATABASE', t.id, t.name, 'Update Teacher'); window.location.reload(); }} />
      <EditSubjectModal isOpen={!!editSubjectData} onClose={() => setEditSubjectData(null)} originalSubject={editSubjectData || ''} onSave={handleSubjectRename} />
      <ManageSuperAdminModal isOpen={isManageSuperAdminOpen} onClose={() => setIsManageSuperAdminOpen(false)} count={selectedUserIds.length} onConfirm={handleManageSuperAdminPrivilege} actionType={superAdminActionType} />
      
      <ImportSelectionModal 
        isOpen={isImportModalOpen} 
        onClose={() => { setIsImportModalOpen(false); setPendingImportData(null); }} 
        onConfirm={handleExecuteImport} 
      />

      <ConfirmDeleteModal 
        isOpen={!!announcementToDeleteId} 
        onClose={() => setAnnouncementToDeleteId(null)} 
        title="Delete Announcement" 
        message="Are you sure you want to remove this global alert? It will disappear for all users immediately." 
        onConfirm={executeDeleteAnnouncement} 
      />

      {isLockdownModalOpen && (
          <div className="fixed inset-0 bg-black/80 z-[300] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
              <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden flex flex-col animate-in zoom-in-95 relative text-slate-900 dark:text-white">
                  <button 
                      onClick={() => { setIsLockdownModalOpen(false); setLockdownStep(1); setLockdownPassword(''); }}
                      className="absolute top-6 right-6 text-white hover:bg-white/20 p-2 rounded-full transition-all z-20"
                  >
                      <X size={24} />
                  </button>
                  
                  <div className={`${featureFlags.isSystemLockdown ? 'bg-green-600' : 'bg-red-600'} text-white p-8 flex flex-col items-center text-center`}>
                      <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mb-6">
                          {featureFlags.isSystemLockdown ? <Unlock size={40} /> : <Power size={40} />}
                      </div>
                      <h3 className="text-2xl font-black tracking-tight mb-2 uppercase">
                          {featureFlags.isSystemLockdown ? "Unlock Platform" : "Lockdown Protocol"}
                      </h3>
                      <p className="text-white/80 text-sm font-medium opacity-80">Security Level: 1 - Super Admin Only</p>
                  </div>
                  
                  <div className="p-8">
                      {lockdownStep === 1 && (
                          <div className="space-y-6 animate-in slide-in-from-right-4 text-center">
                              <p className="text-slate-600 dark:text-slate-300 font-bold leading-relaxed">
                                  {featureFlags.isSystemLockdown 
                                      ? "Restore access for all users? Students and Teachers will be able to log back in immediately." 
                                      : "WARNING: You are about to shut down the entire platform. All active sessions for Students, Teachers, and Secondary Admins will be blocked immediately."}
                              </p>
                              <button 
                                onClick={() => setLockdownStep(2)} 
                                className={`w-full py-4 rounded-2xl font-black text-white transition-all shadow-xl uppercase tracking-widest ${featureFlags.isSystemLockdown ? 'bg-green-600 hover:bg-green-700 shadow-green-500/20' : 'bg-red-600 hover:bg-red-700 shadow-red-500/20'}`}
                              >
                                  {featureFlags.isSystemLockdown ? "Proceed to Unlock" : "Acknowledge Danger"}
                              </button>
                          </div>
                      )}

                      {lockdownStep === 2 && (
                          <div className="space-y-6 animate-in slide-in-from-right-4">
                              <div className="bg-slate-100 dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-start gap-4">
                                  <div className="p-2 bg-white dark:bg-slate-700 rounded-xl shadow-sm">
                                      {featureFlags.isSystemLockdown ? <CheckCircle2 size={20} className="text-green-600"/> : <ShieldAlert size={20} className="text-red-600"/>}
                                  </div>
                                  <p className="text-xs text-slate-500 dark:text-slate-400 font-bold leading-snug">
                                      {featureFlags.isSystemLockdown 
                                          ? "All features (Community, GPA, To-Do) will be unlocked for the general user base. System records will log this restoration."
                                          : "Only Admin will retain dashboard access. The sync server will remain active but local access is denied for others."}
                                  </p>
                              </div>
                              <button 
                                onClick={() => setLockdownStep(3)} 
                                className={`w-full py-4 rounded-2xl font-black text-white transition-all shadow-xl uppercase tracking-widest ${featureFlags.isSystemLockdown ? 'bg-green-600 hover:bg-green-700 shadow-green-500/20' : 'bg-red-600 hover:bg-red-700 shadow-red-500/20'}`}
                              >
                                  {featureFlags.isSystemLockdown ? "Confirm Restoration" : "Confirm Access Exclusion"}
                              </button>
                          </div>
                      )}

                      {lockdownStep === 3 && (
                          <div className="space-y-6 animate-in slide-in-from-right-4">
                              <div>
                                  <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-2 ml-1">Final Authorization Required</label>
                                  <div className="relative">
                                      <input 
                                          type="password" 
                                          value={lockdownPassword}
                                          onChange={e => setLockdownPassword(e.target.value)}
                                          placeholder="Enter Admin Password"
                                          className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-5 py-4 outline-none focus:ring-4 focus:ring-red-500/10 dark:text-white font-medium"
                                      />
                                      <div className="absolute right-5 top-4.5 opacity-20"><Lock size={20}/></div>
                                  </div>
                              </div>
                              <div className="flex gap-3">
                                  <button onClick={() => { setIsLockdownModalOpen(false); setLockdownStep(1); setLockdownPassword(''); }} className="flex-1 bg-slate-100 dark:bg-slate-800 text-slate-500 py-4 rounded-2xl font-black hover:bg-slate-200 transition-all">ABORT</button>
                                  <button 
                                      onClick={handleExecuteLockdown}
                                      disabled={!lockdownPassword}
                                      className={`flex-[2] py-4 rounded-2xl font-black text-white transition-all shadow-xl uppercase tracking-widest disabled:opacity-50 ${featureFlags.isSystemLockdown ? 'bg-green-600 hover:bg-green-700 shadow-green-500/20' : 'bg-red-600 hover:bg-red-700 shadow-red-500/20'}`}
                                  >
                                      {featureFlags.isSystemLockdown ? "Authorize Unlock" : "Authorize Lockdown"}
                                  </button>
                              </div>
                          </div>
                      )}
                  </div>
              </div>
          </div>
      )}

      {viewScheduleUser && <StudentScheduleModal />}

      {canManageRecords && (
          <>
            <AddRecordModal isOpen={addRecordOpen} onClose={() => setAddRecordOpen(false)} onSave={handleSaveRecord} currentUser={currentUser} isIllegalMode={isSuperAdminMode} />
            <EditRecordModal isOpen={!!editRecordData} onClose={() => setEditRecordData(null)} record={editRecordData} onSave={handleSaveRecord} />
            <ConfirmDeleteRecordModal isOpen={!!deleteRecordData} onClose={() => setDeleteRecordData(null)} onConfirm={handleDeleteRecord} />
            <ConfirmDeleteAllRecordsModal isOpen={deleteAllRecordsOpen} onClose={() => setDeleteAllRecordsOpen(false)} onConfirm={handleDeleteAllRecords} />
          </>
      )}

      {/* Ticket Delete Modal - Higher Z-Index to avoid being behind Ticket detail view */}
      <div className="z-[250] relative">
          <ConfirmDeleteModal 
            isOpen={!!ticketToDeleteId} 
            onClose={() => setTicketToDeleteId(null)} 
            title="Delete Ticket" 
            message="Are you sure you want to permanently delete this support ticket?" 
            onConfirm={deleteTicket} 
          />
      </div>

      {viewingTicket && (
          <div className="fixed inset-0 bg-black/80 z-[120] flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col h-[80vh] animate-in zoom-in-95 text-slate-900">
                  <div className="bg-slate-900 text-white p-6 flex justify-between items-center shrink-0">
                      <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 ${viewingTicket.userRole === 'teacher' ? 'bg-emerald-600' : 'bg-brand-600'} rounded-xl flex items-center justify-center`}><Ticket size={20}/></div>
                          <div>
                              <h3 className="font-bold text-lg">{viewingTicket.title}</h3>
                              <div className="text-[10px] text-slate-400 uppercase font-black tracking-widest">{viewingTicket.userName} ({viewingTicket.userId})</div>
                          </div>
                      </div>
                      <button onClick={() => setViewingTicket(null)} className="p-2 hover:bg-slate-800 rounded-lg"><X size={20}/></button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50 dark:bg-slate-950/30">
                      <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700">
                          <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap">{viewingTicket.message}</p>
                          {viewingTicket.attachments && viewingTicket.attachments.length > 0 && (
                              <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700 space-y-2">
                                  {viewingTicket.attachments.map((att, i) => (
                                      <div key={i}>
                                          {att.type.startsWith('image/') ? (
                                              <img src={att.data} alt="att" className="max-h-60 rounded border dark:border-slate-700" />
                                          ) : (
                                              <a href={att.data} download={att.name} className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-700 rounded text-xs font-bold text-slate-600 dark:text-slate-300">
                                                  <FileText size={14}/> {att.name}
                                              </a>
                                          )}
                                      </div>
                                  ))}
                              </div>
                          )}
                          <div className="text-[10px] font-black text-slate-400 uppercase mt-2">{new Date(viewingTicket.timestamp).toLocaleString()}</div>
                      </div>
                      {viewingTicket.replies.map((r, i) => (
                          <div key={i} className={`flex flex-col ${r.role === 'admin' || r.role === 'secondary_admin' ? 'items-end ml-auto' : 'items-start'} max-w-[85%]`}>
                              <div className={`p-4 rounded-xl shadow-sm ${r.role === 'admin' || r.role === 'secondary_admin' ? (viewingTicket.userRole === 'teacher' ? 'bg-emerald-600' : 'bg-brand-600') + ' text-white' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'}`}>
                                  <p className="text-sm whitespace-pre-wrap">{r.text}</p>
                                  {r.attachments && r.attachments.length > 0 && (
                                      <div className="mt-4 pt-3 border-t border-white/10 space-y-2">
                                          {r.attachments.map((att, aIdx) => (
                                              <div key={aIdx}>
                                                  {att.type.startsWith('image/') ? (
                                                      <img src={att.data} alt="att" className="max-h-60 rounded border border-white/20" />
                                                  ) : (
                                                      <a href={att.data} download={att.name} className="flex items-center gap-2 p-2 bg-black/20 rounded text-xs font-bold text-white">
                                                          <FileText size={14}/> {att.name}
                                                      </a>
                                                  )}
                                              </div>
                                          ))}
                                      </div>
                                  )}
                                  <div className={`text-[9px] font-black uppercase mt-1 ${r.role === 'admin' || r.role === 'secondary_admin' ? 'text-white/70' : 'text-slate-400'}`}>{r.authorName} • {new Date(r.timestamp).toLocaleString()}</div>
                              </div>
                          </div>
                      ))}
                  </div>
                  <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-3">
                      <div className="space-y-2">
                        {ticketReplyFile && (
                            <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800 p-2 rounded text-xs border border-slate-100 dark:border-slate-700">
                                <span className="flex items-center gap-2"><Paperclip size={14}/> {ticketReplyFile.name}</span>
                                <button onClick={() => setTicketReplyFile(null)} className="text-red-500"><X size={14}/></button>
                            </div>
                        )}
                        <div className="flex gap-2">
                            <input type="file" ref={ticketReplyFileInputRef} className="hidden" onChange={handleTicketFileSelect} />
                            <button onClick={() => ticketReplyFileInputRef.current?.click()} className="p-2 border dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-500 hover:text-brand-600">
                                <Paperclip size={20}/>
                            </button>
                            <input value={ticketReplyText} onChange={e => setTicketReplyText(e.target.value)} placeholder="Type a reply..." className="flex-1 border dark:border-slate-700 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-brand-500/20 dark:bg-slate-800 dark:text-white" onKeyDown={e => e.key === 'Enter' && handleTicketReply()}/>
                            <button onClick={handleTicketReply} disabled={ticketLoading || (!ticketReplyText.trim() && !ticketReplyFile)} className={`${viewingTicket.userRole === 'teacher' ? 'bg-emerald-600' : 'bg-brand-600'} text-white p-3 rounded-xl disabled:opacity-50`}><Send size={18}/></button>
                        </div>
                      </div>
                      <div className="flex justify-end gap-2">
                          {viewingTicket.status === 'open' && (
                              <button onClick={() => resolveTicket(viewingTicket.id)} className="px-4 py-1.5 bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-lg text-xs font-bold hover:bg-green-100 dark:hover:bg-green-900/50 flex items-center gap-1 border border-green-100 dark:border-green-800"><CheckCircle2 size={14}/> Resolve</button>
                          )}
                          <button onClick={() => setTicketToDeleteId(viewingTicket.id)} className="px-4 py-1.5 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg text-xs font-bold hover:bg-red-100 dark:hover:bg-green-900/50 flex items-center gap-1 border border-red-100 dark:border-red-800"><Trash2 size={14}/> Delete</button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      <nav className={`bg-slate-900 text-white px-4 md:px-6 py-4 flex justify-between items-center shadow-md sticky top-0 z-50 ${isSuperAdminMode ? 'border-b-4 border-red-600' : ''}`}>
          <div className="flex items-center gap-3">
              <button 
                onClick={handleShieldClick} 
                className={`p-2 rounded-lg transition-colors ${isSuperAdminMode ? 'bg-red-600 text-white animate-pulse' : 'bg-purple-600'}`}
                title={isSuperAdminMode ? "Disable Super Admin Mode" : "Enable Super Admin Mode"}
                disabled={currentUser.id !== ADMIN_ID && !currentUser.hasSuperAdminPrivilege}
              >
                  {isSuperAdminMode ? <ShieldAlert size={20}/> : <Shield size={20} />}
              </button>
              <div><h1 className="text-lg md:text-xl font-bold tracking-tight">{t.admin.dashboard}</h1><div className="text-xs text-slate-400 font-medium hidden md:block">{currentUser.id === ADMIN_ID || currentUser.id === SUPER_ADMIN_ID_2 ? t.admin.superAdmin : t.admin.secAdmin}</div></div>
          </div>
          <div className="flex items-center gap-2 md:gap-3">
              <HeaderLanguageSelector />
              <button onClick={onSwitchView} className="bg-slate-800 hover:bg-slate-700 px-3 md:px-4 py-2 rounded-lg text-sm font-bold border border-slate-700 flex items-center gap-2 transition-colors">
                  <Briefcase size={16}/> <span className="hidden md:inline">{isStaffAdmin ? t.admin.backToTeacher : t.common.back}</span>
              </button>
              <button onClick={onLogout} className="bg-red-600 hover:bg-red-700 px-3 md:px-4 py-2 rounded-lg text-sm font-bold transition-colors flex items-center gap-2"><LogOut size={16}/> <span className="hidden md:inline">{t.nav.logout}</span></button>
          </div>
      </nav>

      <div className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-6 lg:p-10 flex flex-col gap-6">
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {[
                  { id: 'users', label: t.admin.tabs.users, icon: <LayoutDashboard size={18} /> },
                  { id: 'moderation', label: t.admin.tabs.moderation, icon: <Inbox size={18} /> },
                  { id: 'tickets', label: t.admin.tabs.tickets, icon: <LifeBuoy size={18} /> },
                  { id: 'database', label: t.admin.tabs.database, icon: <Database size={18} /> },
                  { id: 'management', label: t.admin.tabs.management, icon: <Settings size={18} /> },
              ].map((tab: any) => (
                  <button key={tab.id} onClick={() => { setActiveTab(tab.id); setSelectedUserIds([]); }} className={`px-5 py-3 rounded-xl font-bold flex-shrink-0 flex items-center gap-2 transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-slate-900 text-white shadow-lg' : 'bg-white text-slate-500 hover:bg-slate-100'}`}>{tab.icon} {tab.label}</button>
              ))}
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-4 md:p-6 flex-1">
              {activeTab === 'users' && (
                  <div className="space-y-4">
                      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700 gap-3">
                          <div className="flex bg-white dark:bg-slate-900 rounded-lg p-1 border border-slate-200 dark:border-slate-700 shadow-sm w-full md:w-auto">
                              <button onClick={() => { setUserTypeFilter('student'); setSelectedUserIds([]); }} className={`flex-1 md:flex-none px-4 py-1.5 rounded-md text-sm font-bold transition-colors ${userTypeFilter === 'student' ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}>{t.admin.filters.students}</button>
                              <button onClick={() => { setUserTypeFilter('staff'); setSelectedUserIds([]); }} className={`flex-1 md:flex-none px-4 py-1.5 rounded-md text-sm font-bold transition-colors ${userTypeFilter === 'staff' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}>{t.admin.filters.staff}</button>
                          </div>
                          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2 w-full md:w-auto">
                              {userTypeFilter === 'student' && <button onClick={() => setIsWarningOpen(true)} className="bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-800 px-4 py-2 rounded-lg text-sm font-bold hover:bg-orange-100 dark:hover:bg-orange-900/40 flex items-center justify-center gap-2"><AlertTriangle size={16}/> {t.modals.sendWarning}</button>}
                              {userTypeFilter === 'staff' && selectedUserIds.length > 0 && <button onClick={confirmBulkDeleteStaff} className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 px-4 py-2 rounded-lg text-sm font-bold hover:bg-red-100 dark:hover:bg-orange-900/40 flex items-center justify-center gap-2"><Trash2 size={16}/> Delete ({selectedUserIds.length})</button>}
                              <div className="relative w-full md:w-auto"><input type="text" placeholder={t.common.search} value={userSearch} onChange={e => setUserSearch(e.target.value)} className="pl-9 pr-4 py-2 border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-lg text-sm w-full md:w-64 outline-none focus:border-brand-500"/><Search className="absolute left-3 top-2.5 text-slate-400" size={16} /></div>
                          </div>
                      </div>
                      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                          <table className="w-full text-left text-sm min-w-[800px]">
                              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 font-bold uppercase text-xs"><tr><th className="p-4"><input type="checkbox" onChange={selectAll} checked={selectedUserIds.length === filteredUsers.length && filteredUsers.length > 0} /></th><th className="p-4 w-10">Presence</th><th className="p-4">{t.common.name}</th><th className="p-4">ID / {t.common.email}</th><th className="p-4">{t.common.role}</th><th className="p-4 text-right">{t.common.action}</th></tr></thead>
                              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                  {filteredUsers.map(({ user, key }) => {
                                      const isStaffRow = checkIsStaff(user);
                                      const isProtected = user.id === ADMIN_ID || user.id === SUPER_ADMIN_ID_2;

                                      return (
                                          <tr key={user.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors ${user.isBanned ? 'bg-red-50 dark:bg-red-900/10 hover:bg-red-100' : ''}`}>
                                              <td className="p-4"><input type="checkbox" checked={selectedUserIds.includes(user.id)} onChange={() => toggleSelectUser(user.id)} /></td>
                                              <td className="p-4 text-center">
                                                  <div title={getPresenceTitle(user)} className="cursor-help inline-flex items-center justify-center">
                                                      <Circle size={14} className={`fill-current ${getPresenceColor(user)} shadow-sm`} />
                                                  </div>
                                              </td>
                                              <td className="p-4 font-bold flex items-center gap-2 text-slate-800 dark:text-slate-200">
                                                  {user.name || '-'}
                                                  {isSuperAdminMode && user.hasSuperAdminPrivilege && <span className="text-[10px] bg-red-600 text-white px-1.5 rounded font-bold" title="Has Super Admin Privileges">!</span>}
                                                  <button onClick={() => setEditingUser(user)} className="text-slate-300 hover:text-brand-600 dark:text-slate-600"><Edit2 size={12} /></button>
                                              </td>
                                              <td className="p-4 font-mono text-slate-600 dark:text-slate-400">
                                                  <div>{user.id}</div>
                                                  {user.email && user.email !== user.id && <div className="text-[10px] text-brand-600 dark:text-brand-400">{user.email}</div>}
                                              </td>
                                              <td className="p-4">
                                                  <div className="flex items-center gap-2">
                                                      <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${user.role === 'admin' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' : user.role === 'secondary_admin' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : user.role === 'teacher' ? 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'}`}>{user.role}</span>
                                                      {(currentUser.id === ADMIN_ID || currentUser.id === SUPER_ADMIN_ID_2) && user.id !== ADMIN_ID && user.id !== SUPER_ADMIN_ID_2 && (
                                                          <div className="flex gap-1">
                                                              {user.role === 'admin' || user.role === 'secondary_admin' ? (
                                                                  <button onClick={() => setRoleChangeData({ user, key, role: determineNaturalRole(user.id) })} className="p-1 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded text-[10px] text-slate-600 dark:text-slate-300 font-bold" title={`Demote to ${determineNaturalRole(user.id)}`}>User</button>
                                                              ) : (
                                                                  <>
                                                                    <button onClick={() => setRoleChangeData({ user, key, role: 'secondary_admin' })} className="p-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 rounded text-[10px] font-bold" title="Make Sec Admin">SA</button>
                                                                    <button onClick={() => setRoleChangeData({ user, key, role: 'admin' })} className="p-1 bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 hover:bg-purple-100 rounded text-[10px] font-bold" title="Make Admin">A</button>
                                                                  </>
                                                              )}
                                                          </div>
                                                      )}
                                                  </div>
                                                  {user.role === 'teacher' && user.isApproved === false && <span className="text-[10px] bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded ml-2 font-bold">{t.admin.pendingApprovals}</span>}
                                              </td>
                                              <td className="p-4 flex justify-end gap-2">
                                                  {!isStaffRow && <button onClick={() => setViewHistoryUser(user)} className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-slate-500 hover:text-orange-600 hover:border-orange-200 dark:hover:border-orange-900/50" title={t.modals.warningHistory}><AlertTriangle size={16} /></button>}
                                                  {user.role === 'teacher' && user.isApproved === false && <button onClick={async () => { await db.setItem(key, { ...user, isApproved: true }); refreshUserList(); }} className="p-2 bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded border border-green-200 dark:border-green-800 font-bold text-xs">{t.admin.approve}</button>}
                                                  
                                                  <button 
                                                      disabled={isProtected}
                                                      onClick={() => setBanUserData({ user, key })} 
                                                      className={`p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded ${isProtected ? 'opacity-20 cursor-not-allowed' : (user.isBanned ? 'text-green-600 border-green-200 dark:text-green-400 dark:border-green-800' : 'text-red-600 border-red-200 dark:text-red-400 dark:border-red-800')}`} 
                                                      title={isProtected ? "System Protected" : (user.isBanned ? t.modals.unbanUser : t.modals.banUser)}
                                                  >
                                                      {user.isBanned ? <CheckCircle2 size={16} /> : <Ban size={16} />}
                                                  </button>
                                                  
                                                  {isSuperAdminMode && (
                                                      <button onClick={() => onImpersonate(user.id)} className="p-2 bg-purple-50 dark:bg-purple-900/30 border border-purple-100 dark:border-purple-800 rounded text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/50" title={`Log As ${user.name}`}><LogIn size={16}/></button>
                                                  )}
                                                  
                                                  {canDeleteAccounts && !isProtected && (
                                                      <button onClick={() => setDeleteModal({ isOpen: true, title: t.modals.deleteUser, message: t.modals.areYouSure + " This will wipe ALL user data.", onConfirm: () => handleFullDeleteUser(user.id) })} className="p-2 bg-red-50 dark:bg-red-900/30 border border-red-100 dark:border-red-800 rounded text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50"><Trash2 size={16} /></button>
                                                  )}
                                                  
                                                  {(user.role === 'student') && (
                                                      <button onClick={() => setViewScheduleUser(user)} className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-slate-500 hover:text-brand-600 hover:border-brand-200 dark:hover:border-brand-900/50" title={t.admin.studentView}><Eye size={16}/></button>
                                                  )}
                                              </td>
                                          </tr>
                                      );
                                  })}
                              </tbody>
                          </table>
                      </div>
                  </div>
              )}

              {activeTab === 'moderation' && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                      <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-4">
                          <h3 className="font-bold text-lg text-slate-700 dark:text-slate-200 flex items-center gap-2">
                              <MessageSquare size={20}/> {t.community.postPendingTitle} ({pendingPosts.length})
                          </h3>
                          {pendingPosts.length === 0 ? <div className="text-center py-10 text-slate-400 dark:text-slate-500">{t.community.noPosts}</div> : (
                              <div className="space-y-3">
                                  {pendingPosts.map(post => (
                                      <div key={post.id} className="bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
                                          <div className="flex justify-between items-start mb-2">
                                              <div>
                                                  <h4 className="font-bold text-slate-800 dark:text-teal-200">{post.title}</h4>
                                                  <div className="text-xs text-slate-500 dark:text-slate-400">{post.authorName} • {new Date(post.timestamp).toLocaleDateString()}</div>
                                              </div>
                                              <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded uppercase font-bold text-slate-600 dark:text-slate-400">{post.category}</span>
                                          </div>
                                          <p className="text-sm text-slate-600 dark:text-slate-400 mb-3 line-clamp-2">{post.description}</p>
                                          <div className="flex gap-2 justify-end">
                                              <button onClick={() => setRejectingPost(post)} className="text-xs font-bold text-red-600 bg-red-50 dark:bg-red-900/30 px-3 py-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/50 border border-red-100 dark:border-red-800">{t.common.rejected}</button>
                                              <button onClick={() => handlePostAction(post, 'approved')} className="text-xs font-bold text-green-600 bg-green-50 dark:bg-green-900/30 px-3 py-1.5 rounded hover:bg-green-100 dark:hover:bg-green-900/50 border border-green-100 dark:border-green-800">{t.common.approved}</button>
                                          </div>
                                      </div>
                                  ))}
                              </div>
                          )}
                      </div>

                      <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                          <h3 className="font-bold text-lg text-slate-700 dark:text-slate-200 mb-4 flex items-center gap-2">
                              <Calendar size={20}/> {t.calendar.pendingRequests} ({pendingAssessments.length})
                          </h3>
                          {pendingAssessments.length === 0 ? <div className="text-center py-10 text-slate-400 dark:text-slate-500">{t.community.noPosts}</div> : (
                              <div className="space-y-3">
                                  {pendingAssessments.map(evt => (
                                      <div key={evt.id} className="bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
                                          <div className="flex justify-between items-start mb-2">
                                              <div>
                                                  <h4 className="font-bold text-slate-800 dark:text-slate-200">{evt.title}</h4>
                                                  <div className="text-xs text-slate-500 dark:text-slate-400">{evt.creatorName} • {evt.date}</div>
                                              </div>
                                              <span className="text-[10px] bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-2 py-1 rounded uppercase font-bold border border-purple-100 dark:border-purple-800">{evt.eventType === 'school' ? 'Event' : 'Assessment'}</span>
                                          </div>
                                          <div className="text-xs text-slate-600 dark:text-slate-400 mb-3">
                                              <span className="font-bold">{t.common.subject}:</span> {evt.subject} <span className="mx-1">|</span> 
                                              <span className="font-bold">{t.common.grade}:</span> {evt.gradeLevels?.join(', ')}
                                          </div>
                                          <div className="flex gap-2 justify-end">
                                              <button onClick={() => handleAssessmentAction(evt, 'rejected')} className="text-xs font-bold text-red-600 bg-red-50 dark:bg-red-900/30 px-3 py-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/50 border border-red-100 dark:border-red-800">{t.common.rejected}</button>
                                              <button onClick={() => handleAssessmentAction(evt, 'approved')} className="text-xs font-bold text-green-600 bg-green-50 dark:bg-green-900/30 px-3 py-1.5 rounded hover:bg-green-100 dark:hover:bg-green-900/50 border border-green-100 dark:border-green-800">{t.common.approved}</button>
                                          </div>
                                      </div>
                                  ))}
                              </div>
                          )}
                      </div>
                  </div>
              )}

              {activeTab === 'tickets' && (
                  <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                      <h3 className="font-bold text-lg text-slate-700 dark:text-slate-200 mb-4 flex items-center gap-2">
                          <LifeBuoy size={20} className="text-brand-600 dark:text-brand-400"/> Support Tickets ({supportTickets.filter(t => t.status === 'open').length} Open)
                      </h3>
                      {supportTickets.length === 0 ? <div className="text-center py-10 text-slate-400 dark:text-slate-500">No support tickets found.</div> : (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              {supportTickets.map(tk => {
                                  const isTeacherTicket = tk.userRole === 'teacher';
                                  return (
                                    <div key={tk.id} onClick={() => setViewingTicket(tk)} className={`bg-white dark:bg-slate-900 p-4 rounded-lg border shadow-sm transition-all cursor-pointer group ${isTeacherTicket ? 'border-emerald-200 dark:border-emerald-800 hover:border-emerald-400' : 'border-slate-200 dark:border-slate-700 hover:border-brand-300'}`}>
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex items-center gap-3">
                                                <h4 className="font-bold text-slate-800 dark:text-white truncate max-w-[120px]">{tk.title}</h4>
                                                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${tk.status === 'open' ? 'bg-orange-50 text-orange-600 border border-orange-100' : 'bg-green-50 text-green-600 border border-green-100'}`}>
                                                    {tk.status}
                                                </span>
                                            </div>
                                            {isTeacherTicket && (
                                                <span className="flex items-center gap-1 text-[8px] font-black uppercase bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded border border-emerald-100">
                                                    <Briefcase size={8}/> Teacher
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 mb-2">{tk.message}</p>
                                        <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                                            <div className="flex items-center gap-2">
                                                <span>{tk.replies.length} REPLIES</span>
                                                {(tk.attachments?.length || 0) > 0 && <Paperclip size={14} />}
                                            </div>
                                            <span>{new Date(tk.timestamp).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                  );
                              })}
                          </div>
                      )}
                  </div>
              )}

              {activeTab === 'database' && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col h-[600px]">
                          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col gap-3">
                              <div className="flex justify-between items-center">
                                  <h3 className="font-bold text-slate-700 dark:text-slate-200">{t.common.teacher} ({teachers.length})</h3>
                                  <button onClick={() => setIsAddTeacherOpen(true)} className="bg-brand-600 text-white px-3 py-1.5 rounded text-xs font-bold hover:bg-brand-700 flex items-center gap-1"><Plus size={14}/> Add</button>
                              </div>
                              <div className="flex gap-2">
                                  <div className="relative flex-1">
                                      <input type="text" placeholder={t.common.search} value={teacherSearch} onChange={e => setTeacherSearch(e.target.value)} className="w-full pl-8 pr-2 py-1.5 border dark:border-slate-700 dark:bg-slate-800 rounded text-xs dark:text-white"/>
                                      <Search size={12} className="absolute left-2.5 top-2 text-slate-400"/>
                                  </div>
                                  {selectedTeacherIds.length > 0 && (
                                      <>
                                          <button onClick={confirmBulkDeleteTeachers} className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-3 py-1.5 rounded text-xs font-bold hover:bg-red-100 dark:hover:bg-red-900/50 whitespace-nowrap border border-red-100 dark:border-red-800">Delete ({selectedTeacherIds.length})</button>
                                      </>
                                  )}
                              </div>
                          </div>
                          <div className="flex-1 overflow-y-auto">
                              <table className="w-full text-left text-xs">
                                  <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0 text-slate-500 dark:text-slate-400 font-bold"><tr><th className="p-3"><input type="checkbox" onChange={() => setSelectedTeacherIds(selectedTeacherIds.length === filteredTeachers.length ? [] : filteredTeachers.map(t => t.id))} checked={selectedTeacherIds.length === filteredTeachers.length && filteredTeachers.length > 0}/></th><th className="p-3">{t.common.name}</th><th className="p-3">{t.common.subject}</th><th className="p-3 text-right">{t.common.action}</th></tr></thead>
                                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                      {filteredTeachers.map(tea => {
                                          return (
                                              <tr key={tea.id} className="hover:bg-slate-50 dark:hover:bg-slate-800 group">
                                                  <td className="p-3"><input type="checkbox" checked={selectedTeacherIds.includes(tea.id)} onChange={() => setSelectedTeacherIds(prev => prev.includes(tea.id) ? prev.filter(x => x !== tea.id) : [...prev, tea.id])}/></td>
                                                  <td className="p-3">
                                                      <div className="font-bold text-slate-700 dark:text-slate-200">{tea.name}</div>
                                                      <div className="text-slate-400">{tea.email}</div>
                                                  </td>
                                                  <td className="p-3 dark:text-slate-300">{tea.subject}</td>
                                                  <td className="p-3 text-right flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                      <button onClick={() => setEditTeacherData(tea)} className="p-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded hover:bg-blue-100 dark:hover:bg-blue-900/50 border border-blue-100 dark:border-blue-800"><Edit2 size={14}/></button>
                                                      <button onClick={() => onDeleteTeacher(tea.id)} className="p-1.5 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded hover:bg-red-100 dark:hover:bg-red-900/50 border border-red-100 dark:border-red-800"><Trash2 size={14}/></button>
                                                  </td>
                                              </tr>
                                          );
                                      })}
                                  </tbody>
                              </table>
                          </div>
                      </div>

                      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col h-[600px]">
                          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col gap-3">
                              <div className="flex justify-between items-center">
                                  <h3 className="font-bold text-slate-700 dark:text-slate-200">{t.common.subject} ({subjects.length})</h3>
                                  <button onClick={() => setIsAddSubjectOpen(true)} className="bg-brand-600 text-white px-3 py-1.5 rounded text-xs font-bold hover:bg-brand-700 flex items-center gap-1"><Plus size={14}/> Add</button>
                              </div>
                              <div className="flex gap-2">
                                  <div className="relative flex-1">
                                      <input type="text" placeholder={t.common.search} value={subjectSearch} onChange={e => setSubjectSearch(e.target.value)} className="w-full pl-8 pr-2 py-1.5 border dark:border-slate-700 dark:bg-slate-800 rounded text-xs dark:text-white"/>
                                      <Search size={12} className="absolute left-2.5 top-2 text-slate-400"/>
                                  </div>
                                  {selectedSubjects.length > 0 && (
                                      <button onClick={handleBulkDeleteSubjects} className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-3 py-1.5 rounded text-xs font-bold hover:bg-red-100 dark:hover:bg-red-900/50 whitespace-nowrap border border-red-100 dark:border-red-800">Delete ({selectedSubjects.length})</button>
                                  )}
                              </div>
                          </div>
                          <div className="flex-1 overflow-y-auto">
                              <table className="w-full text-left text-xs">
                                  <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0 text-slate-500 dark:text-slate-400 font-bold"><tr><th className="p-3"><input type="checkbox" onChange={() => setSelectedSubjects(selectedSubjects.length === filteredSubjects.length ? [] : filteredSubjects)} checked={selectedSubjects.length === filteredSubjects.length && filteredSubjects.length > 0}/></th><th className="p-3">{t.common.name}</th><th className="p-3 text-right">{t.common.action}</th></tr></thead>
                                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                      {filteredSubjects.map(sub => (
                                          <tr key={sub} className="hover:bg-slate-50 dark:hover:bg-slate-800 group">
                                              <td className="p-3"><input type="checkbox" checked={selectedSubjects.includes(sub)} onChange={() => setSelectedSubjects(prev => prev.includes(sub) ? prev.filter(x => x !== sub) : [...prev, sub])}/></td>
                                              <td className="p-3 font-bold text-slate-700 dark:text-slate-200">{sub}</td>
                                              <td className="p-3 text-right flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                  <button onClick={() => setEditSubjectData(sub)} className="p-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded hover:bg-blue-100 dark:hover:bg-blue-900/50 border border-blue-100 dark:border-blue-800"><Edit2 size={14}/></button>
                                                  <button onClick={() => onDeleteSubject(sub)} className="p-1.5 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded hover:bg-red-100 dark:hover:bg-red-900/50 border border-red-100 dark:border-red-800"><Trash2 size={14}/></button>
                                              </td>
                                          </tr>
                                      ))}
                                  </tbody>
                              </table>
                          </div>
                      </div>
                  </div>
              )}

              {activeTab === 'management' && renderManagementTab()}
          </div>
      </div>
    </div>
  );
};

export default AdminDashboard;

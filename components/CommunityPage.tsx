
import React, { useState, useEffect, useRef } from 'react';
import { CommunityPost, User, CommunityCategory, Comment, FeatureFlags, Teacher } from '../types';
import { GRADE_LEVELS, DEFAULT_FLAGS } from '../constants';
import { db } from '../services/db';
import { audit } from '../services/audit';
import { checkContentSafety } from '../services/geminiService';
import { MessageSquare, ThumbsUp, Plus, Calendar, Trash2, Eye, Megaphone, CalendarDays, Search, Filter, History, ChevronDown, ChevronUp, ShieldCheck, User as UserIcon, ArrowLeft, Paperclip, Download, CornerDownRight, BookOpen, Send, Lock, Pin, PinOff, AlertOctagon, Loader2, X, FileText } from 'lucide-react';
import { ConfirmDeleteModal, PostPendingModal, ConfirmDeleteCommentModal, ConfirmPostModal, AIModerationModal } from './AdminModals';
import MyCenter from './MyCenter';
import { useLanguage } from '../LanguageContext';

interface CommunityPageProps { currentUser: User; subjects: string[]; teachers?: Teacher[]; }

const PROFANITY_LIST = ['abuse', 'hate', 'stupid', 'idiot', 'kill', 'attack', 'hell', 'damn'];

const CommunityPage: React.FC<CommunityPageProps> = ({ currentUser, subjects, teachers = [] }) => {
  const { t } = useLanguage();
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [gradeFilter, setGradeFilter] = useState<string>('');
  const [expandedArchives, setExpandedArchives] = useState<{ [key: string]: boolean }>({ 'Club/ASA': false, 'Others': false, 'Announcement': false });
  const [showMyCenter, setShowMyCenter] = useState(false);
  const [featureFlags, setFeatureFlags] = useState<FeatureFlags>(DEFAULT_FLAGS);
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<CommunityCategory>('Club/ASA'); 
  const [desc, setDesc] = useState('');
  const [date, setDate] = useState('');
  const [selectedGrades, setSelectedGrades] = useState<string[]>([]);
  const [attachedFile, setAttachedFile] = useState<{name: string, type: string, data: string} | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isPosting, setIsPosting] = useState(false);

  const [deleteModal, setDeleteModal] = useState<{isOpen: boolean, postId: string}>({isOpen: false, postId: ''});
  const [deleteCommentModal, setDeleteCommentModal] = useState<{isOpen: boolean, postId: string, commentId: string}>({isOpen: false, postId: '', commentId: ''});
  const [pendingModalOpen, setPendingModalOpen] = useState(false);
  
  const [commentText, setCommentText] = useState<{ [postId: string]: string }>({});
  const [aiError, setAiError] = useState<string | null>(null);

  useEffect(() => { 
      const load = async () => { 
          setIsInitialLoading(true);
          const saved = await db.getItem<CommunityPost[]>('basis_community_posts'); if (saved) setPosts(saved); 
          const flags = await db.getItem<FeatureFlags>('basis_feature_flags'); if (flags) setFeatureFlags(flags);
          setIsInitialLoading(false);
      }; 
      load(); 
  }, []);

  const savePosts = async (newPosts: CommunityPost[]) => { setPosts(newPosts); await db.setItem('basis_community_posts', newPosts); };
  
  const isAdmin = currentUser.role === 'admin' || currentUser.role === 'secondary_admin';
  const isTeacher = currentUser.role === 'teacher';
  const isRealTeacher = isTeacher || teachers.some(t => t.id === currentUser.id || t.email.toLowerCase() === currentUser.id.toLowerCase());

  const isAutoApproved = isAdmin || isRealTeacher || featureFlags.autoApprovePosts;

  const containsProfanity = (text: string) => {
      const lower = text.toLowerCase();
      return PROFANITY_LIST.some(word => lower.includes(word));
  };

  const handlePost = async () => {
      if (category !== 'Announcement' && selectedGrades.length === 0) return alert("Select at least one grade level.");
      
      if (containsProfanity(title) || containsProfanity(desc)) {
          setAiError("Contains prohibited keywords (Profanity Filter).");
          return;
      }

      setIsPosting(true);

      if (featureFlags.enableAIContentCheck) {
          const contentToCheck = `${title}\n${desc}`;
          try {
              const checkResult = await checkContentSafety(contentToCheck);
              if (!checkResult.isSafe) {
                  setAiError(checkResult.reason || "Content flagged as inappropriate by AI safety filters.");
                  setIsPosting(false);
                  return;
              }
          } catch (e) {
              console.error("AI Check failed, proceeding with caution.", e);
          }
      }

      const newPost: CommunityPost = { 
          id: Date.now().toString(), 
          authorId: currentUser.id, 
          authorName: currentUser.name || 'Unknown', 
          authorRole: currentUser.role, 
          title, 
          subject: 'General', 
          category, 
          description: desc, 
          gradeLevels: selectedGrades, 
          date, 
          timestamp: Date.now(), 
          likes: 0, 
          status: isAutoApproved ? 'approved' : 'pending',
          comments: [],
          attachments: attachedFile ? [attachedFile] : [],
          pinned: false
      };
      
      await savePosts([newPost, ...posts]);
      await audit.logAction(currentUser, 'CREATE_POST', undefined, undefined, `${title}`);
      
      setIsPosting(false);
      
      if (!isAutoApproved) setPendingModalOpen(true);
      setIsFormOpen(false); setTitle(''); setDesc(''); setDate(''); setSelectedGrades([]); setCategory('Club/ASA'); setAttachedFile(undefined);
  };

  const handlePin = async (id: string) => {
      const updated = posts.map(p => p.id === id ? { ...p, pinned: !p.pinned } : p);
      await savePosts(updated);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          const reader = new FileReader();
          reader.onload = (evt) => {
              const base64 = (evt.target?.result as string);
              setAttachedFile({ name: file.name, type: file.type, data: base64 });
          };
          reader.readAsDataURL(file);
      }
  };

  const addComment = async (postId: string) => {
      if (!commentText[postId]?.trim()) return;
      if (containsProfanity(commentText[postId])) {
          setAiError("Comment contains prohibited keywords.");
          return;
      }
      
      if (featureFlags.enableAIContentCheck) {
          const checkResult = await checkContentSafety(commentText[postId]);
          if (!checkResult.isSafe) {
              setAiError(checkResult.reason || "Comment flagged as inappropriate.");
              return;
          }
      }

      const newComment: Comment = {
          id: Date.now().toString() + Math.random(),
          authorId: currentUser.id,
          authorName: currentUser.name || 'Unknown',
          authorRole: currentUser.role,
          text: commentText[postId],
          timestamp: Date.now(),
          replies: []
      };
      const updatedPosts = posts.map(p => p.id === postId ? { ...p, comments: [...(p.comments || []), newComment] } : p);
      await savePosts(updatedPosts);
      setCommentText(prev => ({ ...prev, [postId]: '' }));
  };

  const deleteComment = async () => {
      const { postId, commentId } = deleteCommentModal;
      if (!postId || !commentId) return;
      
      const deleteRecursive = (comments: Comment[]): Comment[] => {
          return comments.filter(c => c.id !== commentId).map(c => ({
              ...c,
              replies: c.replies ? deleteRecursive(c.replies) : []
          }));
      };

      const updatedPosts = posts.map(p => p.id === postId ? { ...p, comments: deleteRecursive(p.comments || []) } : p);
      await savePosts(updatedPosts);
      await audit.logAction(currentUser, 'COMMUNITY_EDIT', undefined, undefined, `Deleted Comment in post ${postId}`);
      setDeleteCommentModal({isOpen: false, postId: '', commentId: ''});
  };

  const toggleGrade = (grade: string) => {
    setSelectedGrades(prev => 
      prev.includes(grade) 
        ? prev.filter(g => g !== grade) 
        : [...prev, grade]
    );
  };

  const filteredPosts = posts.filter(post => {
      if (post.status !== 'approved' && !isAdmin && post.authorId !== currentUser.id) return false;
      if (post.status !== 'approved' && !isAdmin && post.authorId === currentUser.id && showMyCenter) return true; 
      if (post.status !== 'approved') return false; 

      if (post.category !== 'Announcement' && gradeFilter && !post.gradeLevels.includes(gradeFilter)) return false;
      if (searchQuery) {
          const q = searchQuery.toLowerCase();
          return post.title.toLowerCase().includes(q) || (post.description && post.description.toLowerCase().includes(q)) || post.authorName.toLowerCase().includes(q);
      }
      return true;
  });

  const sortedPosts = [...filteredPosts].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return b.timestamp - a.timestamp;
  });

  const getCategoryColor = (cat: CommunityCategory) => {
      switch(cat) {
          case 'Announcement': return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-900/50';
          case 'Club/ASA': return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-900/50';
          case 'Resource Sharing': return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-900/50';
          default: return 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700';
      }
  };

  if (showMyCenter) {
      return (
          <div className="p-4 md:p-8">
              <button onClick={() => setShowMyCenter(false)} className="mb-4 flex items-center gap-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors font-bold"><ArrowLeft size={20}/> Back to Community</button>
              <MyCenter user={currentUser} />
          </div>
      );
  }

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8 relative">
        {isInitialLoading && (
            <div className="absolute inset-0 bg-white/50 dark:bg-slate-950/50 z-[100] flex items-center justify-center backdrop-blur-sm rounded-xl min-h-[400px]">
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-xl flex items-center gap-4 border border-slate-100 dark:border-slate-700 animate-in zoom-in-95">
                    <Loader2 className="animate-spin text-brand-600" size={32} />
                    <div className="flex flex-col">
                        <span className="font-black text-slate-800 dark:text-white text-lg tracking-tight">Syncing Community...</span>
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Checking for latest announcements</span>
                    </div>
                </div>
            </div>
        )}

        <ConfirmDeleteModal 
            isOpen={deleteModal.isOpen} 
            onClose={() => setDeleteModal({isOpen: false, postId: ''})} 
            title={t.modals.deletePost} 
            message={t.modals.areYouSure} 
            onConfirm={() => {
                const updated = posts.filter(p => p.id !== deleteModal.postId);
                savePosts(updated);
                audit.logAction(currentUser, 'COMMUNITY_EDIT', undefined, undefined, `Deleted Post`);
                setDeleteModal({isOpen: false, postId: ''});
            }} 
        />
        <ConfirmDeleteCommentModal 
            isOpen={deleteCommentModal.isOpen} 
            onClose={() => setDeleteCommentModal({isOpen: false, postId: '', commentId: ''})} 
            onConfirm={deleteComment} 
        />
        <PostPendingModal 
            isOpen={pendingModalOpen} 
            onClose={() => setPendingModalOpen(false)} 
        />
        <AIModerationModal 
            isOpen={!!aiError} 
            onClose={() => setAiError(null)} 
            reason={aiError || ''} 
        />

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
            <div>
                <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    <MessageSquare className="text-brand-600 dark:text-brand-400" /> {t.community.header}
                </h1>
                <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">{t.community.subtitle}</p>
            </div>
            <div className="flex gap-2 w-full md:w-auto">
                <button onClick={() => setShowMyCenter(true)} className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                    <UserIcon size={16}/> {t.myCenter.title}
                </button>
                <button onClick={() => setIsFormOpen(!isFormOpen)} className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-bold hover:bg-brand-700 transition-colors shadow-lg shadow-brand-500/30">
                    {isFormOpen ? <X size={16}/> : <Plus size={16}/>} {t.community.newPost}
                </button>
            </div>
        </div>

        {isFormOpen && (
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 p-6 mb-8 animate-in slide-in-from-top-4">
                <h3 className="font-bold text-lg mb-4 text-slate-800 dark:text-white">{t.community.createTitle}</h3>
                <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <input type="text" placeholder={t.common.title} value={title} onChange={e => setTitle(e.target.value)} className="border dark:border-slate-700 rounded-lg p-3 w-full bg-slate-50 dark:bg-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-brand-500"/>
                        <select value={category} onChange={e => setCategory(e.target.value as CommunityCategory)} className="border dark:border-slate-700 rounded-lg p-3 w-full bg-slate-50 dark:bg-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-brand-500">
                            <option value="Club/ASA">{t.community.club}</option>
                            <option value="Announcement">{t.community.announcements}</option>
                            <option value="Resource Sharing">Resource Sharing</option>
                            <option value="Others">{t.community.others}</option>
                        </select>
                    </div>
                    
                    <textarea placeholder={t.common.description} value={desc} onChange={e => setDesc(e.target.value)} className="border dark:border-slate-700 rounded-lg p-3 w-full h-32 resize-none bg-slate-50 dark:bg-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-brand-500"/>
                    
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1">
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">{t.community.relevantDate}</label>
                            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="border dark:border-slate-700 rounded-lg p-2 w-full bg-slate-50 dark:bg-slate-800 dark:text-white"/>
                        </div>
                        {category !== 'Announcement' && (
                            <div className="flex-[2]">
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">{t.common.grade}s</label>
                                <div className="flex flex-wrap gap-2">
                                    {GRADE_LEVELS.map(g => (
                                        <button key={g} onClick={() => toggleGrade(g)} className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${selectedGrades.includes(g) ? 'bg-brand-600 text-white border-brand-600' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'}`}>
                                            {g}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex justify-between items-center pt-2">
                        <div className="flex items-center gap-2">
                            <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileSelect} accept="image/*,application/pdf"/>
                            <button onClick={() => fileInputRef.current?.click()} className="text-slate-500 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 flex items-center gap-2 text-sm font-medium transition-colors">
                                <Paperclip size={18}/> {attachedFile ? attachedFile.name : t.common.optional}
                            </button>
                            {attachedFile && <button onClick={() => setAttachedFile(undefined)} className="text-red-500 hover:text-red-700"><Trash2 size={16}/></button>}
                        </div>
                        <button onClick={handlePost} disabled={!title || !desc || isPosting} className="bg-brand-600 text-white px-6 py-2.5 rounded-lg font-bold hover:bg-brand-700 transition-colors disabled:opacity-50 flex items-center gap-2">
                            {isPosting && <Loader2 className="animate-spin" size={16}/>} {t.community.createTitle}
                        </button>
                    </div>
                </div>
            </div>
        )}

        <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 text-slate-400" size={18}/>
                <input type="text" placeholder={t.community.search} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10 pr-4 py-2.5 w-full border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-500"/>
            </div>
            <div className="relative w-full sm:w-48">
                <Filter className="absolute left-3 top-2.5 text-slate-400" size={18}/>
                <select value={gradeFilter} onChange={e => setGradeFilter(e.target.value)} className="pl-10 pr-8 py-2.5 w-full border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-500 appearance-none">
                    <option value="">{t.community.allGrades}</option>
                    {GRADE_LEVELS.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-3 text-slate-400 pointer-events-none" size={14}/>
            </div>
        </div>

        <div className="space-y-6">
            {sortedPosts.length === 0 ? (
                <div className="text-center py-16 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                    <MessageSquare size={48} className="mx-auto text-slate-300 dark:text-slate-600 mb-4"/>
                    <p className="text-slate-500 dark:text-slate-400">{t.community.noPosts}</p>
                </div>
            ) : (
                sortedPosts.map(post => (
                    <div key={post.id} className={`bg-white dark:bg-slate-900 rounded-xl border shadow-sm transition-all ${post.pinned ? 'border-brand-200 dark:border-brand-900 ring-1 ring-brand-100 dark:ring-brand-900/50' : 'border-slate-200 dark:border-slate-700'}`}>
                        <div className="p-6">
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex gap-3">
                                    <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 font-bold text-lg">
                                        {post.authorName[0]}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-slate-800 dark:text-white">{post.authorName}</span>
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${getCategoryColor(post.category)}`}>{post.category}</span>
                                            {post.pinned && <Pin size={12} className="text-brand-600 fill-brand-600"/>}
                                        </div>
                                        <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5">
                                            <span>{new Date(post.timestamp).toLocaleDateString()}</span>
                                            {post.date && <span className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-1.5 rounded"><Calendar size={10}/> {post.date}</span>}
                                        </div>
                                    </div>
                                </div>
                                {(isAdmin || isRealTeacher || post.authorId === currentUser.id) && (
                                    <div className="flex gap-1">
                                        {(isAdmin || isRealTeacher) && (
                                            <button onClick={() => handlePin(post.id)} className={`p-2 rounded-lg transition-colors ${post.pinned ? 'text-brand-600 bg-brand-50 dark:bg-brand-900/20' : 'text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                                                {post.pinned ? <PinOff size={18}/> : <Pin size={18}/>}
                                            </button>
                                        )}
                                        <button onClick={() => setDeleteModal({isOpen: true, postId: post.id})} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                                            <Trash2 size={18}/>
                                        </button>
                                    </div>
                                )}
                            </div>

                            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{post.title}</h3>
                            <p className="text-slate-600 dark:text-slate-300 whitespace-pre-wrap mb-4 leading-relaxed">{post.description}</p>

                            {post.attachments && post.attachments.map((att, idx) => (
                                <div key={idx} className="mb-4">
                                    {att.type.startsWith('image/') ? (
                                        <img src={att.data.startsWith('data:') ? att.data : `data:${att.type};base64,${att.data}`} alt="Attachment" className="max-h-64 rounded-lg object-contain bg-slate-100 dark:bg-slate-800" />
                                    ) : (
                                        <a href={att.data.startsWith('data:') ? att.data : `data:${att.type};base64,${att.data}`} download={att.name} className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                                            <FileText size={18} className="text-brand-600"/> {att.name} <Download size={16} className="ml-auto text-slate-400"/>
                                        </a>
                                    )}
                                </div>
                            ))}

                            <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                                <div className="text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                                    Targets: {post.gradeLevels.join(', ') || 'All'}
                                </div>
                            </div>
                        </div>

                        <div className="bg-slate-50 dark:bg-slate-950/50 p-4 border-t border-slate-200 dark:border-slate-700 rounded-b-xl">
                            {post.comments && post.comments.length > 0 && (
                                <div className="space-y-4 mb-4">
                                    {post.comments.map(comment => (
                                        <div key={comment.id} className="group">
                                            <div className="flex gap-3">
                                                <div className="flex-1 bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700 relative">
                                                    <div className="flex justify-between items-start mb-1">
                                                        <span className="font-bold text-xs text-slate-800 dark:text-slate-200">{comment.authorName}</span>
                                                        <span className="text-[10px] text-slate-400">{new Date(comment.timestamp).toLocaleDateString()}</span>
                                                    </div>
                                                    <p className="text-sm text-slate-600 dark:text-slate-300">{comment.text}</p>
                                                    {(isAdmin || comment.authorId === currentUser.id) && (
                                                        <button onClick={() => setDeleteCommentModal({isOpen: true, postId: post.id, commentId: comment.id})} className="absolute top-2 right-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                                                            <Trash2 size={14}/>
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <div className="flex gap-2">
                                <input 
                                    type="text" 
                                    placeholder={t.community.writeComment} 
                                    value={commentText[post.id] || ''} 
                                    onChange={e => setCommentText({...commentText, [post.id]: e.target.value})}
                                    onKeyDown={e => e.key === 'Enter' && addComment(post.id)}
                                    className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500 dark:text-white"
                                />
                                <button onClick={() => addComment(post.id)} disabled={!commentText[post.id]} className="bg-brand-600 hover:bg-brand-700 text-white p-2 rounded-full disabled:opacity-50 transition-colors">
                                    <Send size={16}/>
                                </button>
                            </div>
                        </div>
                    </div>
                ))
            )}
        </div>
    </div>
  );
};

export default CommunityPage;


import React, { useState, useEffect, useRef } from 'react';
import { Mail, ShieldCheck, MessageSquare, ExternalLink, User as UserIcon, LifeBuoy, Plus, Loader2, Send, X, Ticket, CheckCircle2, Clock, AlertCircle, ChevronRight, Paperclip, FileText, Image as ImageIcon, Trash2, Search, ChevronDown, ChevronUp, Sparkles, Settings, Edit2 } from 'lucide-react';
import { useLanguage } from '../LanguageContext';
import { SupportTicket, User, Attachment, OfficialChannel, FeatureFlags } from '../types';
import { db } from '../services/db';
import { checkContentSafety } from '../services/geminiService';
import { audit } from '../services/audit';
import { ConfirmDeleteModal } from './AdminModals';
import { ADMIN_ID } from '../constants';

interface ContactUsProps {
    currentUser?: User;
    featureFlags?: FeatureFlags;
}

const DEFAULT_CHANNELS: OfficialChannel[] = [
    {
        id: 'default-teams',
        platform: 'Microsoft Teams',
        label: 'Chat with: Siyuan Liu (14548)',
        value: 'siyuan.liu14548-biph@basischina.com',
        type: 'text'
    },
    {
        id: 'default-email',
        platform: 'Email',
        label: 'Support Address',
        value: 'siyuan.liu14548-biph@basischina.com',
        type: 'email'
    }
];

const ContactUs: React.FC<ContactUsProps> = ({ currentUser, featureFlags }) => {
  const { t } = useLanguage();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [channels, setChannels] = useState<OfficialChannel[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [aiScanning, setAiScanning] = useState(false);
  const [error, setError] = useState('');
  const [viewingTicket, setViewingTicket] = useState<SupportTicket | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replyFile, setReplyFile] = useState<Attachment | null>(null);
  const [showResolved, setShowResolved] = useState(false);
  const [attachedFile, setAttachedFile] = useState<Attachment | null>(null);
  const [ticketToDelete, setTicketToDelete] = useState<string | null>(null);
  
  // Official Channel Management State
  const [isManageChannels, setIsManageChannels] = useState(false);
  const [editingChannel, setEditingChannel] = useState<OfficialChannel | null>(null);
  const [isAddingChannel, setIsAddingChannel] = useState(false);
  const [newChannel, setNewChannel] = useState<Partial<OfficialChannel>>({ platform: '', label: '', value: '', type: 'text' });
  const [channelToDelete, setChannelToDelete] = useState<OfficialChannel | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const replyFileInputRef = useRef<HTMLInputElement>(null);

  const isSuperAdmin = currentUser?.id === ADMIN_ID || currentUser?.hasSuperAdminPrivilege;
  const ticketsEnabled = featureFlags?.enableTickets ?? true;
  const isTeacher = currentUser?.role === 'teacher';

  useEffect(() => {
    if (currentUser) {
        loadTickets();
        loadChannels();
    }
  }, [currentUser]);

  const loadTickets = async () => {
      const all = await db.getItem<SupportTicket[]>('basis_support_tickets') || [];
      setTickets(all.filter(t => t.userId === currentUser?.id).sort((a,b) => b.timestamp - a.timestamp));
  };

  const loadChannels = async () => {
      const saved = await db.getItem<OfficialChannel[]>('basis_official_channels');
      if (saved && saved.length > 0) {
          setChannels(saved);
      } else {
          setChannels(DEFAULT_CHANNELS);
      }
  };

  const saveChannelsToDB = async (updatedChannels: OfficialChannel[]) => {
      setChannels(updatedChannels);
      await db.setItem('basis_official_channels', updatedChannels);
  };

  const handleAddChannel = async () => {
      if (!newChannel.platform || !newChannel.label || !newChannel.value) return;
      const channel: OfficialChannel = {
          id: `chan-${Date.now()}`,
          platform: newChannel.platform!,
          label: newChannel.label!,
          value: newChannel.value!,
          type: newChannel.type as any || 'text'
      };
      const updated = [...channels, channel];
      await saveChannelsToDB(updated);
      await audit.logAction(currentUser!, 'CHANNEL_EDIT', channel.id, undefined, `Added channel: ${channel.platform}`);
      setNewChannel({ platform: '', label: '', value: '', type: 'text' });
      setIsAddingChannel(false);
  };

  const executeDeleteChannel = async () => {
      if (!channelToDelete) return;
      const updated = channels.filter(c => c.id !== channelToDelete.id);
      await saveChannelsToDB(updated);
      await audit.logAction(currentUser!, 'CHANNEL_EDIT', channelToDelete.id, undefined, `Deleted channel: ${channelToDelete.platform}`);
      setChannelToDelete(null);
  };

  const handleUpdateChannel = async () => {
      if (!editingChannel) return;
      const updated = channels.map(c => c.id === editingChannel.id ? editingChannel : c);
      await saveChannelsToDB(updated);
      await audit.logAction(currentUser!, 'CHANNEL_EDIT', editingChannel.id, undefined, `Updated channel: ${editingChannel.platform}`);
      setEditingChannel(null);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, isReply: boolean = false) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (evt) => {
        const base64String = (evt.target?.result as string);
        const att: Attachment = {
          name: file.name,
          type: file.type,
          data: base64String
        };
        if (isReply) setReplyFile(att);
        else setAttachedFile(att);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCreateTicket = async () => {
      if (!title || !message || !currentUser || !ticketsEnabled) return;
      
      setAiScanning(true);
      setError('');

      try {
          await new Promise(r => setTimeout(r, 1500));
          const safety = await checkContentSafety(`${title}\n${message}`);
          if (!safety.isSafe) {
              setError(safety.reason || t.contact.aiModerated);
              setAiScanning(false);
              return;
          }

          const newTicket: SupportTicket = {
              id: `tk-${Date.now()}`,
              userId: currentUser.id,
              userRole: currentUser.role, // CRITICAL: Save the role for admin coloring
              userName: currentUser.name || (isTeacher ? 'Teacher' : 'Student'),
              title,
              message,
              status: 'open',
              timestamp: Date.now(),
              attachments: attachedFile ? [attachedFile] : [],
              replies: []
          };

          const all = await db.getItem<SupportTicket[]>('basis_support_tickets') || [];
          const updated = [newTicket, ...all];
          await db.setItem('basis_support_tickets', updated);
          await audit.logAction(currentUser, 'TICKET_CREATE', newTicket.id, undefined, title);

          setTitle('');
          setMessage('');
          setAttachedFile(null);
          setIsCreating(false);
          loadTickets();
          alert(t.contact.ticketSuccess);
      } catch (e) {
          setError("Failed to submit ticket.");
      } finally {
          setAiScanning(false);
      }
  };

  const handleDeleteTicket = async () => {
    if (!ticketToDelete || !currentUser) return;
    
    const all = await db.getItem<SupportTicket[]>('basis_support_tickets') || [];
    const updated = all.filter(tk => tk.id !== ticketToDelete);
    await db.setItem('basis_support_tickets', updated);
    await audit.logAction(currentUser, 'TICKET_DELETE', ticketToDelete, undefined, 'User Withdrawn');
    
    loadTickets();
    setTicketToDelete(null);
    setViewingTicket(null);
  };

  const handleReply = async () => {
    if ((!replyText.trim() && !replyFile) || !viewingTicket || !currentUser || !ticketsEnabled) return;
    setLoading(true);

    if (replyText.trim()) {
        const safety = await checkContentSafety(replyText);
        if (!safety.isSafe) {
            alert(t.contact.aiModerated);
            setLoading(false);
            return;
        }
    }

    const all = await db.getItem<SupportTicket[]>('basis_support_tickets') || [];
    const updated = all.map(tk => {
        if (tk.id === viewingTicket.id) {
            return {
                ...tk,
                replies: [...tk.replies, {
                    authorName: currentUser.name || 'User',
                    text: replyText,
                    timestamp: Date.now(),
                    role: currentUser.role,
                    attachments: replyFile ? [replyFile] : []
                }]
            };
        }
        return tk;
    });

    await db.setItem('basis_support_tickets', updated);
    setReplyText('');
    setReplyFile(null);
    setViewingTicket(updated.find(t => t.id === viewingTicket.id) || null);
    loadTickets();
    setLoading(false);
  };

  const activeTickets = tickets.filter(t => t.status === 'open');
  const resolvedTickets = tickets.filter(t => t.status === 'resolved');

  const themeBtnColor = isTeacher ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20' : 'bg-brand-600 hover:bg-brand-700 shadow-brand-500/20';
  const themeTextColor = isTeacher ? 'text-emerald-600 dark:text-emerald-400' : 'text-brand-600 dark:text-brand-400';
  const themeBgLight = isTeacher ? 'bg-emerald-50 dark:bg-emerald-900/30' : 'bg-brand-50 dark:bg-brand-900/30';
  const themeBorderColor = isTeacher ? 'border-emerald-200 dark:border-emerald-800' : 'border-brand-200 dark:border-brand-900';

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-10 space-y-12">
      <div className="z-[200] relative">
          <ConfirmDeleteModal 
            isOpen={!!ticketToDelete} 
            onClose={() => setTicketToDelete(null)} 
            title={t.modals.deleteTicket} 
            message={t.contact.withdrawConfirm} 
            onConfirm={handleDeleteTicket} 
          />
          <ConfirmDeleteModal 
            isOpen={!!channelToDelete} 
            onClose={() => setChannelToDelete(null)} 
            title="Delete Channel" 
            message={`Are you sure you want to remove the ${channelToDelete?.platform} support channel?`} 
            onConfirm={executeDeleteChannel} 
          />
      </div>

      <div className="text-center">
        <h1 className="text-3xl font-black text-slate-900 dark:text-white mb-3">{t.contact.title}</h1>
        <p className="text-slate-500 dark:text-slate-400">{t.contact.subtitle}</p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
            <div className="bg-white dark:bg-slate-900 p-8 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-soft flex flex-col gap-6 relative group">
                {isSuperAdmin && (
                    <button 
                        onClick={() => setIsManageChannels(!isManageChannels)}
                        className={`absolute top-6 right-6 p-2 text-slate-400 hover:${themeTextColor} hover:${themeBgLight} rounded-xl transition-all opacity-0 group-hover:opacity-100`}
                        title={t.contact.manageChannels}
                    >
                        <Settings size={18}/>
                    </button>
                )}
                <div className={`w-14 h-14 ${themeBgLight} rounded-2xl flex items-center justify-center ${themeTextColor} shadow-sm`}>
                    <ShieldCheck size={32} />
                </div>
                <div>
                    <h3 className="font-black text-slate-900 dark:text-white text-xl mb-4">{t.contact.officialChannels}</h3>
                    <div className="space-y-4">
                        {channels.map(channel => (
                            <div key={channel.id} className="flex items-start gap-3 relative group/chan">
                                <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-lg text-slate-400">
                                    {channel.type === 'email' ? <Mail size={18} /> : <MessageSquare size={18} />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider">{channel.platform}</span>
                                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-0.5">{channel.label}</p>
                                    {channel.type === 'email' ? (
                                        <a href={`mailto:${channel.value}`} className={`text-sm font-bold ${themeTextColor} hover:underline flex items-center gap-1 truncate`}>
                                            {channel.value} <ExternalLink size={12}/>
                                        </a>
                                    ) : channel.type === 'link' ? (
                                        <a href={channel.value} target="_blank" rel="noopener noreferrer" className={`text-sm font-bold ${themeTextColor} hover:underline flex items-center gap-1 truncate`}>
                                            {channel.value} <ExternalLink size={12}/>
                                        </a>
                                    ) : (
                                        <p className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{channel.value}</p>
                                    )}
                                </div>
                                {isManageChannels && (
                                    <div className="flex gap-1 ml-2">
                                        <button onClick={() => setEditingChannel(channel)} className="p-1.5 text-slate-400 hover:text-blue-500"><Edit2 size={14}/></button>
                                        <button onClick={() => setChannelToDelete(channel)} className="p-1.5 text-slate-400 hover:text-red-500"><Trash2 size={14}/></button>
                                    </div>
                                )}
                            </div>
                        ))}
                        
                        {isManageChannels && (
                            <button 
                                onClick={() => setIsAddingChannel(true)}
                                className={`w-full py-2 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-400 hover:${themeTextColor} hover:${themeBorderColor} transition-all flex items-center justify-center gap-2`}
                            >
                                <Plus size={14}/> {t.contact.addChannel}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>

        <div className="lg:col-span-2 space-y-6 relative">
            {!ticketsEnabled && (
                <div className="absolute inset-0 z-30 bg-slate-100/50 dark:bg-slate-900/50 backdrop-blur-[2px] rounded-[2rem] flex items-center justify-center border border-slate-200/50 dark:border-slate-700/50">
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 flex flex-col items-center gap-4 max-w-sm text-center">
                        <div className="w-12 h-12 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center text-slate-500">
                            <Settings size={24} />
                        </div>
                        <p className="text-sm font-bold text-slate-600 dark:text-slate-300">{t.contact.underMaintenance}</p>
                    </div>
                </div>
            )}
            
            <div className={`flex justify-between items-center transition-opacity ${!ticketsEnabled ? 'opacity-40 grayscale pointer-events-none' : ''}`}>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-3">
                    <LifeBuoy className={themeTextColor} /> {t.contact.supportTickets}
                </h2>
                <button 
                    onClick={() => ticketsEnabled && setIsCreating(true)}
                    className={`flex items-center gap-2 px-4 py-2 ${themeBtnColor} text-white rounded-xl text-sm font-bold transition-all shadow-lg`}
                >
                    <Plus size={16}/> {t.contact.newTicket}
                </button>
            </div>

            {isCreating && ticketsEnabled && (
                <div className={`bg-white dark:bg-slate-900 rounded-[2rem] border ${themeBorderColor} p-8 shadow-xl animate-in slide-in-from-top-4 relative overflow-hidden`}>
                    {aiScanning && (
                        <div className="absolute inset-0 bg-white/90 dark:bg-slate-900/90 z-20 flex flex-col items-center justify-center animate-in fade-in">
                            <div className="relative w-20 h-20 mb-4">
                                <div className="absolute inset-0 border-4 border-slate-100 rounded-full"></div>
                                <div className={`absolute inset-0 border-4 ${isTeacher ? 'border-emerald-600' : 'border-brand-600'} rounded-full border-t-transparent animate-spin`}></div>
                                <Sparkles className={`absolute inset-0 m-auto ${themeTextColor} animate-pulse`} size={32}/>
                            </div>
                            <p className="font-bold text-slate-800 dark:text-white animate-pulse">{t.contact.aiScanning}</p>
                        </div>
                    )}
                    <div className={`absolute top-0 left-0 w-full h-1.5 ${isTeacher ? 'bg-emerald-600' : 'bg-brand-600'}`}></div>
                    <button onClick={() => setIsCreating(false)} className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"><X size={20}/></button>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2"><Ticket size={20} className={themeTextColor}/> {t.contact.newTicket}</h3>
                    <div className="space-y-4">
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5 ml-1">{t.contact.ticketTitle}</label>
                            <input value={title} onChange={e => setTitle(e.target.value)} type="text" className={`w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 outline-none focus:ring-2 ${isTeacher ? 'focus:ring-emerald-500/20' : 'focus:ring-brand-500/20'} dark:text-white`} placeholder="Brief summary of the issue..."/>
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5 ml-1">{t.contact.ticketMsg}</label>
                            <textarea value={message} onChange={e => setMessage(e.target.value)} className={`w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 outline-none focus:ring-2 ${isTeacher ? 'focus:ring-emerald-500/20' : 'focus:ring-brand-500/20'} dark:text-white h-32 resize-none`} placeholder={t.contact.ticketPlaceholder}/>
                        </div>
                        
                        <div className="flex items-center gap-3">
                            <input type="file" ref={fileInputRef} className="hidden" onChange={(e) => handleFileSelect(e, false)} accept="image/*,application/pdf" />
                            <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                                <Paperclip size={18}/> {attachedFile ? attachedFile.name : t.common.optional}
                            </button>
                            {attachedFile && <button onClick={() => setAttachedFile(null)} className="text-red-500 hover:text-red-700"><Trash2 size={16}/></button>}
                        </div>

                        {error && <div className="text-red-500 text-xs font-bold bg-red-50 p-3 rounded-lg border border-red-100 flex items-center gap-2"><AlertCircle size={16}/> {error}</div>}
                        <button 
                            disabled={loading || aiScanning || !title || !message}
                            onClick={handleCreateTicket}
                            className={`w-full ${themeBtnColor} text-white font-black py-4 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-50`}
                        >
                            {(loading || aiScanning) ? <Loader2 className="animate-spin" size={20}/> : <Send size={20}/>}
                            {t.contact.submitTicket.toUpperCase()}
                        </button>
                    </div>
                </div>
            )}

            <div className={`space-y-4 transition-opacity duration-300 ${!ticketsEnabled ? 'opacity-40 grayscale pointer-events-none' : ''}`}>
                {activeTickets.length === 0 ? (
                    <div className="bg-slate-50 dark:bg-slate-900/50 border border-dashed border-slate-200 dark:border-slate-700 rounded-[2rem] py-16 text-center">
                        <Ticket size={48} className="mx-auto text-slate-300 dark:text-slate-700 mb-4 opacity-30"/>
                        <p className="text-slate-400 font-medium">You don't have any active support tickets.</p>
                    </div>
                ) : (
                    activeTickets.map(tk => (
                        <div key={tk.id} onClick={() => ticketsEnabled && setViewingTicket(tk)} className={`bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-soft hover:${isTeacher ? 'border-emerald-300' : 'border-brand-300'} dark:hover:${isTeacher ? 'border-emerald-700' : 'border-brand-700'} transition-all cursor-pointer group`}>
                            <div className="flex justify-between items-start mb-3">
                                <div>
                                    <div className="flex items-center gap-3 mb-1">
                                        <h4 className={`font-bold text-slate-900 dark:text-white group-hover:${themeTextColor} transition-colors`}>{tk.title}</h4>
                                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-orange-50 text-orange-600 border border-orange-100`}>
                                            {tk.status}
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">{tk.message}</p>
                                </div>
                                <div className="text-[10px] font-black text-slate-400 uppercase text-right">
                                    <Clock size={12} className="inline mr-1"/> {new Date(tk.timestamp).toLocaleDateString()}
                                </div>
                            </div>
                            <div className="flex justify-between items-center pt-3 border-t border-slate-50 dark:border-slate-800">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{tk.replies.length} REPLIES</span>
                                <div className="flex items-center gap-3">
                                    {(tk.attachments?.length || 0) > 0 && <Paperclip size={14} className="text-slate-400" />}
                                    <ChevronRight size={16} className={`text-slate-300 group-hover:${themeTextColor} transition-all group-hover:translate-x-1`}/>
                                </div>
                            </div>
                        </div>
                    ))
                )}

                {resolvedTickets.length > 0 && (
                    <div className="pt-6">
                        <button 
                            onClick={() => ticketsEnabled && setShowResolved(!showResolved)}
                            className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                        >
                            {showResolved ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                            {showResolved ? t.contact.hideResolved : t.contact.showResolved} ({resolvedTickets.length})
                        </button>
                        
                        {showResolved && ticketsEnabled && (
                            <div className="mt-4 space-y-4 animate-in slide-in-from-top-2">
                                {resolvedTickets.map(tk => (
                                    <div key={tk.id} onClick={() => ticketsEnabled && setViewingTicket(tk)} className="bg-slate-50/50 dark:bg-slate-900/50 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 transition-all cursor-pointer opacity-70 hover:opacity-100">
                                        <div className="flex justify-between items-start mb-3">
                                            <div>
                                                <div className="flex items-center gap-3 mb-1">
                                                    <h4 className="font-bold text-slate-700 dark:text-slate-300 line-through decoration-slate-400">{tk.title}</h4>
                                                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-green-50 text-green-600 border border-green-100">
                                                        {tk.status}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-slate-400 line-clamp-1">{tk.message}</p>
                                            </div>
                                            <div className="text-[10px] font-black text-slate-300 uppercase">
                                                {new Date(tk.timestamp).toLocaleDateString()}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
      </div>

      {viewingTicket && ticketsEnabled && (
          <div className="fixed inset-0 bg-black/60 z-[110] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
              <div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col h-[85vh]">
                  <div className="bg-slate-900 text-white p-6 flex justify-between items-center shrink-0">
                      <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 ${isTeacher ? 'bg-emerald-600' : 'bg-brand-600'} rounded-xl flex items-center justify-center`}><Ticket size={20}/></div>
                          <div>
                              <h3 className="font-bold text-lg leading-tight">{viewingTicket.title}</h3>
                              <div className="text-[10px] text-slate-400 uppercase font-black tracking-widest">TICKET ID: {viewingTicket.id}</div>
                          </div>
                      </div>
                      <div className="flex items-center gap-2">
                          <button onClick={() => setTicketToDelete(viewingTicket.id)} className="p-2 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors" title={t.contact.withdrawTicket}><Trash2 size={20}/></button>
                          <button onClick={() => setViewingTicket(null)} className="p-2 hover:bg-slate-800 rounded-lg transition-colors"><X size={20}/></button>
                      </div>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50 dark:bg-slate-950/50">
                      <div className="flex flex-col items-start max-w-[90%]">
                          <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl rounded-tl-none border border-slate-100 dark:border-slate-700 shadow-sm">
                              <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">{viewingTicket.message}</p>
                              
                              {viewingTicket.attachments && viewingTicket.attachments.length > 0 && (
                                  <div className="mt-4 space-y-2 border-t border-slate-50 dark:border-slate-700 pt-4">
                                      {viewingTicket.attachments.map((att, i) => (
                                          <div key={i}>
                                            {att.type.startsWith('image/') ? (
                                                <img src={att.data} alt="Attachment" className="max-h-60 rounded-lg border border-slate-100 dark:border-slate-700" />
                                            ) : (
                                                <a href={att.data} download={att.name} className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-700/50 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100">
                                                    <FileText size={14}/> {att.name}
                                                </a>
                                            )}
                                          </div>
                                      ))}
                                  </div>
                              )}
                              
                              <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-4 pt-3 border-t border-slate-50 dark:border-slate-700">
                                  {viewingTicket.userName} • {new Date(viewingTicket.timestamp).toLocaleString()}
                              </div>
                          </div>
                      </div>

                      {viewingTicket.replies.map((reply, i) => (
                          <div key={i} className={`flex flex-col ${reply.role === 'admin' || reply.role === 'secondary_admin' ? 'items-end ml-auto' : 'items-start'} max-w-[90%]`}>
                              <div className={`p-5 rounded-2xl border shadow-sm ${reply.role === 'admin' || reply.role === 'secondary_admin' ? (isTeacher ? 'bg-emerald-600 border-emerald-500' : 'bg-brand-600 border-brand-500') + ' text-white rounded-tr-none' : 'bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-tl-none'}`}>
                                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{reply.text}</p>
                                  
                                  {reply.attachments && reply.attachments.length > 0 && (
                                      <div className="mt-4 space-y-2 border-t border-white/10 pt-3">
                                          {reply.attachments.map((att, aIdx) => (
                                              <div key={aIdx}>
                                                  {att.type.startsWith('image/') ? (
                                                      <img src={att.data} alt="Reply Attachment" className="max-h-60 rounded-lg border border-white/20" />
                                                  ) : (
                                                      <a href={att.data} download={att.name} className="flex items-center gap-2 p-2 bg-black/20 rounded-lg text-xs font-bold text-white hover:bg-black/40">
                                                          <FileText size={14}/> {att.name}
                                                      </a>
                                                  )}
                                              </div>
                                          ))}
                                      </div>
                                  )}

                                  <div className={`text-[9px] font-black uppercase tracking-widest mt-3 pt-2 border-t ${reply.role === 'admin' || reply.role === 'secondary_admin' ? (isTeacher ? 'border-emerald-500/50 text-emerald-100' : 'border-brand-500/50 text-brand-100') : 'border-slate-50 dark:border-slate-700 text-slate-400'}`}>
                                      {reply.authorName} {reply.role === 'admin' && ' (ADMIN)'} • {new Date(reply.timestamp).toLocaleString()}
                                  </div>
                              </div>
                          </div>
                      ))}
                  </div>

                  {viewingTicket.status === 'open' && ticketsEnabled && (
                      <div className="p-6 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 shrink-0">
                          <div className="space-y-3">
                              {replyFile && (
                                  <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800 p-2 rounded-lg border border-slate-100 dark:border-slate-700 text-xs">
                                      <span className="flex items-center gap-2"><Paperclip size={14}/> {replyFile.name}</span>
                                      <button onClick={() => setReplyFile(null)} className="text-red-500"><X size={14}/></button>
                                  </div>
                              )}
                              <div className="flex gap-3">
                                  <input type="file" ref={replyFileInputRef} className="hidden" onChange={(e) => handleFileSelect(e, true)} />
                                  <button onClick={() => replyFileInputRef.current?.click()} className="p-3 text-gray-400 hover:text-white bg-transparent hover:bg-gray-700/50 rounded-full transition-colors">
                                      <Paperclip size={20}/>
                                  </button>
                                  <input 
                                    value={replyText}
                                    onChange={e => setReplyText(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleReply())}
                                    placeholder="Add a reply..." 
                                    className={`flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-5 py-3 text-sm outline-none focus:ring-2 ${isTeacher ? 'focus:ring-emerald-500/20' : 'focus:ring-brand-500/20'} dark:text-white`}
                                  />
                                  <button 
                                    disabled={loading || (!replyText.trim() && !replyFile)}
                                    onClick={handleReply}
                                    className={`${themeBtnColor} text-white px-6 rounded-xl transition-all shadow-lg disabled:opacity-50 flex items-center justify-center`}
                                  >
                                      {loading ? <Loader2 size={20} className="animate-spin"/> : <Send size={20}/>}
                                  </button>
                              </div>
                          </div>
                      </div>
                  )}
              </div>
          </div>
      )}

      <div className="text-center pt-8">
          <p className="text-xs text-slate-400 italic">Open Platform is maintained by the Student Development Team.</p>
      </div>
    </div>
  );
};

export default ContactUs;

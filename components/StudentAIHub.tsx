
import React, { useState, useRef, useEffect } from 'react';
import { X, Sparkles, MessageSquare, StickyNote, Baby, Send, Loader2, Copy, Paperclip, FileText, Image as ImageIcon, ChevronDown, Check, Menu, Plus, Compass, Brain } from 'lucide-react';
import { useLanguage } from '../LanguageContext';
import { getTutorResponse, generateFlashcards, simplifyConcept } from '../services/geminiService';
import { ScheduleMap, ChatMessage, AIModel, User } from '../types';
import { db } from '../services/db';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';

interface StudentAIHubProps {
    isOpen: boolean;
    onClose: () => void;
    schedule: ScheduleMap;
    currentUser: User;
    initialAutoMessage?: string;
}

const StudentAIHub: React.FC<StudentAIHubProps> = ({ isOpen, onClose, schedule, currentUser, initialAutoMessage }) => {
    const { t } = useLanguage();
    const [activeTool, setActiveTool] = useState<'tutor' | 'flashcards' | 'simplifier'>('tutor');
    const [selectedModel, setSelectedModel] = useState<AIModel>('fast');
    const [proQuota, setProQuota] = useState<{ allowed: boolean, remaining: number }>({ allowed: true, remaining: 0 });
    const [showModelMenu, setShowModelMenu] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [attachedFile, setAttachedFile] = useState<{ name: string, type: string, data: string } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [chatInput, setChatInput] = useState('');
    const [isChatLoading, setIsChatLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [fcTopic, setFcTopic] = useState('');
    const [fcResult, setFcResult] = useState('');
    const [isFcLoading, setIsFcLoading] = useState(false);
    const [simpleConcept, setSimpleConcept] = useState('');
    const [simpleResult, setSimpleResult] = useState('');
    const [isSimpleLoading, setIsSimpleLoading] = useState(false);

    useEffect(() => { if (isOpen) checkQuota(); }, [isOpen]);
    
    // Handle Auto Trigger Message (Proactive AI)
    useEffect(() => {
        if (isOpen && initialAutoMessage) {
            setMessages([{ role: 'model', text: initialAutoMessage }]);
        }
    }, [isOpen, initialAutoMessage]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) setShowModelMenu(false);
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const checkQuota = async () => {
        const status = await db.checkProQuota(currentUser.id, currentUser.role);
        setProQuota(status);
        if (!status.allowed && selectedModel === 'pro') setSelectedModel('fast');
    };

    const handleModelChange = (model: AIModel) => {
        if (model === 'pro' && !proQuota.allowed) { alert("Pro quota exceeded."); return; }
        setSelectedModel(model);
        setShowModelMenu(false);
    };

    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, activeTool, isChatLoading]);

    if (!isOpen) return null;

    const handleSwitchTool = (tool: typeof activeTool) => {
        setActiveTool(tool);
        setAttachedFile(null);
        if (window.innerWidth < 768) setSidebarOpen(false);
    };

    const handleResetChat = () => {
        setMessages([]);
        setActiveTool('tutor');
        if (window.innerWidth < 768) setSidebarOpen(false);
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          const reader = new FileReader();
          reader.onload = (evt) => {
            const base64String = (evt.target?.result as string).split(',')[1];
            setAttachedFile({ name: file.name, type: file.type, data: base64String });
          };
          reader.readAsDataURL(file);
        }
    };

    const handleSendChat = async () => {
        if ((!chatInput.trim() && !attachedFile) || isChatLoading) return;
        if (selectedModel === 'pro') {
            const currentStatus = await db.checkProQuota(currentUser.id, currentUser.role);
            if (!currentStatus.allowed) { alert("Pro quota exceeded."); setSelectedModel('fast'); setProQuota(currentStatus); return; }
        }
        const text = chatInput.trim();
        const currentFile = attachedFile;
        setChatInput('');
        setAttachedFile(null);
        const userMessage: ChatMessage = { 
            role: 'user', 
            text: currentFile ? `[Uploaded: ${currentFile.name}] ${text}` : text,
            file: currentFile ? { name: currentFile.name, mimeType: currentFile.type, data: currentFile.data } : undefined
        };
        setMessages(prev => [...prev, userMessage]);
        setIsChatLoading(true);
        try {
            const currentHistory = [...messages]; 
            const response = await getTutorResponse(currentHistory, text || (currentFile ? "Analyze this file." : ""), currentFile ? { mimeType: currentFile.type, data: currentFile.data } : undefined, 'student', selectedModel);
            if (selectedModel === 'pro') { await db.incrementProQuota(currentUser.id); checkQuota(); }
            setMessages(prev => [...prev, { role: 'model', text: response }]);
        } catch (e) { setMessages(prev => [...prev, { role: 'model', text: "Sorry, I encountered an error." }]); } finally { setIsChatLoading(false); }
    };

    const handleGenerateFlashcards = async () => {
        if (!fcTopic && !attachedFile) return;
        if (selectedModel === 'pro' && !proQuota.allowed) { alert("Quota exceeded."); return; }
        setIsFcLoading(true);
        const fileData = attachedFile ? { mimeType: attachedFile.type, data: attachedFile.data } : undefined;
        try {
            const res = await generateFlashcards(fcTopic || "Based on the attached file", fileData, selectedModel);
            setFcResult(res);
            if (selectedModel === 'pro') { await db.incrementProQuota(currentUser.id); checkQuota(); }
        } catch (e) { console.error(e); } finally { setIsFcLoading(false); }
    };

    const handleSimplify = async () => {
        if (!simpleConcept && !attachedFile) return;
        if (selectedModel === 'pro' && !proQuota.allowed) { alert("Quota exceeded."); return; }
        setIsSimpleLoading(true);
        const fileData = attachedFile ? { mimeType: attachedFile.type, data: attachedFile.data } : undefined;
        try {
            const res = await simplifyConcept(simpleConcept || "the attached content", fileData, selectedModel);
            setSimpleResult(res);
            if (selectedModel === 'pro') { await db.incrementProQuota(currentUser.id); checkQuota(); }
        } catch (e) { console.error(e); } finally { setIsSimpleLoading(false); }
    };

    const ModelSelectorPopup = () => (
        <div ref={menuRef} className="absolute bottom-16 right-0 w-48 bg-[#1e1f20] rounded-xl shadow-2xl border border-gray-700 p-1 z-[150] animate-in zoom-in-95 origin-bottom-right">
            <div className="text-[10px] font-bold text-gray-500 px-3 py-2 uppercase tracking-wider">Model</div>
            <div className="space-y-0.5">
                <button onClick={() => handleModelChange('fast')} className={`flex items-center justify-between w-full px-3 py-2.5 rounded-lg text-sm transition-colors ${selectedModel === 'fast' ? 'bg-[#282a2c] text-white' : 'text-gray-400 hover:bg-[#282a2c] hover:text-gray-200'}`}>
                    <span className="font-bold">Fast</span>
                    {selectedModel === 'fast' && <Check size={14} className="text-blue-400"/>}
                </button>
                <button onClick={() => handleModelChange('thinking')} className={`flex items-center justify-between w-full px-3 py-2.5 rounded-lg text-sm transition-colors ${selectedModel === 'thinking' ? 'bg-[#282a2c] text-white' : 'text-gray-400 hover:bg-[#282a2c] hover:text-gray-200'}`}>
                    <span className="font-bold">Thinking</span>
                    {selectedModel === 'thinking' && <Check size={14} className="text-purple-400"/>}
                </button>
                <button onClick={() => handleModelChange('pro')} disabled={!proQuota.allowed} className={`flex items-center justify-between w-full px-3 py-2.5 rounded-lg text-sm transition-colors ${selectedModel === 'pro' ? 'bg-[#282a2c] text-white' : 'text-gray-400 hover:bg-[#282a2c] hover:text-gray-200'} ${!proQuota.allowed ? 'opacity-50 cursor-not-allowed' : ''}`}>
                    <div className="flex flex-col items-start">
                        <span className="font-bold">Pro</span>
                        <span className="text-[9px] opacity-60">Quota: {proQuota.remaining > 900 ? '∞' : proQuota.remaining}</span>
                    </div>
                    {selectedModel === 'pro' && <Check size={14} className="text-amber-400"/>}
                </button>
            </div>
        </div>
    );

    return (
        <div className="fixed inset-0 bg-[#131314] z-[120] flex font-sans text-gray-200">
            <button onClick={onClose} className="absolute top-4 right-4 z-[130] p-2 text-gray-400 hover:text-white bg-transparent hover:bg-gray-800 rounded-full transition-colors"><X size={24} /></button>
            <div className={`${sidebarOpen ? 'w-72' : 'w-0'} bg-[#1e1f20] transition-all duration-300 ease-in-out overflow-hidden flex flex-col border-r border-gray-800 absolute md:relative z-20 h-full`}>
                <div className="p-4 flex-none">
                    <button onClick={() => setSidebarOpen(false)} className="md:hidden text-gray-400 mb-4"><Menu size={24}/></button>
                    <button onClick={handleResetChat} className="w-full bg-[#282a2c] hover:bg-[#37393b] text-gray-200 py-3 rounded-full flex items-center gap-3 px-4 transition-colors mb-6 shadow-sm">
                        <Plus size={20} className="text-gray-400"/> <span className="font-medium text-sm">New Chat</span>
                    </button>
                    <div className="text-xs font-bold text-gray-500 mb-2 px-2 uppercase tracking-wider">Library</div>
                    <nav className="space-y-1">
                        <button onClick={() => handleSwitchTool('tutor')} className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-full text-sm transition-colors ${activeTool === 'tutor' ? 'bg-[#004a77] text-[#c2e7ff]' : 'hover:bg-[#282a2c] text-gray-300'}`}><MessageSquare size={18} /> {t.studentAI.tabs.tutor}</button>
                        <button onClick={() => handleSwitchTool('flashcards')} className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-full text-sm transition-colors ${activeTool === 'flashcards' ? 'bg-[#004a77] text-[#c2e7ff]' : 'hover:bg-[#282a2c] text-gray-300'}`}><StickyNote size={18} /> {t.studentAI.tabs.flashcards}</button>
                        <button onClick={() => handleSwitchTool('simplifier')} className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-full text-sm transition-colors ${activeTool === 'simplifier' ? 'bg-[#004a77] text-[#c2e7ff]' : 'hover:bg-[#282a2c] text-gray-300'}`}><Baby size={18} /> {t.studentAI.tabs.simplifier}</button>
                    </nav>
                </div>
            </div>
            <div className="flex-1 flex flex-col h-full relative bg-[#131314]">
                <div className="absolute top-4 left-4 z-10">{!sidebarOpen && <button onClick={() => setSidebarOpen(true)} className="p-2 text-gray-400 hover:text-white"><Menu size={24}/></button>}</div>
                {activeTool === 'tutor' && (
                    <div className="flex flex-col h-full max-w-4xl mx-auto w-full">
                        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 scrollbar-hide">
                            {messages.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-center p-4 animate-in fade-in zoom-in duration-500">
                                    <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mb-2">Hello, {currentUser.name?.split(' ')[0] || 'Student'}</h1>
                                    <p className="text-2xl md:text-3xl text-gray-500 mb-12">What can I help you learn today?</p>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-2xl">
                                        <button onClick={() => { setChatInput("Explain this concept..."); fileInputRef.current?.click(); }} className="bg-[#1e1f20] hover:bg-[#282a2c] p-4 rounded-2xl text-left transition-all border border-gray-800/50 hover:border-blue-500/30 group">
                                            <div className="bg-black/30 w-10 h-10 rounded-full flex items-center justify-center mb-3 group-hover:bg-blue-500/20"><Compass className="text-blue-400" size={20}/></div>
                                            <div className="text-gray-300 font-medium">Explain a concept</div>
                                        </button>
                                        <button onClick={() => handleSwitchTool('flashcards')} className="bg-[#1e1f20] hover:bg-[#282a2c] p-4 rounded-2xl text-left transition-all border border-gray-800/50 hover:border-purple-500/30 group">
                                            <div className="bg-black/30 w-10 h-10 rounded-full flex items-center justify-center mb-3 group-hover:bg-purple-500/20"><StickyNote className="text-purple-400" size={20}/></div>
                                            <div className="text-gray-300 font-medium">Create flashcards</div>
                                        </button>
                                        <button onClick={() => { setChatInput("Help me solve this math problem: "); }} className="bg-[#1e1f20] hover:bg-[#282a2c] p-4 rounded-2xl text-left transition-all border border-gray-800/50 hover:border-amber-500/30 group">
                                            <div className="bg-black/30 w-10 h-10 rounded-full flex items-center justify-center mb-3 group-hover:bg-amber-500/20"><Brain className="text-amber-400" size={20}/></div>
                                            <div className="text-gray-300 font-medium">Solve a problem</div>
                                        </button>
                                        <button onClick={() => handleSwitchTool('simplifier')} className="bg-[#1e1f20] hover:bg-[#282a2c] p-4 rounded-2xl text-left transition-all border border-gray-800/50 hover:border-green-500/30 group">
                                            <div className="bg-black/30 w-10 h-10 rounded-full flex items-center justify-center mb-3 group-hover:bg-green-500/20"><Baby className="text-green-400" size={20}/></div>
                                            <div className="text-gray-300 font-medium">Simplify text</div>
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                messages.map((msg, idx) => (
                                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2`}>
                                        <div className={`max-w-[85%] md:max-w-[75%] rounded-3xl px-6 py-4 text-sm md:text-base leading-relaxed ${msg.role === 'user' ? 'bg-[#282a2c] text-white rounded-br-none' : 'text-gray-100 relative'}`}>
                                            {msg.role === 'model' && <div className="mb-2 text-xs font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400 flex items-center gap-2"><Sparkles size={12}/> Gemini</div>}
                                            {msg.file && (
                                                <div className="flex items-center gap-2 text-xs bg-black/20 px-3 py-2 rounded-lg mb-3 border border-white/10 w-fit">
                                                    {msg.file.mimeType.startsWith('image/') ? <ImageIcon size={14}/> : <FileText size={14}/>}
                                                    {msg.file.name || 'Attachment'}
                                                </div>
                                            )}
                                            <div className="markdown-content-dark">
                                                <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]}>{msg.text}</ReactMarkdown>
                                            </div>
                                            {msg.role === 'model' && <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-3xl -z-10 blur-sm pointer-events-none opacity-50"></div>}
                                        </div>
                                    </div>
                                ))
                            )}
                            {isChatLoading && (
                                <div className="flex justify-start">
                                    <div className="text-gray-400 flex items-center gap-3 text-sm px-4 bg-[#1e1f20] py-2 rounded-full border border-gray-800">
                                        <Loader2 className="animate-spin text-blue-400" size={16} /> Thinking...
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} className="h-4"/>
                        </div>
                        <div className="p-4 md:p-6 bg-[#131314]">
                            <div className="bg-[#1e1f20] rounded-[2rem] p-2 pr-4 flex items-end gap-2 border border-gray-700/50 shadow-lg relative">
                                <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileSelect} accept="image/*,application/pdf,text/plain" />
                                <button onClick={() => fileInputRef.current?.click()} className="p-3 text-gray-400 hover:text-white bg-transparent hover:bg-gray-700/50 rounded-full transition-colors"><Plus size={20} /></button>
                                {attachedFile && (<div className="absolute -top-12 left-4 bg-[#282a2c] text-white px-3 py-2 rounded-lg text-xs flex items-center gap-2 border border-gray-700 shadow-xl animate-in slide-in-from-bottom-1"><Paperclip size={12}/> {attachedFile.name} <button onClick={() => setAttachedFile(null)}><X size={12}/></button></div>)}
                                <textarea value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendChat())} placeholder="Ask Gemini..." className="flex-1 bg-transparent border-0 outline-none text-white placeholder-gray-500 py-3 max-h-32 resize-none" rows={1} />
                                <div className="flex items-center gap-2 pb-1.5">
                                    <div className="relative">
                                        <button onClick={() => setShowModelMenu(!showModelMenu)} className="px-3 py-1.5 text-gray-400 hover:text-white transition-colors text-[10px] uppercase tracking-widest font-extrabold flex items-center gap-1" title="Select Model">{selectedModel}<ChevronDown size={10} /></button>
                                        {showModelMenu && <ModelSelectorPopup />}
                                    </div>
                                    {chatInput.trim() || attachedFile ? (<button onClick={handleSendChat} className="p-2 bg-white text-black rounded-full hover:bg-gray-200 transition-all scale-110 shadow-md"><Send size={18} className="ml-0.5" /></button>) : null}
                                </div>
                            </div>
                            <div className="text-center text-[10px] text-gray-600 mt-3 font-medium">Gemini can make mistakes, please double-check responses.</div>
                        </div>
                    </div>
                )}
                {activeTool !== 'tutor' && (
                    <div className="flex-1 p-6 md:p-12 overflow-y-auto">
                        <div className="max-w-3xl mx-auto">
                            <h2 className="text-3xl font-bold text-white mb-8 flex items-center gap-3">{activeTool === 'flashcards' ? <StickyNote className="text-purple-400"/> : <Baby className="text-green-400"/>}{activeTool === 'flashcards' ? "Flashcard Generator" : "Concept Simplifier"}</h2>
                            <div className="bg-[#1e1f20] rounded-2xl border border-gray-700 p-6 space-y-6 shadow-2xl">
                                <div><label className="block text-xs font-bold text-gray-500 uppercase mb-2 tracking-widest">Input Content</label><textarea value={activeTool === 'flashcards' ? fcTopic : simpleConcept} onChange={e => activeTool === 'flashcards' ? setFcTopic(e.target.value) : setSimpleConcept(e.target.value)} className="w-full bg-[#131314] border border-gray-700 rounded-xl p-4 text-gray-200 outline-none focus:border-blue-500 transition-all h-40 resize-none" placeholder={activeTool === 'flashcards' ? "Paste notes or type a topic..." : "Paste complex text or concept..."} /></div>
                                {attachedFile && (<div className="flex items-center justify-between text-xs bg-[#282a2c] text-gray-200 px-3 py-2 rounded-lg border border-gray-700"><span className="flex items-center gap-2 truncate max-w-[200px]"><Paperclip size={12} /> {attachedFile.name}</span><button onClick={() => setAttachedFile(null)} className="text-gray-400 hover:text-white"><X size={14}/></button></div>)}
                                <div className="flex items-center justify-between pt-4 border-t border-gray-800">
                                    <button type="button" onClick={() => fileInputRef.current?.click()} className="text-sm text-blue-400 hover:text-blue-300 font-bold flex items-center gap-2 transition-colors"><Paperclip size={16}/> Attach Material</button>
                                    <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileSelect} accept="image/*,application/pdf,text/plain" />
                                    <button onClick={activeTool === 'flashcards' ? handleGenerateFlashcards : handleSimplify} disabled={isFcLoading || isSimpleLoading} className="bg-white text-black px-8 py-3 rounded-full font-bold hover:bg-gray-200 transition-all transform active:scale-95 flex items-center gap-2 disabled:opacity-50">{(isFcLoading || isSimpleLoading) && <Loader2 className="animate-spin" size={18}/>} Generate</button>
                                </div>
                            </div>
                            {(fcResult || simpleResult) && (
                                <div className="mt-8 bg-[#1e1f20] rounded-2xl border border-gray-700 p-8 relative shadow-2xl animate-in fade-in slide-in-from-top-4">
                                    <button onClick={() => { navigator.clipboard.writeText(activeTool === 'flashcards' ? fcResult : simpleResult); alert("Copied!"); }} className="absolute top-4 right-4 text-gray-500 hover:text-white p-2 bg-black/20 rounded-lg transition-colors"><Copy size={16}/></button>
                                    <div className="markdown-content-dark overflow-auto"><ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]}>{activeTool === 'flashcards' ? fcResult : simpleResult}</ReactMarkdown></div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
            <style>{`
                .markdown-content-dark { color: #e5e7eb; font-size: 1rem; line-height: 1.7; }
                .markdown-content-dark h1, .markdown-content-dark h2, .markdown-content-dark h3 { color: #fff; font-weight: 700; margin-top: 1.5em; margin-bottom: 0.5em; }
                .markdown-content-dark p { margin-bottom: 1.2em; }
                .markdown-content-dark ul { list-style-type: disc; padding-left: 1.5em; margin-bottom: 1.2em; }
                .markdown-content-dark ol { list-style-type: decimal; padding-left: 1.5em; margin-bottom: 1.2em; }
                .markdown-content-dark code { background-color: rgba(255,255,255,0.08); padding: 0.2em 0.4em; border-radius: 4px; font-family: monospace; font-size: 0.9em; color: #a5b4fc; }
                .markdown-content-dark pre { background-color: #000; padding: 1.2em; border-radius: 12px; overflow-x: auto; margin-bottom: 1.2em; border: 1px solid #333; }
                .markdown-content-dark pre code { background-color: transparent; padding: 0; color: #fff; }
                .markdown-content-dark table { width: 100%; border-collapse: collapse; margin-bottom: 1.5em; border-radius: 8px; overflow: hidden; }
                .markdown-content-dark th { background-color: #2d2d2d; text-align: left; padding: 12px; border: 1px solid #444; font-weight: 700; color: #fff; }
                .markdown-content-dark td { padding: 12px; border: 1px solid #444; color: #d1d5db; }
                .markdown-content-dark blockquote { border-left: 4px solid #4f46e5; padding-left: 1.5em; color: #9ca3af; font-style: italic; margin-bottom: 1.5em; }
            `}</style>
        </div>
    );
};

export default StudentAIHub;


import React, { useState, useRef, useEffect } from 'react';
import { X, Sparkles, MessageSquare, ListChecks, Mail, FileQuestion, Send, Loader2, Copy, CheckCircle2, ChevronRight, RefreshCw, Paperclip, FileText, Image as ImageIcon, Zap, Brain, Crown, ChevronDown, Check, Menu, Plus, Compass, PlayCircle } from 'lucide-react';
import { useLanguage } from '../LanguageContext';
import { getTutorResponse, generateRubric, generateEmail, generateQuiz } from '../services/geminiService';
import { QuizQuestion, ChatMessage, AIModel, User } from '../types';
import { db } from '../services/db';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';

interface TeacherAIHubProps {
    isOpen: boolean;
    onClose: () => void;
    currentUser: User;
}

const TeacherAIHub: React.FC<TeacherAIHubProps> = ({ isOpen, onClose, currentUser }) => {
    const { t } = useLanguage();
    const [activeTool, setActiveTool] = useState<'assistant' | 'rubric' | 'email' | 'quiz'>('assistant');
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
    const [rubricSubject, setRubricSubject] = useState('');
    const [rubricGrade, setRubricGrade] = useState('');
    const [rubricAssign, setRubricAssign] = useState('');
    const [rubricResult, setRubricResult] = useState('');
    const [isRubricLoading, setIsRubricLoading] = useState(false);
    const [emailStudent, setEmailStudent] = useState('');
    const [emailIssue, setEmailIssue] = useState('');
    const [emailTone, setEmailTone] = useState('Professional');
    const [emailResult, setEmailResult] = useState('');
    const [isEmailLoading, setIsEmailLoading] = useState(false);
    const [quizTopic, setQuizTopic] = useState('');
    const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
    const [isQuizLoading, setIsQuizLoading] = useState(false);
    const [quizAnswers, setQuizAnswers] = useState<{[index: number]: string}>({});
    const [quizSubmitted, setQuizSubmitted] = useState(false);
    const [showQuizTest, setShowQuizTest] = useState(false);

    useEffect(() => { if (isOpen) checkQuota(); }, [isOpen]);
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
        setActiveTool('assistant');
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
            const response = await getTutorResponse(currentHistory, text || (currentFile ? "Analyze this file." : ""), currentFile ? { mimeType: currentFile.type, data: currentFile.data } : undefined, 'teacher', selectedModel);
            if (selectedModel === 'pro') { await db.incrementProQuota(currentUser.id); checkQuota(); }
            setMessages(prev => [...prev, { role: 'model', text: response }]);
        } catch (e) { setMessages(prev => [...prev, { role: 'model', text: "Sorry, I encountered an error." }]); } finally { setIsChatLoading(false); }
    };

    const handleGenerateRubric = async () => {
        if (!rubricSubject || !rubricGrade || !rubricAssign) return;
        if (selectedModel === 'pro' && !proQuota.allowed) { alert("Quota exceeded."); return; }
        setIsRubricLoading(true);
        const fileData = attachedFile ? { mimeType: attachedFile.type, data: attachedFile.data } : undefined;
        try {
            const res = await generateRubric(rubricSubject, rubricGrade, rubricAssign, fileData, selectedModel);
            setRubricResult(res);
            if (selectedModel === 'pro') { await db.incrementProQuota(currentUser.id); checkQuota(); }
        } catch(e) { console.error(e); } finally { setIsRubricLoading(false); }
    };

    const handleGenerateEmail = async () => {
        if (!emailStudent || !emailIssue) return;
        if (selectedModel === 'pro' && !proQuota.allowed) { alert("Quota exceeded."); return; }
        setIsEmailLoading(true);
        const fileData = attachedFile ? { mimeType: attachedFile.type, data: attachedFile.data } : undefined;
        try {
            const res = await generateEmail(emailStudent, emailIssue, emailTone, fileData, selectedModel);
            setEmailResult(res);
            if (selectedModel === 'pro') { await db.incrementProQuota(currentUser.id); checkQuota(); }
        } catch(e) { console.error(e); } finally { setIsEmailLoading(false); }
    };

    const handleGenerateQuiz = async () => {
        if (!quizTopic && !attachedFile) return;
        if (selectedModel === 'pro' && !proQuota.allowed) { alert("Quota exceeded."); return; }
        setIsQuizLoading(true);
        setQuizQuestions([]);
        setQuizSubmitted(false);
        setQuizAnswers({});
        setShowQuizTest(false);
        const fileData = attachedFile ? { mimeType: attachedFile.type, data: attachedFile.data } : undefined;
        try {
            const res = await generateQuiz(quizTopic || "Based on the attached file", fileData, selectedModel);
            setQuizQuestions(res);
            if (selectedModel === 'pro') { await db.incrementProQuota(currentUser.id); checkQuota(); }
        } catch(e) { console.error(e); } finally { setIsQuizLoading(false); }
    };

    const handleQuizSelect = (qIdx: number, option: string) => {
        if (quizSubmitted) return;
        setQuizAnswers(prev => ({ ...prev, [qIdx]: option }));
    };

    const ModelSelectorPopup = () => (
        <div ref={menuRef} className="absolute bottom-16 right-0 w-48 bg-[#1e1f20] rounded-xl shadow-2xl border border-gray-700 p-1 z-[150] animate-in zoom-in-95 origin-bottom-right">
            <div className="text-[10px] font-bold text-gray-500 px-3 py-2 uppercase tracking-wider">Model</div>
            <div className="space-y-0.5">
                <button onClick={() => handleModelChange('fast')} className={`flex items-center justify-between w-full px-3 py-2.5 rounded-lg text-sm transition-colors ${selectedModel === 'fast' ? 'bg-[#282a2c] text-white' : 'text-gray-400 hover:bg-[#282a2c] hover:text-gray-200'}`}><span className="font-bold">Fast</span>{selectedModel === 'fast' && <Check size={14} className="text-purple-400"/>}</button>
                <button onClick={() => handleModelChange('thinking')} className={`flex items-center justify-between w-full px-3 py-2.5 rounded-lg text-sm transition-colors ${selectedModel === 'thinking' ? 'bg-[#282a2c] text-white' : 'text-gray-400 hover:bg-[#282a2c] hover:text-gray-200'}`}><span className="font-bold">Thinking</span>{selectedModel === 'thinking' && <Check size={14} className="text-blue-400"/>}</button>
                <button onClick={() => handleModelChange('pro')} disabled={!proQuota.allowed} className={`flex items-center justify-between w-full px-3 py-2.5 rounded-lg text-sm transition-colors ${selectedModel === 'pro' ? 'bg-[#282a2c] text-white' : 'text-gray-400 hover:bg-[#282a2c] hover:text-gray-200'} ${!proQuota.allowed ? 'opacity-50 cursor-not-allowed' : ''}`}><div className="flex flex-col items-start"><span className="font-bold">Pro</span><span className="text-[9px] opacity-60">Quota: {proQuota.remaining > 900 ? '∞' : proQuota.remaining}</span></div>{selectedModel === 'pro' && <Check size={14} className="text-amber-400"/>}</button>
            </div>
        </div>
    );

    return (
        <div className="fixed inset-0 bg-[#131314] z-[120] flex font-sans text-gray-200">
            <button onClick={onClose} className="absolute top-4 right-4 z-[130] p-2 text-gray-400 hover:text-white bg-transparent hover:bg-gray-800 rounded-full transition-colors"><X size={24} /></button>
            <div className={`${sidebarOpen ? 'w-72' : 'w-0'} bg-[#1e1f20] transition-all duration-300 ease-in-out overflow-hidden flex flex-col border-r border-gray-800 absolute md:relative z-20 h-full`}>
                <div className="p-4 flex-none">
                    <button onClick={() => setSidebarOpen(false)} className="md:hidden text-gray-400 mb-4"><Menu size={24}/></button>
                    <button onClick={handleResetChat} className="w-full bg-[#282a2c] hover:bg-[#37393b] text-gray-200 py-3 rounded-full flex items-center gap-3 px-4 transition-colors mb-6 shadow-sm"><Plus size={20} className="text-gray-400"/> <span className="font-medium text-sm">New Chat</span></button>
                    <div className="text-xs font-bold text-gray-500 mb-2 px-2 uppercase tracking-wider">Library</div>
                    <nav className="space-y-1">
                        <button onClick={() => handleSwitchTool('assistant')} className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-full text-sm transition-colors ${activeTool === 'assistant' ? 'bg-[#3b2b57] text-[#e9d5ff]' : 'hover:bg-[#282a2c] text-gray-300'}`}><MessageSquare size={18} /> {t.teacherAI.tabs.assistant}</button>
                        <button onClick={() => handleSwitchTool('rubric')} className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-full text-sm transition-colors ${activeTool === 'rubric' ? 'bg-[#3b2b57] text-[#e9d5ff]' : 'hover:bg-[#282a2c] text-gray-300'}`}><ListChecks size={18} /> {t.teacherAI.tabs.rubric}</button>
                        <button onClick={() => handleSwitchTool('email')} className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-full text-sm transition-colors ${activeTool === 'email' ? 'bg-[#3b2b57] text-[#e9d5ff]' : 'hover:bg-[#282a2c] text-gray-300'}`}><Mail size={18} /> {t.teacherAI.tabs.email}</button>
                        <button onClick={() => handleSwitchTool('quiz')} className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-full text-sm transition-colors ${activeTool === 'quiz' ? 'bg-[#3b2b57] text-[#e9d5ff]' : 'hover:bg-[#282a2c] text-gray-300'}`}><FileQuestion size={18} /> {t.teacherAI.tabs.quiz}</button>
                    </nav>
                </div>
            </div>
            <div className="flex-1 flex flex-col h-full relative bg-[#131314]">
                <div className="absolute top-4 left-4 z-10">{!sidebarOpen && <button onClick={() => setSidebarOpen(true)} className="p-2 text-gray-400 hover:text-white"><Menu size={24}/></button>}</div>
                {activeTool === 'assistant' && (
                    <div className="flex flex-col h-full max-w-4xl mx-auto w-full">
                        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 scrollbar-hide">
                            {messages.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-center p-4 animate-in fade-in zoom-in duration-500">
                                    <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-2">Hello, {currentUser.name?.split(' ')[0] || 'Teacher'}</h1>
                                    <p className="text-2xl md:text-3xl text-gray-500 mb-12">What lesson are we planning today?</p>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-2xl">
                                        <button onClick={() => { setChatInput("Create a lesson plan for..."); fileInputRef.current?.click(); }} className="bg-[#1e1f20] hover:bg-[#282a2c] p-4 rounded-2xl text-left transition-all border border-gray-800/50 hover:border-purple-500/30 group"><div className="bg-black/30 w-10 h-10 rounded-full flex items-center justify-center mb-3 group-hover:bg-purple-500/20"><Compass className="text-purple-400" size={20}/></div><div className="text-gray-300 font-medium">Create Lesson Plan</div></button>
                                        <button onClick={() => handleSwitchTool('rubric')} className="bg-[#1e1f20] hover:bg-[#282a2c] p-4 rounded-2xl text-left transition-all border border-gray-800/50 hover:border-pink-500/30 group"><div className="bg-black/30 w-10 h-10 rounded-full flex items-center justify-center mb-3 group-hover:bg-pink-500/20"><ListChecks className="text-pink-400" size={20}/></div><div className="text-gray-300 font-medium">Design Grading Rubric</div></button>
                                        <button onClick={() => handleSwitchTool('quiz')} className="bg-[#1e1f20] hover:bg-[#282a2c] p-4 rounded-2xl text-left transition-all border border-gray-800/50 hover:border-blue-500/30 group"><div className="bg-black/30 w-10 h-10 rounded-full flex items-center justify-center mb-3 group-hover:bg-blue-500/20"><FileQuestion className="text-blue-400" size={20}/></div><div className="text-gray-300 font-medium">Generate Quiz</div></button>
                                        <button onClick={() => handleSwitchTool('email')} className="bg-[#1e1f20] hover:bg-[#282a2c] p-4 rounded-2xl text-left transition-all border border-gray-800/50 hover:border-amber-500/30 group"><div className="bg-black/30 w-10 h-10 rounded-full flex items-center justify-center mb-3 group-hover:bg-amber-500/20"><Mail className="text-amber-400" size={20}/></div><div className="text-gray-300 font-medium">Draft Parent Email</div></button>
                                    </div>
                                </div>
                            ) : (
                                messages.map((msg, idx) => (
                                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2`}>
                                        <div className={`max-w-[85%] md:max-w-[75%] rounded-3xl px-6 py-4 text-sm md:text-base leading-relaxed ${msg.role === 'user' ? 'bg-[#282a2c] text-white rounded-br-none' : 'text-gray-100 relative'}`}>
                                            {msg.role === 'model' && <div className="mb-2 text-xs font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400 flex items-center gap-2"><Sparkles size={12}/> Gemini</div>}
                                            {msg.file && (<div className="flex items-center gap-2 text-xs bg-black/20 px-3 py-2 rounded-lg mb-3 border border-white/10 w-fit">{msg.file.mimeType.startsWith('image/') ? <ImageIcon size={14}/> : <FileText size={14}/>}{msg.file.name || 'Attachment'}</div>)}
                                            <div className="markdown-content-dark"><ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]}>{msg.text}</ReactMarkdown></div>
                                            {msg.role === 'model' && <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-3xl -z-10 blur-sm pointer-events-none opacity-50"></div>}
                                        </div>
                                    </div>
                                ))
                            )}
                            {isChatLoading && (<div className="flex justify-start"><div className="text-gray-400 flex items-center gap-3 text-sm px-4 bg-[#1e1f20] py-2 rounded-full border border-gray-800"><Loader2 className="animate-spin text-purple-400" size={16} /> Thinking...</div></div>)}
                            <div ref={messagesEndRef} className="h-4"/>
                        </div>
                        <div className="p-4 md:p-6 bg-[#131314]">
                            <div className="bg-[#1e1f20] rounded-[2rem] p-2 pr-4 flex items-end gap-2 border border-gray-700/50 shadow-lg relative">
                                <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileSelect} accept="image/*,application/pdf,text/plain" />
                                <button onClick={() => fileInputRef.current?.click()} className="p-3 text-gray-400 hover:text-white bg-transparent hover:bg-gray-700/50 rounded-full transition-colors"><Plus size={20} /></button>
                                {attachedFile && (<div className="absolute -top-12 left-4 bg-[#282a2c] text-white px-3 py-2 rounded-lg text-xs flex items-center gap-2 border border-gray-700 shadow-xl animate-in slide-in-from-bottom-1"><Paperclip size={12}/> {attachedFile.name} <button onClick={() => setAttachedFile(null)}><X size={12}/></button></div>)}
                                <textarea value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendChat())} placeholder="Ask Gemini..." className="flex-1 bg-transparent border-0 outline-none text-white placeholder-gray-500 py-3 max-h-32 resize-none" rows={1} />
                                <div className="flex items-center gap-2 pb-1.5">
                                    <div className="relative"><button onClick={() => setShowModelMenu(!showModelMenu)} className="px-3 py-1.5 text-gray-400 hover:text-white transition-colors text-[10px] uppercase tracking-widest font-extrabold flex items-center gap-1" title="Select Model">{selectedModel}<ChevronDown size={10} /></button>{showModelMenu && <ModelSelectorPopup />}</div>
                                    {chatInput.trim() || attachedFile ? (<button onClick={handleSendChat} className="p-2 bg-white text-black rounded-full hover:bg-gray-200 transition-all scale-110 shadow-md"><Send size={18} className="ml-0.5" /></button>) : null}
                                </div>
                            </div>
                            <div className="text-center text-[10px] text-gray-600 mt-3 font-medium">Gemini can make mistakes, please double-check responses.</div>
                        </div>
                    </div>
                )}
                {activeTool !== 'assistant' && (
                    <div className="flex-1 p-6 md:p-12 overflow-y-auto">
                        <div className="max-w-4xl mx-auto">
                            <h2 className="text-3xl font-bold text-white mb-8 flex items-center gap-3">{activeTool === 'rubric' && <ListChecks className="text-purple-400"/>}{activeTool === 'email' && <Mail className="text-amber-400"/>}{activeTool === 'quiz' && <FileQuestion className="text-blue-400"/>}{activeTool === 'rubric' ? "Rubric Generator" : activeTool === 'email' ? "Parent Comms" : "Quiz Maker"}</h2>
                            <div className="bg-[#1e1f20] rounded-2xl border border-gray-700 p-6 space-y-6 shadow-2xl">
                                {activeTool === 'rubric' && (<><div className="grid grid-cols-2 gap-4"><input type="text" value={rubricSubject} onChange={e => setRubricSubject(e.target.value)} className="bg-[#131314] border border-gray-700 rounded-xl p-3 text-gray-200 outline-none focus:border-purple-500 transition-all" placeholder="Subject (e.g. English)" /><input type="text" value={rubricGrade} onChange={e => setRubricGrade(e.target.value)} className="bg-[#131314] border border-gray-700 rounded-xl p-3 text-gray-200 outline-none focus:border-purple-500 transition-all" placeholder="Grade (e.g. 10)" /></div><input type="text" value={rubricAssign} onChange={e => setRubricAssign(e.target.value)} className="w-full bg-[#131314] border border-gray-700 rounded-xl p-3 text-gray-200 outline-none focus:border-purple-500 transition-all" placeholder="Assignment Title" /></>)}
                                {activeTool === 'email' && (<><input type="text" value={emailStudent} onChange={e => setEmailStudent(e.target.value)} className="w-full bg-[#131314] border border-gray-700 rounded-xl p-3 text-gray-200 outline-none focus:border-amber-500 transition-all" placeholder="Student Name" /><textarea value={emailIssue} onChange={e => setEmailIssue(e.target.value)} className="w-full bg-[#131314] border border-gray-700 rounded-xl p-3 text-gray-200 outline-none focus:border-amber-500 h-24 resize-none transition-all" placeholder="Reason for email..." /><div className="flex gap-2">{['Professional', 'Friendly', 'Stern', 'Empathetic'].map(tn => (<button key={tn} onClick={() => setEmailTone(tn)} className={`px-3 py-1 rounded-full text-xs font-bold border transition-all ${emailTone === tn ? 'bg-amber-900/30 border-amber-500 text-amber-300' : 'border-gray-700 text-gray-400 hover:border-gray-500'}`}>{tn}</button>))}</div></>)}
                                {activeTool === 'quiz' && (<textarea value={quizTopic} onChange={e => setQuizTopic(e.target.value)} className="w-full bg-[#131314] border border-gray-700 rounded-xl p-3 text-gray-200 outline-none focus:border-blue-500 h-32 resize-none transition-all" placeholder="Topic or content to quiz on..." />)}
                                {attachedFile && (<div className="flex items-center justify-between text-xs bg-[#282a2c] text-gray-200 px-3 py-2 rounded-lg border border-gray-700"><span className="flex items-center gap-2 truncate max-w-[200px]"><Paperclip size={12} /> {attachedFile.name}</span><button onClick={() => setAttachedFile(null)} className="text-gray-400 hover:text-white"><X size={14}/></button></div>)}
                                <div className="flex items-center justify-between pt-4 border-t border-gray-800">
                                    <button type="button" onClick={() => fileInputRef.current?.click()} className="text-sm text-blue-400 hover:text-blue-300 font-bold flex items-center gap-2 transition-colors"><Paperclip size={16}/> Attach Context</button>
                                    <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileSelect} accept="image/*,application/pdf,text/plain" />
                                    <button onClick={activeTool === 'rubric' ? handleGenerateRubric : activeTool === 'email' ? handleGenerateEmail : handleGenerateQuiz} disabled={isRubricLoading || isEmailLoading || isQuizLoading} className="bg-white text-black px-8 py-3 rounded-full font-bold hover:bg-gray-200 transition-all transform active:scale-95 flex items-center gap-2 disabled:opacity-50">{(isRubricLoading || isEmailLoading || isQuizLoading) && <Loader2 className="animate-spin" size={18}/>} Generate</button>
                                </div>
                            </div>
                            {(rubricResult || emailResult || quizQuestions.length > 0) && (
                                <div className="mt-8 bg-[#1e1f20] rounded-2xl border border-gray-700 p-8 relative shadow-2xl animate-in fade-in slide-in-from-top-4">
                                    <div className="absolute top-4 right-4 flex gap-2">
                                        {activeTool === 'quiz' && quizQuestions.length > 0 && (
                                            <button onClick={() => setShowQuizTest(!showQuizTest)} className="text-gray-500 hover:text-white p-2 bg-black/20 rounded-lg flex items-center gap-2 text-xs font-bold transition-colors"><PlayCircle size={16}/> {showQuizTest ? "View Raw" : "Live Test"}</button>
                                        )}
                                        <button onClick={() => { navigator.clipboard.writeText(activeTool === 'email' ? emailResult : rubricResult); alert("Copied!"); }} className="text-gray-500 hover:text-white p-2 bg-black/20 rounded-lg transition-colors"><Copy size={16}/></button>
                                    </div>
                                    {activeTool === 'quiz' && quizQuestions.length > 0 ? (
                                        showQuizTest ? (
                                            <div className="space-y-6">
                                                <h3 className="text-xl font-bold text-white flex items-center gap-2"><PlayCircle className="text-blue-400"/> Live Test Mode</h3>
                                                {quizQuestions.map((q, idx) => (
                                                    <div key={idx} className="bg-[#131314] p-5 rounded-xl border border-gray-700 space-y-4">
                                                        <div className="font-bold text-lg text-gray-100">{idx + 1}. {q.question}</div>
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                            {q.options.map((opt, oIdx) => {
                                                                const isSelected = quizAnswers[idx] === opt;
                                                                const isCorrect = opt === q.answer;
                                                                let statusClass = "border-gray-800 bg-black/20 text-gray-400 hover:border-gray-600";
                                                                if (quizSubmitted) {
                                                                    if (isCorrect) statusClass = "border-green-500 bg-green-500/10 text-green-400";
                                                                    else if (isSelected) statusClass = "border-red-500 bg-red-500/10 text-red-400";
                                                                } else if (isSelected) statusClass = "border-blue-500 bg-blue-500/10 text-blue-400";
                                                                return (<button key={oIdx} onClick={() => handleQuizSelect(idx, opt)} className={`text-left p-3 rounded-lg border text-sm font-medium transition-all ${statusClass}`}>{opt}</button>);
                                                            })}
                                                        </div>
                                                    </div>
                                                ))}
                                                <div className="flex justify-end pt-4"><button onClick={() => setQuizSubmitted(true)} disabled={quizSubmitted || Object.keys(quizAnswers).length < quizQuestions.length} className="bg-blue-600 text-white px-8 py-3 rounded-full font-bold hover:bg-blue-700 transition-all disabled:opacity-50">Submit Quiz</button></div>
                                            </div>
                                        ) : (
                                            <div className="space-y-4">
                                                {quizQuestions.map((q, idx) => (
                                                    <div key={idx} className="bg-[#131314] p-4 rounded-xl border border-gray-700">
                                                        <div className="font-bold text-white mb-3">{idx + 1}. {q.question}</div>
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pl-4">
                                                            {q.options.map((opt, oIdx) => (<div key={oIdx} className={`text-sm p-2 rounded ${opt === q.answer ? 'text-green-400 bg-green-900/20' : 'text-gray-400'}`}>{opt}</div>))}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )
                                    ) : (
                                        <div className="markdown-content-dark overflow-auto">
                                            {activeTool === 'email' ? (<textarea readOnly value={emailResult} className="w-full bg-transparent text-gray-200 h-64 resize-none outline-none font-mono text-sm leading-relaxed" />) : (<ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]}>{rubricResult}</ReactMarkdown>)}
                                        </div>
                                    )}
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
                .markdown-content-dark code { background-color: rgba(255,255,255,0.08); padding: 0.2em 0.4em; border-radius: 4px; font-family: monospace; font-size: 0.9em; color: #e9d5ff; }
                .markdown-content-dark pre { background-color: #000; padding: 1.2em; border-radius: 12px; overflow-x: auto; margin-bottom: 1.2em; border: 1px solid #333; }
                .markdown-content-dark pre code { background-color: transparent; padding: 0; color: #fff; }
                .markdown-content-dark table { width: 100%; border-collapse: collapse; margin-bottom: 1.5em; border-radius: 8px; overflow: hidden; }
                .markdown-content-dark th { background-color: #2d2d2d; text-align: left; padding: 12px; border: 1px solid #444; font-weight: 700; color: #fff; }
                .markdown-content-dark td { padding: 12px; border: 1px solid #444; color: #d1d5db; }
                .markdown-content-dark blockquote { border-left: 4px solid #3b2b57; padding-left: 1.5em; color: #9ca3af; font-style: italic; margin-bottom: 1.5em; }
            `}</style>
        </div>
    );
};

export default TeacherAIHub;

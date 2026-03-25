
import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Loader2, Minimize2, Paperclip, FileText, Image as ImageIcon, Sparkles } from 'lucide-react';
import { getTutorResponse } from '../services/geminiService';
import { ScheduleMap, ChatMessage } from '../types';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import { useLanguage } from '../LanguageContext';

interface ChatbotProps {
    schedule?: ScheduleMap;
    mode?: 'student' | 'teacher';
}

const Chatbot: React.FC<ChatbotProps> = ({ schedule, mode = 'student' }) => {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [attachedFile, setAttachedFile] = useState<{ name: string, type: string, data: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isTeacher = mode === 'teacher';
  const title = isTeacher ? t.ai.assistant : t.ai.tutor;
  const initialMessage = isTeacher 
    ? "Hello! I am your Instructional Design Assistant. How can I help you with lesson planning, resources, or administration today?"
    : "Hello! I'm your AI Tutor. What are we studying today?";

  useEffect(() => {
      // Reset messages if mode changes (e.g. logging out as teacher and into student)
      setMessages([{ role: 'model', text: initialMessage }]);
  }, [mode]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  // Determine current class based on time
  const getCurrentContext = () => {
      if (!schedule) return "";
      const now = new Date();
      const dayIndex = now.getDay(); // 0=Sun, 1=Mon...
      if (dayIndex === 0 || dayIndex === 6) return ""; // Weekend

      // Convert day index to string (1=Mon, 2=Tue...)
      const dayMap = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const dayName = dayMap[dayIndex];

      const currentTime = now.getHours() * 60 + now.getMinutes(); // Minutes from midnight

      // Standard Bell Schedule (Approximate)
      // P1: 8:00 (480) - 8:45 (525)
      // P2: 8:50 (530) - 9:35 (575)
      // P3: 9:50 (590) - 10:35 (635)
      // P4: 10:40 (640) - 11:25 (685)
      // P5: 12:40 (760) - 13:25 (805)
      // P6: 13:30 (810) - 14:15 (855)
      // P7: 14:25 (865) - 15:10 (910)
      // P8: 15:15 (915) - 16:00 (960)
      
      const periods = [
          { idx: 0, start: 480, end: 525 },
          { idx: 1, start: 530, end: 575 },
          { idx: 2, start: 590, end: 635 },
          { idx: 3, start: 640, end: 685 },
          { idx: 4, start: 760, end: 805 },
          { idx: 5, start: 810, end: 855 },
          { idx: 6, start: 865, end: 910 },
          { idx: 7, start: 915, end: 960 }
      ];

      const currentPeriod = periods.find(p => currentTime >= p.start && currentTime <= p.end);
      
      if (currentPeriod) {
          const periodId = `${dayName}-${currentPeriod.idx}`;
          const classData = schedule[periodId];
          if (classData && classData.subject) {
              return `The user is currently in Period ${currentPeriod.idx + 1}: ${classData.subject}.`;
          }
      }
      return "";
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (evt) => {
        const base64String = (evt.target?.result as string).split(',')[1];
        setAttachedFile({
          name: file.name,
          type: file.type,
          data: base64String
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSend = async () => {
    if ((!input.trim() && !attachedFile) || isLoading) return;

    const userMsgText = input.trim();
    const currentFile = attachedFile;
    
    setInput('');
    setAttachedFile(null);
    
    // Store user message with file data for history persistence
    const userMessage: ChatMessage = { 
        role: 'user', 
        text: currentFile ? `[Uploaded: ${currentFile.name}] ${userMsgText}` : userMsgText,
        file: currentFile ? { name: currentFile.name, mimeType: currentFile.type, data: currentFile.data } : undefined
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const context = getCurrentContext();
      const systemContext = context ? `[System Context: ${context}] ` : '';
      
      const currentHistory = [...messages];

      const response = await getTutorResponse(
        currentHistory, // Pass full history
        systemContext + (userMsgText || (currentFile ? "Analyze this file." : "")), 
        currentFile ? { mimeType: currentFile.type, data: currentFile.data } : undefined,
        mode as 'student' | 'teacher'
      );
      setMessages(prev => [...prev, { role: 'model', text: response }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'model', text: "Sorry, I couldn't connect." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const themeColor = isTeacher ? 'bg-emerald-600' : 'bg-indigo-600';
  const hoverColor = isTeacher ? 'hover:bg-emerald-700' : 'hover:bg-indigo-700';
  const userMsgColor = isTeacher ? 'bg-emerald-600' : 'bg-indigo-600';

  return (
    <div className="fixed bottom-4 left-4 z-50 flex flex-col items-start no-print">
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className={`${themeColor} text-white p-4 rounded-full shadow-lg ${hoverColor} transition-all flex items-center gap-2`}
        >
          {isTeacher ? <Sparkles size={24} /> : <MessageCircle size={24} />}
          <span className="font-semibold hidden md:inline">{title}</span>
        </button>
      )}

      {isOpen && (
        <div className="bg-white border border-gray-200 shadow-2xl rounded-xl w-80 md:w-96 flex flex-col h-[500px] overflow-hidden animate-in fade-in slide-in-from-bottom-4">
          {/* Header */}
          <div className={`${themeColor} text-white p-3 flex justify-between items-center`}>
            <div className="flex items-center gap-2">
              {isTeacher ? <Sparkles size={18} /> : <MessageCircle size={18} />}
              <h3 className="font-bold">{title}</h3>
            </div>
            <button onClick={() => setIsOpen(false)} className={`${hoverColor} p-1 rounded`}>
              <Minimize2 size={18} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 bg-gray-50 space-y-3">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-lg p-3 text-sm ${
                    msg.role === 'user'
                      ? `${userMsgColor} text-white rounded-br-none`
                      : 'bg-white border border-gray-200 text-gray-800 rounded-bl-none shadow-sm'
                  }`}
                >
                  {msg.file && (
                      <div className={`flex items-center gap-2 text-xs px-2 py-1 rounded mb-1 w-fit border ${msg.role === 'user' ? 'bg-white/20 border-white/30 text-white' : 'bg-gray-100 border-gray-200 text-gray-700'}`}>
                          {msg.file.mimeType.startsWith('image/') ? <ImageIcon size={10}/> : <FileText size={10}/>}
                          {msg.file.name || 'Attachment'}
                      </div>
                  )}
                  <div className="markdown-content">
                    <ReactMarkdown 
                      remarkPlugins={[remarkMath, remarkGfm]}
                      rehypePlugins={[rehypeKatex]}
                    >
                      {msg.text}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-lg p-3 rounded-bl-none">
                  <Loader2 className="animate-spin text-gray-500" size={16} />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* File Preview */}
          {attachedFile && (
             <div className="px-4 py-2 bg-gray-100 border-t border-gray-200 flex justify-between items-center text-xs">
                <span className="flex items-center gap-2 truncate max-w-[200px]">
                    {attachedFile.type.startsWith('image/') ? <ImageIcon size={12}/> : <FileText size={12}/>}
                    {attachedFile.name}
                </span>
                <button onClick={() => setAttachedFile(null)} className="text-gray-500 hover:text-red-500"><X size={14}/></button>
             </div>
          )}

          {/* Input */}
          <div className="p-3 bg-white border-t border-gray-100 flex gap-2 items-end">
            <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileSelect} accept="image/*,application/pdf,text/plain" />
            <button 
                onClick={() => fileInputRef.current?.click()}
                className={`text-gray-400 p-2 ${isTeacher ? 'hover:text-emerald-600' : 'hover:text-indigo-600'}`}
                title="Attach file"
            >
                <Paperclip size={20} />
            </button>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Ask a question..."
              className={`flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ${isTeacher ? 'focus:ring-emerald-500' : 'focus:ring-indigo-500'} resize-none max-h-24`}
              rows={1}
            />
            <button
              onClick={handleSend}
              disabled={isLoading || (!input.trim() && !attachedFile)}
              className={`${themeColor} text-white p-2 rounded-lg ${hoverColor} disabled:opacity-50 h-9 w-9 flex items-center justify-center`}
            >
              <Send size={18} />
            </button>
          </div>
          
          {/* Disclaimer */}
          <div className="p-2 bg-gray-50 text-[10px] text-gray-400 text-center italic border-t border-gray-100">
             {t.ai.disclaimer}
          </div>
        </div>
      )}
    </div>
  );
};

export default Chatbot;
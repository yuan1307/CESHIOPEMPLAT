
import React, { useState, useEffect } from 'react';
import { CommunityPost, User } from '../types';
import { db } from '../services/db';
import { Clock, CheckCircle2, XCircle, FileText, AlertCircle } from 'lucide-react';
import { useLanguage } from '../LanguageContext';

interface MyCenterProps { user: User; }

const MyCenter: React.FC<MyCenterProps> = ({ user }) => {
  const { t } = useLanguage();
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [activeStatus, setActiveStatus] = useState<'approved' | 'pending' | 'rejected'>('approved');

  useEffect(() => { 
      const load = async () => { 
          const saved = await db.getItem<CommunityPost[]>('basis_community_posts'); 
          if (saved) { 
              setPosts(saved.filter(p => p.authorId === user.id)); 
          } 
      }; 
      load(); 
  }, [user.id]);

  const filteredPosts = posts.filter(p => p.status === activeStatus);

  return (
    <div className="max-w-4xl mx-auto p-6 md:p-10">
      <div className="mb-8"><h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><FileText className="text-brand-600" /> {t.myCenter.title}</h1><p className="text-slate-500 text-sm mt-1">{t.myCenter.subtitle}</p></div>
      
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-green-50 p-4 rounded-xl border border-green-100 flex flex-col items-center"><span className="text-2xl font-bold text-green-700">{posts.filter(p => p.status === 'approved').length}</span><span className="text-xs font-bold text-green-600 uppercase tracking-wider flex items-center gap-1"><CheckCircle2 size={12} /> {t.myCenter.approved}</span></div>
        <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-100 flex flex-col items-center"><span className="text-2xl font-bold text-yellow-700">{posts.filter(p => p.status === 'pending').length}</span><span className="text-xs font-bold text-yellow-600 uppercase tracking-wider flex items-center gap-1"><Clock size={12} /> {t.myCenter.pending}</span></div>
        <div className="bg-red-50 p-4 rounded-xl border border-red-100 flex flex-col items-center"><span className="text-2xl font-bold text-red-700">{posts.filter(p => p.status === 'rejected').length}</span><span className="text-xs font-bold text-red-600 uppercase tracking-wider flex items-center gap-1"><XCircle size={12} /> {t.myCenter.rejected}</span></div>
      </div>
      
      <div className="flex border-b border-slate-200 mb-6">{['approved', 'pending', 'rejected'].map(tab => (<button key={tab} onClick={() => setActiveStatus(tab as any)} className={`px-6 py-3 font-bold text-sm transition-all border-b-2 capitalize ${activeStatus === tab ? 'border-brand-500 text-brand-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>{t.myCenter[tab as keyof typeof t.myCenter]}</button>))}</div>
      
      <div className="space-y-4 mb-10">
        {filteredPosts.length === 0 && <div className="text-center py-12 text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">{t.community.noPosts}</div>}
        {filteredPosts.map(post => (<div key={post.id} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm"><div className="flex justify-between items-start"><div><div className="flex items-center gap-2 mb-1"><h3 className="font-bold text-slate-800">{post.title}</h3><span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded uppercase font-bold">{post.category}</span></div><p className="text-sm text-slate-600 mb-2">{post.description || '-'}</p><div className="flex gap-4 text-xs text-slate-400"><span>{t.common.subject}: {post.subject}</span><span>Target: {post.gradeLevels.join(', ')}</span><span>{t.common.date}: {post.date}</span></div></div><div className="flex flex-col items-end gap-2">{post.status === 'approved' && <span className="text-green-500"><CheckCircle2 size={20} /></span>}{post.status === 'pending' && <span className="text-yellow-500"><Clock size={20} /></span>}{post.status === 'rejected' && <span className="text-red-500"><XCircle size={20} /></span>}</div></div>{post.status === 'rejected' && post.rejectionReason && <div className="mt-4 bg-red-50 p-3 rounded-lg border border-red-100 flex gap-3 items-start"><AlertCircle className="text-red-500 mt-0.5" size={16} /><div><span className="text-xs font-bold text-red-700 uppercase block mb-1">{t.modals.reason}</span><p className="text-sm text-red-800">{post.rejectionReason}</p></div></div>}</div>))}
      </div>
    </div>
  );
};
export default MyCenter;

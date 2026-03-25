
import React, { useState, useEffect } from 'react';
import { X, User, Lock, Mail, Save, Loader2, AlertCircle } from 'lucide-react';
import { User as UserType } from '../types';
import { db } from '../services/db';
import { useLanguage } from '../LanguageContext';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserType;
  onUpdateUser: (updatedUser: UserType) => void;
}

const UserProfileModal: React.FC<UserProfileModalProps> = ({ isOpen, onClose, currentUser, onUpdateUser }) => {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'general' | 'security'>('general');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // General Form
  const [name, setName] = useState(currentUser.name || '');
  const [email, setEmail] = useState(currentUser.email || '');

  // Security Form
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');

  useEffect(() => {
    if (isOpen) {
        setName(currentUser.name || '');
        setEmail(currentUser.email || '');
        setCurrentPass('');
        setNewPass('');
        setConfirmPass('');
        setError('');
        setSuccess('');
        setActiveTab('general');
    }
  }, [isOpen, currentUser]);

  if (!isOpen) return null;

  const handleUpdateProfile = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      setError('');
      setSuccess('');

      try {
          // Sync with Supabase Auth if online
          const isConnected = await db.checkConnection();
          if (isConnected) {
              await db.auth.updateProfile({ 
                  email: email !== currentUser.email ? email : undefined,
                  data: { name: name !== currentUser.name ? name : undefined }
              });
          }

          // Update Local DB Wrapper (Primary source of truth for the app)
          const updatedUser = { ...currentUser, name, email };
          await db.setItem(`basis_user_${currentUser.id}`, updatedUser);
          
          onUpdateUser(updatedUser);
          setSuccess(t.profile.successUpdate);
          
          if (isConnected && email !== currentUser.email) {
              alert(t.profile.verifyNeeded);
          }
      } catch (err: any) {
          setError(err.message || "Failed to update profile.");
      } finally {
          setLoading(false);
      }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      setError('');
      setSuccess('');

      if (newPass !== confirmPass) {
          setError("New passwords do not match.");
          setLoading(false);
          return;
      }
      if (newPass.length < 6) {
          setError("Password must be at least 6 characters.");
          setLoading(false);
          return;
      }

      // Verify old password strictly against local stored user
      if (currentUser.password && currentUser.password !== currentPass) {
          setError("Incorrect current password.");
          setLoading(false);
          return;
      }

      try {
          // Update Supabase if online
          const isConnected = await db.checkConnection();
          if (isConnected) {
              await db.auth.updatePassword(newPass);
          }
          
          // Update Local Wrapper
          const updatedUser = { ...currentUser, password: newPass };
          await db.setItem(`basis_user_${currentUser.id}`, updatedUser);
          onUpdateUser(updatedUser);
          
          setSuccess(t.profile.successPass);
          setCurrentPass('');
          setNewPass('');
          setConfirmPass('');
      } catch (err: any) {
          setError(err.message || "Failed to update password.");
      } finally {
          setLoading(false);
      }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[120] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        <div className="bg-slate-900 text-white p-5 flex justify-between items-center">
            <h3 className="font-bold text-lg flex items-center gap-2"><User size={20}/> {t.profile.title}</h3>
            <button onClick={onClose}><X size={20} className="hover:text-slate-300 transition-colors"/></button>
        </div>
        
        <div className="flex border-b border-slate-200">
            <button 
                onClick={() => setActiveTab('general')} 
                className={`flex-1 py-3 text-sm font-bold transition-colors ${activeTab === 'general' ? 'text-brand-600 border-b-2 border-brand-600 bg-brand-50' : 'text-slate-500 hover:bg-slate-50'}`}
            >
                {t.profile.general}
            </button>
            <button 
                onClick={() => setActiveTab('security')} 
                className={`flex-1 py-3 text-sm font-bold transition-colors ${activeTab === 'security' ? 'text-brand-600 border-b-2 border-brand-600 bg-brand-50' : 'text-slate-500 hover:bg-slate-50'}`}
            >
                {t.profile.security}
            </button>
        </div>

        <div className="p-6 overflow-y-auto">
            {error && <div className="mb-4 bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-center gap-2 border border-red-100"><AlertCircle size={16}/> {error}</div>}
            {success && <div className="mb-4 bg-green-50 text-green-600 p-3 rounded-lg text-sm flex items-center gap-2 border border-green-100"><AlertCircle size={16}/> {success}</div>}

            {activeTab === 'general' ? (
                <form onSubmit={handleUpdateProfile} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t.common.name}</label>
                        <div className="relative">
                            <User className="absolute left-3 top-2.5 text-slate-400" size={16}/>
                            <input required type="text" value={name} onChange={e => setName(e.target.value)} className="w-full border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 outline-none"/>
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t.common.email}</label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-2.5 text-slate-400" size={16}/>
                            <input required type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 outline-none"/>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1">Changing email may require confirmation.</p>
                    </div>
                    <div className="pt-2">
                        <button type="submit" disabled={loading} className="w-full bg-brand-600 text-white py-2.5 rounded-lg font-bold hover:bg-brand-700 disabled:opacity-50 flex items-center justify-center gap-2">
                            {loading ? <Loader2 className="animate-spin" size={18}/> : <Save size={18}/>} {t.profile.updateProfile}
                        </button>
                    </div>
                </form>
            ) : (
                <form onSubmit={handleUpdatePassword} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t.profile.currentPass}</label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-2.5 text-slate-400" size={16}/>
                            <input required type="password" value={currentPass} onChange={e => setCurrentPass(e.target.value)} className="w-full border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 outline-none"/>
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t.profile.newPass}</label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-2.5 text-slate-400" size={16}/>
                            <input required type="password" value={newPass} onChange={e => setNewPass(e.target.value)} className="w-full border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 outline-none"/>
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t.profile.confirmPass}</label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-2.5 text-slate-400" size={16}/>
                            <input required type="password" value={confirmPass} onChange={e => setConfirmPass(e.target.value)} className="w-full border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 outline-none"/>
                        </div>
                    </div>
                    <div className="pt-2">
                        <button type="submit" disabled={loading} className="w-full bg-brand-600 text-white py-2.5 rounded-lg font-bold hover:bg-brand-700 disabled:opacity-50 flex items-center justify-center gap-2">
                            {loading ? <Loader2 className="animate-spin" size={18}/> : <Lock size={18}/>} {t.profile.updatePass}
                        </button>
                    </div>
                </form>
            )}
        </div>
      </div>
    </div>
  );
};

export default UserProfileModal;

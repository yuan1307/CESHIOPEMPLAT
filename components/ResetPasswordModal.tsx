
import React, { useState } from 'react';
import { X, Save } from 'lucide-react';

interface ResetPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (oldPass: string, newPass: string) => void;
}

const ResetPasswordModal: React.FC<ResetPasswordModalProps> = ({ isOpen, onClose, onSave }) => {
  const [oldPass, setOldPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (newPass !== confirmPass) {
        setError("New passwords do not match.");
        return;
    }
    if (newPass.length < 4) {
        setError("Password must be at least 4 characters.");
        return;
    }

    onSave(oldPass, newPass);
    // Reset form
    setOldPass('');
    setNewPass('');
    setConfirmPass('');
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="bg-slate-900 text-white p-4 flex justify-between items-center">
            <h3 className="font-bold">Reset Password</h3>
            <button onClick={onClose}><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Old Password</label>
                <input 
                    type="password" 
                    value={oldPass}
                    onChange={e => setOldPass(e.target.value)}
                    className="w-full border border-gray-300 rounded p-2"
                    required
                />
            </div>
            <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">New Password</label>
                <input 
                    type="password" 
                    value={newPass}
                    onChange={e => setNewPass(e.target.value)}
                    className="w-full border border-gray-300 rounded p-2"
                    required
                />
            </div>
            <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Re-enter New Password</label>
                <input 
                    type="password" 
                    value={confirmPass}
                    onChange={e => setConfirmPass(e.target.value)}
                    className="w-full border border-gray-300 rounded p-2"
                    required
                />
            </div>
            
            {error && <p className="text-red-500 text-xs font-bold text-center">{error}</p>}

            <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded font-bold hover:bg-blue-700 flex justify-center items-center gap-2">
                <Save size={16} /> Update Password
            </button>
        </form>
      </div>
    </div>
  );
};

export default ResetPasswordModal;


import { createClient } from '@supabase/supabase-js';
import { User, UserRole } from '../types';

const SUPABASE_URL = 'https://jdazeunvibvywkzyfvpn.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpkYXpldW52aWJ2eXdrenlmdnBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ1ODg1NzIsImV4cCI6MjA4MDE2NDU3Mn0.VgfNpbaFifERUmlXzICkaf9tgo0WmQBiB-oYFzRPVWg'; 

let supabase: any = null;

if (SUPABASE_URL && SUPABASE_KEY) {
    try {
        supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: true
            }
        });
    } catch (e) { console.error("Supabase Error:", e); }
}

const parseVal = (val: any) => {
    if (!val) return null;
    if (typeof val === 'object') return val;
    try { return JSON.parse(val); } catch (e) { return val; }
};

export const db = {
    auth: {
        signUp: async (email: string, password: string, metadata: { id: string, name: string, role: UserRole }) => {
            if (!supabase) throw new Error("Offline");
            const { data, error } = await supabase.auth.signUp({ email, password, options: { data: metadata } });
            if (error) throw error;
            return data.user;
        },
        signIn: async (email: string, password: string) => {
            if (!supabase) throw new Error("Offline");
            const { data, error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;
            return data.user;
        },
        signOut: async () => { if (supabase) await supabase.auth.signOut(); },
        getCurrentUser: async () => { if (!supabase) return null; const { data: { user } } = await supabase.auth.getUser(); return user; },
        resetPasswordEmail: async (email: string) => { if (!supabase) throw new Error("Offline"); const { error } = await supabase.auth.resetPasswordForEmail(email); if (error) throw error; },
        updatePassword: async (newPassword: string) => { if (!supabase) throw new Error("Offline"); const { error } = await supabase.auth.updateUser({ password: newPassword }); if (error) throw error; },
        updateProfile: async (updates: { email?: string, data?: { name?: string } }) => { if (!supabase) return; const { error } = await supabase.auth.updateUser(updates); if (error) throw error; },
        onAuthStateChange: (callback: (event: string, session: any) => void) => { if (supabase) return supabase.auth.onAuthStateChange(callback); return { data: { subscription: { unsubscribe: () => {} } } }; }
    },
    checkConnection: async (): Promise<boolean> => {
        if (!supabase) return false;
        try { const { error } = await supabase.from('key_value_store').select('key').limit(1); return !error; } catch (e) { return false; }
    },
    getItem: async <T>(key: string): Promise<T | null> => {
        if (supabase) {
            try {
                const { data, error } = await supabase.from('key_value_store').select('value').eq('key', key).single();
                if (!error && data) {
                    localStorage.setItem(key, JSON.stringify(data.value));
                    return data.value as T;
                }
            } catch (e) { }
        }
        const local = localStorage.getItem(key);
        return local ? parseVal(local) : null;
    },
    verifyUserStrict: async (userId: string): Promise<User | null> => {
        if (!supabase) return null;
        try {
            const key = `basis_user_${userId}`;
            const { data, error } = await supabase.from('key_value_store').select('value').eq('key', key).single();
            if (error || !data) return null;
            return data.value as User;
        } catch (e) { return null; }
    },
    setItem: async (key: string, value: any): Promise<void> => {
        localStorage.setItem(key, JSON.stringify(value));
        if (supabase) {
            try { await supabase.from('key_value_store').upsert({ key, value }); } catch (e) { }
        }
    },
    removeItem: async (key: string): Promise<void> => {
        localStorage.removeItem(key);
        if (supabase) {
            try { await supabase.from('key_value_store').delete().eq('key', key); } catch (e) { }
        }
    },
    scan: async <T>(prefix: string): Promise<{ key: string, value: T }[]> => {
        if (supabase) {
            try {
                const { data, error } = await supabase.from('key_value_store').select('key, value').like('key', `${prefix}%`);
                if (!error && data) return data.map((row: any) => ({ key: row.key, value: row.value as T }));
            } catch (e) { }
        }
        const results: { key: string, value: T }[] = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(prefix)) results.push({ key, value: parseVal(localStorage.getItem(key)) });
        }
        return results;
    },
    exportAll: async (): Promise<Record<string, any>> => {
        if (supabase) {
            const { data } = await supabase.from('key_value_store').select('*');
            const exportData: Record<string, any> = {};
            data?.forEach((row: any) => exportData[row.key] = row.value);
            return exportData;
        }
        return {};
    },
    importAll: async (data: Record<string, any>): Promise<void> => {
        for (const [key, val] of Object.entries(data)) {
            const cleanVal = typeof val === 'string' ? JSON.parse(val) : val;
            await db.setItem(key, cleanVal);
        }
    },
    pullCloudData: async (): Promise<number> => {
        if (!supabase) throw new Error("Cloud disconnected");
        const { data, error } = await supabase.from('key_value_store').select('key, value').like('key', 'basis_%');
        if (error) throw error;
        let count = 0;
        data?.forEach((row: any) => { localStorage.setItem(row.key, JSON.stringify(row.value)); count++; });
        return count;
    },
    clearLocalData: () => {
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('basis_')) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(k => localStorage.removeItem(k));
        sessionStorage.clear();
    },
    checkProQuota: async (userId: string, role: UserRole): Promise<{allowed: boolean, remaining: number}> => {
        if (role === 'admin' || role === 'secondary_admin') return { allowed: true, remaining: 9999 };
        const limit = role === 'teacher' ? 10 : 5;
        const key = `basis_ai_quota_${userId}`;
        const today = new Date().toISOString().split('T')[0];
        const usageData = await db.getItem<{date: string, count: number}>(key);
        if (!usageData || usageData.date !== today) return { allowed: true, remaining: limit };
        return { allowed: usageData.count < limit, remaining: Math.max(0, limit - usageData.count) };
    },
    incrementProQuota: async (userId: string): Promise<void> => {
        const key = `basis_ai_quota_${userId}`;
        const today = new Date().toISOString().split('T')[0];
        const usageData = await db.getItem<{date: string, count: number}>(key);
        if (!usageData || usageData.date !== today) await db.setItem(key, { date: today, count: 1 });
        else await db.setItem(key, { date: today, count: usageData.count + 1 });
    }
};

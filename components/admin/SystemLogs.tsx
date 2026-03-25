
import React, { useState, useRef, useEffect } from 'react';
import { SystemRecord, ActionType, User } from '../../types';
import { VISIBLE_ACTION_TYPES } from '../../constants';
import { Search, Filter, Edit2, Trash2 } from 'lucide-react';
import { useLanguage } from '../../LanguageContext';

interface SystemLogsProps {
    records: SystemRecord[];
    currentUser: User;
    isSuperAdminMode: boolean;
    onAddRecord: () => void;
    onEditRecord: (r: SystemRecord) => void;
    onDeleteRecord: (r: SystemRecord) => void;
    onDeleteAllRecords: () => void;
    canManage: boolean;
}

const SystemLogs: React.FC<SystemLogsProps> = ({ 
    records, 
    onAddRecord, 
    onEditRecord, 
    onDeleteRecord, 
    onDeleteAllRecords,
    canManage 
}) => {
    const { t } = useLanguage();
    const [recordSearch, setRecordSearch] = useState('');
    const [recordActionFilter, setRecordActionFilter] = useState<ActionType[]>([]);
    const [showRecordFilterDropdown, setShowRecordFilterDropdown] = useState(false);
    const recordFilterRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (recordFilterRef.current && !recordFilterRef.current.contains(event.target as Node)) {
                setShowRecordFilterDropdown(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const filteredRecords = records.filter(r => {
        const matchesSearch = r.actorName.toLowerCase().includes(recordSearch.toLowerCase()) || (r.targetName || '').toLowerCase().includes(recordSearch.toLowerCase()) || (r.details || '').toLowerCase().includes(recordSearch.toLowerCase());
        const matchesFilter = recordActionFilter.length === 0 || recordActionFilter.includes(r.action);
        return matchesSearch && matchesFilter;
    });

    const toggleAction = (a: ActionType) => {
        setRecordActionFilter(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a]);
    };

    const selectAllActions = () => {
        if (recordActionFilter.length === VISIBLE_ACTION_TYPES.length) setRecordActionFilter([]);
        else setRecordActionFilter(VISIBLE_ACTION_TYPES);
    };

    return (
        <div className="h-[500px] flex flex-col bg-white rounded-xl border border-slate-200">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex flex-col md:flex-row gap-2 items-center w-full md:w-auto">
                    <div ref={recordFilterRef} className="relative inline-block text-left">
                        <button onClick={() => setShowRecordFilterDropdown(!showRecordFilterDropdown)} className="flex items-center justify-between w-full md:w-[180px] border p-2 rounded text-sm bg-white text-slate-700">
                            <span>{recordActionFilter.length === 0 ? 'All Actions' : `${recordActionFilter.length} selected`}</span>
                            <Filter size={14}/>
                        </button>
                        {showRecordFilterDropdown && (
                            <div className="absolute z-10 mt-1 w-64 bg-white border border-slate-200 rounded-lg shadow-xl max-h-60 overflow-y-auto p-2">
                                <div className="mb-2 pb-2 border-b border-slate-100">
                                    <button onClick={selectAllActions} className="text-xs font-bold text-brand-600 hover:underline w-full text-left px-2 py-1">Select All / None</button>
                                </div>
                                {VISIBLE_ACTION_TYPES.map(action => (
                                    <label key={action} className="flex items-center gap-2 p-2 hover:bg-slate-50 cursor-pointer text-xs">
                                        <input type="checkbox" checked={recordActionFilter.includes(action)} onChange={() => toggleAction(action)} className="rounded text-brand-600"/>
                                        {action}
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="relative w-full md:w-auto"><input type="text" placeholder={t.common.search} value={recordSearch} onChange={e => setRecordSearch(e.target.value)} className="pl-8 pr-4 py-2 border rounded text-sm w-full md:w-48"/><Search className="absolute left-2.5 top-2.5 text-slate-400" size={14} /></div>
                </div>
                {canManage && (
                    <div className="flex gap-2 w-full md:w-auto">
                        <button onClick={onAddRecord} className="bg-slate-800 text-white px-3 py-2 rounded text-xs font-bold hover:bg-slate-700 flex-1 md:flex-none text-center">{t.admin.records.addRecord}</button>
                        <button onClick={onDeleteAllRecords} className="bg-red-600 text-white px-3 py-2 rounded text-xs font-bold hover:bg-red-700 flex-1 md:flex-none text-center">{t.admin.records.deleteAll}</button>
                    </div>
                )}
            </div>
            <div className="flex-1 overflow-auto">
                <table className="w-full text-left text-sm min-w-[800px]">
                    <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs sticky top-0"><tr><th className="p-3">{t.admin.records.timestamp}</th><th className="p-3">{t.admin.records.actor}</th><th className="p-3">{t.admin.records.action}</th><th className="p-3">{t.admin.records.target}</th><th className="p-3">{t.admin.records.details}</th>{canManage && <th className="p-3 text-right">Ops</th>}</tr></thead>
                    <tbody className="divide-y divide-slate-100">
                        {filteredRecords.map(rec => {
                            let displayAction = rec.action;
                            if (rec.action === 'EDIT_ASSESSMENT_CALENDAR') displayAction = 'Edit Assessment Cal.' as any;
                            if (rec.action === 'EDIT_EVENT_CALENDAR') displayAction = 'Edit Event Cal.' as any;
                            
                            return (
                            <tr key={rec.id} className="hover:bg-slate-50">
                                <td className="p-3 text-xs text-slate-500 font-mono">{new Date(rec.timestamp).toLocaleString()}</td>
                                <td className="p-3 font-bold text-slate-700">{rec.actorName}<div className="text-[10px] font-normal text-slate-400">{rec.actorRole}</div></td>
                                <td className="p-3"><span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-1 rounded border border-slate-200">{displayAction}</span></td>
                                <td className="p-3 text-slate-600">{rec.targetName || '-'}</td>
                                <td className="p-3 text-xs text-slate-500 max-w-xs truncate" title={rec.details}>{rec.details || '-'}</td>
                                {canManage && (
                                    <td className="p-3 text-right flex justify-end gap-1">
                                        <button onClick={() => onEditRecord(rec)} className="p-1 text-slate-400 hover:text-brand-600"><Edit2 size={14}/></button>
                                        <button onClick={() => onDeleteRecord(rec)} className="p-1 text-slate-400 hover:text-red-600"><Trash2 size={14}/></button>
                                    </td>
                                )}
                            </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default SystemLogs;

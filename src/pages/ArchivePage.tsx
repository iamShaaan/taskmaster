import React, { useEffect, useState } from 'react';
import { Archive, RotateCcw, Clock, Trash2, FolderKanban, Users, CheckSquare, Calendar, FileText, AlertTriangle } from 'lucide-react';
import { db, APP_ID } from '../firebase/config';
import { auth } from '../firebase/config';
import { collection, query, where, onSnapshot, Timestamp } from 'firebase/firestore';
import { restoreDocById, purgeDocById } from '../firebase/firestore';
import toast from 'react-hot-toast';

// ─── Types ────────────────────────────────────────────────────────────────────
interface ArchivedItem {
    id: string;
    title?: string;
    name?: string;
    deleted_at: Timestamp;
    deleted_from: string;
    [key: string]: unknown;
}

const COLLECTIONS = ['tasks', 'clients', 'projects', 'meetings', 'notes'] as const;

const ICON_MAP: Record<string, React.ReactNode> = {
    tasks: <CheckSquare size={14} className="text-indigo-400" />,
    clients: <Users size={14} className="text-emerald-400" />,
    projects: <FolderKanban size={14} className="text-purple-400" />,
    meetings: <Calendar size={14} className="text-amber-400" />,
    notes: <FileText size={14} className="text-pink-400" />,
};

const LABEL_MAP: Record<string, string> = {
    tasks: 'Task', clients: 'Client', projects: 'Project', meetings: 'Meeting', notes: 'Note',
};

const daysLeft = (deleted_at: Timestamp) => {
    const deletedMs = deleted_at.toDate().getTime();
    const expiresMs = deletedMs + 30 * 24 * 60 * 60 * 1000;
    const remaining = Math.ceil((expiresMs - Date.now()) / (1000 * 60 * 60 * 24));
    return Math.max(0, remaining);
};

const getLabel = (item: ArchivedItem) => item.title || item.name || item.id;

// ─── Archive Page ─────────────────────────────────────────────────────────────
export const ArchivePage: React.FC = () => {
    const [items, setItems] = useState<ArchivedItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<string>('all');
    const [restoring, setRestoring] = useState<string | null>(null);
    const [purging, setPurging] = useState<string | null>(null);

    const uid = auth.currentUser?.uid;
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    useEffect(() => {
        if (!uid) return;
        const unsubs: (() => void)[] = [];
        const allItems: Record<string, ArchivedItem[]> = {};

        COLLECTIONS.forEach(col => {
            const q = query(
                collection(db, `apps/${APP_ID}/${col}`),
                where('owner_id', '==', uid),
                where('deleted_at', '>', Timestamp.fromDate(thirtyDaysAgo))
            );
            const unsub = onSnapshot(q, snap => {
                allItems[col] = snap.docs.map(d => ({
                    id: d.id,
                    deleted_from: col,
                    ...d.data(),
                } as ArchivedItem));
                const merged = Object.values(allItems).flat()
                    .sort((a, b) => b.deleted_at.toDate().getTime() - a.deleted_at.toDate().getTime());
                setItems(merged);
                setLoading(false);
            });
            unsubs.push(unsub);
        });

        return () => unsubs.forEach(u => u());
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [uid]);

    const handleRestore = async (item: ArchivedItem) => {
        setRestoring(item.id);
        try {
            await restoreDocById(item.deleted_from, item.id);
            toast.success(`✅ "${getLabel(item)}" restored`);
        } catch {
            toast.error('Failed to restore');
        } finally {
            setRestoring(null);
        }
    };

    const handlePurge = async (item: ArchivedItem) => {
        if (!confirm(`Permanently delete "${getLabel(item)}"? This cannot be undone.`)) return;
        setPurging(item.id);
        try {
            await purgeDocById(item.deleted_from, item.id);
            toast.success('Permanently deleted');
        } catch {
            toast.error('Failed to delete');
        } finally {
            setPurging(null);
        }
    };

    const filtered = filter === 'all' ? items : items.filter(i => i.deleted_from === filter);

    return (
        <div className="space-y-6 max-w-3xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                    <Archive size={20} className="text-amber-400" />
                </div>
                <div>
                    <h1 className="text-white font-black text-xl">Archive</h1>
                    <p className="text-slate-500 text-xs">Items deleted in the last 30 days · auto-purge after expiry</p>
                </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex flex-wrap gap-2">
                {['all', ...COLLECTIONS].map(col => (
                    <button
                        key={col}
                        onClick={() => setFilter(col)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all capitalize ${filter === col
                                ? 'bg-indigo-500 text-white'
                                : 'bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700'
                            }`}
                    >
                        {col === 'all' ? `All (${items.length})` : `${LABEL_MAP[col]}s (${items.filter(i => i.deleted_from === col).length})`}
                    </button>
                ))}
            </div>

            {/* Items */}
            {loading ? (
                <div className="text-center py-16 text-slate-600 text-sm">Loading archive...</div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-20 border-2 border-dashed border-slate-800 rounded-2xl">
                    <Archive size={40} className="text-slate-700 mx-auto mb-3" />
                    <p className="text-slate-500 font-medium">Archive is empty</p>
                    <p className="text-slate-600 text-xs mt-1">Deleted items will appear here for 30 days</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {filtered.map(item => {
                        const days = daysLeft(item.deleted_at);
                        const urgent = days <= 3;
                        return (
                            <div
                                key={`${item.deleted_from}-${item.id}`}
                                className={`flex items-center gap-4 p-4 bg-slate-800/60 border rounded-xl transition-all ${urgent ? 'border-red-500/30' : 'border-slate-700/50'
                                    }`}
                            >
                                {/* Icon */}
                                <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-center flex-shrink-0">
                                    {ICON_MAP[item.deleted_from]}
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <p className="text-slate-200 text-sm font-bold truncate">{getLabel(item)}</p>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <span className="text-[10px] text-slate-500 capitalize font-medium bg-slate-900/60 px-1.5 py-0.5 rounded">
                                            {LABEL_MAP[item.deleted_from]}
                                        </span>
                                        <span className="text-slate-600 text-[10px]">·</span>
                                        <span className={`text-[10px] font-bold flex items-center gap-1 ${urgent ? 'text-red-400' : 'text-slate-500'}`}>
                                            {urgent && <AlertTriangle size={9} />}
                                            <Clock size={9} />
                                            {days === 0 ? 'Expires today' : `${days}d left`}
                                        </span>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    <button
                                        onClick={() => handleRestore(item)}
                                        disabled={!!restoring}
                                        title="Restore"
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-white rounded-lg text-xs font-bold transition-all disabled:opacity-40"
                                    >
                                        <RotateCcw size={12} className={restoring === item.id ? 'animate-spin' : ''} />
                                        Restore
                                    </button>
                                    <button
                                        onClick={() => handlePurge(item)}
                                        disabled={!!purging}
                                        title="Delete permanently"
                                        className="p-1.5 text-slate-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all disabled:opacity-40"
                                    >
                                        <Trash2 size={13} />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

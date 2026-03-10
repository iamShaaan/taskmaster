import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../hooks/useAuth';
import { format } from 'date-fns';
import {
    Plus, DollarSign, TrendingUp, TrendingDown, Wallet,
    Loader2, Trash2, ChevronDown, ChevronUp, CalendarDays, ReceiptText
} from 'lucide-react';
import { createDoc, deleteDocById, listenCollection, where, orderBy } from '../firebase/firestore';
import toast from 'react-hot-toast';
import type { FinanceEntry } from '../types';

// ─── Finance Category options ─────────────────────────────────────────────────
const EXPENSE_CATEGORIES = ['Food', 'Transport', 'Shopping', 'Health', 'Entertainment', 'Bills', 'Other'];
const INCOME_CATEGORIES = ['Salary', 'Freelance', 'Investment', 'Gift', 'Other'];

// ─── Helper: toDate ───────────────────────────────────────────────────────────
const toDate = (v: any): Date => {
    if (!v) return new Date();
    if (v instanceof Date) return v;
    if (typeof v?.toDate === 'function') return v.toDate();
    return new Date(v);
};

// ─── Format currency ──────────────────────────────────────────────────────────
const fmtMoney = (n: number) => `€${Math.abs(n).toFixed(2)}`;

// ─── Entry Row ────────────────────────────────────────────────────────────────
const EntryRow: React.FC<{ entry: FinanceEntry; onDelete: (id: string) => void }> = ({ entry, onDelete }) => (
    <motion.div
        layout
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/60 border border-slate-700/50 group"
    >
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
            entry.type === 'earned' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
        }`}>
            {entry.type === 'earned' ? <TrendingUp size={15} /> : <TrendingDown size={15} />}
        </div>
        <div className="flex-1 min-w-0">
            <p className="text-slate-200 text-sm font-semibold truncate">{entry.description}</p>
            <p className="text-slate-500 text-xs">{entry.category}</p>
        </div>
        <p className={`font-black text-sm tabular-nums ${entry.type === 'earned' ? 'text-emerald-400' : 'text-red-400'}`}>
            {entry.type === 'earned' ? '+' : '-'}{fmtMoney(entry.amount)}
        </p>
        <button
            onClick={() => onDelete(entry.id)}
            className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
            title="Delete"
        >
            <Trash2 size={13} />
        </button>
    </motion.div>
);

// ─── Monthly Summary Card ─────────────────────────────────────────────────────
const MonthCard: React.FC<{ month: string; entries: FinanceEntry[] }> = ({ month, entries }) => {
    const [open, setOpen] = useState(false);
    const spent = entries.filter(e => e.type === 'spent').reduce((s, e) => s + e.amount, 0);
    const earned = entries.filter(e => e.type === 'earned').reduce((s, e) => s + e.amount, 0);
    const net = earned - spent;

    return (
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl overflow-hidden">
            <button
                onClick={() => setOpen(o => !o)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-800/80 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-indigo-500/15 text-indigo-400">
                        <CalendarDays size={16} />
                    </div>
                    <div className="text-left">
                        <p className="text-slate-200 font-bold text-sm">{month}</p>
                        <p className="text-slate-500 text-xs">{entries.length} entries</p>
                    </div>
                </div>
                <div className="flex items-center gap-6">
                    <div className="text-right hidden sm:block">
                        <p className="text-emerald-400 text-xs font-semibold">+{fmtMoney(earned)}</p>
                        <p className="text-red-400 text-xs font-semibold">-{fmtMoney(spent)}</p>
                    </div>
                    <p className={`font-black text-base tabular-nums ${net >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {net >= 0 ? '+' : '-'}{fmtMoney(net)}
                    </p>
                    {open ? <ChevronUp size={16} className="text-slate-500" /> : <ChevronDown size={16} className="text-slate-500" />}
                </div>
            </button>
            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        <div className="border-t border-slate-700/50 p-4 space-y-2">
                            {entries.map(e => (
                                <div key={e.id} className="flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-2">
                                        <span className={`w-1.5 h-1.5 rounded-full ${e.type === 'earned' ? 'bg-emerald-400' : 'bg-red-400'}`} />
                                        <span className="text-slate-300">{e.description}</span>
                                        <span className="text-slate-600">· {e.category}</span>
                                    </div>
                                    <span className={`font-bold tabular-nums ${e.type === 'earned' ? 'text-emerald-400' : 'text-red-400'}`}>
                                        {e.type === 'earned' ? '+' : '-'}{fmtMoney(e.amount)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

// ─── Main Finance Page ────────────────────────────────────────────────────────
export const FinancePage: React.FC = () => {
    const { user } = useAuth();
    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');
    const displayDate = format(today, 'EEEE, MMMM do');

    const [activeTab, setActiveTab] = useState<'today' | 'history'>('today');
    const [entries, setEntries] = useState<FinanceEntry[]>([]);
    const [loadingEntries, setLoadingEntries] = useState(true);

    // Form state
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [type, setType] = useState<'spent' | 'earned'>('spent');
    const [category, setCategory] = useState('Food');
    const [isSaving, setIsSaving] = useState(false);

    // Real-time listener for finance entries
    useEffect(() => {
        if (!user) return;
        setLoadingEntries(true);
        const unsub = listenCollection(
            'finance_entries',
            (data) => {
                setEntries(
                    data
                        .filter(d => !d.deleted_at)
                        .map(d => ({
                            ...d,
                            created_at: toDate(d.created_at),
                        }) as FinanceEntry)
                        .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
                );
                setLoadingEntries(false);
            },
            where('owner_id', '==', user.uid),
            orderBy('created_at', 'desc')
        );
        return unsub;
    }, [user]);

    // Today's entries
    const todayEntries = useMemo(() =>
        entries.filter(e => e.date === todayStr),
        [entries, todayStr]
    );

    const todaySpent = useMemo(() =>
        todayEntries.filter(e => e.type === 'spent').reduce((s, e) => s + e.amount, 0),
        [todayEntries]
    );

    const todayEarned = useMemo(() =>
        todayEntries.filter(e => e.type === 'earned').reduce((s, e) => s + e.amount, 0),
        [todayEntries]
    );

    // Monthly groups for history
    const monthlyGroups = useMemo(() => {
        const groups: Record<string, FinanceEntry[]> = {};
        entries.forEach(e => {
            const key = format(e.created_at, 'MMMM yyyy');
            if (!groups[key]) groups[key] = [];
            groups[key].push(e);
        });
        return Object.entries(groups).sort(([a], [b]) => {
            const da = new Date(a); const db = new Date(b);
            return db.getTime() - da.getTime();
        });
    }, [entries]);

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !description.trim() || !amount) return;
        const amountVal = parseFloat(amount);
        if (isNaN(amountVal) || amountVal <= 0) { toast.error('Enter a valid amount'); return; }

        setIsSaving(true);
        try {
            await createDoc('finance_entries', {
                date: todayStr,
                description: description.trim(),
                amount: amountVal,
                type,
                category,
                owner_id: user.uid,
            });
            setDescription('');
            setAmount('');
            toast.success(`${type === 'spent' ? 'Expense' : 'Income'} added`);
        } catch {
            toast.error('Failed to add entry');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this entry?')) return;
        try {
            await deleteDocById('finance_entries', id);
            toast.success('Entry deleted');
        } catch {
            toast.error('Failed to delete');
        }
    };

    // Update available categories when type changes
    const categoryOptions = type === 'spent' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

    return (
        <div className="max-w-3xl mx-auto space-y-6 pb-10 animate-fade-in">
            {/* Header */}
            <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mt-2">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-black text-slate-100 tracking-tight flex items-center gap-3">
                        Daily Finance
                        <Wallet size={24} className="text-amber-400" />
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">{displayDate}</p>
                </div>
                <div className="flex gap-2">
                    {(['today', 'history'] as const).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-4 py-2 rounded-xl text-sm font-bold capitalize transition-all ${
                                activeTab === tab
                                    ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                                    : 'bg-slate-800/50 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-transparent'
                            }`}
                        >
                            {tab === 'today' ? 'Today' : 'Monthly History'}
                        </button>
                    ))}
                </div>
            </header>

            <AnimatePresence mode="wait">
                {activeTab === 'today' ? (
                    <motion.div
                        key="today"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                        className="space-y-5"
                    >
                        {/* Stat Cards */}
                        <div className="grid grid-cols-3 gap-3">
                            <div className="bg-slate-800/80 border border-slate-700/50 rounded-2xl p-4 relative overflow-hidden">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="p-2 rounded-lg bg-emerald-500/15 text-emerald-400"><TrendingUp size={15} /></div>
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Earned</span>
                                </div>
                                <p className="text-xl font-black text-emerald-400 tabular-nums">{fmtMoney(todayEarned)}</p>
                                <div className="absolute right-0 top-0 w-20 h-20 bg-emerald-500/5 blur-[30px] rounded-full pointer-events-none" />
                            </div>
                            <div className="bg-slate-800/80 border border-slate-700/50 rounded-2xl p-4 relative overflow-hidden">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="p-2 rounded-lg bg-red-500/15 text-red-400"><TrendingDown size={15} /></div>
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Spent</span>
                                </div>
                                <p className="text-xl font-black text-red-400 tabular-nums">{fmtMoney(todaySpent)}</p>
                                <div className="absolute right-0 top-0 w-20 h-20 bg-red-500/5 blur-[30px] rounded-full pointer-events-none" />
                            </div>
                            <div className="bg-slate-800/80 border border-slate-700/50 rounded-2xl p-4 relative overflow-hidden">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="p-2 rounded-lg bg-indigo-500/15 text-indigo-400"><DollarSign size={15} /></div>
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Net</span>
                                </div>
                                <p className={`text-xl font-black tabular-nums ${(todayEarned - todaySpent) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                    {(todayEarned - todaySpent) >= 0 ? '+' : '-'}{fmtMoney(todayEarned - todaySpent)}
                                </p>
                                <div className="absolute right-0 top-0 w-20 h-20 bg-indigo-500/5 blur-[30px] rounded-full pointer-events-none" />
                            </div>
                        </div>

                        {/* Add Entry Form */}
                        <form onSubmit={handleAdd} className="bg-slate-800/80 border border-amber-500/20 rounded-2xl p-5 space-y-4 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 blur-[50px] rounded-full pointer-events-none" />
                            <h3 className="text-amber-400 font-bold flex items-center gap-2 text-sm">
                                <Plus size={16} /> Add Entry
                            </h3>

                            {/* Type toggle */}
                            <div className="flex gap-2">
                                {(['spent', 'earned'] as const).map(t => (
                                    <button
                                        key={t}
                                        type="button"
                                        onClick={() => { setType(t); setCategory(t === 'spent' ? 'Food' : 'Salary'); }}
                                        className={`flex-1 py-2 rounded-xl text-sm font-bold capitalize transition-all ${
                                            type === t
                                                ? t === 'spent'
                                                    ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                                                    : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                                : 'bg-slate-900/60 text-slate-500 border border-slate-700 hover:border-slate-600'
                                        }`}
                                    >
                                        {t === 'spent' ? '💸 Spent' : '💰 Earned'}
                                    </button>
                                ))}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {/* Description */}
                                <input
                                    required
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                    placeholder="Description (e.g. Coffee)"
                                    className="bg-slate-900 border border-slate-700 text-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 transition-all placeholder:text-slate-600"
                                />

                                {/* Amount */}
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-bold">€</span>
                                    <input
                                        required
                                        type="number"
                                        min="0.01"
                                        step="0.01"
                                        value={amount}
                                        onChange={e => setAmount(e.target.value)}
                                        placeholder="0.00"
                                        className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded-xl pl-8 pr-4 py-2.5 text-sm focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 transition-all placeholder:text-slate-600 font-mono"
                                    />
                                </div>

                                {/* Category */}
                                <select
                                    value={category}
                                    onChange={e => setCategory(e.target.value)}
                                    className="sm:col-span-2 bg-slate-900 border border-slate-700 text-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500/50 appearance-none cursor-pointer"
                                >
                                    {categoryOptions.map(c => (
                                        <option key={c} value={c}>{c}</option>
                                    ))}
                                </select>
                            </div>

                            <button
                                type="submit"
                                disabled={isSaving || !description || !amount}
                                className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-slate-900 font-black rounded-xl transition-all flex items-center justify-center gap-2"
                            >
                                {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                                {isSaving ? 'Saving...' : `Add ${type === 'spent' ? 'Expense' : 'Income'}`}
                            </button>
                        </form>

                        {/* Today's Entry List */}
                        <div>
                            <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-2">
                                <ReceiptText size={13} /> Today's Entries ({todayEntries.length})
                            </h3>
                            {loadingEntries ? (
                                <div className="text-center py-8 text-slate-500 text-sm">Loading...</div>
                            ) : todayEntries.length === 0 ? (
                                <div className="text-center py-10 border-2 border-dashed border-slate-800 rounded-2xl text-slate-600 text-sm">
                                    No entries yet. Add your first transaction above.
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <AnimatePresence>
                                        {todayEntries.map(entry => (
                                            <EntryRow key={entry.id} entry={entry} onDelete={handleDelete} />
                                        ))}
                                    </AnimatePresence>
                                </div>
                            )}
                        </div>
                    </motion.div>
                ) : (
                    <motion.div
                        key="history"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                        className="space-y-4"
                    >
                        <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                            <CalendarDays size={13} /> Monthly Records
                        </h3>
                        {loadingEntries ? (
                            <div className="text-center py-10 text-slate-500 text-sm">Loading history...</div>
                        ) : monthlyGroups.length === 0 ? (
                            <div className="text-center py-16 border-2 border-dashed border-slate-800 rounded-2xl text-slate-600 text-sm">
                                No financial records yet.
                            </div>
                        ) : (
                            monthlyGroups.map(([month, monthEntries]) => (
                                <MonthCard key={month} month={month} entries={monthEntries} />
                            ))
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

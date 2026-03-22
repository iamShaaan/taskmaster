import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../hooks/useAuth';
import { useAppStore } from '../store';
import { format, addMonths, setDate as setDateFns } from 'date-fns';
import {
    Plus, DollarSign, TrendingUp, TrendingDown, Wallet,
    Loader2, Trash2, ChevronDown, ChevronUp, CalendarDays,
    ArrowRightLeft, Landmark, CreditCard, PieChart, Minus
} from 'lucide-react';
import { createDoc, deleteDocById, getDocById } from '../firebase/firestore';
import { formatCurrency, convertCurrency } from '../utils/currencyService';
import { generateInvoicePDF } from '../utils/pdfGenerator';
import toast from 'react-hot-toast';
import type { FinanceEntry, CurrencyCode, FinanceType, Invoice, InvoiceItem, UserProfile } from '../types';
import { FileText, Download, User, Briefcase, Sparkles } from 'lucide-react';

// ─── Constants ───────────────────────────────────────────────────────────────
const EXPENSE_CATEGORIES = ['Food', 'Transport', 'Shopping', 'Health', 'Entertainment', 'Bills', 'Other'];
const INCOME_CATEGORIES = ['Salary', 'Freelance', 'Investment', 'Gift', 'Other'];
const CURRENCIES: CurrencyCode[] = ['BDT', 'USD', 'EUR'];

// ─── Helper: toDate ───────────────────────────────────────────────────────────
const toDate = (v: any): Date => {
    if (!v) return new Date();
    if (v instanceof Date) return v;
    if (typeof v?.toDate === 'function') return v.toDate();
    return new Date(v);
};

// ─── Entry Row Component ──────────────────────────────────────────────────────
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
            <p className="text-slate-500 text-[10px] uppercase font-bold">{entry.category}</p>
        </div>
        <p className={`font-black text-sm tabular-nums ${entry.type === 'earned' ? 'text-emerald-400' : 'text-red-400'}`}>
            {entry.type === 'earned' ? '+' : '-'}{formatCurrency(entry.amount, entry.currency || 'EUR')}
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

// ─── Month Summary Card (History Tab) ──────────────────────────────────────────
const MonthCard: React.FC<{ month: string; entries: FinanceEntry[]; displayCurrency: CurrencyCode; rates: Record<string, number> | null }> = ({ month, entries, displayCurrency, rates }) => {
    const [open, setOpen] = useState(false);

    const totals = useMemo(() => {
        let earned = 0;
        let spent = 0;
        
        entries.forEach(e => {
            const amtInDisplay = rates ? convertCurrency(e.amount, e.currency || 'EUR', displayCurrency, rates) : e.amount;
            if (e.type === 'earned') earned += amtInDisplay;
            else spent += amtInDisplay;
        });

        return { earned, spent, net: earned - spent };
    }, [entries, displayCurrency, rates]);

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
                        <p className="text-emerald-400 text-[10px] font-bold">+{formatCurrency(totals.earned, displayCurrency)}</p>
                        <p className="text-red-400 text-[10px] font-bold">-{formatCurrency(totals.spent, displayCurrency)}</p>
                    </div>
                    <p className={`font-black text-sm tabular-nums ${totals.net >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {totals.net >= 0 ? '+' : '-'}{formatCurrency(totals.net, displayCurrency)}
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
                        className="overflow-hidden bg-slate-900/40"
                    >
                        <div className="p-4 space-y-2">
                            {entries.map(e => (
                                <div key={e.id} className="group flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-2">
                                        <span className={`w-1.5 h-1.5 rounded-full ${e.type === 'earned' ? 'bg-emerald-400' : 'bg-red-400'}`} />
                                        <span className="text-slate-300">{e.description}</span>
                                        <span className="text-slate-600 font-medium tracking-tight">({formatCurrency(e.amount, e.currency || 'EUR')})</span>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className={`font-bold tabular-nums ${e.type === 'earned' ? 'text-emerald-400' : 'text-red-400'}`}>
                                            {rates ? formatCurrency(convertCurrency(e.amount, e.currency || 'EUR', displayCurrency, rates), displayCurrency) : formatCurrency(e.amount, e.currency || 'EUR')}
                                        </span>
                                        <button 
                                            onClick={(ev) => { ev.stopPropagation(); deleteDocById('finance_entries', e.id); }}
                                            className="opacity-0 group-hover:opacity-100 p-1 text-slate-600 hover:text-red-400 transition-all"
                                            title="Delete Entry"
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

const InvoiceDetailsModal: React.FC<{ invoice: Invoice; profile: Partial<UserProfile>; onClose: () => void }> = ({ invoice, profile, onClose }) => {
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
            <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                exit={{ opacity: 0 }} 
                onClick={onClose}
                className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" 
            />
            <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative w-full max-w-2xl bg-slate-900 border border-slate-700/50 rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
                <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500" />
                
                <div className="p-8 overflow-y-auto custom-scrollbar">
                    <div className="flex justify-between items-start mb-10">
                        <div>
                            <h2 className="text-3xl font-black text-white tracking-tighter mb-1">INVOICE</h2>
                            <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">{invoice.invoice_number}</p>
                        </div>
                        <button onClick={onClose} className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-full transition-colors">
                            <Minus size={20} className="rotate-45" />
                        </button>
                    </div>

                    <div className="grid grid-cols-2 gap-12 mb-12">
                        <div className="space-y-4">
                            <div>
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Sender</p>
                                <p className="text-sm font-bold text-slate-100">{profile.companyName || 'TaskMaster'}</p>
                                <p className="text-[10px] text-slate-400">{profile.fullName || profile.displayName}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Recipient</p>
                                <p className="text-sm font-bold text-slate-100">{invoice.recipient_name}</p>
                                <p className="text-[10px] text-slate-400 capitalize">{invoice.type.replace('_', ' ')}</p>
                            </div>
                        </div>
                        <div className="text-right space-y-4">
                            <div>
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Date Issued</p>
                                <p className="text-sm font-bold text-slate-100">{format(new Date(invoice.date), 'dd MMMM yyyy')}</p>
                            </div>
                            {invoice.due_date && (
                                <div>
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Due Date</p>
                                    <p className="text-sm font-bold text-red-400">{format(new Date(invoice.due_date), 'dd MMMM yyyy')}</p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="bg-slate-800/30 rounded-3xl border border-slate-700/30 overflow-hidden mb-8">
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="border-b border-slate-700/50 bg-slate-800/50">
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Description</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Qty</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {invoice.items.map((item, i) => (
                                    <tr key={i} className="border-b border-white/5 last:border-0">
                                        <td className="px-6 py-4 font-bold text-slate-200">{item.description}</td>
                                        <td className="px-6 py-4 text-center font-mono text-slate-400">{item.quantity}</td>
                                        <td className="px-6 py-4 text-right font-black text-slate-100 tabular-nums">
                                            {formatCurrency(item.price * item.quantity, invoice.currency)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {invoice.note && (
                        <div className="mb-8 p-6 bg-slate-800/40 rounded-3xl border border-slate-700/30">
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                                <Sparkles size={12} className="text-indigo-400" /> AI Generated Note
                            </p>
                            <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{invoice.note}</p>
                        </div>
                    )}

                    <div className="flex flex-col items-end gap-2 mb-10">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Total Amount due</p>
                        <p className="text-4xl font-black text-indigo-400 tabular-nums tracking-tighter">
                            {formatCurrency(invoice.total_amount, invoice.currency)}
                        </p>
                    </div>

                    {profile.signatureURL && (
                        <div className="pt-8 border-t border-slate-800/50">
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Authorized Signature</p>
                            <img src={profile.signatureURL} alt="Signature" className="h-16 w-auto opacity-80 invert brightness-200 grayscale" />
                            <div className="w-48 h-px bg-slate-800 mt-2" />
                            <p className="text-[10px] font-bold text-slate-400 mt-2">{profile.fullName || profile.displayName}</p>
                        </div>
                    )}
                </div>

                <div className="p-8 bg-slate-800/50 border-t border-slate-700/50 flex gap-4">
                    <button 
                        onClick={() => generateInvoicePDF(invoice, profile)}
                        className="flex-1 flex items-center justify-center gap-3 bg-indigo-500 hover:bg-indigo-600 text-white font-black py-4 rounded-2xl transition-all shadow-xl shadow-indigo-500/20"
                    >
                        <Download size={20} /> DOWNLOAD PDF
                    </button>
                    <button onClick={onClose} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 font-black py-4 rounded-2xl transition-all">
                        CLOSE
                    </button>
                </div>
            </motion.div>
        </div>
    );
};

const CreateInvoiceTab: React.FC<{ profile: Partial<UserProfile> }> = ({ profile }) => {
    const { clients, tasks, projects } = useAppStore();
    const [isSaving, setIsSaving] = useState(false);

    // Form State
    const [type, setType] = useState<'client_bill' | 'team_payout'>('client_bill');
    const [recipientId, setRecipientId] = useState('');
    const [recipientName, setRecipientName] = useState('');
    const [currency, setCurrency] = useState<CurrencyCode>('BDT');
    const [items, setItems] = useState<InvoiceItem[]>([{ description: '', quantity: 1, price: 0 }]);
    const [dueDate, setDueDate] = useState('');
    const [linkedProjectId, setLinkedProjectId] = useState('');
    const [linkedTaskIds, setLinkedTaskIds] = useState<string[]>([]);
    const [note, setNote] = useState('');

    const subtotal = items.reduce((acc, item) => acc + (item.price * item.quantity), 0);

    const handleAddItem = () => setItems([...items, { description: '', quantity: 1, price: 0 }]);
    const handleRemoveItem = (index: number) => setItems(items.filter((_, i) => i !== index));
    const handleItemChange = (index: number, field: keyof InvoiceItem, value: any) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], [field]: value };
        setItems(newItems);
    };

    const handleGenerateNote = () => {
        if (!recipientName) {
            toast.error('Please select a recipient first');
            return;
        }

        let aiNote = `Invoice for services rendered to ${recipientName}.`;
        
        const proj = projects.find(p => p.id === linkedProjectId);
        if (proj) {
            aiNote += `\n\nProject: ${proj.name}`;
        }

        if (linkedTaskIds.length > 0) {
            aiNote += `\n\nCompleted Details:`;
            linkedTaskIds.forEach(tId => {
                const t = tasks.find(ta => ta.id === tId);
                if (t) aiNote += `\n- ${t.title}`;
            });
        }
        
        aiNote += `\n\nThank you for your business!\nBest regards,\n${profile.fullName || profile.displayName || 'TaskMaster'}`;

        setNote(aiNote);
        toast.success('AI Note Generated!');
    };

    const toggleTask = (taskId: string) => {
        setLinkedTaskIds(prev => 
            prev.includes(taskId) ? prev.filter(id => id !== taskId) : [...prev, taskId]
        );
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!recipientName.trim() || items.some(i => !i.description.trim())) {
            toast.error('Please fill required fields');
            return;
        }

        setIsSaving(true);
        try {
            const invoiceNum = `INV-${Date.now().toString().slice(-6)}`;
            const newInvoice: Partial<Invoice> = {
                invoice_number: invoiceNum,
                date: format(new Date(), 'yyyy-MM-dd'),
                due_date: dueDate || undefined,
                type,
                sender_id: profile.uid || '',
                recipient_id: recipientId,
                recipient_name: recipientName,
                items,
                currency,
                status: 'sent',
                linked_project_id: linkedProjectId || undefined,
                linked_task_ids: linkedTaskIds,
                note: note || undefined,
                owner_id: profile.uid || '',
                total_amount: subtotal,
                created_at: new Date()
            };

            await createDoc('invoices', newInvoice);
            toast.success('Invoice created');
            setItems([{ description: '', quantity: 1, price: 0 }]);
            setRecipientId('');
            setRecipientName('');
            setLinkedProjectId('');
            setLinkedTaskIds([]);
            setNote('');
        } catch (err) {
            toast.error('Failed to create invoice');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h3 className="text-slate-400 text-xs font-black uppercase tracking-widest pl-1">Create New Invoice</h3>
            </div>

            <form onSubmit={handleSubmit} className="bg-slate-800/50 border border-slate-700/50 rounded-3xl p-6 space-y-5 relative">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-500" />
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Invoice Type</label>
                                    <div className="flex bg-slate-900/50 p-1 rounded-xl border border-slate-700/50">
                                        <button
                                            type="button"
                                            onClick={() => setType('client_bill')}
                                            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${type === 'client_bill' ? 'bg-indigo-500 text-white' : 'text-slate-500'}`}
                                        >
                                            <Briefcase size={12} /> Client Bill
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setType('team_payout')}
                                            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${type === 'team_payout' ? 'bg-indigo-500 text-white' : 'text-slate-500'}`}
                                        >
                                            <User size={12} /> Team Payout
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Recipient</label>
                                    {type === 'client_bill' ? (
                                        <select
                                            value={recipientId}
                                            onChange={(e) => {
                                                const c = clients.find(cl => cl.id === e.target.value);
                                                setRecipientId(e.target.value);
                                                setRecipientName(c ? c.name : '');
                                            }}
                                            className="w-full bg-slate-900/80 border border-slate-700/50 rounded-xl px-4 py-2.5 text-sm text-slate-200 outline-none focus:border-indigo-500/50"
                                        >
                                            <option value="">Select Client</option>
                                            {clients.map(c => <option key={c.id} value={c.id}>{c.name} ({c.company})</option>)}
                                        </select>
                                    ) : (
                                        <input
                                            required
                                            value={recipientName}
                                            onChange={e => setRecipientName(e.target.value)}
                                            placeholder="Recipient Name"
                                            className="w-full bg-slate-900/80 border border-slate-700/50 rounded-xl px-4 py-2.5 text-sm text-slate-200 outline-none focus:border-indigo-500/50"
                                        />
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Currency</label>
                                    <select
                                        value={currency}
                                        onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
                                        className="w-full bg-slate-900/80 border border-slate-700/50 rounded-xl px-4 py-2.5 text-sm text-slate-200 outline-none focus:border-indigo-500/50"
                                    >
                                        {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Project (Optional)</label>
                                    <select
                                        value={linkedProjectId}
                                        onChange={e => {
                                            setLinkedProjectId(e.target.value);
                                            setLinkedTaskIds([]); // Reset tasks when project changes
                                        }}
                                        className="w-full bg-slate-900/80 border border-slate-700/50 rounded-xl px-4 py-2.5 text-sm text-slate-200 outline-none focus:border-indigo-500/50"
                                    >
                                        <option value="">Select Project</option>
                                        {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Due Date (Optional)</label>
                                    <input
                                        type="date"
                                        value={dueDate}
                                        onChange={e => setDueDate(e.target.value)}
                                        className="w-full bg-slate-900/80 border border-slate-700/50 rounded-xl px-4 py-2.5 text-sm text-slate-200 outline-none focus:border-indigo-500/50"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Linked Tasks (Optional)</label>
                                <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-3 max-h-32 overflow-y-auto custom-scrollbar flex flex-col gap-2">
                                    {tasks.filter(t => t.status !== 'done' && (!linkedProjectId || t.project_id === linkedProjectId)).length === 0 ? (
                                        <p className="text-xs text-slate-500 italic px-2 py-1">No pending tasks found.</p>
                                    ) : (
                                        tasks.filter(t => t.status !== 'done' && (!linkedProjectId || t.project_id === linkedProjectId)).map(t => (
                                            <label key={t.id} className="flex items-center gap-3 p-2 hover:bg-slate-800/80 rounded-lg cursor-pointer transition-colors border border-transparent hover:border-slate-700/50">
                                                <input 
                                                    type="checkbox" 
                                                    checked={linkedTaskIds.includes(t.id)}
                                                    onChange={() => toggleTask(t.id)}
                                                    className="w-4 h-4 rounded border-slate-600 text-indigo-500 focus:ring-indigo-500/30 bg-slate-900" 
                                                />
                                                <span className="text-sm text-slate-300 truncate">{t.title}</span>
                                            </label>
                                        ))
                                    )}
                                </div>
                            </div>

                            <div className="space-y-2 relative">
                                <div className="flex items-center justify-between">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Invoice Note</label>
                                    <button
                                        type="button"
                                        onClick={handleGenerateNote}
                                        className="text-[10px] font-black text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1 uppercase tracking-widest"
                                    >
                                        <Sparkles size={12} /> Auto-Generate
                                    </button>
                                </div>
                                <textarea
                                    value={note}
                                    onChange={e => setNote(e.target.value)}
                                    placeholder="Thank you for your business..."
                                    rows={4}
                                    className="w-full bg-slate-900/80 border border-slate-700/50 rounded-xl px-4 py-3 text-sm text-slate-200 outline-none focus:border-indigo-500/50 custom-scrollbar resize-none"
                                />
                            </div>

                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Items</label>
                                {items.map((item, index) => (
                                    <div key={index} className="grid grid-cols-1 sm:grid-cols-6 gap-2">
                                        <input
                                            required
                                            value={item.description}
                                            onChange={e => handleItemChange(index, 'description', e.target.value)}
                                            placeholder="Description"
                                            className="sm:col-span-3 bg-slate-900/80 border border-slate-700/50 rounded-xl px-4 py-2 text-sm text-slate-200 outline-none focus:border-indigo-500/50"
                                        />
                                        <input
                                            required
                                            type="number"
                                            value={item.quantity}
                                            onChange={e => handleItemChange(index, 'quantity', parseInt(e.target.value) || 0)}
                                            className="bg-slate-900/80 border border-slate-700/50 rounded-xl px-3 py-2 text-sm text-center font-mono text-slate-200 outline-none"
                                        />
                                        <input
                                            required
                                            type="number"
                                            value={item.price}
                                            onChange={e => handleItemChange(index, 'price', parseFloat(e.target.value) || 0)}
                                            className="bg-slate-900/80 border border-slate-700/50 rounded-xl px-3 py-2 text-sm text-center font-mono text-slate-200 outline-none"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveItem(index)}
                                            disabled={items.length === 1}
                                            className="p-2 text-slate-600 hover:text-red-400 disabled:opacity-30 transition-colors"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ))}
                                <button
                                    type="button"
                                    onClick={handleAddItem}
                                    className="text-[10px] font-black text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1 uppercase tracking-widest"
                                >
                                    <Plus size={12} /> Add Item
                                </button>
                            </div>

                            <div className="pt-4 border-t border-slate-700/50 flex flex-col sm:flex-row items-center justify-between gap-4">
                                <div className="text-right sm:text-left">
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Total Amount</p>
                                    <p className="text-2xl font-black text-indigo-400 tabular-nums">{formatCurrency(subtotal, currency)}</p>
                                </div>
                                <button
                                    disabled={isSaving}
                                    className="w-full sm:w-auto px-10 py-4 bg-indigo-500 hover:bg-indigo-600 text-white font-black rounded-2xl transition-all shadow-xl shadow-indigo-500/30 flex items-center justify-center gap-2"
                                >
                                    {isSaving ? <Loader2 size={18} className="animate-spin" /> : 'GENERATE INVOICE'}
                                </button>
                            </div>
            </form>
        </div>
    );
};

const InvoicesListTab: React.FC<{ profile: Partial<UserProfile> }> = ({ profile }) => {
    const { invoices } = useAppStore();
    const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

    return (
        <div className="space-y-6">
            <div className="space-y-3">
                {invoices.length === 0 ? (
                    <div className="bg-slate-800/20 border-2 border-dashed border-slate-800 rounded-3xl p-12 text-center text-slate-600 italic text-sm">
                        No invoices generated yet.
                    </div>
                ) : (
                    invoices.map(inv => (
                        <div key={inv.id} className="bg-slate-800/60 border border-slate-700/50 rounded-3xl p-5 flex flex-wrap sm:flex-nowrap justify-between items-center gap-4 group hover:border-indigo-500/30 transition-all cursor-pointer" onClick={() => setSelectedInvoice(inv)}>
                            <div className="flex items-center gap-4">
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border ${inv.type === 'client_bill' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                                    <FileText size={20} />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <p className="font-bold text-slate-100">{inv.invoice_number}</p>
                                        <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${inv.type === 'client_bill' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                                            {inv.type === 'client_bill' ? 'Bill' : 'Payout'}
                                        </span>
                                    </div>
                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">{inv.recipient_name} • {format(new Date(inv.date), 'dd MMM yyyy')}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-6 w-full sm:w-auto justify-between sm:justify-end">
                                <div className="text-right">
                                    <p className="text-slate-100 font-black tabular-nums">{formatCurrency(inv.total_amount, inv.currency)}</p>
                                    <p className={`text-[10px] font-black uppercase tracking-widest ${inv.status === 'paid' ? 'text-emerald-400' : 'text-amber-400'}`}>{inv.status}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); generateInvoicePDF(inv, profile); }}
                                        className="p-2.5 bg-slate-900 hover:bg-slate-700 text-indigo-400 rounded-xl transition-all"
                                        title="Download PDF"
                                    >
                                        <Download size={16} />
                                    </button>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); deleteDocById('invoices', inv.id); }} 
                                        className="opacity-0 group-hover:opacity-100 p-2.5 bg-slate-900 hover:bg-red-500/20 text-slate-600 hover:text-red-400 rounded-xl transition-all"
                                        title="Delete"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <AnimatePresence>
                {selectedInvoice && (
                    <InvoiceDetailsModal 
                        invoice={selectedInvoice} 
                        profile={profile} 
                        onClose={() => setSelectedInvoice(null)} 
                    />
                )}
            </AnimatePresence>
        </div>
    );
};
export interface FinancePageProps {
    viewMode?: 'dashboard' | 'history';
}

export const FinancePage: React.FC<FinancePageProps> = ({ viewMode = 'dashboard' }) => {
    const { user } = useAuth();
    const { exchangeRates, savings, emis, financeEntries: entries, invoices } = useAppStore();
    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');

    const [activeTab, setActiveTab] = useState<'today' | 'invoices' | 'new_invoice' | 'history' | 'savings' | 'emis'>(viewMode === 'history' ? 'history' : 'today');
    const [displayCurrency, setDisplayCurrency] = useState<CurrencyCode>('BDT');
    const [userProfile, setUserProfile] = useState<Partial<UserProfile>>({});

    // Load Profile for signature/company name
    useEffect(() => {
        if (user) {
            getDocById('users', user.uid).then(p => {
                if (p) setUserProfile(p as Partial<UserProfile>);
            });
        }
    }, [user]);
    


    const handleClearAll = async () => {
        if (!window.confirm('Are you sure you want to clear ALL finance data? This includes transactions, invoices, savings, and EMIs.')) return;
        
        setIsSaving(true);
        try {
            const promises = [
                ...entries.map(e => deleteDocById('finance_entries', e.id)),
                ...invoices.map(i => deleteDocById('invoices', i.id)),
                ...savings.map(s => deleteDocById('savings', s.id)),
                ...emis.map(e => deleteDocById('emis', e.id))
            ];
            await Promise.all(promises);
            toast.success('All finance data cleared');
        } catch (err) {
            toast.error('Failed to clear some data');
        } finally {
            setIsSaving(false);
        }
    };

    const handleClearToday = async () => {
        if (!window.confirm(`Clear all ${todayEntries.length} entr${todayEntries.length === 1 ? 'y' : 'ies'} from today?`)) return;
        try {
            await Promise.all(todayEntries.map(e => deleteDocById('finance_entries', e.id)));
            toast.success('Today\'s entries cleared');
        } catch {
            toast.error('Failed to clear today\'s entries');
        }
    };

    const handleClearHistory = async () => {
        if (!window.confirm('Delete ALL finance transaction history? This cannot be undone.')) return;
        try {
            await Promise.all(entries.map(e => deleteDocById('finance_entries', e.id)));
            toast.success('History cleared');
        } catch {
            toast.error('Failed to clear history');
        }
    };
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [type, setType] = useState<FinanceType>('spent');
    const [category, setCategory] = useState('Food');
    const [entryCurrency, setEntryCurrency] = useState<CurrencyCode>('BDT');
    const [isSaving, setIsSaving] = useState(false);

    // Savings Form State
    const [savTitle, setSavTitle] = useState('');
    const [savAmount, setSavAmount] = useState('');
    const [savInstitution, setSavInstitution] = useState('');
    const [savType] = useState<'savings' | 'investment'>('savings');
    const [savCurrency, setSavCurrency] = useState<CurrencyCode>('BDT');

    // Subscription Form State
    const [emiTitle, setEmiTitle] = useState('');
    const [emiAmount, setEmiAmount] = useState('');
    const [emiBillingCycle, setEmiBillingCycle] = useState<'1_month' | '3_months' | '1_year'>('1_month');
    const [emiPaymentMethod, setEmiPaymentMethod] = useState('');
    const [emiNextDate, setEmiNextDate] = useState('');
    const [emiCurrency, setEmiCurrency] = useState<CurrencyCode>('BDT');

    // Real-time listener removed - now handled globally in App.tsx

    // Data Filtering & Calculations
    const todayEntries = useMemo(() => entries.filter(e => e.date === todayStr), [entries, todayStr]);

    const todayStats = useMemo(() => {
        let earned = 0;
        let spent = 0;
        todayEntries.forEach(e => {
            const amtConverted = exchangeRates ? convertCurrency(e.amount, e.currency || 'EUR', displayCurrency, exchangeRates) : e.amount;
            if (e.type === 'earned') earned += amtConverted;
            else spent += amtConverted;
        });
        return { earned, spent, net: earned - spent };
    }, [todayEntries, displayCurrency, exchangeRates]);

    const monthlyGroups = useMemo(() => {
        const groups: Record<string, FinanceEntry[]> = {};
        entries.forEach(e => {
            const date = toDate(e.created_at);
            const key = format(date, 'MMMM yyyy');
            if (!groups[key]) groups[key] = [];
            groups[key].push(e);
        });
        return Object.entries(groups).sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime());
    }, [entries]);

    const savingsTotal = useMemo(() => {
        return savings.reduce((acc, s) => acc + (exchangeRates ? convertCurrency(s.amount, s.currency || 'EUR', displayCurrency, exchangeRates) : s.amount), 0);
    }, [savings, displayCurrency, exchangeRates]);

    const emiMonthlyTotal = useMemo(() => {
        return emis.reduce((acc, e) => {
            let equivalentMonthly = 0;
            const rawAmount = e.amount || e.monthly_amount || 0;
            if (e.billing_cycle === '3_months') equivalentMonthly = rawAmount / 3;
            else if (e.billing_cycle === '1_year') equivalentMonthly = rawAmount / 12;
            else equivalentMonthly = rawAmount;

            return acc + (exchangeRates ? convertCurrency(equivalentMonthly, e.currency || 'EUR', displayCurrency, exchangeRates) : equivalentMonthly);
        }, 0);
    }, [emis, displayCurrency, exchangeRates]);

    // Monthly Calculation for Breakdown
    const monthlyStats = useMemo(() => {
        const currentMonth = today.getMonth();
        const currentYear = today.getFullYear();
        
        const monthEntries = entries.filter(e => {
            const date = toDate(e.created_at);
            return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
        });

        let earned = 0;
        let spent = 0;
        const dailyMap: Record<string, { earned: number, spent: number }> = {};

        monthEntries.forEach(e => {
            const dateKey = format(toDate(e.created_at), 'yyyy-MM-dd');
            const amtConverted = exchangeRates ? convertCurrency(e.amount, e.currency || 'EUR', displayCurrency, exchangeRates) : e.amount;
            
            if (!dailyMap[dateKey]) dailyMap[dateKey] = { earned: 0, spent: 0 };
            
            if (e.type === 'earned') {
                earned += amtConverted;
                dailyMap[dateKey].earned += amtConverted;
            } else {
                spent += amtConverted;
                dailyMap[dateKey].spent += amtConverted;
            }
        });

        const dailyBreakdown = Object.entries(dailyMap)
            .sort(([a], [b]) => b.localeCompare(a))
            .map(([date, vals]) => ({ date, ...vals }));

        return { earned, spent, dailyBreakdown };
    }, [entries, displayCurrency, exchangeRates]);

    // Handlers
    const handleAddEntry = async (e: React.FormEvent) => {
        e.preventDefault();
        const amtVal = parseFloat(amount);
        if (!user || !description.trim() || isNaN(amtVal)) return;

        setIsSaving(true);
        try {
            await createDoc('finance_entries', {
                date: todayStr,
                description: description.trim(),
                amount: amtVal,
                currency: entryCurrency,
                type,
                category,
                owner_id: user.uid,
            });
            setDescription(''); setAmount('');
            toast.success('Entry added');
        } catch { toast.error('Failed to add entry'); }
        finally { setIsSaving(false); }
    };

    const handleAddSaving = async (e: React.FormEvent) => {
        e.preventDefault();
        const amtVal = parseFloat(savAmount);
        if (!user || !savTitle.trim() || isNaN(amtVal)) return;

        setIsSaving(true);
        try {
            await createDoc('savings', {
                title: savTitle.trim(),
                amount: amtVal,
                currency: savCurrency,
                institution: savInstitution.trim(),
                type: savType,
                date: todayStr,
                owner_id: user.uid,
            });
            setSavTitle(''); setSavAmount(''); setSavInstitution('');
            toast.success('Saving added');
        } catch { toast.error('Failed to add saving'); }
        finally { setIsSaving(false); }
    };

    const handleAddEMI = async (e: React.FormEvent) => {
        e.preventDefault();
        const amt = parseFloat(emiAmount);
        if (!user || !emiTitle.trim() || isNaN(amt) || !emiNextDate) return;

        setIsSaving(true);
        try {
            await createDoc('emis', {
                title: emiTitle.trim(),
                amount: amt,
                currency: emiCurrency,
                billing_cycle: emiBillingCycle,
                payment_method: emiPaymentMethod.trim(),
                next_billing_date: emiNextDate,
                start_date: todayStr,
                owner_id: user.uid,
            });
            setEmiTitle(''); setEmiAmount(''); setEmiPaymentMethod(''); setEmiNextDate('');
            toast.success('Subscription added');
        } catch { toast.error('Failed to add Subscription'); }
        finally { setIsSaving(false); }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6 pb-20 animate-fade-in px-4">
            {/* Header with Currency Selector */}
            <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 py-4">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
                        <Wallet size={24} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-slate-100 tracking-tight">Finance</h1>
                        <p className="text-slate-500 text-xs font-bold uppercase tracking-widest flex items-center gap-2 mt-1">
                            <Landmark size={12} className="text-indigo-400" /> Smart Management System
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 p-1 bg-slate-800/60 rounded-xl border border-slate-700/50">
                    {CURRENCIES.map(c => (
                        <button
                            key={c}
                            onClick={() => setDisplayCurrency(c)}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-black tracking-widest transition-all ${
                                displayCurrency === c
                                    ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/30'
                                    : 'text-slate-500 hover:text-slate-300'
                            }`}
                        >
                            {c}
                        </button>
                    ))}
                    <div className="w-px h-4 bg-slate-700 mx-1" />
                    <button className="p-1.5 text-slate-400 hover:text-amber-400" title="Daily Exchange Rates">
                        <ArrowRightLeft size={14} />
                    </button>
                    <button 
                        onClick={handleClearAll}
                        className="p-1.5 text-slate-500 hover:text-red-400 transition-colors" 
                        title="Clear All Finance Data"
                    >
                        <Trash2 size={14} />
                    </button>
                </div>
            </header>

            {/* Main Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {(viewMode === 'history' 
                    ? (['history', 'invoices'] as const)
                    : (['today', 'new_invoice', 'savings', 'emis'] as const)
                ).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`flex-shrink-0 px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${
                            activeTab === tab
                                ? 'bg-indigo-500/15 text-indigo-400 border-2 border-indigo-500/30 ring-4 ring-indigo-500/5'
                                : 'bg-slate-800/40 text-slate-500 border-2 border-transparent hover:bg-slate-800 hover:text-slate-300'
                        }`}
                    >
                        {tab === 'emis' ? 'Subscriptions' : tab === 'new_invoice' ? 'New Invoice' : tab}
                    </button>
                ))}
            </div>

            <AnimatePresence mode="wait">
                {activeTab === 'today' && (
                    <motion.div key="today" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
                        {/* Summary Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            {[
                                { label: 'Earned', val: todayStats.earned, icon: TrendingUp, color: 'emerald', bg: 'emerald-500/10' },
                                { label: 'Spent', val: todayStats.spent, icon: TrendingDown, color: 'red', bg: 'red-500/10' },
                                { label: 'Net Change', val: todayStats.net, icon: DollarSign, color: todayStats.net >= 0 ? 'emerald' : 'red', bg: 'indigo-500/10' }
                            ].map(card => (
                                <div key={card.label} className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-4 overflow-hidden relative">
                                    <div className="flex justify-between items-start mb-3">
                                        <div className={`p-2 rounded-xl bg-${card.color}-500/15 text-${card.color}-400`}>
                                            <card.icon size={16} />
                                        </div>
                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{card.label}</span>
                                    </div>
                                    <p className={`text-2xl font-black tabular-nums transition-colors duration-500 text-${card.color}-400`}>
                                        {card.val >= 0 ? '+' : ''}{formatCurrency(card.val, displayCurrency)}
                                    </p>
                                    <div className={`absolute right-0 bottom-0 w-16 h-16 bg-${card.color}-500/5 blur-2xl rounded-full`} />
                                </div>
                            ))}
                        </div>

                        {/* Add Form */}
                        <div className="bg-slate-800/50 border border-slate-700/50 rounded-3xl p-6 relative overflow-hidden ring-1 ring-white/5 shadow-2xl">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500/50 to-orange-500/50" />
                            <form onSubmit={handleAddEntry} className="space-y-5">
                                <div className="flex items-center justify-between">
                                    <label className="text-amber-400 text-xs font-black uppercase tracking-widest">Add Daily Record</label>
                                    <div className="flex bg-slate-900/50 p-1 rounded-xl">
                                        {(['spent', 'earned'] as const).map(t => (
                                            <button
                                                key={t}
                                                type="button"
                                                onClick={() => setType(t)}
                                                className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                                                    type === t ? 'bg-slate-700 text-white' : 'text-slate-500'
                                                }`}
                                            >
                                                {t}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                                    <div className="sm:col-span-2">
                                        <input
                                            required
                                            value={description}
                                            onChange={e => setDescription(e.target.value)}
                                            placeholder="What for?"
                                            className="w-full bg-slate-900/80 border border-slate-700/50 rounded-xl px-4 py-3 text-sm focus:border-amber-500/40 focus:ring-4 focus:ring-amber-500/5 outline-none transition-all placeholder:text-slate-600 text-slate-100 font-medium"
                                        />
                                    </div>
                                    <div className="relative group">
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-1 items-center bg-slate-800 px-2 py-1 rounded-lg border border-slate-700 group-focus-within:border-amber-500/30 transition-all">
                                            <select 
                                                value={entryCurrency} 
                                                onChange={e => setEntryCurrency(e.target.value as CurrencyCode)}
                                                className="bg-transparent border-none outline-none text-[10px] font-black text-amber-400 cursor-pointer appearance-none"
                                            >
                                                {CURRENCIES.map(c => <option key={c} value={c} className="bg-slate-900">{c}</option>)}
                                            </select>
                                        </div>
                                        <input
                                            required
                                            type="number"
                                            step="0.01"
                                            value={amount}
                                            onChange={e => setAmount(e.target.value)}
                                            placeholder="0.00"
                                            className="w-full bg-slate-900/80 border border-slate-700/50 rounded-xl pl-4 pr-16 py-3 text-sm font-mono focus:border-amber-500/40 focus:ring-4 focus:ring-amber-500/5 outline-none transition-all text-slate-100"
                                        />
                                    </div>
                                    <select
                                        value={category}
                                        onChange={e => setCategory(e.target.value)}
                                        className="bg-slate-900/80 border border-slate-700/50 rounded-xl px-4 py-3 text-sm text-slate-400 outline-none focus:border-amber-500/40"
                                    >
                                        {(type === 'spent' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES).map(c => (
                                            <option key={c} value={c}>{c}</option>
                                        ))}
                                    </select>
                                </div>
                                <button
                                    disabled={isSaving}
                                    className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-600 text-slate-900 font-black rounded-2xl hover:scale-[1.01] active:scale-[0.99] transition-all shadow-xl shadow-amber-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                                    CONFIRM TRANSACTION
                                </button>
                            </form>
                        </div>

                        {/* List & Monthly Breakdown */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <div className="lg:col-span-2 space-y-3">
                                <div className="flex items-center justify-between pl-1">
                                    <h3 className="text-slate-400 text-xs font-black uppercase tracking-widest">Today's Transactions</h3>
                                    {todayEntries.length > 0 && (
                                        <button
                                            onClick={handleClearToday}
                                            className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-red-400 transition-colors"
                                        >
                                            <Trash2 size={11} /> Clear Today
                                        </button>
                                    )}
                                </div>
                                {todayEntries.length === 0 ? (
                                    <div className="bg-slate-800/20 border-2 border-dashed border-slate-800 rounded-3xl p-12 text-center text-slate-600 italic text-sm">
                                        No entries recorded for today.
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <AnimatePresence mode="popLayout">
                                            {todayEntries.map(e => <EntryRow key={e.id} entry={e} onDelete={(id) => deleteDocById('finance_entries', id)} />)}
                                        </AnimatePresence>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-4">
                                <div className="bg-slate-800/40 border border-slate-700/50 rounded-3xl p-5 space-y-4">
                                    <h3 className="text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-slate-700/50 pb-2">
                                        {format(today, 'MMMM')} Summary
                                    </h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-[10px] text-slate-500 font-bold uppercase">Income</p>
                                            <p className="text-lg font-black text-emerald-400 tabular-nums">{formatCurrency(monthlyStats.earned, displayCurrency)}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-slate-500 font-bold uppercase">Spending</p>
                                            <p className="text-lg font-black text-red-400 tabular-nums">{formatCurrency(monthlyStats.spent, displayCurrency)}</p>
                                        </div>
                                    </div>
                                    
                                    <div className="space-y-2 pt-2">
                                        <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Daily Breakdown</p>
                                        <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                            {monthlyStats.dailyBreakdown.map(day => (
                                                <div key={day.date} className="flex items-center justify-between p-2 rounded-xl bg-slate-900/50 border border-white/5">
                                                    <span className="text-[10px] font-bold text-slate-400">{format(new Date(day.date), 'dd MMM')}</span>
                                                    <div className="flex gap-3">
                                                        {day.earned > 0 && <span className="text-[10px] font-black text-emerald-400 tabular-nums">+{formatCurrency(day.earned, displayCurrency)}</span>}
                                                        {day.spent > 0 && <span className="text-[10px] font-black text-red-400 tabular-nums">-{formatCurrency(day.spent, displayCurrency)}</span>}
                                                    </div>
                                                </div>
                                            ))}
                                            {monthlyStats.dailyBreakdown.length === 0 && (
                                                <p className="text-center text-[10px] text-slate-600 py-4 italic">No activity this month</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}

                {activeTab === 'invoices' && (
                    <motion.div key="invoices" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                        <InvoicesListTab profile={userProfile} />
                    </motion.div>
                )}

                {activeTab === 'new_invoice' && (
                    <motion.div key="new_invoice" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                        <CreateInvoiceTab profile={userProfile} />
                    </motion.div>
                )}

                {activeTab === 'savings' && (
                    <motion.div key="savings" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
                        <div className="bg-gradient-to-br from-emerald-500/20 to-teal-500/5 border border-emerald-500/20 rounded-3xl p-6 relative overflow-hidden">
                            <div className="flex justify-between items-center mb-4">
                                <Landmark className="text-emerald-400" size={32} />
                                <div className="text-right">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500/60">Total Savings & Assets</p>
                                    <p className="text-3xl font-black text-emerald-400 tabular-nums">{formatCurrency(savingsTotal, displayCurrency)}</p>
                                </div>
                            </div>
                            <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-emerald-500/10 blur-[80px] rounded-full" />
                        </div>

                        <form onSubmit={handleAddSaving} className="grid grid-cols-1 sm:grid-cols-5 gap-3 bg-slate-800/40 p-4 rounded-3xl border border-slate-700/50">
                            <input required value={savTitle} onChange={e => setSavTitle(e.target.value)} placeholder="Asset Name" className="sm:col-span-2 bg-slate-900 border border-slate-700/50 rounded-xl px-4 py-2 text-sm text-slate-200 outline-none focus:border-emerald-500/50" />
                            <input required type="number" step="0.01" value={savAmount} onChange={e => setSavAmount(e.target.value)} placeholder="Value" className="bg-slate-900 border border-slate-700/50 rounded-xl px-4 py-2 text-sm font-mono text-slate-200 outline-none focus:border-emerald-500/50" />
                            <select value={savCurrency} onChange={e => setSavCurrency(e.target.value as CurrencyCode)} className="bg-slate-900 border border-slate-700/50 rounded-xl px-4 py-2 text-[10px] font-black uppercase text-slate-400 outline-none">
                                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                            <button className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black rounded-xl text-xs transition-all shadow-lg shadow-emerald-500/20">ADD ASSET</button>
                        </form>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {savings.map(s => (
                                <div key={s.id} className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-4 flex justify-between items-center group">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-xl bg-slate-700/50 text-indigo-400">
                                            {s.type === 'savings' ? <Landmark size={16} /> : <PieChart size={16} />}
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-slate-100">{s.title}</p>
                                            <p className="text-[10px] text-slate-500 uppercase tracking-widest">{s.institution || 'N/A'}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <p className="text-emerald-400 font-bold tabular-nums text-sm">{formatCurrency(s.amount, s.currency || 'EUR')}</p>
                                        <button onClick={() => deleteDocById('savings', s.id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-600 hover:text-red-400 p-1"><Trash2 size={13} /></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}

                {activeTab === 'emis' && (
                    <motion.div key="emis" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
                        <div className="bg-gradient-to-br from-indigo-500/20 to-purple-500/5 border border-indigo-500/20 rounded-3xl p-6 relative overflow-hidden">
                            <div className="flex justify-between items-center mb-4">
                                <CreditCard className="text-indigo-400" size={32} />
                                <div className="text-right">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400/60">Equivalent Monthly Load</p>
                                    <p className="text-3xl font-black text-indigo-400 tabular-nums">{formatCurrency(emiMonthlyTotal, displayCurrency)}</p>
                                </div>
                            </div>
                            <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-indigo-500/10 blur-[80px] rounded-full" />
                        </div>

                        <form onSubmit={handleAddEMI} className="space-y-4 bg-slate-800/40 p-5 sm:p-6 rounded-3xl border border-slate-700/50">
                            <p className="text-indigo-400 text-[10px] font-black uppercase tracking-tighter mb-2">New Subscription</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                <input required value={emiTitle} onChange={e => setEmiTitle(e.target.value)} placeholder="Service Title (e.g., Netflix)" className="lg:col-span-2 bg-slate-900 border border-slate-700/50 rounded-xl px-4 py-2.5 text-sm text-slate-200 outline-none focus:border-indigo-500/50" />
                                <div className="flex gap-2 w-full lg:col-span-2">
                                    <input required type="number" step="0.01" value={emiAmount} onChange={e => setEmiAmount(e.target.value)} placeholder="Amount" className="flex-1 min-w-[100px] bg-slate-900 border border-slate-700/50 rounded-xl px-4 py-2.5 text-sm font-mono text-slate-200 outline-none focus:border-indigo-500/50" />
                                    <select value={emiCurrency} onChange={e => setEmiCurrency(e.target.value as CurrencyCode)} className="bg-slate-900 border border-slate-700/50 rounded-xl px-3 py-2 text-[10px] font-black uppercase text-slate-400 outline-none w-20 flex-shrink-0">
                                        {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                                <select value={emiBillingCycle} onChange={e => setEmiBillingCycle(e.target.value as any)} className="bg-slate-900 border border-slate-700/50 rounded-xl px-4 py-2.5 text-sm text-slate-200 outline-none focus:border-indigo-500/50">
                                    <option value="1_month">Monthly (1 Month)</option>
                                    <option value="3_months">Quarterly (3 Months)</option>
                                    <option value="1_year">Yearly (1 Year)</option>
                                </select>
                                <div className="relative">
                                    <input list="payment-methods" required value={emiPaymentMethod} onChange={e => setEmiPaymentMethod(e.target.value)} placeholder="Payment Method" className="w-full bg-slate-900 border border-slate-700/50 rounded-xl px-4 py-2.5 text-sm text-slate-200 outline-none focus:border-indigo-500/50" />
                                    <datalist id="payment-methods">
                                        {Array.from(new Set(emis.map(e => e.payment_method).filter(Boolean))).map(pm => (
                                            <option key={pm} value={pm} />
                                        ))}
                                    </datalist>
                                </div>
                                <div className="lg:col-span-2 flex flex-col justify-center">
                                    <label className="text-[10px] font-black uppercase text-slate-500 mb-1">First Deadline / Next Billing Date</label>
                                    <input required type="date" value={emiNextDate} onChange={e => setEmiNextDate(e.target.value)} className="w-full bg-slate-900 border border-slate-700/50 rounded-xl px-4 py-2 text-sm text-slate-200 outline-none focus:border-indigo-500/50" />
                                </div>
                            </div>
                            <button className="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-black py-3 rounded-2xl text-xs transition-all shadow-lg shadow-indigo-500/20 uppercase tracking-widest mt-2">Add Subscription</button>
                        </form>

                        <div className="space-y-3">
                            {emis.map(e => {
                                const rawAmt = e.amount || e.monthly_amount || 0;
                                const nextDateStr = e.next_billing_date 
                                    ? format(new Date(e.next_billing_date), 'dd MMM yyyy') 
                                    : (e.due_day ? format(setDateFns(addMonths(new Date(), 1), e.due_day), 'dd MMM yyyy') : 'Unknown');
                                const cycleLabel = e.billing_cycle === '3_months' ? 'Quarterly' : e.billing_cycle === '1_year' ? 'Yearly' : 'Monthly';

                                return (
                                <div key={e.id} className="bg-slate-800/60 border border-slate-700/50 rounded-3xl p-5 flex flex-wrap sm:flex-nowrap justify-between items-center gap-4 group">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex flex-col items-center justify-center border border-indigo-500/20 text-indigo-400">
                                            <CalendarDays size={20} />
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-100 text-lg leading-tight">{e.title}</p>
                                            <div className="flex flex-wrap items-center gap-2 mt-1">
                                                <span className="px-2 py-0.5 rounded-full bg-slate-900 text-[9px] font-black text-slate-400 border border-slate-700 uppercase">{cycleLabel}</span>
                                                {e.payment_method && (
                                                    <span className="text-slate-500 text-[10px] font-bold">via {e.payment_method}</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-6 w-full sm:w-auto justify-between sm:justify-end">
                                        <div className="text-right">
                                            <p className="text-slate-100 font-black tabular-nums">{formatCurrency(rawAmt, e.currency || 'EUR')}</p>
                                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter mt-1 text-amber-400/80">Next: {nextDateStr}</p>
                                        </div>
                                        <button onClick={() => deleteDocById('emis', e.id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-600 hover:text-red-400 p-2 bg-slate-900 border border-slate-700/50 rounded-xl shadow-sm"><Trash2 size={14} /></button>
                                    </div>
                                </div>
                            )})}
                        </div>
                    </motion.div>
                )}

                {activeTab === 'history' && (
                    <motion.div key="history" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">
                        <header className="flex justify-between items-center mb-2 px-1">
                            <h3 className="text-slate-400 text-xs font-black uppercase tracking-widest flex items-center gap-2">
                                <CalendarDays size={14} className="text-indigo-400" /> Historical Logs
                            </h3>
                            <div className="flex items-center gap-4">
                                <button className="text-[10px] font-black uppercase text-indigo-400 hover:underline">Export CSV</button>
                                {entries.length > 0 && (
                                    <button
                                        onClick={handleClearHistory}
                                        className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-red-400 transition-colors"
                                    >
                                        <Trash2 size={11} /> Clear History
                                    </button>
                                )}
                            </div>
                        </header>
                        {entries.length === 0 ? (
                            <div className="py-20 text-center border-2 border-dashed border-slate-800 rounded-3xl text-slate-600 italic">Financial data history is empty.</div>
                        ) : (
                            monthlyGroups.map(([month, monthEntries]) => (
                                <MonthCard key={month} month={month} entries={monthEntries} displayCurrency={displayCurrency} rates={exchangeRates} />
                            ))
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../hooks/useAuth';
import { useAppStore } from '../store';
import { format, addMonths, setDate as setDateFns } from 'date-fns';
import {
    Plus, DollarSign, TrendingUp, TrendingDown, Wallet,
    Loader2, Trash2, ChevronDown, ChevronUp, CalendarDays,
    ArrowRightLeft, Landmark, CreditCard, PieChart
} from 'lucide-react';
import { createDoc, deleteDocById, listenCollection, where, orderBy, getDocById } from '../firebase/firestore';
import { formatCurrency, convertCurrency } from '../utils/currencyService';
import { generateInvoicePDF } from '../utils/pdfGenerator';
import toast from 'react-hot-toast';
import type { FinanceEntry, CurrencyCode, FinanceType, Invoice, InvoiceItem, UserProfile } from '../types';
import { FileText, Download, User, Briefcase } from 'lucide-react';

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
                                <div key={e.id} className="flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-2">
                                        <span className={`w-1.5 h-1.5 rounded-full ${e.type === 'earned' ? 'bg-emerald-400' : 'bg-red-400'}`} />
                                        <span className="text-slate-300">{e.description}</span>
                                        <span className="text-slate-600 font-medium tracking-tight">({formatCurrency(e.amount, e.currency || 'EUR')})</span>
                                    </div>
                                    <span className={`font-bold tabular-nums ${e.type === 'earned' ? 'text-emerald-400' : 'text-red-400'}`}>
                                        {rates ? formatCurrency(convertCurrency(e.amount, e.currency || 'EUR', displayCurrency, rates), displayCurrency) : formatCurrency(e.amount, e.currency || 'EUR')}
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

const InvoicesTab: React.FC<{ profile: Partial<UserProfile> }> = ({ profile }) => {
    const { invoices, clients, tasks } = useAppStore();
    const [isCreating, setIsCreating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Form State
    const [type, setType] = useState<'client_bill' | 'team_payout'>('client_bill');
    const [recipientId, setRecipientId] = useState('');
    const [recipientName, setRecipientName] = useState('');
    const [currency, setCurrency] = useState<CurrencyCode>('BDT');
    const [items, setItems] = useState<InvoiceItem[]>([{ description: '', quantity: 1, price: 0 }]);
    const [dueDate, setDueDate] = useState('');
    const [linkedTaskId, setLinkedTaskId] = useState('');

    const subtotal = items.reduce((acc, item) => acc + (item.price * item.quantity), 0);

    const handleAddItem = () => setItems([...items, { description: '', quantity: 1, price: 0 }]);
    const handleRemoveItem = (index: number) => setItems(items.filter((_, i) => i !== index));
    const handleItemChange = (index: number, field: keyof InvoiceItem, value: any) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], [field]: value };
        setItems(newItems);
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
                linked_task_id: linkedTaskId || undefined,
                owner_id: profile.uid || '',
                total_amount: subtotal,
                created_at: new Date()
            };

            await createDoc('invoices', newInvoice);
            toast.success('Invoice created');
            setIsCreating(false);
            setItems([{ description: '', quantity: 1, price: 0 }]);
            setRecipientId('');
            setRecipientName('');
        } catch (err) {
            toast.error('Failed to create invoice');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h3 className="text-slate-400 text-xs font-black uppercase tracking-widest pl-1">Billing & Invoices</h3>
                <button
                    onClick={() => setIsCreating(!isCreating)}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-indigo-500/20"
                >
                    {isCreating ? 'CANCEL' : <><Plus size={14} /> NEW INVOICE</>}
                </button>
            </div>

            <AnimatePresence>
                {isCreating && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                    >
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
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Due Date (Optional)</label>
                                    <input
                                        type="date"
                                        value={dueDate}
                                        onChange={e => setDueDate(e.target.value)}
                                        className="w-full bg-slate-900/80 border border-slate-700/50 rounded-xl px-4 py-2 text-sm text-slate-200 outline-none focus:border-indigo-500/50"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Linked Task (Optional)</label>
                                    <select
                                        value={linkedTaskId}
                                        onChange={e => setLinkedTaskId(e.target.value)}
                                        className="w-full bg-slate-900/80 border border-slate-700/50 rounded-xl px-4 py-2.5 text-sm text-slate-200 outline-none focus:border-indigo-500/50"
                                    >
                                        <option value="">Select Task</option>
                                        {tasks.filter(t => t.status !== 'done').map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                                    </select>
                                </div>
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
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="space-y-3">
                {invoices.length === 0 ? (
                    <div className="bg-slate-800/20 border-2 border-dashed border-slate-800 rounded-3xl p-12 text-center text-slate-600 italic text-sm">
                        No invoices generated yet.
                    </div>
                ) : (
                    invoices.map(inv => (
                        <div key={inv.id} className="bg-slate-800/60 border border-slate-700/50 rounded-3xl p-5 flex flex-wrap sm:flex-nowrap justify-between items-center gap-4 group">
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
                                        onClick={() => generateInvoicePDF(inv, profile)}
                                        className="p-2.5 bg-slate-900 hover:bg-slate-700 text-indigo-400 rounded-xl transition-all"
                                        title="Download PDF"
                                    >
                                        <Download size={16} />
                                    </button>
                                    <button 
                                        onClick={() => deleteDocById('invoices', inv.id)} 
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
        </div>
    );
};
export const FinancePage: React.FC = () => {
    const { user } = useAuth();
    const { exchangeRates, savings, emis } = useAppStore();
    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');

    const [activeTab, setActiveTab] = useState<'today' | 'invoices' | 'history' | 'savings' | 'emis'>('today');
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
    
    // Finance Entry State
    const [entries, setEntries] = useState<FinanceEntry[]>([]);
    const [loadingEntries, setLoadingEntries] = useState(true);
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

    // EMI Form State
    const [emiTitle, setEmiTitle] = useState('');
    const [emiMonthly, setEmiMonthly] = useState('');
    const [emiTotal, setEmiTotal] = useState('');
    const [emiDueDay, setEmiDueDay] = useState('1');
    const [emiMonths] = useState('12');
    const [emiCurrency, setEmiCurrency] = useState<CurrencyCode>('BDT');

    // Real-time listener for finance entries
    useEffect(() => {
        if (!user) return;
        setLoadingEntries(true);
        const unsub = listenCollection(
            'finance_entries',
            (data) => {
                setEntries(
                    data.filter(d => !d.deleted_at)
                    .map(d => ({ ...d, created_at: toDate(d.created_at) } as FinanceEntry))
                    .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
                );
                setLoadingEntries(false);
            },
            where('owner_id', '==', user.uid),
            orderBy('created_at', 'desc')
        );
        return unsub;
    }, [user]);

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
            const key = format(e.created_at, 'MMMM yyyy');
            if (!groups[key]) groups[key] = [];
            groups[key].push(e);
        });
        return Object.entries(groups).sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime());
    }, [entries]);

    const savingsTotal = useMemo(() => {
        return savings.reduce((acc, s) => acc + (exchangeRates ? convertCurrency(s.amount, s.currency || 'EUR', displayCurrency, exchangeRates) : s.amount), 0);
    }, [savings, displayCurrency, exchangeRates]);

    const emiMonthlyTotal = useMemo(() => {
        return emis.reduce((acc, e) => acc + (exchangeRates ? convertCurrency(e.monthly_amount, e.currency || 'EUR', displayCurrency, exchangeRates) : e.monthly_amount), 0);
    }, [emis, displayCurrency, exchangeRates]);

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
        const monthly = parseFloat(emiMonthly);
        const total = parseFloat(emiTotal);
        if (!user || !emiTitle.trim() || isNaN(monthly)) return;

        setIsSaving(true);
        try {
            await createDoc('emis', {
                title: emiTitle.trim(),
                monthly_amount: monthly,
                total_amount: total || 0,
                currency: emiCurrency,
                due_day: parseInt(emiDueDay),
                remaining_months: parseInt(emiMonths),
                start_date: todayStr,
                owner_id: user.uid,
            });
            setEmiTitle(''); setEmiMonthly(''); setEmiTotal('');
            toast.success('EMI added');
        } catch { toast.error('Failed to add EMI'); }
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
                </div>
            </header>

            {/* Main Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {(['today', 'invoices', 'history', 'savings', 'emis'] as const).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`flex-shrink-0 px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${
                            activeTab === tab
                                ? 'bg-indigo-500/15 text-indigo-400 border-2 border-indigo-500/30 ring-4 ring-indigo-500/5'
                                : 'bg-slate-800/40 text-slate-500 border-2 border-transparent hover:bg-slate-800 hover:text-slate-300'
                        }`}
                    >
                        {tab === 'emis' ? 'EMIs' : tab}
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

                        {/* List */}
                        <div className="space-y-3">
                            <h3 className="text-slate-400 text-xs font-black uppercase tracking-widest pl-1">Recent Transactions</h3>
                            {loadingEntries ? (
                                <div className="flex flex-col items-center py-12 gap-3 opacity-40">
                                    <Loader2 className="animate-spin text-indigo-500" size={24} />
                                    <span className="text-xs font-bold tracking-widest">FETCHING DATA...</span>
                                </div>
                            ) : todayEntries.length === 0 ? (
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
                    </motion.div>
                )}

                {activeTab === 'invoices' && (
                    <motion.div key="invoices" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                        <InvoicesTab profile={userProfile} />
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
                        <div className="bg-gradient-to-br from-red-500/20 to-orange-500/5 border border-red-500/20 rounded-3xl p-6 relative overflow-hidden">
                            <div className="flex justify-between items-center mb-4">
                                <CreditCard className="text-red-400" size={32} />
                                <div className="text-right">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-red-500/60">Monthly EMI Load</p>
                                    <p className="text-3xl font-black text-red-400 tabular-nums">{formatCurrency(emiMonthlyTotal, displayCurrency)}</p>
                                </div>
                            </div>
                            <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-red-500/10 blur-[80px] rounded-full" />
                        </div>

                        <form onSubmit={handleAddEMI} className="space-y-3 bg-slate-800/40 p-5 rounded-3xl border border-slate-700/50">
                            <p className="text-red-400 text-[10px] font-black uppercase tracking-tighter mb-2">New EMI / Loan Installment</p>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <input required value={emiTitle} onChange={e => setEmiTitle(e.target.value)} placeholder="EMI Title" className="bg-slate-900 border border-slate-700/50 rounded-xl px-4 py-2.5 text-sm text-slate-200 outline-none focus:border-red-500/50" />
                                <input required type="number" step="0.01" value={emiMonthly} onChange={e => setEmiMonthly(e.target.value)} placeholder="Monthly Amount" className="bg-slate-900 border border-slate-700/50 rounded-xl px-4 py-2.5 text-sm font-mono text-slate-200 outline-none focus:border-red-500/50" />
                                <div className="flex gap-2">
                                    <select value={emiCurrency} onChange={e => setEmiCurrency(e.target.value as CurrencyCode)} className="flex-1 bg-slate-900 border border-slate-700/50 rounded-xl px-4 py-2 text-[10px] font-black uppercase text-slate-400 outline-none">
                                        {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                    <input value={emiDueDay} type="number" min="1" max="31" onChange={e => setEmiDueDay(e.target.value)} placeholder="Day" className="w-20 bg-slate-900 border border-slate-700/50 rounded-xl px-4 py-2.5 text-sm text-center font-mono outline-none" title="Due Day of Month" />
                                </div>
                            </div>
                            <button className="w-full bg-red-500 hover:bg-red-600 text-white font-black py-3 rounded-2xl text-xs transition-all shadow-lg shadow-red-500/20 uppercase tracking-widest">Register Installment</button>
                        </form>

                        <div className="space-y-3">
                            {emis.map(e => (
                                <div key={e.id} className="bg-slate-800/60 border border-slate-700/50 rounded-3xl p-5 flex flex-wrap sm:flex-nowrap justify-between items-center gap-4 group">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-2xl bg-slate-700/50 flex flex-col items-center justify-center border border-slate-600/30">
                                            <span className="text-[10px] font-bold text-slate-500 uppercase">Day</span>
                                            <span className="text-lg font-black text-slate-200 leading-none">{e.due_day}</span>
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-100">{e.title}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="px-2 py-0.5 rounded-full bg-slate-900 text-[10px] font-bold text-slate-500 border border-slate-700 uppercase">{e.remaining_months} months left</span>
                                                <span className="text-slate-600 text-[10px] font-medium italic">Monthly auto-deduct simulation enabled</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-6 w-full sm:w-auto justify-between sm:justify-end">
                                        <div className="text-right">
                                            <p className="text-red-400 font-black tabular-nums">{formatCurrency(e.monthly_amount, e.currency || 'EUR')}</p>
                                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter mt-1">Next: {format(setDateFns(addMonths(new Date(), 1), e.due_day), 'dd MMM')}</p>
                                        </div>
                                        <button onClick={() => deleteDocById('emis', e.id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-600 hover:text-red-400 p-2 bg-slate-900 rounded-xl"><Trash2 size={14} /></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}

                {activeTab === 'history' && (
                    <motion.div key="history" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">
                        <header className="flex justify-between items-center mb-2 px-1">
                            <h3 className="text-slate-400 text-xs font-black uppercase tracking-widest flex items-center gap-2">
                                <CalendarDays size={14} className="text-indigo-400" /> Historical Logs
                            </h3>
                            <button className="text-[10px] font-black uppercase text-indigo-400 hover:underline">Export CSV</button>
                        </header>
                        {loadingEntries ? (
                            <div className="flex justify-center py-20 opacity-30"><Loader2 className="animate-spin" /></div>
                        ) : monthlyGroups.length === 0 ? (
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

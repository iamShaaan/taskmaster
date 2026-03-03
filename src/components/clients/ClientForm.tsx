import React, { useState } from 'react';
import { createDoc, updateDocById } from '../../firebase/firestore';
import type { Client } from '../../types';
import toast from 'react-hot-toast';
import { Plus, X, Phone, Mail } from 'lucide-react';

interface ClientFormProps {
    onClose: () => void;
    editClient?: Client;
}

const inputCls = 'w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 transition-colors placeholder:text-slate-500';
const labelCls = 'block text-slate-400 text-xs font-medium mb-1';

export const ClientForm: React.FC<ClientFormProps> = ({ onClose, editClient }) => {
    const [loading, setLoading] = useState(false);
    const [phoneInput, setPhoneInput] = useState('');
    const [emailInput, setEmailInput] = useState('');
    const [form, setForm] = useState({
        name: editClient?.name || '',
        company: editClient?.company || '',
        description: editClient?.description || '',
        website: editClient?.website || '',
        notes: editClient?.notes || '',
        phones: editClient?.phones || [] as string[],
        emails: editClient?.emails || [] as string[],
        tags: editClient?.tags || [] as string[],
    });

    const set = (k: string, v: string | string[]) => setForm((f) => ({ ...f, [k]: v }));

    const addPhone = () => {
        if (phoneInput.trim() && !form.phones.includes(phoneInput.trim())) {
            set('phones', [...form.phones, phoneInput.trim()]);
            setPhoneInput('');
        }
    };

    const addEmail = () => {
        if (emailInput.trim() && !form.emails.includes(emailInput.trim())) {
            set('emails', [...form.emails, emailInput.trim()]);
            setEmailInput('');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.name.trim()) { toast.error('Client name is required'); return; }
        setLoading(true);
        try {
            // Auto-commit any pending phone/email that was typed but not yet added via the + button
            const finalPhones = [...form.phones];
            if (phoneInput.trim() && !finalPhones.includes(phoneInput.trim())) {
                finalPhones.push(phoneInput.trim());
            }
            const finalEmails = [...form.emails];
            if (emailInput.trim() && !finalEmails.includes(emailInput.trim())) {
                finalEmails.push(emailInput.trim());
            }

            const data = { ...form, phones: finalPhones, emails: finalEmails, files: editClient?.files || [] };
            if (editClient) {
                await updateDocById('clients', editClient.id, data as Record<string, unknown>);
                toast.success('Client updated!');
            } else {
                await createDoc('clients', data as Record<string, unknown>);
                toast.success('Client added!');
            }
            onClose();
        } catch (err) {
            toast.error('Failed to save client');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };


    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                    <label className={labelCls}>Full Name *</label>
                    <input className={inputCls} placeholder="John Doe" value={form.name} onChange={(e) => set('name', e.target.value)} />
                </div>
                <div>
                    <label className={labelCls}>Company</label>
                    <input className={inputCls} placeholder="Acme Corp" value={form.company} onChange={(e) => set('company', e.target.value)} />
                </div>
                <div className="col-span-2">
                    <label className={labelCls}>Short Description</label>
                    <input className={inputCls} placeholder="E.g. E-commerce giant" value={form.description} onChange={(e) => set('description', e.target.value)} />
                </div>
                <div className="col-span-2">
                    <label className={labelCls}>Website</label>
                    <input className={inputCls} type="url" placeholder="https://example.com" value={form.website} onChange={(e) => set('website', e.target.value)} />
                </div>
            </div>

            {/* Phones */}
            <div>
                <label className={labelCls}>Phone Numbers</label>
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <Phone size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                        <input className={`${inputCls} pl-8`} type="tel" placeholder="+43 1 234 567" value={phoneInput} onChange={(e) => setPhoneInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addPhone())} />
                    </div>
                    <button type="button" onClick={addPhone} className="px-3 py-2 bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-lg hover:bg-indigo-500/30">
                        <Plus size={15} />
                    </button>
                </div>
                {form.phones.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                        {form.phones.map((p) => (
                            <span key={p} className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-700 text-slate-300 rounded-lg text-xs">
                                <Phone size={11} className="text-emerald-400" />{p}
                                <button type="button" onClick={() => set('phones', form.phones.filter((x) => x !== p))} className="text-slate-500 hover:text-red-400"><X size={11} /></button>
                            </span>
                        ))}
                    </div>
                )}
            </div>

            {/* Emails */}
            <div>
                <label className={labelCls}>Email Addresses</label>
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <Mail size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                        <input className={`${inputCls} pl-8`} type="email" placeholder="client@company.com" value={emailInput} onChange={(e) => setEmailInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addEmail())} />
                    </div>
                    <button type="button" onClick={addEmail} className="px-3 py-2 bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-lg hover:bg-indigo-500/30">
                        <Plus size={15} />
                    </button>
                </div>
                {form.emails.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                        {form.emails.map((e) => (
                            <span key={e} className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-700 text-slate-300 rounded-lg text-xs">
                                <Mail size={11} className="text-indigo-400" />{e}
                                <button type="button" onClick={() => set('emails', form.emails.filter((x) => x !== e))} className="text-slate-500 hover:text-red-400"><X size={11} /></button>
                            </span>
                        ))}
                    </div>
                )}
            </div>

            <div>
                <label className={labelCls}>Notes</label>
                <textarea className={`${inputCls} resize-none`} rows={3} placeholder="Client preferences, important notes..." value={form.notes} onChange={(e) => set('notes', e.target.value)} />
            </div>

            <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-100 transition-colors">Cancel</button>
                <button type="submit" disabled={loading} className="px-5 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium rounded-lg transition-all disabled:opacity-50">
                    {loading ? 'Saving...' : editClient ? 'Update Client' : 'Add Client'}
                </button>
            </div>
        </form>
    );
};

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Phone, Mail, Building2, Pencil, Trash2, FileArchive, ChevronDown, ChevronUp, ExternalLink, Globe } from 'lucide-react';
import { useAppStore } from '../store';
import { ClientForm } from '../components/clients/ClientForm';
import { Modal } from '../components/ui/Modal';
import type { Client } from '../types';
import { deleteDocById } from '../firebase/firestore';
import toast from 'react-hot-toast';

export const Clients: React.FC = () => {
    const navigate = useNavigate();
    const { clients } = useAppStore();
    const [showForm, setShowForm] = useState(false);
    const [editClient, setEditClient] = useState<Client | undefined>();
    const [expanded, setExpanded] = useState<string | null>(null);
    const [search, setSearch] = useState('');

    const filtered = clients.filter((c) =>
        c.name.toLowerCase().includes(search.toLowerCase()) || c.company?.toLowerCase().includes(search.toLowerCase())
    );

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this client?')) return;
        await deleteDocById('clients', id);
        toast.success('Client deleted');
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-3">
                <input
                    className="flex-1 bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                    placeholder="Search clients..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
                <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium rounded-lg transition-all">
                    <Plus size={16} /> Add Client
                </button>
            </div>

            {filtered.length === 0 ? (
                <div className="text-center py-20">
                    <Building2 size={48} className="text-slate-700 mx-auto mb-3" />
                    <p className="text-slate-400">No clients yet</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filtered.map((client) => (
                        <div key={client.id} className="bg-slate-800 border border-slate-700/50 rounded-xl overflow-hidden hover:border-indigo-500/30 transition-all">
                            <div className="flex items-center gap-4 p-4">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                                    {client.name.charAt(0).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3
                                        className="text-slate-100 font-medium hover:text-indigo-400 cursor-pointer transition-colors"
                                        onClick={() => navigate(`/clients/${client.id}`)}
                                    >
                                        {client.name}
                                    </h3>
                                    <div className="flex items-center gap-2">
                                        {client.company && <p className="text-slate-400 text-sm flex items-center gap-1"><Building2 size={12} />{client.company}</p>}
                                        {client.website && (
                                            <a
                                                href={client.website.startsWith('http') ? client.website : `https://${client.website}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-indigo-400 hover:text-indigo-300 text-sm flex items-center gap-1 transition-colors"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <Globe size={12} /> Website
                                            </a>
                                        )}
                                    </div>
                                    {client.description && <p className="text-slate-500 text-xs mt-1 line-clamp-2">{client.description}</p>}
                                </div>
                                <div className="flex items-center gap-1">
                                    {client.phones?.length > 0 && (
                                        <span className="flex items-center gap-1 text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                                            <Phone size={10} />{client.phones.length}
                                        </span>
                                    )}
                                    {client.emails?.length > 0 && (
                                        <span className="flex items-center gap-1 text-xs text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20 ml-1">
                                            <Mail size={10} />{client.emails.length}
                                        </span>
                                    )}
                                    <div className="flex items-center gap-1 ml-2">
                                        <button
                                            onClick={() => navigate(`/clients/${client.id}`)}
                                            className="p-2 text-slate-400 hover:text-indigo-400 hover:bg-slate-700/50 rounded-lg transition-all"
                                            title="View Details"
                                        >
                                            <ExternalLink size={16} />
                                        </button>
                                        <button onClick={() => { setEditClient(client); setShowForm(true); }} className="p-2 text-slate-400 hover:text-indigo-400 hover:bg-slate-700/50 rounded-lg transition-all">
                                            <Pencil size={16} />
                                        </button>
                                        <button onClick={() => handleDelete(client.id)} className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-700/50 rounded-lg transition-all">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                    <button onClick={() => setExpanded(expanded === client.id ? null : client.id)} className="p-1.5 text-slate-500 hover:text-slate-300 rounded-lg transition-all">
                                        {expanded === client.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                    </button>
                                </div>
                            </div>

                            {expanded === client.id && (
                                <div className="px-4 pb-4 pt-0 border-t border-slate-700/50 grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-slate-500 text-xs font-medium mb-2">PHONE NUMBERS</p>
                                        {client.phones?.length ? client.phones.map((p) => (
                                            <div key={p} className="flex items-center gap-2 py-1">
                                                <Phone size={13} className="text-emerald-400" />
                                                <a href={`tel:${p}`} className="text-slate-300 text-sm hover:text-emerald-400 transition-colors">{p}</a>
                                            </div>
                                        )) : <p className="text-slate-600 text-sm">None</p>}
                                    </div>
                                    <div>
                                        <p className="text-slate-500 text-xs font-medium mb-2">EMAIL ADDRESSES</p>
                                        {client.emails?.length ? client.emails.map((e) => (
                                            <div key={e} className="flex items-center gap-2 py-1">
                                                <Mail size={13} className="text-indigo-400" />
                                                <a href={`mailto:${e}`} className="text-slate-300 text-sm hover:text-indigo-400 transition-colors truncate">{e}</a>
                                            </div>
                                        )) : <p className="text-slate-600 text-sm">None</p>}
                                    </div>
                                    {client.notes && (
                                        <div className="col-span-2">
                                            <p className="text-slate-500 text-xs font-medium mb-1">NOTES</p>
                                            <p className="text-slate-400 text-sm whitespace-pre-line">{client.notes}</p>
                                        </div>
                                    )}
                                    {client.files?.length > 0 && (
                                        <div className="col-span-2">
                                            <p className="text-slate-500 text-xs font-medium mb-2 flex items-center gap-1"><FileArchive size={12} /> FILES ({client.files.length})</p>
                                            <div className="flex flex-wrap gap-2">
                                                {client.files.map((f) => (
                                                    <a key={f.id} href={f.url} target="_blank" rel="noopener noreferrer"
                                                        className="text-xs text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 px-2 py-1 rounded-lg border border-indigo-500/20 transition-colors truncate max-w-40">
                                                        {f.name}
                                                    </a>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            <Modal isOpen={showForm} onClose={() => { setEditClient(undefined); setShowForm(false); }} title={editClient ? 'Edit Client' : 'Add Client'} size="lg">
                <ClientForm onClose={() => { setEditClient(undefined); setShowForm(false); }} editClient={editClient} />
            </Modal>
        </div>
    );
};

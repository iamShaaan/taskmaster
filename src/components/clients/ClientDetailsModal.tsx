import React from 'react';
import { Building2, Phone, Mail, CheckSquare, StickyNote, Globe } from 'lucide-react';
import { useAppStore } from '../../store';
import { Modal } from '../ui/Modal';
import { TaskCard } from '../tasks/TaskCard';
import { statusBadge } from '../ui/Badge';

interface ClientDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    clientId: string | null;
}

export const ClientDetailsModal: React.FC<ClientDetailsModalProps> = ({ isOpen, onClose, clientId }) => {
    const { clients, tasks, projects } = useAppStore();

    if (!clientId || !isOpen) return null;

    const client = clients.find((c) => c.id === clientId);

    if (!client) {
        return (
            <Modal isOpen={isOpen} onClose={onClose} title="Client Details" size="md">
                <div className="flex flex-col items-center justify-center p-8 text-slate-400">
                    <Building2 size={48} className="mb-4 opacity-20" />
                    <p>Client not found</p>
                </div>
            </Modal>
        );
    }

    const clientTasks = tasks.filter((t) => t.client_id === clientId);
    const clientProjects = projects.filter((p) => p.client_id === clientId);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Client: ${client.name}`} size="xl">
            <div className="space-y-8 pb-4">
                {/* Header Info */}
                <div className="flex flex-col md:flex-row justify-between gap-6">
                    <div>
                        <div className="flex items-center gap-4 text-slate-400 mt-1">
                            <p className="flex items-center gap-1.5">
                                <Building2 size={16} className="text-indigo-400" /> {client.company || 'Private Client'}
                            </p>
                            {client.website && (
                                <a
                                    href={client.website.startsWith('http') ? client.website : `https://${client.website}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300 transition-colors bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-500/20 text-xs font-medium"
                                >
                                    <Globe size={12} /> Website
                                </a>
                            )}
                        </div>
                        {client.description && (
                            <p className="text-slate-300 text-sm mt-3 max-w-2xl leading-relaxed">{client.description}</p>
                        )}
                    </div>
                </div>

                {/* Contact Info Card */}
                {((client.phones?.length ?? 0) > 0 || (client.emails?.length ?? 0) > 0) && (
                    <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-5">
                        <h2 className="text-slate-300 text-xs font-bold uppercase tracking-widest mb-4 flex items-center gap-2">
                            <Phone size={13} className="text-emerald-400" /> Contact Information
                        </h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {client.phones?.map(p => (
                                <a key={p} href={`tel:${p}`}
                                    className="flex items-center gap-3 p-3 bg-slate-900/60 border border-slate-700/40 rounded-xl hover:border-emerald-500/40 hover:bg-emerald-500/5 group transition-all">
                                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0 group-hover:bg-emerald-500/20 transition-all">
                                        <Phone size={14} className="text-emerald-400" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Phone</p>
                                        <p className="text-slate-200 text-sm font-medium group-hover:text-emerald-300 transition-colors">{p}</p>
                                    </div>
                                </a>
                            ))}
                            {client.emails?.map(e => (
                                <a key={e} href={`mailto:${e}`}
                                    className="flex items-center gap-3 p-3 bg-slate-900/60 border border-slate-700/40 rounded-xl hover:border-indigo-500/40 hover:bg-indigo-500/5 group transition-all">
                                    <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center flex-shrink-0 group-hover:bg-indigo-500/20 transition-all">
                                        <Mail size={14} className="text-indigo-400" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Email</p>
                                        <p className="text-slate-200 text-sm font-medium group-hover:text-indigo-300 transition-colors">{e}</p>
                                    </div>
                                </a>
                            ))}
                        </div>
                    </div>
                )}

                {/* Internal Client Notes */}
                {client.notes && (
                    <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-5">
                        <h2 className="text-slate-300 text-xs font-bold uppercase tracking-widest mb-3 flex items-center gap-2">
                            <StickyNote size={13} className="text-amber-400" /> Internal Notes
                        </h2>
                        <p className="text-slate-400 text-sm whitespace-pre-wrap leading-relaxed">{client.notes}</p>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Projects */}
                    <section className="bg-slate-800/30 p-5 rounded-2xl border border-slate-700/50">
                        <h2 className="text-slate-100 font-bold mb-4 flex items-center gap-2">
                            <Building2 size={16} className="text-indigo-400" /> Projects ({clientProjects.length})
                        </h2>
                        <div className="space-y-3">
                            {clientProjects.map(p => (
                                <div key={p.id} className="p-3 bg-slate-800/60 border border-slate-700/50 rounded-xl">
                                    <div className="flex items-center justify-between mb-2">
                                        <h3 className="text-slate-200 font-medium text-sm">{p.name}</h3>
                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {statusBadge(p.status)}
                                    </div>
                                </div>
                            ))}
                            {clientProjects.length === 0 && <p className="text-slate-600 text-xs italic py-3 text-center rounded-xl bg-slate-800/50">No projects found</p>}
                        </div>
                    </section>

                    {/* Tasks */}
                    <section className="bg-slate-800/30 p-5 rounded-2xl border border-slate-700/50">
                        <h2 className="text-slate-100 font-bold mb-4 flex items-center gap-2">
                            <CheckSquare size={16} className="text-indigo-400" /> Active Tasks ({clientTasks.length})
                        </h2>
                        <div className="space-y-3">
                            {clientTasks.map(t => (
                                <TaskCard key={t.id} task={t} onEdit={() => { }} compact />
                            ))}
                            {clientTasks.length === 0 && <p className="text-slate-600 text-xs italic py-3 text-center rounded-xl bg-slate-800/50">No active tasks</p>}
                        </div>
                    </section>
                </div>
            </div>
        </Modal>
    );
};

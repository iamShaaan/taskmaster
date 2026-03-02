import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ArrowLeft, Building2, Phone, Mail, Clock,
    CheckSquare, Calendar as CalendarIcon, FileArchive, StickyNote
} from 'lucide-react';
import { useAppStore } from '../store';
import { TaskCard } from '../components/tasks/TaskCard';
import { statusBadge } from '../components/ui/Badge';
import { formatDate } from '../utils/timeFormat';

export const ClientDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { clients, tasks, meetings, projects, notes } = useAppStore();

    const client = clients.find((c) => c.id === id);

    if (!client) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-slate-400">
                <Building2 size={48} className="mb-4 opacity-20" />
                <p>Client not found</p>
                <button onClick={() => navigate('/clients')} className="mt-4 text-indigo-400 hover:text-indigo-300">Back to Clients</button>
            </div>
        );
    }

    const clientTasks = tasks.filter((t) => t.client_id === id);
    const clientMeetings = meetings.filter((m) => m.linked_client_id === id);
    const clientProjects = projects.filter((p) => p.client_id === id);
    const clientNotes = notes.filter((n) => n.tags?.includes(client.name) || n.content.includes(client.name)); // Heuristic for linked notes if no direct ID

    return (
        <div className="space-y-8 pb-12">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="flex items-start gap-4">
                    <button
                        onClick={() => navigate('/clients')}
                        className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-100 transition-all"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <h1 className="text-3xl font-bold text-slate-50">{client.name}</h1>
                            <span className="px-3 py-1 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-full text-xs font-bold uppercase tracking-wider">
                                Client
                            </span>
                        </div>
                        <p className="text-slate-400 flex items-center gap-1.5 px-0.5">
                            <Building2 size={14} /> {client.company || 'Private Client'}
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap gap-3">
                    {client.phones?.map(p => (
                        <a key={p} href={`tel:${p}`} className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-xl text-slate-300 text-sm hover:border-emerald-500/40 hover:text-emerald-400 transition-all">
                            <Phone size={14} /> {p}
                        </a>
                    ))}
                    {client.emails?.map(e => (
                        <a key={e} href={`mailto:${e}`} className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-xl text-slate-300 text-sm hover:border-indigo-500/40 hover:text-indigo-400 transition-all">
                            <Mail size={14} /> {e}
                        </a>
                    ))}
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

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* Left Column: Projects & Notes */}
                <div className="space-y-8 lg:col-span-1">
                    {/* Projects */}
                    <section>
                        <h2 className="text-slate-100 font-bold mb-4 flex items-center gap-2">
                            <Building2 size={18} className="text-indigo-400" /> Projects ({clientProjects.length})
                        </h2>
                        <div className="space-y-3">
                            {clientProjects.map(p => (
                                <div
                                    key={p.id}
                                    onClick={() => navigate(`/projects/${p.id}`)}
                                    className="p-4 bg-slate-800/40 border border-slate-700/50 rounded-xl hover:border-indigo-500/40 cursor-pointer transition-all group"
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <h3 className="text-slate-200 font-medium group-hover:text-indigo-400 transition-colors">{p.name}</h3>
                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {statusBadge(p.status)}
                                        <span className="text-[10px] text-slate-500">{formatDate(p.created_at)}</span>
                                    </div>
                                </div>
                            ))}
                            {clientProjects.length === 0 && <p className="text-slate-600 text-sm italic py-4 text-center border-2 border-dashed border-slate-800/50 rounded-xl">No projects found</p>}
                        </div>
                    </section>

                    {/* Notes */}
                    <section>
                        <h2 className="text-slate-100 font-bold mb-4 flex items-center gap-2">
                            <StickyNote size={18} className="text-amber-400" /> Linked Notes ({clientNotes.length})
                        </h2>
                        <div className="space-y-3">
                            {clientNotes.map(n => (
                                <div key={n.id} className="p-4 bg-slate-800/40 border border-slate-700/50 rounded-xl">
                                    <h3 className="text-slate-200 font-medium mb-1 truncate">{n.title}</h3>
                                    <p className="text-slate-500 text-xs line-clamp-2">{n.content}</p>
                                </div>
                            ))}
                            {clientNotes.length === 0 && <p className="text-slate-600 text-sm italic py-4 text-center border-2 border-dashed border-slate-800/50 rounded-xl">No notes found</p>}
                        </div>
                    </section>

                    {/* Files */}
                    <section>
                        <h2 className="text-slate-100 font-bold mb-4 flex items-center gap-2">
                            <FileArchive size={18} className="text-emerald-400" /> Files ({client.files?.length || 0})
                        </h2>
                        <div className="grid grid-cols-1 gap-2">
                            {client.files?.map(f => (
                                <a
                                    key={f.id}
                                    href={f.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-3 p-3 bg-slate-800/40 border border-slate-700/50 rounded-xl hover:bg-slate-700/40 transition-all group"
                                >
                                    <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400 group-hover:bg-indigo-500 group-hover:text-white transition-all">
                                        <FileArchive size={16} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-slate-300 text-sm truncate">{f.name}</p>
                                        <p className="text-slate-600 text-[10px]">{formatDate(f.uploaded_at)}</p>
                                    </div>
                                </a>
                            ))}
                            {(!client.files || client.files.length === 0) && <p className="text-slate-600 text-sm italic py-4 text-center border-2 border-dashed border-slate-800/50 rounded-xl">No files found</p>}
                        </div>
                    </section>
                </div>

                {/* Right Column: Tasks & Meetings */}
                <div className="space-y-8 lg:col-span-2">
                    {/* Tasks */}
                    <section>
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-slate-100 font-bold flex items-center gap-2">
                                <CheckSquare size={18} className="text-indigo-400" /> Active Tasks ({clientTasks.length})
                            </h2>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {clientTasks.map(t => (
                                <TaskCard key={t.id} task={t} onEdit={() => { }} compact />
                            ))}
                            {clientTasks.length === 0 && <div className="col-span-full py-12 text-center border-2 border-dashed border-slate-800/50 rounded-2xl text-slate-500 italic">No tasks assigned to this client</div>}
                        </div>
                    </section>

                    {/* Meetings */}
                    <section>
                        <h2 className="text-slate-100 font-bold mb-4 flex items-center gap-2">
                            <CalendarIcon size={18} className="text-purple-400" /> Meetings ({clientMeetings.length})
                        </h2>
                        <div className="space-y-3">
                            {clientMeetings.map(m => (
                                <div key={m.id} className="p-4 bg-slate-800/40 border border-slate-700/50 rounded-xl flex items-center justify-between group hover:border-purple-500/40 transition-all">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex flex-col items-center justify-center text-purple-400 border border-purple-500/20">
                                            <span className="text-xs font-bold leading-none">{new Date(m.start_time).toLocaleString('en-US', { month: 'short' }).toUpperCase()}</span>
                                            <span className="text-lg font-black leading-none">{new Date(m.start_time).getDate()}</span>
                                        </div>
                                        <div>
                                            <h3 className="text-slate-200 font-medium group-hover:text-purple-400 transition-colors">{m.title}</h3>
                                            <p className="text-slate-500 text-xs flex items-center gap-1.5 mt-0.5">
                                                <Clock size={12} /> {new Date(m.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-[10px] text-slate-600 bg-slate-900/50 px-2 py-1 rounded-md border border-white/5 uppercase font-bold tracking-tighter">
                                            {m.participants.length} Participants
                                        </span>
                                    </div>
                                </div>
                            ))}
                            {clientMeetings.length === 0 && <p className="text-slate-600 text-sm italic py-4 text-center border-2 border-dashed border-slate-800/50 rounded-xl">No upcoming meetings</p>}
                        </div>
                    </section>
                </div>

            </div>
        </div>
    );
};

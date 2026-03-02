import React, { useState, useMemo } from 'react';
import { useAppStore } from '../../store';
import { createDoc, updateDocById } from '../../firebase/firestore';
import type { Task } from '../../types';
import toast from 'react-hot-toast';
import { X, Plus, Tag, Users, FolderKanban } from 'lucide-react';

interface TaskFormProps {
    onClose: () => void;
    editTask?: Task;
}

const inputCls = 'w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 transition-colors placeholder:text-slate-500';
const labelCls = 'block text-slate-400 text-xs font-medium mb-1';

export const TaskForm: React.FC<TaskFormProps> = ({ onClose, editTask }) => {
    const { clients, projects } = useAppStore();
    const [loading, setLoading] = useState(false);
    const [tag, setTag] = useState('');
    const [form, setForm] = useState({
        title: editTask?.title || '',
        description: editTask?.description || '',
        type: editTask?.type || 'personal' as 'personal' | 'project' | 'client',
        status: editTask?.status || 'open' as Task['status'],
        priority: editTask?.priority || 'medium' as Task['priority'],
        due_date: editTask?.due_date ? editTask.due_date.toISOString().slice(0, 16) : '',
        project_id: editTask?.project_id || '',
        client_id: editTask?.client_id || '',
        tags: editTask?.tags || [] as string[],
    });

    // When client changes: clear project if it doesn't belong to the new client
    const handleClientChange = (clientId: string) => {
        setForm(f => {
            const projectStillValid = projectsForClient(clientId).some(p => p.id === f.project_id);
            return { ...f, client_id: clientId, project_id: projectStillValid ? f.project_id : '' };
        });
    };

    // Filter projects by selected client (if client is picked); otherwise show all
    const projectsForClient = (clientId: string) => {
        if (!clientId) return projects;
        return projects.filter(p => p.client_id === clientId);
    };

    const filteredProjects = useMemo(
        () => projectsForClient(form.client_id),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [form.client_id, projects]
    );

    const set = (k: string, v: string | string[]) => setForm((f) => ({ ...f, [k]: v }));

    const addTag = () => {
        if (tag.trim() && !form.tags.includes(tag.trim())) {
            set('tags', [...form.tags, tag.trim()]);
            setTag('');
        }
    };

    const removeTag = (t: string) => set('tags', form.tags.filter((x) => x !== t));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.title.trim()) { toast.error('Title is required'); return; }
        setLoading(true);
        try {
            const data = {
                ...form,
                due_date: form.due_date ? new Date(form.due_date) : null,
                project_id: form.project_id || null,
                client_id: form.client_id || null,
                attachments: editTask?.attachments || [],
                time_logs: editTask?.time_logs || [],
                total_time_ms: editTask?.total_time_ms || 0,
            };
            if (editTask) {
                await updateDocById('tasks', editTask.id, data as Record<string, unknown>);
                toast.success('Task updated!');
            } else {
                const id = await createDoc('tasks', { ...data, deep_link: '' });
                await updateDocById('tasks', id, { deep_link: `/tasks/${id}` });
                toast.success('Task created!');
            }
            onClose();
        } catch (err) {
            toast.error('Failed to save task');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            {/* Title */}
            <div>
                <label className={labelCls}>Title *</label>
                <input className={inputCls} placeholder="What needs to be done?" value={form.title} onChange={(e) => set('title', e.target.value)} />
            </div>

            {/* Description */}
            <div>
                <label className={labelCls}>Description</label>
                <textarea className={`${inputCls} resize-none`} rows={2} placeholder="Add more details..." value={form.description} onChange={(e) => set('description', e.target.value)} />
            </div>

            {/* Type / Priority / Status */}
            <div className="grid grid-cols-3 gap-3">
                <div>
                    <label className={labelCls}>Type</label>
                    <select className={inputCls} value={form.type} onChange={(e) => set('type', e.target.value)}>
                        <option value="personal">Personal</option>
                        <option value="project">Project</option>
                        <option value="client">Client</option>
                    </select>
                </div>
                <div>
                    <label className={labelCls}>Priority</label>
                    <select className={inputCls} value={form.priority} onChange={(e) => set('priority', e.target.value)}>
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                    </select>
                </div>
                <div>
                    <label className={labelCls}>Status</label>
                    <select className={inputCls} value={form.status} onChange={(e) => set('status', e.target.value)}>
                        <option value="open">Open</option>
                        <option value="in_progress">In Progress</option>
                        <option value="done">Done</option>
                        <option value="error">Error</option>
                    </select>
                </div>
            </div>

            {/* Client + Project — always visible, project filtered by client */}
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className={labelCls}>
                        <span className="flex items-center gap-1"><Users size={11} /> Client</span>
                    </label>
                    <select
                        className={inputCls}
                        value={form.client_id}
                        onChange={(e) => handleClientChange(e.target.value)}
                    >
                        <option value="">— No client —</option>
                        {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>
                <div>
                    <label className={labelCls}>
                        <span className="flex items-center gap-1">
                            <FolderKanban size={11} />
                            Project{form.client_id && filteredProjects.length < projects.length ? ` (${filteredProjects.length} for client)` : ''}
                        </span>
                    </label>
                    <select
                        className={inputCls}
                        value={form.project_id}
                        onChange={(e) => set('project_id', e.target.value)}
                        disabled={filteredProjects.length === 0}
                    >
                        <option value="">— No project —</option>
                        {filteredProjects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    {form.client_id && filteredProjects.length === 0 && (
                        <p className="text-slate-600 text-[10px] mt-1">No projects linked to this client yet</p>
                    )}
                </div>
            </div>

            {/* Due Date */}
            <div>
                <label className={labelCls}>Due Date</label>
                <input type="datetime-local" className={inputCls} value={form.due_date} onChange={(e) => set('due_date', e.target.value)} />
            </div>

            {/* Tags */}
            <div>
                <label className={labelCls}>Tags</label>
                <div className="flex gap-2">
                    <input className={`${inputCls} flex-1`} placeholder="Add tag..." value={tag} onChange={(e) => setTag(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())} />
                    <button type="button" onClick={addTag} className="px-3 py-2 bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-lg hover:bg-indigo-500/30 transition-all">
                        <Plus size={16} />
                    </button>
                </div>
                {form.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                        {form.tags.map((t) => (
                            <span key={t} className="flex items-center gap-1 px-2 py-0.5 bg-slate-700 text-slate-300 rounded-full text-xs">
                                <Tag size={10} />{t}
                                <button type="button" onClick={() => removeTag(t)} className="text-slate-500 hover:text-red-400"><X size={10} /></button>
                            </span>
                        ))}
                    </div>
                )}
            </div>

            <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-100 transition-colors">Cancel</button>
                <button type="submit" disabled={loading} className="px-5 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium rounded-lg transition-all disabled:opacity-50">
                    {loading ? 'Saving...' : editTask ? 'Update Task' : 'Create Task'}
                </button>
            </div>
        </form>
    );
};

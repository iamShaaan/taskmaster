import React, { useState } from 'react';
import type { Project } from '../../types';
import { createDoc, updateDocById } from '../../firebase/firestore';
import { useAppStore } from '../../store';
import toast from 'react-hot-toast';

interface ProjectFormProps {
    onClose: () => void;
    editProject?: Project;
}

const inputCls = 'w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 transition-colors placeholder:text-slate-500';
const labelCls = 'block text-slate-400 text-xs font-medium mb-1';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#f97316'];

export const ProjectForm: React.FC<ProjectFormProps> = ({ onClose, editProject }) => {
    const { clients } = useAppStore();
    const [loading, setLoading] = useState(false);
    const [form, setForm] = useState({
        name: editProject?.name || '',
        description: editProject?.description || '',
        status: editProject?.status || 'active' as Project['status'],
        client_id: editProject?.client_id || '',
        color: editProject?.color || COLORS[0],
    });

    const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.name.trim()) { toast.error('Project name required'); return; }
        setLoading(true);
        try {
            const data = { ...form, client_id: form.client_id || null, files: editProject?.files || [] };
            if (editProject) {
                await updateDocById('projects', editProject.id, data as Record<string, unknown>);
                toast.success('Project updated!');
            } else {
                await createDoc('projects', data as Record<string, unknown>);
                toast.success('Project created!');
            }
            onClose();
        } catch {
            toast.error('Failed to save project');
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label className={labelCls}>Project Name *</label>
                <input className={inputCls} placeholder="My Awesome Project" value={form.name} onChange={(e) => set('name', e.target.value)} />
            </div>
            <div>
                <label className={labelCls}>Description</label>
                <textarea className={`${inputCls} resize-none`} rows={3} value={form.description} onChange={(e) => set('description', e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className={labelCls}>Status</label>
                    <select className={inputCls} value={form.status} onChange={(e) => set('status', e.target.value)}>
                        <option value="active">Active</option>
                        <option value="paused">Paused</option>
                        <option value="completed">Completed</option>
                    </select>
                </div>
                <div>
                    <label className={labelCls}>Linked Client</label>
                    <select className={inputCls} value={form.client_id} onChange={(e) => set('client_id', e.target.value)}>
                        <option value="">None</option>
                        {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>
            </div>
            <div>
                <label className={labelCls}>Color</label>
                <div className="flex gap-2 mt-1">
                    {COLORS.map((c) => (
                        <button key={c} type="button" onClick={() => set('color', c)}
                            className={`w-7 h-7 rounded-full transition-all ${form.color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-110' : 'hover:scale-105'}`}
                            style={{ backgroundColor: c }}
                        />
                    ))}
                </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-100 transition-colors">Cancel</button>
                <button type="submit" disabled={loading} className="px-5 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium rounded-lg transition-all disabled:opacity-50">
                    {loading ? 'Saving...' : editProject ? 'Update' : 'Create Project'}
                </button>
            </div>
        </form>
    );
};

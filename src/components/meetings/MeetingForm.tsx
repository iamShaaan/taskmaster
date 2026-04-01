import React, { useState } from 'react';
import { useAppStore } from '../../store';
import { createDoc, updateDocById } from '../../firebase/firestore';
import type { Meeting } from '../../types';
import { findConflicts } from '../../utils/overlap';
import { triggerMeetingReminder } from '../../utils/n8nBridge';
import toast from 'react-hot-toast';
import { AlertTriangle } from 'lucide-react';

interface MeetingFormProps {
    onClose: () => void;
    editMeeting?: Meeting;
}

const inputCls = 'w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 transition-colors placeholder:text-slate-500';
const labelCls = 'block text-slate-400 text-xs font-medium mb-1';

export const MeetingForm: React.FC<MeetingFormProps> = ({ onClose, editMeeting }) => {
    const { meetings, clients, projects, tasks } = useAppStore();
    const [loading, setLoading] = useState(false);
    const [conflicts, setConflicts] = useState<{ conflictingTitle: string }[]>([]);
    const [participantInput, setParticipantInput] = useState('');
    const [form, setForm] = useState({
        title: editMeeting?.title || '',
        description: editMeeting?.description || '',
        start_time: editMeeting?.start_time ? editMeeting.start_time.toISOString().slice(0, 16) : '',
        end_time: editMeeting?.end_time ? editMeeting.end_time.toISOString().slice(0, 16) : '',
        participants: editMeeting?.participants || [] as string[],
        linked_task_id: editMeeting?.linked_task_id || '',
        linked_client_id: editMeeting?.linked_client_id || '',
        linked_project_id: editMeeting?.linked_project_id || '',
        location: editMeeting?.location || '',
    });

    const set = (k: string, v: string | string[]) => setForm((f) => ({ ...f, [k]: v }));

    const checkConflicts = (start: string, end: string) => {
        if (!start || !end) return;
        const s = new Date(start);
        const e = new Date(end);
        if (s >= e) return;
        const flat = meetings.map((m) => ({ id: m.id, title: m.title, start_time: m.start_time, end_time: m.end_time }));
        const c = findConflicts(s, e, flat, editMeeting?.id);
        setConflicts(c);
    };

    const addParticipant = () => {
        if (participantInput.trim() && !form.participants.includes(participantInput.trim())) {
            set('participants', [...form.participants, participantInput.trim()]);
            setParticipantInput('');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.title || !form.start_time || !form.end_time) { toast.error('Title, start and end time required'); return; }
        const start = new Date(form.start_time);
        const end = new Date(form.end_time);
        if (start >= end) { toast.error('End time must be after start time'); return; }
        if (conflicts.length > 0 && !confirm(`Conflicts detected with: ${conflicts.map((c) => c.conflictingTitle).join(', ')}. Continue anyway?`)) return;
        setLoading(true);
        try {
            let participant_uids: string[] = editMeeting?.participant_uids || [];
            let project_member_uids: string[] = [];
            if (form.linked_project_id) {
                const proj = projects.find(p => p.id === form.linked_project_id);
                if (proj) {
                    participant_uids = Array.from(new Set([...participant_uids, proj.owner_id, ...(proj.member_uids || [])]));
                    project_member_uids = proj.member_uids || [];
                }
            }

            const data = {
                ...form,
                start_time: start,
                end_time: end,
                participant_uids,
                project_member_uids,
                linked_task_id: form.linked_task_id || null,
                linked_client_id: form.linked_client_id || null,
                linked_project_id: form.linked_project_id || null,
                reminder_sent: false,
            };
            if (editMeeting) {
                await updateDocById('meetings', editMeeting.id, data as Record<string, unknown>);
                toast.success('Meeting updated!');
            } else {
                const id = await createDoc('meetings', data as Record<string, unknown>);
                // Trigger n8n email reminder
                if (form.participants.length > 0) {
                    await triggerMeetingReminder(id, form.participants[0], form.title, start);
                }
                toast.success('Meeting scheduled!');
            }
            onClose();
        } catch (err) {
            toast.error('Failed to save meeting');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label className={labelCls}>Meeting Title *</label>
                <input className={inputCls} placeholder="Team sync / Client call..." value={form.title} onChange={(e) => set('title', e.target.value)} />
            </div>
            <div>
                <label className={labelCls}>Description</label>
                <textarea className={`${inputCls} resize-none`} rows={2} value={form.description} onChange={(e) => set('description', e.target.value)} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                    <label className={labelCls}>Start Time *</label>
                    <input type="datetime-local" className={inputCls} value={form.start_time} onChange={(e) => { set('start_time', e.target.value); checkConflicts(e.target.value, form.end_time); }} />
                </div>
                <div>
                    <label className={labelCls}>End Time *</label>
                    <input type="datetime-local" className={inputCls} value={form.end_time} onChange={(e) => { set('end_time', e.target.value); checkConflicts(form.start_time, e.target.value); }} />
                </div>
            </div>

            {conflicts.length > 0 && (
                <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                    <AlertTriangle size={16} className="text-amber-400 flex-shrink-0 mt-0.5" />
                    <p className="text-amber-300 text-xs">Conflicts with: {conflicts.map((c) => c.conflictingTitle).join(', ')}</p>
                </div>
            )}

            <div>
                <label className={labelCls}>Meeting Link</label>
                <input className={inputCls} type="url" placeholder="https://zoom.us/j/... or https://meet.google.com/..." value={form.location} onChange={(e) => set('location', e.target.value)} />
            </div>

            {/* Participants */}
            <div>
                <label className={labelCls}>Participants (email)</label>
                <div className="flex gap-2">
                    <input className={`${inputCls} flex-1`} type="email" placeholder="add@email.com" value={participantInput} onChange={(e) => setParticipantInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addParticipant())} />
                    <button type="button" onClick={addParticipant} className="px-3 py-2 bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-lg hover:bg-indigo-500/30 text-sm">Add</button>
                </div>
                {form.participants.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                        {form.participants.map((p) => (
                            <span key={p} className="flex items-center gap-1 px-2 py-0.5 bg-slate-700 text-slate-300 rounded-full text-xs">
                                {p}
                                <button type="button" onClick={() => set('participants', form.participants.filter((x) => x !== p))} className="text-slate-500 hover:text-red-400">×</button>
                            </span>
                        ))}
                    </div>
                )}
            </div>

            {/* Links */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                    <label className={labelCls}>Link Task</label>
                    <select className={inputCls} value={form.linked_task_id} onChange={(e) => set('linked_task_id', e.target.value)}>
                        <option value="">None</option>
                        {tasks.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
                    </select>
                </div>
                <div>
                    <label className={labelCls}>Link Client</label>
                    <select className={inputCls} value={form.linked_client_id} onChange={(e) => set('linked_client_id', e.target.value)}>
                        <option value="">None</option>
                        {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>
                <div>
                    <label className={labelCls}>Link Project</label>
                    <select className={inputCls} value={form.linked_project_id} onChange={(e) => set('linked_project_id', e.target.value)}>
                        <option value="">None</option>
                        {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-100 transition-colors">Cancel</button>
                <button type="submit" disabled={loading} className="px-5 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium rounded-lg transition-all disabled:opacity-50">
                    {loading ? 'Saving...' : editMeeting ? 'Update Meeting' : 'Schedule Meeting'}
                </button>
            </div>
        </form>
    );
};

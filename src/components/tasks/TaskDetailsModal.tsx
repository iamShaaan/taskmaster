import React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar, Clock, Tag, FolderKanban, Users, UserCircle, AlignLeft, Activity } from 'lucide-react';
import type { Task } from '../../types';
import { statusBadge, priorityBadge, typeBadge } from '../ui/Badge';
import { formatDuration, formatDate } from '../../utils/timeFormat';
import { useAppStore } from '../../store';
import { auth, db, APP_ID } from '../../firebase/config';
import { updateDoc, doc, serverTimestamp, arrayUnion } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { Send, MessageSquareText } from 'lucide-react';

interface TaskDetailsModalProps {
    task: Task;
    onClose: () => void;
}

export const TaskDetailsModal: React.FC<TaskDetailsModalProps> = ({ task, onClose }) => {
    const { clients, projects } = useAppStore();
    const [noteContent, setNoteContent] = React.useState('');
    const [submittingNote, setSubmittingNote] = React.useState(false);
    const [isTransferring, setIsTransferring] = React.useState(false);
    const [transferProjectId, setTransferProjectId] = React.useState('');
    const [transferring, setTransferring] = React.useState(false);

    const clientName = task.client_id ? clients.find(c => c.id === task.client_id)?.name : null;
    const projectName = task.project_id ? projects.find(p => p.id === task.project_id)?.name : null;

    const uid = auth.currentUser?.uid;
    const isOwner = uid === task.owner_id;
    const isAssignee = uid === task.assignee_id;
    const isProjectMember = task.project_member_uids?.includes(uid || '');
    const canPostNote = isOwner || isAssignee || isProjectMember;

    const handleAddNote = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!noteContent.trim() || !uid) return;

        setSubmittingNote(true);
        try {
            const newNote = {
                id: crypto.randomUUID(),
                content: noteContent.trim(),
                author_id: uid,
                author_name: auth.currentUser?.displayName || auth.currentUser?.email?.split('@')[0] || 'User',
                created_at: serverTimestamp()
            };

            const taskRef = doc(db, `apps/${APP_ID}/tasks`, task.id);
            await updateDoc(taskRef, {
                notes: arrayUnion(newNote)
            });

            setNoteContent('');
            toast.success('Note added');
        } catch (err) {
            console.error(err);
            toast.error('Failed to add note');
        } finally {
            setSubmittingNote(false);
        }
    };

    const handleTransfer = async () => {
        setTransferring(true);
        try {
            const proj = projects.find(p => p.id === transferProjectId);
            const isUser = task.assignee_id === uid;
            const isProjMem = proj?.members?.some(m => m.uid === task.assignee_id);
            const newAssigneeId = isUser || isProjMem ? task.assignee_id : null;

            const taskRef = doc(db, `apps/${APP_ID}/tasks`, task.id);
            await updateDoc(taskRef, {
                project_id: transferProjectId || null,
                project_member_uids: proj ? proj.member_uids : [],
                assignee_id: newAssigneeId
            });
            toast.success('Task transferred');
            setIsTransferring(false);
        } catch (err) {
            console.error(err);
            toast.error('Failed to transfer task');
        } finally {
            setTransferring(false);
        }
    };

    if (typeof document === 'undefined') return null;

    return createPortal(
        <AnimatePresence>
            <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
                {/* Backdrop */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
                />

                {/* Modal Window */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    className="relative w-full max-w-2xl bg-slate-900 border border-slate-700/50 shadow-2xl rounded-2xl overflow-hidden flex flex-col max-h-[90vh]"
                >
                    {/* Header Strip */}
                    <div className={`h-2 w-full ${task.status === 'done' ? 'bg-emerald-500' :
                        task.status === 'in_progress' ? 'bg-indigo-500' :
                            task.status === 'overdue' ? 'bg-red-500' : 'bg-slate-600'
                        }`} />

                    {/* Header Content */}
                    <div className="flex items-start justify-between p-6 border-b border-white/5">
                        <div className="pr-8">
                            <h2 className="text-2xl font-bold text-white mb-3">{task.title}</h2>
                            <div className="flex flex-wrap gap-2">
                                {statusBadge(task.status)}
                                {priorityBadge(task.priority)}
                                {typeBadge(task.type)}
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg transition-colors flex-shrink-0"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* Scrollable Body */}
                    <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-8">

                        {/* Summary Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            {/* Assignee */}
                            <div className="bg-slate-950/50 rounded-xl p-3 border border-white/5">
                                <div className="flex items-center gap-2 mb-1">
                                    <UserCircle size={14} className="text-indigo-400" />
                                    <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Assignee</span>
                                </div>
                                <p className="text-sm font-medium text-slate-200 truncate">
                                    {task.assignee_name || task.assignee_email || 'Unassigned'}
                                </p>
                            </div>

                            {/* Client */}
                            <div className="bg-slate-950/50 rounded-xl p-3 border border-white/5">
                                <div className="flex items-center gap-2 mb-1">
                                    <Users size={14} className="text-emerald-400" />
                                    <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Client</span>
                                </div>
                                <p className="text-sm font-medium text-slate-200 truncate">
                                    {clientName || 'None'}
                                </p>
                            </div>

                            {/* Project */}
                            <div className="bg-slate-950/50 rounded-xl p-3 border border-white/5">
                                <div className="flex items-center gap-2 mb-1">
                                    <FolderKanban size={14} className="text-amber-400" />
                                    <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Project</span>
                                </div>
                                {isTransferring ? (
                                    <div className="flex flex-col gap-2 mt-1.5">
                                        <select
                                            className="w-full bg-slate-900 border border-slate-700 text-slate-300 rounded p-1 text-xs focus:outline-none focus:border-amber-500"
                                            value={transferProjectId}
                                            onChange={e => setTransferProjectId(e.target.value)}
                                        >
                                            <option value="">— No project —</option>
                                            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                        </select>
                                        <div className="flex items-center gap-2">
                                            <button onClick={handleTransfer} disabled={transferring} className="flex-1 py-1 bg-amber-500 text-slate-900 font-bold text-[10px] rounded hover:bg-amber-600 disabled:opacity-50">Save</button>
                                            <button onClick={() => setIsTransferring(false)} className="flex-1 py-1 bg-slate-800 text-slate-300 font-bold text-[10px] rounded hover:bg-slate-700">Cancel</button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-between">
                                        <p className="text-sm font-medium text-slate-200 truncate">
                                            {projectName || 'None'}
                                        </p>
                                        {(isOwner || isAssignee) && (
                                            <button onClick={() => { setTransferProjectId(task.project_id || ''); setIsTransferring(true); }} className="text-[10px] font-bold text-amber-500 hover:text-amber-400 px-2 py-0.5 rounded bg-amber-500/10 transition-colors">
                                                Transfer
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Due Date */}
                            <div className="bg-slate-950/50 rounded-xl p-3 border border-white/5">
                                <div className="flex items-center gap-2 mb-1">
                                    <Calendar size={14} className="text-rose-400" />
                                    <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Due Date</span>
                                </div>
                                <p className="text-sm font-medium text-slate-200 truncate">
                                    {task.due_date ? formatDate(task.due_date) : 'No due date'}
                                </p>
                            </div>
                        </div>

                        {/* Description Section */}
                        <div className="bg-slate-950/20 rounded-xl p-5 border border-white/5">
                            <h3 className="flex items-center gap-2 text-sm font-bold text-slate-300 mb-3 border-b border-white/5 pb-2">
                                <AlignLeft size={16} className="text-slate-500" />
                                Description Details
                            </h3>
                            <div className="text-sm text-slate-400 whitespace-pre-wrap leading-relaxed">
                                {task.description ? task.description : <span className="italic text-slate-600">No description provided for this task.</span>}
                            </div>
                        </div>

                        {/* Additional Info Row (Tags & Time) */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Meta Metrics */}
                            <div className="space-y-4">
                                <h3 className="flex items-center gap-2 text-sm font-bold text-slate-300 mb-3 border-b border-white/5 pb-2">
                                    <Activity size={16} className="text-slate-500" />
                                    Metrics & Tags
                                </h3>

                                <div className="flex items-center justify-between bg-slate-950/50 p-3 rounded-xl border border-white/5">
                                    <div className="flex items-center gap-2 text-slate-400">
                                        <Clock size={16} className="text-indigo-400" />
                                        <span className="text-xs font-semibold uppercase">Total Tracked Time</span>
                                    </div>
                                    <span className="text-sm font-mono font-bold text-indigo-300">{formatDuration(task.total_time_ms || 0)}</span>
                                </div>

                                {task.tags && task.tags.length > 0 && (
                                    <div className="flex flex-wrap gap-2 pt-2">
                                        {task.tags.map(tag => (
                                            <span key={tag} className="flex items-center gap-1.5 px-3 py-1 bg-slate-800 text-slate-300 rounded-lg text-xs font-medium border border-slate-700/50">
                                                <Tag size={12} className="text-slate-500" />
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Notes & Updates Section */}
                        <div className="bg-slate-950/20 rounded-xl p-5 border border-white/5 space-y-4">
                            <h3 className="flex items-center gap-2 text-sm font-bold text-slate-300 border-b border-white/5 pb-2">
                                <MessageSquareText size={16} className="text-indigo-400" />
                                Task Updates & Notes
                            </h3>

                            {/* Notes Feed */}
                            <div className="space-y-3 max-h-64 overflow-y-auto custom-scrollbar pr-2">
                                {task.notes && task.notes.length > 0 ? (
                                    [...(task.notes || [])].sort((a, b) => b.created_at.getTime() - a.created_at.getTime()).map(note => (
                                        <div key={note.id} className="p-3 bg-slate-900/50 rounded-xl border border-white/5 text-xs">
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="font-bold text-indigo-300">{note.author_name}</span>
                                                <span className="text-slate-500 text-[10px]">{formatDate(note.created_at)}</span>
                                            </div>
                                            <p className="text-slate-300 leading-relaxed whitespace-pre-wrap">{note.content}</p>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-center py-4 text-slate-600 text-[11px] italic">No updates posted yet.</p>
                                )}
                            </div>

                            {/* Add Note Input */}
                            {canPostNote && (
                                <form onSubmit={handleAddNote} className="relative pt-2">
                                    <textarea
                                        value={noteContent}
                                        onChange={(e) => setNoteContent(e.target.value)}
                                        placeholder="Add a progress update..."
                                        className="w-full bg-slate-950 border border-slate-700/50 rounded-xl px-4 py-3 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 transition-all resize-none min-h-[80px]"
                                    />
                                    <button
                                        type="submit"
                                        disabled={submittingNote || !noteContent.trim()}
                                        className="absolute right-3 bottom-3 p-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 text-white rounded-lg transition-all shadow-lg shadow-indigo-500/20"
                                    >
                                        <Send size={14} className={submittingNote ? 'animate-pulse' : ''} />
                                    </button>
                                </form>
                            )}
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>,
        document.body
    );
};

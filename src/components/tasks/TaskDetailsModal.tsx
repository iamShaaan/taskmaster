import React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar, Clock, Tag, FolderKanban, Users, UserCircle, AlignLeft, Activity } from 'lucide-react';
import type { Task } from '../../types';
import { statusBadge, priorityBadge, typeBadge } from '../ui/Badge';
import { formatDuration, formatDate } from '../../utils/timeFormat';
import { useAppStore } from '../../store';

interface TaskDetailsModalProps {
    task: Task;
    onClose: () => void;
}

export const TaskDetailsModal: React.FC<TaskDetailsModalProps> = ({ task, onClose }) => {
    const { clients, projects } = useAppStore();
    const clientName = task.client_id ? clients.find(c => c.id === task.client_id)?.name : null;
    const projectName = task.project_id ? projects.find(p => p.id === task.project_id)?.name : null;

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
                            task.status === 'error' ? 'bg-red-500' : 'bg-slate-600'
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
                                <p className="text-sm font-medium text-slate-200 truncate">
                                    {projectName || 'None'}
                                </p>
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
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>,
        document.body
    );
};

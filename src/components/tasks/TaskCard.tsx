import React from 'react';
import { motion } from 'framer-motion';
import { Paperclip, Tag, Calendar, Play, Square, Timer, Pencil, Trash2 } from 'lucide-react';
import type { Task } from '../../types';
import { statusBadge, priorityBadge, typeBadge } from '../ui/Badge';
import { formatDuration, formatDate, isOverdue } from '../../utils/timeFormat';
import { useTimer } from '../../hooks/useTimer';
import { deleteDocById } from '../../firebase/firestore';
import toast from 'react-hot-toast';

interface TaskCardProps {
    task: Task;
    onEdit: (task: Task) => void;
    compact?: boolean;
}

export const TaskCard: React.FC<TaskCardProps> = ({ task, onEdit, compact = false }) => {
    const { isRunning, elapsed, start, stop } = useTimer(task.id, task.time_logs || []);
    const overdue = task.due_date ? isOverdue(task.due_date) && task.status !== 'done' : false;

    const handleDelete = async () => {
        if (!confirm('Delete this task?')) return;
        try {
            await deleteDocById('tasks', task.id);
            toast.success('Task deleted');
        } catch {
            toast.error('Failed to delete task');
        }
    };

    const totalMs = task.total_time_ms + (isRunning ? elapsed : 0);

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`group bg-slate-800/80 border ${overdue ? 'border-red-500/40' : 'border-slate-700/50'} rounded-xl p-4 hover:border-indigo-500/40 transition-all duration-200 hover:bg-slate-800`}
        >
            {/* Header */}
            <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="text-slate-100 font-medium text-sm leading-snug flex-1 line-clamp-2">{task.title}</h3>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <button onClick={() => onEdit(task)} className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-400 hover:bg-indigo-500/10 transition-all">
                        <Pencil size={13} />
                    </button>
                    <button onClick={handleDelete} className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all">
                        <Trash2 size={13} />
                    </button>
                </div>
            </div>

            {/* Badges */}
            <div className="flex flex-wrap gap-1.5 mb-3">
                {statusBadge(task.status)}
                {priorityBadge(task.priority)}
                {typeBadge(task.type)}
            </div>

            {/* Meta info */}
            {!compact && (
                <div className="space-y-1.5 mb-3">
                    {task.due_date && (
                        <div className={`flex items-center gap-1.5 text-xs ${overdue ? 'text-red-400' : 'text-slate-500'}`}>
                            <Calendar size={12} />
                            <span>{overdue ? 'Overdue · ' : ''}{formatDate(task.due_date)}</span>
                        </div>
                    )}
                    {task.attachments?.length > 0 && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                            <Paperclip size={12} />
                            <span>{task.attachments.length} attachment{task.attachments.length !== 1 ? 's' : ''}</span>
                        </div>
                    )}
                    {task.tags?.length > 0 && (
                        <div className="flex items-center gap-1 flex-wrap">
                            <Tag size={11} className="text-slate-600" />
                            {task.tags.map((t) => (
                                <span key={t} className="text-xs text-slate-500 bg-slate-700/60 px-1.5 py-0.5 rounded-full">{t}</span>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Timer Row */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-700/50">
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Timer size={12} className={isRunning ? 'text-emerald-400' : ''} />
                    <span className={isRunning ? 'text-emerald-400 font-mono font-medium' : 'font-mono'}>
                        {totalMs > 0 ? formatDuration(totalMs) : '0s'}
                    </span>
                </div>
                <button
                    onClick={isRunning ? stop : start}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${isRunning
                        ? 'bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25'
                        : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25'
                        }`}
                >
                    {isRunning ? <Square size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" />}
                    {isRunning ? 'Stop' : 'Start'}
                </button>
            </div>
        </motion.div>
    );
};

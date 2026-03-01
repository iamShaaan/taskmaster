import React from 'react';
import { motion } from 'framer-motion';
import { Tag, Calendar, Play, Square, Timer, Pencil, Trash2 } from 'lucide-react';
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
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            whileHover={{ y: -4 }}
            className={`group glass-card glass-card-hover rounded-xl p-5 relative overflow-hidden`}
        >
            {/* Left Accent Strip */}
            <div className={`absolute left-0 top-0 bottom-0 w-1 ${task.status === 'done' ? 'bg-emerald-500' :
                task.status === 'in_progress' ? 'bg-indigo-500' :
                    task.status === 'error' ? 'bg-red-500' : 'bg-slate-600'
                } opacity-50 group-hover:opacity-100 transition-opacity`} />

            {/* Header */}
            <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex-1">
                    <h3 className="text-slate-50 font-semibold text-sm leading-relaxed line-clamp-2 group-hover:text-indigo-300 transition-colors">
                        {task.title}
                    </h3>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                    <button onClick={() => onEdit(task)} className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 transition-all">
                        <Pencil size={14} />
                    </button>
                    <button onClick={handleDelete} className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all">
                        <Trash2 size={14} />
                    </button>
                </div>
            </div>

            {/* Badges */}
            <div className="flex flex-wrap gap-2 mb-4">
                {statusBadge(task.status)}
                {priorityBadge(task.priority)}
                {typeBadge(task.type)}
            </div>

            {/* Meta info */}
            {!compact && (
                <div className="space-y-2 mb-4">
                    {task.due_date && (
                        <div className={`flex items-center gap-2 text-xs py-1 px-2 rounded-md ${overdue ? 'text-red-300 bg-red-500/10' : 'text-slate-400 bg-slate-800/50'}`}>
                            <Calendar size={13} className={overdue ? 'animate-pulse' : ''} />
                            <span className="font-medium">{overdue ? 'Overdue · ' : ''}{formatDate(task.due_date)}</span>
                        </div>
                    )}
                    {task.tags?.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap pl-1">
                            {task.tags.map((t) => (
                                <span key={t} className="text-[10px] text-slate-400 bg-slate-700/40 border border-slate-600/30 px-2 py-0.5 rounded-md flex items-center gap-1">
                                    <Tag size={10} /> {t}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Timer Row */}
            <div className="flex items-center justify-between pt-4 border-t border-white/5">
                <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-md ${isRunning ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800/80 text-slate-500'}`}>
                        <Timer size={14} className={isRunning ? 'animate-spin-slow' : ''} />
                    </div>
                    <span className={`text-xs font-mono font-bold tracking-tight ${isRunning ? 'text-emerald-400' : 'text-slate-400'}`}>
                        {totalMs > 0 ? formatDuration(totalMs) : '00:00:00'}
                    </span>
                </div>
                <button
                    onClick={isRunning ? stop : start}
                    className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95 ${isRunning
                        ? 'bg-red-500 text-white hover:bg-red-600 shadow-red-500/20'
                        : 'bg-indigo-500 text-white hover:bg-indigo-600 shadow-indigo-500/20'
                        }`}
                >
                    {isRunning ? <Square size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" />}
                    {isRunning ? 'STOP' : 'START'}
                </button>
            </div>
        </motion.div>
    );
};

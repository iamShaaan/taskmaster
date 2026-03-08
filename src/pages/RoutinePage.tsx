import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../store';
import { useAuth } from '../hooks/useAuth';
import { format } from 'date-fns';
import { 
    Plus, Activity, BrainCircuit, DollarSign, Briefcase, 
    CheckCircle2, Circle, Clock, TrendingUp, Sparkles, Loader2, Gamepad2, Edit2, Trash2 
} from 'lucide-react';
import { Modal } from '../components/ui/Modal';
import { RoutineForm } from '../components/routine/RoutineForm';
import { createDoc, updateDocById, deleteDocById } from '../firebase/firestore';
import toast from 'react-hot-toast';
import type { RoutineCategory, Routine } from '../types';

const CATEGORY_ICONS: Record<RoutineCategory, React.ElementType> = {
    body: Activity,
    mind: BrainCircuit,
    finance: DollarSign,
    office: Briefcase,
    fun: Gamepad2,
};

const CATEGORY_COLORS: Record<RoutineCategory, { bg: string; text: string; border: string; label: string }> = {
    body: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20', label: 'Body' },
    mind: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/20', label: 'Mind' },
    finance: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20', label: 'Finance' },
    office: { bg: 'bg-indigo-500/10', text: 'text-indigo-400', border: 'border-indigo-500/20', label: 'Office' },
    fun: { bg: 'bg-pink-500/10', text: 'text-pink-400', border: 'border-pink-500/20', label: 'Fun' },
};

export const RoutinePage: React.FC = () => {
    const { routines, dailyLogs, tasks } = useAppStore();
    const { user } = useAuth();
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [routineToEdit, setRoutineToEdit] = useState<Routine | null>(null);
    
    // Active Tab state
    const [activeTab, setActiveTab] = useState<RoutineCategory | 'all'>('all');

    // Date calculations
    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd'); // e.g. "2026-03-08"
    const displayDate = format(today, 'EEEE, MMMM do');

    // Filter logs for today
    const logsToday = useMemo(() => dailyLogs.filter(l => l.date === todayStr), [dailyLogs, todayStr]);

    // Financial log (the one without a routine_id)
    const financeLog = useMemo(() => logsToday.find(l => !l.routine_id) || null, [logsToday]);

    const [spentInput, setSpentInput] = useState(financeLog?.spent?.toString() || '');
    const [earnedInput, setEarnedInput] = useState(financeLog?.earned?.toString() || '');
    const [isSavingFinance, setIsSavingFinance] = useState(false);

    // Filter and sort active routines
    const activeRoutines = useMemo(() => {
        return routines
            .filter(r => !r.is_archived)
            .sort((a, b) => a.start_time.localeCompare(b.start_time));
    }, [routines]);

    // Derived stats
    const { completionRate, completedCount } = useMemo(() => {
        if (activeRoutines.length === 0) return { completionRate: 0, completedCount: 0 };
        const completed = activeRoutines.filter(r => {
            const log = logsToday.find(l => l.routine_id === r.id);
            return log?.completed;
        }).length;
        return {
            completionRate: Math.round((completed / activeRoutines.length) * 100),
            completedCount: completed,
        };
    }, [activeRoutines, logsToday]);

    // Toggle logic for checking/unchecking a routine
    const toggleRoutine = async (routineId: string) => {
        if (!user) return;
        
        const existingLog = logsToday.find(l => l.routine_id === routineId);
        const isCurrentlyCompleted = existingLog?.completed || false;
        const newStatus = !isCurrentlyCompleted;

        try {
            if (existingLog) {
                // Update
                await updateDocById('daily_logs', existingLog.id, { completed: newStatus });
            } else {
                // Create
                await createDoc('daily_logs', {
                    date: todayStr,
                    routine_id: routineId,
                    completed: newStatus,
                    owner_id: user.uid,
                });
            }
        } catch (error) {
            console.error('Failed to toggle routine:', error);
            toast.error('Failed to update status');
        }
    };

    const handleDeleteRoutine = async (e: React.MouseEvent, routineId: string) => {
        e.stopPropagation();
        if (!confirm('Are you sure you want to delete this routine?')) return;
        try {
            await deleteDocById('routines', routineId);
            toast.success('Routine deleted');
        } catch (error) {
            console.error('Error deleting routine:', error);
            toast.error('Failed to delete routine');
        }
    };

    const handleEditRoutine = (e: React.MouseEvent, routine: Routine) => {
        e.stopPropagation();
        setRoutineToEdit(routine);
        setIsFormOpen(true);
    };

    const handleSaveFinance = async () => {
        if (!user) return;
        setIsSavingFinance(true);
        const spentVal = parseFloat(spentInput) || 0;
        const earnedVal = parseFloat(earnedInput) || 0;

        try {
            if (financeLog) {
                await updateDocById('daily_logs', financeLog.id, {
                    spent: spentVal,
                    earned: earnedVal,
                });
            } else {
                await createDoc('daily_logs', {
                    date: todayStr,
                    spent: spentVal,
                    earned: earnedVal,
                    owner_id: user.uid,
                });
            }
            toast.success('Finances updated!');
        } catch (error) {
            console.error('Failed to save finance:', error);
            toast.error('Failed to update finances');
        } finally {
            setIsSavingFinance(false);
        }
    };

    const handleDragStart = (e: React.DragEvent, taskId: string, taskTitle: string) => {
        e.dataTransfer.setData('taskId', taskId);
        e.dataTransfer.setData('taskTitle', taskTitle);
    };

    const handleDropOnTimeline = (e: React.DragEvent) => {
        e.preventDefault();
        const taskId = e.dataTransfer.getData('taskId');
        const taskTitle = e.dataTransfer.getData('taskTitle');
        if (taskId && taskTitle) {
            // Open the routine form with the task details pre-filled
            setRoutineToEdit({
                title: taskTitle,
                linked_task_id: taskId,
                category: 'office',
                start_time: '09:00',
                end_time: '10:00'
            } as any);
            setIsFormOpen(true);
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const displayGroup = activeTab === 'all' 
        ? activeRoutines 
        : activeRoutines.filter(r => r.category === activeTab);

    // Filter open/in-progress tasks for the Office sidebar
    const activeTasks = useMemo(() => {
        return tasks.filter(t => t.status === 'open' || t.status === 'in_progress');
    }, [tasks]);

    return (
        <div className="max-w-5xl mx-auto space-y-6 sm:space-y-8 animate-fade-in pb-10">
            {/* Header */}
            <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mt-2">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-black text-slate-100 tracking-tight flex items-center gap-3">
                        Daily Routine
                        <Sparkles size={24} className="text-indigo-400" />
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">{displayDate} • {activeRoutines.length} items scheduled</p>
                </div>
                <button
                    onClick={() => {
                        setRoutineToEdit(null);
                        setIsFormOpen(true);
                    }}
                    className="w-full sm:w-auto px-5 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white font-bold rounded-xl shadow-[0_0_20px_rgba(99,102,241,0.2)] transition-all flex items-center justify-center gap-2"
                >
                    <Plus size={18} />
                    <span>Add Routine</span>
                </button>
            </header>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="bg-slate-800/80 border border-slate-700/50 rounded-2xl p-5 flex flex-col justify-between relative overflow-hidden">
                    <div className="relative z-10 flex items-center justify-between mb-4">
                        <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-400"><TrendingUp size={18} /></div>
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Today's Progress</span>
                    </div>
                    <div className="relative z-10">
                        <div className="flex items-end gap-2">
                            <p className="text-3xl font-black text-slate-100">{completionRate}%</p>
                            <p className="text-slate-400 font-medium mb-1 shrink-0">{completedCount} of {activeRoutines.length} done</p>
                        </div>
                        <div className="mt-4 h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-700">
                            <motion.div
                                className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full shadow-[0_0_10px_rgba(99,102,241,0.5)]"
                                initial={{ width: 0 }}
                                animate={{ width: `${completionRate}%` }}
                                transition={{ duration: 0.8, ease: 'easeOut' }}
                            />
                        </div>
                    </div>
                    <div className="absolute right-[-20%] top-[-20%] w-32 h-32 bg-indigo-500/10 blur-[40px] rounded-full pointer-events-none" />
                </div>

                <div className="bg-slate-800/80 border border-slate-700/50 rounded-2xl p-5 relative overflow-hidden flex flex-col justify-between">
                    <div className="relative z-10 flex items-center justify-between mb-2">
                        <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400"><DollarSign size={18} /></div>
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Earned Today</span>
                    </div>
                    <div className="relative z-10 flex-1 flex flex-col justify-end">
                        <p className="text-2xl font-black text-amber-400 tracking-tight">
                            ${financeLog?.earned?.toFixed(2) || '0.00'}
                        </p>
                    </div>
                    <div className="absolute right-[-20%] top-[-20%] w-32 h-32 bg-amber-500/10 blur-[40px] rounded-full pointer-events-none" />
                </div>

                <div className="bg-slate-800/80 border border-slate-700/50 rounded-2xl p-5 relative overflow-hidden flex flex-col justify-between">
                    <div className="relative z-10 flex items-center justify-between mb-2">
                        <div className="p-2.5 rounded-xl bg-red-500/20 text-red-400"><DollarSign size={18} /></div>
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Spent Today</span>
                    </div>
                    <div className="relative z-10 flex-1 flex flex-col justify-end">
                        <p className="text-2xl font-black text-red-400 tracking-tight">
                            ${financeLog?.spent?.toFixed(2) || '0.00'}
                        </p>
                    </div>
                    <div className="absolute right-[-20%] top-[-20%] w-32 h-32 bg-red-500/10 blur-[40px] rounded-full pointer-events-none" />
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex space-x-2 overflow-x-auto custom-scrollbar pb-2">
                <button
                    onClick={() => setActiveTab('all')}
                    className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${
                        activeTab === 'all' 
                            ? 'bg-slate-700 text-white shadow-md' 
                            : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800 hover:text-slate-300'
                    }`}
                >
                    All Day Timeline
                </button>
                {(Object.keys(CATEGORY_ICONS) as RoutineCategory[]).map(cat => (
                    <button
                        key={cat}
                        onClick={() => setActiveTab(cat)}
                        className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all flex items-center gap-2 ${
                            activeTab === cat 
                                ? `${CATEGORY_COLORS[cat].bg} ${CATEGORY_COLORS[cat].border} border ${CATEGORY_COLORS[cat].text}` 
                                : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800 hover:text-slate-300 border border-transparent'
                        }`}
                    >
                        {React.createElement(CATEGORY_ICONS[cat], { size: 14 })}
                        {CATEGORY_COLORS[cat].label}
                    </button>
                ))}
            </div>

            {/* Main Content Area */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Routine List */}
                <div 
                    className={`col-span-1 ${activeTab === 'all' ? 'lg:col-span-3' : 'lg:col-span-2'} space-y-3 p-4 rounded-xl border border-transparent transition-colors ${activeTab === 'office' ? 'border-dashed border-indigo-500/30 bg-slate-800/20' : ''}`}
                    onDrop={activeTab === 'office' ? handleDropOnTimeline : undefined}
                    onDragOver={activeTab === 'office' ? handleDragOver : undefined}
                >
                    {activeTab === 'office' && (
                        <div className="mb-4 flex items-center gap-2 text-indigo-400 text-sm bg-indigo-500/10 p-3 rounded-lg border border-indigo-500/20">
                            <Briefcase size={16} />
                            <span>Drop tasks here to schedule them in your routine</span>
                        </div>
                    )}
                    <AnimatePresence mode="popLayout">
                        {displayGroup.length === 0 ? (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-slate-800/30 border border-slate-700/50 border-dashed rounded-2xl p-10 text-center"
                            >
                                <div className="p-4 bg-slate-800 rounded-full inline-flex mb-4">
                                    <Clock size={24} className="text-slate-500" />
                                </div>
                                <h3 className="text-slate-200 font-bold text-lg mb-1">No routines found</h3>
                                <p className="text-slate-500 text-sm">Add tasks to organize your perfect day.</p>
                            </motion.div>
                        ) : (
                            displayGroup.map((routine) => {
                                const log = logsToday.find(l => l.routine_id === routine.id);
                                const isCompleted = log?.completed;
                                const CatIcon = CATEGORY_ICONS[routine.category];
                                const catColor = CATEGORY_COLORS[routine.category];

                                return (
                                    <motion.div
                                        key={routine.id}
                                        layout
                                        initial={{ opacity: 0, scale: 0.98 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.98 }}
                                        className={`flex items-center gap-4 p-4 rounded-2xl border transition-all cursor-pointer ${
                                            isCompleted 
                                                ? 'bg-slate-800/40 border-slate-700/50' 
                                                : `bg-slate-800/80 border-slate-700 hover:border-slate-600 hover:shadow-lg hover:-translate-y-0.5`
                                        }`}
                                        onClick={() => toggleRoutine(routine.id)}
                                    >
                                        <button className={`p-1 flex-shrink-0 transition-colors ${
                                            isCompleted ? 'text-indigo-500' : 'text-slate-600 hover:text-indigo-400'
                                        }`}>
                                            {isCompleted ? <CheckCircle2 size={24} className="fill-indigo-500/20" /> : <Circle size={24} />}
                                        </button>
                                        
                                        <div className="flex-1 min-w-0 pr-4">
                                            <p className={`font-bold text-[15px] truncate transition-all ${
                                                isCompleted ? 'text-slate-500 line-through' : 'text-slate-200'
                                            }`}>
                                                {routine.title}
                                            </p>
                                            <div className="flex items-center gap-3 mt-1">
                                                <div className="flex items-center gap-1.5 text-slate-500 text-xs font-medium">
                                                    <Clock size={12} />
                                                    {routine.start_time} - {routine.end_time}
                                                </div>
                                                <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${catColor.bg} ${catColor.text}`}>
                                                    <CatIcon size={10} />
                                                    {catColor.label}
                                                </div>
                                                {routine.linked_task_id && (
                                                    <div className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-700/50 text-slate-400">
                                                        <Briefcase size={10} />
                                                        Task Linked
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button 
                                                onClick={(e) => handleEditRoutine(e, routine)}
                                                className="p-2 text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-all"
                                                title="Edit Routine"
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                            <button 
                                                onClick={(e) => handleDeleteRoutine(e, routine.id)}
                                                className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                                                title="Delete Routine"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </motion.div>
                                );
                            })
                        )}
                    </AnimatePresence>
                </div>

                {/* Specific Sections (Visible when a tab is active, or we can show Finance specifically) */}
                {activeTab !== 'all' && (
                    <div className="col-span-1 border-l border-slate-700/50 pl-0 lg:pl-6 space-y-6">
                        
                        {(activeTab === 'finance') && (
                            <motion.div 
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="bg-slate-800/80 border border-amber-500/20 rounded-2xl p-5 relative overflow-hidden"
                            >
                                <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-[40px] pointer-events-none" />
                                <h3 className="text-amber-400 font-bold mb-4 flex items-center gap-2">
                                    <DollarSign size={18} />
                                    Daily Finance Ledger
                                </h3>

                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">
                                            Earned Today ($)
                                        </label>
                                        <input
                                            type="number"
                                            value={earnedInput}
                                            onChange={e => setEarnedInput(e.target.value)}
                                            placeholder="0.00"
                                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-slate-200 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 transition-all font-mono"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">
                                            Spent Today ($)
                                        </label>
                                        <input
                                            type="number"
                                            value={spentInput}
                                            onChange={e => setSpentInput(e.target.value)}
                                            placeholder="0.00"
                                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-slate-200 focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/20 transition-all font-mono"
                                        />
                                    </div>

                                    <button
                                        onClick={handleSaveFinance}
                                        disabled={isSavingFinance}
                                        className="w-full py-2.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 font-bold rounded-xl transition-all flex items-center justify-center gap-2"
                                    >
                                        {isSavingFinance ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                                        Save Finances
                                    </button>
                                </div>
                            </motion.div>
                        )}

                        {activeTab === 'body' && (
                            <div className="bg-slate-800/50 border border-emerald-500/20 rounded-2xl p-5 text-center">
                                <div className="p-3 bg-emerald-500/10 rounded-full inline-flex mb-3">
                                    <Activity size={24} className="text-emerald-400" />
                                </div>
                                <h3 className="text-emerald-400 font-bold mb-2">Body & Health</h3>
                                <p className="text-slate-400 text-sm">Log your physical health tasks, gym sessions, and meals here to track your daily physical progress.</p>
                            </div>
                        )}

                        {activeTab === 'mind' && (
                            <div className="bg-slate-800/50 border border-purple-500/20 rounded-2xl p-5 text-center">
                                <div className="p-3 bg-purple-500/10 rounded-full inline-flex mb-3">
                                    <BrainCircuit size={24} className="text-purple-400" />
                                </div>
                                <h3 className="text-purple-400 font-bold mb-2">Mind & Soul</h3>
                                <p className="text-slate-400 text-sm">Focus on mental clarity. This includes meditation, reading, and learning new things outside of work.</p>
                            </div>
                        )}

                        {activeTab === 'office' && (
                            <div className="flex flex-col h-full bg-slate-800/30 border border-indigo-500/20 rounded-2xl overflow-hidden">
                                <div className="p-4 border-b border-slate-700/50 bg-slate-800/80">
                                    <h3 className="text-indigo-400 font-bold flex items-center gap-2">
                                        <Briefcase size={18} />
                                        Task Backlog
                                    </h3>
                                    <p className="text-slate-400 text-xs mt-1">Drag tasks to the timeline to schedule them.</p>
                                </div>
                                
                                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar max-h-[500px]">
                                    {activeTasks.length === 0 ? (
                                        <div className="text-center p-6 text-slate-500 text-sm">
                                            No active tasks found in projects.
                                        </div>
                                    ) : (
                                        activeTasks.map(task => (
                                            <div
                                                key={task.id}
                                                draggable
                                                onDragStart={(e) => handleDragStart(e, task.id, task.title)}
                                                className="p-3 bg-slate-800 border border-slate-700 rounded-xl cursor-grab active:cursor-grabbing hover:border-indigo-500/50 hover:shadow-lg transition-all"
                                            >
                                                <p className="text-sm font-bold text-slate-200 mb-1">{task.title}</p>
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                                                        task.priority === 'high' ? 'bg-red-500/20 text-red-400' :
                                                        task.priority === 'medium' ? 'bg-amber-500/20 text-amber-400' :
                                                        'bg-emerald-500/20 text-emerald-400'
                                                    }`}>
                                                        {task.priority}
                                                    </span>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}

                        {activeTab === 'fun' && (
                            <div className="bg-slate-800/50 border border-pink-500/20 rounded-2xl p-5 text-center">
                                <div className="p-3 bg-pink-500/10 rounded-full inline-flex mb-3">
                                    <Gamepad2 size={24} className="text-pink-400" />
                                </div>
                                <h3 className="text-pink-400 font-bold mb-2">Fun & Recreation</h3>
                                <p className="text-slate-400 text-sm">Schedule time for gaming, hobbies, and pure enjoyment. Resting is productive too.</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Modal for adding Routine */}
            <Modal isOpen={isFormOpen} onClose={() => { setIsFormOpen(false); setRoutineToEdit(null); }} title={routineToEdit ? "Edit Daily Task" : "Add Daily Task"}>
                <RoutineForm onClose={() => { setIsFormOpen(false); setRoutineToEdit(null); }} initialData={routineToEdit || undefined} />
            </Modal>
        </div>
    );
};

import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, updateDoc, deleteDoc, addDoc, arrayUnion } from 'firebase/firestore';
import { db, APP_ID } from '../firebase/config';
import { toast } from 'react-hot-toast';
import { Play, Square, Copy, Trash2, Loader2, AlertCircle } from 'lucide-react';

const DebugStop: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [tasks, setTasks] = useState<any[]>([]);
    const [results, setResults] = useState<string[]>([]);

    useEffect(() => {
        fetchTasksWithTimers();
    }, []);

    const fetchTasksWithTimers = async () => {
        setLoading(true);
        try {
            const snapshot = await getDocs(collection(db, `apps/${APP_ID}/tasks`));
            const taskList = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            setTasks(taskList.filter((t: any) => t.active_timer));
        } catch (err: any) {
            toast.error('Failed to fetch tasks: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const forceStopTask = async (task: any) => {
        setLoading(true);
        setResults(prev => [...prev, `Attempting to force stop: ${task.title || task.id}`]);
        try {
            const startTime = task.active_timer.start?.toDate ? task.active_timer.start.toDate() : new Date(task.active_timer.start);
            const now = new Date();
            const duration_ms = now.getTime() - startTime.getTime();

            const timeLog = {
                start: startTime,
                end: now,
                duration_ms: Math.max(0, duration_ms),
                user_id: task.active_timer.user_id || 'unknown',
                user_name: task.active_timer.user_name || 'System Force-Stop',
                is_archived: false
            };

            const updatedLogs = [...(task.time_logs || []), timeLog];
            const totalMs = updatedLogs.reduce((acc: number, l: any) => acc + (l.duration_ms || 0), 0);

            await updateDoc(doc(db, `apps/${APP_ID}/tasks`, task.id), {
                active_timer: null,
                time_logs: updatedLogs,
                total_time_ms: totalMs
            });

            if (task.project_id) {
                const projectRef = doc(db, `apps/${APP_ID}/projects`, task.project_id);
                const dateStr = startTime.toISOString().split('T')[0];
                await updateDoc(projectRef, {
                    time_entries: arrayUnion({
                        task_id: task.id,
                        task_title: task.title || 'Task',
                        date: dateStr,
                        start: startTime,
                        end: now,
                        duration_ms: Math.max(0, duration_ms),
                        user_id: task.active_timer.user_id || 'unknown',
                        user_name: task.active_timer.user_name || 'System Force-Stop',
                        is_archived: false
                    })
                });
            }

            toast.success('Task stopped successfully.');
            setResults(prev => [...prev, `Success: Stopped ${task.title}`]);
            fetchTasksWithTimers();
        } catch (err: any) {
            toast.error('Error stopping task: ' + err.message);
            setResults(prev => [...prev, `Error: ${err.message}`]);
        } finally {
            setLoading(false);
        }
    };

    const cloneAndDeleteTask = async (task: any) => {
        if (!window.confirm('This will create a NEW copy of the task (CLEAN) and DELETE the old one. Continue?')) return;

        setLoading(true);
        setResults(prev => [...prev, `Cloning and Deleting: ${task.title || task.id}`]);
        try {
            // 1. Create a clean copy (no active_timer)
            const { id, ...taskData } = task; // Clean up id
            const cleanTask = {
                ...taskData,
                active_timer: null,
                created_at: new Date()
            };

            const newDoc = await addDoc(collection(db, `apps/${APP_ID}/tasks`), cleanTask);
            setResults(prev => [...prev, `Created clone: ${newDoc.id}`]);

            // 2. Delete the old one
            await deleteDoc(doc(db, `apps/${APP_ID}/tasks`, task.id));
            setResults(prev => [...prev, `Deleted old task: ${task.id}`]);

            toast.success('Task cloned and deleted successfully.');
            fetchTasksWithTimers();
        } catch (err: any) {
            toast.error('Error cloning task: ' + err.message);
            setResults(prev => [...prev, `Error: ${err.message}`]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-8 bg-slate-900 min-h-screen text-slate-100">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">Diagnostic Timer Fixer</h1>
                    <p className="text-slate-400">Identify and resolve stubborn tasks that won't stop.</p>
                </div>
                <button
                    onClick={fetchTasksWithTimers}
                    disabled={loading}
                    className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-lg transition-colors"
                >
                    {loading ? <Loader2 size={18} className="animate-spin" /> : 'Refresh List'}
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                    <h2 className="text-lg font-semibold flex items-center gap-2 text-indigo-400">
                        <AlertCircle size={20} /> Tasks with Active Timers ({tasks.length})
                    </h2>

                    {tasks.length === 0 && !loading && (
                        <div className="p-8 border-2 border-dashed border-slate-800 rounded-2xl text-center text-slate-500">
                            No tasks found with a running timer.
                        </div>
                    )}

                    {tasks.map((task) => (
                        <div key={task.id} className="bg-slate-800/50 border border-slate-700 p-4 rounded-xl flex flex-col gap-4">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="font-bold text-slate-100">{task.title || 'Untitled Task'}</h3>
                                    <p className="text-xs text-slate-500 font-mono mt-1">ID: {task.id}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Play size={14} className="text-emerald-400 animate-pulse" />
                                    <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest">Running</span>
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <button
                                    onClick={() => forceStopTask(task)}
                                    disabled={loading}
                                    className="flex-1 flex items-center justify-center gap-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/20 py-2 rounded-lg transition-all text-sm font-bold"
                                >
                                    <Square size={14} /> Force Stop
                                </button>
                                <button
                                    onClick={() => cloneAndDeleteTask(task)}
                                    disabled={loading}
                                    className="flex-1 flex items-center justify-center gap-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 py-2 rounded-lg transition-all text-sm font-bold"
                                >
                                    <Copy size={14} /> Clone & Delete
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="space-y-4">
                    <h2 className="text-lg font-semibold text-slate-400">Activity Log</h2>
                    <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 font-mono text-xs h-[400px] overflow-y-auto">
                        {results.length === 0 && <span className="text-slate-700 italic">Logs will appear here...</span>}
                        {results.map((r, i) => (
                            <div key={i} className="mb-2 flex gap-2">
                                <span className="text-slate-600">[{new Date().toLocaleTimeString()}]</span>
                                <span className={r.startsWith('Error') ? 'text-red-400' : 'text-emerald-400'}>{r}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DebugStop;

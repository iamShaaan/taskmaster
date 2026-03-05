import React, { useState } from 'react';
import { collection, getDocs, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db, APP_ID } from '../firebase/config';
import { toast } from 'react-hot-toast';

const DebugStop: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState<string[]>([]);

    const resetTimers = async () => {
        setLoading(true);
        setResults(["Starting reset..."]);

        try {
            const tasksRef = collection(db, `apps/${APP_ID}/tasks`);
            const snapshot = await getDocs(tasksRef);

            let fixedCount = 0;

            for (const taskDoc of snapshot.docs) {
                const data = taskDoc.data();

                if (data.active_timer) {
                    const startTime = data.active_timer.start?.toDate ? data.active_timer.start.toDate() : new Date(data.active_timer.start);
                    const now = new Date();
                    const duration_ms = now.getTime() - startTime.getTime();

                    const timeLog = {
                        start: startTime,
                        end: now,
                        duration_ms: Math.max(0, duration_ms),
                        user_id: data.active_timer.user_id || 'unknown',
                        user_name: data.active_timer.user_name || 'System Auto-Stop',
                        is_archived: false
                    };

                    const updatedLogs = [...(data.time_logs || []), timeLog];
                    const totalMs = updatedLogs.reduce((acc: number, l: any) => acc + (l.duration_ms || 0), 0);

                    await updateDoc(taskDoc.ref, {
                        active_timer: null,
                        time_logs: updatedLogs,
                        total_time_ms: totalMs
                    });

                    if (data.project_id) {
                        const projectRef = doc(db, `apps/${APP_ID}/projects`, data.project_id);
                        const dateStr = startTime.toISOString().split('T')[0];
                        await updateDoc(projectRef, {
                            time_entries: arrayUnion({
                                task_id: taskDoc.id,
                                task_title: data.title || 'Task',
                                date: dateStr,
                                start: startTime,
                                end: now,
                                duration_ms: Math.max(0, duration_ms),
                                user_id: data.active_timer.user_id || 'unknown',
                                user_name: data.active_timer.user_name || 'System Auto-Stop',
                                is_archived: false
                            })
                        });
                    }

                    fixedCount++;
                    setResults(prev => [...prev, `Fixed task: ${data.title || taskDoc.id}`]);
                }
            }

            setResults(prev => [...prev, `Done! Fixed ${fixedCount} timers.`]);
            toast.success(`Successfully stopped ${fixedCount} timers.`);
        } catch (err: any) {
            console.error(err);
            toast.error('Failed to reset timers: ' + err.message);
            setResults(prev => [...prev, `Error: ${err.message}`]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-8 bg-slate-900 min-h-screen text-slate-100">
            <h1 className="text-2xl font-bold mb-4">Fix Stuck Timers</h1>
            <p className="mb-6 text-slate-400">This will force-stop any currently running timer and save it as a finished record.</p>

            <button
                onClick={resetTimers}
                disabled={loading}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 px-6 py-2 rounded-lg font-medium transition-colors"
            >
                {loading ? 'Processing...' : 'Run Fix Now'}
            </button>

            <div className="mt-8 bg-slate-800 rounded-xl p-4 font-mono text-sm h-64 overflow-y-auto border border-slate-700">
                {results.map((r, i) => (
                    <div key={i} className="mb-1 text-emerald-400">&gt; {r}</div>
                ))}
            </div>
        </div>
    );
};

export default DebugStop;

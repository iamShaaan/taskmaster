import { useEffect, useRef, useState, useCallback } from 'react';
import { arrayUnion, doc, updateDoc } from 'firebase/firestore';
import { updateDocById } from '../firebase/firestore';
import { db, APP_ID, auth } from '../firebase/config';
import type { Task } from '../types';

export const useTimer = (task: Task) => {
    const isRunning = !!task.active_timer;
    const timerStartTime = task.active_timer?.start || null;
    const [elapsed, setElapsed] = useState(0);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        if (isRunning && timerStartTime) {
            const startTimeMs = timerStartTime instanceof Date ? timerStartTime.getTime() : (timerStartTime as any).toDate ? (timerStartTime as any).toDate().getTime() : new Date(timerStartTime).getTime();

            setElapsed(Date.now() - startTimeMs);

            intervalRef.current = setInterval(() => {
                setElapsed(Date.now() - startTimeMs);
            }, 1000);
        } else {
            if (intervalRef.current) clearInterval(intervalRef.current);
            setElapsed(0);
        }
        return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    }, [isRunning, timerStartTime]);

    const start = useCallback(async () => {
        if (isRunning) return;
        const now = new Date();
        const user = auth.currentUser;

        await updateDocById('tasks', task.id, {
            active_timer: {
                start: now,
                user_id: user?.uid || 'unknown'
            }
        });
    }, [isRunning, task.id]);

    const stop = useCallback(async () => {
        if (!isRunning || !timerStartTime) return;
        const endTime = new Date();
        const startTimeMs = timerStartTime instanceof Date ? timerStartTime.getTime() : (timerStartTime as any).toDate ? (timerStartTime as any).toDate().getTime() : new Date(timerStartTime).getTime();
        const duration_ms = endTime.getTime() - startTimeMs;

        const user = auth.currentUser;

        const newLog = {
            start: new Date(startTimeMs),
            end: endTime,
            duration_ms,
            user_id: user?.uid,
            user_name: user?.displayName || user?.email || undefined,
            user_email: user?.email || undefined
        };

        const updatedLogs = [...(task.time_logs || []), newLog];
        const totalMs = updatedLogs.reduce((acc, l) => acc + l.duration_ms, 0);

        // Save time_logs on the task and clear active_timer
        await updateDocById('tasks', task.id, {
            active_timer: null,
            time_logs: updatedLogs,
            total_time_ms: totalMs,
        });

        // If this task belongs to a project, append a time entry to the project doc
        if (task.project_id) {
            const dateStr = new Date(startTimeMs).toISOString().split('T')[0];
            const newEntry = {
                task_id: task.id,
                task_title: task.title || 'Task',
                date: dateStr,
                start: new Date(startTimeMs),
                end: endTime,
                duration_ms,
                user_id: user?.uid,
                user_name: user?.displayName || user?.email || undefined,
                user_email: user?.email || undefined
            };
            const ref = doc(db, `apps/${APP_ID}/projects`, task.project_id);
            await updateDoc(ref, { time_entries: arrayUnion(newEntry) });
        }
    }, [isRunning, timerStartTime, task.time_logs, task.id, task.project_id, task.title]);

    return { isRunning, elapsed, start, stop };
};

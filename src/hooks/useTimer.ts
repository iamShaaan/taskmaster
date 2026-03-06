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
            const startTimeMs = timerStartTime instanceof Date
                ? timerStartTime.getTime()
                : (timerStartTime as any).toDate
                    ? (timerStartTime as any).toDate().getTime()
                    : typeof (timerStartTime as any).seconds === 'number'
                        ? (timerStartTime as any).seconds * 1000
                        : new Date(timerStartTime as any).getTime();

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

        const activeTimerData: any = {
            start: now,
            user_id: user?.uid || 'unknown'
        };
        if (user?.displayName || user?.email) {
            activeTimerData.user_name = user.displayName || user.email;
        }

        await updateDocById('tasks', task.id, {
            active_timer: activeTimerData,
            status: 'in_progress'
        });
    }, [isRunning, task.id]);

    const stop = useCallback(async () => {
        if (!isRunning || !timerStartTime) return;
        const endTime = new Date();
        const startTimeMs = timerStartTime instanceof Date
            ? timerStartTime.getTime()
            : (timerStartTime as any).toDate
                ? (timerStartTime as any).toDate().getTime()
                : typeof (timerStartTime as any).seconds === 'number'
                    ? (timerStartTime as any).seconds * 1000
                    : new Date(timerStartTime as any).getTime();
        const duration_ms = endTime.getTime() - startTimeMs;

        const user = auth.currentUser;

        const newLog: any = {
            start: new Date(startTimeMs),
            end: endTime,
            duration_ms,
            user_id: user?.uid || 'unknown'
        };
        if (user?.displayName || user?.email) newLog.user_name = user.displayName || user.email;
        if (user?.email) newLog.user_email = user.email;

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
            const newEntry: any = {
                task_id: task.id,
                task_title: task.title || 'Task',
                date: dateStr,
                start: new Date(startTimeMs),
                end: endTime,
                duration_ms,
                user_id: user?.uid || 'unknown'
            };
            if (user?.displayName || user?.email) newEntry.user_name = user.displayName || user.email;
            if (user?.email) newEntry.user_email = user.email;

            const ref = doc(db, `apps/${APP_ID}/projects`, task.project_id);
            await updateDoc(ref, { time_entries: arrayUnion(newEntry) });
        }
    }, [isRunning, timerStartTime, task.time_logs, task.id, task.project_id, task.title]);

    return { isRunning, elapsed, start, stop };
};

import { useEffect, useRef, useState, useCallback } from 'react';
import { arrayUnion } from 'firebase/firestore';
import { doc, updateDoc } from 'firebase/firestore';
import { useAppStore } from '../store';
import { updateDocById } from '../firebase/firestore';
import { db, APP_ID } from '../firebase/config';

export const useTimer = (
    entityId: string,
    currentTimeLogs: { start: Date; end: Date; duration_ms: number }[],
    collectionName: 'tasks' | 'projects' = 'tasks',
    projectId?: string,
    taskTitle?: string
) => {
    const { activeTimerId, timerStartTime, setActiveTimer } = useAppStore();
    const isRunning = activeTimerId === entityId;
    const [elapsed, setElapsed] = useState(0);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        if (isRunning && timerStartTime) {
            intervalRef.current = setInterval(() => {
                setElapsed(Date.now() - timerStartTime.getTime());
            }, 1000);
        } else {
            if (intervalRef.current) clearInterval(intervalRef.current);
            setElapsed(0);
        }
        return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    }, [isRunning, timerStartTime]);

    const start = useCallback(() => {
        if (isRunning) return;
        setActiveTimer(entityId, new Date());
    }, [isRunning, entityId, setActiveTimer]);

    const stop = useCallback(async () => {
        if (!isRunning || !timerStartTime) return;
        const endTime = new Date();
        const duration_ms = endTime.getTime() - timerStartTime.getTime();
        const newLog = { start: timerStartTime, end: endTime, duration_ms };
        const updatedLogs = [...currentTimeLogs, newLog];
        const totalMs = updatedLogs.reduce((acc, l) => acc + l.duration_ms, 0);
        setActiveTimer(null, null);

        // Save time_logs on the task
        await updateDocById(collectionName, entityId, {
            time_logs: updatedLogs.map((l) => ({
                start: l.start,
                end: l.end,
                duration_ms: l.duration_ms,
            })),
            total_time_ms: totalMs,
        });

        // If this task belongs to a project, append a time entry to the project doc
        if (projectId && collectionName === 'tasks') {
            const dateStr = timerStartTime.toISOString().split('T')[0];
            const newEntry = {
                task_id: entityId,
                task_title: taskTitle || 'Task',
                date: dateStr,
                start: timerStartTime,
                end: endTime,
                duration_ms,
            };
            const ref = doc(db, `apps/${APP_ID}/projects`, projectId);
            await updateDoc(ref, { time_entries: arrayUnion(newEntry) });
        }
    }, [isRunning, timerStartTime, currentTimeLogs, entityId, setActiveTimer, collectionName, projectId, taskTitle]);

    return { isRunning, elapsed, start, stop };
};

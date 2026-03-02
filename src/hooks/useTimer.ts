import { useEffect, useRef, useState, useCallback } from 'react';
import { useAppStore } from '../store';
import { updateDocById } from '../firebase/firestore';

export const useTimer = (
    entityId: string,
    currentTimeLogs: { start: Date; end: Date; duration_ms: number }[],
    collectionName: 'tasks' | 'projects' = 'tasks'
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

        await updateDocById(collectionName, entityId, {
            time_logs: updatedLogs.map((l) => ({
                start: l.start,
                end: l.end,
                duration_ms: l.duration_ms,
            })),
            total_time_ms: totalMs,
        });
    }, [isRunning, timerStartTime, currentTimeLogs, entityId, setActiveTimer, collectionName]);

    return { isRunning, elapsed, start, stop };
};

import { useEffect, useRef, useState, useCallback } from 'react';
import { useAppStore } from '../store';
import { updateDocById } from '../firebase/firestore';

export const useTimer = (taskId: string, currentTimeLogs: { start: Date; end: Date; duration_ms: number }[]) => {
    const { activeTimerId, timerStartTime, setActiveTimer } = useAppStore();
    const isRunning = activeTimerId === taskId;
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
        setActiveTimer(taskId, new Date());
    }, [isRunning, taskId, setActiveTimer]);

    const stop = useCallback(async () => {
        if (!isRunning || !timerStartTime) return;
        const endTime = new Date();
        const duration_ms = endTime.getTime() - timerStartTime.getTime();
        const newLog = { start: timerStartTime, end: endTime, duration_ms };
        const updatedLogs = [...currentTimeLogs, newLog];
        const totalMs = updatedLogs.reduce((acc, l) => acc + l.duration_ms, 0);
        setActiveTimer(null, null);

        await updateDocById('tasks', taskId, {
            time_logs: updatedLogs.map((l) => ({
                start: l.start,
                end: l.end,
                duration_ms: l.duration_ms,
            })),
            total_time_ms: totalMs,
        });
    }, [isRunning, timerStartTime, currentTimeLogs, taskId, setActiveTimer]);

    return { isRunning, elapsed, start, stop };
};

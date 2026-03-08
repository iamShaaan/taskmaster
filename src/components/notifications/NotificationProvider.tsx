import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useAppStore } from '../../store';
import { db, APP_ID } from '../../firebase/config';
import { collection, query, where, onSnapshot, orderBy, writeBatch, doc } from 'firebase/firestore';
import type { AppNotification } from '../../types';
import toast from 'react-hot-toast';
import { differenceInMinutes } from 'date-fns';

interface NotificationContextProps {
    notifications: AppNotification[];
    unreadCount: number;
    markAsRead: (id: string) => Promise<void>;
    markAllAsRead: () => Promise<void>;
    requestPermission: () => Promise<boolean>;
    permissionGranted: boolean;
}

const NotificationContext = createContext<NotificationContextProps>({
    notifications: [],
    unreadCount: 0,
    markAsRead: async () => { },
    markAllAsRead: async () => { },
    requestPermission: async () => false,
    permissionGranted: false,
});

export const useNotifications = () => useContext(NotificationContext);

// Use a ref-like storage locally to prevent duplicate daily alerts
const LOCAL_STORAGE_KEY = 'taskmaster_daily_alerts';

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const { tasks, meetings } = useAppStore();
    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    const [permissionGranted, setPermissionGranted] = useState(false);

    // Initialise permission state
    useEffect(() => {
        if ('Notification' in window) {
            setPermissionGranted(Notification.permission === 'granted');
        }
    }, []);

    const requestPermission = async () => {
        if (!('Notification' in window)) return false;
        try {
            const permission = await Notification.requestPermission();
            setPermissionGranted(permission === 'granted');
            return permission === 'granted';
        } catch {
            return false;
        }
    };

    const showNativeNotification = (title: string, options?: NotificationOptions) => {
        if (permissionGranted) {
            new Notification(title, {
                icon: '/vite.svg', // Assuming a default icon exists
                ...options,
            });
        }
    };

    // 1. Listen to Firestore Notifications
    useEffect(() => {
        if (!user) {
            setNotifications([]);
            return;
        }

        const q = query(
            collection(db, `apps/${APP_ID}/notifications`),
            where('user_id', '==', user.uid),
            orderBy('created_at', 'desc')
        );

        const unsub = onSnapshot(q, (snap) => {
            const docs = snap.docs.map(d => ({ id: d.id, ...d.data(), created_at: d.data().created_at?.toDate() || new Date() } as AppNotification));

            // Look for entirely new notifications that we just received to trigger a toast/native alert
            // We can detect this by seeing if there's a new document with 'read: false' 
            // that is very recent (e.g. within the last 5 seconds)
            snap.docChanges().forEach(change => {
                if (change.type === 'added') {
                    const data = change.doc.data();
                    if (!data.read) {
                        const ageMs = Date.now() - (data.created_at?.toMillis?.() || Date.now());
                        if (ageMs < 5000) {
                            toast(data.body, { icon: '🔔' });
                            showNativeNotification(data.title, { body: data.body });
                        }
                    }
                }
            });

            setNotifications(docs);
        });

        return unsub;
    }, [user, permissionGranted]);

    // 2. Local Scheduled Checks Loop
    useEffect(() => {
        if (!user) return;

        const checkSchedules = () => {
            const now = new Date();
            const todayStr = now.toISOString().split('T')[0];
            const storedAlerts = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '{}');

            // Check Daily 10 AM (Start of day)
            if (now.getHours() >= 10 && !storedAlerts[`${todayStr}_morning`]) {
                const title = "Good Morning!";
                const body = "Don't forget to check today's tasks and schedule.";
                toast(body, { icon: '☀️' });
                showNativeNotification(title, { body });
                storedAlerts[`${todayStr}_morning`] = true;
            }

            // Check Daily 10 PM (End of day)
            if (now.getHours() >= 22 && !storedAlerts[`${todayStr}_evening`]) {
                const title = "Day Recap";
                const body = "Have you completed all your tasks for today?";
                toast(body, { icon: '🌙' });
                showNativeNotification(title, { body });
                storedAlerts[`${todayStr}_evening`] = true;
            }

            // Check Meetings (30 mins before)
            meetings.forEach(meeting => {
                const mtgDate = meeting.start_time;
                const diffMins = differenceInMinutes(mtgDate, now);
                const alertKey = `mtg_30_${meeting.id}`;

                if (diffMins > 0 && diffMins <= 30 && !storedAlerts[alertKey]) {
                    const title = "Upcoming Meeting";
                    const body = `${meeting.title} starts in ${diffMins} minutes.`;
                    toast.custom(() => (
                        <div className="bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 backdrop-blur-md">
                            <span>📅</span> <span>{body}</span>
                        </div>
                    ), { duration: 5000 });
                    showNativeNotification(title, { body });
                    storedAlerts[alertKey] = true;
                }
            });

            // Check Tasks Deadlines (2 hours before)
            tasks.forEach(task => {
                if (!task.due_date || task.status === 'done') return;

                const dueDate = task.due_date;
                const diffMins = differenceInMinutes(dueDate, now);
                const alertKey = `task_2h_${task.id}`;

                if (diffMins > 0 && diffMins <= 120 && !storedAlerts[alertKey]) {
                    const title = "Task Deadline Approaching";
                    const body = `'${task.title}' is due in less than 2 hours!`;
                    toast.error(body, { icon: '⚠️' });
                    showNativeNotification(title, { body });
                    storedAlerts[alertKey] = true;
                }
            });

            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(storedAlerts));
        };

        // Run immediately, then every 60 seconds
        checkSchedules();
        const interval = setInterval(checkSchedules, 60000);
        return () => clearInterval(interval);
    }, [user, tasks, meetings, permissionGranted]);

    // Actions
    const markAsRead = async (id: string) => {
        try {
            await writeBatch(db).update(doc(db, `apps/${APP_ID}/notifications`, id), { read: true }).commit();
        } catch { /* */ }
    };

    const markAllAsRead = async () => {
        const unread = notifications.filter(n => !n.read);
        if (unread.length === 0) return;

        const batch = writeBatch(db);
        unread.forEach(n => {
            batch.update(doc(db, `apps/${APP_ID}/notifications`, n.id), { read: true });
        });
        await batch.commit();
    };

    const unreadCount = notifications.filter(n => !n.read).length;

    return (
        <NotificationContext.Provider value={{ notifications, unreadCount, markAsRead, markAllAsRead, requestPermission, permissionGranted }}>
            {children}
        </NotificationContext.Provider>
    );
};

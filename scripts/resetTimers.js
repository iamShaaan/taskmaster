import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, updateDoc, arrayUnion } from "firebase/firestore";

const firebaseConfig = {
    apiKey: process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const APP_ID = process.env.VITE_APP_ID || 'taskmaster-v1';

async function resetTimers() {
    console.log("Looking for tasks with stuck active timers in app:", APP_ID);

    try {
        const tasksRef = collection(db, `apps/${APP_ID}/tasks`);
        const snapshot = await getDocs(tasksRef);

        let fixedCount = 0;

        for (const taskDoc of snapshot.docs) {
            const data = taskDoc.data();

            if (data.active_timer) {
                console.log(`Found stuck timer on task: ${data.title || taskDoc.id}`);

                const now = new Date();
                const startTime = data.active_timer.start?.toDate ? data.active_timer.start.toDate() : new Date(data.active_timer.start || now);
                const duration_ms = now.getTime() - startTime.getTime();

                // 1. Create the time log
                const timeLog = {
                    start: startTime,
                    end: now,
                    duration_ms: Math.max(0, duration_ms),
                    user_id: data.active_timer.user_id || 'unknown',
                    user_name: data.active_timer.user_name || 'System Auto-Stop',
                    is_archived: false
                };

                // 2. Update the task
                const updatedLogs = [...(data.time_logs || []), timeLog];
                const totalMs = updatedLogs.reduce((acc, l) => acc + (l.duration_ms || 0), 0);

                await updateDoc(taskDoc.ref, {
                    active_timer: null,
                    time_logs: updatedLogs,
                    total_time_ms: totalMs
                });

                console.log(`- Cleared task ${taskDoc.id}`);

                // 3. Update the project if it exists
                if (data.project_id) {
                    const projectRef = doc(db, `apps/${APP_ID}/projects`, data.project_id);
                    const dateStr = startTime.toISOString().split('T')[0];
                    const projectEntry = {
                        task_id: taskDoc.id,
                        task_title: data.title || 'Task',
                        date: dateStr,
                        start: startTime,
                        end: now,
                        duration_ms: Math.max(0, duration_ms),
                        user_id: data.active_timer.user_id || 'unknown',
                        user_name: data.active_timer.user_name || 'System Auto-Stop',
                        is_archived: false
                    };

                    await updateDoc(projectRef, {
                        time_entries: arrayUnion(projectEntry)
                    });
                    console.log(`- Added time entry to project ${data.project_id}`);
                }

                fixedCount++;
            }
        }

        console.log(`\nSuccess! Force-stopped and saved time records for ${fixedCount} stuck tasks.`);
        process.exit(0);
    } catch (err) {
        console.error("Error resetting timers:", err);
        process.exit(1);
    }
}

resetTimers();

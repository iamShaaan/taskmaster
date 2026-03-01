import { addDoc } from 'firebase/firestore';
import { col, serverTimestamp } from '../firebase/firestore';

export const triggerN8n = async (
    actionType: string,
    payload: Record<string, unknown>
) => {
    try {
        await addDoc(col('actions'), {
            action_type: actionType,
            payload,
            status: 'pending',
            result: null,
            created_at: serverTimestamp(),
        });
    } catch (err) {
        console.error('[n8n bridge] Failed to write action doc:', err);
    }
};

export const triggerMeetingReminder = (meetingId: string, email: string, meetingTitle: string, startTime: Date) => {
    return triggerN8n('send_meeting_reminder', { meeting_id: meetingId, email, title: meetingTitle, time: startTime.toISOString() });
};

export const triggerTaskDueAlert = (taskId: string, email: string, taskTitle: string, dueDate: Date) => {
    return triggerN8n('send_task_due_alert', { task_id: taskId, email, title: taskTitle, due_date: dueDate.toISOString() });
};

import { create } from 'zustand';
import type { Task, Meeting, Client, Project, Note, FileAttachment, Routine, DailyLog } from '../types';

interface AppStore {
    // Tasks
    tasks: Task[];
    setTasks: (tasks: Task[]) => void;

    // Meetings
    meetings: Meeting[];
    setMeetings: (meetings: Meeting[]) => void;

    // Clients
    clients: Client[];
    setClients: (clients: Client[]) => void;

    // Projects
    projects: Project[];
    setProjects: (projects: Project[]) => void;
    addProjects: (projects: Project[]) => void;

    // Notes
    notes: Note[];
    setNotes: (notes: Note[]) => void;

    // Files
    files: FileAttachment[];
    setFiles: (files: FileAttachment[]) => void;

    // Daily Routine & Checklist
    routines: Routine[];
    setRoutines: (routines: Routine[]) => void;

    dailyLogs: DailyLog[];
    setDailyLogs: (logs: DailyLog[]) => void;

    // UI state
    sidebarOpen: boolean;
    setSidebarOpen: (open: boolean) => void;

    // Active timer state
    activeTimerId: string | null;
    timerStartTime: Date | null;
    setActiveTimer: (taskId: string | null, startTime?: Date | null) => void;
}

export const useAppStore = create<AppStore>((set) => ({
    tasks: [],
    setTasks: (tasks) => set({ tasks }),

    meetings: [],
    setMeetings: (meetings) => set({ meetings }),

    clients: [],
    setClients: (clients) => set({ clients }),

    projects: [],
    setProjects: (projects) => set({ projects }),
    addProjects: (newProjects) => set((state) => ({
        projects: [...state.projects, ...newProjects].filter((p, i, a) => a.findIndex(t => t.id === p.id) === i)
    })),

    notes: [],
    setNotes: (notes) => set({ notes }),

    files: [],
    setFiles: (files) => set({ files }),

    routines: [],
    setRoutines: (routines) => set({ routines }),

    dailyLogs: [],
    setDailyLogs: (dailyLogs) => set({ dailyLogs }),

    sidebarOpen: true,
    setSidebarOpen: (open) => set({ sidebarOpen: open }),

    activeTimerId: null,
    timerStartTime: null,
    setActiveTimer: (taskId, startTime) =>
        set({ activeTimerId: taskId, timerStartTime: startTime || null }),
}));

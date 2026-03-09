import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AppShell } from './components/layout/AppShell';
import { Dashboard } from './pages/Dashboard';
import { Tasks } from './pages/Tasks';
import { Meetings } from './pages/Meetings';
import { Clients } from './pages/Clients';
import { Projects } from './pages/Projects';
import { Notes } from './pages/Notes';
import { Files } from './pages/Files';
import { Auth } from './pages/Auth';
import { useAuth } from './hooks/useAuth';
import { listenCollection, orderBy, toDate, where } from './firebase/firestore';
import { useAppStore } from './store';
import type { Task, Meeting, Client, Project, Note, Routine, DailyLog } from './types';
import { Sparkles } from 'lucide-react';

import { ClientDetail } from './pages/ClientDetail';
import { ProjectDetail } from './pages/ProjectDetail';
import { UserDataLayout } from './components/layout/UserDataLayout';
import { TeamMembers } from './pages/TeamMembers';
import { ArchivePage } from './pages/ArchivePage';
import { TimeTracker } from './pages/TimeTracker';
import { RoutinePage } from './pages/RoutinePage';
import { NotificationProvider } from './components/notifications/NotificationProvider';

// ─── BACKGROUND DATA LOADER ──────────────────────────────────────────────────
const DataLoader: React.FC = () => {
  const { user } = useAuth();
  const store = useAppStore();

  // 1. Auto-heal meetings with mismatched project members
  useEffect(() => {
    if (!user || store.meetings.length === 0 || store.projects.length === 0) return;

    store.meetings.forEach((m) => {
      if (m.linked_project_id && m.owner_id === user.uid) {
        const proj = store.projects.find(p => p.id === m.linked_project_id);
        if (proj) {
          const pUids = proj.member_uids || [];
          const mUids = m.project_member_uids || [];
          const hasMismatch = pUids.length !== mUids.length || !pUids.every(uid => mUids.includes(uid));

          if (hasMismatch) {
            import('./firebase/firestore').then(({ updateDocById }) => {
              updateDocById('meetings', m.id, { project_member_uids: pUids }).catch(console.error);
            });
          }
        }
      }
    });
  }, [store.meetings, store.projects, user]);

  // 2. Real-time Collections Listeners
  useEffect(() => {
    if (!user) return;
    const unsubs: (() => void)[] = [];

    // Helper to reduce boilerplate
    const sub = (col: string, flux: (data: any[]) => void, ...constraints: any[]) => {
      unsubs.push(listenCollection(col, flux, ...constraints));
    };

    // --- Tasks (Complex merging for owner + assignee + shared) ---
    const tasksState = { owned: [] as any[], assigned: [] as any[], shared: [] as any[] };
    const updateTasks = () => {
      const merged = [...tasksState.owned, ...tasksState.assigned, ...tasksState.shared];
      const unique = merged.filter((t, i, a) => a.findIndex(x => x.id === t.id) === i)
        .sort((a, b) => (b.created_at?.toMillis?.() || 0) - (a.created_at?.toMillis?.() || 0));

      store.setTasks(unique.map((d) => ({
        ...d,
        due_date: toDate(d.due_date),
        created_at: toDate(d.created_at) || new Date(),
        time_logs: (d.time_logs || []).map((l: any) => ({
          start: toDate(l.start) || new Date(),
          end: toDate(l.end) || new Date(),
          duration_ms: l.duration_ms as number,
          user_id: l.user_id,
          user_name: l.user_name,
          user_email: l.user_email,
        })),
        notes: (d.notes || []).map((n: any) => ({
          ...n,
          created_at: toDate(n.created_at) || new Date(),
        })),
      } as unknown as Task)));
    };

    unsubs.push(listenCollection('tasks', (data) => { tasksState.owned = data.filter(d => !d.deleted_at); updateTasks(); }, where('owner_id', '==', user.uid)));
    unsubs.push(listenCollection('tasks', (data) => { tasksState.assigned = data.filter(d => !d.deleted_at); updateTasks(); }, where('assignee_id', '==', user.uid)));
    unsubs.push(listenCollection('tasks', (data) => { tasksState.shared = data.filter(d => !d.deleted_at); updateTasks(); }, where('project_member_uids', 'array-contains', user.uid)));

    // --- Meetings ---
    sub('meetings', (data) => {
      store.setMeetings(data.filter(d => !d.deleted_at).map(d => ({
        ...d,
        start_time: toDate(d.start_time as never) || new Date(),
        end_time: toDate(d.end_time as never) || new Date(),
        created_at: toDate(d.created_at as never) || new Date(),
      } as unknown as Meeting)));
    }, where('owner_id', '==', user.uid), orderBy('created_at', 'desc'));

    // --- Notes (No orderBy yet to ensure visibility of old notes for auto-healing) ---
    sub('notes', (data) => {
      store.setNotes(data.filter(d => !d.deleted_at).map((d) => ({
        ...d,
        created_at: toDate(d.created_at as never) || new Date(),
        updated_at: toDate(d.updated_at as never) || new Date(),
      } as unknown as Note)));
    }, where('owner_id', '==', user.uid));

    // --- Clients ---
    sub('clients', (data) => {
      store.setClients(data.filter(d => !d.deleted_at).map((d) => ({ 
        ...d, 
        created_at: toDate(d.created_at as never) || new Date() 
      } as unknown as Client)));
    }, where('owner_id', '==', user.uid), orderBy('created_at', 'desc'));

    // --- Projects ---
    const projectsState = { owned: [] as any[], shared: [] as any[] };
    const updateProjects = () => {
      const merged = [...projectsState.owned, ...projectsState.shared];
      const unique = merged.filter((p, i, a) => a.findIndex(x => x.id === p.id) === i);

      store.setProjects(unique.map((d) => ({
        ...d,
        created_at: toDate(d.created_at) || new Date(),
        time_logs: ((d.time_logs as any[]) || []).map((l: any) => ({
          start: toDate(l.start) || new Date(),
          end: toDate(l.end) || new Date(),
          duration_ms: l.duration_ms as number,
        })),
      } as unknown as Project)));
    };

    unsubs.push(listenCollection('projects', (data) => { projectsState.owned = data.filter(d => !d.deleted_at); updateProjects(); }, where('owner_id', '==', user.uid)));
    unsubs.push(listenCollection('projects', (data) => { projectsState.shared = data.filter(d => !d.deleted_at); updateProjects(); }, where('member_uids', 'array-contains', user.uid)));

    // --- Routines ---
    sub('routines', (data) => {
      store.setRoutines(data.filter(d => !d.deleted_at && !d.is_archived).map(d => ({
        ...d,
        created_at: toDate(d.created_at as never) || new Date()
      } as unknown as Routine)));
    }, where('owner_id', '==', user.uid));

    // --- Daily Logs ---
    sub('daily_logs', (data) => {
      store.setDailyLogs(data.map(d => ({
        ...d,
        created_at: toDate(d.created_at as never) || new Date()
      } as unknown as DailyLog)));
    }, where('owner_id', '==', user.uid));

    return () => unsubs.forEach((u) => u());
  }, [user?.uid]);

  return null;
};

const LoadingScreen: React.FC = () => (
  <div className="min-h-screen bg-slate-950 flex items-center justify-center">
    <div className="text-center">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mx-auto mb-4 animate-pulse">
        <Sparkles size={28} className="text-white" />
      </div>
      <p className="text-slate-400 text-sm">Loading TaskMaster...</p>
    </div>
  </div>
);

function App() {
  const { user, loading } = useAuth();

  if (loading) return <LoadingScreen />;

  return (
    <BrowserRouter>
      {user && <DataLoader />}
      <NotificationProvider>
        <Toaster
          position="top-right"
          toastOptions={{
            style: { background: '#1e293b', color: '#f1f5f9', border: '1px solid #334155' },
            success: { iconTheme: { primary: '#10b981', secondary: '#1e293b' } },
            error: { iconTheme: { primary: '#ef4444', secondary: '#1e293b' } },
          }}
        />
        <Routes>
          {!user ? (
            <Route path="*" element={<Auth />} />
          ) : (
            <Route path="/" element={<AppShell />}>
              <Route index element={<Dashboard />} />
              <Route path="tasks" element={<Tasks />} />
              <Route path="meetings" element={<Meetings />} />
              <Route path="projects" element={<Projects />} />
              <Route path="projects/:id" element={<ProjectDetail />} />
              <Route path="routine" element={<RoutinePage />} />

              <Route path="user-data" element={<UserDataLayout />}>
                <Route index element={<Clients />} />
                <Route path="clients/:id" element={<ClientDetail />} />
                <Route path="team" element={<TeamMembers />} />
                <Route path="archive" element={<ArchivePage />} />
                <Route path="time-tracker" element={<TimeTracker />} />
                <Route path="notes" element={<Notes />} />
                <Route path="files" element={<Files />} />
              </Route>

              <Route path="*" element={<Dashboard />} />
            </Route>
          )}
        </Routes>
      </NotificationProvider>
    </BrowserRouter>
  );
}

export default App;

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
import type { Task, Meeting, Client, Project, Note } from './types';
import { Sparkles } from 'lucide-react';

import { ClientDetail } from './pages/ClientDetail';
import { ProjectDetail } from './pages/ProjectDetail';
import { Profile } from './pages/Profile';

const DataLoader: React.FC = () => {
  const { setTasks, setMeetings, setClients, setProjects, setNotes } = useAppStore();
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    const unsubs: (() => void)[] = [];

    // Personal items: Filter by owner_id
    unsubs.push(listenCollection('tasks', (data) => {
      setTasks(data.map((d) => ({
        ...d,
        due_date: toDate(d.due_date as never),
        created_at: toDate(d.created_at as never) || new Date(),
        time_logs: ((d.time_logs as never[]) || []).map((l: Record<string, unknown>) => ({
          start: toDate(l.start as never) || new Date(),
          end: toDate(l.end as never) || new Date(),
          duration_ms: l.duration_ms as number,
        })),
      } as unknown as Task)));
    }, where('owner_id', '==', user.uid), orderBy('created_at', 'desc')));

    unsubs.push(listenCollection('meetings', (data) => {
      setMeetings(data.map((d) => ({
        ...d,
        start_time: toDate(d.start_time as never) || new Date(),
        end_time: toDate(d.end_time as never) || new Date(),
        created_at: toDate(d.created_at as never) || new Date(),
      } as unknown as Meeting)));
    }, where('owner_id', '==', user.uid), orderBy('start_time', 'asc')));

    unsubs.push(listenCollection('notes', (data) => {
      setNotes(data.map((d) => ({
        ...d,
        created_at: toDate(d.created_at as never) || new Date(),
        updated_at: toDate(d.updated_at as never) || new Date(),
      } as unknown as Note)));
    }, where('owner_id', '==', user.uid), orderBy('updated_at', 'desc')));

    // Clients are now private by default
    unsubs.push(listenCollection('clients', (data) => {
      setClients(data.map((d) => ({ ...d, created_at: toDate(d.created_at as never) || new Date() } as unknown as Client)));
    }, where('owner_id', '==', user.uid), orderBy('created_at', 'desc')));

    // Projects: Visible if owner OR if user is in shared_with array
    // Note: Firestore doesn't support 'where(OR)' easily with 'array-contains' in a single query reliably with other constraints.
    // However, we can use a simpler approach: fetch where owner OR fetch where shared_with (though onSnapshot is per-query).
    // Alternative: Just fetch everything and filter in-memory if team size is small, OR do two separate listeners.
    // For now, let's use the 'shared_with' if we can, or just implement the ownership for now and then add sharing.
    unsubs.push(listenCollection('projects', (data) => {
      setProjects(data.map((d) => ({
        ...d,
        created_at: toDate(d.created_at as never) || new Date(),
        time_logs: ((d.time_logs as never[]) || []).map((l: Record<string, unknown>) => ({
          start: toDate(l.start as never) || new Date(),
          end: toDate(l.end as never) || new Date(),
          duration_ms: l.duration_ms as number,
        })),
      } as unknown as Project)));
    }, where('owner_id', '==', user.uid)));

    // Second listener: projects shared with this user (member_uids array-contains)
    unsubs.push(listenCollection('projects', (data) => {
      const sharedProjects = data.map((d) => ({
        ...d,
        created_at: toDate(d.created_at as never) || new Date(),
        time_logs: ((d.time_logs as never[]) || []).map((l: Record<string, unknown>) => ({
          start: toDate(l.start as never) || new Date(),
          end: toDate(l.end as never) || new Date(),
          duration_ms: l.duration_ms as number,
        })),
      } as unknown as Project));

      setProjects([...useAppStore.getState().projects, ...sharedProjects].filter((p, i, a) => a.findIndex(t => t.id === p.id) === i));
    }, where('member_uids', 'array-contains', user.uid)));

    return () => unsubs.forEach((u) => u());
  }, [user, setTasks, setMeetings, setClients, setProjects, setNotes]);

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
            <Route path="clients" element={<Clients />} />
            <Route path="clients/:id" element={<ClientDetail />} />
            <Route path="projects" element={<Projects />} />
            <Route path="projects/:id" element={<ProjectDetail />} />
            <Route path="notes" element={<Notes />} />
            <Route path="files" element={<Files />} />
            <Route path="profile" element={<Profile />} />
          </Route>
        )}
      </Routes>
    </BrowserRouter>
  );
}

export default App;

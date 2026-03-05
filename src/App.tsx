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
import { UserDataLayout } from './components/layout/UserDataLayout';
import { TeamMembers } from './pages/TeamMembers';
import { ArchivePage } from './pages/ArchivePage';
import { MyTeams } from './pages/MyTeams';
import DebugStop from './pages/DebugStop';

const DataLoader: React.FC = () => {
  const { meetings, projects, setTasks, setMeetings, setClients, setProjects, setNotes } = useAppStore();
  const { user } = useAuth();

  // Auto-heal meetings with mismatched project members
  useEffect(() => {
    if (!user || meetings.length === 0 || projects.length === 0) return;

    meetings.forEach((m) => {
      // Only heal meetings owned by the current user to prevent race conditions
      if (m.linked_project_id && m.owner_id === user.uid) {
        const proj = projects.find(p => p.id === m.linked_project_id);
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
  }, [meetings, projects, user]);

  useEffect(() => {
    if (!user) return;
    const unsubs: (() => void)[] = [];

    // Tasks state holder to merge multiple listeners without duplicate/stale issues
    const tasksState = { owned: [] as any[], assigned: [] as any[], shared: [] as any[] };
    const updateTasks = () => {
      const merged = [...tasksState.owned, ...tasksState.assigned, ...tasksState.shared];
      const unique = merged.filter((t, i, a) => a.findIndex(x => x.id === t.id) === i)
        .sort((a, b) => (b.created_at?.toMillis?.() || 0) - (a.created_at?.toMillis?.() || 0));

      setTasks(unique.map((d) => ({
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

    // Personal items: Filter by owner_id
    unsubs.push(listenCollection('tasks', (data) => {
      tasksState.owned = data.filter(d => !d.deleted_at);
      updateTasks();
    }, where('owner_id', '==', user.uid)));

    // Assigned tasks
    unsubs.push(listenCollection('tasks', (data) => {
      tasksState.assigned = data.filter(d => !d.deleted_at);
      updateTasks();
    }, where('assignee_id', '==', user.uid)));

    // Shared project tasks
    unsubs.push(listenCollection('tasks', (data) => {
      tasksState.shared = data.filter(d => !d.deleted_at);
      updateTasks();
    }, where('project_member_uids', 'array-contains', user.uid)));

    const meetingsState = { owned: [] as any[], shared: [] as any[], projectShared: [] as any[] };
    const updateMeetings = () => {
      const merged = [...meetingsState.owned, ...meetingsState.shared, ...meetingsState.projectShared];
      const unique = merged.filter((m, i, a) => a.findIndex(x => x.id === m.id) === i)
        .sort((a, b) => {
          const aTime = a.start_time?.toMillis?.() || 0;
          const bTime = b.start_time?.toMillis?.() || 0;
          return aTime - bTime;
        });

      setMeetings(unique.map((d) => ({
        ...d,
        start_time: toDate(d.start_time as never) || new Date(),
        end_time: toDate(d.end_time as never) || new Date(),
        created_at: toDate(d.created_at as never) || new Date(),
      } as unknown as Meeting)));
    };

    unsubs.push(listenCollection('meetings', (data) => {
      meetingsState.owned = data.filter(d => !d.deleted_at);
      updateMeetings();
    }, where('owner_id', '==', user.uid)));

    unsubs.push(listenCollection('meetings', (data) => {
      meetingsState.shared = data.filter(d => !d.deleted_at);
      updateMeetings();
    }, where('participant_uids', 'array-contains', user.uid)));

    unsubs.push(listenCollection('meetings', (data) => {
      meetingsState.projectShared = data.filter(d => !d.deleted_at);
      updateMeetings();
    }, where('project_member_uids', 'array-contains', user.uid)));

    unsubs.push(listenCollection('notes', (data) => {
      setNotes(data.filter(d => !d.deleted_at).map((d) => ({
        ...d,
        created_at: toDate(d.created_at as never) || new Date(),
        updated_at: toDate(d.updated_at as never) || new Date(),
      } as unknown as Note)));
    }, where('owner_id', '==', user.uid), orderBy('updated_at', 'desc')));

    // Clients are now private by default
    unsubs.push(listenCollection('clients', (data) => {
      setClients(data.filter(d => !d.deleted_at).map((d) => ({ ...d, created_at: toDate(d.created_at as never) || new Date() } as unknown as Client)));
    }, where('owner_id', '==', user.uid), orderBy('created_at', 'desc')));

    // Projects: Visible if owner OR if user is in shared_with array
    // Note: Firestore doesn't support 'where(OR)' easily with 'array-contains' in a single query reliably with other constraints.
    // However, we can use a simpler approach: fetch where owner OR fetch where shared_with (though onSnapshot is per-query).
    // Alternative: Just fetch everything and filter in-memory if team size is small, OR do two separate listeners.
    // For now, let's use the 'shared_with' if we can, or just implement the ownership for now and then add sharing.
    // Projects state holder
    const projectsState = { owned: [] as any[], shared: [] as any[] };
    const updateProjects = () => {
      const merged = [...projectsState.owned, ...projectsState.shared];
      const unique = merged.filter((p, i, a) => a.findIndex(x => x.id === p.id) === i);

      setProjects(unique.map((d) => ({
        ...d,
        created_at: toDate(d.created_at) || new Date(),
        time_logs: ((d.time_logs as any[]) || []).map((l: any) => ({
          start: toDate(l.start) || new Date(),
          end: toDate(l.end) || new Date(),
          duration_ms: l.duration_ms as number,
        })),
      } as unknown as Project)));
    };

    // First listener: projects owned by user
    unsubs.push(listenCollection('projects', (data) => {
      projectsState.owned = data.filter(d => !d.deleted_at);
      updateProjects();
    }, where('owner_id', '==', user.uid)));

    // Second listener: projects shared with this user (member_uids array-contains)
    unsubs.push(listenCollection('projects', (data) => {
      projectsState.shared = data.filter(d => !d.deleted_at);
      updateProjects();
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
            <Route path="projects" element={<Projects />} />
            <Route path="projects/:id" element={<ProjectDetail />} />

            <Route path="user-data" element={<UserDataLayout />}>
              <Route index element={<Clients />} />
              <Route path="clients/:id" element={<ClientDetail />} />
              <Route path="team" element={<TeamMembers />} />
              <Route path="archive" element={<ArchivePage />} />
              <Route path="my-teams" element={<MyTeams />} />
            </Route>

            <Route path="notes" element={<Notes />} />
            <Route path="files" element={<Files />} />
            <Route path="debug-stop" element={<DebugStop />} />
            <Route path="*" element={<Dashboard />} />
          </Route>
        )}
      </Routes>
    </BrowserRouter>
  );
}

export default App;

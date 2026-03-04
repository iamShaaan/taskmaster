import React, { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ArrowLeft, FolderKanban, CheckSquare, Calendar,
    FileArchive, Timer, Upload, ExternalLink, Users, Download, Trash2, Clock, Plus
} from 'lucide-react';
import { Modal } from '../components/ui/Modal';
import { TaskForm } from '../components/tasks/TaskForm';
import { useAppStore } from '../store';
import { TaskCard } from '../components/tasks/TaskCard';
import { statusBadge } from '../components/ui/Badge';
import { formatDate, formatDuration } from '../utils/timeFormat';
import { useDropzone } from 'react-dropzone';
import { auth } from '../firebase/config';
import { uploadFile, deleteFile } from '../firebase/storage';
import { updateDocById } from '../firebase/firestore';
import toast from 'react-hot-toast';
import type { Project, ProjectTimeEntry, Task, TimeLog } from '../types';

// ─── Time Records Section ──────────────────────────────────────────────────────

const ProjectTimeLogs: React.FC<{ project: Project; tasks: Task[] }> = ({ project, tasks }) => {
    // Derive time entries: combine project-level time_entries (from stopped task timers)
    // PLUS live task time_logs (for tasks already stored in Firestore)
    const taskEntries = tasks.flatMap((t) =>
        (t.time_logs || []).map((log: TimeLog) => ({
            task_id: t.id,
            task_title: t.title,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            date: new Date(log.start instanceof Date ? log.start : (log.start as any)?.toDate?.() ?? log.start)
                .toISOString().split('T')[0],
            start: log.start,
            end: log.end,
            duration_ms: log.duration_ms,
            user_id: log.user_id,
            user_name: log.user_name,
            user_email: log.user_email,
        }))
    );

    // Also include any project-level time_entries (written by useTimer on stop)
    const projectEntries: ProjectTimeEntry[] = project.time_entries || [];

    // Merge — deduplicate by task_id + date + duration_ms
    const seen = new Set<string>();
    const all = [...taskEntries, ...projectEntries].filter((e) => {
        const key = `${e.task_id}-${e.date}-${e.duration_ms}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });

    // Sort newest first
    all.sort((a, b) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const aTime = a.start instanceof Date ? a.start.getTime() : new Date(a.start as any).getTime();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const bTime = b.start instanceof Date ? b.start.getTime() : new Date(b.start as any).getTime();
        return bTime - aTime;
    });

    const totalMs = all.reduce((sum, e) => sum + e.duration_ms, 0);

    if (all.length === 0) {
        return (
            <section className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6">
                <h2 className="text-slate-100 font-bold mb-4 flex items-center gap-2">
                    <Clock size={18} className="text-amber-400" /> Time Records
                </h2>
                <p className="text-slate-600 text-sm italic text-center py-8 border-2 border-dashed border-slate-800 rounded-xl">
                    No time logged yet. Start a task timer to record time against this project.
                </p>
            </section>
        );
    }

    return (
        <section className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6">
            <h2 className="text-slate-100 font-bold mb-1 flex items-center gap-2">
                <Clock size={18} className="text-amber-400" /> Time Records
            </h2>
            <p className="text-slate-500 text-xs mb-5">
                Total logged: <span className="text-amber-400 font-mono font-bold">{formatDuration(totalMs)}</span>
            </p>

            {/* Table header */}
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 text-[10px] font-bold uppercase tracking-widest text-slate-500 px-3 mb-2">
                <span>Task</span>
                <span>User</span>
                <span className="text-right">Date</span>
                <span className="text-right">Duration</span>
            </div>

            <div className="space-y-1.5">
                {all.map((entry, idx) => {
                    const dateLabel = new Date(entry.date).toLocaleDateString('en-GB', {
                        day: '2-digit', month: 'short', year: 'numeric',
                    });
                    return (
                        <div
                            key={idx}
                            className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 items-center px-3 py-2.5 bg-slate-900/50 rounded-xl border border-white/5 hover:border-amber-500/20 transition-all group"
                        >
                            <div className="flex items-center gap-2 min-w-0">
                                <div className="w-1.5 h-1.5 rounded-full bg-amber-400/60 flex-shrink-0" />
                                <span className="text-slate-200 text-xs font-medium truncate group-hover:text-amber-300 transition-colors">
                                    {entry.task_title}
                                </span>
                            </div>
                            <span className="text-slate-400 text-xs truncate max-w-[120px]">
                                {entry.user_name || entry.user_email?.split('@')[0] || 'Unknown'}
                            </span>
                            <span className="text-slate-500 text-xs text-right whitespace-nowrap">{dateLabel}</span>
                            <span className="text-amber-400 text-xs font-mono font-bold text-right whitespace-nowrap">
                                {formatDuration(entry.duration_ms)}
                            </span>
                        </div>
                    );
                })}
            </div>
        </section>
    );
};

// ─── Main ProjectDetail ────────────────────────────────────────────────────────

export const ProjectDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { projects, tasks, meetings, clients } = useAppStore();
    const [uploading, setUploading] = useState(false);

    const project = projects.find((p) => p.id === id);
    const client = clients.find((c) => c.id === project?.client_id);
    const [showTaskForm, setShowTaskForm] = useState(false);
    const [editTask, setEditTask] = useState<Task | undefined>();
    const isOwner = auth.currentUser?.uid === project?.owner_id;

    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        if (!project) return;
        if (!auth.currentUser) {
            toast.error('Upload Failed: You must be authenticated.');
            return;
        }
        setUploading(true);
        try {
            const uploadedUrls = await Promise.all(
                acceptedFiles.map(file => uploadFile(file, 'projects', project.id))
            );
            const newFiles = [...(project.files || []), ...uploadedUrls.map(f => ({
                id: Math.random().toString(36).substr(2, 9),
                ...f,
                uploaded_at: new Date(),
                entity_type: 'project' as const,
                entity_id: project.id
            }))];
            await updateDocById('projects', project.id, { files: newFiles });
            toast.success('Files uploaded successfully');
        } catch (error) {
            toast.error('Failed to upload files');
            console.error(error);
        } finally {
            setUploading(false);
        }
    }, [project]);

    const handleDeleteFile = useCallback(async (fileId: string, fileUrl: string) => {
        if (!project) return;
        if (!window.confirm('Delete this file? This cannot be undone.')) return;
        try {
            await deleteFile(fileUrl);
            const updatedFiles = (project.files || []).filter(f => f.id !== fileId);
            await updateDocById('projects', project.id, { files: updatedFiles });
            toast.success('File deleted');
        } catch (error) {
            toast.error('Failed to delete file');
            console.error(error);
        }
    }, [project]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

    if (!project) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-slate-400">
                <FolderKanban size={48} className="mb-4 opacity-20" />
                <p>Project not found</p>
                <button onClick={() => navigate('/projects')} className="mt-4 text-indigo-400 hover:text-indigo-300">Back to Projects</button>
            </div>
        );
    }

    const projectTasks = tasks.filter((t) => t.project_id === id);
    const isAdmin = isOwner || (project?.admin_uids?.includes(auth.currentUser?.uid || ''));
    const projectMeetings = meetings.filter((m) => m.linked_project_id === id);

    // Total time = sum of all task total_time_ms for this project
    const totalMs = projectTasks.reduce((sum, t) => sum + (t.total_time_ms || 0), 0);

    return (
        <div className="space-y-8 pb-12">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-700/50 pb-8">
                <div className="flex items-start gap-4">
                    <button
                        onClick={() => navigate('/projects')}
                        className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-100 transition-all"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: project.color }} />
                            <h1 className="text-3xl font-bold text-slate-50">{project.name}</h1>
                        </div>
                        <div className="flex items-center gap-3 text-slate-500 text-sm">
                            {client && (
                                <button
                                    onClick={() => navigate(`/clients/${client.id}`)}
                                    className="hover:text-indigo-400 flex items-center gap-1.5 transition-colors"
                                >
                                    Client: {client.name}
                                </button>
                            )}
                            <span>●</span>
                            <span>Created {formatDate(project.created_at)}</span>
                        </div>
                    </div>
                </div>

                {/* Total Time Display — read-only */}
                <div className="flex items-center gap-3 bg-slate-900/50 p-4 rounded-2xl border border-white/5 backdrop-blur-md">
                    <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
                        <Timer size={20} />
                    </div>
                    <div className="text-left">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Total Time Logged</p>
                        <span className={`text-xl font-mono font-bold ${totalMs > 0 ? 'text-amber-400' : 'text-slate-500'}`}>
                            {totalMs > 0 ? formatDuration(totalMs) : '00:00:00'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* Info & Files */}
                <div className="space-y-8">
                    <section className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6">
                        <h2 className="text-slate-100 font-bold mb-4">Project Overview</h2>
                        <p className="text-slate-400 text-sm leading-relaxed mb-6">
                            {project.description || 'No description provided for this project.'}
                        </p>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-slate-500">Status</span>
                                {statusBadge(project.status)}
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-slate-500">Tasks</span>
                                <span className="text-slate-200 font-medium">{projectTasks.length}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-slate-500">Meetings</span>
                                <span className="text-slate-200 font-medium">{projectMeetings.length}</span>
                            </div>
                        </div>
                    </section>

                    {/* File Upload & List */}
                    <section className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6">
                        <h2 className="text-slate-100 font-bold mb-4 flex items-center justify-between">
                            Project Files
                            <span className="text-xs font-normal text-slate-500">{project.files?.length || 0} items</span>
                        </h2>

                        {isOwner && (
                            <div
                                {...getRootProps()}
                                className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all mb-4 ${isDragActive ? 'border-indigo-500 bg-indigo-500/10' : 'border-slate-700 hover:border-slate-500'}`}
                            >
                                <input {...getInputProps()} />
                                <Upload size={24} className="mx-auto mb-2 text-slate-500" />
                                <p className="text-xs text-slate-400">
                                    {uploading ? 'Uploading...' : 'Drop files here or click to upload'}
                                </p>
                            </div>
                        )}

                        <div className="space-y-2">
                            {project.files?.map(f => (
                                <div key={f.id} className="flex items-center justify-between p-3 bg-slate-900/40 rounded-xl group border border-transparent hover:border-indigo-500/20 transition-all">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <FileArchive size={16} className="text-indigo-400 flex-shrink-0" />
                                        <span className="text-slate-300 text-xs truncate max-w-[120px]">{f.name}</span>
                                    </div>
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                        <a href={f.url} download={f.name} title="Download file" className="p-1.5 text-slate-500 hover:text-emerald-400 transition-colors" onClick={e => e.stopPropagation()}>
                                            <Download size={14} />
                                        </a>
                                        <a href={f.url} target="_blank" rel="noopener noreferrer" title="Open in new tab" className="p-1.5 text-slate-500 hover:text-indigo-400 transition-colors">
                                            <ExternalLink size={14} />
                                        </a>
                                        {isOwner && (
                                            <button onClick={() => handleDeleteFile(f.id, f.url)} title="Delete file" className="p-1.5 text-slate-500 hover:text-red-400 transition-colors">
                                                <Trash2 size={14} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {(!project.files || project.files.length === 0) && (
                                <p className="text-slate-600 text-xs text-center py-4">No files uploaded yet</p>
                            )}
                        </div>
                    </section>
                </div>

                {/* Tasks, Time Records & Meetings */}
                <div className="lg:col-span-2 space-y-8">
                    {/* Tasks */}
                    <section>
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-slate-100 font-bold flex items-center gap-2 text-lg">
                                <CheckSquare size={18} className="text-indigo-400" /> Project Tasks
                            </h2>
                            {isAdmin && (
                                <button
                                    onClick={() => { setEditTask(undefined); setShowTaskForm(true); }}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-xs font-bold transition-all shadow-lg shadow-indigo-500/20"
                                >
                                    <Plus size={14} /> Add Task
                                </button>
                            )}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {projectTasks.map(t => (
                                <TaskCard
                                    key={t.id}
                                    task={t}
                                    onEdit={(task) => { setEditTask(task); setShowTaskForm(true); }}
                                    compact={false}
                                />
                            ))}
                            {projectTasks.length === 0 && (
                                <div className="col-span-full py-12 text-center border-2 border-dashed border-slate-800 rounded-2xl text-slate-600 italic">
                                    No tasks assigned to this project
                                </div>
                            )}
                        </div>
                    </section>

                    {/* Time Records */}
                    <ProjectTimeLogs project={project} tasks={projectTasks} />

                    {/* Meetings */}
                    <section>
                        <h2 className="text-slate-100 font-bold mb-4 flex items-center gap-2">
                            <Calendar size={18} className="text-purple-400" /> Project Meetings
                        </h2>
                        <div className="space-y-3">
                            {projectMeetings.map(m => (
                                <div key={m.id} className="p-4 bg-slate-800/40 border border-slate-700/50 rounded-xl flex items-center justify-between group hover:border-purple-500/40 transition-all">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex flex-col items-center justify-center text-purple-400 border border-purple-500/20">
                                            <span className="text-xs font-bold leading-none">{new Date(m.start_time).toLocaleString('en-US', { month: 'short' }).toUpperCase()}</span>
                                            <span className="text-lg font-black leading-none">{new Date(m.start_time).getDate()}</span>
                                        </div>
                                        <div>
                                            <h3 className="text-slate-200 font-medium group-hover:text-purple-400 transition-colors">{m.title}</h3>
                                            <p className="text-slate-500 text-xs mt-0.5">
                                                {new Date(m.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                        </div>
                                    </div>
                                    <ExternalLink size={14} className="text-slate-600 opacity-0 group-hover:opacity-100 transition-all" />
                                </div>
                            ))}
                            {projectMeetings.length === 0 && (
                                <p className="text-slate-600 text-sm italic py-4 text-center border-2 border-dashed border-slate-800 rounded-xl">No meetings linked</p>
                            )}
                        </div>
                    </section>

                    {/* Team Management */}
                    <TeamMembers project={project} />
                </div>

            </div>
            {showTaskForm && (
                <Modal
                    isOpen={showTaskForm}
                    title={editTask ? "Edit Task" : "Add New Project Task"}
                    onClose={() => { setShowTaskForm(false); setEditTask(undefined); }}
                >
                    <TaskForm
                        onClose={() => { setShowTaskForm(false); setEditTask(undefined); }}
                        editTask={editTask}
                        initialProjectId={project.id}
                        initialClientId={project.client_id || undefined}
                    />
                </Modal>
            )}
        </div>
    );
};

const ROLE_CONFIG = {
    admin: { label: 'Admin', color: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' },
    moderator: { label: 'Moderator', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
    viewer: { label: 'Viewer', color: 'bg-slate-700/50 text-slate-300 border-slate-600/30' },
};

const TeamMembers: React.FC<{ project: Project }> = ({ project }) => {
    const [userCode, setUserCode] = useState('');
    const [role, setRole] = useState<'admin' | 'moderator' | 'viewer'>('moderator');
    const [adding, setAdding] = useState(false);
    const [savedTeam, setSavedTeam] = useState<{ name: string; email: string; user_code: string; uid?: string }[]>([]);
    const [selectedMember, setSelectedMember] = useState('');
    const isOwner = auth.currentUser?.uid === project.owner_id;

    // Fetch saved team members from user profile
    React.useEffect(() => {
        const loadTeam = async () => {
            if (!auth.currentUser) return;
            const { doc, getDoc } = await import('firebase/firestore');
            const { db, APP_ID } = await import('../firebase/config');
            try {
                const snap = await getDoc(doc(db, `apps/${APP_ID}/users`, auth.currentUser.uid));
                if (snap.exists()) {
                    const data = snap.data();
                    setSavedTeam(data.teamMembers || []);
                }
            } catch { /* silent */ }
        };
        loadTeam();
    }, []);

    const handleSelectMember = (value: string) => {
        setSelectedMember(value);
        if (value === '__manual__' || value === '') {
            setUserCode('');
            return;
        }
        // Find the team member and auto-fill their code
        const member = savedTeam.find(m => m.user_code === value || m.email === value);
        if (member) {
            setUserCode(member.user_code || '');
        }
    };

    const handleAddMember = async () => {
        if (!userCode.trim()) { toast.error('Enter a User Code or select a team member'); return; }
        setAdding(true);
        try {
            const { searchByUserCode, updateDocById: update } = await import('../firebase/firestore');
            const { db, APP_ID } = await import('../firebase/config');
            const { collection, query, where, getDocs, writeBatch, doc } = await import('firebase/firestore');

            const results = await searchByUserCode(userCode.trim());
            if (results.length === 0) { toast.error('No user found with that code.'); return; }
            const found = results[0];
            const targetUid: string = found.uid || found.id;
            if (targetUid === project.owner_id) { toast.error('That user is already the project owner'); return; }
            const existing: string[] = project.member_uids || project.shared_with || [];
            if (existing.includes(targetUid)) { toast.error('This user is already a team member'); return; }

            // Get email from selected member or from found user
            const selectedTeamMember = savedTeam.find(m => m.user_code === userCode.trim());
            const emailLabel = selectedTeamMember?.email || found.email || '';

            const newMember = { uid: targetUid, email: emailLabel, role, added_at: new Date() };
            const updatedMembers = [...(project.members || []), newMember];
            const updatedMemberUids = [...existing, targetUid];
            const updatedAdminUids = role === 'admin' ? [...(project.admin_uids || []), targetUid] : (project.admin_uids || []);
            const updatedModeratorUids = role === 'moderator' ? [...(project.moderator_uids || []), targetUid] : (project.moderator_uids || []);
            const updatedViewerUids = role === 'viewer' ? [...(project.viewer_uids || []), targetUid] : (project.viewer_uids || []);

            // 1. Update Project
            await update('projects', project.id, { members: updatedMembers, member_uids: updatedMemberUids, admin_uids: updatedAdminUids, moderator_uids: updatedModeratorUids, viewer_uids: updatedViewerUids });

            // 2. Sync Tasks
            const tasksQuery = query(collection(db, `apps/${APP_ID}/tasks`), where('project_id', '==', project.id));
            const tasksSnap = await getDocs(tasksQuery);
            if (!tasksSnap.empty) {
                const batch = writeBatch(db);
                tasksSnap.docs.forEach(d => {
                    batch.update(doc(db, `apps/${APP_ID}/tasks`, d.id), {
                        project_member_uids: updatedMemberUids
                    });
                });
                await batch.commit();
            }

            setUserCode(''); setSelectedMember('');
            toast.success(`Added ${found.displayName || emailLabel || 'member'} as ${role}`);
        } catch (err) {
            console.error(err);
            toast.error('Failed to add member');
        } finally {
            setAdding(false);
        }
    };

    const handleRemoveMember = async (targetUid: string) => {
        try {
            const { updateDocById: update } = await import('../firebase/firestore');
            const { db, APP_ID } = await import('../firebase/config');
            const { collection, query, where, getDocs, writeBatch, doc } = await import('firebase/firestore');

            const updatedMembers = (project.members || []).filter((m: { uid: string }) => m.uid !== targetUid);
            const updatedMemberUids = (project.member_uids || []).filter((u: string) => u !== targetUid);
            const updatedAdminUids = (project.admin_uids || []).filter((u: string) => u !== targetUid);
            const updatedModeratorUids = (project.moderator_uids || []).filter((u: string) => u !== targetUid);
            const updatedViewerUids = (project.viewer_uids || []).filter((u: string) => u !== targetUid);

            // 1. Update Project
            await update('projects', project.id, { members: updatedMembers, member_uids: updatedMemberUids, admin_uids: updatedAdminUids, moderator_uids: updatedModeratorUids, viewer_uids: updatedViewerUids });

            // 2. Sync Tasks
            const tasksQuery = query(collection(db, `apps/${APP_ID}/tasks`), where('project_id', '==', project.id));
            const tasksSnap = await getDocs(tasksQuery);
            if (!tasksSnap.empty) {
                const batch = writeBatch(db);
                tasksSnap.docs.forEach(d => {
                    batch.update(doc(db, `apps/${APP_ID}/tasks`, d.id), {
                        project_member_uids: updatedMemberUids
                    });
                });
                await batch.commit();
            }

            toast.success('Member removed');
        } catch (e) {
            console.error(e);
            toast.error('Failed to remove member');
        }
    };

    const members = project.members || [];
    const existingUids = new Set([project.owner_id, ...(project.member_uids || [])]);
    const availableTeam = savedTeam.filter(m => !existingUids.has(m.uid || ''));

    return (
        <section className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6">
            <h2 className="text-slate-100 font-bold mb-4 flex items-center gap-2">
                <Users size={18} className="text-emerald-400" /> Team Members
            </h2>

            {isOwner && (
                <div className="mb-6 space-y-3 p-4 bg-slate-900/50 rounded-xl border border-white/5">
                    <p className="text-slate-500 text-[11px] font-bold uppercase tracking-widest">Add Team Member</p>

                    {/* Team Member Dropdown */}
                    <select
                        value={selectedMember}
                        onChange={(e) => handleSelectMember(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition-all"
                    >
                        <option value="">Select from your team directory…</option>
                        {availableTeam.map((m, i) => (
                            <option key={i} value={m.user_code || m.email}>
                                {m.name || m.email || m.user_code} {m.user_code ? `(${m.user_code})` : ''} {m.email ? `— ${m.email}` : ''}
                            </option>
                        ))}
                        {availableTeam.length === 0 && (
                            <option disabled>No available team members</option>
                        )}
                        <option value="__manual__">✎ Enter User Code manually…</option>
                    </select>

                    {/* Manual Code Input — shown when "manual" is selected or no dropdown match */}
                    {(selectedMember === '__manual__' || (selectedMember === '' && userCode)) && (
                        <input
                            type="text"
                            value={userCode}
                            onChange={(e) => setUserCode(e.target.value.toUpperCase())}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddMember()}
                            placeholder="TM-XXXXXX (User Code)"
                            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200 font-mono focus:outline-none focus:border-indigo-500 transition-all"
                        />
                    )}

                    <div className="flex gap-2">
                        <select value={role} onChange={(e) => setRole(e.target.value as 'admin' | 'moderator' | 'viewer')} className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition-all">
                            <option value="admin">Admin — Full control</option>
                            <option value="moderator">Moderator — Add & edit, no delete</option>
                            <option value="viewer">Viewer — Read only + status changes</option>
                        </select>
                        <button onClick={handleAddMember} disabled={adding || !userCode.trim()} className="bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white px-5 py-2 rounded-xl text-sm font-bold transition-all">
                            {adding ? '...' : 'Add'}
                        </button>
                    </div>
                </div>
            )}

            <div className="space-y-2">
                <div className="flex items-center justify-between p-3 bg-slate-900/40 rounded-xl border border-indigo-500/20">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-indigo-500/30 text-indigo-300 flex items-center justify-center font-bold text-xs">O</div>
                        <div>
                            <p className="text-slate-200 text-sm font-medium">Project Owner {auth.currentUser?.uid === project.owner_id ? '(You)' : ''}</p>
                            <p className="text-slate-500 text-[10px]">Full Access</p>
                        </div>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-indigo-500/20 text-indigo-300 border-indigo-500/30">Owner</span>
                </div>

                {members.map((m) => {
                    const cfg = ROLE_CONFIG[m.role as keyof typeof ROLE_CONFIG] || ROLE_CONFIG.viewer;
                    const isYou = m.uid === auth.currentUser?.uid;

                    const handleUpdateRole = async (newRole: string) => {
                        try {
                            const { updateDocById: update } = await import('../firebase/firestore');
                            const updatedMembers = (project.members || []).map((mem: any) =>
                                mem.uid === m.uid ? { ...mem, role: newRole } : mem
                            );
                            const updatedAdminUids = updatedMembers.filter((mem: any) => mem.role === 'admin').map((mem: any) => mem.uid);
                            const updatedModeratorUids = updatedMembers.filter((mem: any) => mem.role === 'moderator').map((mem: any) => mem.uid);
                            const updatedViewerUids = updatedMembers.filter((mem: any) => mem.role === 'viewer').map((mem: any) => mem.uid);

                            await update('projects', project.id, {
                                members: updatedMembers,
                                admin_uids: updatedAdminUids,
                                moderator_uids: updatedModeratorUids,
                                viewer_uids: updatedViewerUids
                            });
                            toast.success('Member role updated');
                        } catch (e) {
                            console.error(e);
                            toast.error('Failed to update role');
                        }
                    };

                    return (
                        <div key={m.uid} className="flex items-center justify-between p-3 bg-slate-900/40 rounded-xl border border-white/5">
                            <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${cfg.color.split(' ').slice(0, 2).join(' ')}`}>
                                    {(m.email || m.uid).charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <p className="text-slate-200 text-sm font-medium truncate max-w-[140px]">{m.email || m.uid.substring(0, 8)} {isYou ? '(You)' : ''}</p>
                                    <p className="text-slate-500 text-[10px] font-mono">{m.uid.substring(0, 8)}…</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {isOwner && !isYou ? (
                                    <select
                                        value={m.role}
                                        onChange={(e) => handleUpdateRole(e.target.value)}
                                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border bg-transparent outline-none cursor-pointer hover:border-indigo-500/50 transition-all ${cfg.color}`}
                                    >
                                        <option value="admin" className="bg-slate-900">Admin</option>
                                        <option value="moderator" className="bg-slate-900">Moderator</option>
                                        <option value="viewer" className="bg-slate-900">Viewer</option>
                                    </select>
                                ) : (
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${cfg.color}`}>{cfg.label}</span>
                                )}
                                {isOwner && !isYou && (
                                    <button onClick={() => handleRemoveMember(m.uid)} className="p-1.5 text-slate-600 hover:text-red-400 transition-colors rounded-lg hover:bg-red-500/10" title="Remove member">
                                        <Trash2 size={14} />
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}

                {members.length === 0 && (
                    <p className="text-slate-600 text-xs text-center py-4">No team members yet. Add one using their User Code.</p>
                )}
            </div>
        </section>
    );
};

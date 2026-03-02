import React, { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ArrowLeft, FolderKanban, CheckSquare, Calendar,
    FileArchive, Play, Square, Timer, Upload, ExternalLink
} from 'lucide-react';
import { useAppStore } from '../store';
import { TaskCard } from '../components/tasks/TaskCard';
import { statusBadge } from '../components/ui/Badge';
import { formatDate, formatDuration } from '../utils/timeFormat';
import { useTimer } from '../hooks/useTimer';
import { useDropzone } from 'react-dropzone';
import { auth } from '../firebase/config';
import { uploadFile } from '../firebase/storage';
import { updateDocById } from '../firebase/firestore';
import toast from 'react-hot-toast';

export const ProjectDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { projects, tasks, meetings, clients } = useAppStore();
    const [uploading, setUploading] = useState(false);

    const project = projects.find((p) => p.id === id);
    const client = clients.find((c) => c.id === project?.client_id);

    const { isRunning, elapsed, start, stop } = useTimer(
        project?.id || '',
        project?.time_logs || [],
        'projects'
    );

    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        if (!project) return;

        if (!auth.currentUser) {
            toast.error('Upload Failed: You must be authenticated. Enable "Anonymous Auth" in Firebase Console.');
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
    const projectMeetings = meetings.filter((m) => m.linked_project_id === id);
    const totalMs = (project.total_time_ms || 0) + (isRunning ? elapsed : 0);

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

                <div className="flex items-center gap-4 bg-slate-900/50 p-4 rounded-2xl border border-white/5 backdrop-blur-md">
                    <div className="flex items-center gap-3 pr-4 border-r border-slate-700/50">
                        <div className={`p-2 rounded-xl ${isRunning ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}>
                            <Timer size={20} className={isRunning ? 'animate-spin-slow' : ''} />
                        </div>
                        <div className="text-left">
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Project Timer</p>
                            <span className={`text-xl font-mono font-bold ${isRunning ? 'text-emerald-400' : 'text-slate-300'}`}>
                                {formatDuration(totalMs)}
                            </span>
                        </div>
                    </div>
                    <button
                        onClick={isRunning ? stop : start}
                        className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all shadow-lg active:scale-95 ${isRunning
                            ? 'bg-red-500 text-white hover:bg-red-600 shadow-red-500/20'
                            : 'bg-indigo-500 text-white hover:bg-indigo-600 shadow-indigo-500/20'
                            }`}
                    >
                        {isRunning ? <Square size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
                        {isRunning ? 'STOP' : 'START'}
                    </button>
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

                        {/* Dropzone */}
                        <div
                            {...getRootProps()}
                            className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all mb-4 ${isDragActive ? 'border-indigo-500 bg-indigo-500/10' : 'border-slate-700 hover:border-slate-500'
                                }`}
                        >
                            <input {...getInputProps()} />
                            <Upload size={24} className="mx-auto mb-2 text-slate-500" />
                            <p className="text-xs text-slate-400">
                                {uploading ? 'Uploading...' : 'Drop files here or click to upload'}
                            </p>
                        </div>

                        <div className="space-y-2">
                            {project.files?.map(f => (
                                <div key={f.id} className="flex items-center justify-between p-3 bg-slate-900/40 rounded-xl group border border-transparent hover:border-indigo-500/20 transition-all">
                                    <div className="flex items-center gap-3">
                                        <FileArchive size={16} className="text-indigo-400" />
                                        <span className="text-slate-300 text-xs truncate max-w-[120px]">{f.name}</span>
                                    </div>
                                    <a href={f.url} target="_blank" rel="noopener noreferrer" className="p-1.5 text-slate-500 hover:text-indigo-400 transition-colors">
                                        <ExternalLink size={14} />
                                    </a>
                                </div>
                            ))}
                            {(!project.files || project.files.length === 0) && (
                                <p className="text-slate-600 text-xs text-center py-4">No files uploaded yet</p>
                            )}
                        </div>
                    </section>
                </div>

                {/* Tasks & Meetings */}
                <div className="lg:col-span-2 space-y-8">
                    {/* Tasks */}
                    <section>
                        <h2 className="text-slate-100 font-bold mb-4 flex items-center gap-2">
                            <CheckSquare size={18} className="text-indigo-400" /> Project Tasks
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {projectTasks.map(t => (
                                <TaskCard key={t.id} task={t} onEdit={() => { }} compact />
                            ))}
                            {projectTasks.length === 0 && (
                                <div className="col-span-full py-12 text-center border-2 border-dashed border-slate-800 rounded-2xl text-slate-600 italic">
                                    No tasks assigned to this project
                                </div>
                            )}
                        </div>
                    </section>

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
                </div>

            </div>
        </div>
    );
};

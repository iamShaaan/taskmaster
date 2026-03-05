import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, FolderKanban, Pencil, Trash2, CheckSquare, Calendar, ExternalLink, Timer } from 'lucide-react';
import { useAppStore } from '../store';
import { ProjectForm } from '../components/projects/ProjectForm';
import { Modal } from '../components/ui/Modal';
import type { Project } from '../types';
import { deleteDocById } from '../firebase/firestore';
import { statusBadge, priorityBadge } from '../components/ui/Badge';
import { formatDuration } from '../utils/timeFormat';
import toast from 'react-hot-toast';

export const Projects: React.FC = () => {
    const navigate = useNavigate();
    const { projects, tasks, meetings, clients } = useAppStore();
    const [showForm, setShowForm] = useState(false);
    const [editProject, setEditProject] = useState<Project | undefined>();

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this project?')) return;
        await deleteDocById('projects', id);
        toast.success('Project deleted');
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <p className="text-slate-400 text-sm">{projects.length} project{projects.length !== 1 ? 's' : ''}</p>
                <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium rounded-lg transition-all">
                    <Plus size={16} /> New Project
                </button>
            </div>

            {projects.length === 0 ? (
                <div className="text-center py-20">
                    <FolderKanban size={48} className="text-slate-700 mx-auto mb-3" />
                    <p className="text-slate-400">No projects yet. Create your first project!</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {projects.map((project) => {
                        const projectTasks = tasks.filter((t) => t.project_id === project.id);
                        const doneTasks = projectTasks.filter((t) => t.status === 'done').length;
                        const projectMeetings = meetings.filter((m) => m.linked_project_id === project.id);
                        const progress = projectTasks.length > 0 ? Math.round((doneTasks / projectTasks.length) * 100) : 0;
                        const totalTrackedMs = projectTasks.reduce((sum, t) => sum + (t.total_time_ms || 0), 0);
                        const isDue = project.due_date && new Date(project.due_date) < new Date(new Date().setHours(0, 0, 0, 0)) && project.status !== 'completed';

                        return (
                            <div key={project.id} className={`group border rounded-xl p-5 transition-all ${isDue ? 'bg-red-500/10 border-red-500/30 hover:border-red-500/50' : 'bg-slate-800 border-slate-700/50 hover:border-indigo-500/40'}`}>
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: project.color }} />
                                        <h3
                                            className="text-slate-100 font-bold hover:text-indigo-400 cursor-pointer transition-colors"
                                            onClick={() => navigate(`/projects/${project.id}`)}
                                        >
                                            {project.name}
                                        </h3>
                                    </div>
                                    <div className="flex items-center gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-all">
                                        <button
                                            onClick={() => navigate(`/projects/${project.id}`)}
                                            className="p-1.5 text-slate-400 hover:text-indigo-400 rounded-lg hover:bg-indigo-500/10 transition-all"
                                            title="View Details"
                                        >
                                            <ExternalLink size={14} />
                                        </button>
                                        <button onClick={() => { setEditProject(project); setShowForm(true); }} className="p-1.5 text-slate-500 hover:text-indigo-400 rounded-lg hover:bg-indigo-500/10 transition-all">
                                            <Pencil size={13} />
                                        </button>
                                        <button onClick={() => handleDelete(project.id)} className="p-1.5 text-slate-500 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-all">
                                            <Trash2 size={13} />
                                        </button>
                                    </div>
                                </div>

                                {project.description && <p className="text-slate-400 text-sm mb-3 line-clamp-2">{project.description}</p>}

                                <div className="flex items-center gap-2 mb-4">
                                    {statusBadge(project.status)}
                                    {priorityBadge(project.priority || 'medium')}
                                    {project.client_id && (
                                        <span className="text-xs text-slate-400 bg-slate-800/50 border border-slate-700/50 px-2 py-0.5 rounded uppercase tracking-wide font-medium truncate max-w-[120px]">
                                            {clients.find(c => c.id === project.client_id)?.name || 'Unknown Client'}
                                        </span>
                                    )}
                                </div>

                                {/* Progress Bar */}
                                {projectTasks.length > 0 && (
                                    <div className="mb-3">
                                        <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                                            <span>Progress</span>
                                            <span>{progress}%</span>
                                        </div>
                                        <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                                            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progress}%`, backgroundColor: project.color }} />
                                        </div>
                                    </div>
                                )}

                                <div className="flex items-center gap-4 pt-3 border-t border-slate-700/50">
                                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                        <CheckSquare size={12} />
                                        <span>{projectTasks.length} task{projectTasks.length !== 1 ? 's' : ''}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                        <Calendar size={12} />
                                        <span>{projectMeetings.length} meeting{projectMeetings.length !== 1 ? 's' : ''}</span>
                                    </div>
                                    {totalTrackedMs > 0 && (
                                        <div className="flex items-center gap-1.5 text-xs text-amber-400/80 ml-auto">
                                            <Timer size={12} />
                                            <span className="font-mono font-bold">{formatDuration(totalTrackedMs)}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <Modal isOpen={showForm} onClose={() => { setEditProject(undefined); setShowForm(false); }} title={editProject ? 'Edit Project' : 'New Project'}>
                <ProjectForm onClose={() => { setEditProject(undefined); setShowForm(false); }} editProject={editProject} />
            </Modal>
        </div>
    );
};

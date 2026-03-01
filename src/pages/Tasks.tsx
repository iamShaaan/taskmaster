import React, { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Plus, Search, LayoutGrid, List } from 'lucide-react';
import { useAppStore } from '../store';
import { TaskCard } from '../components/tasks/TaskCard';
import { TaskForm } from '../components/tasks/TaskForm';
import { Modal } from '../components/ui/Modal';
import type { Task } from '../types';

const STATUS_COLUMNS = [
    { key: 'open', label: 'Open', color: 'border-slate-600' },
    { key: 'in_progress', label: 'In Progress', color: 'border-indigo-500' },
    { key: 'done', label: 'Done', color: 'border-emerald-500' },
    { key: 'error', label: 'Error', color: 'border-red-500' },
] as const;

export const Tasks: React.FC = () => {
    const { tasks } = useAppStore();
    const [showForm, setShowForm] = useState(false);
    const [editTask, setEditTask] = useState<Task | undefined>();
    const [view, setView] = useState<'kanban' | 'list'>('kanban');
    const [search, setSearch] = useState('');
    const [filterType, setFilterType] = useState<string>('all');
    const [filterPriority, setFilterPriority] = useState<string>('all');

    const filtered = tasks.filter((t) => {
        const matchSearch = t.title.toLowerCase().includes(search.toLowerCase()) || t.description?.toLowerCase().includes(search.toLowerCase());
        const matchType = filterType === 'all' || t.type === filterType;
        const matchPriority = filterPriority === 'all' || t.priority === filterPriority;
        return matchSearch && matchType && matchPriority;
    });

    const openEdit = (task: Task) => { setEditTask(task); setShowForm(true); };
    const closeForm = () => { setEditTask(undefined); setShowForm(false); };

    return (
        <div className="h-full flex flex-col gap-4">
            {/* Toolbar */}
            <div className="flex items-center gap-3 flex-wrap">
                <div className="relative flex-1 min-w-48">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-indigo-500" placeholder="Search tasks..." value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
                <select className="bg-slate-800 border border-slate-700 text-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
                    <option value="all">All Types</option>
                    <option value="personal">Personal</option>
                    <option value="project">Project</option>
                    <option value="client">Client</option>
                </select>
                <select className="bg-slate-800 border border-slate-700 text-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)}>
                    <option value="all">All Priorities</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                </select>
                <div className="flex rounded-lg border border-slate-700 overflow-hidden">
                    <button onClick={() => setView('kanban')} className={`px-3 py-2 text-sm transition-all ${view === 'kanban' ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-100'}`}>
                        <LayoutGrid size={16} />
                    </button>
                    <button onClick={() => setView('list')} className={`px-3 py-2 text-sm transition-all ${view === 'list' ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-100'}`}>
                        <List size={16} />
                    </button>
                </div>
                <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium rounded-lg transition-all">
                    <Plus size={16} /> New Task
                </button>
            </div>

            {/* Kanban View */}
            {view === 'kanban' && (
                <div className="flex-1 grid grid-cols-4 gap-4 overflow-x-auto">
                    {STATUS_COLUMNS.map(({ key, label, color }) => {
                        const colTasks = filtered.filter((t) => t.status === key);
                        return (
                            <div key={key} className="flex flex-col gap-3 min-w-60">
                                <div className={`flex items-center justify-between pb-2 border-b-2 ${color}`}>
                                    <span className="text-slate-300 text-sm font-semibold">{label}</span>
                                    <span className="text-slate-500 text-xs bg-slate-800 px-2 py-0.5 rounded-full">{colTasks.length}</span>
                                </div>
                                <div className="flex flex-col gap-3 flex-1 overflow-y-auto max-h-[calc(100vh-280px)] pr-1">
                                    <AnimatePresence mode="popLayout">
                                        {colTasks.map((task) => (
                                            <TaskCard key={task.id} task={task} onEdit={openEdit} />
                                        ))}
                                    </AnimatePresence>
                                    {colTasks.length === 0 && (
                                        <div className="text-center py-8 text-slate-600 text-sm border-2 border-dashed border-slate-800 rounded-xl">Empty</div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* List View */}
            {view === 'list' && (
                <div className="flex flex-col gap-2">
                    {filtered.length === 0 && <div className="text-center py-16 text-slate-500">No tasks found</div>}
                    {filtered.map((task) => <TaskCard key={task.id} task={task} onEdit={openEdit} compact />)}
                </div>
            )}

            <Modal isOpen={showForm} onClose={closeForm} title={editTask ? 'Edit Task' : 'New Task'} size="lg">
                <TaskForm onClose={closeForm} editTask={editTask} />
            </Modal>
        </div>
    );
};

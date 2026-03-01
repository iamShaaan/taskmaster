import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    CheckSquare, Calendar, Users, FolderKanban, Timer, Clock,
    TrendingUp
} from 'lucide-react';
import { useAppStore } from '../store';
import { listenCollection, orderBy, toDate } from '../firebase/firestore';
import type { Task, Meeting, Client, Project } from '../types';
import { formatDuration, formatDateTime } from '../utils/timeFormat';
import { statusBadge } from '../components/ui/Badge';
import { Link } from 'react-router-dom';

const StatCard = ({ icon: Icon, label, value, color, to }: { icon: React.ElementType; label: string; value: number; color: string; to: string }) => (
    <Link to={to}>
        <motion.div whileHover={{ scale: 1.02 }} className="bg-slate-800 border border-slate-700/50 rounded-xl p-5 hover:border-indigo-500/40 transition-all cursor-pointer">
            <div className="flex items-center justify-between mb-3">
                <div className={`p-2 rounded-lg ${color}`}><Icon size={18} /></div>
            </div>
            <p className="text-3xl font-bold text-slate-100">{value}</p>
            <p className="text-slate-400 text-sm mt-1">{label}</p>
        </motion.div>
    </Link>
);

export const Dashboard: React.FC = () => {
    const { tasks, meetings, clients, projects, setTasks, setMeetings, setClients, setProjects } = useAppStore();

    useEffect(() => {
        const unsubTasks = listenCollection('tasks', (data) => {
            setTasks(data.map((d) => ({ ...d, due_date: toDate(d.due_date as never), created_at: toDate(d.created_at as never) || new Date() } as unknown as Task)));
        }, orderBy('created_at', 'desc'));
        const unsubMeetings = listenCollection('meetings', (data) => {
            setMeetings(data.map((d) => ({ ...d, start_time: toDate(d.start_time as never) || new Date(), end_time: toDate(d.end_time as never) || new Date(), created_at: toDate(d.created_at as never) || new Date() } as unknown as Meeting)));
        }, orderBy('start_time', 'asc'));
        const unsubClients = listenCollection('clients', (data) => {
            setClients(data.map((d) => ({ ...d, created_at: toDate(d.created_at as never) || new Date() } as unknown as Client)));
        });
        const unsubProjects = listenCollection('projects', (data) => {
            setProjects(data.map((d) => ({ ...d, created_at: toDate(d.created_at as never) || new Date() } as unknown as Project)));
        });
        return () => { unsubTasks(); unsubMeetings(); unsubClients(); unsubProjects(); };
    }, [setTasks, setMeetings, setClients, setProjects]);

    const openTasks = tasks.filter((t) => t.status === 'open' || t.status === 'in_progress');
    const doneTasks = tasks.filter((t) => t.status === 'done');
    const now = new Date();
    const upcomingMeetings = meetings.filter((m) => m.start_time > now).slice(0, 5);
    const recentTasks = tasks.slice(0, 5);
    const todayMs = tasks.reduce((acc, t) => acc + (t.total_time_ms || 0), 0);

    return (
        <div className="space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard icon={CheckSquare} label="Open Tasks" value={openTasks.length} color="bg-indigo-500/20 text-indigo-400" to="/tasks" />
                <StatCard icon={Calendar} label="Meetings" value={upcomingMeetings.length} color="bg-purple-500/20 text-purple-400" to="/meetings" />
                <StatCard icon={Users} label="Clients" value={clients.length} color="bg-emerald-500/20 text-emerald-400" to="/clients" />
                <StatCard icon={FolderKanban} label="Projects" value={projects.length} color="bg-amber-500/20 text-amber-400" to="/projects" />
            </div>

            {/* Time Tracked + Done Count */}
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-800 border border-slate-700/50 rounded-xl p-5">
                    <div className="flex items-center gap-2 mb-1">
                        <Timer size={16} className="text-emerald-400" />
                        <span className="text-slate-400 text-sm">Total Time Tracked</span>
                    </div>
                    <p className="text-2xl font-bold text-emerald-400">{formatDuration(todayMs)}</p>
                </div>
                <div className="bg-slate-800 border border-slate-700/50 rounded-xl p-5">
                    <div className="flex items-center gap-2 mb-1">
                        <TrendingUp size={16} className="text-indigo-400" />
                        <span className="text-slate-400 text-sm">Completed Tasks</span>
                    </div>
                    <p className="text-2xl font-bold text-indigo-400">{doneTasks.length}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Tasks */}
                <div className="bg-slate-800 border border-slate-700/50 rounded-xl p-5">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-slate-100 font-semibold">Recent Tasks</h2>
                        <Link to="/tasks" className="text-indigo-400 text-xs hover:text-indigo-300 transition-colors">View all →</Link>
                    </div>
                    {recentTasks.length === 0 ? (
                        <div className="text-center py-8">
                            <CheckSquare size={32} className="text-slate-700 mx-auto mb-2" />
                            <p className="text-slate-500 text-sm">No tasks yet</p>
                            <Link to="/tasks" className="text-indigo-400 text-xs hover:text-indigo-300">Create your first task →</Link>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {recentTasks.map((task) => (
                                <div key={task.id} className="flex items-center justify-between py-2 border-b border-slate-700/50 last:border-0">
                                    <div className="min-w-0 flex-1">
                                        <p className="text-slate-200 text-sm truncate">{task.title}</p>
                                        {task.due_date && <p className="text-slate-500 text-xs">{formatDateTime(task.due_date)}</p>}
                                    </div>
                                    <div className="ml-3 flex-shrink-0">{statusBadge(task.status)}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Upcoming Meetings */}
                <div className="bg-slate-800 border border-slate-700/50 rounded-xl p-5">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-slate-100 font-semibold">Upcoming Meetings</h2>
                        <Link to="/meetings" className="text-indigo-400 text-xs hover:text-indigo-300">View all →</Link>
                    </div>
                    {upcomingMeetings.length === 0 ? (
                        <div className="text-center py-8">
                            <Calendar size={32} className="text-slate-700 mx-auto mb-2" />
                            <p className="text-slate-500 text-sm">No upcoming meetings</p>
                            <Link to="/meetings" className="text-indigo-400 text-xs hover:text-indigo-300">Schedule one →</Link>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {upcomingMeetings.map((m) => (
                                <div key={m.id} className="flex items-start gap-3 py-2 border-b border-slate-700/50 last:border-0">
                                    <div className="p-1.5 bg-purple-500/15 rounded-lg flex-shrink-0 mt-0.5">
                                        <Clock size={13} className="text-purple-400" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-slate-200 text-sm">{m.title}</p>
                                        <p className="text-slate-500 text-xs">{formatDateTime(m.start_time)}</p>
                                        {m.participants?.length > 0 && (
                                            <p className="text-slate-600 text-xs truncate">{m.participants.join(', ')}</p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

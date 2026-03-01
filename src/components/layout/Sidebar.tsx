import React from 'react';
import { NavLink } from 'react-router-dom';
import {
    LayoutDashboard,
    CheckSquare,
    Calendar,
    Users,
    FolderKanban,
    FileText,
    HardDrive,
    ChevronLeft,
    ChevronRight,
    Timer,
    Sparkles,
} from 'lucide-react';
import { useAppStore } from '../../store';

const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard', end: true },
    { to: '/tasks', icon: CheckSquare, label: 'Tasks' },
    { to: '/meetings', icon: Calendar, label: 'Meetings' },
    { to: '/clients', icon: Users, label: 'Clients' },
    { to: '/projects', icon: FolderKanban, label: 'Projects' },
    { to: '/notes', icon: FileText, label: 'Notes & Vault' },
    { to: '/files', icon: HardDrive, label: 'Files' },
];

export const Sidebar: React.FC = () => {
    const { sidebarOpen, setSidebarOpen, activeTimerId, tasks } = useAppStore();
    const activeTask = tasks.find((t) => t.id === activeTimerId);

    return (
        <aside
            className={`${sidebarOpen ? 'w-60' : 'w-16'} transition-all duration-300 bg-slate-900 border-r border-slate-700/50 flex flex-col h-screen sticky top-0 z-30`}
        >
            {/* Logo */}
            <div className="flex items-center gap-3 px-4 py-5 border-b border-slate-700/50">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                    <Sparkles size={16} className="text-white" />
                </div>
                {sidebarOpen && (
                    <span className="text-slate-100 font-bold text-sm tracking-wide">TaskMaster</span>
                )}
            </div>

            {/* Nav Items */}
            <nav className="flex-1 py-4 space-y-1 px-2">
                {navItems.map(({ to, icon: Icon, label, end }) => (
                    <NavLink
                        key={to}
                        to={to}
                        end={end}
                        className={({ isActive }) =>
                            `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 group ${isActive
                                ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
                            }`
                        }
                    >
                        <Icon size={18} className="flex-shrink-0" />
                        {sidebarOpen && <span className="text-sm font-medium">{label}</span>}
                    </NavLink>
                ))}
            </nav>

            {/* Active Timer Banner */}
            {activeTimerId && activeTask && sidebarOpen && (
                <div className="mx-2 mb-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                    <div className="flex items-center gap-2 mb-1">
                        <Timer size={14} className="text-emerald-400 animate-pulse" />
                        <span className="text-emerald-400 text-xs font-semibold">TIMER RUNNING</span>
                    </div>
                    <p className="text-slate-200 text-xs truncate">{activeTask.title}</p>
                </div>
            )}

            {/* Collapse Button */}
            <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="m-3 p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-slate-100 hover:bg-slate-700 transition-all flex items-center justify-center"
            >
                {sidebarOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
            </button>
        </aside>
    );
};

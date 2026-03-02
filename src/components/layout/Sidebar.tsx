import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
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
    Sparkles,
    LogOut,
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
    const { user, logout } = useAuth();
    const activeTask = tasks.find((t) => t.id === activeTimerId);

    return (
        <aside
            className={`${sidebarOpen ? 'w-64' : 'w-18'} transition-all duration-300 bg-slate-900 border-r border-slate-700/50 flex flex-col h-screen sticky top-0 z-30`}
        >
            {/* Logo */}
            <div className="flex items-center gap-3 px-4 py-6 border-b border-slate-700/50 mb-4">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-indigo-500/20">
                    <Sparkles size={18} className="text-white" />
                </div>
                {sidebarOpen && (
                    <span className="text-slate-100 font-bold text-lg tracking-tight">TaskMaster</span>
                )}
            </div>

            {/* Nav Items */}
            <nav className="flex-1 space-y-1.5 px-3">
                {navItems.map(({ to, icon: Icon, label, end }) => (
                    <NavLink
                        key={to}
                        to={to}
                        end={end}
                        className={({ isActive }) =>
                            `flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 group ${isActive
                                ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shadow-[0_0_15px_rgba(99,102,241,0.1)]'
                                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50'
                            }`
                        }
                    >
                        <Icon size={20} className="flex-shrink-0" />
                        {sidebarOpen && <span className="text-sm font-semibold tracking-wide">{label}</span>}
                    </NavLink>
                ))}
            </nav>

            {/* Active Timer Banner */}
            {activeTimerId && activeTask && sidebarOpen && (
                <div className="mx-3 mb-4 p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 backdrop-blur-sm">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-emerald-400 text-[10px] font-black uppercase tracking-widest">Live Timer</span>
                    </div>
                    <p className="text-slate-200 text-xs font-medium truncate">{activeTask.title}</p>
                </div>
            )}

            {/* User Profile & Logout */}
            <div className="mt-auto border-t border-slate-700/50 p-4 space-y-4">
                {user && (
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-indigo-400 font-bold shadow-inner">
                            {user.displayName?.charAt(0) || user.email?.charAt(0).toUpperCase()}
                        </div>
                        {sidebarOpen && (
                            <div className="flex-1 min-w-0">
                                <p className="text-slate-200 text-sm font-bold truncate">{user.displayName || 'User'}</p>
                                <p className="text-slate-500 text-[10px] truncate">{user.email}</p>
                            </div>
                        )}
                    </div>
                )}

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        className="flex-1 p-2.5 rounded-xl bg-slate-800/50 border border-slate-700/50 text-slate-400 hover:text-slate-100 hover:bg-slate-700 transition-all flex items-center justify-center"
                    >
                        {sidebarOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
                    </button>
                    {sidebarOpen && (
                        <button
                            onClick={logout}
                            className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500 hover:text-white transition-all duration-200"
                            title="Logout"
                        >
                            <LogOut size={16} />
                        </button>
                    )}
                </div>
            </div>
        </aside>
    );
};

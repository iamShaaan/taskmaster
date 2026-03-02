import React, { useEffect, useState } from 'react';
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
    User,
    Archive
} from 'lucide-react';
import { useAppStore } from '../../store';
import { db, APP_ID } from '../../firebase/config';
import { doc, onSnapshot } from 'firebase/firestore';

const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard', end: true },
    { to: '/tasks', icon: CheckSquare, label: 'Tasks' },
    { to: '/meetings', icon: Calendar, label: 'Meetings' },
    { to: '/clients', icon: Users, label: 'Clients' },
    { to: '/projects', icon: FolderKanban, label: 'Projects' },
    { to: '/notes', icon: FileText, label: 'Notes & Vault' },
    { to: '/files', icon: HardDrive, label: 'Files' },
    { to: '/archive', icon: Archive, label: 'Archive' },
    { to: '/profile', icon: User, label: 'My Profile' },
];

export const Sidebar: React.FC = () => {
    const { sidebarOpen, setSidebarOpen, activeTimerId, tasks } = useAppStore();
    const { user, logout } = useAuth();
    const activeTask = tasks.find((t) => t.id === activeTimerId);
    const [photoURL, setPhotoURL] = useState<string | null>(null);
    const [displayName, setDisplayName] = useState<string | null>(null);

    // Live-listen to the user's profile photo from Firestore
    useEffect(() => {
        if (!user?.uid) return;
        const unsub = onSnapshot(doc(db, `apps/${APP_ID}/users`, user.uid), (snap) => {
            const data = snap.data();
            setPhotoURL(data?.photoURL || null);
            setDisplayName(data?.displayName || null);
        });
        return unsub;
    }, [user?.uid]);

    const resolvedName = displayName || user?.displayName || user?.email?.split('@')[0] || 'User';

    return (
        <aside
            className={`${sidebarOpen ? 'w-64' : 'w-18'} transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] bg-slate-900 border-r border-slate-700/50 flex flex-col h-screen sticky top-0 z-30`}
        >
            {/* Logo */}
            <div className="flex items-center gap-3 px-4 py-6 border-b border-slate-700/50 mb-4">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-indigo-500/20 transition-transform duration-200 hover:scale-105">
                    <Sparkles size={18} className="text-white" />
                </div>
                {sidebarOpen && (
                    <span className="text-slate-100 font-bold text-lg tracking-tight transition-opacity duration-200">TaskMaster</span>
                )}
            </div>

            {/* Nav Items */}
            <nav className="flex-1 space-y-1 px-3">
                {navItems.map(({ to, icon: Icon, label, end }) => (
                    <NavLink
                        key={to}
                        to={to}
                        end={end}
                        className={({ isActive }) =>
                            `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative overflow-hidden ${isActive
                                ? 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/25 shadow-[0_0_20px_rgba(99,102,241,0.12)]'
                                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 hover:shadow-[0_0_10px_rgba(99,102,241,0.06)] border border-transparent'
                            }`
                        }
                    >
                        {({ isActive }) => (
                            <>
                                {/* Active left accent bar */}
                                <span
                                    className={`absolute left-0 top-1/2 -translate-y-1/2 w-0.5 rounded-r-full transition-all duration-300 ${isActive
                                        ? 'h-5 bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.8)]'
                                        : 'h-0 bg-transparent'
                                        }`}
                                />
                                <Icon
                                    size={19}
                                    className={`flex-shrink-0 transition-all duration-200 ${isActive
                                        ? 'text-indigo-400'
                                        : 'group-hover:scale-110 group-hover:text-slate-100'
                                        }`}
                                />
                                {sidebarOpen && (
                                    <span className="text-sm font-semibold tracking-wide truncate">{label}</span>
                                )}
                            </>
                        )}
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
                        {/* Avatar: profile photo or initial */}
                        <div className="w-9 h-9 rounded-xl overflow-hidden flex-shrink-0 border border-slate-700 shadow-inner transition-all duration-200 hover:border-indigo-500/40 hover:shadow-[0_0_10px_rgba(99,102,241,0.15)]">
                            {photoURL ? (
                                <img
                                    src={photoURL}
                                    alt="avatar"
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div className="w-full h-full bg-slate-800 flex items-center justify-center text-indigo-400 font-bold text-sm">
                                    {resolvedName.charAt(0).toUpperCase()}
                                </div>
                            )}
                        </div>
                        {sidebarOpen && (
                            <div className="flex-1 min-w-0">
                                <p className="text-slate-200 text-sm font-bold truncate">{resolvedName}</p>
                                <p className="text-slate-500 text-[10px] truncate">{user.email}</p>
                            </div>
                        )}
                    </div>
                )}

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        className="flex-1 p-2.5 rounded-xl bg-slate-800/50 border border-slate-700/50 text-slate-400 hover:text-slate-100 hover:bg-slate-700 hover:border-slate-600 transition-all duration-200 flex items-center justify-center"
                    >
                        {sidebarOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
                    </button>
                    {sidebarOpen && (
                        <button
                            onClick={logout}
                            className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500 hover:text-white hover:border-red-500 hover:shadow-[0_0_15px_rgba(239,68,68,0.3)] transition-all duration-200"
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

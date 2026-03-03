import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Bell, Search, Menu } from 'lucide-react';
import { useAppStore } from '../../store';

const PAGE_TITLES: Record<string, string> = {
    '/': 'Dashboard',
    '/tasks': 'Tasks',
    '/meetings': 'Meetings',
    '/clients': 'Clients',
    '/projects': 'Projects',
    '/notes': 'Notes & Vault',
    '/files': 'Files',
    '/profile': 'My Profile',
};

export const AppShell: React.FC = () => {
    const location = useLocation();
    const { sidebarOpen, setSidebarOpen } = useAppStore();
    const title = PAGE_TITLES[location.pathname] || 'TaskMaster';
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

    return (
        <div className="flex h-screen bg-slate-950 overflow-hidden relative">
            <Sidebar />
            <div className="flex-1 flex flex-col overflow-hidden min-w-0">
                {/* Topbar */}
                <header className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-slate-700/50 bg-slate-900/60 backdrop-blur-sm shadow-sm sticky top-0 z-20">
                    <div className="flex items-center gap-3">
                        <button
                            className="md:hidden p-2 -ml-2 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                        >
                            <Menu size={20} />
                        </button>
                        <div key={location.pathname} className="page-title-fade">
                            <h1 className="text-slate-100 text-lg sm:text-xl font-bold truncate">{title}</h1>
                            <p className="text-slate-500 text-xs hidden sm:block">{today}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                            <input
                                type="text"
                                placeholder="Search..."
                                className="bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg pl-9 pr-4 py-2 w-32 sm:w-48 focus:outline-none focus:border-indigo-500/70 focus:ring-2 focus:ring-indigo-500/10 focus:w-48 sm:focus:w-64 transition-all duration-300"
                            />
                        </div>
                        <button className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-slate-100 hover:bg-slate-700 hover:shadow-[0_0_12px_rgba(99,102,241,0.15)] transition-all duration-200 relative hidden sm:flex">
                            <Bell size={18} />
                        </button>
                    </div>
                </header>

                {/* Main Content — keyed on location.key so each route change re-mounts the animation */}
                <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 pb-20 sm:pb-6 relative safe-area-bottom">
                    <div key={location.key} className="page-enter h-full">
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    );
};

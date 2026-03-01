import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Bell, Search } from 'lucide-react';
import { useLocation } from 'react-router-dom';

const PAGE_TITLES: Record<string, string> = {
    '/': 'Dashboard',
    '/tasks': 'Tasks',
    '/meetings': 'Meetings',
    '/clients': 'Clients',
    '/projects': 'Projects',
    '/notes': 'Notes & Vault',
    '/files': 'Files',
};

export const AppShell: React.FC = () => {
    const location = useLocation();
    const title = PAGE_TITLES[location.pathname] || 'TaskMaster';
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

    return (
        <div className="flex h-screen bg-slate-950 overflow-hidden">
            <Sidebar />
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Topbar */}
                <header className="flex items-center justify-between px-6 py-4 border-b border-slate-700/50 bg-slate-900/60 backdrop-blur-sm">
                    <div>
                        <h1 className="text-slate-100 text-xl font-bold">{title}</h1>
                        <p className="text-slate-500 text-xs">{today}</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                            <input
                                type="text"
                                placeholder="Search..."
                                className="bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg pl-9 pr-4 py-2 w-48 focus:outline-none focus:border-indigo-500 transition-colors"
                            />
                        </div>
                        <button className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-slate-100 hover:bg-slate-700 transition-all relative">
                            <Bell size={18} />
                        </button>
                    </div>
                </header>

                {/* Main Content */}
                <main className="flex-1 overflow-y-auto p-6">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

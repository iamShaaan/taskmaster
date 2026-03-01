import React from 'react';

interface BadgeProps {
    label: string;
    variant?: 'indigo' | 'emerald' | 'amber' | 'red' | 'slate' | 'purple';
    size?: 'sm' | 'md';
}

const variantMap = {
    indigo: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20 shadow-[0_0_15px_-3px_rgba(99,102,241,0.2)]',
    emerald: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20 shadow-[0_0_15px_-3px_rgba(16,185,129,0.2)]',
    amber: 'bg-amber-500/10 text-amber-300 border-amber-500/20 shadow-[0_0_15px_-3px_rgba(245,158,11,0.2)]',
    red: 'bg-red-500/10 text-red-300 border-red-500/20 shadow-[0_0_15px_-3px_rgba(239,68,68,0.2)]',
    slate: 'bg-slate-700/30 text-slate-300 border-slate-600/50',
    purple: 'bg-purple-500/10 text-purple-300 border-purple-500/20 shadow-[0_0_15px_-3px_rgba(168,85,247,0.2)]',
};

export const Badge: React.FC<BadgeProps> = ({ label, variant = 'slate', size = 'sm' }) => (
    <span
        className={`inline-flex items-center border rounded-md font-semibold tracking-wide ${variantMap[variant]} ${size === 'sm' ? 'px-2 py-0.5 text-[10px] uppercase' : 'px-3 py-1 text-xs uppercase'
            }`}
    >
        {label}
    </span>
);

export const statusBadge = (status: string) => {
    const map: Record<string, BadgeProps> = {
        open: { label: 'Open', variant: 'slate' },
        in_progress: { label: 'In Progress', variant: 'indigo' },
        done: { label: 'Done', variant: 'emerald' },
        error: { label: 'Error', variant: 'red' },
        active: { label: 'Active', variant: 'indigo' },
        paused: { label: 'Paused', variant: 'amber' },
        completed: { label: 'Completed', variant: 'emerald' },
    };
    const props = map[status] || { label: status, variant: 'slate' };
    return <Badge {...props} />;
};

export const priorityBadge = (priority: string) => {
    const map: Record<string, BadgeProps> = {
        low: { label: 'Low', variant: 'slate' },
        medium: { label: 'Medium', variant: 'amber' },
        high: { label: 'High', variant: 'red' },
    };
    const props = map[priority] || { label: priority, variant: 'slate' };
    return <Badge {...props} />;
};

export const typeBadge = (type: string) => {
    const map: Record<string, BadgeProps> = {
        personal: { label: 'Personal', variant: 'purple' },
        project: { label: 'Project', variant: 'indigo' },
        client: { label: 'Client', variant: 'emerald' },
    };
    const props = map[type] || { label: type, variant: 'slate' };
    return <Badge {...props} />;
};

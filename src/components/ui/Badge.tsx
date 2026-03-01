import React from 'react';

interface BadgeProps {
    label: string;
    variant?: 'indigo' | 'emerald' | 'amber' | 'red' | 'slate' | 'purple';
    size?: 'sm' | 'md';
}

const variantMap = {
    indigo: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
    emerald: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    amber: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    red: 'bg-red-500/15 text-red-400 border-red-500/30',
    slate: 'bg-slate-700/50 text-slate-400 border-slate-600',
    purple: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
};

export const Badge: React.FC<BadgeProps> = ({ label, variant = 'slate', size = 'sm' }) => (
    <span
        className={`inline-flex items-center border rounded-full font-medium ${variantMap[variant]} ${size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'
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

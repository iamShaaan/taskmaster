export const formatDuration = (ms: number): string => {
    if (ms < 1000) return '0s';
    const seconds = Math.floor(ms / 1000) % 60;
    const minutes = Math.floor(ms / 60000) % 60;
    const hours = Math.floor(ms / 3600000);
    if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
};

export const formatDate = (date: Date | null | undefined): string => {
    if (!date) return '—';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

export const formatDateTime = (date: Date | null | undefined): string => {
    if (!date) return '—';
    return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};

export const formatTime = (date: Date | null | undefined): string => {
    if (!date) return '—';
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
};

export const isOverdue = (date: Date | null | undefined): boolean => {
    if (!date) return false;
    return date < new Date();
};

export const getRelativeTime = (date: Date): string => {
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    const absDiff = Math.abs(diff);
    if (absDiff < 60000) return 'just now';
    if (absDiff < 3600000) return `${Math.round(absDiff / 60000)}m ${diff < 0 ? 'ago' : 'from now'}`;
    if (absDiff < 86400000) return `${Math.round(absDiff / 3600000)}h ${diff < 0 ? 'ago' : 'from now'}`;
    return `${Math.round(absDiff / 86400000)}d ${diff < 0 ? 'ago' : 'from now'}`;
};

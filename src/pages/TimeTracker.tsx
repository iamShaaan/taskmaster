import React, { useMemo, useState } from 'react';
import { useAppStore } from '../store';
import { Clock, Calendar as CalendarIcon, Search } from 'lucide-react';
import { formatDuration } from '../utils/timeFormat';
import { format } from 'date-fns';

export const TimeTracker: React.FC = () => {
    const { tasks } = useAppStore();
    const [searchQuery, setSearchQuery] = useState('');

    // Aggregate time logs by day
    const timeEntries = useMemo(() => {
        const entriesMap: Record<string, { date: Date; totalMs: number; tasks: Record<string, { title: string; ms: number }> }> = {};

        tasks.forEach(task => {
            if (!task.time_logs) return;

            task.time_logs.forEach(log => {
                const dateKey = format(new Date(log.start), 'yyyy-MM-dd');

                if (!entriesMap[dateKey]) {
                    entriesMap[dateKey] = {
                        date: new Date(log.start),
                        totalMs: 0,
                        tasks: {}
                    };
                }

                entriesMap[dateKey].totalMs += log.duration_ms;

                if (!entriesMap[dateKey].tasks[task.id]) {
                    entriesMap[dateKey].tasks[task.id] = { title: task.title, ms: 0 };
                }
                entriesMap[dateKey].tasks[task.id].ms += log.duration_ms;
            });
        });

        // Convert map to array and sort by date descending (newest first)
        return Object.values(entriesMap)
            .sort((a, b) => b.date.getTime() - a.date.getTime());
    }, [tasks]);


    const filteredEntries = useMemo(() => {
        if (!searchQuery.trim()) return timeEntries;
        const q = searchQuery.toLowerCase();

        return timeEntries.filter(day => {
            // Check if date string matches
            if (format(day.date, 'MMMM d, yyyy').toLowerCase().includes(q)) return true;
            // Check if any task title matches
            return Object.values(day.tasks).some(t => t.title.toLowerCase().includes(q));
        });
    }, [timeEntries, searchQuery]);


    return (
        <div className="bg-slate-900/50 border border-white/10 rounded-[2.5rem] p-8 sm:p-10 space-y-8 min-h-[500px]">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <h2 className="text-white text-xl font-black flex items-center gap-3">
                        <div className="p-2.5 bg-indigo-500/20 rounded-xl"><Clock size={20} className="text-indigo-400" /></div>
                        Time Tracker
                    </h2>
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-2">
                        Daily breakdown of your tracked time
                    </p>
                </div>

                {/* Search */}
                <div className="relative w-full md:w-64">
                    <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                        type="text"
                        placeholder="Search date or task..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-slate-950/50 border border-white/5 rounded-2xl pl-10 pr-4 py-3 text-sm text-white focus:border-indigo-500/50 outline-none transition-all"
                    />
                </div>
            </div>

            {timeEntries.length === 0 ? (
                <div className="flex flex-col items-center justify-center opacity-30 text-center py-12 border-2 border-dashed border-slate-800 rounded-3xl">
                    <Clock size={32} className="mb-2 text-slate-500" />
                    <p className="text-xs font-medium text-slate-400">No time tracked yet.</p>
                    <p className="text-[10px] text-slate-600 mt-1">Start a timer on a task to see your daily reports here.</p>
                </div>
            ) : filteredEntries.length === 0 ? (
                <div className="text-center py-10 opacity-60">
                    <p className="text-slate-400 text-sm">No time entries match your search.</p>
                </div>
            ) : (
                <div className="space-y-6">
                    {filteredEntries.map((dayEntry) => (
                        <div key={dayEntry.date.toISOString()} className="bg-slate-950/40 border border-white/5 rounded-2xl overflow-hidden group">
                            {/* Day Header */}
                            <div className="flex items-center justify-between p-5 bg-slate-900/60 border-b border-white/5 group-hover:bg-slate-800/60 transition-colors">
                                <div className="flex items-center gap-3 pr-4">
                                    <div className="p-2 bg-indigo-500/10 rounded-lg shrink-0">
                                        <CalendarIcon size={16} className="text-indigo-400" />
                                    </div>
                                    <div>
                                        <p className="text-white font-bold text-sm tracking-wide">
                                            {format(dayEntry.date, 'EEEE, MMMM do, yyyy')}
                                        </p>
                                        <p className="text-slate-500 text-[10px] uppercase font-black tracking-widest mt-0.5">
                                            {Object.keys(dayEntry.tasks).length} tasks worked on
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right shrink-0 pl-4 border-l border-white/5">
                                    <p className="text-emerald-400 font-black text-xl tracking-tight">
                                        {formatDuration(dayEntry.totalMs)}
                                    </p>
                                    <p className="text-slate-500 text-[9px] uppercase font-black tracking-widest mt-0.5">Total</p>
                                </div>
                            </div>

                            {/* Task Breakdown */}
                            <div className="p-4 bg-slate-950/20">
                                <div className="space-y-2">
                                    {Object.values(dayEntry.tasks).sort((a, b) => b.ms - a.ms).map((task, i) => (
                                        <div key={i} className="flex items-center justify-between py-2 px-3 rounded-xl hover:bg-slate-900 transition-colors">
                                            <div className="flex items-center gap-2 min-w-0 pr-4">
                                                <div className="w-1.5 h-1.5 rounded-full bg-slate-700 shrink-0" />
                                                <p className="text-slate-300 text-xs font-medium truncate">{task.title}</p>
                                            </div>
                                            <p className="text-emerald-400/80 text-xs font-bold font-mono tracking-widest shrink-0">
                                                {formatDuration(task.ms)}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

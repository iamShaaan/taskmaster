import React, { useMemo, useState } from 'react';
import { format, eachDayOfInterval, isToday, isFuture, startOfWeek, endOfWeek } from 'date-fns';
import type { Routine, DailyLog } from '../../types';

interface ChecklistHeatmapProps {
    routines: Routine[];
    dailyLogs: DailyLog[];
}

type DotStatus = 'deepgreen' | 'lightgreen' | 'empty' | 'future' | 'outside';

export const ChecklistHeatmap: React.FC<ChecklistHeatmapProps> = ({ routines, dailyLogs }) => {
    const [hoveredDay, setHoveredDay] = useState<string | null>(null);
    const today = new Date();
    const year = today.getFullYear();

    const activeRoutines = useMemo(() => routines.filter(r => !r.is_archived), [routines]);

    // Jan 1 to Dec 31 of current year, padded to full weeks
    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year, 11, 31);
    const gridStart = startOfWeek(yearStart, { weekStartsOn: 0 });
    const gridEnd = endOfWeek(yearEnd, { weekStartsOn: 0 });
    const allDays = eachDayOfInterval({ start: gridStart, end: gridEnd });

    // Build data map
    const dayData = useMemo(() => {
        const map: Record<string, { completed: number; total: number; rate: number; status: DotStatus }> = {};

        allDays.forEach(day => {
            const dateStr = format(day, 'yyyy-MM-dd');

            // Outside the year
            if (day < yearStart || day > yearEnd) {
                map[dateStr] = { completed: 0, total: 0, rate: 0, status: 'outside' };
                return;
            }

            if (isFuture(day) && !isToday(day)) {
                map[dateStr] = { completed: 0, total: 0, rate: 0, status: 'future' };
                return;
            }

            const total = activeRoutines.length;
            if (total === 0) {
                map[dateStr] = { completed: 0, total: 0, rate: 0, status: 'empty' };
                return;
            }

            const logsForDay = dailyLogs.filter(l => l.date === dateStr && l.completed);
            const completedIds = new Set(logsForDay.map(l => l.routine_id));
            const completed = activeRoutines.filter(r => completedIds.has(r.id)).length;
            const rate = Math.round((completed / total) * 100);

            let status: DotStatus = 'empty';
            if (rate >= 100) status = 'deepgreen';
            else if (rate >= 50) status = 'lightgreen';

            map[dateStr] = { completed, total, rate, status };
        });
        return map;
    }, [allDays, activeRoutines, dailyLogs]);

    // Arrange into weeks
    const weeks: (Date | null)[][] = [];
    for (let i = 0; i < allDays.length; i += 7) {
        weeks.push(allDays.slice(i, i + 7));
    }
    const totalWeeks = weeks.length;

    // Month labels
    const monthLabels = useMemo(() => {
        const labels: { index: number; label: string }[] = [];
        let lastMonth = -1;
        weeks.forEach((week, wi) => {
            for (const day of week) {
                if (!day) continue;
                const m = day.getMonth();
                if (m !== lastMonth && day >= yearStart && day <= yearEnd) {
                    labels.push({ index: wi, label: format(day, 'MMM') });
                    lastMonth = m;
                    break;
                }
            }
        });
        return labels;
    }, [weeks]);

    const getDotStyle = (status: DotStatus): string => {
        switch (status) {
            case 'deepgreen':  return 'bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.5)]';
            case 'lightgreen': return 'bg-emerald-900/60';
            case 'empty':      return 'bg-slate-800/80';
            case 'future':     return 'bg-slate-800/30';
            case 'outside':    return 'bg-transparent';
            default:           return 'bg-slate-800/80';
        }
    };

    const getTooltipColor = (status: DotStatus): string => {
        switch (status) {
            case 'deepgreen':  return 'text-emerald-400';
            case 'lightgreen': return 'text-emerald-300';
            default:           return 'text-slate-500';
        }
    };

    return (
        <div className="bg-slate-900/50 border border-white/10 rounded-2xl px-5 py-4 backdrop-blur-sm">
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                    <span className="text-slate-200 text-xs font-bold tracking-wide">All Around Productivity</span>
                    <span className="text-slate-700 text-[10px]">•</span>
                    <span className="text-slate-500 text-[10px] font-medium">{year}</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <span className="text-slate-600 text-[10px]">Less</span>
                    <div className="w-[9px] h-[9px] rounded-[2px] bg-slate-800/80" />
                    <div className="w-[9px] h-[9px] rounded-[2px] bg-emerald-900/60" />
                    <div className="w-[9px] h-[9px] rounded-[2px] bg-green-500" />
                    <span className="text-slate-600 text-[10px]">More</span>
                </div>
            </div>

            {/* Month labels */}
            <div className="relative mb-1.5" style={{ height: 14 }}>
                {monthLabels.map(({ index, label }, i) => (
                    <span
                        key={`${label}-${i}`}
                        className="text-slate-500 text-[10px] font-semibold absolute whitespace-nowrap"
                        style={{ left: `${(index / totalWeeks) * 100}%` }}
                    >
                        {label}
                    </span>
                ))}
            </div>

            {/* Grid — no day labels, clean */}
            <div
                className="w-full grid"
                style={{
                    gridTemplateColumns: `repeat(${totalWeeks}, 1fr)`,
                    gridTemplateRows: 'repeat(7, 1fr)',
                    gap: 3,
                }}
            >
                {weeks.map((week, wi) =>
                    week.map((day, di) => {
                        if (!day) return <div key={`${wi}-${di}`} />;

                        const dateStr = format(day, 'yyyy-MM-dd');
                        const data = dayData[dateStr];
                        const status = data?.status || 'empty';
                        const style = getDotStyle(status);
                        const isTodayDay = isToday(day);
                        const isHovered = hoveredDay === dateStr;
                        const isOutside = status === 'outside';

                        return (
                            <div
                                key={`${wi}-${di}`}
                                className="relative"
                                style={{ gridColumn: wi + 1, gridRow: di + 1 }}
                                onMouseEnter={() => !isOutside && setHoveredDay(dateStr)}
                                onMouseLeave={() => setHoveredDay(null)}
                            >
                                <div
                                    className={`
                                        w-full aspect-square rounded-[2.5px] transition-all duration-150
                                        ${style}
                                        ${isTodayDay ? 'ring-1 ring-indigo-500/70 ring-offset-1 ring-offset-slate-900' : ''}
                                        ${!isOutside ? 'cursor-pointer hover:brightness-150 hover:scale-[1.3]' : ''}
                                    `}
                                />

                                {isHovered && data && !isOutside && (
                                    <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 bg-slate-800 border border-slate-600/50 rounded-lg px-3 py-2 whitespace-nowrap shadow-2xl shadow-black/50 pointer-events-none">
                                        <p className="text-white text-[10px] font-bold">{format(day, 'EEE, MMM d')}</p>
                                        {data.total > 0 ? (
                                            <p className={`text-[9px] mt-0.5 ${getTooltipColor(status)}`}>
                                                {data.completed}/{data.total} done • {data.rate}%
                                            </p>
                                        ) : (
                                            <p className="text-slate-500 text-[9px] mt-0.5">No routines</p>
                                        )}
                                        <div className="absolute -bottom-[4px] left-1/2 -translate-x-1/2 w-[6px] h-[6px] bg-slate-800 border-r border-b border-slate-600/50 rotate-45" />
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

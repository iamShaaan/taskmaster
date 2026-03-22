import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
    CheckSquare, Calendar, Users, FolderKanban, Timer,
    TrendingUp, Clock, ArrowRight, Flame, CircleCheck, AlertCircle, Loader2, UserPlus, Square
} from 'lucide-react';
import { auth } from '../firebase/config';
import { useTimer } from '../hooks/useTimer';
import { useAppStore } from '../store';
import { formatDuration, formatDateTime } from '../utils/timeFormat';
import { statusBadge, priorityBadge } from '../components/ui/Badge';
import { Link } from 'react-router-dom';
import { Modal } from '../components/ui/Modal';
import { ClientForm } from '../components/clients/ClientForm';
import { format, addMonths, setDate as setDateFns, isPast, isToday, differenceInDays } from 'date-fns';
import { updateDocById } from '../firebase/firestore';

// ─── Stat Card ────────────────────────────────────────────────────────────────
const StatCard = ({
    icon: Icon, label, value, sub, color, to, loading, actionIcon: ActionIcon, onAction
}: {
    icon: React.ElementType; label: string; value: number | string; sub?: string;
    color: string; to: string; loading?: boolean; actionIcon?: React.ElementType; onAction?: (e: React.MouseEvent) => void;
}) => (
    <div className="relative h-full flex flex-col">
        <Link to={to} className="flex-1 block h-full">
            <motion.div
                whileHover={{ scale: 1.02, y: -2 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                className="bg-slate-800/80 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-4 sm:p-5 hover:border-indigo-500/40 hover:shadow-[0_0_20px_rgba(99,102,241,0.1)] transition-all cursor-pointer group flex flex-col h-full justify-between"
            >
                <div className="flex items-center justify-between mb-4">
                    <div className={`p-2.5 rounded-xl ${color}`}><Icon size={18} /></div>
                    <ArrowRight size={14} className="text-slate-600 group-hover:text-indigo-400 transition-colors" />
                </div>
                {loading ? (
                    <Loader2 size={20} className="animate-spin text-slate-600 mb-1" />
                ) : (
                    <p className="text-2xl sm:text-3xl font-black text-slate-100 tracking-tight">{value}</p>
                )}
                <div className="flex items-center justify-between mt-1">
                    <p className="text-slate-400 text-xs sm:text-sm font-medium">{label}</p>
                    {sub && <p className="text-slate-600 text-xs">{sub}</p>}
                </div>
            </motion.div>
        </Link>
        {ActionIcon && onAction && (
            <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onAction(e); }}
                className={`absolute top-4 right-10 p-2 rounded-xl bg-slate-700/50 hover:bg-slate-700 text-slate-300 hover:text-white transition-all shadow-sm z-10 ${color.includes('emerald') ? 'hover:text-emerald-400' : ''}`}
                title={`Quick add ${label.toLowerCase()}`}
            >
                <ActionIcon size={16} />
            </button>
        )}
    </div>
);

// ─── Active Timer Board ───────────────────────────────────────────────────────
const ActiveTimerBoard = ({ task }: { task: import('../types').Task }) => {
    const { elapsed, stop } = useTimer(task);

    return (
        <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-indigo-600 border border-indigo-400/50 rounded-2xl p-4 sm:p-5 shadow-lg shadow-indigo-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
        >
            <div className="flex items-center gap-4">
                <div className="p-3 bg-indigo-500/50 rounded-xl relative overflow-hidden">
                    <div className="absolute inset-0 bg-white/20 animate-ping rounded-xl"></div>
                    <Timer size={24} className="text-white relative z-10" />
                </div>
                <div>
                    <h3 className="text-white font-bold text-lg leading-tight">{task.title}</h3>
                    <p className="text-indigo-200 text-sm flex items-center gap-2 mt-0.5">
                        {task.project_id && <span className="bg-indigo-500/30 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider">Project Task</span>}
                        <span className="flex items-center gap-1 font-medium"><Flame size={12} /> Actively Tracking</span>
                    </p>
                </div>
            </div>
            <div className="flex items-center gap-4 sm:gap-6 mt-2 sm:mt-0 w-full sm:w-auto justify-between sm:justify-end">
                <div className="text-right">
                    <p className="text-3xl font-black text-white tabular-nums tracking-tight">
                        {formatDuration(elapsed)}
                    </p>
                </div>
                <button
                    onClick={stop}
                    className="flex items-center justify-center p-3 rounded-xl bg-red-500/20 hover:bg-red-500/40 text-red-100 hover:text-white border border-red-500/30 transition-all group shadow-sm flex-shrink-0"
                    title="Stop Timer"
                >
                    <Square size={20} className="fill-current" />
                </button>
            </div>
        </motion.div>
    );
};

// ─── Dashboard ────────────────────────────────────────────────────────────────
export const Dashboard: React.FC = () => {
    // ✅ Read from store only — App.tsx DataLoader owns all Firestore subscriptions.
    //    No duplicate listeners here.
    const { tasks, meetings, clients, projects, emis } = useAppStore();
    const [showClientForm, setShowClientForm] = React.useState(false);

    // Loading: store starts as empty arrays; show skeleton state if nothing loaded yet
    const isLoading = tasks.length === 0 && meetings.length === 0 && clients.length === 0 && projects.length === 0;

    // ─ Memoised derived values ─────────────────────────────────────────────────
    const now = useMemo(() => new Date(), []);

    const activeTask = useMemo(
        () => tasks.find(t => t.active_timer && t.active_timer.user_id === auth.currentUser?.uid),
        [tasks]
    );

    const openTasks = useMemo(
        () => tasks.filter(t => t.status === 'open' || t.status === 'in_progress'),
        [tasks]
    );
    const doneTasks = useMemo(() => tasks.filter(t => t.status === 'done'), [tasks]);
    const overdueTasks = useMemo(
        () => tasks.filter(t => t.due_date && new Date(t.due_date) < now && t.status !== 'done'),
        [tasks, now]
    );
    const highPriorityOpen = useMemo(
        () => tasks.filter(t => t.priority === 'high' && t.status !== 'done'),
        [tasks]
    );

    const upcomingMeetings = useMemo(
        () => meetings.filter(m => m.start_time > now).sort((a, b) => +a.start_time - +b.start_time).slice(0, 5),
        [meetings, now]
    );

    const recentTasks = useMemo(() => tasks.slice(0, 6), [tasks]);

    const totalTrackedTodayMs = useMemo(() => {
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        let total = 0;
        tasks.forEach(task => {
            if (task.time_logs) {
                task.time_logs.forEach(log => {
                    const logStart = new Date(log.start).getTime();
                    if (logStart >= startOfToday) {
                        total += log.duration_ms;
                    }
                });
            }
        });
        return total;
    }, [tasks, now]);

    const activeProjects = useMemo(() => projects.filter(p => p.status === 'active'), [projects]);

    const completionRate = useMemo(() => {
        if (tasks.length === 0) return 0;
        return Math.round((doneTasks.length / tasks.length) * 100);
    }, [tasks.length, doneTasks.length]);

    const dueSubscriptions = useMemo(() => {
        const threshold = new Date(now);
        threshold.setDate(threshold.getDate() + 5);
        threshold.setHours(23, 59, 59, 999);

        return emis.filter(e => {
            const dateStr = e.next_billing_date 
                ? e.next_billing_date 
                : (e.due_day ? format(setDateFns(addMonths(new Date(), e.due_day >= now.getDate() ? 0 : 1), e.due_day), 'yyyy-MM-dd') : null);
            if (!dateStr) return false;
            
            const nextDate = new Date(dateStr);
            return nextDate <= threshold;
        }).map(e => {
            const dateStr = e.next_billing_date 
                ? e.next_billing_date 
                : (e.due_day ? format(setDateFns(addMonths(new Date(), e.due_day >= now.getDate() ? 0 : 1), e.due_day), 'yyyy-MM-dd') : '');
            return { ...e, computedNextDate: new Date(dateStr) };
        }).sort((a, b) => a.computedNextDate.getTime() - b.computedNextDate.getTime());
    }, [emis, now]);

    const handleMarkSubscriptionPaid = async (sub: any) => {
        try {
            const nextDate = new Date(sub.computedNextDate);
            let addedMonths = 1;
            if (sub.billing_cycle === '3_months') addedMonths = 3;
            else if (sub.billing_cycle === '1_year') addedMonths = 12;
            
            const newNextDate = addMonths(nextDate, addedMonths);
            
            await updateDocById('emis', sub.id, {
                next_billing_date: format(newNextDate, 'yyyy-MM-dd')
            });
        } catch (error) {
            console.error(error);
        }
    };

    return (
        <div className="space-y-6">
            {/* ── Active Task Timer Board ────────────────────────────────────── */}
            {activeTask && <ActiveTimerBoard task={activeTask} />}

            {/* ── Subscriptions Due Notification ─────────────────────────────── */}
            {dueSubscriptions.length > 0 && (
                <div className="space-y-3">
                    {dueSubscriptions.map(sub => {
                        const isLate = isPast(sub.computedNextDate) && !isToday(sub.computedNextDate);
                        const daysLeft = Math.max(0, differenceInDays(sub.computedNextDate, now));
                        
                        return (
                        <motion.div
                            key={sub.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`flex items-center gap-3 p-4 border rounded-2xl ${isLate ? 'bg-red-500/10 border-red-500/20' : 'bg-amber-500/10 border-amber-500/20'}`}
                        >
                            <AlertCircle size={18} className={`flex-shrink-0 ${isLate ? 'text-red-400' : 'text-amber-400'}`} />
                            <div className="flex-1 min-w-0">
                                <p className={`text-sm font-bold ${isLate ? 'text-red-300' : 'text-amber-300'}`}>
                                    Subscription Due: {sub.title}
                                </p>
                                <p className={`text-xs truncate ${isLate ? 'text-red-500/70' : 'text-amber-500/70'}`}>
                                    {isLate ? 'Overdue!' : daysLeft === 0 ? 'Due Today' : `Due in ${daysLeft} day${daysLeft > 1 ? 's' : ''}`} • {format(sub.computedNextDate, 'dd MMM yyyy')}
                                </p>
                            </div>
                            <button 
                                onClick={() => handleMarkSubscriptionPaid(sub)}
                                className={`text-xs font-bold flex-shrink-0 flex items-center gap-1 transition-colors px-3 py-1.5 rounded-lg ${isLate ? 'bg-red-500/20 text-red-200 hover:bg-red-500/40' : 'bg-amber-500/20 text-amber-200 hover:bg-amber-500/40'}`}
                                title="Mark as Paid"
                            >
                                <CheckSquare size={14} /> Paid
                            </button>
                        </motion.div>
                    )})}
                </div>
            )}

            {/* ── Stat Cards ───────────────────────────────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <StatCard
                    icon={CheckSquare} label="Open Tasks" to="/tasks"
                    value={openTasks.length}
                    sub={overdueTasks.length > 0 ? `${overdueTasks.length} overdue` : 'all on track'}
                    color="bg-indigo-500/20 text-indigo-400"
                    loading={isLoading}
                />
                <StatCard
                    icon={Calendar} label="Upcoming Meetings" to="/meetings"
                    value={upcomingMeetings.length}
                    sub="next 30 days"
                    color="bg-purple-500/20 text-purple-400"
                    loading={isLoading}
                />
                <StatCard
                    icon={Users} label="Clients" to="/user-data"
                    value={clients.length}
                    color="bg-emerald-500/20 text-emerald-400"
                    loading={isLoading}
                    actionIcon={UserPlus}
                    onAction={() => setShowClientForm(true)}
                />
                <StatCard
                    icon={FolderKanban} label="Active Projects" to="/projects"
                    value={activeProjects.length}
                    sub={`${projects.length} total`}
                    color="bg-amber-500/20 text-amber-400"
                    loading={isLoading}
                />
            </div>

            {/* ── Progress + Priority Bars ──────────────────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                {/* Time tracked */}
                <div className="bg-slate-800/80 border border-slate-700/50 rounded-2xl p-4 sm:p-5">
                    <div className="flex items-center gap-2 mb-1">
                        <Timer size={15} className="text-emerald-400" />
                        <span className="text-slate-400 text-[10px] sm:text-xs font-bold uppercase tracking-wider">Time Tracked Today</span>
                    </div>
                    <p className="text-xl sm:text-2xl font-black text-emerald-400 mt-2 tracking-tight">{formatDuration(totalTrackedTodayMs)}</p>
                    <p className="text-slate-600 text-xs mt-1">across all tasks today</p>
                </div>

                {/* Completion rate */}
                <div className="bg-slate-800/80 border border-slate-700/50 rounded-2xl p-4 sm:p-5">
                    <div className="flex items-center gap-2 mb-1">
                        <TrendingUp size={15} className="text-indigo-400" />
                        <span className="text-slate-400 text-[10px] sm:text-xs font-bold uppercase tracking-wider">Completion Rate</span>
                    </div>
                    <p className="text-xl sm:text-2xl font-black text-indigo-400 mt-2 tracking-tight">{completionRate}%</p>
                    <div className="mt-2 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                        <motion.div
                            className="h-full bg-indigo-500 rounded-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${completionRate}%` }}
                            transition={{ duration: 0.8, ease: 'easeOut' }}
                        />
                    </div>
                </div>

                {/* High priority alerts */}
                <div className="bg-slate-800/80 border border-slate-700/50 rounded-2xl p-4 sm:p-5">
                    <div className="flex items-center gap-2 mb-1">
                        <Flame size={15} className={highPriorityOpen.length > 0 ? 'text-red-400' : 'text-slate-500'} />
                        <span className="text-slate-400 text-[10px] sm:text-xs font-bold uppercase tracking-wider">High Priority</span>
                    </div>
                    <p className={`text-xl sm:text-2xl font-black mt-2 tracking-tight ${highPriorityOpen.length > 0 ? 'text-red-400' : 'text-slate-500'}`}>
                        {highPriorityOpen.length}
                    </p>
                    <p className="text-slate-600 text-xs mt-1">
                        {highPriorityOpen.length > 0 ? 'needs attention' : 'all clear'}
                    </p>
                </div>
            </div>

            {/* ── Main Content Grid ────────────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                {/* Recent Tasks */}
                <div className="bg-slate-800/80 border border-slate-700/50 rounded-2xl p-4 sm:p-5">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-slate-100 font-bold">Recent Tasks</h2>
                        <Link to="/tasks" className="text-indigo-400 text-xs hover:text-indigo-300 transition-colors flex items-center gap-1">
                            View all <ArrowRight size={12} />
                        </Link>
                    </div>

                    {isLoading ? (
                        <div className="space-y-3">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="h-10 bg-slate-700/40 animate-pulse rounded-lg" />
                            ))}
                        </div>
                    ) : recentTasks.length === 0 ? (
                        <div className="text-center py-10">
                            <CircleCheck size={32} className="text-slate-700 mx-auto mb-2" />
                            <p className="text-slate-500 text-sm">No tasks yet</p>
                            <Link to="/tasks" className="text-indigo-400 text-xs hover:text-indigo-300 mt-1 inline-block">
                                Create your first task →
                            </Link>
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {recentTasks.map((task) => (
                                <Link to="/tasks" key={task.id}>
                                    <div className="flex items-center justify-between py-2.5 px-3 rounded-xl hover:bg-slate-700/40 transition-all group">
                                        <div className="min-w-0 flex-1 flex items-center gap-3">
                                            <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${task.status === 'done' ? 'bg-emerald-400' :
                                                task.status === 'in_progress' ? 'bg-indigo-400' :
                                                    task.priority === 'high' ? 'bg-red-400' : 'bg-slate-500'
                                                }`} />
                                            <div className="min-w-0">
                                                <p className={`text-sm truncate font-medium ${task.status === 'done' ? 'text-slate-500 line-through' : 'text-slate-200'}`}>
                                                    {task.title}
                                                </p>
                                                {task.due_date && (
                                                    <p className={`text-xs truncate ${new Date(task.due_date) < now && task.status !== 'done' ? 'text-red-400' : 'text-slate-500'}`}>
                                                        {formatDateTime(task.due_date)}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="ml-3 flex items-center gap-2 flex-shrink-0">
                                            {priorityBadge(task.priority)}
                                            {statusBadge(task.status)}
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>

                {/* Upcoming Meetings */}
                <div className="bg-slate-800/80 border border-slate-700/50 rounded-2xl p-4 sm:p-5">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-slate-100 font-bold">Upcoming Meetings</h2>
                        <Link to="/meetings" className="text-indigo-400 text-xs hover:text-indigo-300 transition-colors flex items-center gap-1">
                            View all <ArrowRight size={12} />
                        </Link>
                    </div>

                    {isLoading ? (
                        <div className="space-y-3">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="h-14 bg-slate-700/40 animate-pulse rounded-lg" />
                            ))}
                        </div>
                    ) : upcomingMeetings.length === 0 ? (
                        <div className="text-center py-10">
                            <Calendar size={32} className="text-slate-700 mx-auto mb-2" />
                            <p className="text-slate-500 text-sm">No upcoming meetings</p>
                            <Link to="/meetings" className="text-indigo-400 text-xs hover:text-indigo-300 mt-1 inline-block">
                                Schedule one →
                            </Link>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {upcomingMeetings.map((m) => {
                                const isToday = new Date(m.start_time).toDateString() === now.toDateString();
                                return (
                                    <Link to="/meetings" key={m.id}>
                                        <div className="flex items-start gap-3 py-2.5 px-3 rounded-xl hover:bg-slate-700/40 transition-all">
                                            <div className={`p-2 rounded-xl flex-shrink-0 ${isToday ? 'bg-purple-500/30 border border-purple-500/30' : 'bg-purple-500/10'}`}>
                                                <Clock size={13} className="text-purple-400" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2">
                                                    <p className="text-slate-200 text-sm font-medium truncate">{m.title}</p>
                                                    {isToday && (
                                                        <span className="text-[9px] font-black uppercase tracking-wider text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded-full border border-purple-500/20 flex-shrink-0">
                                                            TODAY
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-slate-500 text-xs mt-0.5">{formatDateTime(m.start_time)}</p>
                                                {m.participants?.length > 0 && (
                                                    <p className="text-slate-600 text-xs truncate mt-0.5">
                                                        {m.participants.slice(0, 3).join(', ')}{m.participants.length > 3 ? ` +${m.participants.length - 3}` : ''}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* ── Overdue Alert strip (only shows if there are overdue tasks) ── */}
            {overdueTasks.length > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-3 p-4 bg-red-500/5 border border-red-500/20 rounded-2xl"
                >
                    <AlertCircle size={18} className="text-red-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                        <p className="text-red-300 text-sm font-bold">
                            {overdueTasks.length} overdue task{overdueTasks.length > 1 ? 's' : ''}
                        </p>
                        <p className="text-red-500/70 text-xs truncate">
                            {overdueTasks.slice(0, 3).map(t => t.title).join(' · ')}
                            {overdueTasks.length > 3 ? ` and ${overdueTasks.length - 3} more` : ''}
                        </p>
                    </div>
                    <Link to="/tasks" className="text-red-400 hover:text-red-300 text-xs font-bold flex-shrink-0 flex items-center gap-1 transition-colors">
                        Review <ArrowRight size={12} />
                    </Link>
                </motion.div>
            )}

            <Modal isOpen={showClientForm} onClose={() => setShowClientForm(false)} title="Add Client" size="lg">
                <ClientForm onClose={() => setShowClientForm(false)} />
            </Modal>
        </div>
    );
};

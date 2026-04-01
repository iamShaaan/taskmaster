import React, { useState } from 'react';
import { Plus, Calendar, Clock, Users, Link2, Pencil, Trash2, CheckCircle2, XCircle, StopCircle } from 'lucide-react';
import { useAppStore } from '../store';
import { MeetingForm } from '../components/meetings/MeetingForm';
import { Modal } from '../components/ui/Modal';
import type { Meeting } from '../types';
import { deleteDocById, updateDocById } from '../firebase/firestore';
import { formatDateTime, formatTime } from '../utils/timeFormat';
import toast from 'react-hot-toast';

// ─── Outcome config ────────────────────────────────────────────────────────────
type Outcome = Meeting['outcome'];

const OUTCOMES: { value: Outcome; label: string; icon: React.ElementType; active: string; ring: string }[] = [
    {
        value: 'ended',
        label: 'Ended',
        icon: StopCircle,
        active: 'bg-slate-600 text-slate-200 border-slate-500',
        ring: 'border-slate-600/40',
    },
    {
        value: 'success',
        label: 'Success',
        icon: CheckCircle2,
        active: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
        ring: 'border-emerald-500/30',
    },
    {
        value: 'failed',
        label: 'Failed',
        icon: XCircle,
        active: 'bg-red-500/20 text-red-300 border-red-500/40',
        ring: 'border-red-500/30',
    },
];

// ─── Outcome Badge (read-only, used in header) ─────────────────────────────────
const OutcomeBadge = ({ outcome }: { outcome: Outcome }) => {
    if (!outcome) return null;
    const cfg = OUTCOMES.find(o => o.value === outcome)!;
    const Icon = cfg.icon;
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${cfg.active}`}>
            <Icon size={10} />
            {cfg.label}
        </span>
    );
};

// ─── Status Bar (interactive chips) ───────────────────────────────────────────
const OutcomeBar = ({ meeting }: { meeting: Meeting }) => {
    const [saving, setSaving] = useState<Outcome | null>(null);

    const setOutcome = async (value: Outcome) => {
        if (saving) return;
        // Toggle off if already set
        const newVal = meeting.outcome === value ? undefined : value;
        setSaving(value);
        try {
            await updateDocById('meetings', meeting.id, { outcome: newVal ?? null });
            toast.success(newVal ? `Marked as ${newVal}` : 'Outcome cleared');
        } catch {
            toast.error('Failed to update outcome');
        } finally {
            setSaving(null);
        }
    };

    return (
        <div className="mt-3 pt-3 border-t border-slate-700/40">
            <p className="text-slate-600 text-[10px] font-bold uppercase tracking-wider mb-2">Meeting Outcome</p>
            <div className="flex gap-2">
                {OUTCOMES.map(({ value, label, icon: Icon, active, ring }) => {
                    const isActive = meeting.outcome === value;
                    const isLoading = saving === value;
                    return (
                        <button
                            key={value}
                            onClick={() => setOutcome(value)}
                            disabled={!!saving}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all active:scale-95 disabled:opacity-60 ${isActive
                                    ? active
                                    : `bg-slate-900/50 text-slate-500 border-slate-700/50 hover:${ring} hover:text-slate-300`
                                }`}
                        >
                            {isLoading ? (
                                <span className="w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
                            ) : (
                                <Icon size={12} />
                            )}
                            {label}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

// ─── Meeting Card ──────────────────────────────────────────────────────────────
const MeetingCard = ({
    meeting,
    now,
    onEdit,
    onDelete,
}: {
    meeting: Meeting;
    now: Date;
    onEdit: (m: Meeting) => void;
    onDelete: (id: string) => void;
}) => {
    const isUpcoming = meeting.start_time > now;
    const durationMs = meeting.end_time.getTime() - meeting.start_time.getTime();
    const durationMin = Math.round(durationMs / 60000);

    // Border colour driven by outcome for past meetings
    const borderCls = isUpcoming
        ? 'border-slate-700/50'
        : meeting.outcome === 'success'
            ? 'border-emerald-500/25'
            : meeting.outcome === 'failed'
                ? 'border-red-500/25'
                : 'border-slate-800';

    return (
        <div className={`group bg-slate-800 border rounded-xl p-4 hover:border-indigo-500/30 transition-all ${borderCls} ${!isUpcoming ? 'opacity-80 hover:opacity-100' : ''}`}>
            {/* Header row */}
            <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg flex-shrink-0 mt-0.5 ${isUpcoming ? 'bg-purple-500/15' :
                            meeting.outcome === 'success' ? 'bg-emerald-500/10' :
                                meeting.outcome === 'failed' ? 'bg-red-500/10' :
                                    'bg-slate-700/50'
                        }`}>
                        <Calendar size={15} className={
                            isUpcoming ? 'text-purple-400' :
                                meeting.outcome === 'success' ? 'text-emerald-400' :
                                    meeting.outcome === 'failed' ? 'text-red-400' :
                                        'text-slate-500'
                        } />
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-slate-100 font-semibold text-sm">{meeting.title}</h3>
                            {isUpcoming && (
                                <span className="text-[9px] font-black uppercase tracking-wider text-purple-400 bg-purple-500/10 border border-purple-500/20 px-1.5 py-0.5 rounded-full">
                                    UPCOMING
                                </span>
                            )}
                            {!isUpcoming && <OutcomeBadge outcome={meeting.outcome} />}
                        </div>
                        {meeting.description && (
                            <p className="text-slate-500 text-xs mt-0.5 line-clamp-1">{meeting.description}</p>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <button onClick={() => onEdit(meeting)} className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-400 hover:bg-indigo-500/10 transition-all">
                        <Pencil size={13} />
                    </button>
                    <button onClick={() => onDelete(meeting.id)} className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all">
                        <Trash2 size={13} />
                    </button>
                </div>
            </div>

            {/* Meta row */}
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <Clock size={11} />
                    <span>{formatTime(meeting.start_time)} – {formatTime(meeting.end_time)} ({durationMin}min)</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Calendar size={11} />
                    <span>{formatDateTime(meeting.start_time)}</span>
                </div>
                {meeting.location && (
                    <div className="flex items-center gap-1.5 text-xs">
                        <Link2 size={11} className="text-indigo-400 flex-shrink-0" />
                        <a
                            href={meeting.location.startsWith('http') ? meeting.location : `https://${meeting.location}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2 truncate transition-colors"
                        >
                            Meeting Link
                        </a>
                    </div>
                )}
                {meeting.participants?.length > 0 && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <Users size={11} />
                        <span>
                            {meeting.participants.slice(0, 2).join(', ')}
                            {meeting.participants.length > 2 ? ` +${meeting.participants.length - 2}` : ''}
                        </span>
                    </div>
                )}
            </div>

            {/* Status bar — only for past meetings */}
            {!isUpcoming && <OutcomeBar meeting={meeting} />}
        </div>
    );
};

// ─── Page ──────────────────────────────────────────────────────────────────────
export const Meetings: React.FC = () => {
    const { meetings } = useAppStore();
    const [showForm, setShowForm] = useState(false);
    const [editMeeting, setEditMeeting] = useState<Meeting | undefined>();
    const now = new Date();

    const upcoming = meetings
        .filter(m => m.start_time > now)
        .sort((a, b) => a.start_time.getTime() - b.start_time.getTime());

    const past = meetings
        .filter(m => m.start_time <= now)
        .sort((a, b) => b.start_time.getTime() - a.start_time.getTime());

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this meeting? It can be restored from Archive within 30 days.')) return;
        await deleteDocById('meetings', id);
        toast.success('Meeting moved to Archive');
    };

    const openEdit = (m: Meeting) => { setEditMeeting(m); setShowForm(true); };
    const closeForm = () => { setEditMeeting(undefined); setShowForm(false); };

    // Quick summary counts for the header bar
    const successCount = past.filter(m => m.outcome === 'success').length;
    const failedCount = past.filter(m => m.outcome === 'failed').length;
    const pendingCount = past.filter(m => !m.outcome).length;

    return (
        <div className="space-y-6">
            {/* Toolbar */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3 flex-wrap">
                    <p className="text-slate-400 text-sm">
                        <span className="text-slate-200 font-bold">{upcoming.length}</span> upcoming
                    </p>
                    {past.length > 0 && (
                        <div className="flex items-center gap-2">
                            {successCount > 0 && (
                                <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                                    <CheckCircle2 size={10} /> {successCount} success
                                </span>
                            )}
                            {failedCount > 0 && (
                                <span className="flex items-center gap-1 text-[11px] font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-full">
                                    <XCircle size={10} /> {failedCount} failed
                                </span>
                            )}
                            {pendingCount > 0 && (
                                <span className="flex items-center gap-1 text-[11px] font-bold text-slate-500 bg-slate-800 border border-slate-700 px-2 py-0.5 rounded-full">
                                    <StopCircle size={10} /> {pendingCount} no outcome
                                </span>
                            )}
                        </div>
                    )}
                </div>
                <button
                    onClick={() => setShowForm(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-bold rounded-xl transition-all"
                >
                    <Plus size={16} /> Schedule Meeting
                </button>
            </div>

            {/* Upcoming */}
            {upcoming.length > 0 && (
                <div>
                    <h2 className="text-slate-300 text-xs font-black uppercase tracking-widest mb-3 flex items-center gap-2">
                        <Clock size={12} className="text-purple-400" /> Upcoming
                    </h2>
                    <div className="space-y-3">
                        {upcoming.map(m => <MeetingCard key={m.id} meeting={m} now={now} onEdit={openEdit} onDelete={handleDelete} />)}
                    </div>
                </div>
            )}

            {/* Past */}
            {past.length > 0 && (
                <div>
                    <h2 className="text-slate-500 text-xs font-black uppercase tracking-widest mb-3">Past Meetings</h2>
                    <div className="space-y-3">
                        {past.slice(0, 10).map(m => <MeetingCard key={m.id} meeting={m} now={now} onEdit={openEdit} onDelete={handleDelete} />)}
                    </div>
                </div>
            )}

            {/* Empty */}
            {meetings.length === 0 && (
                <div className="text-center py-20">
                    <Calendar size={48} className="text-slate-700 mx-auto mb-3" />
                    <p className="text-slate-400">No meetings scheduled yet</p>
                    <button onClick={() => setShowForm(true)} className="mt-3 text-indigo-400 text-sm hover:text-indigo-300">
                        Schedule your first meeting →
                    </button>
                </div>
            )}

            <Modal isOpen={showForm} onClose={closeForm} title={editMeeting ? 'Edit Meeting' : 'Schedule Meeting'} size="lg">
                <MeetingForm onClose={closeForm} editMeeting={editMeeting} />
            </Modal>
        </div>
    );
};

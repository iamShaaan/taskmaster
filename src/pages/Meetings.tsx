import React, { useState } from 'react';
import { Plus, Calendar, Clock, Users, MapPin, Pencil, Trash2 } from 'lucide-react';
import { useAppStore } from '../store';
import { MeetingForm } from '../components/meetings/MeetingForm';
import { Modal } from '../components/ui/Modal';
import type { Meeting } from '../types';
import { deleteDocById } from '../firebase/firestore';
import { formatDateTime, formatTime } from '../utils/timeFormat';
import toast from 'react-hot-toast';

export const Meetings: React.FC = () => {
    const { meetings } = useAppStore();
    const [showForm, setShowForm] = useState(false);
    const [editMeeting, setEditMeeting] = useState<Meeting | undefined>();
    const now = new Date();

    const upcoming = meetings.filter((m) => m.start_time > now).sort((a, b) => a.start_time.getTime() - b.start_time.getTime());
    const past = meetings.filter((m) => m.start_time <= now).sort((a, b) => b.start_time.getTime() - a.start_time.getTime());

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this meeting?')) return;
        await deleteDocById('meetings', id);
        toast.success('Meeting deleted');
    };

    const MeetingCard = ({ meeting }: { meeting: Meeting }) => {
        const isUpcoming = meeting.start_time > now;
        const durationMs = meeting.end_time.getTime() - meeting.start_time.getTime();
        const durationMin = Math.round(durationMs / 60000);

        return (
            <div className={`group bg-slate-800 border rounded-xl p-4 hover:border-indigo-500/40 transition-all ${isUpcoming ? 'border-slate-700/50' : 'border-slate-800 opacity-70'}`}>
                <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg flex-shrink-0 ${isUpcoming ? 'bg-purple-500/15' : 'bg-slate-700/50'}`}>
                            <Calendar size={16} className={isUpcoming ? 'text-purple-400' : 'text-slate-500'} />
                        </div>
                        <div>
                            <h3 className="text-slate-100 font-medium text-sm">{meeting.title}</h3>
                            {meeting.description && <p className="text-slate-500 text-xs mt-0.5 line-clamp-1">{meeting.description}</p>}
                        </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => { setEditMeeting(meeting); setShowForm(true); }} className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-400 hover:bg-indigo-500/10 transition-all"><Pencil size={13} /></button>
                        <button onClick={() => handleDelete(meeting.id)} className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all"><Trash2 size={13} /></button>
                    </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-3">
                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                        <Clock size={12} />
                        <span>{formatTime(meeting.start_time)} – {formatTime(meeting.end_time)} ({durationMin}min)</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <Calendar size={12} />
                        <span>{formatDateTime(meeting.start_time)}</span>
                    </div>
                    {meeting.location && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                            <MapPin size={12} />
                            <span>{meeting.location}</span>
                        </div>
                    )}
                    {meeting.participants?.length > 0 && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                            <Users size={12} />
                            <span>{meeting.participants.slice(0, 2).join(', ')}{meeting.participants.length > 2 ? ` +${meeting.participants.length - 2}` : ''}</span>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <p className="text-slate-400 text-sm">{upcoming.length} upcoming</p>
                <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium rounded-lg transition-all">
                    <Plus size={16} /> Schedule Meeting
                </button>
            </div>

            {upcoming.length > 0 && (
                <div>
                    <h2 className="text-slate-300 text-sm font-semibold mb-3 flex items-center gap-2"><Clock size={14} className="text-purple-400" /> Upcoming</h2>
                    <div className="space-y-3">{upcoming.map((m) => <MeetingCard key={m.id} meeting={m} />)}</div>
                </div>
            )}

            {past.length > 0 && (
                <div>
                    <h2 className="text-slate-500 text-sm font-semibold mb-3">Past Meetings</h2>
                    <div className="space-y-3">{past.slice(0, 10).map((m) => <MeetingCard key={m.id} meeting={m} />)}</div>
                </div>
            )}

            {meetings.length === 0 && (
                <div className="text-center py-20">
                    <Calendar size={48} className="text-slate-700 mx-auto mb-3" />
                    <p className="text-slate-400">No meetings scheduled yet</p>
                    <button onClick={() => setShowForm(true)} className="mt-3 text-indigo-400 text-sm hover:text-indigo-300">Schedule your first meeting →</button>
                </div>
            )}

            <Modal isOpen={showForm} onClose={() => { setEditMeeting(undefined); setShowForm(false); }} title={editMeeting ? 'Edit Meeting' : 'Schedule Meeting'} size="lg">
                <MeetingForm onClose={() => { setEditMeeting(undefined); setShowForm(false); }} editMeeting={editMeeting} />
            </Modal>
        </div>
    );
};

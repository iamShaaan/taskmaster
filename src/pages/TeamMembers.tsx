import React, { useState } from 'react';
import { db, APP_ID } from '../firebase/config';
import { doc, setDoc } from 'firebase/firestore';
import { searchByUserCode } from '../firebase/firestore';
import { Users, Mail, X } from 'lucide-react';
import toast from 'react-hot-toast';
import type { UserProfile } from '../types';

interface TeamMembersProps {
    profile: Partial<UserProfile>;
    setProfile: React.Dispatch<React.SetStateAction<Partial<UserProfile>>>;
}

export const TeamMembers: React.FC<TeamMembersProps> = ({ profile, setProfile }) => {
    const [newMemberCode, setNewMemberCode] = useState('');
    const [saving, setSaving] = useState(false);

    const addTeamMember = async () => {
        if (!newMemberCode.trim()) return;
        const codeToFind = newMemberCode.trim().toUpperCase();

        if (codeToFind === profile.user_code) {
            toast.error("You cannot add yourself.");
            return;
        }

        if (profile.teamMembers?.some(m => m.user_code === codeToFind)) {
            toast.error('Member already added');
            return;
        }

        toast.loading("Searching for user...", { id: "search-user" });
        setSaving(true);
        try {
            const users = await searchByUserCode(codeToFind);
            if (users.length === 0) {
                toast.error("No user found with that code.", { id: "search-user" });
                return;
            }
            const foundUser = users[0];

            const newMembers = [...(profile.teamMembers || []), {
                uid: foundUser.uid || foundUser.id,
                user_code: foundUser.user_code || '',
                name: foundUser.displayName || foundUser.fullName || '',
                email: foundUser.professionalEmail || foundUser.personalEmail || ''
            }];

            if (profile.uid) {
                await setDoc(doc(db, `apps/${APP_ID}/users`, profile.uid), {
                    teamMembers: newMembers
                }, { merge: true });
            }

            setProfile(p => ({ ...p, teamMembers: newMembers }));
            setNewMemberCode('');
            toast.success("Team member added!", { id: "search-user" });
        } catch (e) {
            toast.error("Failed to add user.", { id: "search-user" });
            console.error(e);
        } finally {
            setSaving(false);
        }
    };

    const removeTeamMember = async (identifier: string) => {
        const newMembers = profile.teamMembers?.filter(m => (m.user_code !== identifier && m.email !== identifier)) || [];

        if (profile.uid) {
            try {
                await setDoc(doc(db, `apps/${APP_ID}/users`, profile.uid), {
                    teamMembers: newMembers
                }, { merge: true });
            } catch (e) {
                console.error(e);
                toast.error("Failed to remove member");
                return;
            }
        }

        setProfile(p => ({ ...p, teamMembers: newMembers }));
    };

    return (
        <div className="bg-slate-900/50 border border-white/10 rounded-[2.5rem] p-8 sm:p-10 space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-white text-xl font-black flex items-center gap-3">
                        <div className="p-2.5 bg-emerald-500/20 rounded-xl"><Users size={20} className="text-emerald-400" /></div>
                        Team Directory
                    </h2>
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-2">Manage team access to projects</p>
                </div>
            </div>

            <div className="space-y-6">
                <div className="flex gap-3">
                    <div className="relative flex-1">
                        <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" />
                        <input
                            className="w-full bg-slate-950 border border-white/5 rounded-2xl px-5 py-4 pl-12 text-white outline-none focus:border-emerald-500/50 transition-all font-bold"
                            placeholder="Add member by their User Code (e.g. TM-A3X9P2)..."
                            value={newMemberCode}
                            onChange={(e) => setNewMemberCode(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTeamMember(); } }}
                        />
                    </div>
                    <button
                        onClick={addTeamMember}
                        disabled={saving}
                        className="bg-emerald-500 hover:bg-emerald-600 text-white px-8 rounded-2xl font-black transition-all shadow-lg shadow-emerald-500/20 active:scale-95 disabled:opacity-50"
                    >
                        Invite
                    </button>
                </div>

                <div className="space-y-3 mt-8">
                    {(!profile.teamMembers || profile.teamMembers.length === 0) ? (
                        <div className="flex flex-col items-center justify-center opacity-30 text-center py-12 border-2 border-dashed border-slate-800 rounded-3xl">
                            <Users size={32} className="mb-2 text-slate-500" />
                            <p className="text-xs font-medium text-slate-400">No team members added yet.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {profile.teamMembers.map((member, idx) => (
                                <div key={idx} className="flex items-center justify-between bg-slate-950 p-4 rounded-2xl border border-white/5 group hover:border-emerald-500/30 transition-all">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 font-black border border-emerald-500/20">
                                            {member.email?.charAt(0).toUpperCase() || '?'}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-white text-sm font-bold truncate max-w-[150px]">{member.name || member.email || member.user_code}</p>
                                            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">{member.user_code ? `Code: ${member.user_code}` : 'Active Member'}</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => removeTeamMember(member.email || member.user_code || '')}
                                        className="p-2 bg-slate-900 border border-white/5 rounded-xl text-slate-600 hover:text-red-400 hover:border-red-500/30 transition-all"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

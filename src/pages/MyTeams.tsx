import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db, APP_ID, auth } from '../firebase/config';
import { Users, Shield, Crown, Eye, Hash, Mail, Loader2 } from 'lucide-react';
import type { Project } from '../types';

interface TeamInfo {
    projectId: string;
    projectName: string;
    myRole: string;
    adminName: string;
    adminEmail: string;
    adminCode: string;
    memberCount: number;
}

export const MyTeams: React.FC = () => {
    const [teams, setTeams] = useState<TeamInfo[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchTeams = async () => {
            if (!auth.currentUser) return;
            const uid = auth.currentUser.uid;

            try {
                // Get projects where user is a member
                const q = query(
                    collection(db, `apps/${APP_ID}/projects`),
                    where('member_uids', 'array-contains', uid)
                );
                const snap = await getDocs(q);
                const teamInfos: TeamInfo[] = [];

                for (const docSnap of snap.docs) {
                    const proj = { id: docSnap.id, ...docSnap.data() } as Project;

                    // Determine user's role
                    let myRole = 'viewer';
                    if (proj.admin_uids?.includes(uid)) myRole = 'admin';
                    else if (proj.moderator_uids?.includes(uid)) myRole = 'moderator';

                    // Fetch admin/owner profile
                    let adminName = 'Unknown';
                    let adminEmail = '';
                    let adminCode = '';
                    try {
                        const ownerSnap = await getDoc(doc(db, `apps/${APP_ID}/users`, proj.owner_id));
                        if (ownerSnap.exists()) {
                            const ownerData = ownerSnap.data();
                            adminName = ownerData.displayName || ownerData.personalEmail || 'Unknown';
                            adminEmail = ownerData.personalEmail || '';
                            adminCode = ownerData.user_code || '';
                        }
                    } catch { /* silent */ }

                    teamInfos.push({
                        projectId: proj.id,
                        projectName: proj.name,
                        myRole,
                        adminName,
                        adminEmail,
                        adminCode,
                        memberCount: (proj.member_uids?.length || 0) + 1, // +1 for owner
                    });
                }

                setTeams(teamInfos);
            } catch (e) {
                console.error('Failed to fetch teams:', e);
            } finally {
                setLoading(false);
            }
        };

        fetchTeams();
    }, []);

    const ROLE_ICONS = {
        admin: { icon: Crown, color: 'text-amber-400 bg-amber-500/20 border-amber-500/30' },
        moderator: { icon: Shield, color: 'text-indigo-400 bg-indigo-500/20 border-indigo-500/30' },
        viewer: { icon: Eye, color: 'text-slate-400 bg-slate-700/50 border-slate-600/30' },
    };

    if (loading) {
        return (
            <div className="bg-slate-900/50 border border-white/10 rounded-[2.5rem] p-8 sm:p-10 flex items-center justify-center py-20">
                <Loader2 size={24} className="animate-spin text-indigo-400" />
            </div>
        );
    }

    return (
        <div className="bg-slate-900/50 border border-white/10 rounded-[2.5rem] p-8 sm:p-10 space-y-8">
            <div>
                <h2 className="text-white text-xl font-black flex items-center gap-3">
                    <div className="p-2.5 bg-indigo-500/20 rounded-xl"><Users size={20} className="text-indigo-400" /></div>
                    My Teams
                </h2>
                <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-2">
                    Projects & teams you&apos;re a member of · {teams.length} {teams.length === 1 ? 'team' : 'teams'}
                </p>
            </div>

            {teams.length === 0 ? (
                <div className="flex flex-col items-center justify-center opacity-30 text-center py-12 border-2 border-dashed border-slate-800 rounded-3xl">
                    <Users size={32} className="mb-2 text-slate-500" />
                    <p className="text-xs font-medium text-slate-400">You haven&apos;t been added to any teams yet.</p>
                    <p className="text-[10px] text-slate-600 mt-1">When someone adds you to a project, it will appear here</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {teams.map((team) => {
                        const roleConfig = ROLE_ICONS[team.myRole as keyof typeof ROLE_ICONS] || ROLE_ICONS.viewer;
                        const RoleIcon = roleConfig.icon;
                        return (
                            <div
                                key={team.projectId}
                                className="bg-slate-950 border border-white/5 rounded-2xl p-5 space-y-4 hover:border-indigo-500/30 transition-all group"
                            >
                                {/* Project Header */}
                                <div className="flex items-start justify-between">
                                    <div className="min-w-0">
                                        <h3 className="text-white font-bold text-sm truncate max-w-[200px] group-hover:text-indigo-300 transition-colors">
                                            {team.projectName}
                                        </h3>
                                        <p className="text-slate-600 text-[10px] mt-0.5">{team.memberCount} members</p>
                                    </div>
                                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border flex items-center gap-1 ${roleConfig.color}`}>
                                        <RoleIcon size={10} />
                                        {team.myRole.charAt(0).toUpperCase() + team.myRole.slice(1)}
                                    </span>
                                </div>

                                {/* Admin Info */}
                                <div className="bg-slate-900/60 rounded-xl p-3 space-y-2 border border-white/5">
                                    <p className="text-slate-600 text-[9px] font-bold uppercase tracking-widest">Team Admin</p>
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400 font-black border border-amber-500/20 text-xs">
                                            {team.adminName.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-white text-xs font-bold truncate">{team.adminName}</p>
                                            <div className="flex items-center gap-2 flex-wrap">
                                                {team.adminEmail && (
                                                    <span className="text-slate-500 text-[10px] flex items-center gap-1 truncate max-w-[120px]">
                                                        <Mail size={8} /> {team.adminEmail}
                                                    </span>
                                                )}
                                                {team.adminCode && (
                                                    <span className="text-slate-500 text-[10px] flex items-center gap-1 font-mono">
                                                        <Hash size={8} /> {team.adminCode}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

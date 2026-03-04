import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { Users, FileText, HardDrive, Archive } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../hooks/useAuth';
import { db, APP_ID } from '../../firebase/config';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { useAppStore } from '../../store';
import { DashboardView, EditView } from '../../pages/Profile'; // we'll modify Profile to export these
import type { UserProfile } from '../../types';
import toast from 'react-hot-toast';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../../firebase/config';

const navItems = [
    { to: '/user-data', icon: Users, label: 'Clients', end: true },
    { to: '/user-data/team', icon: Users, label: 'Team Members' },
    { to: '/user-data/notes', icon: FileText, label: 'Notes & Vault' },
    { to: '/user-data/files', icon: HardDrive, label: 'Files' },
    { to: '/user-data/archive', icon: Archive, label: 'Archive' },
];

export const UserDataLayout: React.FC = () => {
    const { user } = useAuth();
    const { tasks, projects, meetings } = useAppStore();
    const location = useLocation();

    // Profile State
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [profile, setProfile] = useState<Partial<UserProfile>>({});
    const [newPortfolioUrl, setNewPortfolioUrl] = useState('');

    const [stats, setStats] = useState({
        score: 0,
        timeDelivered: 0,
        completionRate: 0,
        activeProjects: 0
    });

    useEffect(() => {
        if (user) {
            fetchProfile();
            calculateProductivity();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, tasks, projects, meetings]);

    const fetchProfile = async () => {
        try {
            const docRef = doc(db, `apps/${APP_ID}/users`, user!.uid);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data() as UserProfile;
                if (!data.user_code) {
                    const user_code = `TM-${user!.uid.substring(0, 6).toUpperCase()}`;
                    await setDoc(docRef, { user_code }, { merge: true });
                    data.user_code = user_code;
                }
                setProfile(data);
            } else {
                const user_code = `TM-${user!.uid.substring(0, 6).toUpperCase()}`;
                setProfile({
                    uid: user!.uid,
                    user_code,
                    displayName: user!.displayName || '',
                    personalEmail: user!.email || '',
                    teamMembers: []
                });
            }
        } catch {
            toast.error('Failed to load profile');
        } finally {
            setLoading(false);
        }
    };

    const calculateProductivity = () => {
        const totalTasks = tasks.length;
        const doneTasks = tasks.filter(t => t.status === 'done').length;
        const compRate = totalTasks > 0 ? (doneTasks / totalTasks) * 100 : 0;
        const totalTimeMs = tasks.reduce((acc, t) => acc + (t.total_time_ms || 0), 0);
        const hours = totalTimeMs / (1000 * 60 * 60);
        const activePrj = projects.filter(p => p.status === 'active').length;

        const timeScore = Math.min((hours / 8) * 40, 40);
        const completionScore = (compRate / 100) * 30;
        const projectScore = Math.min((activePrj / 5) * 20, 20);
        const meetingScore = Math.min((meetings.length / 3) * 10, 10);

        const totalScore = Math.round(timeScore + completionScore + projectScore + meetingScore);

        setStats({
            score: totalScore,
            timeDelivered: Math.round(hours * 10) / 10,
            completionRate: Math.round(compRate),
            activeProjects: activePrj
        });
    };

    const handleSave = async () => {
        if (!user) return;
        setSaving(true);
        try {
            // Save to Firestore
            await setDoc(doc(db, `apps/${APP_ID}/users`, user.uid), {
                ...profile,
                productivityScore: stats.score,
                lastCalculated: serverTimestamp(),
                updated_at: serverTimestamp()
            }, { merge: true });

            // Sync displayName & photoURL to Firebase Auth so it persists across redeploys
            await updateProfile(user, {
                displayName: profile.displayName || user.displayName || null,
                photoURL: profile.photoURL || user.photoURL || null,
            });

            toast.success('Profile updated successfully');
            setIsEditing(false);
        } catch {
            toast.error('Failed to save profile');
        } finally {
            setSaving(false);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'photo' | 'signature') => {
        const file = e.target.files?.[0];
        if (!file || !user) return;

        const path = `apps/${APP_ID}/profiles/${user.uid}/${type === 'photo' ? 'avatar' : 'signature'}_${Date.now()}`;
        const storageRef = ref(storage, path);

        try {
            toast.loading(`Uploading ${type}...`, { id: 'upload' });
            await uploadBytes(storageRef, file);
            const url = await getDownloadURL(storageRef);

            if (type === 'photo') setProfile(p => ({ ...p, photoURL: url }));
            else setProfile(p => ({ ...p, signatureURL: url }));

            toast.success(`${type === 'photo' ? 'Photo' : 'Signature'} uploaded!`, { id: 'upload' });
        } catch {
            toast.error(`Failed to upload ${type}`, { id: 'upload' });
        }
    };

    const addPortfolio = () => {
        if (!newPortfolioUrl.trim()) return;
        const url = newPortfolioUrl.trim();
        if ((profile.websites || []).includes(url)) {
            toast.error('Link already added');
            return;
        }
        setProfile(p => ({ ...p, websites: [...(p.websites || []), url] }));
        setNewPortfolioUrl('');
    };

    const removePortfolio = (url: string) => {
        setProfile(p => ({ ...p, websites: (p.websites || []).filter(w => w !== url) }));
    };

    if (loading) return (
        <div className="flex h-screen items-center justify-center">
            <div className="animate-spin rounded-full border-t-2 border-b-2 border-indigo-500 h-10 w-10"></div>
        </div>
    );

    return (
        <div className="max-w-7xl mx-auto space-y-12 pb-16">
            {/* Top Section: User Profile */}
            <div className="mb-12">
                {isEditing ? (
                    <EditView
                        profile={profile}
                        setProfile={setProfile}
                        newPortfolioUrl={newPortfolioUrl}
                        setNewPortfolioUrl={setNewPortfolioUrl}
                        saving={saving}
                        onSave={handleSave}
                        onDiscard={() => setIsEditing(false)}
                        onFileUpload={handleFileUpload}
                        onAddPortfolio={addPortfolio}
                        onRemovePortfolio={removePortfolio}
                    />
                ) : (
                    <DashboardView
                        profile={profile}
                        stats={stats}
                        onEdit={() => setIsEditing(true)}
                    />
                )}
            </div>

            {/* Bottom Section: User Data Tabs & Content */}
            <div className="space-y-6">
                {/* Decorative Separator */}
                <div className="flex items-center gap-4 py-4">
                    <div className="h-px bg-white/5 flex-1" />
                    <span className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">Workspace Data</span>
                    <div className="h-px bg-white/5 flex-1" />
                </div>

                {/* Horizontal Navigation */}
                <div className="flex overflow-x-auto pb-4 gap-2 scrollbar-hide shrink-0 snap-x">
                    {navItems.map(({ to, icon: Icon, label, end }) => (
                        <NavLink
                            key={to}
                            to={to}
                            end={end}
                            className={({ isActive }) =>
                                `flex items-center gap-2 px-5 py-3 rounded-2xl whitespace-nowrap transition-all duration-300 flex-shrink-0 border font-bold text-sm shadow-sm snap-center group
                                ${isActive
                                    ? 'bg-gradient-to-r from-indigo-500/20 to-indigo-600/20 text-indigo-300 border-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.2)]'
                                    : 'bg-slate-900/50 border-white/5 text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 hover:border-white/10'
                                }`
                            }
                        >
                            {({ isActive }) => (
                                <>
                                    <Icon size={16} className={`transition-colors duration-300 ${isActive ? 'text-indigo-400' : 'text-slate-500 group-hover:text-slate-400'}`} />
                                    {label}
                                </>
                            )}
                        </NavLink>
                    ))}
                </div>

                {/* Content Area */}
                <div className="min-h-[500px] relative">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={location.pathname}
                            initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
                            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                            exit={{ opacity: 0, y: -10, filter: 'blur(4px)' }}
                            transition={{ duration: 0.3, ease: 'easeOut' }}
                            className="h-full"
                        >
                            <Outlet context={{ profile, setProfile }} />
                        </motion.div>
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
};

import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { db, APP_ID, storage } from '../firebase/config';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import {
    User, Globe, Building2,
    Zap, Clock, CheckCircle2, Camera, FileSignature, Save, Loader2
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAppStore } from '../store';
import type { UserProfile } from '../types';

export const Profile: React.FC = () => {
    const { user } = useAuth();
    const { tasks, projects, meetings } = useAppStore();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [profile, setProfile] = useState<Partial<UserProfile>>({});

    // Productivity Stats
    const [stats, setStats] = useState({
        score: 0,
        timeDelivered: 0, // hours
        completionRate: 0,
        activeProjects: 0
    });

    useEffect(() => {
        if (user) {
            fetchProfile();
            calculateProductivity();
        }
    }, [user, tasks, projects, meetings]);

    const fetchProfile = async () => {
        try {
            const docRef = doc(db, `apps/${APP_ID}/users`, user!.uid);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                setProfile(docSnap.data() as UserProfile);
            } else {
                setProfile({
                    uid: user!.uid,
                    displayName: user!.displayName || '',
                    personalEmail: user!.email || '',
                });
            }
        } catch (error) {
            toast.error('Failed to load profile');
        } finally {
            setLoading(false);
        }
    };

    const calculateProductivity = () => {
        // Simple algorithm for now
        const totalTasks = tasks.length;
        const doneTasks = tasks.filter(t => t.status === 'done').length;
        const compRate = totalTasks > 0 ? (doneTasks / totalTasks) * 100 : 0;

        const totalTimeMs = tasks.reduce((acc, t) => acc + (t.total_time_ms || 0), 0);
        const hours = totalTimeMs / (1000 * 60 * 60);

        const activePrj = projects.filter(p => p.status === 'active').length;

        // Weighting: 40% time, 30% completion, 20% projects, 10% meetings base
        // Goal: 8h/day = 100% of time component
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
            await setDoc(doc(db, `apps/${APP_ID}/users`, user.uid), {
                ...profile,
                productivityScore: stats.score,
                lastCalculated: serverTimestamp(),
                updated_at: serverTimestamp()
            }, { merge: true });
            toast.success('Profile updated successfully');
        } catch (error) {
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
        } catch (error) {
            toast.error(`Failed to upload ${type}`, { id: 'upload' });
        }
    };

    if (loading) return (
        <div className="flex items-center justify-center h-full">
            <Loader2 className="animate-spin text-indigo-500" size={32} />
        </div>
    );

    return (
        <div className="max-w-6xl mx-auto space-y-8 pb-12">
            {/* Header / Productivity Card */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-slate-900/50 border border-white/10 rounded-3xl p-8 backdrop-blur-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-10">
                        <Zap size={120} className="text-emerald-400" />
                    </div>

                    <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
                        <div className="relative group">
                            <div className="w-32 h-32 rounded-3xl bg-slate-800 border-4 border-slate-700 overflow-hidden shadow-2xl transition-transform group-hover:scale-105">
                                {profile.photoURL ? (
                                    <img src={profile.photoURL} alt="Avatar" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-slate-600 bg-slate-900/50">
                                        <User size={48} />
                                    </div>
                                )}
                            </div>
                            <label className="absolute -bottom-2 -right-2 p-2 bg-indigo-500 rounded-xl cursor-pointer hover:bg-indigo-600 shadow-lg transition-all scale-90 group-hover:scale-100">
                                <Camera size={16} className="text-white" />
                                <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'photo')} />
                            </label>
                        </div>

                        <div className="flex-1 text-center md:text-left">
                            <h1 className="text-3xl font-black text-white mb-2">{profile.displayName || 'No Name Set'}</h1>
                            <p className="text-slate-400 font-medium mb-6">Lead Developer @ {profile.companyName || 'TaskMaster'}</p>

                            <div className="flex flex-wrap justify-center md:justify-start gap-4">
                                <div className="bg-slate-950/50 border border-white/5 px-4 py-2 rounded-xl flex items-center gap-2">
                                    <Clock size={16} className="text-amber-400" />
                                    <span className="text-slate-200 text-sm font-bold">{stats.timeDelivered}h <span className="text-slate-500 font-normal">Delivered</span></span>
                                </div>
                                <div className="bg-slate-950/50 border border-white/5 px-4 py-2 rounded-xl flex items-center gap-2">
                                    <CheckCircle2 size={16} className="text-emerald-400" />
                                    <span className="text-slate-200 text-sm font-bold">{stats.completionRate}% <span className="text-slate-500 font-normal">Tasks Done</span></span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 space-y-2">
                        <div className="flex justify-between items-end mb-1">
                            <span className="text-slate-400 text-sm font-bold uppercase tracking-wider">Productivity Level</span>
                            <span className="text-3xl font-black text-emerald-400">{stats.score}<span className="text-slate-600 text-lg">/100</span></span>
                        </div>
                        <div className="h-4 bg-slate-950 rounded-full border border-white/5 overflow-hidden p-1">
                            <div
                                className="h-full bg-gradient-to-r from-indigo-500 via-emerald-500 to-emerald-400 rounded-full transition-all duration-1000 ease-out shadow-[0_0_20px_rgba(16,185,129,0.3)]"
                                style={{ width: `${stats.score}%` }}
                            />
                        </div>
                    </div>
                </div>

                <div className="bg-slate-900/50 border border-white/10 rounded-3xl p-8 backdrop-blur-xl flex flex-col justify-between">
                    <div>
                        <h2 className="text-white font-black mb-6 flex items-center gap-2">
                            <FileSignature size={20} className="text-indigo-400" /> Professional Signature
                        </h2>
                        <div className="aspect-video bg-slate-950/50 border-2 border-dashed border-slate-700 rounded-2xl flex flex-col items-center justify-center relative group overflow-hidden">
                            {profile.signatureURL ? (
                                <img src={profile.signatureURL} alt="Signature" className="max-h-full max-w-full p-4 object-contain invert" />
                            ) : (
                                <>
                                    <FileSignature size={32} className="text-slate-700 mb-2" />
                                    <p className="text-slate-600 text-xs text-center px-4 italic">No signature uploaded. This will be used in professional exports.</p>
                                </>
                            )}
                            <label className="absolute inset-0 bg-indigo-500/80 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-all">
                                <span className="text-white font-bold text-sm">Upload PNG Signature</span>
                                <input type="file" className="hidden" accept="image/png" onChange={(e) => handleFileUpload(e, 'signature')} />
                            </label>
                        </div>
                    </div>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="mt-6 w-full bg-indigo-500 hover:bg-indigo-600 text-white font-black py-4 rounded-2xl shadow-lg shadow-indigo-500/20 transition-all active:scale-95 flex items-center justify-center gap-2"
                    >
                        {saving ? <Loader2 className="animate-spin" size={20} /> : <><Save size={20} /> Save All Changes</>}
                    </button>
                </div>
            </div>

            {/* Main Form Sections */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Personal Information */}
                <section className="space-y-6">
                    <h3 className="text-slate-400 font-bold uppercase tracking-widest text-xs flex items-center gap-2 px-2">
                        <User size={14} /> Personal Identity
                    </h3>
                    <div className="bg-slate-900/40 border border-white/5 rounded-3xl p-8 space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-slate-500 text-xs font-bold px-1 uppercase tracking-wider">Full Name</label>
                                <input
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:border-indigo-500 outline-none transition-all font-medium"
                                    value={profile.fullName || ''}
                                    onChange={(e) => setProfile(p => ({ ...p, fullName: e.target.value }))}
                                    placeholder="Soumitro Halder"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-slate-500 text-xs font-bold px-1 uppercase tracking-wider">Professional Email</label>
                                <input
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:border-indigo-500 outline-none transition-all font-medium"
                                    value={profile.professionalEmail || ''}
                                    onChange={(e) => setProfile(p => ({ ...p, professionalEmail: e.target.value }))}
                                    placeholder="work@example.com"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-slate-500 text-xs font-bold px-1 uppercase tracking-wider">Website URL</label>
                            <div className="relative">
                                <Globe size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" />
                                <input
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 pl-12 text-slate-200 focus:border-indigo-500 outline-none transition-all font-medium"
                                    value={profile.websites?.[0] || ''}
                                    onChange={(e) => setProfile(p => ({ ...p, websites: [e.target.value] }))}
                                    placeholder="https://yourportfolio.com"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-slate-500 text-xs font-bold px-1 uppercase tracking-wider">Bio / Intro</label>
                            <textarea
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:border-indigo-500 outline-none transition-all font-medium resize-none"
                                rows={3}
                                value={profile.bio || ''}
                                onChange={(e) => setProfile(p => ({ ...p, bio: e.target.value }))}
                                placeholder="A short description about who you are..."
                            />
                        </div>
                    </div>
                </section>

                {/* Company & Team */}
                <section className="space-y-6">
                    <h3 className="text-slate-400 font-bold uppercase tracking-widest text-xs flex items-center gap-2 px-2">
                        <Building2 size={14} /> Company & Team
                    </h3>
                    <div className="bg-slate-900/40 border border-white/5 rounded-3xl p-8 space-y-6">
                        <div className="space-y-2">
                            <label className="text-slate-500 text-xs font-bold px-1 uppercase tracking-wider">Company Name</label>
                            <input
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:border-indigo-500 outline-none transition-all font-medium"
                                value={profile.companyName || ''}
                                onChange={(e) => setProfile(p => ({ ...p, companyName: e.target.value }))}
                                placeholder="Company Ltd."
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-slate-500 text-xs font-bold px-1 uppercase tracking-wider">Company Bio</label>
                            <textarea
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:border-indigo-500 outline-none transition-all font-medium resize-none"
                                rows={2}
                                value={profile.companyDescription || ''}
                                onChange={(e) => setProfile(p => ({ ...p, companyDescription: e.target.value }))}
                                placeholder="Tell us about your organization..."
                            />
                        </div>

                        <div className="mt-4 pt-4 border-t border-slate-800">
                            <div className="flex justify-between items-center mb-4">
                                <label className="text-slate-500 text-xs font-bold px-1 uppercase tracking-wider">Team Contact Directory</label>
                            </div>
                            <div className="space-y-3">
                                {(profile.teamMembers || []).map((member, idx) => (
                                    <div key={idx} className="flex gap-2 items-center bg-slate-950/50 p-2 rounded-xl border border-white/5">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-slate-200 text-xs font-bold truncate">{member.email}</p>
                                        </div>
                                        <button className="p-1.5 text-slate-600 hover:text-red-400">×</button>
                                    </div>
                                ))}
                                <div className="flex gap-2">
                                    <input className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 outline-none" placeholder="member@email.com" />
                                    <button className="px-3 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs hover:bg-slate-700 transition-all font-bold">Add</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
};

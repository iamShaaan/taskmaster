import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, APP_ID, auth } from '../firebase/config';
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    updateProfile,
    onAuthStateChanged,
} from 'firebase/auth';
import { setDoc } from 'firebase/firestore';
import { Sparkles, Mail, Lock, User, ArrowRight, Loader2, CheckCircle, XCircle, LinkIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';

type InviteStatus = 'loading' | 'valid' | 'accepting' | 'accepted' | 'invalid' | 'expired' | 'wrong_email';

interface InviteData {
    token: string;
    project_id: string;
    project_name: string;
    invited_email: string;
    invited_by_name: string;
    status: 'pending' | 'accepted' | 'expired';
    expires_at: any;
}

export const InviteAccept: React.FC = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const token = searchParams.get('token');

    const [inviteStatus, setInviteStatus] = useState<InviteStatus>('loading');
    const [invite, setInvite] = useState<InviteData | null>(null);
    const [currentUser, setCurrentUser] = useState(auth.currentUser);

    // Auth form state
    const [isLogin, setIsLogin] = useState(true);
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [authLoading, setAuthLoading] = useState(false);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (u) => setCurrentUser(u));
        return unsub;
    }, []);

    // Load invite from Firestore
    useEffect(() => {
        if (!token) { setInviteStatus('invalid'); return; }

        const load = async () => {
            try {
                const ref = doc(db, `apps/${APP_ID}/invitations/${token}`);
                const snap = await getDoc(ref);
                if (!snap.exists()) { setInviteStatus('invalid'); return; }

                const data = snap.data() as InviteData;
                const expiresAt = data.expires_at?.toDate ? data.expires_at.toDate() : new Date(data.expires_at);

                if (data.status === 'accepted') { setInviteStatus('accepted'); return; }
                if (expiresAt < new Date()) { setInviteStatus('expired'); return; }

                setInvite(data);
                setInviteStatus('valid');
            } catch {
                setInviteStatus('invalid');
            }
        };
        load();
    }, [token]);

    // If user is already logged in and invite is loaded → auto-accept if email matches
    useEffect(() => {
        if (inviteStatus === 'valid' && invite && currentUser) {
            if (currentUser.email?.toLowerCase() === invite.invited_email.toLowerCase()) {
                acceptInvite(currentUser.uid);
            } else {
                setInviteStatus('wrong_email');
            }
        }
    }, [inviteStatus, invite, currentUser]);

    const acceptInvite = async (uid: string) => {
        if (!invite || !token) return;
        setInviteStatus('accepting');
        try {
            // Add user to project's shared_with array
            const projectRef = doc(db, `apps/${APP_ID}/projects/${invite.project_id}`);
            const projectSnap = await getDoc(projectRef);
            if (projectSnap.exists()) {
                const projectData = projectSnap.data();
                const sharedWith: string[] = projectData.shared_with || [];
                if (!sharedWith.includes(uid)) {
                    await updateDoc(projectRef, {
                        shared_with: [...sharedWith, uid],
                        updated_at: serverTimestamp(),
                    });
                }
            }

            // Mark invite as accepted
            const inviteRef = doc(db, `apps/${APP_ID}/invitations/${token}`);
            await updateDoc(inviteRef, { status: 'accepted', accepted_at: serverTimestamp(), accepted_by: uid });

            setInviteStatus('accepted');
            toast.success(`You've joined "${invite.project_name}"!`);
            setTimeout(() => navigate(`/projects/${invite.project_id}`), 1500);
        } catch (err) {
            console.error(err);
            toast.error('Failed to accept invite. Please try again.');
            setInviteStatus('valid');
        }
    };

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!invite) return;
        setAuthLoading(true);
        try {
            let uid: string;
            if (isLogin) {
                const cred = await signInWithEmailAndPassword(auth, invite.invited_email, password);
                uid = cred.user.uid;
                await setDoc(doc(db, `apps/${APP_ID}/users`, uid), {
                    uid, email: invite.invited_email,
                    displayName: cred.user.displayName || invite.invited_email,
                    updated_at: serverTimestamp(),
                }, { merge: true });
            } else {
                const cred = await createUserWithEmailAndPassword(auth, invite.invited_email, password);
                uid = cred.user.uid;
                await updateProfile(cred.user, { displayName: name });
                await setDoc(doc(db, `apps/${APP_ID}/users`, uid), {
                    uid, email: invite.invited_email, displayName: name,
                    created_at: serverTimestamp(),
                });
            }
            await acceptInvite(uid);
        } catch (err: any) {
            toast.error(err.message || 'Authentication failed');
        } finally {
            setAuthLoading(false);
        }
    };

    const StatusScreen: React.FC<{ icon: React.ReactNode; title: string; subtitle: string; action?: React.ReactNode }> = ({ icon, title, subtitle, action }) => (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
            <div className="mb-6">{icon}</div>
            <h2 className="text-2xl font-bold text-slate-50 mb-2">{title}</h2>
            <p className="text-slate-400 mb-6">{subtitle}</p>
            {action}
        </motion.div>
    );

    const renderContent = () => {
        switch (inviteStatus) {
            case 'loading':
                return <div className="flex items-center justify-center gap-3 text-slate-400"><Loader2 className="animate-spin" size={24} /><span>Loading invitation...</span></div>;

            case 'accepting':
                return <div className="flex items-center justify-center gap-3 text-emerald-400"><Loader2 className="animate-spin" size={24} /><span>Joining project...</span></div>;

            case 'accepted':
                return (
                    <StatusScreen
                        icon={<CheckCircle size={56} className="text-emerald-400 mx-auto" />}
                        title="You're in!"
                        subtitle={`You've successfully joined "${invite?.project_name || 'the project'}". Redirecting...`}
                    />
                );

            case 'invalid':
                return (
                    <StatusScreen
                        icon={<XCircle size={56} className="text-red-400 mx-auto" />}
                        title="Invalid Invitation"
                        subtitle="This invitation link is invalid or doesn't exist."
                        action={<button onClick={() => navigate('/')} className="px-6 py-2.5 bg-indigo-500 text-white rounded-xl font-medium hover:bg-indigo-600 transition-all">Go to App</button>}
                    />
                );

            case 'expired':
                return (
                    <StatusScreen
                        icon={<XCircle size={56} className="text-amber-400 mx-auto" />}
                        title="Invitation Expired"
                        subtitle="This invite link has expired (links are valid for 7 days). Ask the project owner to send a new invite."
                        action={<button onClick={() => navigate('/')} className="px-6 py-2.5 bg-indigo-500 text-white rounded-xl font-medium hover:bg-indigo-600 transition-all">Go to App</button>}
                    />
                );

            case 'wrong_email':
                return (
                    <StatusScreen
                        icon={<XCircle size={56} className="text-red-400 mx-auto" />}
                        title="Wrong Account"
                        subtitle={`This invite was sent to ${invite?.invited_email}. Please sign out and sign in with that email address.`}
                        action={
                            <button
                                onClick={async () => { await auth.signOut(); window.location.reload(); }}
                                className="px-6 py-2.5 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 transition-all"
                            >
                                Sign Out & Switch Account
                            </button>
                        }
                    />
                );

            case 'valid':
                return (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                        {/* Invite Header */}
                        <div className="text-center mb-8">
                            <div className="w-14 h-14 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center mx-auto mb-4">
                                <LinkIcon size={28} className="text-indigo-400" />
                            </div>
                            <p className="text-slate-500 text-sm mb-1">You've been invited by <span className="text-slate-300 font-medium">{invite?.invited_by_name}</span></p>
                            <h2 className="text-2xl font-bold text-slate-50">Join <span className="text-indigo-400">{invite?.project_name}</span></h2>
                            <p className="text-slate-500 text-sm mt-2">Sign in (or create an account) with <span className="text-emerald-400 font-medium">{invite?.invited_email}</span></p>
                        </div>

                        {/* Auth Tabs */}
                        <div className="flex bg-slate-950/50 p-1 rounded-xl mb-6 border border-white/5">
                            <button onClick={() => setIsLogin(true)} className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${isLogin ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-slate-200'}`}>Sign In</button>
                            <button onClick={() => setIsLogin(false)} className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${!isLogin ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-slate-200'}`}>Sign Up</button>
                        </div>

                        <form onSubmit={handleAuth} className="space-y-4">
                            {!isLogin && (
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Full Name</label>
                                    <div className="relative">
                                        <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                                        <input type="text" required value={name} onChange={e => setName(e.target.value)} placeholder="John Doe"
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-10 pr-4 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 transition-colors" />
                                    </div>
                                </div>
                            )}

                            {/* Email locked to invite */}
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Email Address</label>
                                <div className="relative">
                                    <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                                    <input type="email" readOnly value={invite?.invited_email || ''}
                                        className="w-full bg-slate-950/50 border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-slate-400 cursor-not-allowed" />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded-full font-bold">LOCKED</span>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Password</label>
                                <div className="relative">
                                    <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                                    <input type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••"
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-10 pr-4 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 transition-colors" />
                                </div>
                            </div>

                            <button type="submit" disabled={authLoading}
                                className="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-3 rounded-xl shadow-lg shadow-indigo-500/20 transition-all active:scale-95 flex items-center justify-center gap-2 mt-2 disabled:opacity-50">
                                {authLoading ? <Loader2 size={20} className="animate-spin" /> : <><span>{isLogin ? 'Sign In & Join Project' : 'Create Account & Join'}</span><ArrowRight size={18} /></>}
                            </button>
                        </form>
                    </motion.div>
                );

            default:
                return null;
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
            <div className="absolute top-0 -left-1/4 w-1/2 h-1/2 bg-indigo-500/10 blur-[120px] rounded-full" />
            <div className="absolute bottom-0 -right-1/4 w-1/2 h-1/2 bg-purple-500/10 blur-[120px] rounded-full" />

            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-500/20">
                        <Sparkles size={32} className="text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-white">TaskMaster</h1>
                </div>

                <div className="bg-slate-900/50 border border-white/10 backdrop-blur-xl rounded-2xl p-8 shadow-2xl">
                    {renderContent()}
                </div>
            </div>
        </div>
    );
};

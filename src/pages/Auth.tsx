import React, { useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, sendPasswordResetEmail } from 'firebase/auth';
import { auth, db, APP_ID } from '../firebase/config';
import { setDoc, doc, serverTimestamp } from 'firebase/firestore';
import { Sparkles, Mail, Lock, User, ArrowRight, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

export const Auth: React.FC = () => {
    const [isLogin, setIsLogin] = useState(true);
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [showForgot, setShowForgot] = useState(false);
    const [forgotEmail, setForgotEmail] = useState('');
    const [forgotSent, setForgotSent] = useState(false);
    const [forgotLoading, setForgotLoading] = useState(false);

    const handleForgotPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!forgotEmail.trim()) { return; }
        setForgotLoading(true);
        try {
            await sendPasswordResetEmail(auth, forgotEmail.trim());
            setForgotSent(true);
        } catch (error: any) {
            toast.error(error.message || 'Failed to send reset email');
        } finally {
            setForgotLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (isLogin) {
                const userCredential = await signInWithEmailAndPassword(auth, email, password);
                const uid = userCredential.user.uid;
                const user_code = `TM-${uid.substring(0, 6).toUpperCase()}`;
                // Sync profile + ensure user_code on login
                await setDoc(doc(db, `apps/${APP_ID}/users`, uid), {
                    uid,
                    user_code,
                    email: userCredential.user.email,
                    displayName: userCredential.user.displayName || 'User',
                    updated_at: serverTimestamp()
                }, { merge: true });
                toast.success('Welcome back!');
            } else {
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                await updateProfile(userCredential.user, { displayName: name });
                const uid = userCredential.user.uid;
                const user_code = `TM-${uid.substring(0, 6).toUpperCase()}`;
                // Create profile on signup with user_code
                await setDoc(doc(db, `apps/${APP_ID}/users`, uid), {
                    uid,
                    user_code,
                    email: userCredential.user.email,
                    displayName: name,
                    members: [],
                    member_uids: [],
                    admin_uids: [],
                    moderator_uids: [],
                    viewer_uids: [],
                    created_at: serverTimestamp()
                });
                toast.success('Account created successfully!');
            }
        } catch (error: any) {
            console.error('Auth error:', error);
            toast.error(error.message || 'Authentication failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
            {/* Background Orbs */}
            <div className="absolute top-0 -left-1/4 w-1/2 h-1/2 bg-indigo-500/10 blur-[120px] rounded-full" />
            <div className="absolute bottom-0 -right-1/4 w-1/2 h-1/2 bg-purple-500/10 blur-[120px] rounded-full" />

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-md"
            >
                <div className="text-center mb-8">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-500/20">
                        <Sparkles size={32} className="text-white" />
                    </div>
                    <h1 className="text-3xl font-bold text-white mb-2">TaskMaster</h1>
                    <p className="text-slate-400">Advanced Project & Team Management</p>
                </div>

                <div className="bg-slate-900/50 border border-white/10 backdrop-blur-xl rounded-2xl p-8 shadow-2xl">
                    <div className="flex bg-slate-950/50 p-1 rounded-xl mb-8 border border-white/5">
                        <button
                            onClick={() => setIsLogin(true)}
                            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${isLogin ? 'bg-indigo-500 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
                        >
                            Login
                        </button>
                        <button
                            onClick={() => setIsLogin(false)}
                            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${!isLogin ? 'bg-indigo-500 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
                        >
                            Sign Up
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <AnimatePresence mode="wait">
                            {!isLogin && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="space-y-1"
                                >
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Full Name</label>
                                    <div className="relative">
                                        <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                                        <input
                                            type="text"
                                            required={!isLogin}
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            placeholder="John Doe"
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-10 pr-4 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
                                        />
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Email Address</label>
                            <div className="relative">
                                <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="name@company.com"
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-10 pr-4 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Password</label>
                            <div className="relative">
                                <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                                <input
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-10 pr-4 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-3 rounded-xl shadow-lg shadow-indigo-500/20 transition-all active:scale-95 flex items-center justify-center gap-2 mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <Loader2 size={20} className="animate-spin" />
                            ) : (
                                <>
                                    {isLogin ? 'Sign In' : 'Create Account'}
                                    <ArrowRight size={18} />
                                </>
                            )}
                        </button>
                    </form>

                    {/* Forgot Password link */}
                    {isLogin && (
                        <div className="mt-4 text-center">
                            <button
                                onClick={() => { setShowForgot(true); setForgotEmail(email); setForgotSent(false); }}
                                className="text-slate-500 hover:text-indigo-400 text-xs transition-colors"
                            >
                                Forgot password?
                            </button>
                        </div>
                    )}

                    <div className="mt-8 pt-6 border-t border-white/5 text-center">
                        <p className="text-slate-500 text-sm">
                            {isLogin ? "Don't have an account?" : "Already have an account?"}{' '}
                            <button
                                onClick={() => setIsLogin(!isLogin)}
                                className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
                            >
                                {isLogin ? 'Create one now' : 'Sign in here'}
                            </button>
                        </p>
                    </div>
                </div>
            </motion.div>

            {/* ─── Forgot Password Overlay ─── */}
            <AnimatePresence>
                {showForgot && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50"
                        onClick={(e) => e.target === e.currentTarget && setShowForgot(false)}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            className="bg-slate-900 border border-white/10 rounded-2xl p-8 w-full max-w-sm shadow-2xl"
                        >
                            {!forgotSent ? (
                                <>
                                    <div className="w-12 h-12 rounded-xl bg-indigo-500/20 flex items-center justify-center mx-auto mb-4">
                                        <Mail size={22} className="text-indigo-400" />
                                    </div>
                                    <h2 className="text-white font-black text-center text-lg mb-1">Reset Password</h2>
                                    <p className="text-slate-400 text-sm text-center mb-6">Enter your account email — we'll send a reset link.</p>

                                    <form onSubmit={handleForgotPassword} className="space-y-4">
                                        <div className="relative">
                                            <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                                            <input
                                                type="email"
                                                required
                                                value={forgotEmail}
                                                onChange={(e) => setForgotEmail(e.target.value)}
                                                placeholder="name@company.com"
                                                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-10 pr-4 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
                                            />
                                        </div>
                                        <button
                                            type="submit"
                                            disabled={forgotLoading}
                                            className="w-full bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2"
                                        >
                                            {forgotLoading ? <Loader2 size={18} className="animate-spin" /> : <><ArrowRight size={18} /> Send Reset Link</>}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setShowForgot(false)}
                                            className="w-full text-slate-500 hover:text-slate-300 text-sm transition-colors py-2"
                                        >
                                            Cancel
                                        </button>
                                    </form>
                                </>
                            ) : (
                                <div className="text-center">
                                    <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                                        <ArrowRight size={24} className="text-emerald-400" />
                                    </div>
                                    <h2 className="text-white font-black text-lg mb-2">Check your email</h2>
                                    <p className="text-slate-400 text-sm mb-1">We sent a reset link to:</p>
                                    <p className="text-indigo-300 font-bold text-sm mb-6">{forgotEmail}</p>
                                    <p className="text-slate-500 text-xs mb-6">Click the link in the email to set a new password. Check your spam folder if you don't see it.</p>
                                    <button
                                        onClick={() => { setShowForgot(false); setForgotSent(false); }}
                                        className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 rounded-xl transition-all"
                                    >
                                        Back to Login
                                    </button>
                                </div>
                            )}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

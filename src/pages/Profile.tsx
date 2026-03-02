import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { db, APP_ID, storage } from '../firebase/config';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import {
    User, Globe, Building2,
    Zap, Clock, CheckCircle2, Camera, FileSignature, Save, Loader2,
    Edit3, Mail, ExternalLink, X, Plus, Users, Layout
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAppStore } from '../store';
import type { UserProfile } from '../types';

// Safe URL hostname extractor - never throws
const getHostname = (url: string): string => {
    try {
        const u = url.startsWith('http') ? url : `https://${url}`;
        return new URL(u).hostname;
    } catch {
        return url || 'None linked';
    }
};

// ─── Prop Types ──────────────────────────────────────────────────────────────
interface Stats {
    score: number;
    timeDelivered: number;
    completionRate: number;
    activeProjects: number;
}

interface DashboardViewProps {
    profile: Partial<UserProfile>;
    stats: Stats;
    onEdit: () => void;
}

interface EditViewProps {
    profile: Partial<UserProfile>;
    setProfile: React.Dispatch<React.SetStateAction<Partial<UserProfile>>>;
    newMemberEmail: string;
    setNewMemberEmail: React.Dispatch<React.SetStateAction<string>>;
    newPortfolioUrl: string;
    setNewPortfolioUrl: React.Dispatch<React.SetStateAction<string>>;
    saving: boolean;
    onSave: () => void;
    onDiscard: () => void;
    onFileUpload: (e: React.ChangeEvent<HTMLInputElement>, type: 'photo' | 'signature') => void;
    onAddMember: () => void;
    onRemoveMember: (email: string) => void;
    onAddPortfolio: () => void;
    onRemovePortfolio: (url: string) => void;
}

// ─── Dashboard View (STABLE TOP-LEVEL COMPONENT) ─────────────────────────────
const DashboardView: React.FC<DashboardViewProps> = ({ profile, stats, onEdit }) => (
    <div className="space-y-8">
        {/* Header / Hero Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-slate-900/50 border border-white/10 rounded-[2.5rem] p-8 backdrop-blur-3xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-8 opacity-5 scale-150 rotate-12 transition-transform group-hover:scale-125 duration-1000">
                    <Zap size={200} className="text-indigo-400" />
                </div>

                <div className="relative z-10 flex flex-col md:flex-row items-center md:items-start gap-10">
                    <div className="relative">
                        <div className="w-40 h-40 rounded-[2rem] bg-gradient-to-br from-slate-800 to-slate-900 border-4 border-white/5 overflow-hidden shadow-2xl relative">
                            {profile.photoURL ? (
                                <img src={profile.photoURL} alt="Avatar" className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-slate-700 bg-slate-900/50">
                                    <User size={64} />
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex-1 text-center md:text-left space-y-4 pt-2">
                        <div>
                            <h1 className="text-4xl font-black text-white tracking-tight mb-1">{profile.displayName || 'No Name Set'}</h1>
                            <p className="text-indigo-400 font-bold tracking-wide uppercase text-xs flex items-center justify-center md:justify-start gap-2">
                                <Building2 size={12} /> {profile.companyName || 'TaskMaster Ecosystem'}
                            </p>
                        </div>

                        {/* ─── User Code ─────────────────── */}
                        <div className="inline-flex items-center gap-3 bg-indigo-500/10 border border-indigo-500/30 rounded-2xl px-5 py-3">
                            <div className="space-y-0.5">
                                <p className="text-indigo-400 text-[9px] font-black uppercase tracking-[0.2em]">Your User Code</p>
                                <p className="text-indigo-200 font-black text-2xl tracking-widest font-mono">
                                    {profile.user_code || `TM-${''}`}
                                </p>
                                <p className="text-slate-500 text-[9px]">Share this to be added to team projects</p>
                            </div>
                            <button
                                onClick={() => {
                                    if (profile.user_code) {
                                        navigator.clipboard.writeText(profile.user_code);
                                    }
                                }}
                                className="p-2 bg-indigo-500/20 hover:bg-indigo-500/40 rounded-xl text-indigo-300 transition-all"
                                title="Copy code"
                            >
                                <ExternalLink size={16} />
                            </button>
                        </div>

                        <p className="text-slate-400 text-sm leading-relaxed max-w-xl line-clamp-2 italic">
                            "{profile.bio || 'Your bio will appear here. Tell us about yourself...'}"
                        </p>


                        <div className="flex flex-wrap justify-center md:justify-start gap-3">
                            <div className="bg-slate-950/40 border border-white/10 px-5 py-2.5 rounded-2xl flex items-center gap-3">
                                <div className="p-1.5 bg-amber-500/20 rounded-lg"><Clock size={16} className="text-amber-400" /></div>
                                <span className="text-slate-200 font-black">{stats.timeDelivered}h <span className="text-slate-500 text-[10px] font-bold uppercase tracking-widest ml-1">Logs</span></span>
                            </div>
                            <div className="bg-slate-950/40 border border-white/10 px-5 py-2.5 rounded-2xl flex items-center gap-3">
                                <div className="p-1.5 bg-emerald-500/20 rounded-lg"><CheckCircle2 size={16} className="text-emerald-400" /></div>
                                <span className="text-slate-200 font-black">{stats.completionRate}% <span className="text-slate-500 text-[10px] font-bold uppercase tracking-widest ml-1">Done</span></span>
                            </div>
                            {(profile.websites || []).map((url, i) => (
                                <a key={i} href={url.startsWith('http') ? url : `https://${url}`} target="_blank" rel="noopener noreferrer"
                                    className="bg-indigo-500/10 border border-indigo-500/20 px-5 py-2.5 rounded-2xl flex items-center gap-3 hover:bg-indigo-500/20 transition-all group">
                                    <Globe size={16} className="text-indigo-400 group-hover:rotate-12 transition-transform" />
                                    <span className="text-indigo-300 font-bold text-xs uppercase tracking-widest">{getHostname(url)}</span>
                                </a>
                            ))}
                        </div>
                    </div>

                    <button
                        onClick={onEdit}
                        className="bg-white text-slate-950 px-6 py-3 rounded-2xl font-black text-sm hover:bg-slate-200 transition-all flex items-center gap-2 shadow-xl shadow-white/5 active:scale-95"
                    >
                        <Edit3 size={18} /> Edit Profile
                    </button>
                </div>

                <div className="mt-12 space-y-4">
                    <div className="flex justify-between items-end">
                        <div className="space-y-1">
                            <span className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">Live Performance Index</span>
                            <h3 className="text-white font-bold text-lg">Daily Productivity Level</h3>
                        </div>
                        <div className="text-right">
                            <span className="text-5xl font-black text-emerald-400">{stats.score}</span>
                            <span className="text-slate-600 text-xl font-bold">/100</span>
                        </div>
                    </div>
                    <div className="h-4 bg-slate-950 rounded-full border border-white/5 overflow-hidden p-1 shadow-inner">
                        <div
                            className="h-full bg-gradient-to-r from-indigo-500 via-emerald-500 to-emerald-400 rounded-full transition-all duration-1000 ease-out shadow-[0_0_25px_rgba(16,185,129,0.4)]"
                            style={{ width: `${stats.score}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* Digital Signature */}
            <div className="space-y-6 flex flex-col">
                <div className="flex-1 bg-slate-900/50 border border-white/10 rounded-[2.5rem] p-8 backdrop-blur-3xl relative overflow-hidden flex flex-col">
                    <h2 className="text-white font-black mb-6 flex items-center gap-3 text-lg">
                        <div className="p-2 bg-indigo-500/20 rounded-xl"><FileSignature size={20} className="text-indigo-400" /></div>
                        Digital Signature
                    </h2>
                    <div className="flex-1 aspect-square bg-slate-950/40 border-2 border-dashed border-slate-800 rounded-3xl flex items-center justify-center p-6 mb-4 group transition-colors hover:border-indigo-500/30">
                        {profile.signatureURL ? (
                            <img src={profile.signatureURL} alt="Signature" className="max-h-full max-w-full object-contain invert" />
                        ) : (
                            <div className="text-center space-y-3 opacity-30">
                                <FileSignature size={48} className="mx-auto text-slate-500" />
                                <p className="text-xs text-slate-400 font-medium">No signature configured</p>
                            </div>
                        )}
                    </div>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest text-center leading-relaxed italic">
                        Used automatically for professional <br />invoice &amp; report exports.
                    </p>
                </div>
            </div>
        </div>

        {/* Bottom Row: Company Info & Team */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Company & Details */}
            <div className="bg-slate-900/50 border border-white/10 rounded-[2.5rem] p-10 backdrop-blur-3xl space-y-8">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-500/20 rounded-2xl"><Building2 size={24} className="text-indigo-400" /></div>
                    <div>
                        <h2 className="text-white text-xl font-black">Organization Details</h2>
                        <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Client facing assets</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-6">
                    <div className="space-y-4">
                        <h3 className="text-slate-300 text-sm font-black flex items-center gap-2">
                            <Layout size={16} className="text-indigo-400" /> Company Bio
                        </h3>
                        <div className="bg-white/5 border border-white/5 rounded-3xl p-6 min-h-[100px]">
                            <p className="text-slate-400 text-sm leading-relaxed whitespace-pre-wrap">
                                {profile.companyDescription || "No organizational biography has been provided yet. Edit your profile to add your team's mission and agency details."}
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-white/5">
                        <div className="space-y-2">
                            <span className="text-slate-500 text-[10px] font-black uppercase tracking-widest block">Primary Point of Contact</span>
                            <div className="flex items-center gap-3 text-slate-200 font-bold bg-slate-950/40 p-3 rounded-2xl border border-white/5">
                                <Mail size={14} className="text-slate-500" />
                                <span className="text-xs truncate">{profile.professionalEmail || profile.personalEmail || "Not specified"}</span>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <span className="text-slate-500 text-[10px] font-black uppercase tracking-widest block">Portfolio Nexus</span>
                            {(profile.websites && profile.websites.length > 0) ? (
                                <div className="space-y-2">
                                    {profile.websites.map((url, i) => (
                                        <a key={i} href={url.startsWith('http') ? url : `https://${url}`} target="_blank" rel="noopener noreferrer"
                                            className="flex items-center gap-3 text-slate-200 font-bold bg-slate-950/40 p-3 rounded-2xl border border-white/5 hover:border-indigo-500/30 transition-all group">
                                            <ExternalLink size={14} className="text-slate-500 group-hover:text-indigo-400 transition-colors" />
                                            <span className="text-xs truncate group-hover:text-indigo-300 transition-colors">{getHostname(url)}</span>
                                        </a>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex items-center gap-3 text-slate-200 font-bold bg-slate-950/40 p-3 rounded-2xl border border-white/5">
                                    <ExternalLink size={14} className="text-slate-500" />
                                    <span className="text-xs text-slate-500">None linked</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Team Directory */}
            <div className="bg-slate-900/50 border border-white/10 rounded-[2.5rem] p-10 backdrop-blur-3xl flex flex-col">
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-emerald-500/20 rounded-2xl"><Users size={24} className="text-emerald-400" /></div>
                        <div>
                            <h2 className="text-white text-xl font-black">Team Contact Directory</h2>
                            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Internal sharing node</p>
                        </div>
                    </div>
                    <span className="bg-slate-950/50 border border-white/5 px-4 py-1 rounded-full text-[10px] font-black text-slate-400 uppercase">
                        {profile.teamMembers?.length || 0} Members
                    </span>
                </div>

                <div className="flex-1 space-y-3 max-h-[300px] overflow-y-auto pr-2">
                    {(!profile.teamMembers || profile.teamMembers.length === 0) ? (
                        <div className="h-full flex flex-col items-center justify-center opacity-30 text-center py-12 border-2 border-dashed border-slate-800 rounded-3xl">
                            <Users size={32} className="mb-2 text-slate-500" />
                            <p className="text-xs font-medium text-slate-400">Team directory is currently empty</p>
                        </div>
                    ) : (
                        profile.teamMembers.map((member, idx) => (
                            <div key={idx} className="flex items-center gap-4 bg-slate-950/40 p-4 rounded-2xl border border-white/5 group hover:border-emerald-500/30 transition-all">
                                <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-emerald-400 font-black border border-white/5">
                                    {member.email.charAt(0).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-white text-sm font-bold truncate">{member.email}</p>
                                    <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Active Member</p>
                                </div>
                                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button className="p-2 bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"><Mail size={14} /></button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <button
                    onClick={onEdit}
                    className="mt-8 w-full py-4 border-2 border-dashed border-slate-800 rounded-3xl text-slate-500 hover:text-indigo-400 hover:border-indigo-500/30 transition-all font-bold text-sm flex items-center justify-center gap-2"
                >
                    <Plus size={18} /> Manage Team Members
                </button>
            </div>
        </div>
    </div>
);

// ─── Edit View (STABLE TOP-LEVEL COMPONENT) ───────────────────────────────────
const EditView: React.FC<EditViewProps> = ({
    profile, setProfile, newMemberEmail, setNewMemberEmail,
    newPortfolioUrl, setNewPortfolioUrl,
    saving, onSave, onDiscard, onFileUpload, onAddMember, onRemoveMember,
    onAddPortfolio, onRemovePortfolio
}) => (
    <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
            <div>
                <h1 className="text-3xl font-black text-white">Edit Your Profile</h1>
                <p className="text-slate-500 font-bold uppercase tracking-widest text-xs mt-1">Updates reflect across all client portals</p>
            </div>
            <div className="flex gap-3">
                <button
                    onClick={onDiscard}
                    className="px-6 py-3 rounded-2xl text-slate-400 hover:text-white font-bold transition-all"
                >
                    Discard
                </button>
                <button
                    onClick={onSave}
                    disabled={saving}
                    className="bg-indigo-500 hover:bg-indigo-600 shadow-xl shadow-indigo-500/20 text-white px-8 py-3 rounded-2xl font-black flex items-center gap-2 active:scale-95 transition-all"
                >
                    {saving ? <Loader2 className="animate-spin" size={18} /> : <><Save size={18} /> Save Dashboard</>}
                </button>
            </div>
        </div>

        <div className="space-y-8 pb-20">
            {/* Media Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-slate-900/50 border border-white/10 rounded-[2rem] p-8 space-y-6">
                    <div className="flex items-center gap-3 mb-2">
                        <Camera size={20} className="text-indigo-400" />
                        <h3 className="text-white font-bold">Profile Media</h3>
                    </div>
                    <div className="flex items-center gap-6">
                        <div className="relative group">
                            <div className="w-24 h-24 rounded-2xl bg-slate-950 border border-white/5 overflow-hidden">
                                {profile.photoURL ? <img src={profile.photoURL} alt="p" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-slate-800"><User size={32} /></div>}
                            </div>
                            <label className="absolute -bottom-1 -right-1 p-2 bg-indigo-500 rounded-xl cursor-pointer hover:bg-indigo-600 transition-all">
                                <Camera size={14} className="text-white" />
                                <input type="file" className="hidden" accept="image/*" onChange={(e) => onFileUpload(e, 'photo')} />
                            </label>
                        </div>
                        <div className="flex-1 space-y-1">
                            <p className="text-white text-sm font-bold">Display Avatar</p>
                            <p className="text-slate-500 text-xs leading-relaxed">Recommended 400x400px squared image for best dashboard optics.</p>
                        </div>
                    </div>
                </div>

                <div className="bg-slate-900/50 border border-white/10 rounded-[2rem] p-8 space-y-6">
                    <div className="flex items-center gap-3 mb-2">
                        <FileSignature size={20} className="text-indigo-400" />
                        <h3 className="text-white font-bold">Agency Signature</h3>
                    </div>
                    <div className="flex items-center gap-6">
                        <div className="relative group">
                            <div className="w-24 h-24 rounded-2xl bg-slate-950 border border-white/5 flex items-center justify-center overflow-hidden">
                                {profile.signatureURL ? <img src={profile.signatureURL} alt="s" className="w-full h-full object-contain invert" /> : <div className="text-slate-900"><FileSignature size={32} /></div>}
                            </div>
                            <label className="absolute -bottom-1 -right-1 p-2 bg-indigo-500 rounded-xl cursor-pointer hover:bg-indigo-600 transition-all">
                                <Plus size={14} className="text-white" />
                                <input type="file" className="hidden" accept="image/png" onChange={(e) => onFileUpload(e, 'signature')} />
                            </label>
                        </div>
                        <div className="flex-1 space-y-1">
                            <p className="text-white text-sm font-bold">Professional PNG</p>
                            <p className="text-slate-500 text-xs leading-relaxed">Ensure a transparent background for seamless export integration.</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Identity Form */}
            <div className="bg-slate-900/50 border border-white/10 rounded-[2.5rem] p-10 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-3">
                        <label className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] ml-1">Platform Display Name</label>
                        <input
                            className="w-full bg-slate-950/50 border border-white/5 rounded-2xl px-5 py-4 text-white focus:border-indigo-500/50 outline-none transition-all font-bold"
                            value={profile.displayName || ''}
                            onChange={(e) => setProfile(p => ({ ...p, displayName: e.target.value }))}
                            placeholder="Display Name"
                        />
                    </div>
                    <div className="space-y-3">
                        <label className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] ml-1">Legal Full Name</label>
                        <input
                            className="w-full bg-slate-950/50 border border-white/5 rounded-2xl px-5 py-4 text-white focus:border-indigo-500/50 outline-none transition-all font-bold"
                            value={profile.fullName || ''}
                            onChange={(e) => setProfile(p => ({ ...p, fullName: e.target.value }))}
                            placeholder="Soumitro Halder"
                        />
                    </div>
                    <div className="space-y-3">
                        <label className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] ml-1">Business Email</label>
                        <input
                            className="w-full bg-slate-950/50 border border-white/5 rounded-2xl px-5 py-4 text-white focus:border-indigo-500/50 outline-none transition-all font-bold"
                            value={profile.professionalEmail || ''}
                            onChange={(e) => setProfile(p => ({ ...p, professionalEmail: e.target.value }))}
                            placeholder="billing@agency.com"
                        />
                    </div>
                    <div className="space-y-3 md:col-span-2">
                        <label className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] ml-1">Portfolio &amp; Links</label>
                        <div className="flex gap-3">
                            <div className="relative flex-1">
                                <Globe size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" />
                                <input
                                    className="w-full bg-slate-950/50 border border-white/5 rounded-2xl px-5 py-4 pl-12 text-white focus:border-indigo-500/50 outline-none transition-all font-bold"
                                    value={newPortfolioUrl}
                                    onChange={(e) => setNewPortfolioUrl(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), onAddPortfolio())}
                                    placeholder="https://linkedin.com/in/yourname"
                                />
                            </div>
                            <button
                                onClick={onAddPortfolio}
                                className="bg-slate-800 hover:bg-slate-700 text-white px-8 rounded-2xl font-black transition-all"
                            >
                                Add
                            </button>
                        </div>
                        {(profile.websites || []).length > 0 && (
                            <div className="flex flex-wrap gap-2 pt-2">
                                {(profile.websites || []).map((url, i) => (
                                    <div key={i} className="flex items-center gap-2 bg-slate-800 border border-white/5 px-4 py-2 rounded-2xl group">
                                        <Globe size={12} className="text-indigo-400" />
                                        <span className="text-slate-200 text-xs font-bold max-w-[200px] truncate">{getHostname(url)}</span>
                                        <button onClick={() => onRemovePortfolio(url)} className="text-slate-600 hover:text-red-400 transition-colors ml-1">
                                            <X size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="space-y-3">
                    <label className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] ml-1">Personal Biography</label>
                    <textarea
                        className="w-full bg-slate-950/50 border border-white/5 rounded-3xl px-6 py-5 text-white focus:border-indigo-500/50 outline-none transition-all font-medium resize-none"
                        rows={4}
                        value={profile.bio || ''}
                        onChange={(e) => setProfile(p => ({ ...p, bio: e.target.value }))}
                        placeholder="Tell your story..."
                    />
                </div>
            </div>

            {/* Company Form */}
            <div className="bg-slate-900/50 border border-white/10 rounded-[2.5rem] p-10 space-y-8">
                <div className="space-y-6">
                    <div className="space-y-3">
                        <label className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] ml-1">Organization Name</label>
                        <input
                            className="w-full bg-slate-950/50 border border-white/5 rounded-2xl px-5 py-4 text-white focus:border-indigo-500/50 outline-none transition-all font-bold"
                            value={profile.companyName || ''}
                            onChange={(e) => setProfile(p => ({ ...p, companyName: e.target.value }))}
                            placeholder="Agency X"
                        />
                    </div>
                    <div className="space-y-3">
                        <label className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] ml-1">Agency Overview / Mission</label>
                        <textarea
                            className="w-full bg-slate-950/50 border border-white/5 rounded-3xl px-6 py-5 text-white focus:border-indigo-500/50 outline-none transition-all font-medium resize-none"
                            rows={3}
                            value={profile.companyDescription || ''}
                            onChange={(e) => setProfile(p => ({ ...p, companyDescription: e.target.value }))}
                            placeholder="Vision, mission, and focus..."
                        />
                    </div>
                </div>

                <div className="pt-8 border-t border-white/5">
                    <h3 className="text-white font-bold mb-6 flex items-center gap-2">
                        <Users size={18} className="text-indigo-400" /> Manage Team Access
                    </h3>
                    <div className="space-y-4">
                        <div className="flex gap-3">
                            <div className="relative flex-1">
                                <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" />
                                <input
                                    className="w-full bg-slate-950 border border-white/5 rounded-2xl px-5 py-4 pl-12 text-white outline-none focus:border-indigo-500/50 transition-all font-bold"
                                    placeholder="Add member by email..."
                                    value={newMemberEmail}
                                    onChange={(e) => setNewMemberEmail(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), onAddMember())}
                                />
                            </div>
                            <button
                                onClick={onAddMember}
                                className="bg-slate-800 hover:bg-slate-700 text-white px-8 rounded-2xl font-black transition-all"
                            >
                                Invite
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-4">
                            {(profile.teamMembers || []).map((member, idx) => (
                                <div key={idx} className="flex items-center justify-between bg-slate-950 p-4 rounded-2xl border border-white/5">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 font-bold text-xs">
                                            {member.email.charAt(0).toUpperCase()}
                                        </div>
                                        <span className="text-slate-200 text-xs font-bold truncate max-w-[150px]">{member.email}</span>
                                    </div>
                                    <button
                                        onClick={() => onRemoveMember(member.email)}
                                        className="p-2 text-slate-600 hover:text-red-400 transition-colors"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
);

// ─── Main Profile Component ───────────────────────────────────────────────────
export const Profile: React.FC = () => {
    const { user } = useAuth();
    const { tasks, projects, meetings } = useAppStore();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [profile, setProfile] = useState<Partial<UserProfile>>({});
    const [newMemberEmail, setNewMemberEmail] = useState('');
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
                // Backfill user_code for existing users who don't have one
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
            await setDoc(doc(db, `apps/${APP_ID}/users`, user.uid), {
                ...profile,
                productivityScore: stats.score,
                lastCalculated: serverTimestamp(),
                updated_at: serverTimestamp()
            }, { merge: true });
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

    const addTeamMember = () => {
        if (!newMemberEmail.trim()) return;
        const email = newMemberEmail.trim().toLowerCase();
        if (profile.teamMembers?.some(m => m.email === email)) {
            toast.error('Member already added');
            return;
        }
        setProfile(p => ({
            ...p,
            teamMembers: [...(p.teamMembers || []), { email }]
        }));
        setNewMemberEmail('');
    };

    const removeTeamMember = (email: string) => {
        setProfile(p => ({
            ...p,
            teamMembers: p.teamMembers?.filter(m => m.email !== email) || []
        }));
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
        <div className="flex items-center justify-center h-full">
            <Loader2 className="animate-spin text-indigo-500" size={32} />
        </div>
    );

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {isEditing ? (
                <EditView
                    profile={profile}
                    setProfile={setProfile}
                    newMemberEmail={newMemberEmail}
                    setNewMemberEmail={setNewMemberEmail}
                    newPortfolioUrl={newPortfolioUrl}
                    setNewPortfolioUrl={setNewPortfolioUrl}
                    saving={saving}
                    onSave={handleSave}
                    onDiscard={() => setIsEditing(false)}
                    onFileUpload={handleFileUpload}
                    onAddMember={addTeamMember}
                    onRemoveMember={removeTeamMember}
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
    );
};

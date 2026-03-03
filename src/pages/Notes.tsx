import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Lock, Unlock, Eye, EyeOff, Pencil, Trash2, Tag, Search, Shield, KeyRound, AlertTriangle, RotateCcw } from 'lucide-react';
import { useAppStore } from '../store';
import { NoteEditor } from '../components/notes/NoteEditor';
import { Modal } from '../components/ui/Modal';
import type { Note } from '../types';
import { deleteDocById } from '../firebase/firestore';
import { formatDate } from '../utils/timeFormat';
import toast from 'react-hot-toast';
import { db, APP_ID } from '../firebase/config';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth } from '../firebase/config';

// ─── PIN Hashing (SHA-256 via WebCrypto) ──────────────────────────────────────
const hashPin = async (pin: string): Promise<string> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(pin + '_taskmaster_vault');
    const buffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('');
};

// ─── PIN Dot Display ──────────────────────────────────────────────────────────
const PinDots: React.FC<{ value: string; inputRef: React.RefObject<HTMLInputElement | null>; onKeyDown?: (e: React.KeyboardEvent) => void; onChange: (v: string) => void; autoFocus?: boolean }> =
    ({ value, inputRef, onKeyDown, onChange, autoFocus }) => (
        <div className="relative">
            {/* Invisible real input — captures keystrokes */}
            <input
                ref={inputRef}
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={value}
                autoFocus={autoFocus}
                onChange={e => onChange(e.target.value.replace(/\D/g, ''))}
                onKeyDown={onKeyDown}
                className="absolute inset-0 opacity-0 w-full h-full cursor-default"
                aria-label="PIN input"
            />
            {/* Visual dot boxes — clicking focuses the hidden input */}
            <div
                className="flex gap-2 justify-center cursor-pointer"
                onClick={() => inputRef.current?.focus()}
            >
                {[0, 1, 2, 3, 4, 5].map(i => (
                    <div
                        key={i}
                        className={`w-11 h-13 py-3 flex items-center justify-center rounded-xl border-2 text-xl font-black transition-all select-none ${value.length > i
                            ? 'border-amber-500 bg-amber-500/20 text-amber-300'
                            : value.length === i
                                ? 'border-amber-500/60 bg-slate-900/60 text-transparent animate-pulse'
                                : 'border-slate-700 bg-slate-900/30 text-transparent'
                            }`}
                    >
                        {value.length > i ? '●' : '·'}
                    </div>
                ))}
            </div>
        </div>
    );

// ─── Vault Lock Screen ────────────────────────────────────────────────────────
const VaultLockScreen: React.FC<{
    hasPin: boolean;
    onUnlock: (pin: string) => Promise<boolean>;
    onSetPin: (pin: string) => Promise<void>;
    onResetPin: () => Promise<void>;
}> = ({ hasPin, onUnlock, onSetPin, onResetPin }) => {
    const [pin, setPin] = useState('');
    const [confirmPin, setConfirmPin] = useState('');
    const [step, setStep] = useState<'enter' | 'set' | 'confirm' | 'resetConfirm'>(hasPin ? 'enter' : 'set');
    const [loading, setLoading] = useState(false);
    const [wrongAttempts, setWrongAttempts] = useState(0);

    const pinRef = useRef<HTMLInputElement>(null);
    const confirmRef = useRef<HTMLInputElement>(null);

    // Auto-focus correct input when step changes
    useEffect(() => {
        const timer = setTimeout(() => {
            if (step === 'enter' || step === 'set') pinRef.current?.focus();
            else if (step === 'confirm') confirmRef.current?.focus();
        }, 100);
        return () => clearTimeout(timer);
    }, [step]);

    const handleEnter = async () => {
        if (pin.length < 4) { toast.error('PIN must be at least 4 digits'); return; }
        setLoading(true);
        const ok = await onUnlock(pin);
        setLoading(false);
        if (!ok) {
            setWrongAttempts(w => w + 1);
            setPin('');
            setTimeout(() => pinRef.current?.focus(), 50);
        }
    };

    const handleSetPin = () => {
        if (pin.length < 4) { toast.error('PIN must be at least 4 digits'); return; }
        setStep('confirm');
        setConfirmPin('');
    };

    const handleConfirm = async () => {
        if (confirmPin !== pin) {
            toast.error('PINs do not match — try again');
            setConfirmPin('');
            setTimeout(() => confirmRef.current?.focus(), 50);
            return;
        }
        setLoading(true);
        await onSetPin(pin);
        setLoading(false);
    };

    const handleReset = async () => {
        setLoading(true);
        await onResetPin();
        setLoading(false);
    };

    return (
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-amber-500/20 rounded-2xl p-6 sm:p-10 text-center max-w-sm w-full mx-auto shadow-2xl shadow-amber-500/5 relative overflow-hidden">
            <div className="absolute inset-0 bg-amber-500/3 pointer-events-none rounded-2xl" />

            <div className="relative z-10">
                {/* Icon */}
                <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-5">
                    {step === 'enter' ? <Lock size={28} className="text-amber-400" /> :
                        step === 'set' ? <Shield size={28} className="text-amber-400" /> :
                            step === 'resetConfirm' ? <RotateCcw size={28} className="text-red-400" /> :
                                <KeyRound size={28} className="text-amber-400" />}
                </div>

                {/* ── ENTER PIN ── */}
                {step === 'enter' && (
                    <>
                        <h3 className="text-white font-black text-lg mb-1">Secure Vault</h3>
                        <p className="text-slate-500 text-xs mb-6">Enter your vault PIN to unlock</p>

                        {wrongAttempts > 0 && (
                            <p className="text-red-400 text-xs mb-3">
                                ❌ Wrong PIN — {wrongAttempts} failed {wrongAttempts === 1 ? 'attempt' : 'attempts'}
                            </p>
                        )}

                        <div className="mb-6">
                            <PinDots value={pin} inputRef={pinRef} onChange={setPin} autoFocus
                                onKeyDown={e => e.key === 'Enter' && handleEnter()} />
                        </div>

                        <button
                            onClick={handleEnter}
                            disabled={loading || pin.length < 4}
                            className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-slate-900 font-black py-3 rounded-xl transition-all active:scale-95 mb-3"
                        >
                            {loading ? 'Verifying...' : 'Unlock Vault'}
                        </button>

                        <button
                            onClick={() => setStep('resetConfirm')}
                            className="text-slate-600 hover:text-slate-400 text-xs transition-colors flex items-center justify-center gap-1 w-full"
                        >
                            <RotateCcw size={11} /> Forgot vault PIN?
                        </button>
                    </>
                )}

                {/* ── SET NEW PIN ── */}
                {step === 'set' && (
                    <>
                        <h3 className="text-white font-black text-lg mb-1">Set Vault PIN</h3>
                        <p className="text-slate-500 text-xs mb-2">Choose a 4–6 digit PIN for your secure vault.</p>
                        <p className="text-amber-500/70 text-[10px] mb-6 flex items-center justify-center gap-1">
                            <AlertTriangle size={10} /> Store this PIN safely — you can reset it if forgotten.
                        </p>

                        <div className="mb-6">
                            <PinDots value={pin} inputRef={pinRef} onChange={setPin} autoFocus
                                onKeyDown={e => e.key === 'Enter' && handleSetPin()} />
                        </div>

                        <button
                            onClick={handleSetPin}
                            disabled={pin.length < 4}
                            className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-slate-900 font-black py-3 rounded-xl transition-all active:scale-95"
                        >
                            Continue →
                        </button>
                    </>
                )}

                {/* ── CONFIRM PIN ── */}
                {step === 'confirm' && (
                    <>
                        <h3 className="text-white font-black text-lg mb-1">Confirm PIN</h3>
                        <p className="text-slate-500 text-xs mb-6">Enter the same PIN again to confirm</p>

                        <div className="mb-6">
                            <PinDots value={confirmPin} inputRef={confirmRef} onChange={setConfirmPin} autoFocus
                                onKeyDown={e => e.key === 'Enter' && handleConfirm()} />
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => { setStep('set'); setConfirmPin(''); }}
                                className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold py-3 rounded-xl transition-all"
                            >
                                ← Back
                            </button>
                            <button
                                onClick={handleConfirm}
                                disabled={loading || confirmPin.length < 4}
                                className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-slate-900 font-black py-3 rounded-xl transition-all active:scale-95"
                            >
                                {loading ? 'Saving...' : 'Confirm'}
                            </button>
                        </div>
                    </>
                )}

                {/* ── RESET VAULT PIN ── */}
                {step === 'resetConfirm' && (
                    <>
                        <h3 className="text-white font-black text-lg mb-1 text-red-300">Reset Vault PIN</h3>
                        <p className="text-slate-400 text-sm mb-2">
                            This will <strong>clear your existing vault PIN</strong> so you can set a new one.
                        </p>
                        <p className="text-slate-500 text-xs mb-6">
                            Your vault notes will still be here — they're stored in Firestore. Only the PIN lock is reset. Since you're already logged in, your identity is confirmed.
                        </p>

                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl mb-6">
                            <p className="text-red-300 text-xs font-bold">⚠️ Once reset, you'll need to set a new PIN before accessing the vault.</p>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setStep('enter')}
                                className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold py-3 rounded-xl transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleReset}
                                disabled={loading}
                                className="flex-1 bg-red-500 hover:bg-red-600 disabled:opacity-40 text-white font-black py-3 rounded-xl transition-all active:scale-95"
                            >
                                {loading ? 'Resetting...' : 'Reset PIN'}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

// ─── Main Notes Page ──────────────────────────────────────────────────────────
export const Notes: React.FC = () => {
    const { notes } = useAppStore();
    const [showForm, setShowForm] = useState(false);
    const [editNote, setEditNote] = useState<Note | undefined>();
    const [viewNote, setViewNote] = useState<Note | undefined>();
    const [search, setSearch] = useState('');
    const [vaultUnlocked, setVaultUnlocked] = useState(false);
    const [revealedNotes, setRevealedNotes] = useState<string[]>([]);
    const [storedPinHash, setStoredPinHash] = useState<string | null>(null);
    const [pinLoading, setPinLoading] = useState(true);

    const uid = auth.currentUser?.uid;

    // Load stored vault PIN hash from Firestore
    useEffect(() => {
        if (!uid) return;
        const load = async () => {
            try {
                const snap = await getDoc(doc(db, `apps/${APP_ID}/users`, uid));
                const data = snap.data();
                setStoredPinHash(data?.vault_pin_hash || null);
            } catch {
                setStoredPinHash(null);
            } finally {
                setPinLoading(false);
            }
        };
        load();
    }, [uid]);

    const normalNotes = notes.filter((n) => !n.is_secure);
    const vaultNotes = notes.filter((n) => n.is_secure);
    const filteredNormal = normalNotes.filter((n) =>
        n.title.toLowerCase().includes(search.toLowerCase()) || n.content.toLowerCase().includes(search.toLowerCase())
    );

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this note?')) return;
        await deleteDocById('notes', id);
        toast.success('Note deleted');
    };

    const toggleReveal = (id: string) => {
        setRevealedNotes((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
    };

    const handleUnlock = useCallback(async (pin: string): Promise<boolean> => {
        const hash = await hashPin(pin);
        if (hash === storedPinHash) {
            setVaultUnlocked(true);
            toast.success('🔓 Vault unlocked');
            return true;
        }
        toast.error('Wrong PIN — try again');
        return false;
    }, [storedPinHash]);

    const handleSetPin = useCallback(async (pin: string) => {
        if (!uid) return;
        const hash = await hashPin(pin);
        try {
            await setDoc(doc(db, `apps/${APP_ID}/users`, uid), { vault_pin_hash: hash }, { merge: true });
            setStoredPinHash(hash);
            setVaultUnlocked(true);
            toast.success('✅ Vault PIN set! Vault is now unlocked.');
        } catch {
            toast.error('Failed to save PIN');
        }
    }, [uid]);

    const handleResetPin = useCallback(async () => {
        if (!uid) return;
        try {
            await setDoc(doc(db, `apps/${APP_ID}/users`, uid), { vault_pin_hash: null }, { merge: true });
            setStoredPinHash(null);
            setVaultUnlocked(false);
            toast.success('Vault PIN reset. Set a new PIN below.');
        } catch {
            toast.error('Failed to reset PIN');
        }
    }, [uid]);

    const NoteCard = ({ note }: { note: Note }) => {
        const isRevealed = !note.is_secure || revealedNotes.includes(note.id);
        return (
            <div
                onClick={() => isRevealed && setViewNote(note)}
                className={`group bg-slate-800 border rounded-xl p-4 hover:border-indigo-500/30 transition-all ${isRevealed ? 'cursor-pointer' : ''} ${note.is_secure ? 'border-amber-500/30' : 'border-slate-700/50'}`}
            >
                <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                        {note.is_secure && <Lock size={13} className="text-amber-400 flex-shrink-0" />}
                        <h3 className="text-slate-100 font-medium text-sm">{note.title}</h3>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {note.is_secure && (
                            <button onClick={(e) => { e.stopPropagation(); toggleReveal(note.id); }} className="p-1.5 text-slate-500 hover:text-amber-400 rounded-lg transition-all">
                                {isRevealed ? <EyeOff size={13} /> : <Eye size={13} />}
                            </button>
                        )}
                        <button onClick={(e) => { e.stopPropagation(); setEditNote(note); setShowForm(true); }} className="p-1.5 text-slate-500 hover:text-indigo-400 rounded-lg hover:bg-indigo-500/10 transition-all"><Pencil size={13} /></button>
                        <button onClick={(e) => { e.stopPropagation(); handleDelete(note.id); }} className="p-1.5 text-slate-500 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-all"><Trash2 size={13} /></button>
                    </div>
                </div>
                <div className={`text-slate-400 text-xs font-mono whitespace-pre-wrap leading-relaxed max-h-32 overflow-hidden ${!isRevealed ? 'blur-sm select-none' : ''}`}>
                    {note.content || <span className="text-slate-600 italic">Empty note</span>}
                </div>
                {note.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-3">
                        {note.tags.map((t) => <span key={t} className="text-xs text-slate-500 bg-slate-700/60 px-1.5 py-0.5 rounded-full flex items-center gap-1"><Tag size={9} />{t}</span>)}
                    </div>
                )}
                <p className="text-slate-600 text-xs mt-2">{formatDate(note.updated_at)}</p>
            </div>
        );
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <div className="relative flex-1">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-indigo-500" placeholder="Search notes..." value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
                <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium rounded-lg transition-all flex-shrink-0">
                    <Plus size={16} /> New Note
                </button>
            </div>

            {/* Normal Notes */}
            <div>
                <h2 className="text-slate-300 text-sm font-semibold mb-3">Notes ({filteredNormal.length})</h2>
                {filteredNormal.length === 0 ? (
                    <div className="text-center py-10 text-slate-600 text-sm border-2 border-dashed border-slate-800 rounded-xl">No notes yet</div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {filteredNormal.map((note) => <NoteCard key={note.id} note={note} />)}
                    </div>
                )}
            </div>

            {/* Secure Vault */}
            <div>
                <div className="flex items-center gap-3 mb-4">
                    <h2 className="text-amber-400 text-sm font-semibold flex items-center gap-2"><Lock size={14} /> Secure Vault ({vaultNotes.length})</h2>
                    {vaultUnlocked && (
                        <button onClick={() => { setVaultUnlocked(false); setRevealedNotes([]); }} className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1">
                            <Unlock size={11} /> Lock
                        </button>
                    )}
                </div>

                {pinLoading ? (
                    <div className="text-center py-8 text-slate-600 text-sm">Loading vault...</div>
                ) : !vaultUnlocked ? (
                    <VaultLockScreen
                        hasPin={!!storedPinHash}
                        onUnlock={handleUnlock}
                        onSetPin={handleSetPin}
                        onResetPin={handleResetPin}
                    />
                ) : (
                    vaultNotes.length === 0 ? (
                        <div className="text-center py-8 text-slate-600 text-sm border-2 border-dashed border-amber-900/30 rounded-xl">No vault notes yet. Create a note and toggle "Vault" mode.</div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {vaultNotes.map((note) => <NoteCard key={note.id} note={note} />)}
                        </div>
                    )
                )}
            </div>

            <Modal isOpen={showForm} onClose={() => { setEditNote(undefined); setShowForm(false); }} title={editNote ? 'Edit Note' : 'New Note'} size="lg">
                <NoteEditor onClose={() => { setEditNote(undefined); setShowForm(false); }} editNote={editNote} />
            </Modal>

            {/* Note View Modal */}
            <Modal isOpen={!!viewNote} onClose={() => setViewNote(undefined)} title={viewNote?.title || 'Note Details'} size="lg">
                {viewNote && (
                    <div className="space-y-4">
                        <div className="bg-slate-900/50 rounded-xl p-4 max-h-[60vh] overflow-y-auto custom-scrollbar border border-slate-700/50">
                            <pre className="text-slate-300 text-sm font-mono whitespace-pre-wrap font-sans leading-relaxed">
                                {viewNote.content || <span className="text-slate-500 italic">Empty note</span>}
                            </pre>
                        </div>

                        <div className="flex items-center justify-between border-t border-slate-700/50 pt-4">
                            <div className="flex flex-wrap gap-2">
                                {viewNote.tags?.map((t) => (
                                    <span key={t} className="text-xs text-slate-400 bg-slate-800 border border-slate-700 px-2 py-1 rounded-md flex items-center gap-1">
                                        <Tag size={10} /> {t}
                                    </span>
                                ))}
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-xs text-slate-500">Updated: {formatDate(viewNote.updated_at)}</span>
                                <button
                                    onClick={() => { setEditNote(viewNote); setViewNote(undefined); setShowForm(true); }}
                                    className="px-3 py-1.5 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 rounded-lg text-sm transition-colors flex items-center gap-1.5"
                                >
                                    <Pencil size={14} /> Edit
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};

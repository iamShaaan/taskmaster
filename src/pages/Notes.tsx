import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Lock, Unlock, Eye, EyeOff, Pencil, Trash2, Tag, Search, Shield, KeyRound, AlertTriangle } from 'lucide-react';
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

// ─── Vault Lock Screen ────────────────────────────────────────────────────────
const VaultLockScreen: React.FC<{
    hasPin: boolean;
    onUnlock: (pin: string) => void;
    onSetPin: (pin: string) => void;
}> = ({ hasPin, onUnlock, onSetPin }) => {
    const [pin, setPin] = useState('');
    const [confirmPin, setConfirmPin] = useState('');
    const [step, setStep] = useState<'enter' | 'set' | 'confirm'>(hasPin ? 'enter' : 'set');
    const [loading, setLoading] = useState(false);

    const handleEnter = async () => {
        if (pin.length < 4) { toast.error('PIN must be at least 4 digits'); return; }
        setLoading(true);
        await new Promise(r => setTimeout(r, 300)); // Small delay for perception
        onUnlock(pin);
        setLoading(false);
        setPin('');
    };

    const handleSetPin = async () => {
        if (pin.length < 4) { toast.error('PIN must be at least 4 digits'); return; }
        setStep('confirm');
    };

    const handleConfirm = async () => {
        if (pin !== confirmPin) { toast.error('PINs do not match'); setConfirmPin(''); return; }
        setLoading(true);
        await onSetPin(pin);
        setLoading(false);
        setPin('');
        setConfirmPin('');
    };

    const digits = (val: string, setter: (v: string) => void) => (
        <div className="flex gap-2 justify-center">
            {[0, 1, 2, 3, 4, 5].map(i => (
                <div
                    key={i}
                    className={`w-10 h-12 flex items-center justify-center rounded-xl border-2 text-xl font-black transition-all ${val.length > i
                            ? 'border-amber-500 bg-amber-500/20 text-amber-300'
                            : 'border-slate-700 bg-slate-900/50 text-transparent'
                        }`}
                >
                    {val.length > i ? '●' : '·'}
                </div>
            ))}
            {/* Hidden input to capture keystrokes */}
            <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={val}
                onChange={e => setter(e.target.value.replace(/\D/g, ''))}
                onKeyDown={e => {
                    if (e.key === 'Enter') {
                        if (step === 'enter') handleEnter();
                        else if (step === 'set') handleSetPin();
                        else handleConfirm();
                    }
                }}
                autoFocus
                className="absolute opacity-0 w-0 h-0"
            />
        </div>
    );

    return (
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-amber-500/20 rounded-2xl p-10 text-center max-w-sm mx-auto shadow-2xl shadow-amber-500/5 relative overflow-hidden">
            {/* Amber glow */}
            <div className="absolute inset-0 bg-amber-500/3 pointer-events-none" />

            <div className="relative z-10">
                <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-5">
                    {step === 'enter' ? (
                        <Lock size={28} className="text-amber-400" />
                    ) : step === 'set' ? (
                        <Shield size={28} className="text-amber-400" />
                    ) : (
                        <KeyRound size={28} className="text-amber-400" />
                    )}
                </div>

                {step === 'enter' && (
                    <>
                        <h3 className="text-white font-black text-lg mb-1">Secure Vault</h3>
                        <p className="text-slate-500 text-xs mb-8">Enter your vault PIN to unlock</p>
                        <div className="relative mb-6" onClick={() => (document.querySelector('input[type=password]') as HTMLInputElement)?.focus()}>
                            {digits(pin, setPin)}
                        </div>
                        <button
                            onClick={handleEnter}
                            disabled={loading || pin.length < 4}
                            className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-slate-900 font-black py-3 rounded-xl transition-all active:scale-95"
                        >
                            {loading ? 'Verifying...' : 'Unlock Vault'}
                        </button>
                    </>
                )}

                {step === 'set' && (
                    <>
                        <h3 className="text-white font-black text-lg mb-1">Set Vault PIN</h3>
                        <p className="text-slate-500 text-xs mb-2">Choose a 4–6 digit PIN for your secure vault.</p>
                        <p className="text-amber-500/80 text-[10px] mb-8 flex items-center justify-center gap-1">
                            <AlertTriangle size={10} /> This PIN cannot be recovered. Don't forget it.
                        </p>
                        <div className="relative mb-6" onClick={() => (document.querySelector('input[type=password]') as HTMLInputElement)?.focus()}>
                            {digits(pin, setPin)}
                        </div>
                        <button
                            onClick={handleSetPin}
                            disabled={pin.length < 4}
                            className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-slate-900 font-black py-3 rounded-xl transition-all active:scale-95"
                        >
                            Set PIN
                        </button>
                    </>
                )}

                {step === 'confirm' && (
                    <>
                        <h3 className="text-white font-black text-lg mb-1">Confirm PIN</h3>
                        <p className="text-slate-500 text-xs mb-8">Enter the same PIN again to confirm</p>
                        <div className="relative mb-6" onClick={() => (document.querySelectorAll('input[type=password]')[1] as HTMLInputElement)?.focus()}>
                            {digits(confirmPin, setConfirmPin)}
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => { setStep('set'); setConfirmPin(''); }}
                                className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold py-3 rounded-xl transition-all"
                            >
                                Back
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
            </div>
        </div>
    );
};

// ─── Main Notes Page ──────────────────────────────────────────────────────────
export const Notes: React.FC = () => {
    const { notes } = useAppStore();
    const [showForm, setShowForm] = useState(false);
    const [editNote, setEditNote] = useState<Note | undefined>();
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

    const handleUnlock = useCallback(async (pin: string) => {
        const hash = await hashPin(pin);
        if (hash === storedPinHash) {
            setVaultUnlocked(true);
            toast.success('🔓 Vault unlocked');
        } else {
            toast.error('Wrong PIN – try again');
        }
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

    const NoteCard = ({ note }: { note: Note }) => {
        const isRevealed = !note.is_secure || revealedNotes.includes(note.id);
        return (
            <div className={`group bg-slate-800 border rounded-xl p-4 hover:border-indigo-500/30 transition-all ${note.is_secure ? 'border-amber-500/30' : 'border-slate-700/50'}`}>
                <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                        {note.is_secure && <Lock size={13} className="text-amber-400 flex-shrink-0" />}
                        <h3 className="text-slate-100 font-medium text-sm">{note.title}</h3>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {note.is_secure && (
                            <button onClick={() => toggleReveal(note.id)} className="p-1.5 text-slate-500 hover:text-amber-400 rounded-lg transition-all">
                                {isRevealed ? <EyeOff size={13} /> : <Eye size={13} />}
                            </button>
                        )}
                        <button onClick={() => { setEditNote(note); setShowForm(true); }} className="p-1.5 text-slate-500 hover:text-indigo-400 rounded-lg hover:bg-indigo-500/10 transition-all"><Pencil size={13} /></button>
                        <button onClick={() => handleDelete(note.id)} className="p-1.5 text-slate-500 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-all"><Trash2 size={13} /></button>
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
        </div>
    );
};

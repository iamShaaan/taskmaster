import React, { useState } from 'react';
import { Plus, Lock, Unlock, Eye, EyeOff, Pencil, Trash2, Tag, Search } from 'lucide-react';
import { useAppStore } from '../store';
import { NoteEditor } from '../components/notes/NoteEditor';
import { Modal } from '../components/ui/Modal';
import type { Note } from '../types';
import { deleteDocById } from '../firebase/firestore';
import { formatDate } from '../utils/timeFormat';
import toast from 'react-hot-toast';

const VAULT_PIN = '1949'; // Simple demo PIN — stored client-side only

export const Notes: React.FC = () => {
    const { notes } = useAppStore();
    const [showForm, setShowForm] = useState(false);
    const [editNote, setEditNote] = useState<Note | undefined>();
    const [search, setSearch] = useState('');
    const [vaultUnlocked, setVaultUnlocked] = useState(false);
    const [pinInput, setPinInput] = useState('');
    const [revealedNotes, setRevealedNotes] = useState<string[]>([]);

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

    const tryUnlockVault = () => {
        if (pinInput === VAULT_PIN) { setVaultUnlocked(true); setPinInput(''); toast.success('Vault unlocked'); }
        else { toast.error('Wrong PIN'); setPinInput(''); }
    };

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
                <div className="flex items-center gap-3 mb-3">
                    <h2 className="text-amber-400 text-sm font-semibold flex items-center gap-2"><Lock size={14} /> Secure Vault ({vaultNotes.length})</h2>
                    {vaultUnlocked && (
                        <button onClick={() => { setVaultUnlocked(false); setRevealedNotes([]); }} className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1">
                            <Unlock size={11} />Lock
                        </button>
                    )}
                </div>

                {!vaultUnlocked ? (
                    <div className="bg-slate-800 border border-amber-500/20 rounded-xl p-6 text-center">
                        <Lock size={32} className="text-amber-400 mx-auto mb-3" />
                        <p className="text-slate-400 text-sm mb-4">Enter PIN to unlock the vault</p>
                        <div className="flex gap-2 justify-center max-w-48 mx-auto">
                            <input
                                type="password"
                                maxLength={6}
                                placeholder="PIN"
                                value={pinInput}
                                onChange={(e) => setPinInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && tryUnlockVault()}
                                className="flex-1 bg-slate-700 border border-slate-600 text-slate-100 rounded-lg px-3 py-2 text-sm text-center tracking-widest focus:outline-none focus:border-amber-500"
                            />
                            <button onClick={tryUnlockVault} className="px-3 py-2 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-lg hover:bg-amber-500/30 text-sm transition-all">Unlock</button>
                        </div>
                        <p className="text-slate-600 text-xs mt-2">Default PIN: 2025</p>
                    </div>
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

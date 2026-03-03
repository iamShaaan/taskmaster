import React, { useState } from 'react';
import { HardDrive, Image, Video, FileText, Code, ExternalLink, Download, Trash2 } from 'lucide-react';
import { useAppStore } from '../store';
import type { FileAttachment } from '../types';
import { doc, updateDoc, arrayRemove } from 'firebase/firestore';
import { db, APP_ID } from '../firebase/config';
import toast from 'react-hot-toast';

const getFileIcon = (type: string) => {
    if (type?.startsWith('image/')) return <Image size={16} className="text-indigo-400" />;
    if (type?.startsWith('video/')) return <Video size={16} className="text-purple-400" />;
    if (type === 'application/pdf') return <FileText size={16} className="text-red-400" />;
    if (type?.includes('json')) return <Code size={16} className="text-emerald-400" />;
    return <HardDrive size={16} className="text-slate-400" />;
};

const formatBytes = (bytes: number) => {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
};

export const Files: React.FC = () => {
    const { tasks, clients, projects } = useAppStore();
    const [deleting, setDeleting] = useState<string | null>(null);

    const allFiles: (FileAttachment & { source: string; entity_type: 'task' | 'client' | 'project'; entity_id: string })[] = [
        ...tasks.flatMap((t) => (t.attachments || []).map((url) => ({
            id: url, name: url.split('/').pop() || 'file', url, type: '', size: 0,
            uploaded_at: t.created_at, entity_type: 'task' as const, entity_id: t.id, source: `Task: ${t.title}`
        }))),
        ...clients.flatMap((c) => (c.files || []).map((f) => ({
            ...f, entity_type: 'client' as const, entity_id: c.id, source: `Client: ${c.name}`
        }))),
        ...projects.flatMap((p) => (p.files || []).map((f) => ({
            ...f, entity_type: 'project' as const, entity_id: p.id, source: `Project: ${p.name}`
        }))),
    ];

    const handleDelete = async (file: typeof allFiles[0]) => {
        if (!confirm(`Delete "${file.name}"? This cannot be undone.`)) return;
        setDeleting(file.id);
        try {
            const collectionMap = { task: 'tasks', client: 'clients', project: 'projects' } as const;
            const collectionName = collectionMap[file.entity_type];
            const ref = doc(db, `apps/${APP_ID}/${collectionName}`, file.entity_id);

            if (file.entity_type === 'task') {
                // Tasks store attachments as URL array
                await updateDoc(ref, { attachments: arrayRemove(file.url) });
            } else {
                // Clients/Projects store files as object array — remove by id
                const currentFiles = file.entity_type === 'client'
                    ? clients.find(c => c.id === file.entity_id)?.files || []
                    : projects.find(p => p.id === file.entity_id)?.files || [];
                const updated = currentFiles.filter((f: FileAttachment) => f.id !== file.id);
                await updateDoc(ref, { files: updated });
            }
            toast.success(`Deleted ${file.name}`);
        } catch (err) {
            console.error(err);
            toast.error('Failed to delete file');
        } finally {
            setDeleting(null);
        }
    };

    return (
        <div className="space-y-4">
            <p className="text-slate-400 text-sm">{allFiles.length} total file{allFiles.length !== 1 ? 's' : ''} across all entities</p>

            {allFiles.length === 0 ? (
                <div className="text-center py-20">
                    <HardDrive size={48} className="text-slate-700 mx-auto mb-3" />
                    <p className="text-slate-400">No files yet. Upload files from Tasks, Clients, or Projects.</p>
                </div>
            ) : (
                <div className="bg-slate-800 border border-slate-700/50 rounded-xl overflow-x-auto">
                    <table className="w-full min-w-[600px]">
                        <thead>
                            <tr className="border-b border-slate-700/50">
                                <th className="text-slate-500 text-xs font-medium text-left px-4 py-3">File</th>
                                <th className="text-slate-500 text-xs font-medium text-left px-4 py-3">Source</th>
                                <th className="text-slate-500 text-xs font-medium text-left px-4 py-3">Size</th>
                                <th className="text-slate-500 text-xs font-medium text-left px-4 py-3">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {allFiles.map((file, i) => (
                                <tr key={`${file.id}-${i}`} className={`border-b border-slate-700/30 last:border-0 transition-colors ${deleting === file.id ? 'opacity-40' : 'hover:bg-slate-700/30'}`}>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            {getFileIcon(file.type)}
                                            <span className="text-slate-300 text-sm truncate max-w-48">{file.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-slate-500 text-xs">{file.source}</td>
                                    <td className="px-4 py-3 text-slate-500 text-xs">{formatBytes(file.size)}</td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-1">
                                            <a
                                                href={file.url}
                                                download={file.name}
                                                title="Download"
                                                className="p-1.5 text-slate-500 hover:text-emerald-400 transition-colors"
                                            >
                                                <Download size={14} />
                                            </a>
                                            <a href={file.url} target="_blank" rel="noopener noreferrer" title="Open in new tab" className="p-1.5 text-slate-500 hover:text-indigo-400 transition-colors">
                                                <ExternalLink size={14} />
                                            </a>
                                            <button
                                                onClick={() => handleDelete(file)}
                                                disabled={deleting === file.id}
                                                title="Delete file"
                                                className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all disabled:opacity-30"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

import React from 'react';
import { HardDrive, Image, Video, FileText, Code, ExternalLink, Download } from 'lucide-react';
import { useAppStore } from '../store';
import type { FileAttachment } from '../types';

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

    const allFiles: (FileAttachment & { source: string })[] = [
        ...tasks.flatMap((t) => (t.attachments || []).map((url) => ({ id: url, name: url.split('/').pop() || 'file', url, type: '', size: 0, uploaded_at: t.created_at, entity_type: 'task' as const, entity_id: t.id, source: `Task: ${t.title}` }))),
        ...clients.flatMap((c) => (c.files || []).map((f) => ({ ...f, entity_type: 'client' as const, entity_id: c.id, source: `Client: ${c.name}` }))),
        ...projects.flatMap((p) => (p.files || []).map((f) => ({ ...f, entity_type: 'project' as const, entity_id: p.id, source: `Project: ${p.name}` }))),
    ];

    return (
        <div className="space-y-4">
            <p className="text-slate-400 text-sm">{allFiles.length} total file{allFiles.length !== 1 ? 's' : ''} across all entities</p>

            {allFiles.length === 0 ? (
                <div className="text-center py-20">
                    <HardDrive size={48} className="text-slate-700 mx-auto mb-3" />
                    <p className="text-slate-400">No files yet. Upload files from Tasks, Clients, or Projects.</p>
                </div>
            ) : (
                <div className="bg-slate-800 border border-slate-700/50 rounded-xl overflow-hidden">
                    <table className="w-full">
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
                                <tr key={`${file.id}-${i}`} className="border-b border-slate-700/30 last:border-0 hover:bg-slate-700/30 transition-colors">
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

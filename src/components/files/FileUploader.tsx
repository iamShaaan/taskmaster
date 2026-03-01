import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, File, Image, Video, FileText, Code, X, Loader } from 'lucide-react';
import { uploadFile } from '../../firebase/storage';
import { updateDocById } from '../../firebase/firestore';
import type { FileAttachment } from '../../types';
import toast from 'react-hot-toast';

interface FileUploaderProps {
    entityType: 'task' | 'project' | 'client';
    entityId: string;
    existingFiles: FileAttachment[];
    onFilesUpdated: (files: FileAttachment[]) => void;
}

const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <Image size={16} className="text-indigo-400" />;
    if (type.startsWith('video/')) return <Video size={16} className="text-purple-400" />;
    if (type === 'application/pdf') return <FileText size={16} className="text-red-400" />;
    if (type.includes('json')) return <Code size={16} className="text-emerald-400" />;
    return <File size={16} className="text-slate-400" />;
};

const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
};

export const FileUploader: React.FC<FileUploaderProps> = ({ entityType, entityId, existingFiles, onFilesUpdated }) => {
    const [uploading, setUploading] = useState(false);

    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        setUploading(true);
        try {
            const uploaded: FileAttachment[] = [];
            for (const file of acceptedFiles) {
                const result = await uploadFile(file, entityType, entityId);
                uploaded.push({
                    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
                    ...result,
                    uploaded_at: new Date(),
                    entity_type: entityType,
                    entity_id: entityId,
                });
            }
            const updatedFiles = [...existingFiles, ...uploaded];
            await updateDocById(`${entityType}s`, entityId, { files: updatedFiles });
            onFilesUpdated(updatedFiles);
            toast.success(`${uploaded.length} file(s) uploaded!`);
        } catch (err) {
            toast.error('Upload failed');
            console.error(err);
        } finally {
            setUploading(false);
        }
    }, [entityType, entityId, existingFiles, onFilesUpdated]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: { 'image/*': [], 'video/*': [], 'application/pdf': [], 'application/json': [], 'text/*': [] },
        maxSize: 50 * 1024 * 1024, // 50MB
    });

    const removeFile = async (fileId: string) => {
        const updated = existingFiles.filter((f) => f.id !== fileId);
        await updateDocById(`${entityType}s`, entityId, { files: updated });
        onFilesUpdated(updated);
        toast.success('File removed');
    };

    return (
        <div className="space-y-3">
            <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${isDragActive ? 'border-indigo-500 bg-indigo-500/10' : 'border-slate-700 hover:border-slate-600 hover:bg-slate-800/50'
                    }`}
            >
                <input {...getInputProps()} />
                {uploading ? (
                    <div className="flex flex-col items-center gap-2">
                        <Loader size={24} className="text-indigo-400 animate-spin" />
                        <p className="text-slate-400 text-sm">Uploading...</p>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-2">
                        <Upload size={24} className={isDragActive ? 'text-indigo-400' : 'text-slate-600'} />
                        <p className="text-slate-400 text-sm">{isDragActive ? 'Drop files here' : 'Drag & drop files or click to browse'}</p>
                        <p className="text-slate-600 text-xs">Images, Videos, PDFs, JSON · Max 50MB</p>
                    </div>
                )}
            </div>

            {existingFiles.length > 0 && (
                <div className="space-y-2">
                    {existingFiles.map((file) => (
                        <div key={file.id} className="flex items-center gap-3 p-3 bg-slate-800 rounded-lg border border-slate-700/50 group">
                            {getFileIcon(file.type)}
                            <div className="flex-1 min-w-0">
                                <a href={file.url} target="_blank" rel="noopener noreferrer"
                                    className="text-slate-200 text-sm truncate hover:text-indigo-400 transition-colors block">{file.name}</a>
                                <p className="text-slate-500 text-xs">{formatBytes(file.size)}</p>
                            </div>
                            <button onClick={() => removeFile(file.id)} className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-500 hover:text-red-400 transition-all rounded-lg hover:bg-red-500/10">
                                <X size={14} />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

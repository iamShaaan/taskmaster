import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Clock, Tag, Type, Loader2, Sparkles } from 'lucide-react';
import { createDoc } from '../../firebase/firestore';
import { useAuth } from '../../hooks/useAuth';
import toast from 'react-hot-toast';
import type { RoutineCategory } from '../../types';

interface RoutineFormProps {
    onClose: () => void;
    initialDate?: Date; // To pre-fill any context if needed
}

const CATEGORIES: { value: RoutineCategory; label: string; color: string }[] = [
    { value: 'body', label: 'Body', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
    { value: 'mind', label: 'Mind', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
    { value: 'office', label: 'Productivity/Office', color: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' },
    { value: 'finance', label: 'Finance', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
];

export const RoutineForm: React.FC<RoutineFormProps> = ({ onClose }) => {
    const { user } = useAuth();
    const [title, setTitle] = useState('');
    const [time, setTime] = useState('08:00');
    const [category, setCategory] = useState<RoutineCategory>('office');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        if (!title.trim()) {
            toast.error('Please enter a task title');
            return;
        }

        setIsSubmitting(true);
        try {
            await createDoc('routines', {
                title: title.trim(),
                time,
                category,
                owner_id: user.uid,
                is_archived: false,
            });
            toast.success('Routine added successfully!');
            onClose();
        } catch (error) {
            console.error('Error adding routine:', error);
            toast.error('Failed to add routine');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {/* Title */}
            <div>
                <label className="block text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">
                    Task/Activity
                </label>
                <div className="relative group">
                    <Type size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="e.g., Morning Workout, Read 20 pages"
                        className="w-full bg-slate-900 border border-slate-700 text-slate-100 rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder:text-slate-600"
                        required
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* Time */}
                <div>
                    <label className="block text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">
                        Time
                    </label>
                    <div className="relative group flex items-center">
                        <Clock size={16} className="absolute left-3 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                        <input
                            type="time"
                            value={time}
                            onChange={(e) => setTime(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 text-slate-100 rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all [color-scheme:dark]"
                            required
                        />
                    </div>
                </div>

                {/* Category Selection */}
                <div>
                    <label className="block text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">
                        Category
                    </label>
                    <div className="relative group">
                        <Tag size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 z-10" />
                        <select
                            value={category}
                            onChange={(e) => setCategory(e.target.value as RoutineCategory)}
                            className="w-full bg-slate-900 border border-slate-700 text-slate-100 rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all appearance-none cursor-pointer"
                        >
                            {CATEGORIES.map(c => (
                                <option key={c.value} value={c.value}>{c.label}</option>
                            ))}
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                            <div className="w-2 h-2 border-b-2 border-r-2 border-slate-500 transform rotate-45" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Visual Indicator for Category */}
            <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700">
                <div className="flex items-center gap-3">
                    <div className={`px-2 py-1 rounded-md text-xs font-bold border ${CATEGORIES.find(c => c.value === category)?.color}`}>
                        {CATEGORIES.find(c => c.value === category)?.label.toUpperCase()}
                    </div>
                    <p className="text-slate-400 text-xs">This task will be grouped under the selected category in your daily routine.</p>
                </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t border-slate-800">
                <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-xl transition-all"
                >
                    Cancel
                </button>
                <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-[2] py-3 px-4 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(99,102,241,0.2)]"
                >
                    {isSubmitting ? (
                        <>
                            <Loader2 size={18} className="animate-spin" />
                            Creating...
                        </>
                    ) : (
                        <>
                            <Sparkles size={18} />
                            Add Routine
                        </>
                    )}
                </motion.button>
            </div>
        </form>
    );
};

/**
 * Detect if two time ranges overlap.
 * [s1, e1] overlaps [s2, e2] if s1 < e2 && s2 < e1
 */
export const timeRangesOverlap = (
    s1: Date,
    e1: Date,
    s2: Date,
    e2: Date
): boolean => s1 < e2 && s2 < e1;

export interface MeetingConflict {
    conflictingId: string;
    conflictingTitle: string;
    conflictStart: Date;
    conflictEnd: Date;
}

export const findConflicts = (
    newStart: Date,
    newEnd: Date,
    existingMeetings: { id: string; title: string; start_time: Date; end_time: Date }[],
    excludeId?: string
): MeetingConflict[] => {
    return existingMeetings
        .filter((m) => m.id !== excludeId)
        .filter((m) => timeRangesOverlap(newStart, newEnd, m.start_time, m.end_time))
        .map((m) => ({
            conflictingId: m.id,
            conflictingTitle: m.title,
            conflictStart: m.start_time,
            conflictEnd: m.end_time,
        }));
};

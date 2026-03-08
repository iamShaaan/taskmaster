// ─── Team Member (role-based) ─────────────────────────────────────────────────
export type MemberRole = 'admin' | 'moderator' | 'viewer';

export interface ProjectMember {
    uid: string;
    email: string;     // label only — for display reference
    role: MemberRole;
    added_at: Date;
}

export interface TaskNote {
    id: string;
    content: string;
    author_id: string;
    author_name: string;
    created_at: Date;
}

// ─── Core Entities ────────────────────────────────────────────────────────────
export interface Task {
    id: string;
    title: string;
    description: string;
    type: 'personal' | 'project' | 'client';
    project_id: string | null;
    client_id: string | null;
    status: 'open' | 'in_progress' | 'done' | 'overdue';
    priority: 'low' | 'medium' | 'high';
    due_date: Date | null;
    created_at: Date;
    deep_link: string;
    attachments: string[];
    time_logs: TimeLog[];
    total_time_ms: number;
    tags: string[];
    owner_id: string;
    completed_at?: Date;
    assignee_id?: string | null;
    assignee_name?: string | null;
    assignee_email?: string | null;
    project_member_uids?: string[];
    active_timer?: { start: Date; user_id: string } | null;
    notes?: TaskNote[];
    is_archived?: boolean;
}

export interface TimeLog {
    start: Date;
    end: Date;
    duration_ms: number;
    user_id?: string;
    user_name?: string;
    user_email?: string;
}

// A time entry recorded on a project when a task timer is stopped
export interface ProjectTimeEntry {
    task_id: string;
    task_title: string;
    date: string;        // ISO date string, e.g. "2026-03-03"
    start: Date;
    end: Date;
    duration_ms: number;
    user_id?: string;
    user_name?: string;
    user_email?: string;
    is_active?: boolean;
    is_archived?: boolean;
}

export interface Meeting {
    id: string;
    title: string;
    description: string;
    start_time: Date;
    end_time: Date;
    participants: string[];
    participant_uids?: string[];
    project_member_uids?: string[];
    linked_task_id: string | null;
    linked_client_id: string | null;
    linked_project_id: string | null;
    reminder_sent: boolean;
    created_at: Date;
    location?: string;
    outcome?: 'ended' | 'success' | 'failed'; // status set after meeting ends
    owner_id?: string;
    is_archived?: boolean;
}


export interface Client {
    id: string;
    name: string;
    description?: string;
    company: string;
    website?: string;
    emails: string[];
    phones: string[];
    notes: string;
    files: FileAttachment[];
    created_at: Date;
    tags: string[];
    owner_id: string;
}

export interface Project {
    id: string;
    name: string;
    description: string;
    status: 'active' | 'paused' | 'completed';
    priority: 'low' | 'medium' | 'high';
    client_id: string | null;
    files: FileAttachment[];
    created_at: Date;
    due_date?: Date | null;
    color: string;
    time_entries?: ProjectTimeEntry[];  // aggregated time from tasks
    owner_id: string;
    // Role-based member system
    members: ProjectMember[];       // full member objects (for display)
    member_uids: string[];          // all non-owner UIDs (for array-contains listener)
    admin_uids: string[];
    moderator_uids: string[];
    viewer_uids: string[];
    // Legacy — kept for backwards compat
    shared_with?: string[];
}

export interface Note {
    id: string;
    title: string;
    content: string;
    tags: string[];
    is_secure: boolean;
    is_credential?: boolean;
    template_type?: 'api_key' | 'credentials' | 'none';
    created_at: Date;
    updated_at: Date;
    owner_id?: string;
    linked_project_id?: string;
    is_archived?: boolean;
}

export interface UserProfile {
    uid: string;
    user_code: string;              // e.g. "TM-A3X9P2" — share to be added to projects
    displayName: string;
    fullName?: string;
    photoURL?: string;
    personalEmail?: string;
    professionalEmail?: string;
    phoneNumbers?: string[];
    websites?: string[];
    signatureURL?: string;
    bio?: string;
    companyName?: string;
    companyDescription?: string;
    teamMembers?: { uid?: string; user_code?: string; name?: string; email: string; phone?: string; whatsappNumber?: string; }[];
    productivityScore?: number;
    lastCalculated?: Date;
}

export interface FileAttachment {
    id: string;
    name: string;
    url: string;
    type: string;
    size: number;
    uploaded_at: Date;
    entity_type: 'task' | 'project' | 'client';
    entity_id: string;
    is_archived?: boolean;
}

export type RoutineCategory = 'body' | 'mind' | 'finance' | 'office' | 'fun';

export interface Routine {
    id: string;
    title: string;
    category: RoutineCategory;
    time: string; // e.g., "08:00"
    owner_id: string;
    created_at: Date;
    is_archived?: boolean;
}

export interface DailyLog {
    id: string;
    date: string; // Format: "YYYY-MM-DD"
    routine_id?: string;
    completed?: boolean;
    spent?: number;
    earned?: number;
    owner_id: string;
    created_at?: Date;
}

export interface N8nAction {
    action_type: string;
    payload: Record<string, unknown>;
    status: 'pending' | 'processing' | 'completed' | 'error';
    result: unknown;
    created_at: Date;
}

export interface AppNotification {
    id: string;
    user_id: string;
    title: string;
    body: string;
    type: 'activity' | 'reminder' | 'deadline' | 'system';
    read: boolean;
    created_at: Date;
    link?: string;
    related_entity_id?: string;
}


// ─── Team Member (role-based) ─────────────────────────────────────────────────
export type MemberRole = 'admin' | 'moderator' | 'viewer';

export interface ProjectMember {
    uid: string;
    email: string;     // label only — for display reference
    role: MemberRole;
    added_at: Date;
}

// ─── Core Entities ────────────────────────────────────────────────────────────
export interface Task {
    id: string;
    title: string;
    description: string;
    type: 'personal' | 'project' | 'client';
    project_id: string | null;
    client_id: string | null;
    status: 'open' | 'in_progress' | 'done' | 'error';
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
}

export interface TimeLog {
    start: Date;
    end: Date;
    duration_ms: number;
}

export interface Meeting {
    id: string;
    title: string;
    description: string;
    start_time: Date;
    end_time: Date;
    participants: string[];
    linked_task_id: string | null;
    linked_client_id: string | null;
    linked_project_id: string | null;
    reminder_sent: boolean;
    created_at: Date;
    location?: string;
    outcome?: 'ended' | 'success' | 'failed'; // status set after meeting ends
}


export interface Client {
    id: string;
    name: string;
    company: string;
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
    client_id: string | null;
    files: FileAttachment[];
    created_at: Date;
    color: string;
    time_logs?: TimeLog[];
    total_time_ms?: number;
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
    teamMembers?: { email: string; phone?: string; }[];
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
}

export interface N8nAction {
    action_type: string;
    payload: Record<string, unknown>;
    status: 'pending' | 'processing' | 'completed' | 'error';
    result: unknown;
    created_at: Date;
}

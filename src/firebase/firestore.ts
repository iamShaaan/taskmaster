import {
    collection,
    doc,
    addDoc,
    updateDoc,
    deleteDoc,
    getDoc,
    getDocs,
    query,
    where,
    orderBy,
    serverTimestamp,
    Timestamp,
    onSnapshot,
    QueryConstraint,
} from 'firebase/firestore';
import { db, APP_ID, auth } from './config';

export const col = (path: string) => collection(db, `apps/${APP_ID}/${path}`);
export const docRef = (path: string, id: string) => doc(db, `apps/${APP_ID}/${path}`, id);

export const createDoc = async (path: string, data: Record<string, unknown>) => {
    const user = auth.currentUser;
    const ref = await addDoc(col(path), {
        ...data,
        owner_id: user?.uid || null,
        // New member system (for projects)
        members: data.members || [],
        member_uids: data.member_uids || [],
        admin_uids: data.admin_uids || [],
        moderator_uids: data.moderator_uids || [],
        viewer_uids: data.viewer_uids || [],
        created_at: serverTimestamp(),
        status: data.status || 'open',
        priority: data.priority || 'medium',
    });
    return ref.id;
};

// Search by old email field (kept for compatibility)
export const searchUsers = async (email: string) => {
    const q = query(col('users'), where('email', '==', email));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

// Search by user code (new system) — e.g. "TM-A3X9P2"
export const searchByUserCode = async (code: string) => {
    const normalised = code.trim().toUpperCase();
    const q = query(col('users'), where('user_code', '==', normalised));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
};

export const updateDocById = async (path: string, id: string, data: Record<string, unknown>) => {
    await updateDoc(docRef(path, id), { ...data, updated_at: serverTimestamp() });
};

export const deleteDocById = async (path: string, id: string) => {
    await deleteDoc(docRef(path, id));
};

export const getDocById = async (path: string, id: string) => {
    const snap = await getDoc(docRef(path, id));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

export const getDocs_ = async (path: string, ...constraints: QueryConstraint[]) => {
    const q = query(col(path), ...constraints);
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const listenCollection = (
    path: string,
    callback: (data: Record<string, unknown>[]) => void,
    ...constraints: QueryConstraint[]
) => {
    const q = query(col(path), ...constraints);
    return onSnapshot(q, (snap) => {
        callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
};

export const toDate = (ts: Timestamp | Date | null | undefined): Date | null => {
    if (!ts) return null;
    if (ts instanceof Date) return ts;
    if (ts instanceof Timestamp) return ts.toDate();
    return null;
};

export { serverTimestamp, orderBy, where, Timestamp };

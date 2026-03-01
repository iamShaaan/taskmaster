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
import { db, APP_ID } from './config';

export const col = (path: string) => collection(db, `apps/${APP_ID}/${path}`);
export const docRef = (path: string, id: string) => doc(db, `apps/${APP_ID}/${path}`, id);

export const createDoc = async (path: string, data: Record<string, unknown>) => {
    const ref = await addDoc(col(path), { ...data, created_at: serverTimestamp() });
    return ref.id;
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

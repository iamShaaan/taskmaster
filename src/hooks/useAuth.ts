import { useEffect, useState } from 'react';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { auth } from '../firebase/config';

export const useAuth = () => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (u) => {
            if (u) {
                setUser(u);
                setLoading(false);
            } else {
                try {
                    await signInAnonymously(auth);
                } catch (err) {
                    console.error('[Auth] Anonymous sign-in failed:', err);
                    setLoading(false);
                }
            }
        });
        return unsub;
    }, []);

    return { user, loading };
};

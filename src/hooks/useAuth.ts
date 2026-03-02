import { useEffect, useState } from 'react';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { auth } from '../firebase/config';
import toast from 'react-hot-toast';

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
                } catch (err: any) {
                    console.error('[Auth] Anonymous sign-in failed:', err);
                    if (err.code === 'auth/configuration-not-found') {
                        toast.error('Firebase Auth Error: Please enable "Anonymous" provider in Firebase Console.', { duration: 6000 });
                    }
                    setLoading(false);
                }
            }
        });
        return unsub;
    }, []);

    return { user, loading };
};

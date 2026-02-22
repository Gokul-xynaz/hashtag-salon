import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../services/firebase';

const AuthContext = createContext();

export function useAuth() {
    return useContext(AuthContext);
}

export function AuthProvider({ children }) {
    const [currentUser, setCurrentUser] = useState(null);
    const [userRole, setUserRole] = useState(null); // 'admin' or 'stylist'
    const [selectedStylist, setSelectedStylist] = useState(() => {
        const saved = localStorage.getItem('sota_selected_stylist');
        return saved ? JSON.parse(saved) : null;
    });

    const [loading, setLoading] = useState(true);

    const selectStylist = (stylist) => {
        setSelectedStylist(stylist);
        if (stylist) {
            localStorage.setItem('sota_selected_stylist', JSON.stringify(stylist));
        } else {
            localStorage.removeItem('sota_selected_stylist');
        }
    };

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                // Fetch user role from Firestore 'users' collection
                try {
                    const userDoc = await getDoc(doc(db, 'users', user.uid));
                    if (userDoc.exists()) {
                        setUserRole(userDoc.data().role);
                    } else {
                        console.warn("Unauthorized access attempt: No profile found for", user.email);
                        setUserRole('unauthorized');
                    }
                } catch (error) {
                    console.error("Error fetching user role:", error);
                    setUserRole('error');
                }
                setCurrentUser(user);
            } else {
                setCurrentUser(null);
                setUserRole(null);
                // We DON'T clear selectedStylist here so the kiosk remembers the last stylus even if session expires
            }
            setLoading(false);
        });

        // Multi-tab sync for selectedStylist
        const handleStorageChange = (e) => {
            if (e.key === 'sota_selected_stylist') {
                const newValue = e.newValue ? JSON.parse(e.newValue) : null;
                setSelectedStylist(newValue);
            }
        };
        window.addEventListener('storage', handleStorageChange);

        return () => {
            unsubscribe();
            window.removeEventListener('storage', handleStorageChange);
        };
    }, []);

    const value = {
        currentUser,
        userRole,
        selectedStylist,
        selectStylist,
        logout: () => {
            // We DON'T remove selectedStylist on logout per user preference for high persistence
            signOut(auth);
        }
    };

    return (
        <AuthContext.Provider value={value}>
            {loading ? (
                <div style={{
                    height: '100vh',
                    width: '100vw',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'var(--bg-primary)',
                    gap: '1.5rem',
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    zIndex: 10000
                }}>
                    <div className="spinner"></div>
                    <div style={{
                        fontSize: '0.75rem',
                        letterSpacing: '0.3em',
                        color: 'var(--text-secondary)',
                        fontWeight: '700',
                        textTransform: 'uppercase'
                    }}>
                        Syncing Studio...
                    </div>
                </div>
            ) : children}
        </AuthContext.Provider>
    );
}

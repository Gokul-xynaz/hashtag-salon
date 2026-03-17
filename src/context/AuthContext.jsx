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
            console.log("Auth State Changed. User:", user ? user.email : "none");

            if (user) {
                // Fetch user role from Firestore 'users' collection
                try {
                    console.log("Fetching profile for UID:", user.uid);

                    // Create a promise that rejects after 5 seconds
                    const timeoutPromise = new Promise((_, reject) =>
                        setTimeout(() => reject(new Error("Firestore Timeout")), 5000)
                    );

                    // Race the getDoc against the timeout
                    const userDoc = await Promise.race([
                        getDoc(doc(db, 'users', user.uid)),
                        timeoutPromise
                    ]);

                    if (userDoc.exists()) {
                        console.log("Profile found. Role:", userDoc.data().role);
                        setUserRole(userDoc.data().role);
                    } else {
                        console.warn("No profile found for UID:", user.uid);
                        setUserRole('unauthorized');
                    }
                } catch (error) {
                    console.error("AuthContext Profile Fetch Error:", error);
                    // Still stop loading even if profile fetch fails
                    setUserRole('error');
                }
                setCurrentUser(user);
            } else {
                setCurrentUser(null);
                setUserRole(null);
            }
            console.log("Setting loading to false");
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

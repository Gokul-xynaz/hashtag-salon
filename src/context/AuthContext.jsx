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
                }
                setCurrentUser(user);
            } else {
                setCurrentUser(null);
                setUserRole(null);
                setSelectedStylist(null);
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
            localStorage.removeItem('sota_selected_stylist');
            signOut(auth);
        }
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
}

import React, { createContext, useContext, useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, doc, getDocs, getDoc, limit, orderBy } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from './AuthContext';

const DataContext = createContext();

export function DataProvider({ children }) {
    const [services, setServices] = useState([]);
    const [loadingServices, setLoadingServices] = useState(true);
    const [stylists, setStylists] = useState([]);
    const [loadingStylists, setLoadingStylists] = useState(true);
    const [settings, setSettings] = useState({ maxDiscount: 50 }); // Default fallback
    const [loadingSettings, setLoadingSettings] = useState(true);
    const [ongoingSessions, setOngoingSessions] = useState([]);
    const [loadingSessions, setLoadingSessions] = useState(true);
    const [attendance, setAttendance] = useState([]);
    const [loadingAttendance, setLoadingAttendance] = useState(true);

    const [products, setProducts] = useState([]);
    const [loadingProducts, setLoadingProducts] = useState(true);
    const [packages, setPackages] = useState([]);
    const [loadingPackages, setLoadingPackages] = useState(true);
    const [memberships, setMemberships] = useState([]);
    const [loadingMemberships, setLoadingMemberships] = useState(true);
    const { currentUser } = useAuth();

    useEffect(() => {
        const isPublicRoute = typeof window !== 'undefined' && window.location.pathname.startsWith('/v2/book');

        if (!currentUser && !isPublicRoute) {
            // Reset states and STOP loading when logged out
            setServices([]);
            setLoadingServices(false);
            setStylists([]);
            setLoadingStylists(false);
            setSettings({ maxDiscount: 50 });
            setLoadingSettings(false);
            setOngoingSessions([]);
            setLoadingSessions(false);
            setAttendance([]);
            setLoadingAttendance(false);

            setPackages([]);
            setLoadingPackages(false);
            setMemberships([]);
            setLoadingMemberships(false);
            return;
        }

        // Reset non-essential collections for public booking visitors
        if (!currentUser && isPublicRoute) {
            setSettings({ maxDiscount: 50 });
            setLoadingSettings(false);
            setOngoingSessions([]);
            setLoadingSessions(false);
            setAttendance([]);
            setLoadingAttendance(false);
            setPackages([]);
            setLoadingPackages(false);
            setMemberships([]);
            setLoadingMemberships(false);
            setProducts([]);
            setLoadingProducts(false);
        }

        // 1. Fetch Services Once
        getDocs(collection(db, 'services')).then((snapshot) => {
            const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setServices(list);
            setLoadingServices(false);
        }).catch((err) => {
            console.error("Services fetch error:", err);
            setLoadingServices(false);
        });

        // 2. Fetch Stylists Once (excluding technical kiosk accounts)
        const qStylists = query(collection(db, 'users'), where('role', '==', 'stylist'));
        getDocs(qStylists).then((snapshot) => {
            const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            const filtered = list.filter(u => 
                !u.isKiosk && 
                u.email !== 'hashtagsalon@store.com' && 
                u.name?.toLowerCase() !== 'stylist' && 
                u.id !== 'stylist' && 
                !u.email?.toLowerCase().startsWith('stylist@')
            );
            setStylists(filtered);
            setLoadingStylists(false);
        }).catch((err) => {
            console.error("Stylists fetch error:", err);
            setLoadingStylists(false);
        });

        // Authenticated-only listeners
        let unsubSettings = () => {};
        let unsubSessions = () => {};
        let unsubAttendance = () => {};

        if (currentUser) {
            // 3. Fetch Global Settings Once
            getDoc(doc(db, 'settings', 'salon_config')).then((snapshot) => {
                if (snapshot.exists()) {
                    setSettings(snapshot.data());
                }
                setLoadingSettings(false);
            }).catch((err) => {
                console.error("Settings fetch error:", err);
                setLoadingSettings(false);
            });

            // 4. Ongoing Sessions (for concurrency) - Keep Real-time
            unsubSessions = onSnapshot(collection(db, 'ongoing_sessions'), (snapshot) => {
                const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setOngoingSessions(list);
                setLoadingSessions(false);
            }, (err) => {
                console.error("Sessions stream error:", err);
                setLoadingSessions(false);
            });

            // 5. Attendance (Today's Status) - Keep Real-time
            const today = new Date().toLocaleDateString('en-CA');
            const qAttendance = query(collection(db, 'attendance'), where('date', '==', today));
            unsubAttendance = onSnapshot(qAttendance, (snapshot) => {
                const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setAttendance(list);
                setLoadingAttendance(false);
            }, (err) => {
                console.error("Attendance stream error:", err);
                setLoadingAttendance(false);
            });

            // 7. Fetch Products Once
            getDocs(collection(db, 'products')).then((snapshot) => {
                const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setProducts(list);
                setLoadingProducts(false);
            }).catch((err) => {
                console.error("Products fetch error:", err);
                setLoadingProducts(false);
            });

            // 8. Fetch Packages Once
            getDocs(collection(db, 'packages')).then((snapshot) => {
                const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setPackages(list);
                setLoadingPackages(false);
            }).catch((err) => {
                console.error("Packages fetch error:", err);
                setLoadingPackages(false);
            });

            // 9. Fetch Memberships Once
            getDocs(collection(db, 'memberships')).then((snapshot) => {
                const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setMemberships(list);
                setLoadingMemberships(false);
            }).catch((err) => {
                console.error("Memberships fetch error:", err);
                setLoadingMemberships(false);
            });
        }

        return () => {
            unsubSessions();
            unsubAttendance();
        };
    }, [currentUser]);

    const value = React.useMemo(() => {
        const trialStartedAt = settings?.trialStartedAt?.toDate?.() || null;
        const now = new Date();
        const trialDuration = 30 * 24 * 60 * 60 * 1000; // 30 Days

        let trialDaysRemaining = 0;
        if (trialStartedAt) {
            const elapsed = now.getTime() - trialStartedAt.getTime();
            trialDaysRemaining = Math.max(0, Math.ceil((trialDuration - elapsed) / (24 * 60 * 60 * 1000)));
        }

        const isPremiumActive = settings?.isPremiumActive || (trialDaysRemaining > 0);

        return {
            services,
            loadingServices,
            stylists,
            loadingStylists,
            settings,
            loadingSettings,
            premiumFeatures: settings.premiumFeatures || {},
            isPremiumActive,
            trialDaysRemaining,
            ongoingSessions,
            loadingSessions,
            attendance,
            loadingAttendance,

            products,
            loadingProducts,
            packages,
            loadingPackages,
            memberships,
            loadingMemberships
        };
    }, [services, loadingServices, stylists, loadingStylists, settings, loadingSettings, ongoingSessions, loadingSessions, attendance, loadingAttendance, products, loadingProducts, packages, loadingPackages, memberships, loadingMemberships]);

    return (
        <DataContext.Provider value={value}>
            {children}
        </DataContext.Provider>
    );
}

export function useData() {
    const context = useContext(DataContext);
    if (!context) {
        throw new Error("useData must be used within a DataProvider");
    }
    return context;
}

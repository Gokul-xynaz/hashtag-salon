import React, { createContext, useContext, useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, doc, limit } from 'firebase/firestore';
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
    const [customers, setCustomers] = useState([]);
    const [loadingCustomers, setLoadingCustomers] = useState(true);
    const [products, setProducts] = useState([]);
    const [loadingProducts, setLoadingProducts] = useState(true);
    const { currentUser } = useAuth();

    useEffect(() => {
        if (!currentUser) {
            // Reset states and STOP loading when logged out
            setServices([]);
            setLoadingServices(false);
            setStylists([]);
            setLoadingStylists(false);
            setSettings({ maxDiscount: 50 });
            setLoadingSettings(false);
            setOngoingSessions([]);
            setLoadingSessions(false);
            setCustomers([]);
            setLoadingCustomers(false);
            setProducts([]);
            setLoadingProducts(false);
            return;
        }

        // 1. Real-time Services
        const unsubServices = onSnapshot(collection(db, 'services'), (snapshot) => {
            const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setServices(list);
            setLoadingServices(false);
        }, (err) => {
            console.error("Services stream error:", err);
            setLoadingServices(false);
        });

        // 2. Real-time Stylists (excluding technical kiosk accounts)
        const qStylists = query(collection(db, 'users'), where('role', '==', 'stylist'));
        const unsubStylists = onSnapshot(qStylists, (snapshot) => {
            const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            // Strict filter to hide technical accounts
            const filtered = list.filter(u => !u.isKiosk && u.email !== 'contact@hashtagsaloon.com');
            setStylists(filtered);
            setLoadingStylists(false);
        }, (err) => {
            console.error("Stylists stream error:", err);
            setLoadingStylists(false);
        });

        // 3. Global Settings
        const unsubSettings = onSnapshot(doc(db, 'settings', 'salon_config'), (snapshot) => {
            if (snapshot.exists()) {
                setSettings(snapshot.data());
            }
            setLoadingSettings(false);
        }, (err) => {
            console.error("Settings stream error:", err);
            setLoadingSettings(false);
        });

        // 4. Ongoing Sessions (for concurrency)
        const unsubSessions = onSnapshot(collection(db, 'ongoing_sessions'), (snapshot) => {
            const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setOngoingSessions(list);
            setLoadingSessions(false);
        }, (err) => {
            console.error("Sessions stream error:", err);
            setLoadingSessions(false);
        });

        // 5. Real-time Customers (Limited to 500 for performance)
        const qCustomers = query(collection(db, 'customers'), limit(500));
        const unsubCustomers = onSnapshot(qCustomers, (snapshot) => {
            const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setCustomers(list);
            setLoadingCustomers(false);
        }, (err) => {
            console.error("Customers stream error:", err);
            setLoadingCustomers(false);
        });

        // 6. Real-time Products
        const unsubProducts = onSnapshot(collection(db, 'products'), (snapshot) => {
            const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setProducts(list);
            setLoadingProducts(false);
        }, (err) => {
            console.error("Products stream error:", err);
            setLoadingProducts(false);
        });

        return () => {
            unsubServices();
            unsubStylists();
            unsubSettings();
            unsubSessions();
            unsubCustomers();
            unsubProducts();
        };
    }, [currentUser]);

    const value = React.useMemo(() => {
        const trialStartedAt = settings?.trialStartedAt?.toDate?.() || null;
        const now = new Date();
        const trialDuration = 366 * 24 * 60 * 60 * 1000; // 366 Days

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
            customers,
            loadingCustomers,
            products,
            loadingProducts
        };
    }, [services, loadingServices, stylists, loadingStylists, settings, loadingSettings, ongoingSessions, loadingSessions, customers, loadingCustomers, products, loadingProducts]);

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

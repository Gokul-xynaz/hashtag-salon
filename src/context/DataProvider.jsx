import React, { createContext, useContext, useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, doc } from 'firebase/firestore';
import { db } from '../services/firebase';

const DataContext = createContext();

export function DataProvider({ children }) {
    const [services, setServices] = useState([]);
    const [loadingServices, setLoadingServices] = useState(true);
    const [stylists, setStylists] = useState([]);
    const [loadingStylists, setLoadingStylists] = useState(true);
    const [settings, setSettings] = useState({ maxDiscount: 50 }); // Default fallback
    const [loadingSettings, setLoadingSettings] = useState(true);

    useEffect(() => {
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
            const filtered = list.filter(u => !u.isKiosk && u.email !== 'jxsaloon@store.com');
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

        return () => {
            unsubServices();
            unsubStylists();
            unsubSettings();
        };
    }, []);

    const value = {
        services,
        loadingServices,
        stylists,
        loadingStylists,
        settings,
        loadingSettings
    };

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

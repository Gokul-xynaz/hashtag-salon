import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, where, orderBy, Timestamp, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

// --- Services Management ---
export const getServices = async () => {
    const querySnapshot = await getDocs(collection(db, 'services'));
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const addService = async (service) => {
    return await addDoc(collection(db, 'services'), service);
};

export const updateService = async (id, data) => {
    return await updateDoc(doc(db, 'services', id), data);
};

export const deleteService = async (id) => {
    return await deleteDoc(doc(db, 'services', id));
};

// --- Expenses Management ---
export const addExpense = async (expense) => {
    return await addDoc(collection(db, 'expenses'), {
        ...expense,
        date: Timestamp.now()
    });
};

export const getExpenses = async () => {
    // Simple fetch, usually you'd want date filtering
    const q = query(collection(db, 'expenses'), orderBy('date', 'desc'));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

// --- Stylist Management (Users) ---
export const createStylistProfile = async (uid, email, name) => {
    // Create user doc
    await setDoc(doc(db, 'users', uid), {
        email,
        name,
        role: 'stylist',
        createdAt: Timestamp.now()
    });
    // Initialize revenue doc for them? Or do it dynamically.
};

export const getStylists = async () => {
    const q = query(collection(db, 'users'), where('role', '==', 'stylist'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

// --- Reporting ---
// Get total store revenue (This would be better as an aggregation or separate collection increment)
export const getStoreStats = async () => {
    // Placeholder: Real implementation requires aggregating 'appointments' or reading a 'stats' doc
    // For MVP, we might calculate client-side if data is small, or use a tally doc
    return {
        totalRevenue: 0,
        netProfit: 0
    };
}

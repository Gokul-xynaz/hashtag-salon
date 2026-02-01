import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';

export function useStoreRevenue(stylistId = null, isGlobal = false) {
    const [storeTotal, setStoreTotal] = useState(0);
    const [expensesTotal, setExpensesTotal] = useState(0);
    const [netProfit, setNetProfit] = useState(0);
    const [averageBill, setAverageBill] = useState(0);
    const [billCount, setBillCount] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Stabilize Today's date to the start of the current day
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        // Define queries
        let revenueQuery;
        if (stylistId) {
            revenueQuery = query(
                collection(db, 'appointments'),
                where('timestamp', '>=', today),
                where('stylistId', '==', stylistId)
            );
        } else if (isGlobal) {
            revenueQuery = query(
                collection(db, 'appointments'),
                where('timestamp', '>=', today)
            );
        } else {
            setStoreTotal(0); setExpensesTotal(0); setNetProfit(0); setAverageBill(0); setBillCount(0);
            setLoading(false);
            return;
        }

        // 1. Listen for Revenue Changes
        const unsubRevenue = onSnapshot(revenueQuery, (snapshot) => {
            let total = 0;
            let count = 0;
            snapshot.forEach(doc => {
                const data = doc.data();
                total += (data.totalAmount || 0);
                count++;
            });
            setStoreTotal(total);
            setBillCount(count);
            setAverageBill(count > 0 ? total / count : 0);
            setLoading(false);
        }, (err) => {
            console.error("Revenue listener error:", err);
            setLoading(false);
        });

        // 2. Listen for Expenses (only if global/admin)
        let unsubExpenses = () => { };
        if (isGlobal || !stylistId) {
            const expensesQuery = query(
                collection(db, 'expenses'),
                where('date', '>=', today)
            );
            unsubExpenses = onSnapshot(expensesQuery, (snapshot) => {
                let total = 0;
                snapshot.forEach(doc => {
                    const data = doc.data();
                    total += parseFloat(data.amount || 0);
                });
                setExpensesTotal(total);
            });
        }

        return () => {
            unsubRevenue();
            unsubExpenses();
        };
    }, [stylistId, isGlobal]);

    useEffect(() => {
        setNetProfit(storeTotal - expensesTotal);
    }, [storeTotal, expensesTotal]);

    return { storeTotal, expensesTotal, netProfit, averageBill, billCount, loading };
}

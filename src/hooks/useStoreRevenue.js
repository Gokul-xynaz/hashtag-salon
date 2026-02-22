import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';

export function useStoreRevenue(stylistId = null, isGlobal = false) {
    const [storeTotal, setStoreTotal] = useState(0);
    const [cashTotal, setCashTotal] = useState(0);
    const [cardTotal, setCardTotal] = useState(0);
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
            setStoreTotal(0); setCashTotal(0); setCardTotal(0); setExpensesTotal(0); setNetProfit(0); setAverageBill(0); setBillCount(0);
            setLoading(false);
            return;
        }

        // 1. Listen for Revenue Changes
        const unsubRevenue = onSnapshot(revenueQuery, (snapshot) => {
            let total = 0;
            let cash = 0;
            let card = 0;
            let count = 0;
            snapshot.forEach(doc => {
                const data = doc.data();
                const amount = (data.totalAmount || 0);
                total += amount;

                if (data.paymentType === 'cash') {
                    cash += amount;
                } else if (data.paymentType === 'card') {
                    card += amount;
                }

                count++;
            });
            setStoreTotal(total);
            setCashTotal(cash);
            setCardTotal(card);
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
                let cashExp = 0;
                let cardExp = 0;
                snapshot.forEach(doc => {
                    const data = doc.data();
                    const amt = parseFloat(data.amount || 0);
                    total += amt;
                    if (data.method === 'cash') cashExp += amt;
                    if (data.method === 'card') cardExp += amt;
                });
                setExpensesTotal(total);
                setCashExpenses(cashExp); // New state to hold cash expenses temporarily
                setCardExpenses(cardExp); // New state to hold card expenses temporarily
            });
        }

        return () => {
            unsubRevenue();
            unsubExpenses();
        };
    }, [stylistId, isGlobal]);

    const [cashExpenses, setCashExpenses] = useState(0);
    const [cardExpenses, setCardExpenses] = useState(0);

    // Derived states based on raw revenue and categorized expenses
    const [finalCashTotal, setFinalCashTotal] = useState(0);
    const [finalCardTotal, setFinalCardTotal] = useState(0);

    useEffect(() => {
        setFinalCashTotal(cashTotal - cashExpenses);
        setFinalCardTotal(cardTotal - cardExpenses);
        setNetProfit(storeTotal - expensesTotal);
    }, [storeTotal, cashTotal, cardTotal, expensesTotal, cashExpenses, cardExpenses]);

    return { storeTotal, cashTotal: finalCashTotal, cardTotal: finalCardTotal, expensesTotal, netProfit, averageBill, billCount, loading };
}

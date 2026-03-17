import { useState, useEffect } from 'react';
import { addExpense } from '../../services/db';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';

export default function ExpenseTracker() {
    const { currentUser } = useAuth();
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [method, setMethod] = useState('cash');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    const [recentExpenses, setRecentExpenses] = useState([]);

    useEffect(() => {
        const q = query(
            collection(db, 'expenses'),
            orderBy('date', 'desc'),
            limit(50)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const expensesData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setRecentExpenses(expensesData);
        });

        return () => unsubscribe();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!amount || !description) return;

        setLoading(true);
        try {
            await addExpense({
                amount: parseFloat(amount),
                description,
                method,
                loggedBy: currentUser?.email || 'Unknown Admin'
            });
            setAmount('');
            setDescription('');
            setMethod('cash');
            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
        } catch (error) {
            console.error("Error adding expense:", error);
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (val) => {
        return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val || 0);
    };

    return (
        <div style={{ display: 'grid', gap: '2rem', gridTemplateColumns: 'minmax(300px, 1fr) minmax(300px, 2fr)' }}>
            <div className="card" style={{ alignSelf: 'start' }}>
                <h3 style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                    Log Expense
                </h3>

                {success && <div style={{ color: 'var(--success)', marginBottom: '1rem' }}>Expense logged successfully!</div>}

                <form onSubmit={handleSubmit} style={{ background: 'var(--bg-secondary)', padding: '2rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                    <div className="form-group">
                        <label className="form-label" style={{ fontSize: '0.65rem' }}>DESCRIPTION</label>
                        <input
                            type="text"
                            className="form-input"
                            placeholder="e.g. Electricity Bill, Cleaning Supplies"
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label" style={{ fontSize: '0.65rem' }}>AMOUNT (₹)</label>
                        <input
                            type="number"
                            step="0.01"
                            className="form-input"
                            placeholder="0.00"
                            value={amount}
                            onChange={e => setAmount(e.target.value)}
                            required
                        />
                    </div>

                    <div className="form-group" style={{ marginBottom: '2.5rem' }}>
                        <label className="form-label" style={{ fontSize: '0.65rem' }}>PAYMENT METHOD</label>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                            <button
                                type="button"
                                onClick={() => setMethod('cash')}
                                className={method === 'cash' ? 'btn-primary' : 'btn-outline'}
                                style={{ height: '3rem', fontSize: '0.75rem' }}
                            >
                                CASH
                            </button>
                            <button
                                type="button"
                                onClick={() => setMethod('card')}
                                className={method === 'card' ? 'btn-primary' : 'btn-outline'}
                                style={{ height: '3rem', fontSize: '0.75rem' }}
                            >
                                CARD / UPI
                            </button>
                        </div>
                    </div>
                    <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%', height: '4rem' }}>
                        {loading ? 'LOGGING...' : 'LOG TRANSACTION'}
                    </button>
                </form>
            </div>

            <div className="card animate-fade-in" style={{ alignSelf: 'start' }}>
                <h3 style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                    Recent Expenses
                </h3>
                {recentExpenses.length === 0 ? (
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>No recent expenses found.</p>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {recentExpenses.map(exp => (
                            <div key={exp.id} style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '1.25rem',
                                background: 'var(--bg-secondary)',
                                borderRadius: 'var(--radius-sm)',
                                borderLeft: `4px solid ${exp.method === 'cash' ? '#f59e0b' : '#3b82f6'}`
                            }}>
                                <div>
                                    <div style={{ fontWeight: '800', fontSize: '0.95rem' }}>{exp.description}</div>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.25rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                        <div style={{ display: 'flex', gap: '1rem' }}>
                                            <span>{exp.date ? exp.date.toDate().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'N/A'}</span>
                                            <span style={{ fontWeight: '700', color: exp.method === 'cash' ? '#f59e0b' : '#3b82f6' }}>{exp.method?.toUpperCase()}</span>
                                        </div>
                                        <div style={{ fontWeight: '600' }}>
                                            Logged By: <span style={{ color: 'var(--text-primary)' }}>{exp.loggedBy || 'System'}</span>
                                        </div>
                                    </div>
                                </div>
                                <div style={{ fontWeight: '900', color: 'var(--danger)', fontSize: '1.2rem' }}>
                                    -{formatCurrency(exp.amount)}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

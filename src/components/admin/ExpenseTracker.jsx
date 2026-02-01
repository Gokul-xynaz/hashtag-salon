import { useState } from 'react';
import { addExpense } from '../../services/db';

export default function ExpenseTracker() {
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!amount || !description) return;

        setLoading(true);
        try {
            await addExpense({
                amount: parseFloat(amount),
                description
            });
            setAmount('');
            setDescription('');
            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
        } catch (error) {
            console.error("Error adding expense:", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="card">
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
                <div className="form-group" style={{ marginBottom: '2.5rem' }}>
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
                <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%', height: '4rem' }}>
                    {loading ? 'LOGGING...' : 'LOG TRANSACTION'}
                </button>
            </form>
        </div>
    );
}

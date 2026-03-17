import { useState, useEffect } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await signInWithEmailAndPassword(auth, email, password);
            navigate('/');
        } catch (err) {
            console.error(err);
            setError('Invalid credentials.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '100vh',
            padding: '1.5rem',
            background: 'var(--bg-primary)'
        }}>
            <div className="animate-fade-in" style={{ width: '100%', maxWidth: '440px' }}>
                <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
                    <h1 style={{ fontSize: '3.5rem', letterSpacing: '0.4em', fontWeight: '900', margin: 0 }}>HASHTAG SALON</h1>
                    <div style={{ width: '40px', height: '2px', background: 'black', margin: '1rem auto' }}></div>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.2em' }}>Professional Billing Solution</p>
                </div>

                {error && <div style={{ color: 'var(--danger)', marginBottom: '2rem', fontSize: '0.85rem', textAlign: 'center', background: '#fff5f5', padding: '1rem', border: '1px solid #ffebeb', borderRadius: 'var(--radius-sm)' }}>{error}</div>}

                <div className="card" style={{ padding: '3rem 2.5rem' }}>
                    <form onSubmit={handleLogin}>
                        <div className="form-group">
                            <label className="form-label">ACCOUNT EMAIL</label>
                            <input
                                type="email"
                                className="form-input"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                placeholder="name@hashtagsalon.com"
                                style={{ height: '3.5rem' }}
                            />
                        </div>
                        <div className="form-group" style={{ marginBottom: '2.5rem' }}>
                            <label className="form-label">PASSWORD</label>
                            <input
                                type="password"
                                className="form-input"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                placeholder="••••••••"
                                style={{ height: '3.5rem' }}
                            />
                        </div>
                        <button type="submit" className="btn-primary" style={{ width: '100%', height: '4rem', fontSize: '1rem', borderRadius: 'var(--radius-sm)' }} disabled={loading}>
                            {loading ? 'AUTHENTICATING...' : 'ACCESS DASHBOARD'}
                        </button>
                    </form>
                </div>

                <p style={{ textAlign: 'center', marginTop: '2rem', fontSize: '0.7rem', color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>
                    &copy; {new Date().getFullYear()} HASHTAG SALON. ALL RIGHTS RESERVED.
                </p>
            </div>
        </div>
    );
}

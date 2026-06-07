import { useState, useEffect } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { auth } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const { currentUser } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (currentUser) {
            navigate('/');
        }
    }, [currentUser, navigate]);

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            // Add a 10 second timeout to prevent infinite loading if Firebase is blocked
            const loginPromise = signInWithEmailAndPassword(auth, email, password);
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('timeout')), 10000)
            );
            
            await Promise.race([loginPromise, timeoutPromise]);
            navigate('/');
        } catch (err) {
            console.error(err);
            if (err.message === 'timeout') {
                setError('Network timeout. Firebase is currently unreachable.');
            } else {
                setError('Invalid credentials.');
            }
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
            background: 'var(--bg-primary)',
            position: 'relative',
            overflow: 'hidden'
        }}>
            {/* Ambient gradient orbs */}
            <div style={{
                position: 'absolute',
                top: '-20%',
                right: '-10%',
                width: '600px',
                height: '600px',
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(0,0,0,0.02) 0%, transparent 70%)',
                pointerEvents: 'none'
            }} />
            <div style={{
                position: 'absolute',
                bottom: '-15%',
                left: '-10%',
                width: '500px',
                height: '500px',
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(0,0,0,0.015) 0%, transparent 70%)',
                pointerEvents: 'none'
            }} />

            <div className="animate-fade-in" style={{
                width: '100%',
                maxWidth: '420px',
                position: 'relative',
                zIndex: 1
            }}>
                {/* Brand Header */}
                <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
                    <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '56px',
                        height: '56px',
                        background: 'var(--primary)',
                        borderRadius: 'var(--radius-lg)',
                        marginBottom: '1.5rem',
                        boxShadow: 'var(--shadow-lg)'
                    }}>
                        <span style={{ color: 'white', fontSize: '1.5rem', fontWeight: '900', fontFamily: 'var(--font-heading)' }}>H</span>
                    </div>

                    <h1 style={{
                        fontSize: '2rem',
                        letterSpacing: '0.35em',
                        fontWeight: '900',
                        margin: '0 0 0.75rem 0',
                        lineHeight: 1
                    }}>
                        HASHTAG SALON
                    </h1>
                    <p style={{
                        color: 'var(--text-tertiary)',
                        fontSize: '0.7rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.2em',
                        margin: 0
                    }}>
                        Professional Billing System
                    </p>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="animate-fade-in" style={{
                        color: 'var(--danger)',
                        marginBottom: '1.5rem',
                        fontSize: '0.8rem',
                        textAlign: 'center',
                        background: 'var(--danger-muted)',
                        padding: '0.85rem 1rem',
                        border: '1px solid rgba(239, 68, 68, 0.15)',
                        borderRadius: 'var(--radius-md)',
                        fontWeight: '600'
                    }}>
                        {error}
                    </div>
                )}

                {/* Login Card */}
                <div style={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-xl)',
                    padding: '2.5rem 2rem',
                    boxShadow: 'var(--shadow-lg)'
                }}>
                    <form onSubmit={handleLogin}>
                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{
                                display: 'block',
                                marginBottom: '0.5rem',
                                color: 'var(--text-secondary)',
                                fontSize: '0.65rem',
                                textTransform: 'uppercase',
                                letterSpacing: '0.1em',
                                fontWeight: '700',
                                fontFamily: 'var(--font-heading)'
                            }}>
                                Email Address
                            </label>
                            <input
                                type="email"
                                className="form-input"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                placeholder="name@hashtagsalon.com"
                                style={{ height: '3rem', fontSize: '0.9rem' }}
                            />
                        </div>
                        <div style={{ marginBottom: '2rem' }}>
                            <label style={{
                                display: 'block',
                                marginBottom: '0.5rem',
                                color: 'var(--text-secondary)',
                                fontSize: '0.65rem',
                                textTransform: 'uppercase',
                                letterSpacing: '0.1em',
                                fontWeight: '700',
                                fontFamily: 'var(--font-heading)'
                            }}>
                                Password
                            </label>
                            <input
                                type="password"
                                className="form-input"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                placeholder="••••••••"
                                style={{ height: '3rem', fontSize: '0.9rem' }}
                            />
                        </div>
                        <button
                            type="submit"
                            className="btn-primary"
                            style={{
                                width: '100%',
                                height: '3.25rem',
                                fontSize: '0.8rem',
                                borderRadius: 'var(--radius-md)',
                                letterSpacing: '0.1em'
                            }}
                            disabled={loading}
                        >
                            {loading ? (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span style={{
                                        width: '14px',
                                        height: '14px',
                                        border: '2px solid rgba(255,255,255,0.3)',
                                        borderTopColor: 'white',
                                        borderRadius: '50%',
                                        animation: 'spin 0.6s linear infinite',
                                        display: 'inline-block'
                                    }} />
                                    AUTHENTICATING
                                </span>
                            ) : 'SIGN IN'}
                        </button>
                    </form>
                </div>

                {/* Footer */}
                <div style={{
                    textAlign: 'center',
                    marginTop: '2rem',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem'
                }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.75rem'
                    }}>
                        <p style={{
                            fontSize: '0.65rem',
                            color: 'var(--text-tertiary)',
                            letterSpacing: '0.05em',
                            margin: 0
                        }}>
                            &copy; {new Date().getFullYear()} HASHTAG SALON
                        </p>
                        <span style={{
                            background: 'var(--gray-150)',
                            color: 'var(--text-tertiary)',
                            fontSize: '0.55rem',
                            fontWeight: '800',
                            padding: '0.15rem 0.45rem',
                            borderRadius: 'var(--radius-full)',
                            letterSpacing: '0.05em',
                            fontFamily: 'var(--font-mono)'
                        }}>
                            v2.0
                        </span>
                    </div>
                    <p style={{
                        fontSize: '0.65rem',
                        color: 'var(--text-tertiary)',
                        letterSpacing: '0.05em',
                        margin: 0,
                        fontWeight: '500'
                    }}>
                        Developed by{' '}
                        <a href="https://yoursxyn.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: '700' }}>
                            XYN
                        </a>
                    </p>
                </div>
            </div>

            {/* Spinner keyframe */}
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
}

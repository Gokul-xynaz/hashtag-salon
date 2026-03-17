import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataProvider';

export default function ProtectedRoute({ children, allowedRoles }) {
    const { currentUser, userRole } = useAuth();
    const { isPremiumActive, trialDaysRemaining, loadingSettings } = useData();

    // If user is logged in but role hasn't loaded yet, show nothing or a loader
    if (currentUser && (userRole === null || loadingSettings)) {
        return (
            <div style={{
                height: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--bg-primary)',
                color: 'var(--text-secondary)',
                fontSize: '0.9rem',
                letterSpacing: '0.1em',
                textTransform: 'uppercase'
            }}>
                Validating Access...
            </div>
        );
    }

    if (!currentUser || userRole === 'unauthorized') {
        return <Navigate to="/login" replace />;
    }

    // Global Subcription Lockout
    if (!isPremiumActive && trialDaysRemaining <= 0) {
        return (
            <div style={{
                height: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                color: 'white',
                flexDirection: 'column',
                textAlign: 'center',
                padding: '2rem'
            }}>
                <div style={{ background: 'rgba(255,255,255,0.1)', padding: '1rem', borderRadius: '50%', marginBottom: '2rem' }}>
                    <span style={{ fontSize: '4rem' }}>🔒</span>
                </div>
                <h2 style={{ letterSpacing: '0.2em', fontSize: '2rem', marginBottom: '1rem' }}>SUBSCRIPTION EXPIRED</h2>
                <div style={{ background: 'var(--danger)', color: 'white', padding: '0.25rem 0.75rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '900', letterSpacing: '0.1em', marginBottom: '2rem' }}>YEARLY LICENSE REQUIRED</div>

                <p style={{ opacity: 0.8, maxWidth: '500px', margin: '0 auto 3rem', lineHeight: '1.6', fontSize: '1rem' }}>
                    Your 366-day subscription for **Hashtag Salon Billing** has concluded.
                    Please contact your developer to renew your license and restore access to the application.
                </p>

                <div style={{ background: 'rgba(255,255,255,0.05)', padding: '2rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.1)', width: '100%', maxWidth: '400px' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: '900', letterSpacing: '0.1em', color: 'var(--text-accent)', marginBottom: '1.5rem', textAlign: 'left' }}>CONTACT DEVELOPER</div>
                    <div style={{ textAlign: 'left', marginBottom: '1.5rem' }}>
                        <div style={{ fontSize: '1.1rem', fontWeight: '700' }}>Gokul (Developer)</div>
                        <div style={{ fontSize: '0.9rem', opacity: 0.7, marginTop: '0.5rem' }}>+91 9629180431</div>
                        <div style={{ fontSize: '0.9rem', opacity: 0.7 }}>yoursxyn@gmail.com</div>
                    </div>
                    <button
                        onClick={() => window.open('https://wa.me/919629180431', '_blank')}
                        style={{ width: '100%', height: '3.5rem', background: '#25D366', color: 'white', border: 'none', borderRadius: '4px', fontWeight: '800', cursor: 'pointer', letterSpacing: '0.1em' }}
                    >
                        WHATSAPP DEVELOPER
                    </button>
                    <button
                        onClick={async () => {
                            const { signOut } = await import('firebase/auth');
                            const { auth } = await import('../../services/firebase');
                            await signOut(auth);
                        }}
                        style={{ width: '100%', height: '3.5rem', background: 'transparent', color: 'var(--text-secondary)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '4px', fontWeight: '800', cursor: 'pointer', letterSpacing: '0.1em', marginTop: '1rem' }}
                    >
                        LOGOUT
                    </button>
                </div>
            </div>
        );
    }

    // If roles are specified, check if user has permission
    if (allowedRoles && !allowedRoles.includes(userRole)) {
        return <Navigate to="/" replace />;
    }

    return children;
}

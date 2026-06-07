import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function ProtectedRoute({ children, allowedRoles, requiredPermission }) {
    const { currentUser, userRole, userPermissions } = useAuth();

    // If user is logged in but role hasn't loaded yet, show nothing or a loader
    if (currentUser && userRole === null) {
        return (
            <div style={{
                height: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#f9fafb',
                flexDirection: 'column',
                gap: '1rem'
            }}>
                <div style={{
                    width: '36px', height: '36px', border: '3px solid #e5e7eb',
                    borderTop: '3px solid #0d9488', borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite'
                }} />
                <span style={{ color: '#6b7280', fontSize: '0.85rem', fontWeight: '600', letterSpacing: '0.04em' }}>
                    Validating Access...
                </span>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    if (!currentUser || userRole === 'unauthorized' || userRole === 'error') {
        return <Navigate to="/login" replace />;
    }

    // If roles are specified, check if user has permission
    // Check granular permission if required
    if (requiredPermission && userPermissions && userPermissions[requiredPermission] === false) {
        return (
            <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9fafb', flexDirection: 'column', gap: '1rem', textAlign: 'center', padding: '2rem' }}>
                <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.75" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                </div>
                <div>
                    <h2 style={{ margin: '0 0 0.25rem', fontSize: '1.25rem', fontWeight: '800', color: '#111827' }}>Permission Denied</h2>
                    <p style={{ margin: '0 0 1.25rem', color: '#6b7280', fontSize: '0.875rem' }}>You don&apos;t have access to this module. Ask your admin to enable it.</p>
                </div>
                <a href="/v2/dashboard" style={{ padding: '0.6rem 1.5rem', background: '#0d9488', color: 'white', borderRadius: '10px', textDecoration: 'none', fontWeight: '700', fontSize: '0.85rem' }}>Go to Dashboard</a>
            </div>
        );
    }

    if (allowedRoles && !allowedRoles.includes(userRole)) {
        // Redirect stylists to their dashboard, admins to theirs
        const redirectPath = userRole === 'stylist' ? '/v2/dashboard' : '/';
        return (
            <div style={{
                height: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#f9fafb',
                flexDirection: 'column',
                gap: '1rem',
                textAlign: 'center',
                padding: '2rem'
            }}>
                <div style={{
                    width: '56px', height: '56px', borderRadius: '16px',
                    background: '#fef2f2', display: 'flex', alignItems: 'center',
                    justifyContent: 'center'
                }}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.75" strokeLinecap="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                </div>
                <div>
                    <h2 style={{ margin: '0 0 0.25rem', fontSize: '1.25rem', fontWeight: '800', color: '#111827' }}>Access Restricted</h2>
                    <p style={{ margin: '0 0 1.25rem', color: '#6b7280', fontSize: '0.875rem' }}>
                        You don't have permission to view this page.
                    </p>
                </div>
                <a href={redirectPath}
                   style={{
                       padding: '0.6rem 1.5rem', background: '#0d9488', color: 'white',
                       borderRadius: '10px', textDecoration: 'none', fontWeight: '700',
                       fontSize: '0.85rem', transition: 'background 0.15s'
                   }}
                >
                    Go to Dashboard
                </a>
            </div>
        );
    }

    return children;
}

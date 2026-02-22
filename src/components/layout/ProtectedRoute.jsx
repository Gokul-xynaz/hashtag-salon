import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function ProtectedRoute({ children, allowedRoles }) {
    const { currentUser, userRole } = useAuth();

    // If user is logged in but role hasn't loaded yet, show nothing or a loader
    if (currentUser && userRole === null) {
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

    // If roles are specified, check if user has permission
    if (allowedRoles && !allowedRoles.includes(userRole)) {
        return <Navigate to="/" replace />;
    }

    return children;
}

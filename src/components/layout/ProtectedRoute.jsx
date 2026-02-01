import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function ProtectedRoute({ children, allowedRoles }) {
    const { currentUser, userRole } = useAuth();

    if (!currentUser || userRole === 'unauthorized') {
        return <Navigate to="/login" replace />;
    }

    // If roles are specified, check if user has permission
    if (allowedRoles && !allowedRoles.includes(userRole)) {
        return <Navigate to="/" replace />;
    }

    return children;
}

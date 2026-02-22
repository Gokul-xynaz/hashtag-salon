import { useAuth } from '../context/AuthContext';
import AdminDashboard from './AdminDashboard';
import StylistDashboard from './StylistDashboard';

export default function Dashboard() {
    const { userRole } = useAuth();

    const normalizedRole = userRole?.toLowerCase();

    if (normalizedRole === 'admin') {
        return <AdminDashboard />;
    } else if (normalizedRole === 'stylist') {
        return <StylistDashboard />;
    } else {
        return <div className="container">Loading user profile...</div>;
    }
}

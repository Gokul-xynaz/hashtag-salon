import { useAuth } from '../context/AuthContext';
import AdminDashboard from './AdminDashboard';
import StylistDashboard from './StylistDashboard';

export default function Dashboard() {
    const { userRole } = useAuth();

    if (userRole === 'admin') {
        return <AdminDashboard />;
    } else if (userRole === 'stylist') {
        return <StylistDashboard />;
    } else {
        return <div className="container">Loading user profile...</div>;
    }
}

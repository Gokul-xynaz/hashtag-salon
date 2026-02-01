import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function AdminLayout({ children }) {
    const { logout } = useAuth();
    const navigate = useNavigate();

    return (
        <div className="container">
            <header style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '4rem',
                position: 'sticky',
                top: 0,
                background: 'var(--bg-primary)',
                zIndex: 100,
                padding: '1rem 0'
            }}>
                <h1
                    onClick={() => navigate('/')}
                    style={{ margin: 0, fontSize: '1.5rem', letterSpacing: '0.2em', cursor: 'pointer' }}
                >
                    ADMIN PORTAL
                </h1>
                <button className="btn-danger" onClick={logout} style={{ height: '2.5rem', fontSize: '0.7rem' }}>LOGOUT</button>
            </header>
            <main className="animate-fade-in">
                {children}
            </main>
        </div>
    );
}

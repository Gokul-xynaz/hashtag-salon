import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function AdminLayout({ children }) {
    const { logout } = useAuth();
    const navigate = useNavigate();

    return (
        <div className="container">
            <header className="responsive-header" style={{ paddingTop: '2rem' }}>
                <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.25rem' }}>ADMINISTRATION</p>
                    <h1
                        onClick={() => navigate('/')}
                        style={{ margin: 0, fontSize: '2rem', cursor: 'pointer', fontWeight: '900', letterSpacing: '0.05em' }}
                    >
                        PORTAL
                    </h1>
                </div>
                <div className="responsive-header-actions">
                    <button className="btn-danger" onClick={logout} style={{ height: '3rem', padding: '0 2rem' }}>LOGOUT</button>
                </div>
            </header>
            <main className="animate-fade-in">
                {children}
            </main>
        </div>
    );
}

import Sidebar from './Sidebar';
import Header from './Header';
import '../theme/salonist.css'; // Import the isolated V2 theme

export default function Layout({ children }) {
    return (
        <div className="v2-theme v2-layout-wrapper">
            <Sidebar />
            <div className="v2-main-content">
                <Header />
                <main className="v2-page-container">
                    {children}
                </main>
            </div>
        </div>
    );
}

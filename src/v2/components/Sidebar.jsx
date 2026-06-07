import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataProvider';

/* ─── SVG Icon Library ───────────────────────────────────────────────── */
const Icon = ({ d, size = 16, stroke = 'currentColor', fill = 'none', viewBox = '0 0 24 24', strokeWidth = 1.75 }) => (
    <svg width={size} height={size} viewBox={viewBox} fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
        {Array.isArray(d) ? d.map((path, i) => <path key={i} d={path} />) : <path d={d} />}
    </svg>
);

const Icons = {
    dashboard:    <Icon d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
    calendar:     <Icon d={['M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z']} />,
    appointments: <Icon d={['M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z', 'M14 2v6h6M16 13H8M16 17H8M10 9H8']} />,
    quicksale:    <Icon d={['M20 12V22H4V12', 'M22 7H2v5h20V7z', 'M12 22V7', 'M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z', 'M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z']} />,
    expenses:     <Icon d={['M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z', 'M12 6v6l4 2']} />,
    reports:      <Icon d={['M18 20V10', 'M12 20V4', 'M6 20v-6']} />,
    customers:    <Icon d={['M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2', 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M23 21v-2a4 4 0 0 0-3-3.87', 'M16 3.13a4 4 0 0 1 0 7.75']} />,
    marketing:    <Icon d={['M22 12h-4l-3 9L9 3l-3 9H2']} />,
    promotions:   <Icon d={['M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z', 'M7 7h.01']} />,
    inventory:    <Icon d={['M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z', 'M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12']} />,
    suppliers:    <Icon d={['M1 3h15v13H1z', 'M16 8h4l3 3v5h-7V8z', 'M5.5 21a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z', 'M18.5 21a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z']} />,
    settings:     <Icon d={['M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', 'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z']} />,
    staff:        <Icon d={['M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2', 'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z']} />,
    schedule:     <Icon d={['M12 20h9', 'M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z']} />,
    commissions:  <Icon d={['M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6']} />,
    business:     <Icon d={['M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z', 'M9 22V12h6v10']} />,
    services:     <Icon d="M 4 4 L 20 4 L 20 20 L 4 20 Z M 8 2 L 8 6 M 16 2 L 16 6 M 8 18 L 8 22 M 16 18 L 16 22 M 2 8 L 6 8 M 18 8 L 22 8 M 2 16 L 6 16 M 18 16 L 22 16" />,
    packages:     <Icon d={['M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z']} />,
    memberships:  <Icon d={['M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z']} />,
    integration:  <Icon d={['M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6', 'M15 3h6v6', 'M10 14L21 3']} />,
    logout:       <Icon d={['M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4', 'M16 17l5-5-5-5', 'M21 12H9']} />,
    chevron:      <Icon d="M9 18l6-6-6-6" size={14} />,
};

/* ─── Menu Structure ─────────────────────────────────────────────────── */
const MENU_STRUCTURE = [
    {
        label: 'Operations',
        items: [
            { path: '/v2/dashboard',    icon: Icons.dashboard,    label: 'Dashboard',            perm: 'acc_home' },
            { path: '/v2/calendar',     icon: Icons.calendar,     label: 'Calendar',             perm: 'acc_staff_calendar' },
            { path: '/v2/appointments', icon: Icons.appointments, label: 'Appointments Ledger',  perm: 'acc_appointment' },
        ]
    },
    {
        label: 'Sales & Finance',
        items: [
            { path: '/v2/pos',      icon: Icons.quicksale, label: 'Quick Sale',      perm: 'acc_quicksale' },
            { path: '/v2/expenses', icon: Icons.expenses,  label: 'Store Expenses',  perm: 'acc_expenditure' },
            { path: '/v2/reports',  icon: Icons.reports,   label: 'Reports',         perm: 'acc_reports' },
        ]
    },
    {
        label: 'CRM & Marketing',
        items: [
            { path: '/v2/customers',   icon: Icons.customers,  label: 'Customers',              perm: 'acc_clients' },
            { path: '/v2/marketing',   icon: Icons.marketing,  label: 'Marketing Campaigns',    perm: 'acc_notifications' },
            { path: '/v2/promotions',  icon: Icons.promotions, label: 'Promotions & Gift Cards', perm: 'acc_notifications' },
        ]
    },
    {
        label: 'Stock & Inventory',
        items: [
            { path: '/v2/inventory',          icon: Icons.inventory, label: 'Products',           perm: 'acc_products' },
            { path: '/v2/inventory/suppliers', icon: Icons.suppliers, label: 'Suppliers',          perm: 'acc_warehouse' },
            { path: '/v2/inventory/settings',  icon: Icons.settings,  label: 'Inventory Settings', perm: 'acc_warehouse' },
        ]
    },
    {
        label: 'Team & Staff',
        items: [
            { path: '/v2/staff',             icon: Icons.staff,       label: 'Manage Staff',     perm: 'acc_custom_fields' },
            { path: '/v2/staff/schedule',    icon: Icons.schedule,    label: 'Scheduled Shifts', perm: 'acc_booking_setting' },
            { path: '/v2/staff/commissions', icon: Icons.commissions, label: 'Commissions',      perm: 'acc_reports' },
        ]
    },
    {
        label: 'Catalogue & Setup',
        items: [
            { path: '/v2/catalogue/business',         icon: Icons.business,     label: 'Business Details',    perm: 'acc_booking_setting' },
            { path: '/v2/catalogue/services',         icon: Icons.services,     label: 'Services',            perm: 'acc_products' },
            { path: '/v2/catalogue/packages',         icon: Icons.packages,     label: 'Packages',            perm: 'acc_products' },
            { path: '/v2/catalogue/memberships',      icon: Icons.memberships,  label: 'Memberships',         perm: 'acc_products' },
            { path: '/v2/catalogue/calendar-settings', icon: Icons.calendar,   label: 'Calendar Settings',   perm: 'acc_booking_setting' },
            { path: '/v2/settings/integrations',      icon: Icons.integration,  label: 'Integrations',        perm: 'acc_integration' },
        ]
    },
    {
        label: 'System & Admin',
        items: [
            { path: '/v2/invoice-editor', icon: Icons.settings, label: 'Secure Invoice Editor', perm: 'admin_only' },
            { path: '/v2/system-logs', icon: Icons.settings, label: 'System Error Logs', perm: 'admin_only' }
        ]
    }
];

/* ─── Default Stylist Permissions ────────────────────────────────────── */
const DEFAULT_STYLIST_PERMS = {
    acc_home:          true,
    acc_staff_calendar: true,
    acc_appointment:   true,
    acc_quicksale:     true,
    acc_expenditure:   true,
    acc_clients:       true,
};

/* ─── Sidebar Component ──────────────────────────────────────────────── */
export default function Sidebar() {
    const { logout, userRole, userPermissions } = useAuth();
    const { settings } = useData();
    const navigate = useNavigate();

    const perms = {
        ...(userRole === 'stylist' ? DEFAULT_STYLIST_PERMS : {}),
        ...(userPermissions || {})
    };

    const filteredMenu = MENU_STRUCTURE.map(group => {
        const filteredItems = group.items.filter(item => {
            if (userRole === 'admin') return true;
            return perms[item.perm] === true;
        });
        return { ...group, items: filteredItems };
    }).filter(group => group.items.length > 0);

    return (
        <>
            <style>{`
                @keyframes slideIn {
                    from { opacity: 0; transform: translateX(-8px); }
                    to   { opacity: 1; transform: translateX(0); }
                }
                .v2-nav-item-link {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    padding: 0.55rem 0.85rem;
                    border-radius: 8px;
                    text-decoration: none;
                    color: rgba(255,255,255,0.55);
                    font-size: 0.82rem;
                    font-weight: 500;
                    transition: all 0.18s ease;
                    position: relative;
                    cursor: pointer;
                    border: none;
                    background: transparent;
                    width: 100%;
                    text-align: left;
                    line-height: 1;
                    letter-spacing: 0.01em;
                }
                .v2-nav-item-link:hover {
                    color: rgba(255,255,255,0.9);
                    background: rgba(255,255,255,0.07);
                }
                .v2-nav-item-link.active {
                    color: #ffffff;
                    background: rgba(13,148,136,0.25);
                    font-weight: 600;
                }
                .v2-nav-item-link.active::before {
                    content: '';
                    position: absolute;
                    left: 0;
                    top: 20%;
                    bottom: 20%;
                    width: 3px;
                    background: #0d9488;
                    border-radius: 0 3px 3px 0;
                    margin-left: -0.85rem;
                }
                .v2-nav-item-link svg {
                    opacity: 0.6;
                    transition: opacity 0.18s ease;
                    flex-shrink: 0;
                }
                .v2-nav-item-link:hover svg,
                .v2-nav-item-link.active svg {
                    opacity: 1;
                }
                .v2-sidebar-group {
                    animation: slideIn 0.3s ease both;
                }
                .v2-sidebar-group-label {
                    padding: 1.1rem 0.85rem 0.4rem;
                    font-size: 0.6rem;
                    text-transform: uppercase;
                    color: rgba(255,255,255,0.25);
                    letter-spacing: 0.12em;
                    font-weight: 800;
                }
                .v2-sidebar-scroll::-webkit-scrollbar {
                    width: 3px;
                }
                .v2-sidebar-scroll::-webkit-scrollbar-track {
                    background: transparent;
                }
                .v2-sidebar-scroll::-webkit-scrollbar-thumb {
                    background: rgba(255,255,255,0.1);
                    border-radius: 99px;
                }
                .v2-user-chip {
                    display: flex;
                    align-items: center;
                    gap: 0.65rem;
                    padding: 0.6rem 0.85rem;
                    border-radius: 8px;
                    background: rgba(255,255,255,0.05);
                    margin-bottom: 0.5rem;
                }
                .v2-logout-btn {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    padding: 0.55rem 0.85rem;
                    border-radius: 8px;
                    color: rgba(255,255,255,0.45);
                    font-size: 0.82rem;
                    font-weight: 500;
                    cursor: pointer;
                    border: none;
                    background: transparent;
                    width: 100%;
                    text-align: left;
                    transition: all 0.18s ease;
                }
                .v2-logout-btn:hover {
                    color: #ef4444;
                    background: rgba(239, 68, 68, 0.1);
                }
                .v2-logout-btn:hover svg {
                    color: #ef4444;
                }
            `}</style>

            <aside className="v2-sidebar" style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
                {/* Brand */}
                <div style={{ height: '64px', display: 'flex', alignItems: 'center', padding: '0 1rem', gap: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
                    <img src={settings?.logoUrl || "/logo.png"} alt="Logo" style={{ width: '34px', height: '34px', borderRadius: '10px', objectFit: 'cover', flexShrink: 0, boxShadow: '0 4px 12px rgba(13,148,136,0.4)' }} />
                    <div style={{ overflow: 'hidden' }}>
                        <div style={{ fontWeight: '800', fontSize: '0.9rem', color: '#ffffff', lineHeight: 1.2, letterSpacing: '-0.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{settings?.businessName || 'Hashtag Salon'}</div>
                        <div style={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.3)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Management</div>
                    </div>
                    <div style={{ marginLeft: 'auto', fontSize: '0.55rem', background: 'rgba(13,148,136,0.25)', color: '#0d9488', padding: '3px 7px', borderRadius: '6px', fontWeight: '700', letterSpacing: '0.05em', border: '1px solid rgba(13,148,136,0.3)' }}>PRO</div>
                </div>

                {/* Nav */}
                <nav className="v2-sidebar-scroll" style={{ flex: 1, overflowY: 'auto', padding: '0.5rem 0.65rem', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    {filteredMenu.map((group, gi) => (
                        <div key={group.label} className="v2-sidebar-group" style={{ animationDelay: `${gi * 0.04}s` }}>
                            <div className="v2-sidebar-group-label">{group.label}</div>
                            {group.items.map((item) => (
                                <NavLink
                                    key={item.path}
                                    to={item.path}
                                    end={item.path === '/v2/dashboard'}
                                    className={({ isActive }) => `v2-nav-item-link ${isActive ? 'active' : ''}`}
                                >
                                    {item.icon}
                                    <span style={{ flex: 1 }}>{item.label}</span>
                                </NavLink>
                            ))}
                        </div>
                    ))}
                </nav>

                {/* Footer */}
                <div style={{ padding: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
                    <div className="v2-user-chip" onClick={() => navigate('/v2/catalogue/business')} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer', transition: 'all 0.2s ease' }} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.transform = 'translateY(-2px)'; }} onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.transform = 'translateY(0)'; }}>
                        <img src={settings?.logoUrl || "/logo.png"} alt="Logo" style={{ width: '40px', height: '40px', borderRadius: '10px', objectFit: 'cover', flexShrink: 0, boxShadow: '0 4px 12px rgba(13,148,136,0.4)' }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: '700', fontSize: '0.85rem', color: '#ffffff', marginBottom: '0.1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{settings?.businessName || 'Business Settings'}</div>
                            <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: '500' }}>Manage Business</div>
                        </div>
                    </div>
                    <button onClick={logout} className="v2-logout-btn" style={{ marginTop: '0.5rem', width: '100%', padding: '0.75rem', background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: '10px', color: 'rgba(255,255,255,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', cursor: 'pointer', transition: 'all 0.2s ease', fontWeight: '600', fontSize: '0.8rem' }} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.style.color = '#ef4444'; }} onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'rgba(255,255,255,0.6)'; }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                        <span>Sign Out</span>
                    </button>
                    <div style={{ textAlign: 'center', marginTop: '0.75rem', fontSize: '0.62rem', color: 'rgba(255,255,255,0.3)', fontWeight: '500', letterSpacing: '0.02em' }}>
                        Powered by{' '}
                        <a href="https://yoursxyn.com" target="_blank" rel="noopener noreferrer" style={{ color: '#10b981', textDecoration: 'none', fontWeight: '700', transition: 'color 0.15s ease' }} onMouseEnter={e => e.currentTarget.style.color = '#059669'} onMouseLeave={e => e.currentTarget.style.color = '#10b981'}>
                            XYN
                        </a>
                    </div>
                </div>
            </aside>
        </>
    );
}

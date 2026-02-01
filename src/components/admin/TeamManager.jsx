import { useState, useEffect } from 'react';
import { collection, getDocs, doc, updateDoc, setDoc, Timestamp, deleteDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useData } from '../../context/DataProvider';

export default function TeamManager() {
    const [users, setUsers] = useState([]);
    const { services } = useData();
    const [loading, setLoading] = useState(true);
    const [selectedUser, setSelectedUser] = useState(null); // The user being edited
    const [tempAllowed, setTempAllowed] = useState([]); // Temporary state for checkboxes

    // New Stylist Form
    const [newStylist, setNewStylist] = useState({ name: '', email: '' });
    const [creating, setCreating] = useState(false);
    const [showAddForm, setShowAddForm] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch Users
            const usersSnap = await getDocs(collection(db, 'users'));
            const usersList = [];
            usersSnap.forEach(doc => usersList.push({ id: doc.id, ...doc.data() }));

            setUsers(usersList.filter(u => !u.isKiosk));
        } catch (error) {
            console.error("Error loading data:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (user) => {
        setSelectedUser(user);
        setTempAllowed(user.allowedServices || []);
    };

    const toggleService = (serviceId) => {
        if (tempAllowed.includes(serviceId)) {
            setTempAllowed(tempAllowed.filter(id => id !== serviceId));
        } else {
            setTempAllowed([...tempAllowed, serviceId]);
        }
    };

    const savePermissions = async () => {
        if (!selectedUser) return;
        try {
            const userRef = doc(db, 'users', selectedUser.id);
            await updateDoc(userRef, {
                allowedServices: tempAllowed
            });
            alert(`Updated permissions for ${selectedUser.name || selectedUser.email}`);
            setSelectedUser(null);
            fetchData(); // Refresh list
        } catch (error) {
            console.error("Error updating user:", error);
            alert("Failed to update.");
        }
    };

    const deleteStylist = async (id, name) => {
        if (!window.confirm(`Are you sure you want to remove ${name}?`)) return;
        try {
            await deleteDoc(doc(db, 'users', id));
            alert('Profile removed.');
            fetchData();
        } catch (err) {
            console.error(err);
            alert('Failed to delete.');
        }
    };

    const createStylist = async (e) => {
        e.preventDefault();
        if (!newStylist.name || !newStylist.email) return;
        setCreating(true);
        try {
            const id = newStylist.email.replace(/[.@]/g, '_') + '_' + Date.now();
            await setDoc(doc(db, 'users', id), {
                name: newStylist.name,
                email: newStylist.email,
                role: 'stylist',
                allowedServices: [],
                createdAt: Timestamp.now()
            });
            alert('Stylist profile created!');
            setNewStylist({ name: '', email: '' });
            setShowAddForm(false);
            fetchData();
        } catch (err) {
            console.error(err);
            alert('Failed to create profile.');
        } finally {
            setCreating(false);
        }
    };

    if (loading) return <div className="container">Loading Team Data...</div>;

    return (
        <div className="card" style={{ padding: '2.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1.5rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.2rem', letterSpacing: '0.1em' }}>TEAM & ACCESS CONTROL</h3>
                <button
                    onClick={() => setShowAddForm(!showAddForm)}
                    className={showAddForm ? "btn-danger" : "btn-primary"}
                    style={{ height: '3rem', padding: '0 2rem', fontSize: '0.8rem' }}
                >
                    {showAddForm ? 'CANCEL' : '+ REGISTER STYLIST'}
                </button>
            </div>

            {showAddForm && (
                <div style={{ background: 'var(--bg-secondary)', padding: '2.5rem', borderRadius: 'var(--radius-sm)', marginBottom: '3rem', border: '1px solid var(--border-color)' }} className="animate-fade-in">
                    <h4 style={{ marginBottom: '1.5rem', fontSize: '0.9rem', letterSpacing: '0.05em' }}>NEW STYLIST REGISTRATION</h4>
                    <form onSubmit={createStylist}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '1.5rem', alignItems: 'end' }}>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">FULL NAME</label>
                                <input className="form-input" value={newStylist.name} onChange={e => setNewStylist({ ...newStylist, name: e.target.value })} placeholder="John Doe" required />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">EMAIL ADDRESS</label>
                                <input className="form-input" type="email" value={newStylist.email} onChange={e => setNewStylist({ ...newStylist, email: e.target.value })} placeholder="john@sotastudio.com" required />
                            </div>
                            <button type="submit" className="btn-primary" style={{ height: '3.5rem' }} disabled={creating}>
                                {creating ? 'SAVING...' : 'CREATE PROFILE'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* List of Users */}
            {!selectedUser && (
                <div className="animate-fade-in">
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--text-primary)' }}>
                                <th style={{ padding: '1rem', fontSize: '0.7rem', letterSpacing: '0.15em' }}>NAME & IDENTITY</th>
                                <th style={{ padding: '1rem', fontSize: '0.7rem', letterSpacing: '0.15em' }}>ACCESS ROLE</th>
                                <th style={{ padding: '1rem', textAlign: 'right', fontSize: '0.7rem', letterSpacing: '0.15em' }}>COMMANDS</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map(user => (
                                <tr key={user.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                    <td style={{ padding: '1.5rem 1rem' }}>
                                        <div style={{ fontWeight: '800', fontSize: '1.1rem' }}>{user.name || 'Unknown'}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>{(user.email || '').toUpperCase()}</div>
                                    </td>
                                    <td style={{ padding: '1.5rem 1rem' }}>
                                        <span style={{ fontSize: '0.7rem', padding: '0.4rem 0.8rem', background: (user.role || 'stylist') === 'admin' ? 'black' : 'var(--bg-secondary)', color: (user.role || 'stylist') === 'admin' ? 'white' : 'var(--text-primary)', borderRadius: 'var(--radius-sm)', fontWeight: '800' }}>
                                            {(user.role || 'stylist').toUpperCase()}
                                        </span>
                                    </td>
                                    <td style={{ padding: '1.5rem 1rem', textAlign: 'right' }}>
                                        <div style={{ display: 'flex', gap: '1.5rem', justifyContent: 'flex-end' }}>
                                            <button
                                                onClick={() => handleEdit(user)}
                                                style={{ color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: '800', fontSize: '0.7rem' }}
                                            >
                                                EDIT SERVICES
                                            </button>
                                            <button
                                                onClick={() => deleteStylist(user.id, user.name)}
                                                style={{ color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: '800', fontSize: '0.7rem' }}
                                            >
                                                REMOVE
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Edit Mode */}
            {selectedUser && (
                <div className="animate-fade-in">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
                        <div>
                            <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>MODIFY PERMISSIONS</p>
                            <h4 style={{ margin: 0, fontSize: '1.5rem' }}>{selectedUser.name}</h4>
                        </div>
                        <button onClick={() => setSelectedUser(null)} className="btn-outline" style={{ height: '2.5rem', fontSize: '0.7rem' }}>
                            CANCEL
                        </button>
                    </div>

                    <p style={{ fontSize: '0.85rem', marginBottom: '2rem', color: 'var(--text-secondary)' }}>
                        Determine the scope of services available for this stylist profile.
                    </p>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem', marginBottom: '3rem' }}>
                        {services.map(service => {
                            const checked = tempAllowed.includes(service.id);
                            return (
                                <div
                                    key={service.id}
                                    onClick={() => toggleService(service.id)}
                                    style={{
                                        padding: '1.25rem',
                                        border: '1px solid var(--border-color)',
                                        borderColor: checked ? 'var(--primary)' : 'var(--border-color)',
                                        background: checked ? 'var(--bg-secondary)' : 'white',
                                        borderRadius: 'var(--radius-sm)',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        transition: 'all 0.2s',
                                        boxShadow: checked ? 'var(--shadow-sm)' : 'none'
                                    }}
                                >
                                    <div style={{
                                        width: '18px',
                                        height: '18px',
                                        border: '2px solid var(--primary)',
                                        marginRight: '1rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        background: checked ? 'var(--primary)' : 'transparent',
                                        borderRadius: '2px'
                                    }}>
                                        {checked && <div style={{ width: '8px', height: '8px', background: 'white', borderRadius: '1px' }}></div>}
                                    </div>
                                    <span style={{ fontWeight: '700', fontSize: '0.9rem' }}>{service.name}</span>
                                </div>
                            );
                        })}
                    </div>

                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <button className="btn-primary" style={{ padding: '0 3rem' }} onClick={savePermissions}>
                            SAVE PERMISSIONS
                        </button>
                        <button
                            className="btn-outline"
                            onClick={() => setTempAllowed(services.map(s => s.id))}
                        >
                            SELECT ALL
                        </button>
                        <button
                            className="btn-outline"
                            onClick={() => setTempAllowed([])}
                        >
                            CLEAR ALL
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

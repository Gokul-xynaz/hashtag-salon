import { useState, useEffect } from 'react';
import { getServices, addService, updateService, deleteService } from '../../services/db';

export default function ServiceManager() {
    const [services, setServices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [formData, setFormData] = useState({ name: '', price: '' });
    const [editingId, setEditingId] = useState(null);

    useEffect(() => {
        fetchServices();
    }, []);

    const fetchServices = async () => {
        setLoading(true);
        try {
            const data = await getServices();
            setServices(data);
        } catch (error) {
            console.error("Error loading services:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.name || !formData.price) return;

        try {
            const payload = {
                name: formData.name,
                price: parseFloat(formData.price)
            };

            if (editingId) {
                await updateService(editingId, payload);
            } else {
                await addService(payload);
            }

            setFormData({ name: '', price: '' });
            setEditingId(null);
            fetchServices();
        } catch (error) {
            console.error("Error saving service:", error);
        }
    };

    const handleEdit = (service) => {
        setFormData({ name: service.name, price: service.price });
        setEditingId(service.id);
    };

    const handleDelete = async (id) => {
        if (confirm('Are you sure you want to delete this service?')) {
            await deleteService(id);
            fetchServices();
        }
    };

    return (
        <div className="card" style={{ padding: '2.5rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.2rem', letterSpacing: '0.1em', marginBottom: '2.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1.5rem' }}>
                CATALOGUE MANAGEMENT
            </h3>

            <p style={{ fontSize: '0.85rem', marginBottom: '2rem', color: 'var(--text-secondary)' }}>
                Define your studio's offerings and pricing models.
            </p>

            <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '1.5rem', marginBottom: '3rem', background: 'var(--bg-secondary)', padding: '2rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.65rem' }}>SERVICE NAME</label>
                    <input
                        type="text"
                        placeholder="e.g., Signature Haircut"
                        className="form-input"
                        value={formData.name}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                        required
                    />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.65rem' }}>PRICE (INR)</label>
                    <input
                        type="number"
                        placeholder="0.00"
                        step="1"
                        className="form-input"
                        value={formData.price}
                        onChange={e => setFormData({ ...formData, price: e.target.value })}
                        required
                    />
                </div>
                <button type="submit" className="btn-primary" style={{ height: '3.5rem', alignSelf: 'end' }}>
                    {editingId ? 'UPDATE SERVICE' : '+ ADD SERVICE'}
                </button>
            </form>

            {loading ? (
                <p style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-secondary)', letterSpacing: '0.1em' }}>SYNCHRONIZING CATALOGUE...</p>
            ) : (
                <div className="animate-fade-in">
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--text-primary)' }}>
                                <th style={{ padding: '1rem', fontSize: '0.7rem', letterSpacing: '0.15em' }}>SERVICE DESCRIPTION</th>
                                <th style={{ padding: '1rem', fontSize: '0.7rem', letterSpacing: '0.15em' }}>RATE</th>
                                <th style={{ padding: '1rem', textAlign: 'right', fontSize: '0.7rem', letterSpacing: '0.15em' }}>COMMANDS</th>
                            </tr>
                        </thead>
                        <tbody>
                            {services.map(service => (
                                <tr key={service.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                    <td style={{ padding: '1.5rem 1rem' }}>
                                        <div style={{ fontWeight: '800', fontSize: '1rem' }}>{service.name.toUpperCase()}</div>
                                    </td>
                                    <td style={{ padding: '1.5rem 1rem' }}>
                                        <span style={{ fontWeight: '700', fontSize: '1rem' }}>
                                            {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(service.price)}
                                        </span>
                                    </td>
                                    <td style={{ padding: '1.5rem 1rem', textAlign: 'right' }}>
                                        <div style={{ display: 'flex', gap: '1.5rem', justifyContent: 'flex-end' }}>
                                            <button
                                                onClick={() => handleEdit(service)}
                                                style={{ color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: '800', fontSize: '0.7rem' }}
                                            >
                                                MODIFY
                                            </button>
                                            <button
                                                onClick={() => handleDelete(service.id)}
                                                style={{ color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: '800', fontSize: '0.7rem' }}
                                            >
                                                REMOVE
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {services.length === 0 && (
                                <tr>
                                    <td colSpan="3" style={{ textAlign: 'center', padding: '6rem', color: 'var(--text-secondary)', letterSpacing: '0.1em' }}>NO SERVICES DEFINED IN CATALOGUE.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

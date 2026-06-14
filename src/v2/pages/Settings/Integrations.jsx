import React, { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../../services/firebase';
import { encrypt, decrypt } from '../../utils/crypto';

const PROVIDERS = [
    {
        id: 'web',
        icon: '💻',
        name: 'WhatsApp Web',
        tag: 'Free · No Setup',
        tagColor: '#10b981',
        tagBg: '#ecfdf5',
        desc: 'Opens a pre-filled WhatsApp window for staff to manually approve & send. Zero cost, no API needed.',
        official: false,
    },
    {
        id: 'ultramsg',
        icon: '🤖',
        name: 'UltraMsg API',
        tag: 'Unofficial',
        tagColor: '#f59e0b',
        tagBg: '#fffbeb',
        desc: 'Automated background sending via an unofficial WhatsApp instance. Affordable but not Meta-approved.',
        official: false,
    },
    {
        id: 'meta',
        icon: '♾️',
        name: 'Meta Cloud API',
        tag: 'Official · Recommended',
        tagColor: '#3b82f6',
        tagBg: '#eff6ff',
        desc: 'Official WhatsApp Business Cloud API by Meta. Highest deliverability, template-based, GDPR compliant.',
        official: true,
    },
    {
        id: 'webhook',
        icon: '🔌',
        name: 'Custom Webhook',
        tag: 'Enterprise',
        tagColor: '#8b5cf6',
        tagBg: '#f5f3ff',
        desc: 'POST to any endpoint — ideal for Zapier, Make.com, or your own backend. Full control over payload.',
        official: false,
    },
];

const TRIGGERS = [
    { id: 'triggerAppointment',  label: 'Appointment Confirmation', desc: 'Sent when an appointment is booked or confirmed', icon: '📅', templateKey: 'appointmentTemplate' },
    { id: 'triggerPayment',      label: 'Payment Receipt',          desc: 'Sent after a successful payment / invoice checkout', icon: '🧾', templateKey: 'paymentTemplate' },
    { id: 'triggerArrears',      label: 'Arrears Reminder',         desc: 'Sent weekly to customers with an unpaid balance', icon: '⚠️', templateKey: 'arrearsTemplate' },
];

export default function IntegrationsSettings() {
    const [loading, setLoading]   = useState(true);
    const [saving, setSaving]     = useState(false);
    const [testing, setTesting]   = useState(false);
    const [testPhone, setTestPhone] = useState('');
    const [testResult, setTestResult] = useState(null); // { ok: bool, msg: string }
    const [metaTemplates, setMetaTemplates] = useState([]);
    const [fetchingTemplates, setFetchingTemplates] = useState(false);

    const [config, setConfig] = useState({
        whatsappMode: 'web',
        // UltraMsg
        ultramsgInstanceId: '',
        ultramsgToken: '',
        // Meta
        metaPhoneNumberId: '',
        metaAccessToken: '',
        // Webhook
        webhookUrl: '',
        webhookHeaders: '{"Content-Type": "application/json"}',
        webhookPayload: '{"to": "{{phone}}", "body": "{{message}}"}',
        // Triggers
        triggerAppointment: false,
        appointmentTemplate: '',
        triggerPayment: false,
        paymentTemplate: '',
        triggerArrears: false,
        arrearsTemplate: '',
        // General
        autoSendAlerts: true,
    });

    const fetchMetaTemplates = async (phoneId, token, showAlertOnError = false) => {
        const pId = phoneId || config.metaPhoneNumberId;
        const tok = token || config.metaAccessToken;
        if (!pId || !tok) {
            if (showAlertOnError) alert('Please set Phone Number ID and Access Token first.');
            return;
        }

        setFetchingTemplates(true);
        try {
            // Step 1: Get WABA ID from Phone ID
            const phoneRes = await fetch(`https://graph.facebook.com/v22.0/${pId}?fields=whatsapp_business_account&access_token=${tok}`);
            if (!phoneRes.ok) {
                const errData = await phoneRes.json();
                throw new Error(errData.error?.message || 'Failed to fetch WABA ID');
            }
            const phoneData = await phoneRes.json();
            const wabaId = phoneData.whatsapp_business_account?.id;
            if (!wabaId) throw new Error('Could not find WhatsApp Business Account linked to this Phone ID');

            // Step 2: Get Templates using WABA ID
            const templatesRes = await fetch(`https://graph.facebook.com/v22.0/${wabaId}/message_templates?access_token=${tok}`);
            if (!templatesRes.ok) {
                const errData = await templatesRes.json();
                throw new Error(errData.error?.message || 'Failed to fetch templates');
            }
            const templatesData = await templatesRes.json();
            const approved = (templatesData.data || []).filter(t => t.status === 'APPROVED');
            setMetaTemplates(approved);
            if (showAlertOnError) alert(`✅ Synced ${approved.length} approved templates!`);
        } catch (e) {
            console.error('Error fetching Meta templates:', e);
            if (showAlertOnError) alert('❌ Template Sync Failed: ' + e.message);
        } finally {
            setFetchingTemplates(false);
        }
    };

    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const snap = await getDoc(doc(db, 'settings', 'integrations'));
                if (snap.exists()) {
                    const data = snap.data();
                    let decryptedAccessToken = '';
                    if (data.metaAccessToken) {
                        decryptedAccessToken = decrypt(data.metaAccessToken);
                        data.metaAccessToken = decryptedAccessToken;
                    }
                    if (data.ultramsgToken) data.ultramsgToken = decrypt(data.ultramsgToken);
                    setConfig(prev => ({ ...prev, ...data }));

                    if (data.whatsappMode === 'meta' && data.metaPhoneNumberId && decryptedAccessToken) {
                        fetchMetaTemplates(data.metaPhoneNumberId, decryptedAccessToken);
                    }
                }
            } catch (e) { console.error(e); }
            finally { setLoading(false); }
        };
        fetchConfig();
    }, []);

    const upd = (key, val) => setConfig(prev => ({ ...prev, [key]: val }));

    const handleSave = async () => {
        setSaving(true);
        try {
            const dataToSave = {
                ...config,
                metaAccessToken: encrypt(config.metaAccessToken),
                ultramsgToken: encrypt(config.ultramsgToken),
            };
            await setDoc(doc(db, 'settings', 'integrations'), dataToSave, { merge: true });
            alert('✅ Integration settings saved!');
        } catch (e) { alert('❌ Failed to save: ' + e.message); }
        finally { setSaving(false); }
    };

    const handleTest = async () => {
        if (!testPhone) return alert('Enter a test phone number first.');
        setTesting(true);
        setTestResult(null);
        try {
            let phone = String(testPhone).replace(/\D/g, '');
            if (phone.length === 10) phone = '91' + phone;
            const msg = '👋 Test message from Hashtag Integration Hub!';

            if (config.whatsappMode === 'web') {
                window.open(`https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(msg)}`, '_blank');
                setTestResult({ ok: true, msg: 'WhatsApp Web opened successfully.' });
            } else if (config.whatsappMode === 'ultramsg') {
                if (!config.ultramsgInstanceId || !config.ultramsgToken) throw new Error('Missing UltraMsg credentials');
                const url = `https://api.ultramsg.com/${config.ultramsgInstanceId}/messages/chat`;
                const body = new URLSearchParams({ token: config.ultramsgToken, to: phone, body: msg });
                const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString() });
                const data = await res.json();
                if (data.error) throw new Error(data.error);
                setTestResult({ ok: true, msg: 'Message sent via UltraMsg!' });
            } else if (config.whatsappMode === 'meta') {
                if (!config.metaPhoneNumberId || !config.metaAccessToken) throw new Error('Missing Meta credentials');
                const url = `https://graph.facebook.com/v22.0/${config.metaPhoneNumberId}/messages`;
                const payload = {
                    messaging_product: 'whatsapp',
                    recipient_type: 'individual',
                    to: phone,
                    type: 'template',
                    template: { name: 'hello_world', language: { code: 'en_US' } },
                };
                const res = await fetch(url, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${config.metaAccessToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
                const data = await res.json();
                if (data.error) throw new Error(data.error.message);
                setTestResult({ ok: true, msg: 'hello_world template sent via Meta API!' });
            } else if (config.whatsappMode === 'webhook') {
                if (!config.webhookUrl) throw new Error('Missing Webhook URL');
                let headers = {};
                try { headers = JSON.parse(config.webhookHeaders); } catch (_) {}
                const bodyStr = config.webhookPayload.replace(/{{phone}}/g, phone).replace(/{{message}}/g, msg);
                const res = await fetch(config.webhookUrl, { method: 'POST', headers, body: bodyStr });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                setTestResult({ ok: true, msg: 'Webhook call succeeded!' });
            }
        } catch (e) {
            setTestResult({ ok: false, msg: e.message });
        } finally {
            setTesting(false);
        }
    };

    const activeProvider = PROVIDERS.find(p => p.id === config.whatsappMode);

    if (loading) return <Layout><div style={{ padding: '3rem', textAlign: 'center', color: 'var(--v2-text-muted)' }}>Loading...</div></Layout>;

    return (
        <Layout>
            <style>{`
                @keyframes fadeSlideIn {
                    from { opacity: 0; transform: translateY(-6px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
                .integ-provider-card {
                    padding: 1.25rem;
                    border-radius: 14px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    border: 2px solid var(--v2-border);
                    background: white;
                    position: relative;
                }
                .integ-provider-card:hover {
                    border-color: #94a3b8;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.06);
                    transform: translateY(-2px);
                }
                .integ-provider-card.active {
                    border-color: var(--v2-primary);
                    background: #f0fdf4;
                    box-shadow: 0 0 0 3px rgba(13,148,136,0.12);
                }
                .integ-trigger-row {
                    display: flex;
                    align-items: flex-start;
                    gap: 1rem;
                    padding: 1rem;
                    border-radius: 10px;
                    background: #f8fafc;
                    border: 1px solid var(--v2-border);
                    transition: background 0.2s;
                }
                .integ-trigger-row.on {
                    background: #f0fdf4;
                    border-color: #86efac;
                }
                .integ-field label {
                    display: block;
                    font-size: 0.72rem;
                    font-weight: 700;
                    color: var(--v2-text-muted);
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    margin-bottom: 0.4rem;
                }
                .integ-field input, .integ-field textarea {
                    width: 100%;
                    padding: 0.7rem 0.85rem;
                    border: 1px solid var(--v2-border);
                    border-radius: 8px;
                    font-size: 0.875rem;
                    outline: none;
                    transition: border-color 0.2s;
                    background: white;
                    box-sizing: border-box;
                }
                .integ-field input:focus, .integ-field textarea:focus {
                    border-color: var(--v2-primary);
                    box-shadow: 0 0 0 3px rgba(13,148,136,0.1);
                }
                .integ-cred-panel {
                    animation: fadeSlideIn 0.25s ease;
                    margin-top: 1.25rem;
                    padding: 1.5rem;
                    background: #f8fafc;
                    border-radius: 12px;
                    border: 1px dashed #cbd5e1;
                }
                .integ-section-title {
                    font-size: 1rem;
                    font-weight: 800;
                    margin-bottom: 0.35rem;
                    color: var(--v2-text-main);
                }
                .integ-section-desc {
                    font-size: 0.8rem;
                    color: var(--v2-text-muted);
                    margin-bottom: 1.25rem;
                }
            `}</style>

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '900' }}>Integrations ⚡</h1>
                    <p style={{ color: 'var(--v2-text-muted)', marginTop: '0.25rem', fontSize: '0.875rem' }}>
                        Configure WhatsApp gateway, automation triggers, and third-party connections.
                    </p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    style={{ padding: '0.75rem 1.75rem', background: 'var(--v2-primary)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '800', cursor: saving ? 'not-allowed' : 'pointer', fontSize: '0.9rem', opacity: saving ? 0.7 : 1, transition: '0.2s' }}
                >
                    {saving ? 'Saving...' : '💾 Save Configuration'}
                </button>
            </div>

            {/* ─── Section A: WhatsApp Provider ─── */}
            <div className="v2-card" style={{ marginBottom: '1.5rem' }}>
                <p className="integ-section-title">📱 WhatsApp Gateway</p>
                <p className="integ-section-desc">Choose your sending provider. Credentials are stored securely in your workspace.</p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
                    {PROVIDERS.map(p => (
                        <div
                            key={p.id}
                            className={`integ-provider-card ${config.whatsappMode === p.id ? 'active' : ''}`}
                            onClick={() => upd('whatsappMode', p.id)}
                        >
                            {config.whatsappMode === p.id && (
                                <div style={{ position: 'absolute', top: '0.6rem', right: '0.6rem', background: '#10b981', color: 'white', fontSize: '0.6rem', fontWeight: '800', padding: '2px 7px', borderRadius: '999px', letterSpacing: '0.04em' }}>
                                    ✓ ACTIVE
                                </div>
                            )}
                            <div style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>{p.icon}</div>
                            <div style={{ fontWeight: '800', fontSize: '0.9rem', marginBottom: '0.35rem' }}>{p.name}</div>
                            <div style={{ display: 'inline-block', background: p.tagBg, color: p.tagColor, fontSize: '0.65rem', fontWeight: '700', padding: '2px 8px', borderRadius: '999px', marginBottom: '0.5rem' }}>
                                {p.tag}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--v2-text-muted)', lineHeight: 1.5 }}>{p.desc}</div>
                        </div>
                    ))}
                </div>

                {/* Credential Fields */}
                {config.whatsappMode === 'ultramsg' && (
                    <div className="integ-cred-panel">
                        <h3 style={{ margin: '0 0 1rem', fontSize: '0.85rem', fontWeight: '800', color: '#334155' }}>🤖 UltraMsg Configuration</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div className="integ-field"><label>Instance ID</label><input type="text" value={config.ultramsgInstanceId} onChange={e => upd('ultramsgInstanceId', e.target.value)} placeholder="instanceXXXXX" /></div>
                            <div className="integ-field"><label>API Token</label>
                                {config.ultramsgToken ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.7rem 0.85rem', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', boxSizing: 'border-box' }}>
                                        <span style={{ flex: 1, color: '#10b981', fontWeight: '700', fontSize: '0.85rem' }}>✅ Token is set</span>
                                        <button type="button" onClick={() => upd('ultramsgToken', '')} style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', color: '#ef4444', background: '#fee2e2', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '700' }}>Remove</button>
                                    </div>
                                ) : (
                                    <input type="password" value={config.ultramsgToken} onChange={e => upd('ultramsgToken', e.target.value)} placeholder="Secret Token" />
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {config.whatsappMode === 'meta' && (
                    <div className="integ-cred-panel">
                        <h3 style={{ margin: '0 0 1rem', fontSize: '0.85rem', fontWeight: '800', color: '#334155' }}>♾️ Meta Cloud API Configuration</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '0.75rem' }}>
                            <div className="integ-field">
                                <label>Phone Number ID</label>
                                <input type="text" value={config.metaPhoneNumberId} onChange={e => upd('metaPhoneNumberId', e.target.value)} placeholder="e.g. 123456789012345" />
                            </div>
                            <div className="integ-field">
                                <label>Permanent Access Token</label>
                                {config.metaAccessToken ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.7rem 0.85rem', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', boxSizing: 'border-box' }}>
                                        <span style={{ flex: 1, color: '#10b981', fontWeight: '700', fontSize: '0.85rem' }}>✅ Token is set</span>
                                        <button type="button" onClick={() => upd('metaAccessToken', '')} style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', color: '#ef4444', background: '#fee2e2', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '700' }}>Remove</button>
                                    </div>
                                ) : (
                                    <input type="password" value={config.metaAccessToken} onChange={e => upd('metaAccessToken', e.target.value)} placeholder="EAAxxxxxxxxxxxxx..." />
                                )}
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginTop: '0.75rem' }}>
                            <a href="https://business.facebook.com/latest/whatsapp_manager" target="_blank" rel="noreferrer" style={{ fontSize: '0.75rem', color: 'var(--v2-primary)', fontWeight: '600', textDecoration: 'none' }}>
                                🔗 Open Meta WhatsApp Manager →
                            </a>
                            {config.metaPhoneNumberId && config.metaAccessToken && (
                                <button
                                    type="button"
                                    onClick={() => fetchMetaTemplates(null, null, true)}
                                    disabled={fetchingTemplates}
                                    style={{ marginLeft: 'auto', padding: '0.45rem 1rem', fontSize: '0.72rem', background: '#e2e8f0', color: '#334155', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                                >
                                    {fetchingTemplates ? '⏳ Syncing Templates...' : '🔄 Sync Templates'}
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {config.whatsappMode === 'webhook' && (
                    <div className="integ-cred-panel">
                        <h3 style={{ margin: '0 0 1rem', fontSize: '0.85rem', fontWeight: '800', color: '#334155' }}>🔌 Custom Webhook Configuration</h3>
                        <div style={{ display: 'grid', gap: '1rem' }}>
                            <div className="integ-field"><label>Webhook URL (POST)</label><input type="text" value={config.webhookUrl} onChange={e => upd('webhookUrl', e.target.value)} placeholder="https://hook.us1.make.com/..." /></div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div className="integ-field"><label>Headers (JSON)</label><textarea rows="3" value={config.webhookHeaders} onChange={e => upd('webhookHeaders', e.target.value)} style={{ fontFamily: 'monospace', fontSize: '0.8rem' }} /></div>
                                <div className="integ-field"><label>Payload Template (JSON)</label><textarea rows="3" value={config.webhookPayload} onChange={e => upd('webhookPayload', e.target.value)} style={{ fontFamily: 'monospace', fontSize: '0.8rem' }} /></div>
                            </div>
                            <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--v2-text-muted)' }}>
                                Use <code style={{ background: '#eee', padding: '1px 4px', borderRadius: '3px' }}>{'{{phone}}'}</code> and <code style={{ background: '#eee', padding: '1px 4px', borderRadius: '3px' }}>{'{{message}}'}</code> as dynamic placeholders.
                            </p>
                        </div>
                    </div>
                )}

                {/* Test Connection */}
                <div style={{ marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid var(--v2-border)', display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <input
                        type="text"
                        placeholder="Test phone (e.g. 9876543210)"
                        value={testPhone}
                        onChange={e => setTestPhone(e.target.value)}
                        style={{ padding: '0.65rem 1rem', border: '1px solid var(--v2-border)', borderRadius: '8px', width: '230px', fontSize: '0.875rem', outline: 'none' }}
                    />
                    <button
                        onClick={handleTest}
                        disabled={testing || !testPhone}
                        style={{ padding: '0.65rem 1.25rem', background: '#334155', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: (testing || !testPhone) ? 'not-allowed' : 'pointer', fontSize: '0.875rem', opacity: (testing || !testPhone) ? 0.6 : 1, transition: '0.2s' }}
                    >
                        {testing ? '⏳ Testing...' : '🧪 Test Connection'}
                    </button>
                    {testResult && (
                        <div style={{ fontSize: '0.82rem', fontWeight: '600', color: testResult.ok ? '#10b981' : '#ef4444', animation: 'fadeSlideIn 0.3s ease' }}>
                            {testResult.ok ? '✅' : '❌'} {testResult.msg}
                        </div>
                    )}
                </div>
            </div>

            {/* ─── Section B: Automation Triggers ─── */}
            <div className="v2-card" style={{ marginBottom: '1.5rem' }}>
                <p className="integ-section-title">🤖 Automation Triggers</p>
                <p className="integ-section-desc">
                    Automatically send WhatsApp messages via your selected gateway when key events occur.
                    {config.whatsappMode === 'meta' && (
                        <span style={{ display: 'inline-block', background: '#eff6ff', color: '#3b82f6', fontSize: '0.72rem', fontWeight: '700', padding: '2px 8px', borderRadius: '999px', marginLeft: '0.5rem' }}>
                            Meta mode: enter exact approved template names below
                        </span>
                    )}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {TRIGGERS.map(t => (
                        <div key={t.id} className={`integ-trigger-row ${config[t.id] ? 'on' : ''}`}>
                            <div style={{ fontSize: '1.5rem', marginTop: '0.1rem' }}>{t.icon}</div>
                            <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.35rem' }}>
                                    <strong style={{ fontSize: '0.9rem' }}>{t.label}</strong>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.8rem', color: config[t.id] ? '#10b981' : 'var(--v2-text-muted)', fontWeight: '600' }}>
                                        <input
                                            type="checkbox"
                                            checked={config[t.id] || false}
                                            onChange={e => upd(t.id, e.target.checked)}
                                            style={{ width: '1rem', height: '1rem', cursor: 'pointer', accentColor: '#10b981' }}
                                        />
                                        {config[t.id] ? 'Enabled' : 'Disabled'}
                                    </label>
                                </div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--v2-text-muted)', marginBottom: config[t.id] ? '0.75rem' : 0 }}>{t.desc}</div>
                                {config[t.id] && (
                                    <div style={{ animation: 'fadeSlideIn 0.2s ease', marginTop: '0.5rem' }}>
                                        {config.whatsappMode === 'meta' ? (
                                            metaTemplates.length > 0 ? (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                                    <select
                                                        value={config[t.templateKey] || ''}
                                                        onChange={e => {
                                                            const name = e.target.value;
                                                            upd(t.templateKey, name);
                                                            const tmpl = metaTemplates.find(x => x.name === name);
                                                            if (tmpl) {
                                                                upd(`${t.templateKey}Language`, tmpl.language);
                                                            }
                                                        }}
                                                        style={{ width: '100%', padding: '0.6rem 0.85rem', border: '1px solid #86efac', borderRadius: '7px', fontSize: '0.85rem', outline: 'none', background: 'white', cursor: 'pointer', boxSizing: 'border-box' }}
                                                    >
                                                        <option value="">-- Select Approved Meta Template --</option>
                                                        {metaTemplates.map(tmpl => (
                                                            <option key={tmpl.name} value={tmpl.name}>
                                                                {tmpl.name} ({tmpl.language}) [{tmpl.category}]
                                                            </option>
                                                        ))}
                                                    </select>
                                                    <div style={{ fontSize: '0.72rem', color: 'var(--v2-text-sub)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <span>Selected: <strong>{config[t.templateKey] || 'None'}</strong></span>
                                                        <button 
                                                            type="button" 
                                                            onClick={() => {
                                                                const manual = prompt('Enter Meta Template name manually:', config[t.templateKey] || '');
                                                                if (manual !== null) {
                                                                    upd(t.templateKey, manual);
                                                                    const lang = prompt('Enter Template Language Code (e.g. en_US, en, hi):', config[`${t.templateKey}Language`] || 'en_US');
                                                                    if (lang) upd(`${t.templateKey}Language`, lang);
                                                                }
                                                            }}
                                                            style={{ background: 'none', border: 'none', color: 'var(--v2-primary)', cursor: 'pointer', padding: 0, fontSize: '0.7rem', fontWeight: '700' }}
                                                        >
                                                            ✍️ Edit Manually
                                                        </button>
                                                    </div>
                                                    {(() => {
                                                        const tmpl = metaTemplates.find(x => x.name === config[t.templateKey]);
                                                        const bodyComp = tmpl?.components?.find(c => c.type === 'BODY' || c.type === 'body');
                                                        if (bodyComp?.text) {
                                                            return (
                                                                <div style={{ background: '#f1f5f9', padding: '0.6rem 0.85rem', borderRadius: '6px', fontSize: '0.75rem', color: 'var(--v2-text-sub)', borderLeft: '3px solid var(--v2-primary)', marginTop: '0.2rem', whiteSpace: 'pre-wrap' }}>
                                                                    <strong>Template Text Preview:</strong>
                                                                    <p style={{ margin: '0.25rem 0 0', fontFamily: 'monospace', color: 'var(--v2-text-main)' }}>{bodyComp.text}</p>
                                                                </div>
                                                            );
                                                        }
                                                        return null;
                                                    })()}
                                                </div>
                                            ) : (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                                    <input
                                                        type="text"
                                                        value={config[t.templateKey] || ''}
                                                        onChange={e => upd(t.templateKey, e.target.value)}
                                                        placeholder="Enter approved Meta template name (e.g. appointment_confirm)"
                                                        style={{ padding: '0.6rem 0.85rem', border: '1px solid #86efac', borderRadius: '7px', width: '100%', fontSize: '0.85rem', outline: 'none', background: 'white', boxSizing: 'border-box' }}
                                                    />
                                                    <span style={{ fontSize: '0.68rem', color: 'var(--v2-text-muted)' }}>
                                                        No templates loaded. Enter manually or click <strong>Sync Templates</strong> above.
                                                    </span>
                                                </div>
                                            )
                                        ) : (
                                            <input
                                                type="text"
                                                value={config[t.templateKey] || ''}
                                                onChange={e => upd(t.templateKey, e.target.value)}
                                                placeholder="Message text to send"
                                                style={{ padding: '0.6rem 0.85rem', border: '1px solid #86efac', borderRadius: '7px', width: '100%', fontSize: '0.85rem', outline: 'none', background: 'white', boxSizing: 'border-box' }}
                                            />
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* ─── Section C: Meta Business Info ─── */}
            <div className="v2-card">
                <p className="integ-section-title">ℹ️ Meta Business Info</p>
                <p className="integ-section-desc">Reference information for your WhatsApp Business Account.</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                    <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '10px', border: '1px solid var(--v2-border)' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: '700', color: 'var(--v2-text-muted)', textTransform: 'uppercase', marginBottom: '0.4rem' }}>Phone Number ID</div>
                        <div style={{ fontWeight: '700', fontSize: '0.9rem', fontFamily: 'monospace', color: 'var(--v2-text-main)' }}>
                            {config.metaPhoneNumberId ? `${config.metaPhoneNumberId.substring(0, 6)}••••••` : '— Not configured —'}
                        </div>
                    </div>
                    <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '10px', border: '1px solid var(--v2-border)' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: '700', color: 'var(--v2-text-muted)', textTransform: 'uppercase', marginBottom: '0.4rem' }}>Active Gateway</div>
                        <div style={{ fontWeight: '700', fontSize: '0.9rem', color: 'var(--v2-primary)' }}>
                            {activeProvider?.icon} {activeProvider?.name}
                        </div>
                    </div>
                    <div style={{ padding: '1rem', background: '#fffbeb', borderRadius: '10px', border: '1px solid #fde68a' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: '700', color: '#92400e', textTransform: 'uppercase', marginBottom: '0.4rem' }}>Marketing Template Cost</div>
                        <div style={{ fontWeight: '800', fontSize: '0.9rem', color: '#92400e' }}>~₹1.09 / message</div>
                        <div style={{ fontSize: '0.7rem', color: '#a16207', marginTop: '0.2rem' }}>Meta Cloud API (India) rate</div>
                    </div>
                </div>
                <a
                    href="https://business.facebook.com/latest/whatsapp_manager/message_templates"
                    target="_blank"
                    rel="noreferrer"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', marginTop: '1rem', fontSize: '0.8rem', color: 'var(--v2-primary)', fontWeight: '700', textDecoration: 'none' }}
                >
                    🔗 Manage Message Templates in Meta Business Manager →
                </a>
            </div>
        </Layout>
    );
}

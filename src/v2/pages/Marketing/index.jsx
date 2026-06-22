import React, { useState, useEffect, useMemo } from 'react';
import Layout from '../../components/Layout';
import { useData } from '../../../context/DataProvider';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '../../../services/firebase';
import { decrypt } from '../../utils/crypto';

const PARAM_SOURCES = [
    { value: 'name',    label: '👤 Customer Name' },
    { value: 'balance', label: '⚠️ Unpaid Balance' },
    { value: 'spent',   label: '⭐ Total Spent' },
    { value: 'custom',  label: '✏️ Custom Text' },
];

const GATEWAY_LABELS = {
    web:      { icon: '💻', label: 'WhatsApp Web',    color: '#10b981' },
    ultramsg: { icon: '🤖', label: 'UltraMsg API',    color: '#f59e0b' },
    meta:     { icon: '♾️', label: 'Meta Cloud API',  color: '#3b82f6' },
    webhook:  { icon: '🔌', label: 'Custom Webhook',  color: '#8b5cf6' },
};

export default function MarketingHub() {
    const [customers, setCustomers] = useState(null);

    useEffect(() => {
        getDocs(collection(db, 'customers')).then(snap => {
            setCustomers(snap.docs.map(d => d.data()));
        }).catch(err => console.error("Error fetching customers for marketing:", err));
    }, []);

    // Gateway config read from Integrations
    const [gateway, setGateway] = useState(null);
    const [gwLoading, setGwLoading] = useState(true);

    // Campaign state
    const [filterTarget, setFilterTarget]       = useState('all');
    const [metaTemplateName, setMetaTemplateName] = useState('');
    const [metaLang, setMetaLang]               = useState('en_US');
    const [metaTemplates, setMetaTemplates]     = useState([]);
    const [loadingTemplates, setLoadingTemplates] = useState(false);
    const [metaParams, setMetaParams]           = useState([]); // [{ source, value }]
    const [templatePreview, setTemplatePreview] = useState('');
    const [scheduleMode, setScheduleMode]       = useState('now');   // 'now' | 'schedule'
    const [scheduleAt, setScheduleAt]           = useState('');
    const [isSending, setIsSending]             = useState(false);
    const [progressLogs, setProgressLogs]       = useState([]);
    const [sendSummary, setSendSummary]         = useState(null); // { sent, failed }

    // Also keep free-text for non-meta modes
    const [messageText, setMessageText] = useState('Hi {{name}}, great news from us! Visit us this weekend for exclusive deals.');

    useEffect(() => {
        const load = async () => {
            try {
                const snap = await getDoc(doc(db, 'settings', 'integrations'));
                if (snap.exists()) {
                    const data = snap.data();
                    if (data.metaAccessToken) data.metaAccessToken = decrypt(data.metaAccessToken);
                    if (data.ultramsgToken) data.ultramsgToken = decrypt(data.ultramsgToken);
                    setGateway(data);
                }
            } catch (e) { console.error(e); }
            finally { setGwLoading(false); }
        };
        load();
    }, []);

    const [templateError, setTemplateError] = useState(null);

    const fetchTemplates = async (gw = gateway) => {
        const activeGw = gw || gateway;
        if (!activeGw || activeGw.whatsappMode !== 'meta') return;
        
        const tok = activeGw.metaAccessToken;
        let wabaId = activeGw.metaWabaId;
        const pId = activeGw.metaPhoneNumberId;
        if (!tok) {
            setTemplateError('Access Token is not configured.');
            return;
        }

        setLoadingTemplates(true);
        setTemplateError(null);
        try {
            if (!wabaId) {
                throw new Error('Please configure WhatsApp Business Account ID (WABA ID) in Settings -> Integrations to sync templates.');
            }

            const templatesRes = await fetch(`https://graph.facebook.com/v22.0/${wabaId}/message_templates?access_token=${tok}`);
            if (!templatesRes.ok) {
                const errData = await templatesRes.json();
                throw new Error(errData.error?.message || 'Failed to fetch templates');
            }
            const templatesData = await templatesRes.json();
            const approved = (templatesData.data || []).filter(t => t.status === 'APPROVED');
            setMetaTemplates(approved);
        } catch (e) {
            console.error("Error loading Meta templates in Marketing Hub:", e);
            setTemplateError(e.message);
        } finally {
            setLoadingTemplates(false);
        }
    };

    useEffect(() => {
        if (gateway) {
            fetchTemplates(gateway);
        }
    }, [gateway]);

    const mode = gateway?.whatsappMode || 'web';
    const isMetaMode = mode === 'meta';

    // ─── Derived: filter customers ───────────────────────────────────────────
    const segments = useMemo(() => {
        if (!customers) return { all: [], vip: [], lost: [], recent: [], new: [], leads: [], test: [] };
        const withPhone = customers.filter(c => c.phone);
        const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
        const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

        return {
            all:     withPhone,
            vip:     withPhone.filter(c => (c.globalStats?.totalSpent || 0) > 10000 || (c.globalStats?.totalVisits || 0) >= 5),
            lost:    withPhone.filter(c => {
                const lastV = c.lastVisit || c.lastUpdated;
                if (!lastV) return false;
                const lv = lastV.toMillis ? lastV.toMillis() : new Date(lastV).getTime();
                return lv < thirtyDaysAgo;
            }),
            recent:  withPhone.filter(c => {
                const lastV = c.lastVisit || c.lastUpdated;
                if (!lastV) return false;
                const lv = lastV.toMillis ? lastV.toMillis() : new Date(lastV).getTime();
                return lv >= thirtyDaysAgo;
            }),
            new:     withPhone.filter(c => {
                const created = c.createdAt || c.lastUpdated; // fallback to lastUpdated if missing
                if (!created) return false;
                const ca = created.toMillis ? created.toMillis() : new Date(created).getTime();
                return ca >= sevenDaysAgo;
            }),
            leads:   withPhone.filter(c => !(c.globalStats?.totalVisits > 0) && !(c.globalStats?.totalSpent > 0)),
            test:    withPhone.filter(c => {
                const p = String(c.phone).replace(/\D/g, '');
                return p.includes('9629180431') || p.includes('9047721318') || (c.name || '').toLowerCase() === 'test';
            }),
        };
    }, [customers]);

    const filteredCustomers = segments[filterTarget] || [];

    const SEGMENT_CARDS = [
        { id: 'all',     icon: '👥', label: 'All Customers',        desc: 'Every registered customer', accent: '#10b981', bg: '#ecfdf5' },
        { id: 'vip',     icon: '⭐', label: 'VIP Customers',         desc: 'High spenders (>₹10k)',     accent: '#8b5cf6', bg: '#f5f3ff' },
        { id: 'recent',  icon: '🔥', label: 'Recent Customers',      desc: 'Visited in last 30 days',   accent: '#06b6d4', bg: '#ecfeff' },
        { id: 'new',     icon: '🌱', label: 'New Signups',           desc: 'Joined in last 7 days',     accent: '#3b82f6', bg: '#eff6ff' },
        { id: 'leads',   icon: '🎯', label: 'Leads (No Purchase)',   desc: 'Registered, zero spend',    accent: '#6366f1', bg: '#e0e7ff' },
        { id: 'lost',    icon: '🥀', label: 'Lost Customers',        desc: 'No visit in 30+ days',      accent: '#ef4444', bg: '#fef2f2' },
        { id: 'test',    icon: '🧪', label: 'Test Segment',          desc: 'Only test customers (9629180431, 9047721318)', accent: '#ec4899', bg: '#fdf2f8' },
    ];

    const handleTemplateSelect = (tmplName) => {
        setMetaTemplateName(tmplName);
        const tmpl = metaTemplates.find(x => x.name === tmplName);
        if (!tmpl) return;

        setMetaLang(tmpl.language || 'en_US');
        
        const initialParams = [];
        let previewStr = '';
        
        tmpl.components?.forEach(c => {
            const cType = c.type.toLowerCase();
            if (cType === 'header') {
                if (c.format === 'IMAGE') {
                    initialParams.push({ component: 'header', type: 'image', label: 'IMG URL', source: 'custom', value: '1263021382572370', useMediaId: true });
                    previewStr += '[Image Header]\n';
                } else if (c.format === 'DOCUMENT') {
                    initialParams.push({ component: 'header', type: 'document', label: 'DOC URL', source: 'custom', value: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf' });
                    previewStr += '[Document Header]\n';
                } else if (c.format === 'VIDEO') {
                    initialParams.push({ component: 'header', type: 'video', label: 'VID URL', source: 'custom', value: 'https://www.w3schools.com/html/mov_bbb.mp4' });
                    previewStr += '[Video Header]\n';
                } else if (c.format === 'TEXT') {
                    previewStr += c.text + '\n';
                    const matches = [...c.text.matchAll(/\{\{(\d+)\}\}/g)];
                    matches.forEach(m => {
                        initialParams.push({ component: 'header', type: 'text', label: `HDR {{${m[1]}}}`, source: 'name', value: '' });
                    });
                }
            } else if (cType === 'body') {
                previewStr += c.text + '\n';
                const matches = [...c.text.matchAll(/\{\{(\d+)\}\}/g)];
                const maxVarNum = matches.reduce((max, match) => Math.max(max, parseInt(match[1])), 0);
                for (let i = 0; i < maxVarNum; i++) {
                    let source = 'custom';
                    let value = ' ';
                    if (i === 0) source = 'name';
                    else if (i === 1) source = 'balance';
                    else if (i === 2) source = 'spent';
                    
                    initialParams.push({ component: 'body', type: 'text', label: `BODY {{${i+1}}}`, source: source, value: value });
                }
            } else if (cType === 'buttons') {
                c.buttons?.forEach((b, idx) => {
                    previewStr += `[Button: ${b.text}]\n`;
                    if (b.type === 'URL' && b.url?.includes('{{1}}')) {
                        // Pass "?ref=wa" as a sensible default URL parameter without prompting user
                        initialParams.push({ component: 'button', sub_type: 'url', index: String(idx), type: 'text', label: `BTN URL`, source: 'custom', value: '?ref=wa' });
                    }
                });
            } else if (cType === 'footer') {
                previewStr += `Footer: ${c.text}\n`;
            }
        });

        setTemplatePreview(previewStr.trim());
        setMetaParams(initialParams);
    };

    const ensureTestCustomer = async () => {
        const subjects = [
            { phone: '9047721318', name: 'sathish' },
            { phone: '9629180431', name: 'gokul' }
        ];

        try {
            const newCustomers = [];
            for (const subj of subjects) {
                const docRef = doc(db, 'customers', subj.phone);
                const savedData = {
                    name: subj.name,
                    phone: subj.phone,
                    dob: '',
                    anniversary: '',
                    globalStats: { totalVisits: 0, totalSpent: 0 },
                    lastUpdated: new Date()
                };
                await setDoc(docRef, savedData, { merge: true });
                newCustomers.push(savedData);
            }

            setCustomers(prev => {
                let list = prev ? [...prev] : [];
                newCustomers.forEach(nc => {
                    if (list.some(c => c.phone === nc.phone)) {
                        list = list.map(c => c.phone === nc.phone ? { ...c, ...nc } : c);
                    } else {
                        list.push(nc);
                    }
                });
                return list;
            });
            alert('✅ Test subjects created/updated successfully!');
        } catch (e) {
            alert('Error creating test subjects: ' + e.message);
        }
    };

    const delay = ms => new Promise(r => setTimeout(r, ms));

    const resolveParam = (param, client) => {
        if (param.source === 'name')    return client.name || 'Customer';
        if (param.source === 'balance') return String(client.unpaidBalance || 0);
        if (param.source === 'spent')   return String(client.totalSpent || 0);
        if (param.source === 'custom')  return param.value || '';
        return '';
    };

    const buildMetaPayload = (phone, client) => {
        const langCode = metaLang.startsWith('en') ? 'en' : metaLang;
        const payload = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: phone,
            type: 'template',
            template: { name: metaTemplateName, language: { code: langCode }, components: [] },
        };
        
        const headerParams = metaParams.filter(p => p.component === 'header');
        const bodyParams = metaParams.filter(p => p.component === 'body');
        const buttonParams = metaParams.filter(p => p.component === 'button');

        if (headerParams.length > 0) {
            payload.template.components.push({
                type: 'header',
                parameters: headerParams.map(p => {
                    const val = resolveParam(p, client) || ' ';
                    if (p.type === 'image') return { type: 'image', image: p.useMediaId ? { id: val } : { link: val } };
                    if (p.type === 'document') return { type: 'document', document: { link: val } };
                    if (p.type === 'video') return { type: 'video', video: { link: val } };
                    return { type: 'text', text: val };
                })
            });
        }
        
        if (bodyParams.length > 0) {
            payload.template.components.push({
                type: 'body',
                parameters: bodyParams.map(p => ({ type: 'text', text: resolveParam(p, client) || ' ' }))
            });
        }

        if (buttonParams.length > 0) {
            buttonParams.forEach(p => {
                payload.template.components.push({
                    type: 'button',
                    sub_type: 'url',
                    index: p.index,
                    parameters: [{ type: 'text', text: resolveParam(p, client) || ' ' }]
                });
            });
        }

        if (payload.template.components.length === 0) {
            delete payload.template.components;
        }

        return payload;
    };

    const handleSendBulk = async () => {
        if (filteredCustomers.length === 0) return alert('No customers match this filter!');
        if (isMetaMode && !metaTemplateName.trim()) return alert('Please enter a Meta template name.');
        if (!gateway) return alert('Gateway not configured. Go to Settings → Integrations first.');
        if (!window.confirm(`Send to ${filteredCustomers.length} customers via ${GATEWAY_LABELS[mode]?.label}?`)) return;

        setIsSending(true);
        setProgressLogs([]);
        setSendSummary(null);

        let sent = 0, failed = 0;

        for (let i = 0; i < filteredCustomers.length; i++) {
            const client = filteredCustomers[i];
            const name   = client.name || 'Customer';
            let phone    = String(client.phone).replace(/\D/g, '');
            if (phone.length === 10) phone = '91' + phone;

            setProgressLogs(prev => [...prev, `[${i + 1}/${filteredCustomers.length}] Processing ${name} (${phone})...`]);

            try {
                if (mode === 'web') {
                    const msg = messageText.replace(/{{name}}/g, name);
                    window.open(`https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(msg)}`, '_blank');
                    setProgressLogs(prev => [...prev, `✅ Opened WhatsApp Web for ${name}`]);
                    await delay(1500);
                } else if (mode === 'ultramsg') {
                    const msg = messageText.replace(/{{name}}/g, name);
                    const url = `https://api.ultramsg.com/${gateway.ultramsgInstanceId}/messages/chat`;
                    const body = new URLSearchParams({ token: gateway.ultramsgToken, to: phone, body: msg });
                    const res  = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString() });
                    const data = await res.json();
                    if (data.error) throw new Error(data.error);
                    setProgressLogs(prev => [...prev, `✅ Sent via UltraMsg to ${name}`]);
                    await delay(500);
                } else if (mode === 'meta') {
                    const url  = `https://graph.facebook.com/v22.0/${gateway.metaPhoneNumberId}/messages`;
                    const body = buildMetaPayload(phone, client);
                    const res  = await fetch(url, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${gateway.metaAccessToken}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify(body),
                    });
                    const data = await res.json();
                    if (data.error) throw new Error(data.error.message || 'Meta API Error');
                    setProgressLogs(prev => [...prev, `✅ Sent template "${metaTemplateName}" to ${name}`]);
                    await delay(500);
                } else if (mode === 'webhook') {
                    const msg = messageText.replace(/{{name}}/g, name);
                    let headers = {};
                    try { headers = JSON.parse(gateway.webhookHeaders); } catch (_) {}
                    const bodyStr = gateway.webhookPayload.replace(/{{phone}}/g, phone).replace(/{{message}}/g, msg);
                    const res = await fetch(gateway.webhookUrl, { method: 'POST', headers, body: bodyStr });
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    setProgressLogs(prev => [...prev, `✅ Sent via Webhook to ${name}`]);
                    await delay(500);
                }
                sent++;
            } catch (err) {
                console.error(err);
                setProgressLogs(prev => [...prev, `❌ Failed for ${name}: ${err.message}`]);
                failed++;
            }
        }

        setProgressLogs(prev => [...prev, `🎉 Campaign finished!`]);
        setSendSummary({ sent, failed });
        setIsSending(false);
    };

    const gw = GATEWAY_LABELS[mode] || GATEWAY_LABELS.web;
    const estimatedCost = isMetaMode ? (filteredCustomers.length * 1.09).toFixed(2) : null;

    if (gwLoading) return <Layout><div style={{ padding: '3rem', textAlign: 'center', color: 'var(--v2-text-muted)' }}>Loading...</div></Layout>;

    return (
        <Layout>
            <style>{`
                @keyframes fadeUp {
                    from { opacity: 0; transform: translateY(8px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
                .mkt-segment-card {
                    padding: 1rem 1.1rem;
                    border-radius: 14px;
                    cursor: pointer;
                    border: 2px solid var(--v2-border);
                    background: white;
                    transition: all 0.2s ease;
                    position: relative;
                    display: flex;
                    flex-direction: column;
                    gap: 0.25rem;
                }
                .mkt-segment-card:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 14px rgba(0,0,0,0.07);
                }
                .mkt-segment-card.active {
                    border-width: 2px;
                }
                .mkt-step-card {
                    background: white;
                    border-radius: 16px;
                    border: 1px solid var(--v2-border);
                    padding: 1.5rem;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
                }
                .mkt-step-title {
                    font-size: 1rem;
                    font-weight: 800;
                    margin: 0 0 0.25rem;
                }
                .mkt-step-desc {
                    font-size: 0.78rem;
                    color: var(--v2-text-muted);
                    margin: 0 0 1.25rem;
                }
                .mkt-field label {
                    display: block;
                    font-size: 0.72rem;
                    font-weight: 700;
                    color: var(--v2-text-muted);
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    margin-bottom: 0.4rem;
                }
                .mkt-field input, .mkt-field select, .mkt-field textarea {
                    width: 100%;
                    padding: 0.7rem 0.9rem;
                    border: 1px solid var(--v2-border);
                    border-radius: 8px;
                    font-size: 0.875rem;
                    outline: none;
                    transition: border-color 0.2s;
                    background: white;
                    box-sizing: border-box;
                }
                .mkt-field input:focus, .mkt-field select:focus, .mkt-field textarea:focus {
                    border-color: var(--v2-primary);
                    box-shadow: 0 0 0 3px rgba(13,148,136,0.1);
                }
                .mkt-param-row {
                    display: flex;
                    gap: 0.5rem;
                    align-items: center;
                    background: #f8fafc;
                    padding: 0.5rem 0.75rem;
                    border-radius: 8px;
                    border: 1px solid var(--v2-border);
                }
            `}</style>

            {/* Page Header */}
            <div style={{ marginBottom: '2rem' }}>
                <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '900' }}>Marketing & Campaigns 🚀</h1>
                <p style={{ color: 'var(--v2-text-muted)', marginTop: '0.25rem', fontSize: '0.875rem' }}>
                    Send targeted bulk WhatsApp messages to your customers.
                    {!gateway?.whatsappMode && (
                        <a href="/v2/settings/integrations" style={{ color: 'var(--v2-primary)', fontWeight: '700', marginLeft: '0.5rem', textDecoration: 'none' }}>
                            ⚙️ Configure gateway in Integrations →
                        </a>
                    )}
                </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '2rem', alignItems: 'start' }}>

                {/* ─── LEFT COLUMN ─────────────────────────────── */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                    {/* Step 1: Audience */}
                    <div className="mkt-step-card">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.25rem' }}>
                            <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--v2-primary)', color: 'white', fontWeight: '800', fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>1</div>
                            <h2 className="mkt-step-title">Select Target Audience</h2>
                        </div>
                        <p className="mkt-step-desc">Filter which customers receive this campaign.</p>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                            {SEGMENT_CARDS.map(seg => {
                                const count = segments[seg.id]?.length ?? 0;
                                const isActive = filterTarget === seg.id;
                                return (
                                    <div
                                        key={seg.id}
                                        className={`mkt-segment-card ${isActive ? 'active' : ''}`}
                                        onClick={() => setFilterTarget(seg.id)}
                                        style={{
                                            borderColor: isActive ? seg.accent : 'var(--v2-border)',
                                            background: isActive ? seg.bg : 'white',
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <span style={{ fontSize: '1.2rem' }}>{seg.icon}</span>
                                            <span style={{
                                                background: isActive ? seg.accent : '#e2e8f0',
                                                color: isActive ? 'white' : '#64748b',
                                                fontSize: '0.65rem', fontWeight: '800',
                                                padding: '2px 8px', borderRadius: '999px',
                                                transition: 'all 0.2s'
                                            }}>
                                                {count} customers
                                            </span>
                                        </div>
                                        <strong style={{ fontSize: '0.85rem', color: isActive ? seg.accent : 'var(--v2-text-main)', marginTop: '0.35rem', display: 'block' }}>{seg.label}</strong>
                                        <div style={{ fontSize: '0.72rem', color: 'var(--v2-text-muted)' }}>{seg.desc}</div>
                                    </div>
                                );
                            })}
                        </div>

                    </div>

                    {/* Step 2: Template / Message */}
                    <div className="mkt-step-card">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.25rem' }}>
                            <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--v2-primary)', color: 'white', fontWeight: '800', fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>2</div>
                            <h2 className="mkt-step-title">{isMetaMode ? 'Select Meta Template' : 'Compose Message'}</h2>
                        </div>
                        <p className="mkt-step-desc">
                            {isMetaMode
                                ? 'Enter the exact template name from your Meta Business Manager. Templates are managed and approved in Meta — not here.'
                                : 'Write your message. Use {{name}} to personalise each message with the customer\'s name.'}
                        </p>

                        {isMetaMode ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {/* Template Name + Language */}
                                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
                                    <div className="mkt-field">
                                        <label>Template Name</label>
                                        {loadingTemplates ? (
                                            <div style={{ padding: '0.7rem 0.9rem', fontSize: '0.85rem', color: 'var(--v2-text-muted)', background: '#f8fafc', borderRadius: '8px', border: '1px solid var(--v2-border)' }}>
                                                ⏳ Fetching templates from Meta...
                                            </div>
                                        ) : metaTemplates.length > 0 ? (
                                            <select
                                                value={metaTemplateName}
                                                onChange={e => handleTemplateSelect(e.target.value)}
                                                style={{ cursor: 'pointer' }}
                                            >
                                                <option value="">-- Choose Approved Meta Template --</option>
                                                {metaTemplates.map(tmpl => (
                                                    <option key={tmpl.name} value={tmpl.name}>
                                                        {tmpl.name} ({tmpl.language}) [{tmpl.category}]
                                                    </option>
                                                ))}
                                            </select>
                                        ) : (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                                <input
                                                    type="text"
                                                    value={metaTemplateName}
                                                    onChange={e => setMetaTemplateName(e.target.value)}
                                                    placeholder="e.g. hello_world"
                                                />
                                                {templateError && (
                                                    <span style={{ fontSize: '0.68rem', color: '#ef4444', fontWeight: '500' }}>
                                                        ⚠️ Sync Error: {templateError}
                                                    </span>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() => fetchTemplates()}
                                                    style={{ width: 'max-content', padding: '0.35rem 0.65rem', fontSize: '0.7rem', background: '#f1f5f9', border: '1px solid var(--v2-border)', borderRadius: '6px', cursor: 'pointer', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--v2-text-sub)' }}
                                                >
                                                    🔄 Retry Sync Templates
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    <div className="mkt-field">
                                        <label>Language Code</label>
                                        <input
                                            type="text"
                                            value={metaLang}
                                            onChange={e => setMetaLang(e.target.value)}
                                            placeholder="en_US"
                                            disabled={metaTemplates.length > 0}
                                            style={{ background: metaTemplates.length > 0 ? '#f1f5f9' : 'white', cursor: metaTemplates.length > 0 ? 'not-allowed' : 'text' }}
                                        />
                                    </div>
                                </div>
                                {metaTemplates.length > 0 && (
                                    <div style={{ textAlign: 'right', marginTop: '-0.5rem' }}>
                                        <button 
                                            type="button" 
                                            onClick={() => {
                                                const manualName = prompt('Enter Meta Template name manually:', metaTemplateName);
                                                if (manualName !== null) {
                                                    setMetaTemplateName(manualName);
                                                    const manualLang = prompt('Enter Language Code (e.g. en_US, en, hi):', metaLang);
                                                    if (manualLang) setMetaLang(manualLang);
                                                }
                                            }}
                                            style={{ background: 'none', border: 'none', color: 'var(--v2-primary)', cursor: 'pointer', padding: 0, fontSize: '0.72rem', fontWeight: '700' }}
                                        >
                                            ✍️ Enter Template Manually
                                        </button>
                                    </div>
                                )}

                                {/* Variable Mapping is now completely automatic under the hood. No manual input required. */}

                                {/* Local Preview (optional) */}
                                <div className="mkt-field">
                                    <label>Template Preview Text (local reference only — not sent to Meta)</label>
                                    <textarea
                                        rows="3"
                                        value={templatePreview}
                                        onChange={e => setTemplatePreview(e.target.value)}
                                        placeholder="Paste your approved template text here for reference..."
                                    />
                                </div>
                            </div>
                        ) : (
                            /* Free-text for non-Meta modes */
                            <div className="mkt-field">
                                <label>Message Body</label>
                                <textarea
                                    rows="5"
                                    value={messageText}
                                    onChange={e => setMessageText(e.target.value)}
                                    style={{ resize: 'vertical' }}
                                />
                                <div style={{ fontSize: '0.72rem', color: 'var(--v2-text-muted)', marginTop: '0.4rem' }}>
                                    Use <strong>{`{{name}}`}</strong> to personalise each message with the customer's name.
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Campaign Log */}
                    {(progressLogs.length > 0 || sendSummary) && (
                        <div style={{ background: '#0f172a', borderRadius: '14px', padding: '1.25rem', animation: 'fadeUp 0.3s ease' }}>
                            <h3 style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '0 0 0.75rem', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.08em' }}>📡 Campaign Log</h3>
                            <div style={{ maxHeight: '200px', overflowY: 'auto', fontSize: '0.75rem', fontFamily: 'monospace', lineHeight: 1.7, color: '#10b981' }}>
                                {progressLogs.map((log, i) => <div key={i}>{log}</div>)}
                            </div>
                            {sendSummary && (
                                <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid #1e293b', display: 'flex', gap: '1.5rem', fontSize: '0.85rem', fontWeight: '700' }}>
                                    <span style={{ color: '#10b981' }}>✅ Sent: {sendSummary.sent}</span>
                                    <span style={{ color: '#ef4444' }}>❌ Failed: {sendSummary.failed}</span>
                                    <span style={{ color: '#94a3b8' }}>📊 Total: {sendSummary.sent + sendSummary.failed}</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* ─── RIGHT COLUMN ─────────────────────────────── */}
                <div style={{ position: 'sticky', top: '90px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

                    {/* Campaign Summary Card */}
                    <div className="mkt-step-card">
                        <h2 style={{ fontSize: '0.95rem', fontWeight: '800', margin: '0 0 1.25rem', borderBottom: '1px solid var(--v2-border)', paddingBottom: '0.75rem' }}>Campaign Summary</h2>

                        {/* Stats */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1.25rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ color: 'var(--v2-text-muted)', fontSize: '0.82rem' }}>Matched Customers</span>
                                <strong style={{ color: 'var(--v2-primary)', fontSize: '1.1rem' }}>{filteredCustomers.length}</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ color: 'var(--v2-text-muted)', fontSize: '0.82rem' }}>Active Gateway</span>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: '700', fontSize: '0.82rem', color: gw.color }}>
                                    {gw.icon} {gw.label}
                                </span>
                            </div>
                            {isMetaMode && metaTemplateName && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ color: 'var(--v2-text-muted)', fontSize: '0.82rem' }}>Template</span>
                                    <code style={{ background: '#f1f5f9', padding: '2px 8px', borderRadius: '4px', fontSize: '0.78rem', fontWeight: '700', color: '#334155' }}>{metaTemplateName}</code>
                                </div>
                            )}
                            {estimatedCost && filteredCustomers.length > 0 && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fffbeb', padding: '0.6rem 0.75rem', borderRadius: '8px', border: '1px solid #fde68a', marginTop: '0.25rem' }}>
                                    <span style={{ color: '#92400e', fontSize: '0.8rem', fontWeight: '600' }}>⚡ Est. Meta Cost</span>
                                    <strong style={{ color: '#92400e', fontSize: '0.9rem' }}>₹{estimatedCost}</strong>
                                </div>
                            )}
                        </div>

                        {/* WhatsApp Preview Bubble */}
                        <div style={{ marginBottom: '1.25rem' }}>
                            <div style={{ fontSize: '0.7rem', fontWeight: '700', color: 'var(--v2-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>Preview</div>
                            <div style={{ background: '#e9fbe5', padding: '0.85rem 1rem', borderRadius: '12px 12px 12px 0', boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }}>
                                <div style={{ fontSize: '0.85rem', color: '#111827', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                                    {isMetaMode
                                        ? (templatePreview || `Template: ${metaTemplateName || 'hello_world'}\nLanguage: ${metaLang}${metaParams.length > 0 ? `\nVariables: ${metaParams.map((p, i) => `{{${i+1}}} → ${PARAM_SOURCES.find(s=>s.value===p.source)?.label}`).join(', ')}` : ''}`)
                                        : messageText.replace(/{{name}}/g, filteredCustomers[0]?.name || 'Rahul')}
                                </div>
                                <div style={{ fontSize: '0.6rem', color: '#6b7280', textAlign: 'right', marginTop: '0.35rem' }}>10:42 AM ✓✓</div>
                            </div>
                        </div>

                        {/* Schedule */}
                        <div style={{ marginBottom: '1.25rem' }}>
                            <div style={{ fontSize: '0.72rem', fontWeight: '700', color: 'var(--v2-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Send Timing</div>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                {['now', 'schedule'].map(m => (
                                    <button
                                        key={m}
                                        type="button"
                                        onClick={() => setScheduleMode(m)}
                                        style={{
                                            flex: 1,
                                            padding: '0.55rem',
                                            borderRadius: '8px',
                                            border: `1.5px solid ${scheduleMode === m ? 'var(--v2-primary)' : 'var(--v2-border)'}`,
                                            background: scheduleMode === m ? '#f0fdf4' : 'white',
                                            color: scheduleMode === m ? 'var(--v2-primary)' : 'var(--v2-text-muted)',
                                            fontWeight: '700',
                                            fontSize: '0.78rem',
                                            cursor: 'pointer',
                                            transition: '0.2s',
                                        }}
                                    >
                                        {m === 'now' ? '⚡ Send Now' : '📅 Schedule'}
                                    </button>
                                ))}
                            </div>
                            {scheduleMode === 'schedule' && (
                                <input
                                    type="datetime-local"
                                    value={scheduleAt}
                                    onChange={e => setScheduleAt(e.target.value)}
                                    style={{ marginTop: '0.5rem', width: '100%', padding: '0.6rem 0.75rem', border: '1px solid var(--v2-border)', borderRadius: '8px', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box' }}
                                />
                            )}
                        </div>

                        {/* Blast Button */}
                        <button
                            onClick={handleSendBulk}
                            disabled={filteredCustomers.length === 0 || isSending}
                            style={{
                                width: '100%',
                                padding: '1rem',
                                background: filteredCustomers.length === 0 || isSending ? '#94a3b8' : 'linear-gradient(135deg, #10b981, #059669)',
                                color: 'white',
                                border: 'none',
                                borderRadius: '10px',
                                fontWeight: '800',
                                fontSize: '0.95rem',
                                cursor: filteredCustomers.length === 0 || isSending ? 'not-allowed' : 'pointer',
                                transition: '0.2s',
                                letterSpacing: '0.01em',
                                boxShadow: filteredCustomers.length === 0 || isSending ? 'none' : '0 4px 12px rgba(16,185,129,0.35)',
                            }}
                        >
                            {isSending ? '⏳ Sending in Progress...' : `🚀 Blast to ${filteredCustomers.length} Customers`}
                        </button>

                        {/* Footer note */}
                        <p style={{ fontSize: '0.68rem', color: 'var(--v2-text-muted)', textAlign: 'center', margin: '0.75rem 0 0' }}>
                            ~500ms rate-limit delay between sends to avoid spam flags.
                        </p>
                    </div>

                    {/* Link to Integrations */}
                    <a
                        href="/v2/settings/integrations"
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.75rem', background: 'white', border: '1px solid var(--v2-border)', borderRadius: '10px', fontSize: '0.8rem', fontWeight: '700', color: 'var(--v2-text-muted)', textDecoration: 'none', transition: 'all 0.2s' }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--v2-primary)'; e.currentTarget.style.color = 'var(--v2-primary)'; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--v2-border)'; e.currentTarget.style.color = 'var(--v2-text-muted)'; }}
                    >
                        ⚙️ Manage Gateway Settings in Integrations
                    </a>
                </div>
            </div>
        </Layout>
    );
}

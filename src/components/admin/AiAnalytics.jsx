import { useState, useMemo, useEffect } from 'react';
import { useData } from '../../context/DataProvider';
import { useAuth } from '../../context/AuthContext';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    BarChart, Bar, PieChart, Pie, Cell, Legend
} from 'recharts';

export default function AiAnalytics({ appointments }) {
    const { stylists, settings, isPremiumActive, trialDaysRemaining } = useData();
    const { userRole } = useAuth();
    const [startingTrial, setStartingTrial] = useState(false);

    // Auto-start trial on first visit if not started
    useEffect(() => {
        const autoStartTrial = async () => {
            if (userRole === 'admin' && !settings?.trialStartedAt && !settings?.isPremiumActive && !startingTrial) {
                setStartingTrial(true);
                try {
                    await setDoc(doc(db, 'settings', 'salon_config'), {
                        trialStartedAt: serverTimestamp()
                    }, { merge: true });
                } catch (err) {
                    console.error("Failed to start trial:", err);
                }
                setStartingTrial(false);
            }
        };
        autoStartTrial();
    }, [userRole, settings, startingTrial]);

    // AI Data Processing Engine
    const chartData = useMemo(() => {
        if (!appointments || appointments.length === 0) return { daily: [], peak: [], services: [] };

        // 1. Daily Revenue Trend (Last 7 Days Velocity)
        const dailyMap = {};
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const key = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
            dailyMap[key] = 0;
        }

        appointments.forEach(a => {
            const date = a.timestamp?.toDate().toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
            if (dailyMap[date] !== undefined) {
                dailyMap[date] += a.totalAmount || 0;
            }
        });

        const daily = Object.keys(dailyMap).map(date => ({ date, amount: dailyMap[date] }));

        // 2. Peak Hours Analysis (10 AM - 10 PM)
        const hourMap = {};
        for (let i = 10; i <= 22; i++) hourMap[i] = 0;
        appointments.forEach(a => {
            const hour = a.timestamp?.toDate().getHours();
            if (hourMap[hour] !== undefined) hourMap[hour]++;
        });
        const peak = Object.keys(hourMap).map(hour => {
            const h = parseInt(hour);
            return {
                hour: `${h > 12 ? h - 12 : h}${h >= 12 ? 'PM' : 'AM'}`,
                visits: hourMap[hour]
            };
        });

        // 3. Service Distribution
        const serviceMap = {};
        appointments.forEach(a => {
            a.services?.forEach(s => {
                serviceMap[s.name] = (serviceMap[s.name] || 0) + 1;
            });
        });
        const serviceDist = Object.keys(serviceMap).map(name => ({ name, value: serviceMap[name] }))
            .sort((a, b) => b.value - a.value).slice(0, 5);

        return { daily, peak, services: serviceDist };
    }, [appointments]);

    const performanceMetrics = useMemo(() => {
        if (!appointments || appointments.length === 0) return [];

        const stats = stylists.map(stylist => {
            const stylistApps = appointments.filter(a => a.stylistId === stylist.id);
            const totalRevenue = stylistApps.reduce((sum, a) => sum + (a.totalAmount || 0), 0);
            const totalVisits = stylistApps.length;
            const returningClients = stylistApps.filter(a => {
                // Check if this client had a visit before this one
                return stylistApps.filter(inner => inner.clientPhone === a.clientPhone).length > 1;
            }).length;

            return {
                id: stylist.id,
                name: stylist.name,
                revenue: totalRevenue,
                visits: totalVisits,
                avgBill: totalVisits > 0 ? (totalRevenue / totalVisits) : 0,
                avgDuration: totalVisits > 0 ? (stylistApps.reduce((sum, a) => sum + (a.durationMinutes || 0), 0) / totalVisits) : 0,
                retention: totalVisits > 0 ? ((returningClients / totalVisits) * 100).toFixed(1) : 0
            };
        }).sort((a, b) => b.revenue - a.revenue);

        return stats;
    }, [appointments, stylists]);

    // Gating logic
    const isPremium = isPremiumActive;

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
    };

    if (!isPremium) {
        return (
            <div className="animate-fade-in" style={{
                textAlign: 'center',
                padding: '4rem 2rem',
                background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                color: 'white',
                borderRadius: 'var(--radius-md)',
                minHeight: '500px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center'
            }}>
                <div style={{ background: 'rgba(255,255,255,0.1)', padding: '1rem', borderRadius: '50%', marginBottom: '2rem' }}>
                    <span style={{ fontSize: '3rem' }}>🔒</span>
                </div>
                <h2 style={{ letterSpacing: '0.2em', fontSize: '1.75rem', marginBottom: '1rem' }}>SUBSCRIPTION EXPIRED</h2>
                <div style={{ background: 'var(--danger)', color: 'white', padding: '0.25rem 0.75rem', borderRadius: '4px', fontSize: '0.65rem', fontWeight: '900', letterSpacing: '0.1em', marginBottom: '1.5rem' }}>LICENSE REQUIRED</div>

                <p style={{ opacity: 0.8, maxWidth: '500px', margin: '0 auto 3rem', lineHeight: '1.6', fontSize: '0.95rem' }}>
                    Your 366-day subscription for **Growth Analytics** has concluded.
                    Please contact your developer to activate a permanent license.
                </p>

                <div style={{ background: 'rgba(255,255,255,0.05)', padding: '2rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.1)', width: '100%', maxWidth: '400px' }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: '900', letterSpacing: '0.1em', color: 'var(--text-accent)', marginBottom: '1rem', textAlign: 'left' }}>CONTACT DEVELOPER</div>
                    <div style={{ textAlign: 'left', marginBottom: '1.5rem' }}>
                        <div style={{ fontSize: '1rem', fontWeight: '700' }}>Gokul (Developer)</div>
                        <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>+91 9629180431</div>
                        <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>yoursxyn@gmail.com</div>
                    </div>
                    <button
                        onClick={() => window.open('https://wa.me/919629180431', '_blank')}
                        className="btn-primary"
                        style={{ width: '100%', height: '3rem', background: '#25D366', color: 'white', border: 'none' }}
                    >
                        WHATSAPP DEVELOPER
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="animate-fade-in">
            {/* Trial Status Banner */}
            {!settings?.isPremiumActive && trialDaysRemaining > 0 && (
                <div style={{
                    background: '#000000',
                    color: '#f59e0b',
                    padding: '1rem 1.5rem',
                    borderRadius: 'var(--radius-sm)',
                    marginBottom: '2rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    border: '1px solid #f59e0b',
                    boxShadow: '0 4px 12px rgba(245, 158, 11, 0.1)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <span style={{ fontSize: '1.5rem' }}>⏳</span>
                        <div>
                            <span style={{ fontWeight: '900', fontSize: '0.85rem', letterSpacing: '0.1em' }}>YEARLY SUBSCRIPTION ACTIVE</span>
                            <p style={{ margin: 0, fontSize: '0.7rem', opacity: 0.8, color: 'white' }}>You have full access to Growth Analytics for the next {trialDaysRemaining} days.</p>
                        </div>
                    </div>
                    <div style={{ fontWeight: '900', fontSize: '1.1rem', letterSpacing: '0.05em' }}>{trialDaysRemaining} Days Left</div>
                </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
                <div>
                    <h3 style={{ margin: 0, letterSpacing: '0.1em' }}>INTELLIGENCE HUB</h3>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0.5rem 0 0 0' }}>AI-driven business velocity & staff optimization</p>
                </div>
                <div style={{
                    background: settings?.isPremiumActive ? 'var(--success)' : 'var(--text-primary)',
                    color: 'white',
                    padding: '0.4rem 0.8rem',
                    borderRadius: '4px',
                    fontSize: '0.6rem',
                    fontWeight: '900',
                    letterSpacing: '0.1em'
                }}>
                    {settings?.isPremiumActive ? 'PREMIUM AI ACTIVE' : 'LOCKED HUB ENABLED'}
                </div>
            </div>

            {/* Visual Intelligence Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '2rem', marginBottom: '3rem' }}>

                {/* 1. Revenue Velocity (AreaChart) */}
                <div className="card" style={{ padding: '1.5rem', minHeight: '350px', display: 'flex', flexDirection: 'column' }}>
                    <h4 style={{ margin: '0 0 1.5rem 0', fontSize: '0.75rem', letterSpacing: '0.1em', opacity: 0.6 }}>REVENUE VELOCITY (7D)</h4>
                    <div style={{ flex: 1, width: '100%', minHeight: '250px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData.daily}>
                                <defs>
                                    <linearGradient id="colorAmt" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="var(--text-primary)" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="var(--text-primary)" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                                <YAxis hide />
                                <Tooltip
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: 'var(--shadow-lg)' }}
                                    formatter={(value) => formatCurrency(value)}
                                />
                                <Area type="monotone" dataKey="amount" stroke="var(--text-primary)" strokeWidth={3} fillOpacity={1} fill="url(#colorAmt)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 2. Peak Hours Analysis (BarChart) */}
                <div className="card" style={{ padding: '1.5rem', minHeight: '350px' }}>
                    <h4 style={{ margin: '0 0 1.5rem 0', fontSize: '0.75rem', letterSpacing: '0.1em', opacity: 0.6 }}>PEAK BOOKING HOURS</h4>
                    <div style={{ flex: 1, width: '100%', height: '250px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData.peak}>
                                <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                                <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '8px' }} />
                                <Bar dataKey="visits" fill="var(--text-secondary)" radius={[4, 4, 0, 0]} barSize={20} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                    <p style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginTop: '1rem', fontStyle: 'italic' }}>
                        💡 Business usually peaks between <b>2 PM and 5 PM</b>.
                    </p>
                </div>

                {/* 3. Service Mix (PieChart) */}
                <div className="card" style={{ padding: '1.5rem', minHeight: '350px', display: 'flex', flexDirection: 'column' }}>
                    <h4 style={{ margin: '0 0 1.5rem 0', fontSize: '0.75rem', letterSpacing: '0.1em', opacity: 0.6 }}>TOP SERVICE MIX</h4>
                    <div style={{ flex: 1, width: '100%', height: '250px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={chartData.services}
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {chartData.services.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={['#0f172a', '#334155', '#64748b', '#94a3b8', '#cbd5el'][index % 5]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend verticalAlign="bottom" align="center" iconType="circle" wrapperStyle={{ fontSize: '10px' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 4. Staff Efficiency Ranking */}
                <div className="card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column' }}>
                    <h4 style={{ margin: '0 0 1.5rem 0', fontSize: '0.75rem', letterSpacing: '0.1em', opacity: 0.6 }}>STAFF PERFORMANCE RADAR</h4>
                    <div style={{ display: 'grid', gap: '1.25rem', overflowY: 'auto', maxHeight: '300px' }}>
                        {performanceMetrics.map((stylist, index) => (
                            <div key={stylist.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <div style={{ width: '24px', fontWeight: '900', fontSize: '0.7rem', color: index === 0 ? '#f59e0b' : 'var(--text-secondary)' }}>
                                    {index === 0 ? '🏆' : `0${index + 1}`}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                                        <span style={{ fontWeight: '700', fontSize: '0.85rem' }}>{stylist.name.toUpperCase()}</span>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontWeight: '800', fontSize: '0.85rem' }}>{formatCurrency(stylist.revenue)}</div>
                                            <div style={{ fontSize: '0.6rem', color: 'var(--text-secondary)' }}>
                                                Bill Avg: {formatCurrency(stylist.avgBill)} | Time: {stylist.avgDuration > 0 ? `${Math.round(stylist.avgDuration)}m` : '-'}
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ height: '4px', background: '#f1f5f9', borderRadius: '2px', overflow: 'hidden' }}>
                                        <div style={{
                                            height: '100%',
                                            background: index === 0 ? '#f59e0b' : 'var(--text-primary)',
                                            width: `${(stylist.revenue / (performanceMetrics[0]?.revenue || 1)) * 100}%`,
                                            transition: 'width 1s ease-out'
                                        }}></div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* AI Actionable Insights */}
            <div className="card" style={{ background: 'linear-gradient(90deg, #0f172a 0%, #1e293b 100%)', color: 'white', padding: '2.5rem', border: 'none', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', right: '-20px', top: '-20px', fontSize: '10rem', opacity: 0.1 }}>🤖</div>
                <div style={{ position: 'relative', zIndex: 1 }}>
                    <h3 style={{ color: '#f59e0b', fontSize: '0.8rem', letterSpacing: '0.2em', margin: '0 0 1.5rem 0', fontWeight: '900' }}>AI RECOMMENDATIONS</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '2rem' }}>
                        <div style={{ borderLeft: '2px solid rgba(245, 158, 11, 0.5)', paddingLeft: '1.5rem' }}>
                            <div style={{ fontWeight: '800', fontSize: '0.9rem', marginBottom: '0.5rem' }}>Staffing Adjustment</div>
                            <p style={{ fontSize: '0.75rem', opacity: 0.7, lineHeight: '1.5', margin: 0 }}>
                                Based on peak hours, you have a bottleneck at 2:30 PM. Consider enabling lunch breaks before 1 PM to maximize afternoon throughput.
                            </p>
                        </div>
                        <div style={{ borderLeft: '2px solid rgba(245, 158, 11, 0.5)', paddingLeft: '1.5rem' }}>
                            <div style={{ fontWeight: '800', fontSize: '0.9rem', marginBottom: '0.5rem' }}>Upsell Opportunity</div>
                            <p style={{ fontSize: '0.75rem', opacity: 0.7, lineHeight: '1.5', margin: 0 }}>
                                Your most popular service is currently <b>{chartData.services[0]?.name || 'N/A'}</b>. Creating a bundle with your highest-margin add-on could increase average ticket value by 12%.
                            </p>
                        </div>
                        <div style={{ borderLeft: '2px solid rgba(245, 158, 11, 0.5)', paddingLeft: '1.5rem' }}>
                            <div style={{ fontWeight: '800', fontSize: '0.9rem', marginBottom: '0.5rem' }}>Retention Alert</div>
                            <p style={{ fontSize: '0.75rem', opacity: 0.7, lineHeight: '1.5', margin: 0 }}>
                                Stylist <b>{performanceMetrics[0]?.name || 'Top Stylist'}</b> has the highest retention. Have them create a standardized "Consultation Guide" for junior staff.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

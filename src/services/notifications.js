import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import { decrypt } from '../v2/utils/crypto';

/**
 * Sends a generic WhatsApp notification using the configured integration gateway.
 */
export const sendNotification = async (clientPhone, messageText, templateName = null, clientName = 'Customer', params = {}) => {
    try {
        const snap = await getDoc(doc(db, 'settings', 'integrations'));
        if (!snap.exists()) return { success: false, error: 'No integrations configured' };
        
        const config = snap.data();
        const mode = config.whatsappMode || 'web';
        
        let phone = String(clientPhone).replace(/\D/g, '');
        if (!phone) return { success: false, error: 'No phone number' };
        if (phone.length === 10) phone = '91' + phone;

        // Custom template replacement for free-text modes
        let bodyText = messageText || '';
        bodyText = bodyText.replace(/{{name}}/g, clientName);
        Object.keys(params).forEach(k => {
            bodyText = bodyText.replace(new RegExp(`{{${k}}}`, 'g'), params[k]);
        });

        if (mode === 'web') {
            const url = `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(bodyText)}`;
            window.open(url, '_blank');
            return { success: true, mode: 'web' };
        }

        if (mode === 'ultramsg') {
            const token = decrypt(config.ultramsgToken);
            if (!config.ultramsgInstanceId || !token) throw new Error('Missing UltraMsg configuration credentials');
            
            const url = `https://api.ultramsg.com/${config.ultramsgInstanceId}/messages/chat`;
            const body = new URLSearchParams({ token, to: phone, body: bodyText });
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: body.toString()
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            return { success: true, mode: 'ultramsg' };
        }

        if (mode === 'meta') {
            const token = decrypt(config.metaAccessToken);
            if (!config.metaPhoneNumberId || !token) throw new Error('Missing Meta Access Token or Phone Number ID');

            const url = `https://graph.facebook.com/v22.0/${config.metaPhoneNumberId}/messages`;
            const payload = {
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to: phone,
                type: 'template',
                template: {
                    name: templateName || config.appointmentTemplate || 'hello_world',
                    language: { code: 'en_US' }
                }
            };

            // Map variables if provided
            if (params.variables && params.variables.length > 0) {
                payload.template.components = [{
                    type: 'body',
                    parameters: params.variables.map(v => ({ type: 'text', text: String(v) }))
                }];
            }

            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error.message || 'Meta API error');
            return { success: true, mode: 'meta' };
        }

        if (mode === 'webhook') {
            if (!config.webhookUrl) throw new Error('Missing Webhook Endpoint URL');
            let headers = {};
            try { headers = JSON.parse(config.webhookHeaders); } catch (_) {}
            const bodyStr = config.webhookPayload
                .replace(/{{phone}}/g, phone)
                .replace(/{{message}}/g, bodyText);
            
            const res = await fetch(config.webhookUrl, {
                method: 'POST',
                headers,
                body: bodyStr
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return { success: true, mode: 'webhook' };
        }

        return { success: false, error: 'Unsupported mode' };
    } catch (e) {
        console.error('Notification dispatch error:', e);
        return { success: false, error: e.message };
    }
};

/**
 * Auto-triggers appointment confirmations if the integration toggle is enabled.
 */
export const triggerAppointmentNotification = async (appointment) => {
    try {
        const snap = await getDoc(doc(db, 'settings', 'integrations'));
        if (!snap.exists()) return;
        const config = snap.data();
        if (!config.triggerAppointment) return;

        const clientName = appointment.clientName || 'Customer';
        const clientPhone = appointment.clientPhone;
        if (!clientPhone) return;

        const apptDate = appointment.timestamp?.toDate ? appointment.timestamp.toDate() : new Date(appointment.timestamp);
        const dateStr = apptDate.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' });
        const timeStr = apptDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
        const servicesStr = (appointment.services || []).map(s => s.name).join(', ') || 'salon services';
        const stylistStr = appointment.stylistName || 'our staff';

        let messageText = config.appointmentTemplate || `Hi {{name}}! Your appointment at Hashtag Salon for ${servicesStr} with ${stylistStr} on ${dateStr} at ${timeStr} is officially CONFIRMED!`;
        const variables = [clientName, servicesStr, dateStr, timeStr];

        await sendNotification(clientPhone, messageText, config.appointmentTemplate, clientName, {
            service: servicesStr,
            date: dateStr,
            time: timeStr,
            stylist: stylistStr,
            variables
        });
    } catch (error) {
        console.error("Failed to trigger appointment notification:", error);
    }
};

/**
 * Auto-triggers payment receipts if the integration toggle is enabled.
 */
export const triggerPaymentNotification = async (appointment) => {
    try {
        const snap = await getDoc(doc(db, 'settings', 'integrations'));
        if (!snap.exists()) return;
        const config = snap.data();
        if (!config.triggerPayment) return;

        const clientName = appointment.clientName || 'Customer';
        const clientPhone = appointment.clientPhone;
        if (!clientPhone) return;

        const totalAmountStr = String(appointment.totalAmount);
        const servicesStr = [...(appointment.services || []), ...(appointment.products || [])].map(s => s.name).join(', ') || 'salon services';

        let messageText = config.paymentTemplate || `Hi {{name}}! Thank you for visiting Hashtag Salon. Your payment of ₹${totalAmountStr} for ${servicesStr} was successful. We hope to see you again soon!`;
        const variables = [clientName, totalAmountStr, servicesStr];

        await sendNotification(clientPhone, messageText, config.paymentTemplate, clientName, {
            amount: totalAmountStr,
            service: servicesStr,
            variables
        });
    } catch (error) {
        console.error("Failed to trigger payment notification:", error);
    }
};

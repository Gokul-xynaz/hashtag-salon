/* eslint-disable */
import { doc, getDoc } from 'firebase/firestore';
import { db, functions } from './firebase';
import { httpsCallable } from 'firebase/functions';

/**
 * Sends a generic WhatsApp notification using the configured integration gateway.
 * (Now restricted to 'web' mode only to prevent API secret exposure).
 */
export const sendNotification = async (clientPhone, messageText, templateName = null, clientName = 'Customer', params = {}) => {
    try {
        const snap = await getDoc(doc(db, 'settings', 'integrations'));
        if (!snap.exists()) return { success: false, error: 'No integrations configured' };
        
        const config = snap.data();
        const mode = config.whatsappMode || 'web';
        
        if (mode === 'web') {
            let phone = String(clientPhone).replace(/\D/g, '');
            if (!phone) return { success: false, error: 'No phone number' };
            if (phone.length === 10) phone = '91' + phone;

            let bodyText = messageText || '';
            bodyText = bodyText.replace(/{{name}}/g, clientName);
            Object.keys(params).forEach(k => {
                bodyText = bodyText.replace(new RegExp(`{{${k}}}`, 'g'), params[k]);
            });

            const url = `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(bodyText)}`;
            window.open(url, '_blank');
            return { success: true, mode: 'web' };
        }

        return { success: false, error: 'Direct API sends are deprecated. Use event triggers.' };
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
        if (!appointment.id) return;
        const snap = await getDoc(doc(db, 'settings', 'integrations'));
        if (!snap.exists()) return;
        const config = snap.data();
        if (!config.triggerAppointment) return;

        if (config.whatsappMode !== 'web') {
            const sendWhatsApp = httpsCallable(functions, 'sendWhatsApp');
            await sendWhatsApp({ appointmentId: appointment.id, eventType: 'booking_confirmation' });
            return;
        }

        // Fallback for WhatsApp Web mode
        const clientName = appointment.clientName || 'Customer';
        const clientPhone = appointment.clientPhone;
        if (!clientPhone) return;

        const apptDate = appointment.timestamp?.toDate ? appointment.timestamp.toDate() : new Date(appointment.timestamp);
        const dateStr = apptDate.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' });
        const timeStr = apptDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
        const servicesStr = (appointment.services || []).map(s => s.name).join(', ') || 'salon services';
        const stylistStr = appointment.stylistName || 'our staff';

        let messageText = config.appointmentTemplate || `Hi {{name}}! Your appointment at Hashtag unisex salon for ${servicesStr} with ${stylistStr} on ${dateStr} at ${timeStr} is officially CONFIRMED!`;
        const variables = [clientName, servicesStr, dateStr, timeStr];
        const langCode = config.appointmentTemplateLanguage || 'en_US';

        await sendNotification(clientPhone, messageText, config.appointmentTemplate, clientName, {
            service: servicesStr,
            date: dateStr,
            time: timeStr,
            stylist: stylistStr,
            variables,
            languageCode: langCode
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
        if (!appointment.id) return;
        const snap = await getDoc(doc(db, 'settings', 'integrations'));
        if (!snap.exists()) return;
        const config = snap.data();
        if (!config.triggerPayment) return;

        if (config.whatsappMode !== 'web') {
            const sendWhatsApp = httpsCallable(functions, 'sendWhatsApp');
            await sendWhatsApp({ appointmentId: appointment.id, eventType: 'payment_confirmation' });
            return;
        }

        // Fallback for WhatsApp Web mode
        const clientName = appointment.clientName || 'Customer';
        const clientPhone = appointment.clientPhone;
        if (!clientPhone) return;

        const totalAmountStr = String(appointment.totalAmount);
        const servicesStr = [...(appointment.services || []), ...(appointment.products || [])].map(s => s.name).join(', ') || 'salon services';

        let messageText = config.paymentTemplate || `Hi {{name}}! Thank you for visiting Hashtag unisex salon. Your payment of ₹${totalAmountStr} for ${servicesStr} was successful. We hope to see you again soon!`;
        const variables = [clientName, totalAmountStr, servicesStr];
        const langCode = config.paymentTemplateLanguage || 'en_US';

        await sendNotification(clientPhone, messageText, config.paymentTemplate, clientName, {
            amount: totalAmountStr,
            service: servicesStr,
            variables,
            languageCode: langCode
        });
    } catch (error) {
        console.error("Failed to trigger payment notification:", error);
    }
};

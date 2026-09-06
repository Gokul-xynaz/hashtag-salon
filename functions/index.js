import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp, FieldValue } from "firebase-admin/firestore";
import { FLAT_SERVICES } from "./hashtagServices.js";
import { BUSINESS_HOURS } from "./businessHours.js";
import { normalizeIndianPhone } from "./phoneUtils.js";

initializeApp();
const db = getFirestore();

async function dispatchWhatsAppMessage(appointmentId, eventType) {
    const eventRef = db.collection("notification_events").doc(`${appointmentId}_${eventType}`);
    
    let shouldSend = false;
    await db.runTransaction(async (t) => {
        const snap = await t.get(eventRef);
        if (snap.exists) {
            const status = snap.data().status;
            if (status === "processing" || status === "sent") {
                return;
            }
        }
        t.set(eventRef, { status: "processing", createdAt: FieldValue.serverTimestamp() });
        shouldSend = true;
    });

    if (!shouldSend) return;

    try {
        const configSnap = await db.collection("settings").doc("integrations").get();
        if (!configSnap.exists) throw new Error("No integrations configured");
        const config = configSnap.data();

        const apptSnap = await db.collection("appointments").doc(appointmentId).get();
        if (!apptSnap.exists) throw new Error("Appointment not found");
        const appointment = apptSnap.data();

        const cleanPhone = normalizeIndianPhone(appointment.clientPhone);
        if (!cleanPhone) throw new Error("Invalid phone number format");

        let messageText = "";
        let templateName = "";
        const clientName = appointment.clientName || 'Customer';
        
        const apptDate = appointment.timestamp?.toDate ? appointment.timestamp.toDate() : new Date(appointment.timestamp);
        const dateStr = apptDate.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' });
        const timeStr = apptDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
        const servicesStr = [...(appointment.services || []), ...(appointment.products || [])].map(s => s.name).join(', ') || 'salon services';
        const stylistStr = appointment.stylistName || 'our staff';
        const totalAmountStr = String(appointment.totalAmount || 0);

        let variables = [];
        let langCode = 'en_US';

        if (eventType === 'booking_confirmation') {
            if (!config.triggerAppointment) throw new Error("Booking trigger disabled");
            messageText = config.appointmentTemplate || `Hi {{name}}! Your appointment at Hashtag unisex salon for ${servicesStr} with ${stylistStr} on ${dateStr} at ${timeStr} is officially CONFIRMED!`;
            templateName = config.appointmentTemplate || 'hello_world';
            variables = [clientName, servicesStr, dateStr, timeStr];
            langCode = config.appointmentTemplateLanguage || 'en_US';
        } else if (eventType === 'payment_confirmation') {
            if (!config.triggerPayment) throw new Error("Payment trigger disabled");
            messageText = config.paymentTemplate || `Hi {{name}}! Thank you for visiting Hashtag unisex salon. Your payment of ₹${totalAmountStr} for ${servicesStr} was successful. We hope to see you again soon!`;
            templateName = config.paymentTemplate || 'hello_world';
            variables = [clientName, totalAmountStr, servicesStr];
            langCode = config.paymentTemplateLanguage || 'en_US';
        } else {
            throw new Error("Unknown event type");
        }

        messageText = messageText.replace(/{{name}}/g, clientName)
            .replace(/{{service}}/g, servicesStr)
            .replace(/{{date}}/g, dateStr)
            .replace(/{{time}}/g, timeStr)
            .replace(/{{stylist}}/g, stylistStr)
            .replace(/{{amount}}/g, totalAmountStr);

        const mode = config.whatsappMode || 'web';

        if (mode === 'meta') {
            const token = metaTokenSecret.value();
            if (!config.metaPhoneNumberId || !token) throw new Error("Missing Meta configuration or secrets");

            const payload = {
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to: cleanPhone,
                type: 'template',
                template: {
                    name: templateName,
                    language: { code: langCode.startsWith('en') ? 'en' : langCode }
                }
            };

            if (variables.length > 0) {
                payload.template.components = [{
                    type: 'body',
                    parameters: variables.map(v => ({ type: 'text', text: String(v) }))
                }];
            }

            const res = await fetch(`https://graph.facebook.com/v22.0/${config.metaPhoneNumberId}/messages`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error.message);
        } else if (mode === 'ultramsg') {
            const token = ultraMsgTokenSecret.value();
            if (!config.ultramsgInstanceId || !token) throw new Error('Missing UltraMsg credentials');
            
            const body = new URLSearchParams({ token, to: cleanPhone, body: messageText });
            const res = await fetch(`https://api.ultramsg.com/${config.ultramsgInstanceId}/messages/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: body.toString()
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
        } else if (mode === 'webhook') {
            if (!config.webhookUrl) throw new Error('Missing Webhook URL');
            let headers = {};
            try { headers = JSON.parse(config.webhookHeaders); } catch (_) {}
            const bodyStr = config.webhookPayload
                .replace(/{{phone}}/g, cleanPhone)
                .replace(/{{message}}/g, messageText);
            
            const res = await fetch(config.webhookUrl, {
                method: 'POST',
                headers,
                body: bodyStr
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
        } else {
            throw new Error("Unsupported or client-side mode");
        }

        await eventRef.update({ status: "sent", sentAt: FieldValue.serverTimestamp() });

    } catch (e) {
        console.error("dispatchWhatsAppMessage error:", e);
        await eventRef.update({ status: "failed", error: e.message, failedAt: FieldValue.serverTimestamp() });
        throw e;
    }
}

const metaTokenSecret = defineSecret("META_ACCESS_TOKEN");
const ultraMsgTokenSecret = defineSecret("ULTRAMSG_TOKEN");

const CALLABLE_OPTS = { 
    region: "asia-south1", 
    cors: true, 
    secrets: [metaTokenSecret, ultraMsgTokenSecret] 
};

export const sendWhatsApp = onCall(CALLABLE_OPTS, async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in.");
    const data = request.data;
    const { appointmentId, eventType } = data;
    
    if (!appointmentId || !eventType) {
        throw new HttpsError("invalid-argument", "Missing arguments.");
    }
    
    try {
        await dispatchWhatsAppMessage(appointmentId, eventType);
        return { success: true };
    } catch (e) {
        throw new HttpsError("internal", e.message);
    }
});

export const testWhatsApp = onCall(CALLABLE_OPTS, async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in.");
    const { phone } = request.data;
    if (!phone) throw new HttpsError("invalid-argument", "Missing phone number.");
    
    const cleanPhone = normalizeIndianPhone(phone);
    if (!cleanPhone) throw new HttpsError("invalid-argument", "Invalid Indian mobile number.");

    try {
        const configSnap = await db.collection("settings").doc("integrations").get();
        if (!configSnap.exists) throw new Error("No integrations configured");
        const config = configSnap.data();
        const mode = config.whatsappMode || 'web';
        const messageText = "👋 Test message from Hashtag Integration Hub!";

        if (mode === 'meta') {
            const token = metaTokenSecret.value();
            if (!config.metaPhoneNumberId || !token) throw new Error("Missing Meta configuration or secrets");
            const res = await fetch(`https://graph.facebook.com/v22.0/${config.metaPhoneNumberId}/messages`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messaging_product: 'whatsapp',
                    recipient_type: 'individual',
                    to: cleanPhone,
                    type: 'template',
                    template: { name: 'hello_world', language: { code: 'en_US' } }
                })
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error.message);
        } else if (mode === 'ultramsg') {
            const token = ultraMsgTokenSecret.value();
            if (!config.ultramsgInstanceId || !token) throw new Error('Missing UltraMsg credentials');
            const body = new URLSearchParams({ token, to: cleanPhone, body: messageText });
            const res = await fetch(`https://api.ultramsg.com/${config.ultramsgInstanceId}/messages/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: body.toString()
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
        } else if (mode === 'webhook') {
            if (!config.webhookUrl) throw new Error('Missing Webhook URL');
            let headers = {};
            try { headers = JSON.parse(config.webhookHeaders); } catch (_) {}
            const bodyStr = config.webhookPayload.replace(/{{phone}}/g, cleanPhone).replace(/{{message}}/g, messageText);
            const res = await fetch(config.webhookUrl, { method: 'POST', headers, body: bodyStr });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
        } else {
            throw new Error("Unsupported mode for test");
        }
        return { success: true };
    } catch (e) {
        throw new HttpsError("internal", e.message);
    }
});

async function getActiveStylists() {
    const snap = await db.collection("users").where("isActive", "!=", false).get();
    return snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(s => s.role !== "admin");
}

function resolveServices(cartItemIds) {
    let totalDuration = 0;
    let totalPrice = 0;
    const resolvedServices = [];
    let hasSkin = false;

    for (const itemId of cartItemIds) {
        const canonicalSvc = FLAT_SERVICES.find(s => s.name === itemId || s.id === itemId);
        if (!canonicalSvc) {
            throw new HttpsError("invalid-argument", `Unknown service ID: ${itemId}`);
        }
        resolvedServices.push({
            id: canonicalSvc.name,
            name: canonicalSvc.name,
            price: typeof canonicalSvc.price === "number" ? canonicalSvc.price : 0,
            duration: canonicalSvc.duration || 30
        });
        totalDuration += canonicalSvc.duration || 30;
        totalPrice += typeof canonicalSvc.price === "number" ? canonicalSvc.price : 0;
        if (canonicalSvc.category?.includes("Skin") || canonicalSvc.category?.includes("Facial")) {
            hasSkin = true;
        }
    }
    return { resolvedServices, totalDuration, totalPrice, hasSkin };
}

export const getAvailability = onCall(CALLABLE_OPTS, async (request) => {
    const data = request.data;
    const { date, cartItemIds, requestedStylistId } = data;

    if (!date || !cartItemIds || !cartItemIds.length) {
        throw new HttpsError("invalid-argument", "Missing date or cart items.");
    }

    const { totalDuration, hasSkin } = resolveServices(cartItemIds);

    const activeStylistMap = await getActiveStylists();
    let pool = hasSkin
        ? activeStylistMap.filter(s => s.name.toLowerCase().includes("uvanciya"))
        : activeStylistMap.filter(s => !s.name.toLowerCase().includes("uvanciya"));

    if (requestedStylistId && requestedStylistId !== "any") {
        pool = pool.filter(s => s.id === requestedStylistId);
    }

    if (pool.length === 0) {
        return { totalDuration, stylistSchedules: [] }; 
    }

    const sDate = new Date(date); sDate.setHours(0, 0, 0, 0);
    const eDate = new Date(date); eDate.setHours(23, 59, 59, 999);

    const apptSnap = await db.collection("appointments")
        .where("timestamp", ">=", Timestamp.fromDate(sDate))
        .where("timestamp", "<=", Timestamp.fromDate(eDate))
        .get();
    const allApps = apptSnap.docs.map(d => d.data())
        .filter(a => a.status !== "cancelled" && a.status !== "void" && a.status !== "no_show");

    const blocksSnap = await db.collection("calendarBlocks")
        .where("date", "==", date)
        .get();
    const allBlocks = blocksSnap.docs.map(d => d.data());

    const stylistSchedules = pool.map(staff => {
        const staffApps = allApps.filter(a => a.stylistId === staff.id || a.stylistId === "multiple" || a.stylistId === "unassigned");
        const staffBlocks = allBlocks.filter(b => b.stylistId === staff.id || !b.stylistId);
        
        const busyIntervals = [];
        staffApps.forEach(a => {
            if (!a.timestamp) return;
            const start = a.timestamp.toDate().getTime();
            const end = start + ((a.totalDuration || 60) * 60 * 1000);
            busyIntervals.push({ start, end });
        });
        
        staffBlocks.forEach(b => {
            const blockStartDt = new Date(date); blockStartDt.setHours(b.startHour || 0, 0, 0, 0);
            const blockEndDt = new Date(date); blockEndDt.setHours(b.endHour || 24, 0, 0, 0);
            busyIntervals.push({ start: blockStartDt.getTime(), end: blockEndDt.getTime() });
        });
        
        return { stylistId: staff.id, busyIntervals };
    });

    return { 
        totalDuration, 
        stylistSchedules 
    };
});

export const createBooking = onCall(CALLABLE_OPTS, async (request) => {
    const data = request.data;
    const { name, phone, notes, cartItemIds, date, time } = data;

    if (!name || !phone || !cartItemIds || !cartItemIds.length || !date || !time) {
        throw new HttpsError("invalid-argument", "Missing required fields.");
    }
    const cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.length !== 10) {
        throw new HttpsError("invalid-argument", "Invalid phone number.");
    }

    const { resolvedServices, totalDuration, totalPrice, hasSkin } = resolveServices(cartItemIds);

    const [h, m] = time.split(':').map(Number);
    const reqStartDt = new Date(date); reqStartDt.setHours(h, m, 0, 0);
    const reqStart = reqStartDt.getTime();
    const reqDurationMs = totalDuration * 60 * 1000;
    const reqEnd = reqStart + reqDurationMs;

    const openingDt = new Date(date); openingDt.setHours(BUSINESS_HOURS.openingHour, 0, 0, 0);
    const closingDt = new Date(date); closingDt.setHours(BUSINESS_HOURS.closingHour, 0, 0, 0);
    
    if (reqStart < openingDt.getTime() || reqEnd > closingDt.getTime()) {
        throw new HttpsError("failed-precondition", "Requested time falls outside of business hours.");
    }

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const rateSnap = await db.collection("appointments")
        .where("clientPhone", "==", cleanPhone)
        .where("createdAt", ">=", Timestamp.fromDate(oneDayAgo))
        .get();
    
    if (rateSnap.size >= 3) {
        throw new HttpsError("resource-exhausted", "Max 3 bookings per 24 hrs allowed.");
    }

    const activeStylistMap = await getActiveStylists();
    const pool = hasSkin
        ? activeStylistMap.filter(s => s.name.toLowerCase().includes("uvanciya"))
        : activeStylistMap.filter(s => !s.name.toLowerCase().includes("uvanciya"));
    
    if (pool.length === 0) {
        throw new HttpsError("failed-precondition", "No eligible professionals found for these services.");
    }

    const sDate = new Date(date); sDate.setHours(0, 0, 0, 0);
    const eDate = new Date(date); eDate.setHours(23, 59, 59, 999);

    const apptSnap = await db.collection("appointments")
        .where("timestamp", ">=", Timestamp.fromDate(sDate))
        .where("timestamp", "<=", Timestamp.fromDate(eDate))
        .get();
    const allApps = apptSnap.docs.map(d => d.data())
        .filter(a => a.status !== "cancelled" && a.status !== "void" && a.status !== "no_show");
        
    const blocksSnap = await db.collection("calendarBlocks")
        .where("date", "==", date)
        .get();
    const allBlocks = blocksSnap.docs.map(d => d.data());

    const freeStaff = pool.filter(staff => {
        const staffApps = allApps.filter(a => a.stylistId === staff.id || a.stylistId === "multiple" || a.stylistId === "unassigned");
        const hasApptCollision = staffApps.some(a => {
            if (!a.timestamp) return false;
            const existingStart = a.timestamp.toDate().getTime();
            const existingEnd = existingStart + ((a.totalDuration || 60) * 60 * 1000);
            return (reqStart < existingEnd && reqEnd > existingStart);
        });
        if (hasApptCollision) return false;

        const staffBlocks = allBlocks.filter(b => b.stylistId === staff.id || !b.stylistId);
        const hasBlockCollision = staffBlocks.some(b => {
            const blockStartDt = new Date(date); blockStartDt.setHours(b.startHour || 0, 0, 0, 0);
            const blockEndDt = new Date(date); blockEndDt.setHours(b.endHour || 24, 0, 0, 0);
            return (reqStart < blockEndDt.getTime() && reqEnd > blockStartDt.getTime());
        });
        if (hasBlockCollision) return false;

        return true;
    });

    if (freeStaff.length === 0) {
        throw new HttpsError("failed-precondition", "Sorry, this time slot is no longer available.");
    }

    const resolvedStylist = freeStaff[0];
    
    const lockRef = db.collection("locks").doc(`booking_${resolvedStylist.id}_${date}`);
    const newApptRef = db.collection("appointments").doc();

    await db.runTransaction(async (t) => {
        await t.get(lockRef);

        const txApptsSnap = await t.get(db.collection("appointments")
            .where("stylistId", "==", resolvedStylist.id)
            .where("timestamp", ">=", Timestamp.fromDate(sDate))
            .where("timestamp", "<=", Timestamp.fromDate(eDate)));
            
        const txAppts = txApptsSnap.docs.map(d => d.data())
            .filter(a => a.status !== "cancelled" && a.status !== "void" && a.status !== "no_show");
            
        const hasOverlap = txAppts.some(a => {
            if (!a.timestamp) return false;
            const existingStart = a.timestamp.toDate().getTime();
            const existingEnd = existingStart + ((a.totalDuration || 60) * 60 * 1000);
            return (reqStart < existingEnd && reqEnd > existingStart);
        });

        if (hasOverlap) {
            throw new HttpsError("aborted", "Slot was just taken by another user. Please try again.");
        }

        const txBlocksSnap = await t.get(db.collection("calendarBlocks").where("date", "==", date));
        const txBlocks = txBlocksSnap.docs.map(d => d.data());
        const hasBlockOverlap = txBlocks.some(b => {
            if (b.stylistId && b.stylistId !== resolvedStylist.id) return false;
            const blockStartDt = new Date(date); blockStartDt.setHours(b.startHour || 0, 0, 0, 0);
            const blockEndDt = new Date(date); blockEndDt.setHours(b.endHour || 24, 0, 0, 0);
            return (reqStart < blockEndDt.getTime() && reqEnd > blockStartDt.getTime());
        });

        if (hasBlockOverlap) {
            throw new HttpsError("aborted", "Stylist is no longer available at this time.");
        }

        t.set(newApptRef, {
            clientName: name,
            clientPhone: cleanPhone,
            notes: notes || "",
            stylistId: resolvedStylist.id,
            stylistName: resolvedStylist.name,
            services: resolvedServices,
            totalAmount: totalPrice,
            totalDuration: totalDuration,
            timestamp: Timestamp.fromDate(reqStartDt),
            status: "pending",
            source: "online_widget",
            createdAt: FieldValue.serverTimestamp()
        });

        t.set(lockRef, { updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    });

    dispatchWhatsAppMessage(newApptRef.id, 'booking_confirmation').catch(e => {
        console.error(`WhatsApp confirmation failed for ${newApptRef.id}:`, e);
    });

    return {
        bookingId: newApptRef.id,
        stylistId: resolvedStylist.id,
        totalAmount: totalPrice,
        status: "success"
    };
});

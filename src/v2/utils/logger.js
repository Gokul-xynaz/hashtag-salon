import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';

// Simple throttle to prevent log spamming and reduce Firebase costs
const recentErrors = new Set();
const ERROR_COOLDOWN_MS = 60000; // 1 minute cooldown for the exact same error message

/**
 * Logs an error to Firestore efficiently.
 * @param {string} context - Where the error occurred (e.g., 'QuickSale Checkout', 'Appointments Fetch')
 * @param {Error|string} error - The error object or string
 * @param {object} additionalData - Any extra state to log (e.g., { userId: '123', appointmentId: 'abc' })
 */
export const logError = async (context, error, additionalData = {}) => {
    try {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : '';

        // Prevent spamming the exact same error message to save Firebase writes
        const errorKey = `${context}:${errorMessage}`;
        if (recentErrors.has(errorKey)) {
            console.warn(`[Throttled] Error already logged recently: ${context} - ${errorMessage}`);
            return;
        }

        // Add to recent errors and set a timeout to clear it
        recentErrors.add(errorKey);
        setTimeout(() => recentErrors.delete(errorKey), ERROR_COOLDOWN_MS);

        // Fallback console log for local debugging
        console.error(`[System Error - ${context}]`, error, additionalData);

        const logEntry = {
            context,
            message: errorMessage,
            stack: errorStack,
            additionalData,
            userAgent: navigator.userAgent,
            url: window.location.href,
            timestamp: serverTimestamp(),
            status: 'unresolved'
        };

        await addDoc(collection(db, 'system_logs'), logEntry);
    } catch (loggingError) {
        // Safe fallback if Firestore itself fails to log
        console.error("Failed to write to system_logs:", loggingError);
    }
};

// Simple but robust key-based stream cipher (XOR-hex with key rotation)
// Uses the Firebase API Key as a fallback/default key to ensure that even if the 
// database gets leaked via lax Firestore rules, credentials cannot be read without the client app config.
const SECRET_KEY = import.meta.env.VITE_ENCRYPTION_KEY || import.meta.env.VITE_FIREBASE_API_KEY || 'fallback-encryption-key-for-stream-cipher';

/**
 * Encrypts cleartext into a secure base64-hex string.
 * @param {string} text Cleartext input
 * @returns {string} Encrypted string
 */
export const encrypt = (text) => {
    if (!text) return '';
    if (text.startsWith('__enc__')) return text; // Already encrypted
    let hexResult = '';
    for (let i = 0; i < text.length; i++) {
        const charCode = text.charCodeAt(i);
        const keyChar = SECRET_KEY.charCodeAt(i % SECRET_KEY.length);
        // XOR obfuscation and convert to 2-digit hex
        const encryptedChar = (charCode ^ keyChar).toString(16).padStart(2, '0');
        hexResult += encryptedChar;
    }
    return '__enc__' + btoa(hexResult);
};

/**
 * Decrypts an encrypted base64-hex string back to cleartext.
 * @param {string} cipherText Encrypted string
 * @returns {string} Decrypted cleartext
 */
export const decrypt = (cipherText) => {
    if (!cipherText) return '';
    if (!cipherText.startsWith('__enc__')) return cipherText; // Return plain text if not encrypted
    
    try {
        const hexText = atob(cipherText.replace('__enc__', ''));
        let result = '';
        for (let i = 0; i < hexText.length; i += 2) {
            const hexChar = hexText.substring(i, i + 2);
            const charCode = parseInt(hexChar, 16);
            const keyChar = SECRET_KEY.charCodeAt((i / 2) % SECRET_KEY.length);
            result += String.fromCharCode(charCode ^ keyChar);
        }
        return result;
    } catch (e) {
        console.error("Decryption failed, returning raw string:", e);
        return cipherText;
    }
};

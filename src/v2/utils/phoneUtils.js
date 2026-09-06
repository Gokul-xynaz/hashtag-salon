export function normalizeIndianPhone(phone) {
    if (!phone) return null;
    let clean = String(phone).replace(/\D/g, '');
    
    if (clean.length === 10) {
        clean = '91' + clean;
    } else if (clean.length === 11 && clean.startsWith('0')) {
        clean = '91' + clean.substring(1);
    } else if (clean.length === 12 && clean.startsWith('91')) {
        // already has 91
    } else {
        return null; // Invalid length
    }

    const localPart = clean.substring(2);
    const firstDigit = localPart.charAt(0);
    
    // Indian mobile numbers start with 6, 7, 8, or 9
    if (!['6', '7', '8', '9'].includes(firstDigit)) {
        return null;
    }

    return clean;
}

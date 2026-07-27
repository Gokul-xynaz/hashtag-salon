/**
 * Shared utility for resolving stylist IDs and names across the application.
 * Handles database ID matches, name spelling variations (e.g. Uvanciya / Uvanycia, Sandy / Santhosh / Santhose / Santos),
 * and online widget default string IDs.
 */

export const resolveStylistId = (sid, stylistsList) => {
    if (!sid) return null;
    const list = stylistsList || [];
    
    // 1. Direct ID match
    if (list.some(s => s.id === sid)) return sid;
    
    // 2. Name-based or ID-alias match
    const cleanSid = String(sid).trim().toLowerCase();
    
    // Normalize input keys
    let normalized = cleanSid;
    if (cleanSid === 'uvanciya' || cleanSid === 'uvanycia') {
        normalized = 'uvanciya';
    } else if (cleanSid.startsWith('santho') || cleanSid === 'santos' || cleanSid === 'sandy') {
        normalized = 'sandy';
    }
    
    const match = list.find(s => {
        const sName = (s.name || '').trim().toLowerCase();
        const sFirst = sName.split(' ')[0];
        
        // Exact name match
        if (sName === normalized) return true;
        
        // Check spelling variations for Uvanciya
        if (normalized === 'uvanciya') {
            return sName.includes('uvanciya') || sName.includes('uvanycia');
        }
        
        // Check spelling variations for Sandy/Santhosh
        if (normalized === 'sandy') {
            return sName.includes('sandy') || sName.includes('santho') || sName.includes('santos');
        }
        
        // Fallback to first name match
        return sFirst && sFirst === normalized;
    });
    
    return match ? match.id : sid;
};

export const resolveStylistName = (sid, stylistsList, fallbackName = 'Unassigned') => {
    const resolvedId = resolveStylistId(sid, stylistsList);
    const stylist = (stylistsList || []).find(s => s.id === resolvedId);
    return stylist ? stylist.name : (fallbackName || 'Unassigned');
};

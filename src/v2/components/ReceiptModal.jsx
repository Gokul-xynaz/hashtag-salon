import React, { useRef } from 'react';

const fmt = (v) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(v || 0);

export default function ReceiptModal({ bill, onClose, businessInfo = {} }) {
    const receiptRef = useRef();
    const salonName = businessInfo.name || 'Hashtag unisex salon';
    const salonSub = businessInfo.subtitle || '';
    const salonAddress = businessInfo.address || '376, 3A1, Rabindranath Tagore Rd,\nManiyakarampalayam, Ganapathy,\nCoimbatore, Tamil Nadu 641006';
    const salonPhone = businessInfo.phone || '+91 9952618995';
    const salonGST = businessInfo.gst || '33DLWPM2263M1ZG';
    const insta = businessInfo.insta || '@hashtagsalon';

    const allItems = [
        ...(bill?.services || []),
        ...(bill?.products || []),
        ...(bill?.memberships || []),
        ...(bill?.packages || []),
        ...(bill?.walletTopups || []),
    ];

    const handlePrint = () => {
        const printContent = receiptRef.current.innerHTML;
        const originalContent = document.body.innerHTML;
        const printWindow = window.open('', '_blank', 'width=400,height=600');
        printWindow.document.write(`
            <html>
            <head>
                <title>Receipt - ${salonName}</title>
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Courier+Prime:wght@400;700&display=swap');
                    body { font-family: 'Courier Prime', monospace; margin: 0; padding: 20px; font-size: 12px; color: #000; }
                    .dashed-line { border-top: 1px dashed #000; margin: 15px 0; }
                    table { width: 100%; border-collapse: collapse; }
                    td { padding: 4px 0; vertical-align: top; }
                    .text-right { text-align: right; }
                    .text-center { text-align: center; }
                    .bold { font-weight: bold; }
                </style>
            </head>
            <body>
                ${printContent}
                <script>
                    window.onload = function() { window.print(); window.close(); }
                </script>
            </body>
            </html>
        `);
        printWindow.document.close();
    };

    const handleWhatsApp = () => {
        if (!bill?.clientPhone) {
            alert("No phone number found for this client.");
            return;
        }
        
        let text = `*${salonName}*\n${salonSub}\n\n`;
        text += `*INVOICE:*\nDate: ${new Date(bill.timestamp?.seconds ? bill.timestamp.seconds * 1000 : bill.timestamp).toLocaleString('en-IN')}\n`;
        text += `Client: ${bill.clientName || 'Walk-in'}\n`;
        text += `\n*ITEMS:*\n`;
        allItems.forEach(item => {
            let staffSuffix = item.staffName ? ` [by ${item.staffName}]` : '';
            text += `${item.name} (x${item.qty || 1})${staffSuffix} - ${fmt((parseFloat(item.price)||0) * (parseInt(item.qty)||1))}\n`;
        });
        text += `\nSubtotal: ${fmt(bill.subtotal)}\n`;
        if (bill.discountAmount > 0) text += `Discount: -${fmt(bill.discountAmount)}\n`;
        if (bill.gstAmount > 0) text += `GST: ${fmt(bill.gstAmount)}\n`;
        text += `*TOTAL: ${fmt(bill.totalAmount)}*\n\n`;
        text += `Thank you for visiting ${salonName}!`;

        const encoded = encodeURIComponent(text);
        const phone = bill.clientPhone.replace(/\D/g, '');
        window.open(`https://wa.me/91${phone}?text=${encoded}`, '_blank');
    };

    if (!bill) return null;

    const dateStr = new Date(bill.timestamp?.seconds ? bill.timestamp.seconds * 1000 : bill.timestamp).toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(31, 41, 55, 0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px' }}>
            <div style={{ background: '#ffffff', borderRadius: '12px', width: '100%', maxWidth: '420px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
                
                {/* Modal Header */}
                <div style={{ background: 'white', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e5e7eb' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: '800', letterSpacing: '1px', color: '#374151', textTransform: 'uppercase' }}>Receipt</span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        {bill?.clientPhone && (
                            <button onClick={handleWhatsApp} style={{ padding: '6px 12px', background: '#25D366', color: 'white', border: 'none', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                💬 WhatsApp
                            </button>
                        )}
                        <button onClick={handlePrint} style={{ padding: '6px 12px', background: 'white', color: '#1f2937', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            🖨️ Print
                        </button>
                        <button onClick={onClose} style={{ padding: '6px 12px', background: '#1f2937', color: 'white', border: 'none', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            ✕ Close
                        </button>
                    </div>
                </div>

                {/* Receipt Paper Container */}
                <div style={{ padding: '20px', overflowY: 'auto', background: '#ffffff', display: 'flex', justifyContent: 'center' }}>
                    <div ref={receiptRef} style={{ background: 'white', width: '100%', padding: '12px 10px', fontFamily: '"Courier Prime", monospace', fontSize: '13px', color: '#000' }}>
                        
                        <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                            <div style={{ fontSize: '20px', fontWeight: 'bold', letterSpacing: '1px' }}>{salonName}</div>
                            {salonSub && <div style={{ fontWeight: 'bold', marginTop: '4px' }}>{salonSub}</div>}
                            <div style={{ marginTop: '8px', whiteSpace: 'pre-line', lineHeight: '1.4' }}>{salonAddress}</div>
                            <div style={{ marginTop: '8px', fontWeight: 'bold' }}>Ph: {salonPhone}</div>
                            <div style={{ fontWeight: 'bold' }}>GSTIN: {salonGST}</div>
                            <div style={{ marginTop: '4px' }}>📷 {insta}</div>
                        </div>

                        <div className="dashed-line" style={{ borderTop: '1px dashed #000', margin: '16px 0' }}></div>

                        <table style={{ width: '100%', fontSize: '12px' }}>
                            <tbody>
                                <tr>
                                    <td style={{ fontWeight: 'bold' }}>BILL TO:</td>
                                    <td style={{ fontWeight: 'bold', textAlign: 'right' }}>INVOICE DETAILS:</td>
                                </tr>
                                <tr>
                                    <td>
                                        <div>{bill.clientName || 'Walk-in'}</div>
                                        <div>{bill.clientPhone || ''}</div>
                                    </td>
                                    <td style={{ textAlign: 'right' }}>
                                        <div style={{ fontWeight: 'bold' }}>#{ (bill.id || '').substring(0, 8).toUpperCase() }</div>
                                        <div>{dateStr}</div>
                                        <div>Pay Mode: {(bill.paymentType || 'CASH').toUpperCase()}</div>
                                        <div>Styled By: {bill.stylistName || 'N/A'}</div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>

                        <div className="dashed-line" style={{ borderTop: '1px dashed #000', margin: '16px 0' }}></div>

                        <table style={{ width: '100%', fontSize: '12px' }}>
                            <tbody>
                                {allItems.map((item, idx) => (
                                    <tr key={idx}>
                                        <td style={{ paddingBottom: '8px' }}>
                                            <div>{item.name} {item.qty > 1 ? `(x${item.qty})` : ''}</div>
                                            {item.staffName && <div style={{ fontSize: '10px', color: '#555', marginTop: '2px' }}>[by {item.staffName}]</div>}
                                        </td>
                                        <td style={{ paddingBottom: '8px', textAlign: 'right', fontWeight: 'bold' }}>
                                            {fmt((parseFloat(item.price)||0) * (parseInt(item.qty)||1))}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        <div className="dashed-line" style={{ borderTop: '1px dashed #000', margin: '16px 0' }}></div>

                        <table style={{ width: '100%', fontSize: '12px', lineHeight: '1.8' }}>
                            <tbody>
                                <tr>
                                    <td>Subtotal:</td>
                                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{fmt(bill.subtotal)}</td>
                                </tr>
                                {bill.discountAmount > 0 && (
                                    <tr>
                                        <td>Discount {bill.promoCodeUsed ? `(${bill.promoCodeUsed})` : ''}:</td>
                                        <td style={{ textAlign: 'right', fontWeight: 'bold' }}>-{fmt(bill.discountAmount)}</td>
                                    </tr>
                                )}
                                {bill.gstAmount > 0 && (
                                    <tr>
                                        <td>Service GST ({bill.gstPercent}%):</td>
                                        <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{fmt(bill.gstAmount)}</td>
                                    </tr>
                                )}
                                {bill.walletUsed > 0 && (
                                    <tr>
                                        <td>E-Wallet Paid:</td>
                                        <td style={{ textAlign: 'right', fontWeight: 'bold' }}>-{fmt(bill.walletUsed)}</td>
                                    </tr>
                                )}
                                {bill.giftCardDeduction > 0 && (
                                    <tr>
                                        <td>Gift Card Paid:</td>
                                        <td style={{ textAlign: 'right', fontWeight: 'bold' }}>-{fmt(bill.giftCardDeduction)}</td>
                                    </tr>
                                )}
                                {bill.tipAmount > 0 && (
                                    <tr>
                                        <td>Tip:</td>
                                        <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{fmt(bill.tipAmount)}</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>

                        <table style={{ width: '100%', fontSize: '14px', marginTop: '12px' }}>
                            <tbody>
                                <tr>
                                    <td style={{ fontWeight: 'bold' }}>TOTAL:</td>
                                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{fmt(bill.totalAmount)}</td>
                                </tr>
                            </tbody>
                        </table>

                        <div style={{ textAlign: 'center', marginTop: '32px', fontSize: '11px', color: '#333' }}>
                            Thank you for visiting {salonName}!
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
}

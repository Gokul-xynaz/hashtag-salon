// ─── Helpers ────────────────────────────────────────────────────────────────
const fmtDate = (ts) => {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};
const fmtTime = (ts) => {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
};
const getAllItems = (a) => {
  if (a.services || a.products || a.memberships || a.packages) {
    return [
      ...(a.services || []),
      ...(a.products || []),
      ...(a.memberships || []),
      ...(a.packages || []),
      ...(a.walletTopups || []),
      ...(a.walletRecharges || [])
    ];
  }
  return a.items || [];
};

const getProductTotal = (a) => {
  return getAllItems(a)
    .filter(i => i.type === 'product')
    .reduce((s, p) => s + (Number(p.price) || 0) * (Number(p.qty) || 1), 0);
};

const getSalonAmount = (a) => Math.max(0, (a.totalAmount || 0) - getProductTotal(a));

const shortId = (id) => '#' + (id || '').substring(0, 8).toUpperCase();
const svcList = (a) => getAllItems(a).map(s => s.name).filter(Boolean).join(', ') || '—';

// ─── REPORT DEFINITIONS ─────────────────────────────────────────────────────
export const REPORTS = [

  // ── FINANCIAL ──────────────────────────────────────────────────────────────
  {
    id: 'sale-summary',
    title: 'Sale Summary',
    description: 'Comprehensive summary of all completed transactions including payment mode and discount.',
    category: 'financial',
    icon: 'clipboard',
    columns: [
      { key: 'date',         label: 'Date' },
      { key: 'time',         label: 'Time' },
      { key: 'invoiceId',    label: 'Invoice #' },
      { key: 'clientName',   label: 'Client' },
      { key: 'clientPhone',  label: 'Phone' },
      { key: 'stylistName',  label: 'Staff' },
      { key: 'services',     label: 'Services' },
      { key: 'paymentType',  label: 'Payment', badge: true },
      { key: 'discount',     label: 'Discount', format: 'currency' },
      { key: 'totalAmount',  label: 'Amount',   format: 'currency', highlight: true },
    ],
    transform: (appointments) =>
      appointments
        .filter(a => (a.status || 'completed').toLowerCase() === 'completed')
        .map(a => ({
          date:        fmtDate(a.timestamp),
          time:        fmtTime(a.timestamp),
          invoiceId:   shortId(a.id),
          clientName:  a.clientName  || 'Walk-in',
          clientPhone: String(a.clientPhone || '—'),
          stylistName: a.stylistName || '—',
          services:    svcList(a),
          paymentType: (a.paymentType || 'cash').toUpperCase(),
          discount:    a.discount    || 0,
          totalAmount: getSalonAmount(a),
        })),
    summaryCards: [
      { key: 'totalRevenue',  label: 'Total Revenue',   format: 'currency', color: '#10b981' },
      { key: 'totalBills',    label: 'Total Bills',     format: 'number',   color: '' },
      { key: 'avgBill',       label: 'Avg Bill Value',  format: 'currency', color: '#3b82f6' },
      { key: 'totalDiscount', label: 'Total Discount',  format: 'currency', color: '#f59e0b' },
    ],
    summarize: (rows) => ({
      totalRevenue:  rows.reduce((s, r) => s + (r.totalAmount  || 0), 0),
      totalBills:    rows.length,
      avgBill:       rows.length ? rows.reduce((s, r) => s + (r.totalAmount || 0), 0) / rows.length : 0,
      totalDiscount: rows.reduce((s, r) => s + (r.discount || 0), 0),
    }),
  },

  {
    id: 'cancelled-bills',
    title: 'Cancelled / Void Bills',
    description: 'All voided or cancelled invoices. Use this to track revenue leakage.',
    category: 'financial',
    icon: 'x-circle',
    columns: [
      { key: 'date',        label: 'Date' },
      { key: 'time',        label: 'Time' },
      { key: 'invoiceId',   label: 'Invoice #' },
      { key: 'clientName',  label: 'Client' },
      { key: 'stylistName', label: 'Staff' },
      { key: 'services',    label: 'Services' },
      { key: 'status',      label: 'Status', badge: true },
      { key: 'totalAmount', label: 'Amount', format: 'currency' },
    ],
    transform: (appointments) =>
      appointments
        .filter(a => a.status === 'cancelled' || a.status === 'no_show')
        .map(a => ({
          date:        fmtDate(a.timestamp),
          time:        fmtTime(a.timestamp),
          invoiceId:   shortId(a.id),
          clientName:  a.clientName  || 'Walk-in',
          stylistName: a.stylistName || '—',
          services:    svcList(a),
          status:      (a.status || '').toUpperCase().replace('_', ' '),
          totalAmount: a.totalAmount || 0,
        })),
    summaryCards: [
      { key: 'totalCancelled', label: 'Cancelled Bills',   format: 'number',   color: '#dc2626' },
      { key: 'lostRevenue',    label: 'Lost Revenue',      format: 'currency', color: '#dc2626' },
    ],
    summarize: (rows) => ({
      totalCancelled: rows.length,
      lostRevenue:    rows.reduce((s, r) => s + (r.totalAmount || 0), 0),
    }),
  },

  {
    id: 'payment-distributions',
    title: 'Payment Distributions',
    description: 'Breakdown of revenue collected by payment method: Cash, Card, UPI, etc.',
    category: 'financial',
    icon: 'credit-card',
    columns: [
      { key: 'date',        label: 'Date' },
      { key: 'invoiceId',   label: 'Invoice #' },
      { key: 'clientName',  label: 'Client' },
      { key: 'stylistName', label: 'Staff' },
      { key: 'paymentType', label: 'Payment Mode', badge: true },
      { key: 'totalAmount', label: 'Amount', format: 'currency', highlight: true },
    ],
    transform: (appointments) =>
      appointments
        .filter(a => (a.status || 'completed').toLowerCase() === 'completed')
        .map(a => ({
          date:        fmtDate(a.timestamp),
          invoiceId:   shortId(a.id),
          clientName:  a.clientName  || 'Walk-in',
          stylistName: a.stylistName || '—',
          paymentType: (a.paymentType || 'cash').toUpperCase(),
          totalAmount: getSalonAmount(a),
        })),
    summaryCards: [
      { key: 'totalRevenue', label: 'Total Revenue', format: 'currency', color: '#10b981' },
      { key: 'cash',         label: 'Cash',          format: 'currency', color: '#16a34a' },
      { key: 'card',         label: 'Card / UPI',    format: 'currency', color: '#2563eb' },
      { key: 'other',        label: 'Other',         format: 'currency', color: '#7c3aed' },
    ],
    summarize: (rows) => ({
      totalRevenue: rows.reduce((s, r) => s + (r.totalAmount || 0), 0),
      cash:  rows.filter(r => r.paymentType === 'CASH') .reduce((s, r) => s + r.totalAmount, 0),
      card:  rows.filter(r => ['CARD','UPI','ONLINE'].includes(r.paymentType)) .reduce((s, r) => s + r.totalAmount, 0),
      other: rows.filter(r => !['CASH','CARD','UPI','ONLINE'].includes(r.paymentType)).reduce((s, r) => s + r.totalAmount, 0),
    }),
  },

  {
    id: 'daily-revenue',
    title: 'Daily Revenue',
    description: 'Daily collection report showing revenue, bills, and cash vs card for each day.',
    category: 'financial',
    icon: 'calendar',
    columns: [
      { key: 'day',         label: 'Date' },
      { key: 'bills',       label: 'Bills',     format: 'number' },
      { key: 'cash',        label: 'Cash',      format: 'currency' },
      { key: 'card',        label: 'Card/UPI',  format: 'currency' },
      { key: 'discount',    label: 'Discounts', format: 'currency' },
      { key: 'revenue',     label: 'Total',     format: 'currency', highlight: true },
    ],
    transform: (appointments) => {
      const map = {};
      appointments
        .filter(a => (a.status || 'completed').toLowerCase() === 'completed')
        .forEach(a => {
          const d = a.timestamp?.toDate?.() || new Date();
          const key = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
          if (!map[key]) map[key] = { day: key, bills: 0, cash: 0, card: 0, discount: 0, revenue: 0, _ts: d.getTime() };
          map[key].bills++;
          const amount = getSalonAmount(a);
          map[key].revenue  += amount;
          map[key].discount += a.discount     || 0;
          if ((a.paymentType || 'cash') === 'cash') map[key].cash += amount;
          else map[key].card += amount;
        });
      return Object.values(map).sort((a, b) => b._ts - a._ts);
    },
    summaryCards: [
      { key: 'totalRevenue', label: 'Total Revenue', format: 'currency', color: '#10b981' },
      { key: 'totalBills',   label: 'Total Bills',   format: 'number',   color: '' },
      { key: 'avgDaily',     label: 'Avg Daily',     format: 'currency', color: '#3b82f6' },
    ],
    summarize: (rows) => ({
      totalRevenue: rows.reduce((s, r) => s + (r.revenue || 0), 0),
      totalBills:   rows.reduce((s, r) => s + (r.bills   || 0), 0),
      avgDaily:     rows.length ? rows.reduce((s, r) => s + (r.revenue || 0), 0) / rows.length : 0,
    }),
  },

  {
    id: 'sales-discount',
    title: 'Sales Discount',
    description: 'All discounts applied across invoices — who gave them and to which client.',
    category: 'financial',
    icon: 'tag',
    columns: [
      { key: 'date',        label: 'Date' },
      { key: 'invoiceId',   label: 'Invoice #' },
      { key: 'clientName',  label: 'Client' },
      { key: 'stylistName', label: 'Staff' },
      { key: 'discount',    label: 'Discount',   format: 'currency', highlight: true },
      { key: 'totalAmount', label: 'Net Amount', format: 'currency' },
    ],
    transform: (appointments) =>
      appointments
        .filter(a => (a.discount || 0) > 0 && (a.status || 'completed').toLowerCase() === 'completed')
        .map(a => ({
          date:        fmtDate(a.timestamp),
          invoiceId:   shortId(a.id),
          clientName:  a.clientName  || 'Walk-in',
          stylistName: a.stylistName || '—',
          discount:    a.discount    || 0,
          totalAmount: a.totalAmount || 0,
        }))
        .sort((a, b) => b.discount - a.discount),
    summaryCards: [
      { key: 'totalDiscount', label: 'Total Discount Given', format: 'currency', color: '#f59e0b' },
      { key: 'totalBills',    label: 'Bills with Discount',  format: 'number',   color: '' },
    ],
    summarize: (rows) => ({
      totalDiscount: rows.reduce((s, r) => s + (r.discount || 0), 0),
      totalBills:    rows.length,
    }),
  },

  {
    id: 'edited-invoices',
    title: 'Edited Invoices Audit',
    description: 'Security log tracking all invoices modified by administrators, including modification dates and reasons.',
    category: 'financial',
    icon: 'clipboard',
    columns: [
      { key: 'editDate',     label: 'Edit Date' },
      { key: 'invoiceId',    label: 'Invoice #' },
      { key: 'clientName',   label: 'Client' },
      { key: 'originalDate', label: 'Original Date' },
      { key: 'totalAmount',  label: 'New Amount', format: 'currency', highlight: true },
      { key: 'notes',        label: 'Reason / Notes' },
    ],
    transform: (appointments) =>
      appointments
        .filter(a => a.lastEditedByAdminAt)
        .map(a => ({
          editDate:     a.lastEditedByAdminAt ? new Date(a.lastEditedByAdminAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—',
          invoiceId:    shortId(a.id),
          clientName:   a.clientName || 'Walk-in',
          originalDate: fmtDate(a.timestamp),
          totalAmount:  a.totalAmount || 0,
          notes:        a.notes || 'No notes provided',
        })),
    summaryCards: [
      { key: 'totalEdited', label: 'Total Edited Bills', format: 'number', color: '#ef4444' },
    ],
    summarize: (rows) => ({
      totalEdited: rows.length,
    }),
  },

  // ── PRODUCTS ───────────────────────────────────────────────────────────────
  {
    id: 'product-sales',
    title: 'Product Sales',
    description: 'Complete report of all retail products sold through the POS.',
    category: 'products',
    icon: 'shopping-bag',
    columns: [
      { key: 'date',        label: 'Date' },
      { key: 'invoiceId',   label: 'Invoice #' },
      { key: 'productName', label: 'Product' },
      { key: 'clientName',  label: 'Client' },
      { key: 'stylistName', label: 'Staff' },
      { key: 'qty',         label: 'Qty',    format: 'number' },
      { key: 'price',       label: 'Price',  format: 'currency' },
      { key: 'total',       label: 'Total',  format: 'currency', highlight: true },
    ],
    transform: (appointments) => {
      const rows = [];
      appointments
        .filter(a => (a.status || 'completed').toLowerCase() === 'completed')
        .forEach(a => {
          const prods = getAllItems(a).filter(i => i.type === 'product');
          prods.forEach(i => {
              rows.push({
                date:        fmtDate(a.timestamp),
                invoiceId:   shortId(a.id),
                productName: i.name  || '—',
                clientName:  a.clientName  || 'Walk-in',
                stylistName: i.stylistName || a.stylistName || '—',
                qty:         Number(i.qty)   || 1,
                price:       Number(i.price) || 0,
                total:       (Number(i.price) || 0) * (Number(i.qty) || 1),
              });
            });
        });
      return rows;
    },
    summaryCards: [
      { key: 'totalRevenue', label: 'Product Revenue', format: 'currency', color: '#10b981' },
      { key: 'unitsSold',    label: 'Units Sold',      format: 'number',   color: '' },
    ],
    summarize: (rows) => ({
      totalRevenue: rows.reduce((s, r) => s + (Number(r.total) || 0), 0),
      unitsSold:    rows.reduce((s, r) => s + (Number(r.qty)   || 1), 0),
    }),
  },

  {
    id: 'product-inventory',
    title: 'Product Inventory',
    description: 'Current stock levels for all products, with low-stock alerts.',
    category: 'products',
    icon: 'package',
    columns: [
      { key: 'name',     label: 'Product' },
      { key: 'category', label: 'Category' },
      { key: 'stock',    label: 'Stock',       format: 'number' },
      { key: 'price',    label: 'Retail Price', format: 'currency' },
      { key: 'status',   label: 'Status',       badge: true },
    ],
    transform: (_appointments, _expenses, _stylists, products) =>
      (products || []).map(p => ({
        name:     p.name     || '—',
        category: p.category || '—',
        stock:    p.stock    || 0,
        price:    p.price    || 0,
        status:   (p.stock || 0) < 5 ? 'LOW STOCK' : (p.stock || 0) < 10 ? 'WARNING' : 'IN STOCK',
      })).sort((a, b) => a.stock - b.stock),
    summaryCards: [
      { key: 'totalProducts', label: 'Total Products', format: 'number', color: '' },
      { key: 'lowStock',      label: 'Low Stock Items', format: 'number', color: '#dc2626' },
      { key: 'stockValue',    label: 'Stock Value',     format: 'currency', color: '#10b981' },
    ],
    summarize: (rows) => ({
      totalProducts: rows.length,
      lowStock:      rows.filter(r => r.status === 'LOW STOCK').length,
      stockValue:    rows.reduce((s, r) => s + (r.price * r.stock || 0), 0),
    }),
  },

  // ── STAFF ──────────────────────────────────────────────────────────────────
  {
    id: 'staff-sales',
    title: 'Staff Sales',
    description: 'Revenue generated by each staff member for the selected period.',
    category: 'staff',
    icon: 'user',
    columns: [
      { key: 'stylistName', label: 'Staff Member' },
      { key: 'bills',       label: 'Bills',    format: 'number' },
      { key: 'cash',        label: 'Cash',     format: 'currency' },
      { key: 'card',        label: 'Card/UPI', format: 'currency' },
      { key: 'discount',    label: 'Discount', format: 'currency' },
      { key: 'revenue',     label: 'Total Revenue', format: 'currency', highlight: true },
      { key: 'avgBill',     label: 'Avg Bill', format: 'currency' },
    ],
    transform: (appointments, _expenses, stylists) => {
      const map = {};
      (stylists || []).forEach(s => {
        map[s.id] = { stylistName: s.name, bills: 0, cash: 0, card: 0, discount: 0, revenue: 0 };
      });
      appointments
        .filter(a => (a.status || 'completed').toLowerCase() === 'completed')
        .forEach(a => {
          const sid = a.stylistId || a.items?.[0]?.stylistId;
          if (sid && map[sid]) {
            const amount = getSalonAmount(a);
            map[sid].bills++;
            map[sid].revenue  += amount;
            map[sid].discount += a.discount     || 0;
            if ((a.paymentType || 'cash') === 'cash') map[sid].cash += amount;
            else map[sid].card += amount;
          }
        });
      return Object.values(map)
        .map(r => ({ ...r, avgBill: r.bills > 0 ? r.revenue / r.bills : 0 }))
        .sort((a, b) => b.revenue - a.revenue);
    },
    summaryCards: [
      { key: 'totalRevenue', label: 'Total Revenue',   format: 'currency', color: '#10b981' },
      { key: 'topStaff',     label: 'Top Performer',   format: 'text',     color: '#7c3aed' },
    ],
    summarize: (rows) => ({
      totalRevenue: rows.reduce((s, r) => s + (r.revenue || 0), 0),
      topStaff:     rows[0]?.stylistName || '—',
    }),
  },

  {
    id: 'staff-service-sales',
    title: 'Services Sales By Staff',
    description: 'Individual service line-items broken down by the staff who performed them.',
    category: 'staff',
    icon: 'scissors',
    columns: [
      { key: 'date',        label: 'Date' },
      { key: 'stylistName', label: 'Staff' },
      { key: 'service',     label: 'Service' },
      { key: 'clientName',  label: 'Client' },
      { key: 'paymentType', label: 'Payment', badge: true },
      { key: 'price',       label: 'Price', format: 'currency', highlight: true },
    ],
    transform: (appointments) => {
      const rows = [];
      appointments
        .filter(a => (a.status || 'completed').toLowerCase() === 'completed')
        .forEach(a => {
          getAllItems(a)
            .filter(i => i.type !== 'product')
            .forEach(i => {
              rows.push({
                date:        fmtDate(a.timestamp),
                stylistName: i.stylistName || a.stylistName || '—',
                service:     i.name     || '—',
                clientName:  a.clientName  || 'Walk-in',
                paymentType: (a.paymentType || 'cash').toUpperCase(),
                price:       i.price || 0,
              });
            });
        });
      return rows;
    },
    summaryCards: [
      { key: 'totalRevenue', label: 'Services Revenue', format: 'currency', color: '#10b981' },
      { key: 'totalItems',   label: 'Services Sold',    format: 'number',   color: '' },
    ],
    summarize: (rows) => ({
      totalRevenue: rows.reduce((s, r) => s + (r.price || 0), 0),
      totalItems:   rows.length,
    }),
  },

  // ── CUSTOMERS ──────────────────────────────────────────────────────────────
  {
    id: 'customer-sales',
    title: 'Customer Sales',
    description: 'Sales report grouped by each customer showing their spending history.',
    category: 'customers',
    icon: 'users',
    columns: [
      { key: 'clientName',  label: 'Client' },
      { key: 'clientPhone', label: 'Phone' },
      { key: 'visits',      label: 'Visits',        format: 'number' },
      { key: 'lastVisit',   label: 'Last Visit' },
      { key: 'totalSpent',  label: 'Total Spent',   format: 'currency', highlight: true },
      { key: 'avgSpend',    label: 'Avg per Visit', format: 'currency' },
    ],
    transform: (appointments) => {
      const map = {};
      appointments
        .filter(a => (a.status || 'completed').toLowerCase() === 'completed')
        .forEach(a => {
          const key = a.clientPhone || a.clientName || 'walkin';
          if (!map[key]) map[key] = { clientName: a.clientName || 'Walk-in', clientPhone: String(a.clientPhone || '—'), visits: 0, totalSpent: 0, lastTs: 0 };
          map[key].visits++;
          map[key].totalSpent += a.totalAmount || 0;
          const ts = a.timestamp?.toDate?.()?.getTime?.() || 0;
          if (ts > map[key].lastTs) { map[key].lastTs = ts; map[key].lastVisit = fmtDate(a.timestamp); }
        });
      return Object.values(map)
        .map(r => ({ ...r, avgSpend: r.visits > 0 ? r.totalSpent / r.visits : 0 }))
        .sort((a, b) => b.totalSpent - a.totalSpent);
    },
    summaryCards: [
      { key: 'uniqueClients', label: 'Unique Clients',   format: 'number',   color: '' },
      { key: 'totalRevenue',  label: 'Total Revenue',    format: 'currency', color: '#10b981' },
      { key: 'topClient',     label: 'Top Client',       format: 'text',     color: '#7c3aed' },
    ],
    summarize: (rows) => ({
      uniqueClients: rows.length,
      totalRevenue:  rows.reduce((s, r) => s + (r.totalSpent || 0), 0),
      topClient:     rows[0]?.clientName || '—',
    }),
  },

  {
    id: 'service-sales',
    title: 'Service Sales',
    description: 'Revenue and count broken down by each service type.',
    category: 'customers',
    icon: 'star',
    columns: [
      { key: 'serviceName', label: 'Service' },
      { key: 'count',       label: 'Times Booked', format: 'number' },
      { key: 'revenue',     label: 'Revenue',      format: 'currency', highlight: true },
      { key: 'avgPrice',    label: 'Avg Price',    format: 'currency' },
    ],
    transform: (appointments) => {
      const map = {};
      appointments
        .filter(a => (a.status || 'completed').toLowerCase() === 'completed')
        .forEach(a => {
          getAllItems(a)
            .filter(i => i.type !== 'product')
            .forEach(i => {
              if (!map[i.name]) map[i.name] = { serviceName: i.name, count: 0, revenue: 0 };
              map[i.name].count++;
              map[i.name].revenue += i.price || 0;
            });
        });
      return Object.values(map)
        .map(r => ({ ...r, avgPrice: r.count > 0 ? r.revenue / r.count : 0 }))
        .sort((a, b) => b.revenue - a.revenue);
    },
    summaryCards: [
      { key: 'totalRevenue',  label: 'Services Revenue', format: 'currency', color: '#10b981' },
      { key: 'totalServices', label: 'Services Offered', format: 'number',   color: '' },
      { key: 'topService',    label: 'Most Popular',     format: 'text',     color: '#7c3aed' },
    ],
    summarize: (rows) => ({
      totalRevenue:  rows.reduce((s, r) => s + (r.revenue || 0), 0),
      totalServices: rows.length,
      topService:    rows[0]?.serviceName || '—',
    }),
  },

  // ── APPOINTMENTS ───────────────────────────────────────────────────────────
  {
    id: 'appointment-list',
    title: 'Detail Appointment List',
    description: 'Comprehensive list of all appointments with full details and status.',
    category: 'appointments',
    icon: 'list',
    columns: [
      { key: 'date',        label: 'Date' },
      { key: 'time',        label: 'Time' },
      { key: 'invoiceId',   label: 'Invoice #' },
      { key: 'clientName',  label: 'Client' },
      { key: 'clientPhone', label: 'Phone' },
      { key: 'stylistName', label: 'Staff' },
      { key: 'services',    label: 'Services' },
      { key: 'status',      label: 'Status',  badge: true },
      { key: 'paymentType', label: 'Payment', badge: true },
      { key: 'totalAmount', label: 'Amount',  format: 'currency', highlight: true },
    ],
    transform: (appointments) =>
      appointments.map(a => ({
        date:        fmtDate(a.timestamp),
        time:        fmtTime(a.timestamp),
        invoiceId:   shortId(a.id),
        clientName:  a.clientName  || 'Walk-in',
        clientPhone: String(a.clientPhone || '—'),
        stylistName: a.stylistName || '—',
        services:    svcList(a),
        status:      (a.status || 'completed').toUpperCase().replace('_', ' '),
        paymentType: (a.paymentType || 'cash').toUpperCase(),
        totalAmount: a.totalAmount || 0,
      })),
    summaryCards: [
      { key: 'total',     label: 'Total Appointments', format: 'number',   color: '' },
      { key: 'completed', label: 'Completed',          format: 'number',   color: '#10b981' },
      { key: 'cancelled', label: 'Cancelled',          format: 'number',   color: '#dc2626' },
    ],
    summarize: (rows) => ({
      total:     rows.length,
      completed: rows.filter(r => r.status === 'COMPLETED').length,
      cancelled: rows.filter(r => r.status === 'CANCELLED').length,
    }),
  },
];

export const CATEGORIES = [
  { id: 'financial',    label: 'Financial & Sales',    icon: 'dollar',    color: '#10b981' },
  { id: 'products',     label: 'Products & Inventory', icon: 'package',   color: '#f59e0b' },
  { id: 'staff',        label: 'Staff & Performance',  icon: 'user',      color: '#3b82f6' },
  { id: 'customers',    label: 'Customers & Services', icon: 'users',     color: '#7c3aed' },
  { id: 'appointments', label: 'Appointments',          icon: 'calendar', color: '#0891b2' },
];

export const getReport = (id) => REPORTS.find(r => r.id === id);

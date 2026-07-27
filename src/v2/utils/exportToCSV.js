export function exportToCSV(data, columns, filename = 'export.csv') {
  if (!data || !data.length) return;

  const headers = columns.map(col => col.header).join(',');
  
  const rows = data.map(row => {
    return columns.map(col => {
      let val = col.accessor ? row[col.accessor] : '';
      if (col.renderText) {
        val = col.renderText(row);
      } else if (val === null || val === undefined) {
        val = '';
      }
      
      // Escape quotes and wrap in quotes if there's a comma
      const stringVal = String(val);
      if (stringVal.includes(',') || stringVal.includes('"') || stringVal.includes('\n')) {
        return `"${stringVal.replace(/"/g, '""')}"`;
      }
      return stringVal;
    }).join(',');
  });

  const csvContent = [headers, ...rows].join('\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

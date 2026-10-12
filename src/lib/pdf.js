import { LOGO_DATA_URI } from './logo';
import { fmt } from './theme';
import { catLabel } from './fees';
import { receiptNumber } from './reports';
import { loadPDF } from './loaders';

// jsPDF + the table plugin are downloaded only when a PDF is actually requested.
async function newDoc() {
  const { jsPDF, autoTable } = await loadPDF();
  return { doc: new jsPDF(), autoTable };
}

function header(doc, title, sub) {
  try { doc.addImage(LOGO_DATA_URI, 'PNG', 165, 10, 30, 30); } catch (e) { /* logo is optional */ }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('BNI Insomniacs', 14, 20);
  doc.setFontSize(12);
  doc.text(title, 14, 28);
  if (sub) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(90, 90, 90);
    doc.text(sub, 14, 34);
    doc.setTextColor(0, 0, 0);
  }
  return 46;
}

// Never fail silently: tell the user if a PDF couldn't be produced.
const guard = (fn) => async (...args) => {
  try { await fn(...args); } catch (e) { console.error(e); if (typeof window !== 'undefined') window.alert(`Could not create the PDF: ${e.message || e}`); }
};

// colorCols: { columnIndex: (rowIndex) => number } — paints negative red / positive green
const RED = [168, 67, 47], GREEN = [47, 107, 79];
const table = (autoTable, doc, startY, head, body, colorCols = {}) => autoTable(doc, {
  startY, head: [head], body, headStyles: { fillColor: [28, 36, 48] }, styles: { fontSize: 9 },
  didParseCell: (d) => {
    const get = colorCols[d.column.index];
    if (d.section !== 'body' || !get) return;
    const v = get(d.row.index);
    if (v < 0) d.cell.styles.textColor = RED; else if (v > 0) d.cell.styles.textColor = GREEN;
  },
});

export const downloadMemberStatementSheetPDF = guard(async ({ monthLabelText, rows }) => {
  const { doc, autoTable } = await newDoc();
  const y = header(doc, `Members Statement — ${monthLabelText}`, 'Opening + this month\u2019s Meeting/Social movement = current balance · negative = owed, positive = in credit');
  table(autoTable, doc, y, ['Name', 'Company', 'Opening Balance', 'Meeting Fee', 'Social Fee', 'Current Balance', 'Status'],
    rows.map(r => [r.name, r.company || '', `AED ${fmt(r.opening)}`, `AED ${fmt(r.meeting)}`, `AED ${fmt(r.social)}`, `AED ${fmt(r.current)}`, r.status]),
    { 2: (i) => rows[i].opening, 3: (i) => rows[i].meeting, 4: (i) => rows[i].social, 5: (i) => rows[i].current });
  doc.save(`st-console-members-${monthLabelText.replace(' ', '-')}.pdf`);
});

const detailLines = (doc, startY, pairs) => {
  doc.setFontSize(11);
  let y = startY + 6;
  pairs.filter(([, v]) => v !== undefined && v !== null && v !== '').forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold'); doc.text(label, 14, y);
    doc.setFont('helvetica', 'normal'); doc.text(String(value), 60, y);
    y += 8;
  });
  return y + 4;
};

export const downloadReceiptPDF = guard(async ({ member, entry }) => {
  const { doc } = await newDoc();
  const y = detailLines(doc, header(doc, 'Payment Receipt', receiptNumber(entry)), [
    ['Date:', entry.date], ['Received from:', member.name], ['Company:', member.company_name],
    ['Category:', catLabel(entry.category)], ['Amount:', `AED ${fmt(entry.amount)}`], ['Method:', entry.method], ['Note:', entry.note],
  ]);
  doc.setFont('helvetica', 'italic'); doc.setFontSize(10);
  doc.text('Thank you for your payment.', 14, y);
  doc.save(`receipt-${receiptNumber(entry)}.pdf`);
});

export const downloadMiscReceiptPDF = guard(async ({ entry }) => {
  const { doc } = await newDoc();
  const y = detailLines(doc, header(doc, 'Receipt', receiptNumber(entry)), [
    ['Date:', entry.date], ['Amount:', `AED ${fmt(entry.amount)}`], ['Note:', entry.note],
  ]);
  doc.setFont('helvetica', 'italic'); doc.setFontSize(10);
  doc.text('Thank you.', 14, y);
  doc.save(`receipt-${receiptNumber(entry)}.pdf`);
});

export const downloadMemberStatementPDF = guard(async ({ member, ledger }) => {
  const { doc, autoTable } = await newDoc();
  const y = header(doc, `Member Statement — ${member.name}`, member.company_name || '');
  const sorted = [...(ledger || [])].sort((a, b) => a.date.localeCompare(b.date));
  let running = 0;
  const balances = [];
  const body = sorted.map(l => {
    running += l.type === 'payment' ? Number(l.amount) : -Number(l.amount);
    balances.push(running);
    return [l.date, l.type === 'charge' ? 'Charge' : 'Payment', catLabel(l.category), `AED ${fmt(l.amount)}`, l.note || '', `AED ${fmt(running)}`];
  });
  table(autoTable, doc, y, ['Date', 'Type', 'Category', 'Amount', 'Note', 'Balance (negative = owed)'], body, { 5: (i) => balances[i] });
  doc.save(`statement-${member.name.replace(/\s+/g, '-')}.pdf`);
});

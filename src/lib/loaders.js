// Heavy libraries are only downloaded when a button that needs them is clicked,
// which keeps the first page load small and fast.
// Each loader looks for the real function in every shape a bundler may expose it in.
const firstFn = (...c) => c.find((f) => typeof f === 'function');

export async function loadXLSX() {
  const mod = await import('xlsx');
  const x = [mod, mod.default, mod.default?.default].find((m) => m && m.utils && typeof m.writeFile === 'function');
  if (!x) throw new Error('Excel library failed to load');
  return x;
}

export async function loadPDF() {
  const [j, a] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const jsPDF = firstFn(j.jsPDF, j.default, j.default?.jsPDF, j.default?.default);
  const autoTable = firstFn(a.autoTable, a.default, a.default?.autoTable, a.default?.default);
  if (!jsPDF || !autoTable) throw new Error('PDF library failed to load');
  return { jsPDF, autoTable };
}

export async function loadHtml2Canvas() {
  const m = await import('html2canvas');
  const fn = firstFn(m.default, m, m.default?.default);
  if (!fn) throw new Error('Image library failed to load');
  return fn;
}

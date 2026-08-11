export function formatAddress(addr) {
  if (!addr || !addr.address) return '';
  return addr.name ? `${addr.name} <${addr.address}>` : addr.address;
}

export function formatAddressList(list) {
  if (!Array.isArray(list) || list.length === 0) return '';
  return list.map(formatAddress).filter(Boolean).join(', ');
}

export function formatBytes(n) {
  if (!n) return '0 B';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

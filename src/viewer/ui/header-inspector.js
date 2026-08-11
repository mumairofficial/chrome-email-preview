export function renderHeaderInspector(model) {
  const wrap = document.createElement('section');
  wrap.className = 'header-inspector';

  const headers = model.headers ?? [];
  if (headers.length === 0) {
    const p = document.createElement('p');
    p.textContent = 'No headers were found in this message.';
    wrap.append(p);
    return wrap;
  }

  const table = document.createElement('table');
  const tbody = document.createElement('tbody');

  for (const { key, value } of headers) {
    const tr = document.createElement('tr');
    const th = document.createElement('th');
    th.scope = 'row';
    th.textContent = key;
    const td = document.createElement('td');
    td.textContent = value;
    tr.append(th, td);
    tbody.append(tr);
  }

  table.append(tbody);
  wrap.append(table);
  return wrap;
}

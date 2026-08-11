export function renderToolbar({ onPrint, onDownload }) {
  const bar = document.createElement('div');
  bar.className = 'toolbar';

  const print = document.createElement('button');
  print.type = 'button';
  print.textContent = 'Print / Save as PDF';
  print.addEventListener('click', onPrint);

  const download = document.createElement('button');
  download.type = 'button';
  download.textContent = 'Download original';
  download.addEventListener('click', onDownload);

  bar.append(print, download);
  return bar;
}

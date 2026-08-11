export function renderDropzone(onFile) {
  const zone = document.createElement('section');
  zone.className = 'dropzone';

  const label = document.createElement('p');
  label.textContent = 'Drop an .eml file here, or';
  zone.append(label);

  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.eml,message/rfc822';
  input.addEventListener('change', () => {
    if (input.files[0]) onFile(input.files[0]);
  });
  zone.append(input);

  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('dropzone--over');
  });
  zone.addEventListener('dragleave', () => zone.classList.remove('dropzone--over'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('dropzone--over');
    const file = e.dataTransfer?.files?.[0];
    if (file) onFile(file);
  });

  return zone;
}

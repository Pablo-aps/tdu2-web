import { inspectInstall } from './inspect.js';
const folder = document.querySelector('#folder'),
  result = document.querySelector('#result');
folder.addEventListener('change', async () => {
  if (!folder.files.length) return;
  folder.disabled = true;
  result.textContent = 'Проверяем файлы…';
  try {
    if (!crypto.subtle) throw Error('Открой страницу через localhost или HTTPS для расчёта SHA-256');
    const files = new Map(
      Array.from(folder.files)
        .filter((f) => f.webkitRelativePath.split('/').length === 2)
        .map((f) => [f.name.toLowerCase(), f]),
    );
    const { exe, archives, missing } = await inspectInstall(files);
    result.textContent = [
      'TestDrive2.exe · ' + exe.format,
      'SHA-256  ' + exe.sha256,
      ...archives.map((a) => a.name + ' · записей: ' + a.entries.toLocaleString('ru')),
      ...missing.map((n) => 'Отсутствует ' + n),
      ...(!archives.length ? ['Пары BIG/MAP не найдены.'] : []),
    ].join('\n');
  } catch (error) {
    result.textContent = error.message;
  } finally {
    folder.value = '';
    folder.disabled = false;
  }
});

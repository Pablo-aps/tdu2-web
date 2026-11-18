// Format reference: Ekey/TDU2.BIG.Tool, BigUnpack.cs. Offsets after the version are big-endian.
export function inspectMap(buffer, archiveSize) {
  const v = new DataView(buffer);
  if (v.byteLength < 20 || v.getUint32(0) !== 0x584d4246 || v.getUint32(4, true) !== 257)
    throw Error('Неизвестный формат индекса XMBF');
  const sub = v.getUint32(16);
  if (sub < 20 || sub + 20 > v.byteLength) throw Error('Повреждён заголовок индекса');
  const count = v.getUint32(sub + 4),
    hashes = sub + v.getUint32(sub + 8);
  const rows = sub + v.getUint32(sub + 16);
  if (
    count !== v.getUint32(sub + 12) ||
    hashes < sub + 20 ||
    hashes + count * 8 > rows ||
    rows + count * 12 > v.byteLength
  )
    throw Error('Таблица индекса выходит за границы файла');
  let indexedBytes = 0;
  for (let i = 0; i < count; i++) {
    const row = rows + i * 12;
    const size = v.getInt32(row),
      offset = v.getBigInt64(row + 4);
    if (size < 0 || offset < 0n || offset + BigInt(size) > BigInt(archiveSize))
      throw Error('Запись выходит за границы парного архива BIG');
    indexedBytes += size;
  }
  return { entries: count, indexedBytes };
}

export async function inspectInstall(files) {
  const exe = files.get('testdrive2.exe');
  if (!exe) throw Error('В выбранной папке нужен TestDrive2.exe');
  if (exe.size > 128 * 1024 ** 2) throw Error('Размер EXE превышает лимит проверки 128 МиБ');
  const bytes = await exe.arrayBuffer(),
    pe = new DataView(bytes);
  const pos = pe.byteLength >= 64 ? pe.getUint32(60, true) : 0;
  if (
    pe.byteLength < 64 ||
    pe.getUint16(0) !== 0x4d5a ||
    pos < 64 ||
    pos + 26 > pe.byteLength ||
    pe.getUint32(pos) !== 0x50450000 ||
    pe.getUint16(pos + 4, true) !== 0x14c ||
    pe.getUint16(pos + 24, true) !== 0x10b
  )
    throw Error('Ожидался исполняемый файл Windows PE32 x86');
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  const sha256 = Array.from(digest, (b) => b.toString(16).padStart(2, '0')).join('');
  const archives = [],
    missing = [];
  const stems = new Set(
    [...files.keys()].filter((n) => /^bigfile_[a-z\d_]+\.(big|map)$/i.test(n)).map((n) => n.slice(0, -4)),
  );
  for (const stem of [...stems].sort()) {
    const map = files.get(stem + '.map'),
      big = files.get(stem + '.big');
    if (!big || !map) {
      missing.push(stem + (big ? '.map' : '.big'));
      continue;
    }
    if (map.size > 32 * 1024 ** 2) throw Error(stem + '.map превышает лимит 32 МиБ');
    try {
      archives.push({ name: stem, bytes: big.size, ...inspectMap(await map.arrayBuffer(), big.size) });
    } catch (error) {
      throw Error(stem + '.map — ' + error.message);
    }
  }
  return { exe: { format: 'PE32 x86', bytes: exe.size, sha256 }, archives, missing };
}

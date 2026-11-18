import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { inspectInstall, inspectMap } from '../public/inspect.js';

function index() {
  const data = new ArrayBuffer(64),
    v = new DataView(data);
  v.setUint32(0, 0x584d4246);
  v.setUint32(4, 257, true);
  v.setUint32(16, 20);
  v.setUint32(24, 1);
  v.setUint32(28, 24);
  v.setUint32(32, 1);
  v.setUint32(36, 32);
  v.setBigUint64(44, 0x4567n);
  v.setInt32(52, 12);
  v.setBigInt64(56, 32n);
  return data;
}
function pe32() {
  const buf = Buffer.alloc(256);
  buf.write('MZ');
  buf.writeUInt32LE(128, 60);
  buf.write('PE', 128);
  buf.writeUInt16LE(0x14c, 132);
  buf.writeUInt16LE(0x10b, 152);
  return buf;
}
test('инвентаризация PE32 и XMBF/BIG, включая отсутствующую пару', async () => {
  const exe = pe32();
  const report = await inspectInstall(
    new Map([
      ['testdrive2.exe', new Blob([exe])],
      ['bigfile_eu_1.big', new Blob([Buffer.alloc(44)])],
      ['bigfile_eu_1.map', new Blob([index()])],
      ['bigfile_eu_2.big', new Blob([])],
    ]),
  );
  assert.equal(report.exe.sha256, createHash('sha256').update(exe).digest('hex'));
  assert.deepEqual(report.archives, [{ name: 'bigfile_eu_1', bytes: 44, entries: 1, indexedBytes: 12 }]);
  assert.deepEqual(report.missing, ['bigfile_eu_2.map']);
});
test('индекс с неверными границами, несовместимой версией или смещением 64 бит отклоняется', () => {
  assert.throws(() => inspectMap(index(), 43), /BIG/);
  for (const [field, value] of [
    [4, 2],
    [16, 0xffffffff],
    [32, 100],
    [36, 20],
    [52, 0xffffffff],
    [56, 0x20],
  ]) {
    const bytes = index();
    new DataView(bytes).setUint32(field, value);
    assert.throws(() => inspectMap(bytes, 200));
  }
});
test('ошибка указывает на отсутствующий или испорченный EXE', async () => {
  await assert.rejects(inspectInstall(new Map()), /TestDrive2/);
  await assert.rejects(inspectInstall(new Map([['testdrive2.exe', new Blob(['wrong'])]])), /PE32/);
});

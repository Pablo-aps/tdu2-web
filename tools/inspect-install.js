import { readdir } from 'node:fs/promises';
import { openAsBlob } from 'node:fs';
import { join } from 'node:path';
import { inspectInstall } from '../public/inspect.js';

try {
  const dir = process.argv[2];
  if (!dir) throw Error('Usage: node tools/inspect-install.js "<TDU2 installation directory>"');
  const files = new Map();
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isFile() && /^(testdrive2\.exe|bigfile_[a-z\d_]+\.(big|map))$/i.test(entry.name))
      files.set(entry.name.toLowerCase(), await openAsBlob(join(dir, entry.name)));
  }
  console.log(JSON.stringify(await inspectInstall(files), null, 2));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}

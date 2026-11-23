import { lstat, readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

const octal = (value, length) => `${value.toString(8).padStart(length - 1, '0')}\0`;
/** Stable USTAR archive: sorted files, zero timestamps/owners, fixed modes, no symlinks. */
export async function skillArchive(root, name) {
  const records = [];
  let total = 0;
  async function visit(relative, depth) {
    if (depth > 8) throw new Error('Release source depth exceeds its bound.');
    const absolute = resolve(root, relative);
    const stat = await lstat(absolute);
    if (stat.isSymbolicLink()) throw new Error('Release sources cannot contain symlinks.');
    const file = relative ? `${name}/${relative}` : name;
    if (Buffer.byteLength(file) > 99) throw new Error('Release path is too long.');
    if (stat.isDirectory()) {
      records.push({ file: `${file}/`, directory: true, bytes: Buffer.alloc(0) });
      const entries = (await readdir(absolute)).sort();
      for (const entry of entries)
        await visit(relative ? `${relative}/${entry}` : entry, depth + 1);
    } else if (stat.isFile() && stat.nlink === 1) {
      if (stat.size > 2 * 1024 * 1024 || records.length > 100)
        throw new Error('Release file count or size exceeds its bound.');
      const bytes = await readFile(absolute);
      total += bytes.length;
      if (total > 4 * 1024 * 1024) throw new Error('Release total size exceeds its bound.');
      records.push({ file, directory: false, bytes });
    } else throw new Error('Release sources must be regular single-link files or directories.');
  }
  await visit('', 0);
  const blocks = [];
  for (const record of records) {
    const header = Buffer.alloc(512);
    header.write(record.file, 0, 100, 'utf8');
    header.write(octal(record.directory ? 0o755 : 0o644, 8), 100, 8, 'ascii');
    header.write(octal(0, 8), 108, 8, 'ascii');
    header.write(octal(0, 8), 116, 8, 'ascii');
    header.write(octal(record.bytes.length, 12), 124, 12, 'ascii');
    header.write(octal(0, 12), 136, 12, 'ascii');
    header.fill(32, 148, 156);
    header.write(record.directory ? '5' : '0', 156, 1, 'ascii');
    header.write('ustar\0', 257, 6, 'ascii');
    header.write('00', 263, 2, 'ascii');
    const sum = header.reduce((accumulator, byte) => accumulator + byte, 0);
    header.write(`${sum.toString(8).padStart(6, '0')}\0 `, 148, 8, 'ascii');
    blocks.push(header, record.bytes);
    if (record.bytes.length % 512) blocks.push(Buffer.alloc(512 - (record.bytes.length % 512)));
  }
  blocks.push(Buffer.alloc(1024));
  return gzipSync(Buffer.concat(blocks), { level: 9 });
}

import type { AndroidFile } from './androidGenerator';

/**
 * Minimal ZIP file builder — creates a valid ZIP archive in the browser
 * without any external dependencies. Uses CRC32 + STORE (no compression)
 * which is fully valid and readable by all unzip tools.
 */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let crc = i;
    for (let j = 0; j < 8; j++) {
      crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }
    table[i] = crc >>> 0;
  }
  return table;
})();

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function strToBytes(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

function u16(n: number): number[] {
  return [n & 0xff, (n >>> 8) & 0xff];
}

function u32(n: number): number[] {
  return [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff];
}

export function buildZip(files: AndroidFile[]): Blob {
  const chunks: number[] = [];
  const central: number[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = strToBytes(file.path);
    const contentBytes = file.binary
      ? new Uint8Array() // binary files not used yet
      : strToBytes(file.content);
    const crc = crc32(contentBytes);
    const size = contentBytes.length;

    // Local file header
    chunks.push(...u32(0x04034b50)); // signature
    chunks.push(...u16(20)); // version needed
    chunks.push(...u16(0)); // flags
    chunks.push(...u16(0)); // compression: store
    chunks.push(...u16(0)); // mod time
    chunks.push(...u16(0)); // mod date
    chunks.push(...u32(crc));
    chunks.push(...u32(size)); // compressed size
    chunks.push(...u32(size)); // uncompressed size
    chunks.push(...u16(nameBytes.length)); // filename length
    chunks.push(...u16(0)); // extra field length
    for (const b of nameBytes) chunks.push(b);
    for (const b of contentBytes) chunks.push(b);

    // Central directory entry
    central.push(...u32(0x02014b50)); // signature
    central.push(...u16(20)); // version made by
    central.push(...u16(20)); // version needed
    central.push(...u16(0)); // flags
    central.push(...u16(0)); // compression
    central.push(...u16(0)); // mod time
    central.push(...u16(0)); // mod date
    central.push(...u32(crc));
    central.push(...u32(size));
    central.push(...u32(size));
    central.push(...u16(nameBytes.length));
    central.push(...u16(0)); // extra
    central.push(...u16(0)); // comment
    central.push(...u16(0)); // disk number
    central.push(...u16(0)); // internal attrs
    central.push(...u32(0)); // external attrs
    central.push(...u32(offset));
    for (const b of nameBytes) central.push(b);

    offset += 30 + nameBytes.length + size;
  }

  const centralStart = offset;
  const centralSize = central.length;

  // End of central directory
  const end: number[] = [];
  end.push(...u32(0x06054b50)); // signature
  end.push(...u16(0)); // disk number
  end.push(...u16(0)); // disk with central dir
  end.push(...u16(files.length)); // entries on this disk
  end.push(...u16(files.length)); // total entries
  end.push(...u32(centralSize));
  end.push(...u32(centralStart));
  end.push(...u16(0)); // comment length

  const all = [...chunks, ...central, ...end];
  return new Blob([new Uint8Array(all)], { type: 'application/zip' });
}

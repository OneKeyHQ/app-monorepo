const MAX_AVIF_BYTES = 16 * 1024 * 1024;
const MAX_BOXES = 512;

type IBox = { type: string; start: number; end: number };
type ReadBytes = (offset: number, count: number) => DataView;

function fourCC(view: DataView, offset: number) {
  return String.fromCharCode(
    view.getUint8(offset),
    view.getUint8(offset + 1),
    view.getUint8(offset + 2),
    view.getUint8(offset + 3),
  );
}

function readBoxes(read: ReadBytes, start: number, end: number) {
  const boxes: IBox[] = [];
  for (let offset = start; offset < end;) {
    if (end - offset < 8 || boxes.length === MAX_BOXES) return [];
    const header = read(offset, 8);
    const shortSize = header.getUint32(0);
    const headerSize = shortSize === 1 ? 16 : 8;
    if (end - offset < headerSize) return [];
    const size =
      shortSize === 1
        ? Number(read(offset + 8, 8).getBigUint64(0))
        : shortSize || end - offset;
    if (size < headerSize || size > end - offset) return [];
    boxes.push({
      type: fourCC(header, 4),
      start: offset + headerSize,
      end: offset + size,
    });
    offset += size;
  }
  return boxes;
}

function onlyBox(boxes: IBox[], type: string) {
  const matches = boxes.filter((box) => box.type === type);
  return matches.length === 1 ? matches[0] : undefined;
}

function isStillAvif(read: ReadBytes, fileType: IBox) {
  const { start, end } = fileType;
  const length = end - start;
  if (length < 8 || length > MAX_BOXES * 4 || length % 4 !== 0) return false;
  const brands = read(start, length);
  const majorBrand = fourCC(brands, 0);
  if (majorBrand === 'avis') return false;
  let supportsStillImage = majorBrand === 'avif';
  for (let offset = 8; offset < length; offset += 4) {
    const brand = fourCC(brands, offset);
    if (brand === 'avis') return false;
    supportsStillImage ||= brand === 'avif';
  }
  return supportsStillImage;
}

export function isAvifWithinPixelBudget(payload: string, maxPixels: number) {
  if (payload.length > Math.ceil(MAX_AVIF_BYTES / 3) * 4) return false;
  const base64 = payload.replace(/[\t\n\f\r ]/g, '');
  const padding = base64.endsWith('==') ? 2 : Number(base64.endsWith('='));
  const byteLength = Math.floor(((base64.length - padding) * 3) / 4);
  if (byteLength > MAX_AVIF_BYTES) return false;

  // Decode just the Base64 groups covering each box header or property.
  const read: ReadBytes = (offset, count) => {
    const first = Math.floor(offset / 3) * 4;
    const last = Math.ceil((offset + count) / 3) * 4;
    const bytes = Uint8Array.from(atob(base64.slice(first, last)), (char) =>
      char.charCodeAt(0),
    );
    return new DataView(bytes.buffer, offset % 3, count);
  };
  const topLevel = readBoxes(read, 0, byteLength);
  const fileType = onlyBox(topLevel, 'ftyp');
  const metadata = onlyBox(topLevel, 'meta');
  if (
    !fileType ||
    fileType !== topLevel[0] ||
    !isStillAvif(read, fileType) ||
    topLevel.some((box) => box.type === 'moov') ||
    !metadata ||
    metadata.end - metadata.start < 4 ||
    read(metadata.start, 4).getUint32(0) !== 0
  )
    return false;

  // Check every item's spatial extent, including grid and auxiliary images.
  const properties = onlyBox(
    readBoxes(read, metadata.start + 4, metadata.end),
    'iprp',
  );
  if (!properties) return false;
  const container = onlyBox(
    readBoxes(read, properties.start, properties.end),
    'ipco',
  );
  if (!container) return false;
  const extents = readBoxes(read, container.start, container.end).filter(
    (box) => box.type === 'ispe',
  );
  return (
    extents.length > 0 &&
    extents.every(({ start, end }) => {
      if (end - start !== 12) return false;
      const extent = read(start, 12);
      const width = extent.getUint32(4);
      const height = extent.getUint32(8);
      return (
        extent.getUint32(0) === 0 &&
        width > 0 &&
        height > 0 &&
        width <= maxPixels / height
      );
    })
  );
}

const MAX_AVIF_BYTES = 16 * 1024 * 1024;
const MAX_BOXES = 512;

type IBox = { type: string; start: number; end: number };

function fourCC(view: DataView, offset: number) {
  return String.fromCharCode(
    view.getUint8(offset),
    view.getUint8(offset + 1),
    view.getUint8(offset + 2),
    view.getUint8(offset + 3),
  );
}

function readBoxes(view: DataView, start: number, end: number) {
  const boxes: IBox[] = [];
  for (let offset = start; offset < end;) {
    if (end - offset < 8 || boxes.length === MAX_BOXES) return [];
    const shortSize = view.getUint32(offset);
    const headerSize = shortSize === 1 ? 16 : 8;
    if (end - offset < headerSize) return [];
    const size =
      shortSize === 1
        ? Number(view.getBigUint64(offset + 8))
        : shortSize || end - offset;
    if (size < headerSize || size > end - offset) return [];
    boxes.push({
      type: fourCC(view, offset + 4),
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

function isStillAvif(view: DataView, fileType: IBox) {
  const { start, end } = fileType;
  if (end - start < 8 || (end - start) % 4 !== 0) return false;
  const majorBrand = fourCC(view, start);
  if (majorBrand === 'avis') return false;
  let supportsStillImage = majorBrand === 'avif';
  for (let offset = start + 8; offset < end; offset += 4) {
    const brand = fourCC(view, offset);
    if (brand === 'avis') return false;
    supportsStillImage ||= brand === 'avif';
  }
  return supportsStillImage;
}

export async function isAvifWithinPixelBudget(blob: Blob, maxPixels: number) {
  if (blob.size > MAX_AVIF_BYTES) return false;

  const view = new DataView(await blob.arrayBuffer());
  const topLevel = readBoxes(view, 0, view.byteLength);
  const fileType = onlyBox(topLevel, 'ftyp');
  const metadata = onlyBox(topLevel, 'meta');
  if (
    !fileType ||
    fileType !== topLevel[0] ||
    !isStillAvif(view, fileType) ||
    topLevel.some((box) => box.type === 'moov') ||
    !metadata ||
    metadata.end - metadata.start < 4 ||
    view.getUint32(metadata.start) !== 0
  )
    return false;

  // Check every item's spatial extent, including grid and auxiliary images.
  const properties = onlyBox(
    readBoxes(view, metadata.start + 4, metadata.end),
    'iprp',
  );
  if (!properties) return false;
  const container = onlyBox(
    readBoxes(view, properties.start, properties.end),
    'ipco',
  );
  if (!container) return false;
  const extents = readBoxes(view, container.start, container.end).filter(
    (box) => box.type === 'ispe',
  );
  return (
    extents.length > 0 &&
    extents.every(({ start, end }) => {
      if (end - start !== 12 || view.getUint32(start) !== 0) return false;
      const width = view.getUint32(start + 4);
      const height = view.getUint32(start + 8);
      return width > 0 && height > 0 && width <= maxPixels / height;
    })
  );
}

import QRCodeUtil from 'qrcode';

const BLOCK_CHAR_MAP: Record<string, string> = {
  '00': ' ',
  '01': '▄',
  '10': '▀',
  '11': '█',
};

interface IRenderAsciiQrOptions {
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
  quietZone?: number;
}

function buildQrMatrix(
  value: string,
  errorCorrectionLevel: 'L' | 'M' | 'Q' | 'H',
): number[][] {
  const data = Array.from(
    QRCodeUtil.create(value, { errorCorrectionLevel }).modules.data,
  );
  const size = Math.sqrt(data.length);

  return data.reduce((matrix: number[][], cell, index) => {
    if (index % size === 0) {
      matrix.push([cell]);
      return matrix;
    }

    matrix[matrix.length - 1].push(cell);
    return matrix;
  }, []);
}

function addQuietZone(matrix: number[][], quietZone: number): number[][] {
  if (quietZone <= 0) {
    return matrix;
  }

  const width = matrix.length + quietZone * 2;
  const quietRow = Array<number>(width).fill(0);
  const paddedRows = matrix.map((row) => [
    ...Array<number>(quietZone).fill(0),
    ...row,
    ...Array<number>(quietZone).fill(0),
  ]);

  return [
    ...Array.from({ length: quietZone }, () => [...quietRow]),
    ...paddedRows,
    ...Array.from({ length: quietZone }, () => [...quietRow]),
  ];
}

export function renderAsciiQr(
  value: string,
  { errorCorrectionLevel = 'M', quietZone = 1 }: IRenderAsciiQrOptions = {},
): string {
  const paddedMatrix = addQuietZone(
    buildQrMatrix(value, errorCorrectionLevel),
    quietZone,
  );
  const lines: string[] = [];

  for (let row = 0; row < paddedMatrix.length; row += 2) {
    let line = '';

    for (let column = 0; column < paddedMatrix[row].length; column += 1) {
      const topCell = paddedMatrix[row][column] ? '1' : '0';
      const bottomCell = paddedMatrix[row + 1]?.[column] ? '1' : '0';
      line += BLOCK_CHAR_MAP[`${topCell}${bottomCell}`];
    }

    lines.push(line);
  }

  return lines.join('\n');
}

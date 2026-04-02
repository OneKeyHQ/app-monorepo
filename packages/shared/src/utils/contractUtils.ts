function parseSignatureParameters(signature: string): string[] {
  const start: number = signature.indexOf('(');
  const end: number = signature.lastIndexOf(')');

  if (start === -1 || end === -1 || end <= start) {
    return [];
  }

  const content: string = signature.substring(start + 1, end).trim();

  if (!content) {
    return [];
  }

  const params: string[] = [];
  let currentParam = '';
  let depth = 0;

  for (let i = 0; i < content.length; i += 1) {
    const char: string = content[i];

    if (char === '(') {
      depth += 1;
    } else if (char === ')') {
      depth -= 1;
    }

    if (char === ',' && depth === 0) {
      params.push(currentParam.trim());
      currentParam = '';
    } else {
      currentParam += char;
    }
  }

  if (currentParam) {
    params.push(currentParam.trim());
  }

  return params;
}

function flattenBigNumbers(data: unknown): unknown {
  if (Array.isArray(data)) {
    return data.map((item) => flattenBigNumbers(item));
  }

  if (data !== null && typeof data === 'object') {
    if ((data as { _isBigNumber?: boolean })._isBigNumber) {
      return (data as { _hex: string })._hex;
    }

    const result: Record<string, unknown> = {};
    const dataObj = data as Record<string, unknown>;
    for (const key of Object.keys(dataObj)) {
      result[key] = flattenBigNumbers(dataObj[key]);
    }
    return result;
  }

  return data;
}

export default {
  flattenBigNumbers,
  parseSignatureParameters,
};

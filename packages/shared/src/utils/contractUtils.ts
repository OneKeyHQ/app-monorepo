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

export default {
  parseSignatureParameters,
};

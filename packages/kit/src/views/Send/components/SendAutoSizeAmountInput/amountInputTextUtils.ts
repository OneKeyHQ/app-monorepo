export function sanitizeAmountInputText(text: string): string {
  let sanitizedText = text
    .replace(/[。,，,]/g, '.')
    .replace(/\s/g, '')
    .replace(/[^\d.]/g, '');

  if (sanitizedText.startsWith('.')) {
    sanitizedText = `0${sanitizedText}`;
  }

  if (
    sanitizedText.length > 1 &&
    sanitizedText.startsWith('0') &&
    !sanitizedText.startsWith('0.')
  ) {
    sanitizedText = sanitizedText.replace(/^0+/, '') || '0';
    if (sanitizedText.startsWith('.')) {
      sanitizedText = `0${sanitizedText}`;
    }
  }

  const firstDecimalIndex = sanitizedText.indexOf('.');
  if (firstDecimalIndex !== -1) {
    const integerPart = sanitizedText.slice(0, firstDecimalIndex + 1);
    const decimalPart = sanitizedText
      .slice(firstDecimalIndex + 1)
      .replace(/\./g, '');
    sanitizedText = `${integerPart}${decimalPart}`;
  }

  return sanitizedText;
}

/** Discovery titles describe the product, never a transport/wallet identifier. */
export function getThirdPartyDeviceDisplayName({
  brand,
  modelName,
  model,
  name,
}: {
  brand: string;
  modelName?: string;
  model?: string;
  name?: string;
}): string {
  const clean = (value?: string) =>
    (value ?? '')
      .replace(
        /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
        '',
      )
      .replace(/\b[0-9a-f]{32,}\b/gi, '')
      .replace(/[()[\]]/g, '')
      .trim()
      .replace(/\s+/g, ' ');
  const product = [modelName, model, name]
    .map(clean)
    .find(
      (value) =>
        value &&
        value.toLowerCase() !== 'unknown' &&
        value.toLowerCase() !== brand.toLowerCase(),
    );
  if (!product) return brand;
  // Prefer one model source; concatenating label + model repeats the product.
  const modelWords = product
    .split(' ')
    .filter((word) => word.toLowerCase() !== brand.toLowerCase());
  const modelText = modelWords.join(' ');
  return modelText.toLowerCase().includes(brand.toLowerCase())
    ? modelText
    : [brand, modelText].filter(Boolean).join(' ');
}

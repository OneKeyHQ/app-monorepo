function xorEncrypt({ data, key }: { data: string; key: string }): string {
  if (!key) {
    throw new Error('Key is required');
  }
  const dataBytes = Buffer.from(data, 'utf8');
  const keyBytes = Buffer.from(key, 'utf8');
  const resultBytes = Buffer.alloc(dataBytes.length);

  for (let i = 0; i < dataBytes.length; i += 1) {
    // eslint-disable-next-line no-bitwise
    resultBytes[i] = dataBytes[i] ^ keyBytes[i % keyBytes.length];
  }

  const result = resultBytes.toString('hex');
  return result;
}

function xorDecrypt({
  encryptedDataHex,
  key,
}: {
  encryptedDataHex: string;
  key: string;
}): string {
  if (!key) {
    throw new Error('Key is required');
  }
  const encryptedBytes = Buffer.from(encryptedDataHex, 'hex');
  const keyBytes = Buffer.from(key, 'utf8');
  const resultBytes = Buffer.alloc(encryptedBytes.length);

  for (let i = 0; i < encryptedBytes.length; i += 1) {
    // eslint-disable-next-line no-bitwise
    resultBytes[i] = encryptedBytes[i] ^ keyBytes[i % keyBytes.length];
  }

  const result = resultBytes.toString('utf8');
  return result;
}

export { xorDecrypt, xorEncrypt };

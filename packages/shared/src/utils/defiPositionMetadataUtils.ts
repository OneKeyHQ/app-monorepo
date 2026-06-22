import type { IDeFiPosition } from '../../types/defi';

function isDecimalString(value: string) {
  if (value.length === 0) return false;
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (!char || char < '0' || char > '9') return false;
  }
  return true;
}

function isHexString(value: string) {
  if (!value.startsWith('0x') || value.length <= 2) return false;
  for (let index = 2; index < value.length; index += 1) {
    const char = value[index];
    const isHexChar =
      char &&
      ((char >= '0' && char <= '9') ||
        (char >= 'a' && char <= 'f') ||
        (char >= 'A' && char <= 'F'));
    if (!isHexChar) return false;
  }
  return true;
}

function normalizeEvmAddress(value?: string) {
  const trimmed = value?.trim();
  if (!trimmed || trimmed.length !== 42 || !isHexString(trimmed)) {
    return undefined;
  }
  return trimmed;
}

function normalizeTokenId(value?: string) {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  if (isDecimalString(trimmed) || isHexString(trimmed)) {
    return trimmed;
  }
  return undefined;
}

function parsePoolPositionGroupId(value?: string) {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;

  const [poolAddress, tokenId, ...rest] = trimmed.split('#');
  if (rest.length > 0 || !poolAddress || !tokenId) return undefined;

  const normalizedPoolAddress = normalizeEvmAddress(poolAddress);
  const normalizedTokenId = normalizeTokenId(tokenId);
  if (!normalizedPoolAddress || !normalizedTokenId) return undefined;

  return {
    poolAddress: normalizedPoolAddress,
    tokenId: normalizedTokenId,
  };
}

function normalizeDeFiPositionMetadata(position: IDeFiPosition): IDeFiPosition {
  const parsedGroupId = parsePoolPositionGroupId(position.groupId);
  if (!parsedGroupId) return position;

  const tokenId = normalizeTokenId(position.tokenId) ?? parsedGroupId.tokenId;
  if (tokenId === position.tokenId) {
    return position;
  }

  return {
    ...position,
    tokenId,
  };
}

export {
  normalizeDeFiPositionMetadata,
  normalizeEvmAddress,
  normalizeTokenId,
  parsePoolPositionGroupId,
};

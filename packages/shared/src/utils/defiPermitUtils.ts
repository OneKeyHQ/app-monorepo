import { getNetworkIdsMap } from '../config/networkIds';
import {
  EthereumStETH,
  EthereumStETHWithdrawalQueue,
  EthereumWstETH,
} from '../consts/addresses';
import { OneKeyLocalError } from '../errors';

import type {
  IDeFiUnknownRecord,
  IResolvedDeFiPositionActionAsset,
} from '../../types/defi';

const supportedLidoWithdrawTokenAddresses = new Set([
  EthereumStETH.toLowerCase(),
  EthereumWstETH.toLowerCase(),
]);

function asRecord(value: unknown): IDeFiUnknownRecord | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  return value as IDeFiUnknownRecord;
}

function parsePermitTypedDataMessage(message: unknown): IDeFiUnknownRecord {
  if (typeof message === 'string') {
    try {
      const parsed = JSON.parse(message) as unknown;
      const record = asRecord(parsed);
      if (record) return record;
    } catch {
      // Throw a stable local error below.
    }
    throw new OneKeyLocalError('Invalid DeFi permit typed data');
  }

  const record = asRecord(message);
  if (record) return record;

  throw new OneKeyLocalError('Invalid DeFi permit typed data');
}

function normalizePermitAddress(value: unknown) {
  return typeof value === 'string' && value.trim()
    ? value.trim().toLowerCase()
    : undefined;
}

function assertPermitAddress({
  actual,
  expected,
  fieldName,
}: {
  actual: unknown;
  expected: string | undefined;
  fieldName: string;
}) {
  const normalizedActual = normalizePermitAddress(actual);
  const normalizedExpected = normalizePermitAddress(expected);
  if (
    !normalizedActual ||
    !normalizedExpected ||
    normalizedActual !== normalizedExpected
  ) {
    throw new OneKeyLocalError(`Invalid DeFi permit ${fieldName}`);
  }
}

function normalizePermitChainId(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === 'bigint') {
    return value.toString();
  }
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }
  return undefined;
}

function isSupportedLidoWithdrawTokenAddress(address: string | undefined) {
  return Boolean(address && supportedLidoWithdrawTokenAddresses.has(address));
}

function resolveLidoWithdrawTokenAddress(
  selectedAsset: Pick<
    IResolvedDeFiPositionActionAsset,
    'tokenAddress' | 'extraParams'
  >,
) {
  const poolAddress = normalizePermitAddress(
    selectedAsset.extraParams?.poolAddress,
  );
  const selectedTokenAddress = normalizePermitAddress(
    selectedAsset.tokenAddress,
  );
  if (poolAddress) {
    if (!isSupportedLidoWithdrawTokenAddress(poolAddress)) {
      throw new OneKeyLocalError('Invalid DeFi permit tokenAddress');
    }
    if (
      selectedTokenAddress &&
      !isSupportedLidoWithdrawTokenAddress(selectedTokenAddress)
    ) {
      throw new OneKeyLocalError('Invalid DeFi permit tokenAddress');
    }
    // Lido portfolio rows may display/redeem as stETH while the server uses
    // poolAddress as the actual permit token, for example wstETH withdrawals.
    return poolAddress;
  }

  if (selectedTokenAddress) {
    if (!isSupportedLidoWithdrawTokenAddress(selectedTokenAddress)) {
      throw new OneKeyLocalError('Invalid DeFi permit tokenAddress');
    }
    return selectedTokenAddress;
  }

  return EthereumStETH.toLowerCase();
}

function validateLidoWithdrawPermitTypedData({
  message,
  accountAddress,
  networkId,
  selectedAsset,
}: {
  message: unknown;
  accountAddress: string;
  networkId: string;
  selectedAsset: Pick<
    IResolvedDeFiPositionActionAsset,
    'tokenAddress' | 'extraParams'
  >;
}) {
  if (networkId !== getNetworkIdsMap().eth) {
    throw new OneKeyLocalError('Invalid DeFi permit network');
  }

  const typedData = parsePermitTypedDataMessage(message);
  const domain = asRecord(typedData.domain);
  const permitMessage = asRecord(typedData.message);

  if (!domain || !permitMessage) {
    throw new OneKeyLocalError('Invalid DeFi permit typed data');
  }

  if (normalizePermitChainId(domain.chainId) !== '1') {
    throw new OneKeyLocalError('Invalid DeFi permit chainId');
  }

  assertPermitAddress({
    actual: permitMessage.owner,
    expected: accountAddress,
    fieldName: 'owner',
  });
  const expectedTokenAddress = resolveLidoWithdrawTokenAddress(selectedAsset);
  assertPermitAddress({
    actual: domain.verifyingContract,
    expected: expectedTokenAddress,
    fieldName: 'verifyingContract',
  });
  assertPermitAddress({
    actual: permitMessage.spender,
    expected: EthereumStETHWithdrawalQueue,
    fieldName: 'spender',
  });

  if (normalizePermitAddress(permitMessage.token)) {
    assertPermitAddress({
      actual: permitMessage.token,
      expected: expectedTokenAddress,
      fieldName: 'token',
    });
  }
}

export default {
  validateLidoWithdrawPermitTypedData,
};

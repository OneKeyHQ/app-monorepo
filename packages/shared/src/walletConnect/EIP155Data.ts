import { getPresetNetworks } from '@onekeyhq/shared/src/config/presetNetworks';
import { IMPL_EVM } from '@onekeyhq/shared/src/engine/engineConsts';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import { getTimeDurationMs } from '@onekeyhq/shared/src/utils/timerUtils';

export const getEIP155Chains = memoizee(
  () =>
    getPresetNetworks()
      .filter((n) => n.impl === IMPL_EVM)
      .map((n) => ({
        chainId: n.chainId,
        namespace: 'eip155' as const,
        name: n.name,
      })),
  {
    maxAge: getTimeDurationMs({
      minute: 5,
    }),
  },
);

/**
 * Methods
 */
export const EIP155_SIGNING_METHODS = {
  PERSONAL_SIGN: 'personal_sign',
  ETH_SIGN: 'eth_sign',
  ETH_SIGN_TRANSACTION: 'eth_signTransaction',
  ETH_SIGN_TYPED_DATA: 'eth_signTypedData',
  ETH_SIGN_TYPED_DATA_V3: 'eth_signTypedData_v3',
  ETH_SIGN_TYPED_DATA_V4: 'eth_signTypedData_v4',
  ETH_SEND_RAW_TRANSACTION: 'eth_sendRawTransaction',
  ETH_SEND_TRANSACTION: 'eth_sendTransaction',
};

export const EIP155_EVENTS = {
  ACCOUNT_CHANGED: 'accountsChanged',
  CHAIN_CHANGED: 'chainChanged',
};

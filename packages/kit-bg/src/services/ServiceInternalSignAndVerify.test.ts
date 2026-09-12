import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import {
  EMessageTypesCommon,
  EMessageTypesEth,
} from '@onekeyhq/shared/types/message';

import ServiceInternalSignAndVerify from './ServiceInternalSignAndVerify';

const mockSignMessage = jest.fn();

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => (target: unknown) => target,
  backgroundMethod:
    () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) =>
      descriptor,
  backgroundMethodForDev:
    () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) =>
      descriptor,
  toastIfError:
    () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) =>
      descriptor,
}));

jest.mock('../vaults/factory', () => ({
  vaultFactory: {
    getVault: jest.fn(async () => ({
      keyring: {
        signMessage: mockSignMessage,
      },
    })),
  },
}));

// WalletConnect external account id: not a valid signer address.
const EXTERNAL_EVM_ACCOUNT_ID = 'external--wc--topic123--evm';
const EXTERNAL_EVM_ADDRESS = '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed';

function buildService({
  accountId,
  address,
}: {
  accountId: string;
  address: string;
}) {
  const backgroundApi = {
    serviceAccount: {
      getAccount: jest.fn(async () => ({ id: accountId, address })),
    },
    servicePassword: {
      promptPasswordVerifyByAccount: jest.fn(async () => ({
        password: undefined,
        deviceParams: undefined,
      })),
    },
    serviceHardwareUI: {
      withHardwareProcessing: jest.fn(async (fn: () => Promise<unknown>) =>
        fn(),
      ),
    },
  };
  return new ServiceInternalSignAndVerify({ backgroundApi });
}

function getSignedUnsignedMessage() {
  const [params] = mockSignMessage.mock.calls[0] as [
    { messages: Array<{ type: string; message: string; payload: unknown }> },
  ];
  return params.messages[0];
}

describe('ServiceInternalSignAndVerify.signInternalMessage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSignMessage.mockResolvedValue(['0xsignature']);
  });

  it('uses the account address, not the account id, as the personal_sign signer', async () => {
    const service = buildService({
      accountId: EXTERNAL_EVM_ACCOUNT_ID,
      address: EXTERNAL_EVM_ADDRESS,
    });

    await service.signInternalMessage({
      message: 'hello',
      isHexString: false,
      format: '',
      networkId: getNetworkIdsMap().eth,
      accountId: EXTERNAL_EVM_ACCOUNT_ID,
      indexedAccountId: undefined,
      deriveType: undefined,
    });

    const unsignedMessage = getSignedUnsignedMessage();
    expect(unsignedMessage.type).toBe(EMessageTypesEth.PERSONAL_SIGN);
    expect(unsignedMessage.payload).toEqual([
      '0x68656c6c6f',
      EXTERNAL_EVM_ADDRESS,
    ]);
  });

  it('uses the account address as the Solana sign message signer', async () => {
    const solAccountId = 'external--sol--injected--phantom';
    const solAddress = '7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV';
    const service = buildService({
      accountId: solAccountId,
      address: solAddress,
    });

    await service.signInternalMessage({
      message: 'hello',
      isHexString: false,
      format: '',
      networkId: getNetworkIdsMap().sol,
      accountId: solAccountId,
      indexedAccountId: undefined,
      deriveType: undefined,
    });

    const unsignedMessage = getSignedUnsignedMessage();
    expect(unsignedMessage.type).toBe(EMessageTypesCommon.SIGN_MESSAGE);
    expect(unsignedMessage.payload).toEqual(['hello', solAddress]);
  });
});

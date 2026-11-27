import { HardwareErrorCode } from '@onekeyfe/hd-shared';

import sdkStarknet from '@onekeyhq/core/src/chains/starknet/sdkStarknet';
import type {
  IEncodedTxStarknet,
  IStarknetRawTx,
  IStrk20ProofInvocationPayload,
} from '@onekeyhq/core/src/chains/starknet/types';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EAddressEncodings } from '@onekeyhq/shared/src/types/address';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import { EConfirmOnDeviceType } from '@onekeyhq/shared/types/device';

import { KeyringHardwareBase } from '../../base/KeyringHardwareBase';

import { KeyringHardware } from './KeyringHardware';
import settings from './settings';

import type {
  IDeviceSharedCallParams,
  IPrepareHardwareAccountsParams,
  ISignTransactionParams,
} from '../../types';

jest.mock('@onekeyhq/core/src/instance/coreChainApi', () => ({
  __esModule: true,
  default: { starknet: { hd: {} } },
}));
jest.mock('../../../dbs/local/localDbInstance', () => ({
  __esModule: true,
  default: {},
}));

// Public synthetic signer, used only to simulate device signatures offline.
const PUBLIC_KEY = sdkStarknet.getStarkPublicKey('0x1');
const PADDED_PUBLIC_KEY = `0x${BigInt(PUBLIC_KEY).toString(16).padStart(64, '0')}`;
const CHAIN_ID = '0x534e5f4d41494e';
const PATH = "m/44'/9004'/0'/0/0";
const deviceParams = {
  dbDevice: { connectId: 'device-connection', deviceId: 'device-id' },
  deviceCommonParams: {},
};
const bound = { max_amount: '0x1', max_price_per_unit: '0x1' };
const resourceBounds = { l1_gas: bound, l2_gas: bound, l1_data_gas: bound };

function buildKeyring(encoding?: EAddressEncodings, syntheticSigner = '0x1') {
  const publicKey = sdkStarknet.getStarkPublicKey(syntheticSigner);
  const paddedPublicKey = `0x${BigInt(publicKey).toString(16).padStart(64, '0')}`;
  const deployment = sdkStarknet.getAccountDeployParams(
    publicKey,
    sdkStarknet.getAccountContractByEncoding(encoding),
  );
  const account = {
    pub: paddedPublicKey,
    address: deployment.contractAddress,
    path: PATH,
  };
  const sdk = {
    starknetExportPrivacyViewingKey: jest.fn(async () => ({
      success: true,
      payload: { viewingKey: `0x${'0'.repeat(63)}1` },
    })),
    starknetGetPublicKey: jest.fn(
      async (
        _connectId,
        _deviceId,
        params: { bundle: { path: string }[] },
      ) => ({
        success: true,
        payload: params.bundle.map(({ path }) => ({
          path,
          pub: paddedPublicKey,
        })),
      }),
    ),
    starknetGetAddress: jest.fn(
      async (
        _connectId,
        _deviceId,
        params: { bundle: { path: string }[] },
      ) => ({
        success: true,
        payload: params.bundle.map(({ path }) => ({
          path,
          address: account.address,
        })),
      }),
    ),
    starknetSignTransaction: jest.fn(
      async (_connectId, _deviceId, params: Record<string, unknown>) => {
        const invoke = params.invokeV3 as { calldata: string[] } | undefined;
        const encoded = makeEncodedTx(account.address);
        const transactionHash = invoke
          ? sdkStarknet.calculateInvokeTxHash({
              ...encoded,
              senderAddress: account.address,
              nonce: params.nonce as string,
            }).txHash
          : sdkStarknet.calculateDeployAccountTxHash({
              ...encoded,
              ...deployment,
              contractAddress: account.address,
              nonce: params.nonce as string,
            });
        const signature = sdkStarknet.signHash(
          transactionHash,
          syntheticSigner,
        );
        return {
          success: true,
          payload: {
            transactionHash,
            signature: `0x${signature.map((item) => BigInt(item).toString(16).padStart(64, '0')).join('')}`,
          },
        };
      },
    ),
  };
  jest
    .spyOn(KeyringHardwareBase.prototype, 'getHardwareSDKInstance')
    .mockResolvedValue(
      sdk as unknown as Awaited<
        ReturnType<KeyringHardwareBase['getHardwareSDKInstance']>
      >,
    );
  const keyring = Object.assign(Object.create(KeyringHardware.prototype), {
    walletId: 'hw-1',
    hwSdkNetwork: 'starknet',
    vault: {
      getAccount: async () => account,
      getNetwork: async () => ({ chainId: CHAIN_ID }),
      getAddressEncoding: async () => encoding,
    },
    getVaultSettings: async () => settings,
  }) as KeyringHardware;
  return { keyring, sdk, account, deployment };
}

function makeEncodedTx(from: string): IEncodedTxStarknet {
  return {
    chainId: CHAIN_ID,
    from,
    version: '0x3',
    nonce: '0x1',
    calls: [
      {
        contractAddress: '0x123',
        entrypoint: 'transfer',
        calldata: ['0x456', '0x1', '0x0'],
      },
    ],
    resourceBounds,
    tip: '0x0',
    paymasterData: [],
    accountDeploymentData: [],
    nonceDataAvailabilityMode: 'L1',
    feeDataAvailabilityMode: 'L1',
  };
}

function prepareParams(deriveInfo = settings.accountDeriveInfo.default) {
  return {
    indexes: [5, 9],
    deriveInfo,
    deviceParams: {
      ...deviceParams,
      confirmOnDevice: EConfirmOnDeviceType.LastItem,
    },
  } as unknown as IPrepareHardwareAccountsParams;
}

function signParams(encodedTx: IEncodedTxStarknet): ISignTransactionParams {
  return {
    unsignedTx: { encodedTx },
    deviceParams,
  } as unknown as ISignTransactionParams;
}

describe('Starknet hardware accounts', () => {
  afterEach(() => jest.restoreAllMocks());

  it('uses the current shared SDK and maps an unsupported device method', async () => {
    const { keyring, sdk } = buildKeyring();
    const getSdk = jest.spyOn(
      KeyringHardwareBase.prototype,
      'getHardwareSDKInstance',
    );
    getSdk.mockResolvedValueOnce({
      ...sdk,
      starknetGetPublicKey: jest.fn(async () => ({
        success: false,
        payload: {
          code: HardwareErrorCode.DeviceNotSupportMethod,
          error: 'Unsupported method',
        },
      })),
    } as unknown as Awaited<
      ReturnType<KeyringHardwareBase['getHardwareSDKInstance']>
    >);
    await expect(
      keyring.prepareAccounts(prepareParams()),
    ).rejects.toMatchObject({
      key: ETranslations.hardware_unknown_message_error,
    });
    expect(sdk.starknetGetPublicKey).not.toHaveBeenCalled();

    await expect(
      keyring.prepareAccounts(prepareParams()),
    ).resolves.toHaveLength(2);
    expect(getSdk).toHaveBeenCalledTimes(2);
    expect(getSdk).toHaveBeenLastCalledWith({ connectId: 'device-connection' });
  });

  it('exports a viewing key for this account and derives its public key without exporting the signer', async () => {
    const { keyring, sdk, account } = buildKeyring();
    const result = await keyring.deriveStrk20ViewingKey({
      password: '',
      deviceParams: deviceParams as IDeviceSharedCallParams,
      chainId: CHAIN_ID,
      accountAddress: account.address,
      poolAddress: '0x123',
    });
    expect(result.publicKeyX).toBe(PADDED_PUBLIC_KEY);
    expect(sdk.starknetExportPrivacyViewingKey).toHaveBeenCalledWith(
      'device-connection',
      'device-id',
      expect.objectContaining({
        path: PATH,
        publicKeyType: 1,
        accountAddress: account.address,
        chainId: CHAIN_ID,
        poolAddress: '0x123',
        derivationVersion: 1,
      }),
    );
    expect(sdk.starknetSignTransaction).not.toHaveBeenCalled();
  });

  it.each(['account', 'chain', 'keyIndex'])(
    'rejects a mismatched viewing-key %s before a device call',
    async (field) => {
      const { keyring, sdk, account } = buildKeyring();
      await expect(
        keyring.deriveStrk20ViewingKey({
          password: '',
          deviceParams: deviceParams as IDeviceSharedCallParams,
          chainId: field === 'chain' ? '0x1' : CHAIN_ID,
          accountAddress: field === 'account' ? '0x1' : account.address,
          poolAddress: '0x123',
          keyIndex: field === 'keyIndex' ? 1 : 0,
        }),
      ).rejects.toMatchObject({ key: ETranslations.send_verification_failure });
      expect(sdk.starknetExportPrivacyViewingKey).not.toHaveBeenCalled();
    },
  );

  it('authorizes the pool proof with derivation v1 and checks the device hash and signature', async () => {
    const { keyring, sdk, account } = buildKeyring();
    const invocation: IStrk20ProofInvocationPayload = {
      ...makeEncodedTx(account.address),
      poolAddress: '0x123',
      calls: [
        {
          contractAddress: '0x123',
          entrypoint: 'compile_actions',
          calldata: [account.address, '0x1', '0x1', '0x0'],
        },
      ],
    };
    const { txHash } = sdkStarknet.calculateInvokeTxHash({
      ...invocation,
      senderAddress: invocation.poolAddress,
    });
    const signature = sdkStarknet.signHash(txHash, '0x1');
    sdk.starknetSignTransaction.mockResolvedValueOnce({
      success: true,
      payload: {
        transactionHash: txHash,
        signature: `0x${signature.map((part) => BigInt(part).toString(16).padStart(64, '0')).join('')}`,
      },
    });
    await expect(
      keyring.signStrk20ProofInvocation({
        password: '',
        deviceParams: deviceParams as IDeviceSharedCallParams,
        invocation,
      }),
    ).resolves.toEqual(signature);
    expect(sdk.starknetSignTransaction).toHaveBeenCalledWith(
      'device-connection',
      'device-id',
      expect.objectContaining({
        privacyViewingKeyDerivation: 1,
        invokeV3: expect.objectContaining({ senderAddress: '0x123' }),
      }),
    );
  });

  it('commits proof facts into the final transaction and keeps proof data beside the invoke', async () => {
    const { keyring, sdk, account } = buildKeyring();
    const encoded = makeEncodedTx(account.address);
    encoded.privacy = {
      kind: 'transfer',
      poolAddress: '0x123',
      proofFacts: ['0x456'],
      proof: 'public-test-proof',
      provingBlockId: 1,
      builtAt: Date.now(),
    };
    const { txHash } = sdkStarknet.calculateInvokeTxHash({
      ...encoded,
      senderAddress: account.address,
      proofFacts: encoded.privacy.proofFacts,
    });
    const signature = sdkStarknet.signHash(txHash, '0x1');
    sdk.starknetSignTransaction.mockResolvedValueOnce({
      success: true,
      payload: {
        transactionHash: txHash,
        signature: `0x${signature.map((part) => BigInt(part).toString(16).padStart(64, '0')).join('')}`,
      },
    });
    const signed = await keyring.signTransaction(signParams(encoded));
    const raw = JSON.parse(signed.rawTx) as IStarknetRawTx;
    expect(signed.txid).toBe(txHash);
    expect(raw.proof).toBe('public-test-proof');
    expect(raw.invoke.proof_facts).toEqual(['0x456']);
    const request = sdk.starknetSignTransaction.mock.calls[0][2];
    expect(request).not.toHaveProperty('privacyViewingKeyDerivation');
    expect(request.invokeV3).toHaveProperty('proofFacts', ['0x456']);
  });

  it.each(['chain', 'owner', 'pool', 'extra-call'])(
    'rejects mismatched proof-authorization %s before a device call',
    async (field) => {
      const { keyring, sdk, account } = buildKeyring();
      const invocation: IStrk20ProofInvocationPayload = {
        ...makeEncodedTx(account.address),
        poolAddress: '0x123',
        calls: [
          {
            contractAddress: '0x123',
            entrypoint: 'compile_actions',
            calldata: [account.address, '0x1', '0x1', '0x0'],
          },
        ],
      };
      if (field === 'chain') invocation.chainId = '0x1';
      if (field === 'owner') invocation.calls[0].calldata[0] = '0x1';
      if (field === 'pool') invocation.poolAddress = '0x1';
      if (field === 'extra-call') invocation.calls.push(invocation.calls[0]);
      await expect(
        keyring.signStrk20ProofInvocation({
          password: '',
          deviceParams: deviceParams as IDeviceSharedCallParams,
          invocation,
        }),
      ).rejects.toMatchObject({ key: ETranslations.send_verification_failure });
      expect(sdk.starknetSignTransaction).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['Argent', settings.accountDeriveInfo.default],
    ['OpenZeppelin', settings.accountDeriveInfo.starknetOpenZeppelin],
  ])(
    'creates %s accounts with device-owned public keys and addresses',
    async (_label, deriveInfo) => {
      const { keyring, sdk, account, deployment } = buildKeyring(
        deriveInfo.addressEncoding,
      );
      const accounts = await keyring.prepareAccounts(prepareParams(deriveInfo));
      expect(accounts).toHaveLength(2);
      expect(accounts[0]).toMatchObject({
        pub: PADDED_PUBLIC_KEY,
        address: account.address,
        pathIndex: 5,
      });
      const bundles = sdk.starknetGetAddress.mock.calls[0][2].bundle;
      expect(bundles).toEqual([
        expect.objectContaining({
          path: "m/44'/9004'/0'/0/5",
          classHash: deployment.classHash,
          showOnOneKey: false,
        }),
        expect.objectContaining({
          path: "m/44'/9004'/0'/0/9",
          classHash: deployment.classHash,
          showOnOneKey: true,
        }),
      ]);
    },
  );

  it.each([EAddressEncodings.STARKNET_OKX, EAddressEncodings.P2PKH])(
    'rejects unsupported encoding %s before contacting the SDK',
    async (addressEncoding) => {
      const { keyring, sdk } = buildKeyring();
      await expect(
        keyring.prepareAccounts(
          prepareParams({
            ...settings.accountDeriveInfo.default,
            addressEncoding,
          }),
        ),
      ).rejects.toMatchObject({
        key: ETranslations.feedback_hardware_unsupported_current_address_type,
      });
      expect(sdk.starknetGetPublicKey).not.toHaveBeenCalled();
    },
  );

  it('rejects a returned public key for a different path', async () => {
    const { keyring, sdk } = buildKeyring();
    sdk.starknetGetPublicKey.mockResolvedValueOnce({
      success: true,
      payload: [{ path: 'wrong-path', pub: PADDED_PUBLIC_KEY }],
    });
    await expect(
      keyring.batchGetAddresses({ ...prepareParams(), indexes: [0] }),
    ).rejects.toMatchObject({ key: ETranslations.send_verification_failure });
    expect(sdk.starknetGetAddress).not.toHaveBeenCalled();
  });

  it('rejects an address that does not belong to the device public key', async () => {
    const { keyring, sdk } = buildKeyring();
    sdk.starknetGetAddress.mockResolvedValueOnce({
      success: true,
      payload: [{ path: PATH, address: '0x1' }],
    });
    await expect(
      keyring.batchGetAddresses({ ...prepareParams(), indexes: [0] }),
    ).rejects.toMatchObject({ key: ETranslations.send_verification_failure });
  });

  it('does not turn a device cancellation into an account', async () => {
    const { keyring, sdk } = buildKeyring();
    sdk.starknetGetAddress.mockResolvedValueOnce({
      success: false,
      payload: { error: 'Cancelled', code: 803 },
    } as unknown as Awaited<ReturnType<typeof sdk.starknetGetAddress>>);
    await expect(keyring.prepareAccounts(prepareParams())).rejects.toThrow();
  });

  it.each(['0x1', '0x3'])(
    'signs and verifies an Invoke v3 transaction for synthetic signer %s',
    async (syntheticSigner) => {
      const { keyring, sdk, account } = buildKeyring(
        undefined,
        syntheticSigner,
      );
      const encoded = makeEncodedTx(account.address);
      const signed = await keyring.signTransaction(signParams(encoded));
      const raw = JSON.parse(signed.rawTx) as IStarknetRawTx;
      expect(raw.invokeTxHash).toBe(signed.txid);
      expect(raw.invoke.signature).not.toEqual(['0x0', '0x0']);
      expect(raw.invoke.sender_address).toBe(
        sdkStarknet.toFelt(account.address),
      );
      expect(sdk.starknetSignTransaction).toHaveBeenCalledWith(
        'device-connection',
        'device-id',
        expect.objectContaining({
          path: PATH,
          publicKeyType: 1,
          chainId: CHAIN_ID,
          invokeV3: expect.objectContaining({
            calldata: sdkStarknet.toFeltArray(
              sdkStarknet.buildExecuteCalldata(encoded.calls),
            ),
          }),
        }),
      );
    },
  );

  it('signs deployment before Invoke and returns both broadcast payloads', async () => {
    const { keyring, sdk, account, deployment } = buildKeyring();
    const encoded = makeEncodedTx(account.address);
    encoded.deployAccount = { ...deployment, nonce: '0x0', resourceBounds };
    const raw = JSON.parse(
      (await keyring.signTransaction(signParams(encoded))).rawTx,
    ) as IStarknetRawTx;
    expect(raw.deployAccount?.class_hash).toBe(
      sdkStarknet.toFelt(deployment.classHash),
    );
    expect(raw.deployAccountTxHash).toBeDefined();
    expect(sdk.starknetSignTransaction.mock.calls[0][2]).toHaveProperty(
      'deployAccountV3',
    );
    expect(sdk.starknetSignTransaction.mock.calls[1][2]).toHaveProperty(
      'invokeV3',
    );
  });

  it('requests only one deployment signature for a standalone batch activation', async () => {
    const { keyring, sdk, account, deployment } = buildKeyring();
    const encoded = makeEncodedTx(account.address);
    encoded.type = 'DEPLOY_ACCOUNT';
    encoded.calls = [];
    encoded.nonce = '0x0';
    encoded.deployAccount = { ...deployment, nonce: '0x0', resourceBounds };
    const signed = await keyring.signTransaction(signParams(encoded));
    expect(sdk.starknetSignTransaction).toHaveBeenCalledTimes(1);
    expect(sdk.starknetSignTransaction.mock.calls[0][2]).toHaveProperty(
      'deployAccountV3',
    );
    expect(sdk.starknetSignTransaction.mock.calls[0][2]).not.toHaveProperty(
      'invokeV3',
    );
    expect(JSON.parse(signed.rawTx)).not.toHaveProperty('invoke');
  });

  it('signs only Invoke when deployment is an estimation dependency', async () => {
    const { keyring, sdk, account, deployment } = buildKeyring();
    const encoded = makeEncodedTx(account.address);
    encoded.deploymentDependency = {
      ...deployment,
      nonce: '0x0',
      resourceBounds,
    };
    const signed = await keyring.signTransaction(signParams(encoded));
    expect(sdk.starknetSignTransaction).toHaveBeenCalledTimes(1);
    expect(sdk.starknetSignTransaction.mock.calls[0][2]).toHaveProperty(
      'invokeV3',
    );
    expect(JSON.parse(signed.rawTx)).not.toHaveProperty('deployAccount');
  });

  it.each(['deployment', 'transfer'])(
    'returns no broadcast payload when %s signing is cancelled',
    async (stage) => {
      const { keyring, sdk, account, deployment } = buildKeyring();
      const encoded = makeEncodedTx(account.address);
      encoded.deployAccount = { ...deployment, nonce: '0x0', resourceBounds };
      const sign = checkIsDefined(
        sdk.starknetSignTransaction.getMockImplementation(),
      );
      let callCount = 0;
      const cancelledCall = stage === 'deployment' ? 1 : 2;
      sdk.starknetSignTransaction.mockImplementation(async (...args) => {
        callCount += 1;
        if (callCount === cancelledCall)
          throw new OneKeyLocalError('Device cancelled');
        return sign(...args);
      });
      await expect(
        keyring.signTransaction(signParams(encoded)),
      ).rejects.toThrow('Device cancelled');
      expect(sdk.starknetSignTransaction).toHaveBeenCalledTimes(cancelledCall);
    },
  );

  it.each(['sender', 'chain', 'deployment'])(
    'rejects a mismatched %s before signing',
    async (kind) => {
      const { keyring, sdk, account, deployment } = buildKeyring();
      const encoded = makeEncodedTx(account.address);
      if (kind === 'sender') encoded.from = '0x1';
      if (kind === 'chain') encoded.chainId = '0x534e5f5345504f4c4941';
      if (kind === 'deployment')
        encoded.deployAccount = {
          ...deployment,
          classHash: '0x1',
          nonce: '0x0',
          resourceBounds,
        };
      await expect(
        keyring.signTransaction(signParams(encoded)),
      ).rejects.toMatchObject({ key: ETranslations.send_verification_failure });
      expect(sdk.starknetSignTransaction).not.toHaveBeenCalled();
    },
  );

  it.each(['hash', 'signature'])(
    'rejects an incorrect device %s',
    async (kind) => {
      const { keyring, sdk, account } = buildKeyring();
      const encoded = makeEncodedTx(account.address);
      sdk.starknetSignTransaction.mockResolvedValueOnce({
        success: true,
        payload: {
          transactionHash:
            kind === 'hash'
              ? '0x1'
              : sdkStarknet.calculateInvokeTxHash({
                  ...encoded,
                  senderAddress: account.address,
                }).txHash,
          signature: `0x${'01'.repeat(64)}`,
        },
      });
      await expect(
        keyring.signTransaction(signParams(encoded)),
      ).rejects.toMatchObject({
        key: ETranslations.feedback_failed_to_sign_transaction,
      });
    },
  );

  it('derives address and preserves __hwExtraInfo__.rootFingerprint via allNetworkGetAddress', async () => {
    const { keyring, sdk, account } = buildKeyring();
    const allNetworkParams =
      await keyring.buildHwAllNetworkPrepareAccountsParams({
        path: PATH,
        template: settings.accountDeriveInfo.default.template,
        index: 0,
      });
    expect(allNetworkParams).toEqual({
      network: 'starknet',
      path: PATH,
      showOnOneKey: false,
    });

    const accounts = await keyring.prepareAccounts({
      walletId: 'hw-1',
      networkId: 'starknet--mainnet',
      indexes: [0],
      deriveInfo: settings.accountDeriveInfo.default,
      deriveType: 'default',
      deviceParams,
      hwAllNetworkPrepareAccountsResponse: {
        getItem: jest.fn(async () => ({
          success: true,
          path: PATH,
          network: 'starknet',
          payload: {
            pub: account.pub,
            rootFingerprint: 0x12_34_56_78,
          },
        })),
      },
    } as unknown as IPrepareHardwareAccountsParams);

    expect(accounts).toHaveLength(1);
    expect(accounts[0].address).toBe(account.address);
    expect(accounts[0].pub).toBe(account.pub);
    expect(accounts[0].__hwExtraInfo__).toEqual({
      rootFingerprint: 0x12_34_56_78,
    });
    expect(sdk.starknetGetPublicKey).not.toHaveBeenCalled();
    expect(sdk.starknetGetAddress).not.toHaveBeenCalled();
  });
});

import { EOAuthSocialLoginProvider } from '@onekeyhq/shared/src/consts/authConsts';

import {
  type IKeylessWalletRemovalCapability,
  type IKeylessWalletRemovalIdentity,
  assertKeylessWalletRemovalAuthorized,
  assertMalformedKeylessWalletRemovalAuthorized,
  assertWalletCanUseGenericRemoval,
  createKeylessWalletRemovalCapability,
  createMalformedKeylessWalletRemovalCapability,
  getMalformedKeylessWalletFingerprint,
} from './keylessWalletRemovalCapability';

import type { IDBWallet } from '../../dbs/local/types';

const expectedIdentity: IKeylessWalletRemovalIdentity = {
  walletId: 'hd-keyless-1',
  keylessOwnerId: 'owner-1',
  keylessProvider: EOAuthSocialLoginProvider.Google,
  socialUserIdHash: 'social-user-hash-1',
};

const authorizationContext = {
  operationId: 'operation-1',
  lifecycleRevision: 7,
};

function createCapability(
  identity: IKeylessWalletRemovalIdentity = expectedIdentity,
) {
  return createKeylessWalletRemovalCapability({
    expectedIdentity: identity,
    ...authorizationContext,
  });
}

function buildWallet(overrides: Partial<IDBWallet> = {}): IDBWallet {
  return {
    id: expectedIdentity.walletId,
    name: 'Keyless wallet',
    type: 'hd',
    backuped: true,
    accounts: [],
    nextIds: {},
    walletNo: 1,
    isKeyless: true,
    keylessDetails: JSON.stringify({
      keylessOwnerId: expectedIdentity.keylessOwnerId,
      keylessProvider: expectedIdentity.keylessProvider,
      socialUserIdHash: expectedIdentity.socialUserIdHash,
    }),
    keylessDetailsInfo: {
      keylessOwnerId: expectedIdentity.keylessOwnerId,
      keylessProvider: expectedIdentity.keylessProvider,
      socialUserIdHash: expectedIdentity.socialUserIdHash,
    },
    ...overrides,
  };
}

describe('Keyless wallet removal capability', () => {
  test('generic removal refuses an identity-managed Keyless wallet', () => {
    expect(() => assertWalletCanUseGenericRemoval(buildWallet())).toThrow(
      'Keyless wallets must be removed through the identity exit coordinator.',
    );
  });

  test('generic removal still accepts regular and Bot wallets', () => {
    expect(() =>
      assertWalletCanUseGenericRemoval(
        buildWallet({
          id: 'hd-regular-1',
          isKeyless: false,
          keylessDetails: undefined,
          keylessDetailsInfo: undefined,
        }),
      ),
    ).not.toThrow();
    expect(() =>
      assertWalletCanUseGenericRemoval(
        buildWallet({
          id: 'hd-bot--hd-keyless-parent-1--0',
          keylessDetails: undefined,
          keylessDetailsInfo: undefined,
        }),
      ),
    ).not.toThrow();
  });

  test('rejects a plain object forged across an RPC boundary', () => {
    expect(() =>
      assertKeylessWalletRemovalAuthorized({
        capability: {
          expectedIdentity,
        } as unknown as IKeylessWalletRemovalCapability,
        expectedIdentity,
        wallet: buildWallet(),
        ...authorizationContext,
      }),
    ).toThrow(
      'A valid background Keyless wallet removal capability is required.',
    );
  });

  test('rejects a capability issued for another identity', () => {
    const capability = createCapability({
      ...expectedIdentity,
      walletId: 'hd-keyless-other',
    });

    expect(() =>
      assertKeylessWalletRemovalAuthorized({
        capability,
        expectedIdentity,
        wallet: buildWallet(),
        ...authorizationContext,
      }),
    ).toThrow(
      'Keyless wallet identity changed: walletId expected hd-keyless-1, received hd-keyless-other.',
    );
  });

  test('rejects a wallet whose provider changed after authorization', () => {
    const capability = createCapability();

    expect(() =>
      assertKeylessWalletRemovalAuthorized({
        capability,
        expectedIdentity,
        wallet: buildWallet({
          keylessDetailsInfo: {
            ...buildWallet().keylessDetailsInfo,
            keylessOwnerId: expectedIdentity.keylessOwnerId,
            keylessProvider: EOAuthSocialLoginProvider.Apple,
            socialUserIdHash: expectedIdentity.socialUserIdHash,
          },
        }),
        ...authorizationContext,
      }),
    ).toThrow(
      'Keyless wallet identity changed: keylessProvider expected google, received apple.',
    );
  });

  test('accepts the exact in-memory capability and wallet identity', () => {
    const capability = createCapability();

    expect(() =>
      assertKeylessWalletRemovalAuthorized({
        capability,
        expectedIdentity,
        wallet: buildWallet(),
        ...authorizationContext,
      }),
    ).not.toThrow();
  });

  test('the authorization is single-use and revision-bound', () => {
    const capability = createCapability();
    assertKeylessWalletRemovalAuthorized({
      capability,
      expectedIdentity,
      wallet: buildWallet(),
      ...authorizationContext,
    });

    expect(() =>
      assertKeylessWalletRemovalAuthorized({
        capability,
        expectedIdentity,
        wallet: buildWallet(),
        ...authorizationContext,
      }),
    ).toThrow(
      'The Keyless wallet removal authorization is invalid or already used.',
    );
  });

  test('authorizes one exact malformed Keyless wallet removal', () => {
    const wallet = buildWallet({
      keylessDetailsInfo: {
        keylessOwnerId: expectedIdentity.keylessOwnerId,
        keylessProvider: undefined,
        socialUserIdHash: expectedIdentity.socialUserIdHash,
      } as unknown as IDBWallet['keylessDetailsInfo'],
    });
    const expectedFingerprint = getMalformedKeylessWalletFingerprint(wallet);
    const capability = createMalformedKeylessWalletRemovalCapability({
      expectedFingerprint,
      ...authorizationContext,
    });

    expect(() =>
      assertMalformedKeylessWalletRemovalAuthorized({
        capability,
        expectedFingerprint,
        wallet,
        ...authorizationContext,
      }),
    ).not.toThrow();
  });

  test('rejects malformed removal after the wallet data changes', () => {
    const wallet = buildWallet({
      keylessDetailsInfo: {
        keylessOwnerId: expectedIdentity.keylessOwnerId,
        keylessProvider: undefined,
        socialUserIdHash: expectedIdentity.socialUserIdHash,
      } as unknown as IDBWallet['keylessDetailsInfo'],
    });
    const expectedFingerprint = getMalformedKeylessWalletFingerprint(wallet);
    const capability = createMalformedKeylessWalletRemovalCapability({
      expectedFingerprint,
      ...authorizationContext,
    });

    expect(() =>
      assertMalformedKeylessWalletRemovalAuthorized({
        capability,
        expectedFingerprint,
        wallet: buildWallet(),
        ...authorizationContext,
      }),
    ).toThrow('Malformed Keyless wallet identity changed: keylessProvider.');
  });
});

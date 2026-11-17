import { encodePasswordAsync } from '@onekeyhq/core/src/secret';
import { EHyperLiquidAgentName } from '@onekeyhq/shared/src/consts/perp';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import {
  HYPERLIQUID_AGENT_PASSWORD_ENCRYPTED_PREFIX,
  decryptHyperLiquidAgentCredentialWithSessionKey,
  deriveHyperLiquidAgentSecretKey,
  encryptHyperLiquidAgentCredentialWithSessionKey,
  hyperLiquidAgentSecretSession,
} from './hyperLiquidAgentSecret';

jest.mock('../../states/jotai/atoms/settings', () => ({
  settingsPersistAtom: {
    get: jest.fn(async () => ({
      sensitiveEncodeKey: 'test-sensitive-encode-key',
    })),
  },
}));

describe('HyperLiquid agent password encryption', () => {
  const credential = {
    agentAddress: '0x2222222222222222222222222222222222222222',
    agentName: EHyperLiquidAgentName.OneKeyAgent1,
    privateKey:
      '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    userAddress: '0x1111111111111111111111111111111111111111',
    validUntil: 2_000_000_000_000,
  };
  const recordId = accountUtils.buildHyperLiquidAgentCredentialId({
    agentName: credential.agentName,
    userAddress: credential.userAddress,
  });

  afterEach(async () => {
    await hyperLiquidAgentSecretSession.clear();
  });

  it('keeps the derived key available independently of the password cache', async () => {
    const password = await encodePasswordAsync({
      password: 'test-password-1',
    });
    await hyperLiquidAgentSecretSession.unlock({ password });

    const encrypted = await hyperLiquidAgentSecretSession.encryptCredential({
      credential,
      recordId,
    });
    await expect(
      hyperLiquidAgentSecretSession.decryptCredential({
        credential: encrypted,
        recordId,
      }),
    ).resolves.toEqual(credential);
  });

  it('roundtrips with a non-extractable password-derived key', async () => {
    const password = await encodePasswordAsync({
      password: 'test-password-1',
    });
    const derived = await deriveHyperLiquidAgentSecretKey({ password });
    try {
      expect(derived.key.extractable).toBe(false);
      const encrypted = await encryptHyperLiquidAgentCredentialWithSessionKey({
        credential,
        key: derived.key,
        recordId,
      });
      expect(
        encrypted.startsWith(HYPERLIQUID_AGENT_PASSWORD_ENCRYPTED_PREFIX),
      ).toBe(true);
      expect(encrypted).not.toContain(credential.privateKey);
      await expect(
        decryptHyperLiquidAgentCredentialWithSessionKey({
          credential: encrypted,
          key: derived.key,
          recordId,
        }),
      ).resolves.toEqual(credential);
    } finally {
      derived.rawKey.fill(0);
    }
  });

  it('binds ciphertext to both the password and credential record id', async () => {
    const [password, wrongPassword] = await Promise.all([
      encodePasswordAsync({ password: 'test-password-1' }),
      encodePasswordAsync({ password: 'test-password-2' }),
    ]);
    const [derived, wrongDerived] = await Promise.all([
      deriveHyperLiquidAgentSecretKey({ password }),
      deriveHyperLiquidAgentSecretKey({ password: wrongPassword }),
    ]);
    try {
      const encrypted = await encryptHyperLiquidAgentCredentialWithSessionKey({
        credential,
        key: derived.key,
        recordId,
      });
      await expect(
        decryptHyperLiquidAgentCredentialWithSessionKey({
          credential: encrypted,
          key: wrongDerived.key,
          recordId,
        }),
      ).rejects.toThrow();
      await expect(
        decryptHyperLiquidAgentCredentialWithSessionKey({
          credential: encrypted,
          key: derived.key,
          recordId: `${recordId}--other`,
        }),
      ).rejects.toThrow();
    } finally {
      derived.rawKey.fill(0);
      wrongDerived.rawKey.fill(0);
    }
  });
});

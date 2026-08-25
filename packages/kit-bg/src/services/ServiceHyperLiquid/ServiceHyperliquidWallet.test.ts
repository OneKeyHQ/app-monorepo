import { ethers } from 'ethers';

import { EHyperLiquidAgentName } from '@onekeyhq/shared/src/consts/perp';

import localDb from '../../dbs/local/localDb';

import { WalletHyperliquidProxy } from './ServiceHyperliquidWallet';

jest.mock('../../dbs/local/localDb', () => ({
  __esModule: true,
  default: {
    getHyperLiquidAgentCredential: jest.fn(),
  },
}));

const mockedLocalDb = localDb as unknown as {
  getHyperLiquidAgentCredential: jest.Mock;
};

const signOrder = (wallet: WalletHyperliquidProxy) =>
  wallet.signTypedData(
    {
      chainId: 1,
      name: 'HyperLiquid',
      verifyingContract: '0x0000000000000000000000000000000000000000',
      version: '1',
    },
    {
      Order: [{ name: 'nonce', type: 'uint256' }],
    },
    { nonce: 1 },
  );

describe('WalletHyperliquidProxy', () => {
  beforeEach(() => {
    mockedLocalDb.getHyperLiquidAgentCredential.mockReset();
  });

  it('loads the private key for each signature without retaining it', async () => {
    const privateKey =
      '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const agentAddress = new ethers.Wallet(privateKey).address;
    const credentialInfo = {
      agentAddress,
      agentName: EHyperLiquidAgentName.OneKeyAgent1,
      userAddress: '0x1111111111111111111111111111111111111111',
      validUntil: 2_000_000_000_000,
    };
    mockedLocalDb.getHyperLiquidAgentCredential.mockResolvedValue({
      ...credentialInfo,
      privateKey,
    });
    const wallet = new WalletHyperliquidProxy(credentialInfo);
    const sign = () => signOrder(wallet);

    expect(JSON.stringify(wallet)).not.toContain(privateKey);
    await expect(sign()).resolves.toMatch(/^0x[0-9a-f]+$/i);
    await expect(sign()).resolves.toMatch(/^0x[0-9a-f]+$/i);
    expect(mockedLocalDb.getHyperLiquidAgentCredential).toHaveBeenCalledTimes(
      2,
    );
    expect(JSON.stringify(wallet)).not.toContain(privateKey);
  });

  it('rejects signing when the fetched key does not match the advertised agent address', async () => {
    const advertisedKey =
      '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const mismatchedKey =
      '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
    const credentialInfo = {
      agentAddress: new ethers.Wallet(advertisedKey).address,
      agentName: EHyperLiquidAgentName.OneKeyAgent1,
      userAddress: '0x1111111111111111111111111111111111111111',
      validUntil: 2_000_000_000_000,
    };
    mockedLocalDb.getHyperLiquidAgentCredential.mockResolvedValue({
      ...credentialInfo,
      privateKey: mismatchedKey,
    });
    const wallet = new WalletHyperliquidProxy(credentialInfo);

    await expect(signOrder(wallet)).rejects.toThrow(
      /does not match the active agent address/,
    );
  });

  it('accepts a checksum-cased agent address case-insensitively', async () => {
    const privateKey =
      '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const checksumCasedAddress = new ethers.Wallet(privateKey).address;
    const credentialInfo = {
      // Stored casing may differ from the checksum casing ethers derives.
      agentAddress: checksumCasedAddress.toLowerCase(),
      agentName: EHyperLiquidAgentName.OneKeyAgent1,
      userAddress: '0x1111111111111111111111111111111111111111',
      validUntil: 2_000_000_000_000,
    };
    mockedLocalDb.getHyperLiquidAgentCredential.mockResolvedValue({
      ...credentialInfo,
      privateKey,
    });
    const wallet = new WalletHyperliquidProxy(credentialInfo);

    await expect(signOrder(wallet)).resolves.toMatch(/^0x[0-9a-f]+$/i);
  });
});

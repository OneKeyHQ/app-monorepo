import { getEarnProtocol } from '.';

import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import {
  EtherFiLiquidReferContract,
  MorphoBaseBundlerContract,
  MorphoBundlerContract,
  MorphoKatanaBundlerContract,
} from '@onekeyhq/shared/src/consts/addresses';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import { EEarnProviderEnum } from '@onekeyhq/shared/types/earn';
import { normalizeToEarnProvider } from '@onekeyhq/shared/types/earn/earnProvider.constants';
import { EApproveType } from '@onekeyhq/shared/types/staking';

describe('earnUtils Spark provider integration', () => {
  it('normalizes Spark provider identity for Earn routes and config lookup', () => {
    expect(normalizeToEarnProvider('spark')).toBe(EEarnProviderEnum.Spark);
    expect(earnUtils.getEarnProviderEnumKey('spark')).toBe(
      EEarnProviderEnum.Spark,
    );
    expect(earnUtils.getEarnProviderName({ providerName: 'spark' })).toBe(
      EEarnProviderEnum.Spark,
    );
  });

  it('uses the protocol vault for Spark requests and ERC20 approval', () => {
    const protocolVault = '0x28B3a8fb53B741A8Fd78c0fb9A6B2393d896a43d';

    expect(
      earnUtils.shouldSendEarnProtocolVault({ providerName: 'spark' }),
    ).toBe(true);
    expect(
      getEarnProtocol('spark').resolveApproveSpenderAddress({
        protocolVault,
      }),
    ).toBe(protocolVault);
  });

  it('fails closed until Spark returns a withdrawal path', () => {
    expect(
      earnUtils.isEarnWithdrawPathReady({
        providerName: 'Spark',
        isLoading: false,
      }),
    ).toBe(false);
    expect(
      earnUtils.isEarnWithdrawPathReady({
        providerName: 'Spark',
        isLoading: false,
        withdrawType: 'instant',
      }),
    ).toBe(true);
  });
});

describe('earnUtils permit allowance spender', () => {
  const approveSpenderAddress = '0x1111111111111111111111111111111111111111';

  it.each([
    [getNetworkIdsMap().eth, MorphoBundlerContract],
    [getNetworkIdsMap().base, MorphoBaseBundlerContract],
    [getNetworkIdsMap().katana, MorphoKatanaBundlerContract],
  ])(
    'uses the network-specific Morpho bundler on %s',
    (networkId, expected) => {
      expect(
        getEarnProtocol('Morpho').resolveAllowanceSpenderAddress({
          networkId,
          approveType: EApproveType.Permit,
          approveSpenderAddress,
        }),
      ).toBe(expected);
    },
  );

  it('keeps legacy Morpho and Spark approvals on their actual target', () => {
    for (const providerName of ['Morpho', 'Spark']) {
      expect(
        getEarnProtocol(providerName).resolveAllowanceSpenderAddress({
          networkId: getNetworkIdsMap().eth,
          approveType: EApproveType.Legacy,
          approveSpenderAddress,
        }),
      ).toBe(approveSpenderAddress);
    }
  });

  it('does not apply Morpho routing to other Permit providers', () => {
    expect(
      getEarnProtocol('EtherFi').resolveAllowanceSpenderAddress({
        networkId: getNetworkIdsMap().eth,
        approveType: EApproveType.Permit,
        approveSpenderAddress: EtherFiLiquidReferContract,
      }),
    ).toBe(EtherFiLiquidReferContract);
    expect(
      getEarnProtocol('Spark').resolveAllowanceSpenderAddress({
        networkId: getNetworkIdsMap().eth,
        approveType: EApproveType.Permit,
        approveSpenderAddress,
      }),
    ).toBe(approveSpenderAddress);
  });

  it('does not invent a missing target or a Morpho spender on another chain', () => {
    expect(
      getEarnProtocol('Morpho').resolveAllowanceSpenderAddress({
        networkId: getNetworkIdsMap().eth,
        approveType: EApproveType.Permit,
      }),
    ).toBe('');
    expect(
      getEarnProtocol('Morpho').resolveAllowanceSpenderAddress({
        networkId: getNetworkIdsMap().arbitrum,
        approveType: EApproveType.Permit,
        approveSpenderAddress,
      }),
    ).toBe('');
  });
});

describe('earnUtils EtherFi vault and Permit targets', () => {
  const protocolVault = '0xf0bb20865277abd641a307ece5ee04e79073416c';

  it.each(['etherfi', 'EtherFi', 'ETHERFI'])(
    'forwards the vault while keeping the deposit spender separate for %s',
    (providerName) => {
      expect(earnUtils.isEtherFiProvider({ providerName })).toBe(true);
      expect(earnUtils.shouldSendEarnProtocolVault({ providerName })).toBe(
        true,
      );
      expect(
        getEarnProtocol(providerName).resolveApproveSpenderAddress({
          protocolVault,
          backendApproveTarget: EtherFiLiquidReferContract,
        }),
      ).toBe(EtherFiLiquidReferContract);
      expect(
        getEarnProtocol(providerName).resolveApproveType({
          networkId: getNetworkIdsMap().eth,
          approveSpenderAddress: EtherFiLiquidReferContract,
          backendApproveType: EApproveType.Permit,
        }),
      ).toBe(EApproveType.Legacy);
    },
  );

  it('retains normal approval rules for native EtherFi and other providers', () => {
    expect(
      getEarnProtocol('etherfi').resolveApproveType({
        networkId: getNetworkIdsMap().eth,
        tokenIsNative: true,
        approveSpenderAddress: EtherFiLiquidReferContract,
        backendApproveType: EApproveType.Permit,
      }),
    ).toBeUndefined();
    expect(
      getEarnProtocol('morpho').resolveApproveType({
        networkId: getNetworkIdsMap().eth,
        approveSpenderAddress: MorphoBundlerContract,
        backendApproveType: EApproveType.Permit,
      }),
    ).toBe(EApproveType.Permit);
  });

  it('never substitutes the EtherFi receipt vault for missing approval data', () => {
    expect(
      getEarnProtocol('etherfi').resolveApproveSpenderAddress({
        protocolVault,
      }),
    ).toBe('');
    expect(
      getEarnProtocol('Morpho').resolveApproveSpenderAddress({
        protocolVault,
        backendApproveTarget: MorphoBundlerContract,
      }),
    ).toBe(protocolVault);
  });

  it.each([
    ['EtherFi', getNetworkIdsMap().eth, EtherFiLiquidReferContract],
    ['Morpho', getNetworkIdsMap().eth, MorphoBundlerContract],
    ['Morpho', getNetworkIdsMap().base, MorphoBaseBundlerContract],
    ['Morpho', getNetworkIdsMap().katana, MorphoKatanaBundlerContract],
  ])(
    'resolves a known Permit spender for %s on %s',
    (providerName, networkId, expected) => {
      expect(
        getEarnProtocol(providerName).resolvePermitSpenderAddress({
          networkId,
        }),
      ).toBe(expected);
    },
  );

  it.each([
    ['EtherFi', getNetworkIdsMap().base],
    ['EtherFi', getNetworkIdsMap().katana],
    ['Morpho', getNetworkIdsMap().arbitrum],
    ['Spark', getNetworkIdsMap().eth],
    ['unknown', getNetworkIdsMap().eth],
    ['', getNetworkIdsMap().eth],
  ])(
    'rejects an unregistered Permit pair %s on %s',
    (providerName, networkId) => {
      expect(
        getEarnProtocol(providerName).resolvePermitSpenderAddress({
          networkId,
        }),
      ).toBeUndefined();
    },
  );
});

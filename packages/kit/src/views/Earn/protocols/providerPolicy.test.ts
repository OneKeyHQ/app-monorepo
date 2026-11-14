import { getEarnProtocol } from '.';

import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { IMPL_EVM } from '@onekeyhq/shared/src/engine/engineConsts';
import { EEarnProviderEnum } from '@onekeyhq/shared/types/earn';
import { EClaimType } from '@onekeyhq/shared/types/staking';

describe('Earn provider policies', () => {
  it('keeps market history, redemption, maturity and slippage policies distinct', () => {
    const market = getEarnProtocol('PENDLE');
    const other = getEarnProtocol('other');
    expect(market.getApyHistoryPresentation()).toEqual({
      source: 'underlying',
      chart: 'fixed-income',
      rules: 'maturity-chart',
    });
    expect(other.getApyHistoryPresentation()).toEqual({
      source: 'standard',
      chart: 'standard',
      rules: 'grid',
    });
    expect(market.getDetailRedeemPolicy()).toBe('holding');
    expect(other.getDetailRedeemPolicy()).toBe('action');
    expect(market.canDepositAtMaturity({ matured: true })).toBe(false);
    expect(market.canDepositAtMaturity({ matured: false })).toBe(true);
    expect(other.canDepositAtMaturity({ matured: true })).toBe(true);
    expect(market.getDefaultEarnCategory()).toBe('fixedRate');
    expect(other.getDefaultEarnCategory()).toBeUndefined();
    expect(market.getManageSlippagePolicy()).toBe('configurable');
    expect(other.getManageSlippagePolicy()).toBe('none');
  });

  it.each([
    ['ETH', 'everstake-eth', 'standard', 'standard'],
    ['ATOM', 'standard', 'claim-together', 'standard'],
    ['POL', 'standard', 'standard', 'withdrawn'],
    ['eth ', 'standard', 'standard', 'standard'],
  ] as const)(
    'preserves Everstake %s portfolio labels',
    (symbol, pendingActivationTooltip, claimableTooltip, claimableLabel) => {
      expect(
        getEarnProtocol('EVERSTAKE').getDetailsPortfolioPresentation({
          symbol,
        }),
      ).toEqual({
        activePositions: 'standard',
        pendingActivationTooltip,
        claimableTooltip,
        claimableLabel,
      });
    },
  );

  it('keeps Falcon details data, sections, and portfolio presentation independent', () => {
    const falcon = getEarnProtocol('FALCON');
    const other = getEarnProtocol('other');
    expect(
      falcon.getDetailsPortfolioPresentation({ symbol: 'ETH' }).activePositions,
    ).toBe('split-falcon');
    expect(
      other.getDetailsPortfolioPresentation({ symbol: 'ETH' }).activePositions,
    ).toBe('standard');
    expect(
      falcon.resolveProfitApy({ aprWithoutFee: '3', dailyNetApy: '4' }),
    ).toBe('3');
    expect(falcon.resolveProfitApy({ dailyNetApy: '4' })).toBeUndefined();
    expect(
      other.resolveProfitApy({ aprWithoutFee: '3', dailyNetApy: '4' }),
    ).toBe('4');
    expect(falcon.getRewardTokenTooltip({ isEventActive: true })).toBe(
      'fixed-yield',
    );
    expect(falcon.getRewardTokenTooltip({ isEventActive: false })).toBe('none');
    expect(other.getRewardTokenTooltip({ isEventActive: true })).toBe('none');
    expect(falcon.getDetailsPeriodSection()).toBe('falcon-campaign');
    expect(other.getDetailsPeriodSection()).toBe('none');
    expect(falcon.getDetailsRiskSection()).toBe('usdf');
    expect(other.getDetailsRiskSection()).toBe('none');
    expect(falcon.getApyBreakdown()).toBe('falcon');
    expect(other.getApyBreakdown()).toBe('none');
  });

  it.each([
    'Morpho',
    'Spark',
    'Pendle',
    'EtherFi',
    'Lista',
    'Momentum',
    'Bitway',
  ])('uses the shared vault classification for %s APY breakdown', (name) => {
    expect(getEarnProtocol(name).getApyBreakdown()).toBe('vault');
  });

  it('keeps FAQ symbol and protection policies specific to their providers', () => {
    const params = { routeSymbol: 'route', tokenSymbol: 'token' };
    expect(getEarnProtocol('ETHERFI').resolveFaqSymbol(params)).toBe('route');
    expect(getEarnProtocol('other').resolveFaqSymbol(params)).toBe('token');
    expect(getEarnProtocol('MORPHO').showsProtectionSection()).toBe(true);
    expect(getEarnProtocol('other').showsProtectionSection()).toBe(false);
    expect(getEarnProtocol('ETHERFI').getLegacyApprovalGuardPolicy()).toBe(
      'etherfi',
    );
    expect(getEarnProtocol('other').getLegacyApprovalGuardPolicy()).toBe(
      'none',
    );
    expect(getEarnProtocol('ETHERFI').getWithdrawApprovalSource()).toBe(
      'detail',
    );
    expect(getEarnProtocol('other').getWithdrawApprovalSource()).toBe(
      'manage-page',
    );
  });
  it.each([
    ['Native', 'retain-selected-wrap', false, true, 'asset'],
    ['EtherFi', 'fail-closed', true, true, 'shares'],
    ['Pendle', 'retain-selected-wrap', false, false, 'asset'],
    ['other', 'retain-selected-wrap', false, false, 'asset'],
  ] as const)(
    'retains %s asset request, wrap validation and withdrawal policies',
    (
      name,
      onFailure,
      supplementCanonicalWeth,
      supportsCanonical,
      amountUnit,
    ) => {
      const protocol = getEarnProtocol(name);
      expect(protocol.getStakeAssetRequestPolicy()).toEqual({
        onFailure,
        supplementCanonicalWeth,
      });
      expect(protocol.getStakeAssetRequestPolicy()).toBe(
        protocol.getStakeAssetRequestPolicy(),
      );
      expect(protocol.supportsCanonicalWrappedStakeToken()).toBe(
        supportsCanonical,
      );
      expect(protocol.getWithdrawAmountUnit()).toBe(amountUnit);
    },
  );

  it.each([
    [
      'Native',
      { protocolSymbol: 'eth', tokenSymbol: 'ETH', tokenIsNative: true },
      'WETH',
    ],
    [
      'Native',
      {
        protocolSymbol: 'ETH',
        wrappedTokenSymbol: 'custom',
        tokenIsNative: true,
      },
      'custom',
    ],
    [
      'Native',
      { protocolSymbol: 'ETH', tokenSymbol: 'chosen', tokenIsNative: false },
      'chosen',
    ],
    ['Native', { protocolSymbol: 'BTC', tokenIsNative: true }, 'BTC'],
    [
      'EtherFi',
      { protocolSymbol: 'ETH', tokenSymbol: 'chosen', tokenIsNative: true },
      'chosen',
    ],
    ['EtherFi', { protocolSymbol: 'ETH' }, 'ETH'],
    ['other', { protocolSymbol: 'ETH', tokenSymbol: 'chosen' }, 'ETH'],
    ['other', { tokenSymbol: 'chosen' }, 'chosen'],
    ['other', {}, ''],
  ])('preserves %s stake request symbol', (name, params, expected) => {
    expect(getEarnProtocol(name).resolveStakeRequestSymbol(params)).toBe(
      expected,
    );
  });

  it('preserves Falcon registration and receive-asset eligibility', () => {
    const falcon = getEarnProtocol('Falcon');
    expect(falcon.requiresStakeRegistration({ isRegistered: undefined })).toBe(
      true,
    );
    expect(falcon.requiresStakeRegistration({ isRegistered: false })).toBe(
      true,
    );
    expect(falcon.requiresStakeRegistration({ isRegistered: true })).toBe(
      false,
    );
    expect(
      getEarnProtocol('other').requiresStakeRegistration({
        isRegistered: false,
      }),
    ).toBe(false);
    expect(
      getEarnProtocol('EtherFi').getWithdrawUiPolicy().receiveAssetSelection,
    ).toBe('enabled');
    expect(
      getEarnProtocol('Pendle').getWithdrawUiPolicy().receiveAssetSelection,
    ).toBe('enabled');
    expect(
      getEarnProtocol('other').getWithdrawUiPolicy().receiveAssetSelection,
    ).toBe('disabled');
  });
  it.each([
    [
      'Native',
      {
        selection: 'wrapped',
        approval: 'protocol',
        assetError: 'selected-wrap',
        assetResolution: 'first-available',
      },
    ],
    [
      'EtherFi',
      {
        selection: 'wrapped',
        approval: 'selected-asset',
        assetError: 'always',
        assetResolution: 'initial-token',
      },
    ],
    [
      'Pendle',
      {
        selection: 'market',
        approval: 'protocol',
        assetError: 'none',
        assetResolution: 'first-available',
      },
    ],
    [
      'Other',
      {
        selection: 'fixed',
        approval: 'protocol',
        assetError: 'none',
        assetResolution: 'first-available',
      },
    ],
  ])('keeps %s stake asset decisions independent', (name, expected) => {
    expect(getEarnProtocol(name).getStakeAssetPolicy()).toEqual(expected);
  });

  it('enables Babylon tracking only for Babylon', () => {
    expect(getEarnProtocol('BABYLON').getOrderTrackingPolicy()).toBe('babylon');
    expect(getEarnProtocol('other').getOrderTrackingPolicy()).toBe('standard');
    expect(getEarnProtocol('BABYLON').getWithdrawOrderPresentation()).toBe(
      'early-withdrawal',
    );
    expect(getEarnProtocol('other').getWithdrawOrderPresentation()).toBe(
      'standard',
    );
  });

  it.each([
    [true, true, 'none'],
    [true, false, 'none'],
    [true, undefined, 'none'],
    [false, true, 'none'],
    [false, false, 'falcon-apy-change'],
    [false, undefined, 'falcon-apy-change'],
  ] as const)(
    'preserves Falcon event notice active=%s dismissed=%s',
    (isEventActive, dismissed, expected) => {
      expect(
        getEarnProtocol('FALCON').getDepositEventNotice({
          isEventActive,
          dismissed,
        }),
      ).toBe(expected);
      expect(
        getEarnProtocol('other').getDepositEventNotice({
          isEventActive,
          dismissed,
        }),
      ).toBe('none');
    },
  );

  it('keeps Ethena KYC account and network choices separate from generic providers', () => {
    expect(getEarnProtocol('ETHENA').getKycAccountScanPolicy()).toEqual({
      kind: 'ethena',
      accountImpl: IMPL_EVM,
      networkId: getNetworkIdsMap().eth,
    });
    expect(getEarnProtocol('other').getKycAccountScanPolicy()).toBeUndefined();
  });

  it('selects Falcon and default rewards without merging their rates', () => {
    const apys = {
      rate: '4',
      weeklyNetApyWithoutFee: '3',
      performanceFee: '0',
      rewards: {},
      rebateReward: '0',
    };
    expect(
      getEarnProtocol('Falcon').getBaseRewardEstimate({
        apys,
        isEventActive: true,
      }),
    ).toEqual({ rate: '3', periodDivisor: 365, showAirdrop: true });
    expect(
      getEarnProtocol('falcon').getBaseRewardEstimate({
        apys: undefined,
        isEventActive: false,
      }),
    ).toEqual({ rate: 0, periodDivisor: 365, showAirdrop: false });
    expect(
      getEarnProtocol('other').getBaseRewardEstimate({
        apys,
        isEventActive: true,
      }),
    ).toEqual({ rate: '4', periodDivisor: 1, showAirdrop: false });
    expect(
      getEarnProtocol('other').getBaseRewardEstimate({
        apys: undefined,
        isEventActive: false,
      }),
    ).toEqual({ rate: 0, periodDivisor: 1, showAirdrop: false });
  });
  it('preserves default claim type and Everstake claim navigation', () => {
    const native = getEarnProtocol('Native');
    const everstake = getEarnProtocol('EVERSTAKE');
    const unknown = getEarnProtocol('other');
    expect(
      native.resolveDefaultClaimRequestType({ claimType: EClaimType.Claim }),
    ).toBe('normal');
    expect(
      native.resolveDefaultClaimRequestType({
        claimType: EClaimType.ClaimAirdrop,
      }),
    ).toBe('airdrop');
    expect(
      unknown.resolveDefaultClaimRequestType({
        claimType: EClaimType.ClaimAirdrop,
      }),
    ).toBe('airdrop');
    expect(
      unknown.resolveDefaultClaimRequestType({ claimType: EClaimType.Claim }),
    ).toBeUndefined();
    expect(
      native.resolveDefaultClaimRequestType({
        claimType: EClaimType.ClaimOrder,
      }),
    ).toBeUndefined();
    expect(everstake.getClaimNavigation({ symbol: 'APT' })).toBe(
      'amount-modal',
    );
    expect(everstake.getClaimNavigation({ symbol: 'apt ' })).toBe('standard');
    expect(unknown.getClaimNavigation({ symbol: 'APT' })).toBe('standard');
  });
  it.each([
    ['native', false],
    ['ETHERFI', true],
    ['Pendle', false],
    ['morpho', false],
    ['other', false],
  ])('preserves %s device rejection retry policy', (name, expected) => {
    expect(
      getEarnProtocol(name).getConfirmationRetryPolicy({
        task: 'direct',
        networkId: getNetworkIdsMap().eth,
      }).allowDeviceRejectionRetry,
    ).toBe(expected);
  });

  it('limits device rejection retry to EtherFi on Ethereum', () => {
    const etherFi = getEarnProtocol('eThErFi');
    expect(
      etherFi.getConfirmationRetryPolicy({
        task: 'wrapped',
        networkId: getNetworkIdsMap().eth,
      }).allowDeviceRejectionRetry,
    ).toBe(true);
    expect(
      etherFi.getConfirmationRetryPolicy({
        task: 'wrapped',
        networkId: getNetworkIdsMap().base,
      }).allowDeviceRejectionRetry,
    ).toBe(false);
  });

  it('keeps native wrapped and legacy direct retry policies distinct', () => {
    const native = getEarnProtocol('Native');
    const unknown = getEarnProtocol('other');
    expect(
      native.getConfirmationRetryPolicy({
        task: 'wrapped',
        networkId: getNetworkIdsMap().eth,
      }).allowManualResubmission,
    ).toBe(true);
    expect(
      unknown.getConfirmationRetryPolicy({
        task: 'wrapped',
        networkId: getNetworkIdsMap().eth,
        allowanceVerificationMode: 'legacy',
      }).allowManualResubmission,
    ).toBe(false);
    expect(
      unknown.getConfirmationRetryPolicy({
        task: 'direct',
        networkId: getNetworkIdsMap().eth,
        allowanceVerificationMode: 'legacy',
      }).allowManualResubmission,
    ).toBe(true);
  });

  it('limits the cooldown route to the existing Pendle Ethereum path', () => {
    const input = {
      networkId: getNetworkIdsMap().eth,
      pathCount: 2,
      selectedPathIndex: 0,
    };
    expect(getEarnProtocol('Pendle').shouldUseEthenaCooldown(input)).toBe(true);
    expect(
      getEarnProtocol('Pendle').shouldUseEthenaCooldown({
        ...input,
        networkId: getNetworkIdsMap().base,
      }),
    ).toBe(false);
    expect(
      getEarnProtocol('Pendle').shouldUseEthenaCooldown({
        ...input,
        pathCount: 1,
      }),
    ).toBe(false);
    expect(
      getEarnProtocol('Pendle').shouldUseEthenaCooldown({
        ...input,
        selectedPathIndex: 1,
      }),
    ).toBe(false);
    expect(getEarnProtocol('EtherFi').shouldUseEthenaCooldown(input)).toBe(
      false,
    );
  });

  it('retains validator selection and signature conditions for Stakefish', () => {
    const stakefish = getEarnProtocol('STAKEFISH');
    expect(
      stakefish.resolveValidatorStake({
        symbol: 'eth',
        selectedValidator: 'validator',
        isCreateNewValidator: true,
      }),
    ).toEqual({ mode: 'create' });
    expect(
      stakefish.resolveValidatorStake({
        symbol: 'SOL',
        selectedValidator: 'validator',
        isCreateNewValidator: true,
      }),
    ).toEqual({ mode: 'existing', identity: 'validator' });
    expect(
      stakefish.resolveValidatorStake({
        symbol: 'ETH',
        selectedValidator: '',
        isCreateNewValidator: true,
      }),
    ).toEqual({ mode: 'existing', identity: '' });
    expect(
      stakefish.requiresValidatorWithdrawSignature({
        symbol: 'eth',
        withdrawAll: true,
        hasSignature: false,
      }),
    ).toBe(true);
    expect(
      stakefish.requiresValidatorWithdrawSignature({
        symbol: 'eth',
        withdrawAll: true,
        hasSignature: true,
      }),
    ).toBe(false);
    expect(
      getEarnProtocol('other').requiresValidatorWithdrawSignature({
        symbol: 'ETH',
        withdrawAll: true,
        hasSignature: false,
      }),
    ).toBe(false);
  });

  it('retains EtherFi position identities and unresolved value behavior', () => {
    const etherFi = getEarnProtocol('ETHERFI');
    const other = getEarnProtocol('other');
    expect(
      etherFi.resolvePortfolioRequestIdentity({
        provider: 'EtherFi',
        symbol: 'USDC',
        vault: '0xVault',
      }),
    ).toEqual({
      provider: EEarnProviderEnum.EtherFi.toLowerCase(),
      symbol: '',
    });
    expect(
      etherFi.resolvePortfolioRequestIdentity({
        provider: 'eThErFi',
        symbol: 'USDC',
        vault: '',
      }),
    ).toEqual({
      provider: EEarnProviderEnum.EtherFi.toLowerCase(),
      symbol: 'USDC',
    });
    expect(
      other.resolvePortfolioRequestIdentity({
        provider: 'Other',
        symbol: 'USDC',
        vault: '0xVault',
      }),
    ).toEqual({ provider: 'Other', symbol: 'USDC' });
    expect(
      etherFi.resolvePortfolioSymbols({
        requestSymbol: 'USDC',
        responseSymbol: ' ',
      }),
    ).toEqual({ positionSymbol: ' ', assetSymbol: ' ' });
    expect(
      other.resolvePortfolioSymbols({
        requestSymbol: 'USDC',
        responseSymbol: ' ',
      }),
    ).toEqual({ positionSymbol: 'USDC', assetSymbol: 'USDC' });
    expect(etherFi.shouldPreserveUnsettledPortfolioValue('NaN')).toBe(true);
    expect(etherFi.shouldPreserveUnsettledPortfolioValue('0')).toBe(true);
    expect(etherFi.shouldPreserveUnsettledPortfolioValue('1')).toBe(false);
    expect(other.shouldPreserveUnsettledPortfolioValue('0')).toBe(false);
    expect(etherFi.removeConfirmedMissingPortfolioVault()).toBe(true);
    expect(other.removeConfirmedMissingPortfolioVault()).toBe(false);
    expect(
      etherFi.resolvePortfolioActionSymbol({
        assetSymbol: 'USDC',
        protocolSymbol: ' ',
      }),
    ).toBeUndefined();
    expect(
      other.resolvePortfolioActionSymbol({
        assetSymbol: 'USDC',
        protocolSymbol: ' ',
      }),
    ).toBe('USDC');
  });

  it('preserves Pendle positions and claim identities without affecting defaults', () => {
    const pendle = getEarnProtocol('Pendle');
    const other = getEarnProtocol('other');
    expect(pendle.hasPositionDetail({ symbol: 'USDe', actionCount: 0 })).toBe(
      false,
    );
    expect(pendle.hasPositionDetail({ symbol: 'USDe', actionCount: 1 })).toBe(
      true,
    );
    expect(other.hasPositionDetail({ symbol: 'USDe', actionCount: 0 })).toBe(
      true,
    );
    expect(pendle.canRedeemPosition({ symbol: 'USDe' })).toBe(true);
    expect(other.canRedeemPosition({ symbol: 'USDe' })).toBe(false);
    expect(pendle.shouldSellBeforeMaturity({ matured: false })).toBe(true);
    expect(pendle.shouldSellBeforeMaturity({ matured: true })).toBe(false);
    expect(other.shouldSellBeforeMaturity({ matured: false })).toBe(false);
    expect(
      pendle.resolveAirdropClaimIdentity({
        assetSymbol: 'USDe',
        assetVault: 'vault',
      }),
    ).toEqual({ symbol: 'USDe', vault: 'vault' });
    expect(
      other.resolveAirdropClaimIdentity({ assetSymbol: 'USDe' }),
    ).toBeUndefined();
  });

  it('keeps quote, approval and visual policies explicit', () => {
    expect(getEarnProtocol('Pendle').getWithdrawUiPolicy()).toEqual({
      receiveAssetSelection: 'enabled',
      allowNonQueuedApproval: true,
      requireCurrentQuoteAfterApproval: true,
      enableQuoteRefresh: true,
      confirmPriceImpact: true,
      action: 'swap',
      transactionLayout: 'market',
    });
    expect(getEarnProtocol('unrecognized').getWithdrawUiPolicy()).toEqual({
      receiveAssetSelection: 'disabled',
      allowNonQueuedApproval: false,
      requireCurrentQuoteAfterApproval: false,
      enableQuoteRefresh: false,
      confirmPriceImpact: false,
      action: 'withdraw',
      transactionLayout: 'standard',
    });
    expect(getEarnProtocol('Pendle').getPortfolioPresentation()).toEqual({
      rewardsHeading: 'ethena',
      earnings: 'market',
      showPositionValue: true,
    });
    expect(getEarnProtocol('other').getPortfolioPresentation()).toEqual({
      rewardsHeading: 'standard',
      earnings: 'standard',
      showPositionValue: false,
    });
    expect(getEarnProtocol('Stakefish').supportsSignedValidatorStake()).toBe(
      true,
    );
    expect(getEarnProtocol('Pendle').supportsSignedValidatorStake()).toBe(
      false,
    );
    expect(getEarnProtocol('Native').usesLegacyWrapProgress()).toBe(false);
    expect(getEarnProtocol('other').usesLegacyWrapProgress()).toBe(true);
  });

  it('keeps provider-specific route, fees, and presentation separate', () => {
    expect(getEarnProtocol('EtherFi').getCancelWithdrawalRoute()).toBe(
      'withdraw-options',
    );
    expect(getEarnProtocol('other').getCancelWithdrawalRoute()).toBe('direct');
    expect(getEarnProtocol('Morpho').usesClaimRewardTokenAddress()).toBe(true);
    expect(getEarnProtocol('Lido').getWithdrawFeePolicy()).toEqual({
      skipEstimate: true,
      includeTransactionIdentity: false,
    });
    expect(getEarnProtocol('Babylon').getWithdrawFeePolicy()).toEqual({
      skipEstimate: false,
      includeTransactionIdentity: true,
    });
    expect(getEarnProtocol('Pendle').getWithdrawUiPolicy().action).toBe('swap');
    expect(
      getEarnProtocol('Pendle').getStakePresentation().transactionLayout,
    ).toBe('market');
    expect(
      getEarnProtocol('other').getStakePresentation().transactionLayout,
    ).toBe('standard');
  });
});

import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import type { IStakingFlowConfig } from '@onekeyhq/shared/types/earn';
import { EClaimType } from '@onekeyhq/shared/types/staking';
import type {
  IEarnClaimType,
  IEarnStakeType,
  IProtocolInfo,
} from '@onekeyhq/shared/types/staking';

import { withdrawProtocolPlans } from './withdrawProtocol';

export type IEarnStakeTypeParams = {
  vaultSymbol?: string;
  tokenSymbol?: string;
  tokenIsNative?: boolean;
};

export type IEarnStakePreparationPolicy = 'confirm-setup-before-deposit';
export type IEarnTransactionLayout = 'market' | 'standard';
export type IEarnApyHistoryPresentation = Readonly<{
  source: 'underlying' | 'standard';
  chart: 'fixed-income' | 'standard';
  rules: 'maturity-chart' | 'grid';
}>;
export type IEarnDetailsPortfolioPresentation = Readonly<{
  activePositions: 'standard' | 'split-falcon';
  pendingActivationTooltip: 'standard' | 'everstake-eth';
  claimableTooltip: 'standard' | 'claim-together';
  claimableLabel: 'standard' | 'withdrawn';
}>;
export type IEarnStakeAssetPolicy = Readonly<{
  selection: 'wrapped' | 'market' | 'fixed';
  approval: 'selected-asset' | 'protocol';
  assetError: 'always' | 'selected-wrap' | 'none';
  assetResolution: 'initial-token' | 'first-available';
}>;

export type IEarnStakeAssetRequestPolicy = Readonly<{
  onFailure: 'fail-closed' | 'retain-selected-wrap';
  supplementCanonicalWeth: boolean;
}>;

export type IEarnStakeRequestSymbolParams = Readonly<{
  protocolSymbol?: string;
  tokenSymbol?: string;
  tokenIsNative?: boolean;
  wrappedTokenSymbol?: string;
}>;

export type IEarnStakePlan = Readonly<{
  execution: 'direct' | 'wrappedTask';
  preparationPolicy?: IEarnStakePreparationPolicy;
  requiresCurrentQuote: boolean;
}>;

export type IEarnStakePlanParams = Readonly<{
  stakeType?: IEarnStakeType;
  preparationPolicy?: IEarnStakePreparationPolicy;
}>;

export type IEarnStakePresentation = Readonly<{
  action: 'swap' | 'deposit';
  quoteRefresh: 'periodic' | 'standard';
  priceImpact: 'confirm' | 'none';
  feeInput: 'utxo' | 'standard';
  summary: 'validator' | 'standard';
  transactionLayout: IEarnTransactionLayout;
}>;

export type IEarnWithdrawUiPolicy = Readonly<{
  receiveAssetSelection: 'enabled' | 'disabled';
  allowNonQueuedApproval: boolean;
  requireCurrentQuoteAfterApproval: boolean;
  enableQuoteRefresh: boolean;
  confirmPriceImpact: boolean;
  action: 'withdraw' | 'swap';
  transactionLayout: IEarnTransactionLayout;
}>;

export type IEarnWithdrawParams = Readonly<{
  config: IStakingFlowConfig;
  useEthenaCooldown?: boolean;
}>;

export type IEarnWithdrawPlan =
  (typeof withdrawProtocolPlans)[keyof typeof withdrawProtocolPlans];

export type IEarnConfirmationRetryParams = Readonly<{
  task: 'direct' | 'wrapped';
  networkId: string;
  allowanceVerificationMode?: 'legacy';
}>;

export type IEarnConfirmationRetryPolicy = Readonly<{
  allowDeviceRejectionRetry: boolean;
  allowManualResubmission: boolean;
}>;

export type IEarnValidatorStakeParams = Readonly<{
  symbol: string;
  selectedValidator?: string;
  isCreateNewValidator: boolean;
}>;

export type IEarnValidatorStake = Readonly<{
  mode: 'none' | 'existing' | 'create';
  identity?: string;
}>;

export function resolveEthStakeType(
  symbol: string | undefined,
  tokenIsNative: boolean | undefined,
): IEarnStakeType | undefined {
  const normalizedSymbol = symbol?.toUpperCase();
  if (normalizedSymbol !== 'ETH' && normalizedSymbol !== 'WETH') {
    return undefined;
  }
  return tokenIsNative ? 'wrap' : 'normal';
}

const defaultStakePresentation: IEarnStakePresentation = {
  action: 'deposit',
  quoteRefresh: 'standard',
  priceImpact: 'none',
  feeInput: 'standard',
  summary: 'standard',
  transactionLayout: 'standard',
};

const defaultApyHistoryPresentation: IEarnApyHistoryPresentation = {
  source: 'standard',
  chart: 'standard',
  rules: 'grid',
};

const defaultDetailsPortfolioPresentation: IEarnDetailsPortfolioPresentation = {
  activePositions: 'standard',
  pendingActivationTooltip: 'standard',
  claimableTooltip: 'standard',
  claimableLabel: 'standard',
};

const defaultStakeAssetPolicy: IEarnStakeAssetPolicy = {
  selection: 'fixed',
  approval: 'protocol',
  assetError: 'none',
  assetResolution: 'first-available',
};

const defaultStakeAssetRequestPolicy: IEarnStakeAssetRequestPolicy = {
  onFailure: 'retain-selected-wrap',
  supplementCanonicalWeth: false,
};

const defaultWithdrawUiPolicy: IEarnWithdrawUiPolicy = {
  receiveAssetSelection: 'disabled',
  allowNonQueuedApproval: false,
  requireCurrentQuoteAfterApproval: false,
  enableQuoteRefresh: false,
  confirmPriceImpact: false,
  action: 'withdraw',
  transactionLayout: 'standard',
};

export class EarnProtocol {
  constructor(readonly providerName = '') {}

  protected resolveProviderWithdraw(
    _params: IEarnWithdrawParams,
  ): IEarnWithdrawPlan | undefined {
    return undefined;
  }

  resolveWithdraw(params: IEarnWithdrawParams): IEarnWithdrawPlan {
    const { config, useEthenaCooldown } = params;
    // This backend capability has historically applied to any provider.
    if (config.unstakeWithSignMessage && !config.withdrawSignOnly)
      return withdrawProtocolPlans.lido;
    const protocolPlan = this.resolveProviderWithdraw(params);
    if (protocolPlan) return protocolPlan;
    if (!config.withdrawSignOnly && !useEthenaCooldown)
      return withdrawProtocolPlans.single;
    if (useEthenaCooldown) return withdrawProtocolPlans.ethena;
    return withdrawProtocolPlans.signOnly;
  }

  getStakePresentation(): IEarnStakePresentation {
    return defaultStakePresentation;
  }

  getApyHistoryPresentation(): IEarnApyHistoryPresentation {
    return defaultApyHistoryPresentation;
  }

  getDetailRedeemPolicy(): 'holding' | 'action' {
    return 'action';
  }

  canDepositAtMaturity(_params: { matured: boolean }): boolean {
    return true;
  }

  getDefaultEarnCategory(): 'fixedRate' | undefined {
    return undefined;
  }

  getManageSlippagePolicy(): 'configurable' | 'none' {
    return 'none';
  }

  getDetailsPortfolioPresentation(_params: {
    symbol: string;
  }): IEarnDetailsPortfolioPresentation {
    return defaultDetailsPortfolioPresentation;
  }

  resolveProfitApy({
    dailyNetApy,
  }: {
    aprWithoutFee?: string;
    dailyNetApy?: string;
  }): string | undefined {
    return dailyNetApy;
  }

  getRewardTokenTooltip(_params: {
    isEventActive: boolean;
  }): 'fixed-yield' | 'none' {
    return 'none';
  }

  getApyBreakdown(): 'vault' | 'falcon' | 'none' {
    return earnUtils.isVaultBasedProvider({ providerName: this.providerName })
      ? 'vault'
      : 'none';
  }

  getDetailsPeriodSection(): 'falcon-campaign' | 'none' {
    return 'none';
  }

  getDetailsRiskSection(): 'usdf' | 'none' {
    return 'none';
  }

  resolveFaqSymbol({
    tokenSymbol,
  }: {
    routeSymbol: string;
    tokenSymbol: string;
  }): string {
    return tokenSymbol;
  }

  showsProtectionSection(): boolean {
    return false;
  }

  getLegacyApprovalGuardPolicy(): 'etherfi' | 'none' {
    return 'none';
  }

  getWithdrawApprovalSource(): 'detail' | 'manage-page' {
    return 'manage-page';
  }

  getStakeAssetPolicy(): IEarnStakeAssetPolicy {
    return defaultStakeAssetPolicy;
  }

  getStakeAssetRequestPolicy(): IEarnStakeAssetRequestPolicy {
    return defaultStakeAssetRequestPolicy;
  }

  supportsCanonicalWrappedStakeToken(): boolean {
    return false;
  }

  resolveStakeRequestSymbol({
    protocolSymbol,
    tokenSymbol,
  }: IEarnStakeRequestSymbolParams): string {
    return protocolSymbol || tokenSymbol || '';
  }

  requiresStakeRegistration(_params: { isRegistered?: boolean }): boolean {
    return false;
  }

  getWithdrawAmountUnit(): 'shares' | 'asset' {
    return 'asset';
  }

  getOrderTrackingPolicy(): 'babylon' | 'standard' {
    return 'standard';
  }

  getWithdrawOrderPresentation(): 'early-withdrawal' | 'standard' {
    return 'standard';
  }

  getDepositEventNotice(_params: {
    isEventActive: boolean;
    dismissed: boolean | undefined;
  }): 'falcon-apy-change' | 'none' {
    return 'none';
  }

  getKycAccountScanPolicy():
    | { kind: 'ethena'; accountImpl: string; networkId: string }
    | undefined {
    return undefined;
  }

  getBaseRewardEstimate({
    apys,
  }: {
    apys: IProtocolInfo['apys'];
    isEventActive: boolean;
  }): { rate: string | number; periodDivisor: number; showAirdrop: boolean } {
    return { rate: apys?.rate ?? 0, periodDivisor: 1, showAirdrop: false };
  }

  getWithdrawUiPolicy(): IEarnWithdrawUiPolicy {
    return defaultWithdrawUiPolicy;
  }

  shouldUseEthenaCooldown(_params: {
    networkId: string | undefined;
    pathCount: number;
    selectedPathIndex: number;
  }): boolean {
    return false;
  }

  getWithdrawFeePolicy(): {
    skipEstimate: boolean;
    includeTransactionIdentity: boolean;
  } {
    return { skipEstimate: false, includeTransactionIdentity: false };
  }

  requiresValidatorWithdrawSignature(_params: {
    symbol: string;
    withdrawAll: boolean;
    hasSignature: boolean;
  }): boolean {
    return false;
  }

  getConfirmationRetryPolicy({
    task,
    allowanceVerificationMode,
  }: IEarnConfirmationRetryParams): IEarnConfirmationRetryPolicy {
    return {
      allowDeviceRejectionRetry: false,
      allowManualResubmission:
        task === 'direct' && allowanceVerificationMode === 'legacy',
    };
  }

  resolveValidatorStake(
    _params: IEarnValidatorStakeParams,
  ): IEarnValidatorStake {
    return { mode: 'none' };
  }

  supportsSignedValidatorStake(): boolean {
    return false;
  }

  usesLegacyWrapProgress(): boolean {
    return true;
  }

  getPortfolioPresentation(): {
    rewardsHeading: 'ethena' | 'standard';
    earnings: 'market' | 'standard';
    showPositionValue: boolean;
  } {
    return {
      rewardsHeading: 'standard',
      earnings: 'standard',
      showPositionValue: false,
    };
  }

  usesClaimRewardTokenAddress(): boolean {
    return false;
  }

  resolveDefaultClaimRequestType({
    claimType,
  }: {
    claimType: EClaimType;
  }): IEarnClaimType | undefined {
    return claimType === EClaimType.ClaimAirdrop ? 'airdrop' : undefined;
  }

  getClaimNavigation(_params: { symbol: string }): 'amount-modal' | 'standard' {
    return 'standard';
  }

  resolvePortfolioRequestIdentity({
    provider,
    symbol,
  }: {
    provider: string;
    symbol: string;
    vault?: string;
  }): { provider: string; symbol: string } {
    return { provider, symbol };
  }

  resolvePortfolioSymbols({
    requestSymbol,
    responseSymbol,
  }: {
    requestSymbol: string;
    responseSymbol?: string;
  }): { positionSymbol: string; assetSymbol: string } {
    return {
      positionSymbol: requestSymbol,
      assetSymbol: responseSymbol?.trim() ? responseSymbol : requestSymbol,
    };
  }

  shouldPreserveUnsettledPortfolioValue(_value: string): boolean {
    return false;
  }

  removeConfirmedMissingPortfolioVault(): boolean {
    return false;
  }

  resolvePortfolioActionSymbol({
    assetSymbol,
  }: {
    assetSymbol: string;
    protocolSymbol?: string;
  }): string | undefined {
    return assetSymbol;
  }

  resolveAirdropClaimIdentity(_params: {
    assetSymbol: string;
    assetVault?: string;
  }): { symbol: string; vault?: string } | undefined {
    return undefined;
  }

  getCancelWithdrawalRoute(): 'withdraw-options' | 'direct' {
    return 'direct';
  }

  hasPositionDetail(_params: { symbol: string; actionCount: number }): boolean {
    return true;
  }

  canRedeemPosition({ symbol }: { symbol: string }): boolean {
    return symbol.toUpperCase() !== 'USDE';
  }

  shouldSellBeforeMaturity(_params: { matured: boolean }): boolean {
    return false;
  }

  resolveStakeType(_params: IEarnStakeTypeParams): IEarnStakeType | undefined {
    return undefined;
  }

  requiresCurrentStakeQuote(): boolean {
    return false;
  }

  planStake({
    stakeType,
    preparationPolicy,
  }: IEarnStakePlanParams): IEarnStakePlan {
    let execution: IEarnStakePlan['execution'] = 'direct';
    if (stakeType === 'wrap') {
      execution = 'wrappedTask';
    }
    return {
      execution,
      preparationPolicy,
      requiresCurrentQuote: this.requiresCurrentStakeQuote(),
    };
  }
}

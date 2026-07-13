import { HttpTransport } from '@nktkas/hyperliquid';
import { createL1ActionHash } from '@nktkas/hyperliquid/signing';
import BigNumber from 'bignumber.js';

import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import {
  HYPERLIQUID_REFERRAL_CODE,
  HYPER_LIQUID_ORIGIN,
  PERPS_NETWORK_ID,
} from '@onekeyhq/shared/src/consts/perp';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import ServiceBase from '../ServiceBase';

import {
  logHyperLiquidApiFailure,
  requestLoggedHyperLiquidTransport,
} from './utils/logHyperLiquidApiFailure';

import type { IBackgroundApi } from '../../apis/IBackgroundApi';

@backgroundClass()
export default class ServiceHyperliquidReferral extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: IBackgroundApi }) {
    super({ backgroundApi });
  }

  // Deduplicate in-flight requests to avoid duplicate network calls
  private bannerCheckInFlight = new Map<
    string,
    Promise<{
      shouldShow: boolean;
      resolvedAccountId: string;
      resolvedAddress: string;
      reason?: string;
    }>
  >();

  private static RESULT_NOT_SHOW = {
    shouldShow: false as const,
    resolvedAccountId: '',
    resolvedAddress: '',
  };

  /**
   * Check eligibility for showing referral banner on Home screen.
   * Resolves the real EVM address internally (supports all-network mode).
   * Uses in-memory cache + in-flight deduplication to avoid duplicate network requests.
   */
  @backgroundMethod()
  async checkBannerReferralEligibility({
    accountId,
    indexedAccountId,
    deriveType,
  }: {
    accountId: string;
    indexedAccountId?: string;
    deriveType?: string;
  }): Promise<{
    shouldShow: boolean;
    resolvedAccountId: string;
    resolvedAddress: string;
    reason?: string;
  }> {
    // Condition 1: Account type must be HD, HW, or Imported (not watched)
    const isHd = accountUtils.isHdAccount({ accountId });
    const isHw = accountUtils.isHwAccount({ accountId });
    const isImported = accountUtils.isImportedAccount({ accountId });
    if (!(isHd || isHw || isImported)) {
      return {
        ...ServiceHyperliquidReferral.RESULT_NOT_SHOW,
        reason: 'invalid_account_type',
      };
    }

    // Reuse in-flight request for same params
    const cacheKey = `${accountId}:${indexedAccountId ?? ''}:${deriveType ?? ''}`;
    const inFlight = this.bannerCheckInFlight.get(cacheKey);
    if (inFlight) {
      return inFlight;
    }

    const promise = this._doCheckBannerEligibility({
      accountId,
      indexedAccountId,
      deriveType,
    }).finally(() => {
      this.bannerCheckInFlight.delete(cacheKey);
    });

    this.bannerCheckInFlight.set(cacheKey, promise);
    return promise;
  }

  private async _doCheckBannerEligibility({
    accountId,
    indexedAccountId,
    deriveType,
  }: {
    accountId: string;
    indexedAccountId?: string;
    deriveType?: string;
  }): Promise<{
    shouldShow: boolean;
    resolvedAccountId: string;
    resolvedAddress: string;
    reason?: string;
  }> {
    // Resolve real EVM address (handles all-network mock address)
    let resolvedAccountId = accountId;
    let resolvedAddress = '';
    try {
      const networkAccount =
        await this.backgroundApi.serviceAccount.getNetworkAccount({
          indexedAccountId: indexedAccountId || undefined,
          accountId: indexedAccountId ? undefined : accountId,
          networkId: PERPS_NETWORK_ID,
          deriveType: (deriveType as 'default') || 'default',
        });
      resolvedAccountId = networkAccount.id;
      resolvedAddress = networkAccount.address?.toLowerCase() ?? '';
    } catch {
      return {
        ...ServiceHyperliquidReferral.RESULT_NOT_SHOW,
        reason: 'resolve_address_failed',
      };
    }

    if (!/^0x[0-9a-f]{40}$/i.test(resolvedAddress)) {
      return {
        ...ServiceHyperliquidReferral.RESULT_NOT_SHOW,
        reason: 'invalid_address',
      };
    }

    // Check snooze first (local, no network)
    const snoozedUntil = await this.getReferralBannerSnoozedUntil({
      userAddress: resolvedAddress,
    });
    if (snoozedUntil > Date.now()) {
      return {
        ...ServiceHyperliquidReferral.RESULT_NOT_SHOW,
        reason: 'snoozed',
      };
    }

    // Check persistent cache (local, no network)
    const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
    const cached =
      await this.backgroundApi.simpleDb.perp.getReferralBannerCache(
        resolvedAddress,
      );
    if (cached) {
      const isPermanent =
        cached.reason === 'already_has_referrer' ||
        cached.reason === 'volume_over_10000';
      const isExpired =
        !isPermanent && Date.now() - cached.cachedAt > TWENTY_FOUR_HOURS_MS;
      if (!isExpired) {
        return {
          shouldShow: cached.shouldShow,
          resolvedAccountId,
          resolvedAddress,
          reason: `${cached.reason}_cached`,
        };
      }
    }

    // Condition 2: Account must be a normal user (not missing/vault/subAccount)
    const userRole = await this.getUserRole({ userAddress: resolvedAddress });
    if (userRole !== 'user') {
      return {
        ...ServiceHyperliquidReferral.RESULT_NOT_SHOW,
        reason: `user_role_${userRole}`,
      };
    }

    // Condition 3: No existing referrer (fail-closed: API error → don't show, no cache)
    const referralInfo = await this.getUserReferralInfo({
      userAddress: resolvedAddress,
    });
    if (!referralInfo) {
      return {
        ...ServiceHyperliquidReferral.RESULT_NOT_SHOW,
        reason: 'referral_info_error',
      };
    }

    const isBound = !!referralInfo.referredBy;
    const cumVlm = new BigNumber(referralInfo.cumVlm ?? '0');
    const isOverVolumeLimit = cumVlm.gte(10_000);
    const shouldShow = !isBound && !isOverVolumeLimit;
    let reason = 'eligible';
    if (isBound) {
      reason = 'already_has_referrer';
    } else if (isOverVolumeLimit) {
      reason = 'volume_over_10000';
    }

    // Persist cache
    await this.backgroundApi.simpleDb.perp.setReferralBannerCache(
      resolvedAddress,
      { shouldShow, reason, cachedAt: Date.now() },
    );

    return {
      shouldShow,
      resolvedAccountId,
      resolvedAddress,
      reason,
    };
  }

  @backgroundMethod()
  async invalidateBannerCache({
    userAddress,
  }: {
    userAddress: string;
  }): Promise<void> {
    await this.backgroundApi.simpleDb.perp.setReferralBannerCache(userAddress, {
      shouldShow: false,
      reason: 'already_has_referrer',
      cachedAt: Date.now(),
    });
  }

  /**
   * Check all conditions for showing the referral promotion checkbox.
   * Returns { shouldShow: true } if all conditions are met.
   */
  @backgroundMethod()
  async checkReferralPromotionConditions({
    origin,
    accountId,
    userAddress,
    isApproveAgentSign,
  }: {
    origin: string;
    accountId: string;
    userAddress: string;
    isApproveAgentSign: boolean;
  }): Promise<{ shouldShow: boolean; reason?: string }> {
    // Condition 1: Origin must be Hyperliquid and must be approveAgent sign
    if (origin !== HYPER_LIQUID_ORIGIN || !isApproveAgentSign) {
      defaultLogger.perp.hyperliquid.referralConditionCheck({
        userAddress,
        condition: 'origin_and_action',
        passed: false,
        reason: `origin=${origin}, isApproveAgentSign=${String(
          isApproveAgentSign,
        )}`,
      });
      return { shouldShow: false, reason: 'not_hyperliquid_approve_agent' };
    }

    // Condition 2: Account type must be HD, HW, or Imported (not watched)
    const isHd = accountUtils.isHdAccount({ accountId });
    const isHw = accountUtils.isHwAccount({ accountId });
    const isImported = accountUtils.isImportedAccount({ accountId });
    const isValidAccountType = isHd || isHw || isImported;
    if (!isValidAccountType) {
      defaultLogger.perp.hyperliquid.referralConditionCheck({
        userAddress,
        condition: 'account_type',
        passed: false,
        reason: `isHd=${String(isHd)}, isHw=${String(
          isHw,
        )}, isImported=${String(isImported)}`,
      });
      return { shouldShow: false, reason: 'invalid_account_type' };
    }

    // Condition 3: Account must be a normal user (not missing/vault/subAccount)
    const userRole = await this.getUserRole({ userAddress });
    if (userRole !== 'user') {
      defaultLogger.perp.hyperliquid.referralConditionCheck({
        userAddress,
        condition: 'user_role',
        passed: false,
        reason: `userRole=${userRole}`,
      });
      return { shouldShow: false, reason: `user_role_${userRole}` };
    }

    // Condition 4: No existing referrer
    const referralInfo = await this.getUserReferralInfo({ userAddress });
    if (referralInfo?.referredBy) {
      defaultLogger.perp.hyperliquid.referralConditionCheck({
        userAddress,
        condition: 'existing_referrer',
        passed: false,
        reason: `referredBy=${referralInfo.referredBy}`,
      });
      return { shouldShow: false, reason: 'already_has_referrer' };
    }

    defaultLogger.perp.hyperliquid.referralConditionCheck({
      userAddress,
      condition: 'all_conditions',
      passed: true,
    });
    return { shouldShow: true };
  }

  /**
   * Build EIP-712 TypedData for setReferrer L1 action.
   * This is used for two-step signing flow when binding referral code
   * after approveAgent sign from DApp (app.hyperliquid.xyz).
   */
  @backgroundMethod()
  async buildSetReferrerTypedData({ code }: { code: string }): Promise<{
    typedData: {
      types: {
        EIP712Domain: { name: string; type: string }[];
        Agent: { name: string; type: string }[];
      };
      primaryType: string;
      domain: {
        name: string;
        version: string;
        chainId: number;
        verifyingContract: string;
      };
      message: {
        source: string;
        connectionId: string;
      };
    };
    action: { type: string; code: string };
    nonce: number;
  }> {
    const action = { type: 'setReferrer', code };
    const nonce = Date.now();

    // Create the L1 action hash using SDK
    const connectionId = createL1ActionHash({
      action,
      nonce,
    });

    const typedData = {
      types: {
        EIP712Domain: [
          { name: 'name', type: 'string' },
          { name: 'version', type: 'string' },
          { name: 'chainId', type: 'uint256' },
          { name: 'verifyingContract', type: 'address' },
        ],
        Agent: [
          { name: 'source', type: 'string' },
          { name: 'connectionId', type: 'bytes32' },
        ],
      },
      primaryType: 'Agent',
      domain: {
        name: 'Exchange',
        version: '1',
        chainId: 1337, // Hyperliquid requires chainId to be 1337
        verifyingContract: '0x0000000000000000000000000000000000000000',
      },
      message: {
        source: 'a', // 'a' for mainnet, 'b' for testnet
        connectionId,
      },
    };

    return { typedData, action, nonce };
  }

  /**
   * Submit setReferrer request to Hyperliquid API with pre-signed signature.
   * This is the second step of the two-step signing flow.
   */
  @backgroundMethod()
  async submitSetReferrerWithSignature({
    action,
    nonce,
    signatureHex,
  }: {
    action: { type: string; code: string };
    nonce: number;
    signatureHex: string;
  }): Promise<{ status: string; response?: unknown }> {
    defaultLogger.perp.hyperliquid.referralBindingStep({
      step: 'submit_request',
      userAddress: 'service',
      message: `Submitting setReferrer with code: ${action.code}`,
    });

    // Parse signature hex to r, s, v format
    const sig = signatureHex.startsWith('0x')
      ? signatureHex.slice(2)
      : signatureHex;
    const r = `0x${sig.slice(0, 64)}`;
    const s = `0x${sig.slice(64, 128)}`;
    const vHex = sig.slice(128, 130);
    const vInt = parseInt(vHex, 16);
    // Normalize v value (EIP-155)
    const v = vInt < 27 ? vInt + 27 : vInt;

    const signature = { r, s, v };

    // Use SDK's HttpTransport to make the request
    const transport = new HttpTransport();
    const result = await requestLoggedHyperLiquidTransport<{
      status: string;
      response?: unknown;
    }>(
      transport,
      'exchange',
      {
        action,
        signature,
        nonce,
      },
      {
        action: action.type,
        extra: { source: 'ServiceHyperliquidReferral' },
      },
    );

    defaultLogger.perp.hyperliquid.referralBindingStep({
      step: 'complete',
      userAddress: 'service',
      message: `Submit result status: ${result.status}`,
    });

    return result;
  }

  @backgroundMethod()
  async getReferralCode(): Promise<string> {
    return HYPERLIQUID_REFERRAL_CODE;
  }

  /**
   * Log referral checkbox interaction from UI layer
   */
  @backgroundMethod()
  async logReferralCheckboxInteraction({
    userAddress,
    isChecked,
    action,
  }: {
    userAddress: string;
    isChecked: boolean;
    action: 'shown' | 'checked' | 'unchecked';
  }): Promise<void> {
    defaultLogger.perp.hyperliquid.referralCheckboxInteraction({
      userAddress,
      isChecked,
      action,
    });
  }

  /**
   * Log referral binding flow step from UI layer
   */
  @backgroundMethod()
  async logReferralBindingStep({
    step,
    userAddress,
    message,
    error,
  }: {
    step:
      | 'start'
      | 'build_typed_data'
      | 'sign_message'
      | 'submit_request'
      | 'complete'
      | 'error';
    userAddress: string;
    message?: string;
    error?: string;
  }): Promise<void> {
    defaultLogger.perp.hyperliquid.referralBindingStep({
      step,
      userAddress,
      message,
      error,
    });
  }

  /**
   * Log referral binding result from UI layer
   */
  @backgroundMethod()
  async logReferralBindingResult({
    userAddress,
    success,
    referralCode,
    errorMessage,
  }: {
    userAddress: string;
    success: boolean;
    referralCode: string;
    errorMessage?: string;
  }): Promise<void> {
    defaultLogger.perp.hyperliquid.referralBindingResult({
      userAddress,
      success,
      referralCode,
      errorMessage,
    });
  }

  /**
   * Get the timestamp until which the referral banner is snoozed
   */
  @backgroundMethod()
  async getReferralBannerSnoozedUntil({
    userAddress,
  }: {
    userAddress: string;
  }): Promise<number> {
    return this.backgroundApi.simpleDb.perp.getReferralBannerSnoozedUntil(
      userAddress,
    );
  }

  /**
   * Snooze the referral banner for 2 weeks
   * Called when user checks "两周内不再提示" and closes the dialog
   */
  @backgroundMethod()
  async snoozeReferralBanner({
    userAddress,
  }: {
    userAddress: string;
  }): Promise<void> {
    const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;
    const snoozedUntil = Date.now() + TWO_WEEKS_MS;
    await this.backgroundApi.simpleDb.perp.setReferralBannerSnoozedUntil(
      userAddress,
      snoozedUntil,
    );
    defaultLogger.perp.hyperliquid.referralConditionCheck({
      userAddress,
      condition: 'banner_snoozed',
      passed: false,
      reason: `snoozedUntil=${new Date(snoozedUntil).toISOString()}`,
    });
  }

  @backgroundMethod()
  async checkAccountHasBalance({
    userAddress,
  }: {
    userAddress: string;
  }): Promise<boolean> {
    try {
      const balance =
        await this.backgroundApi.serviceWebviewPerp.getAccountBalance({
          userAddress,
        });

      const accountValueBN = new BigNumber(balance.accountValue ?? 0);
      const withdrawableBN = new BigNumber(balance.withdrawable ?? 0);

      return (
        (accountValueBN.isFinite() && accountValueBN.gt(0)) ||
        (withdrawableBN.isFinite() && withdrawableBN.gt(0))
      );
    } catch {
      return false;
    }
  }

  private async getUserRole({
    userAddress,
  }: {
    userAddress: string;
  }): Promise<string> {
    try {
      const transport = new HttpTransport();
      const result = await transport.request<{ role: string }>('info', {
        type: 'userRole',
        user: userAddress,
      });
      return result?.role ?? 'missing';
    } catch (error) {
      await logHyperLiquidApiFailure({
        endpoint: 'info',
        action: 'userRole',
        request: {
          type: 'userRole',
          user: userAddress,
        },
        error,
        extra: { source: 'ServiceHyperliquidReferral' },
      });
      return 'missing';
    }
  }

  @backgroundMethod()
  async getUserReferralInfo({
    userAddress,
  }: {
    userAddress: string;
  }): Promise<{ referredBy?: string; cumVlm?: string } | null> {
    try {
      const transport = new HttpTransport();
      const result = await transport.request<{
        referredBy?: string | null;
        cumVlm?: string;
        [key: string]: unknown;
      }>('info', {
        type: 'referral',
        user: userAddress,
      });

      defaultLogger.perp.hyperliquid.referralConditionCheck({
        userAddress,
        condition: 'get_referral_info',
        passed: true,
        reason: `referredBy=${result?.referredBy ?? 'none'}, cumVlm=${result?.cumVlm ?? '0'}`,
      });

      return {
        referredBy: result?.referredBy ?? undefined,
        cumVlm: result?.cumVlm ?? '0',
      };
    } catch (error) {
      await logHyperLiquidApiFailure({
        endpoint: 'info',
        action: 'referral',
        request: {
          type: 'referral',
          user: userAddress,
        },
        error,
        extra: { source: 'ServiceHyperliquidReferral' },
      });
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      defaultLogger.perp.hyperliquid.referralConditionCheck({
        userAddress,
        condition: 'get_referral_info',
        passed: false,
        reason: `error: ${errorMessage}`,
      });
      // Return null on error to allow showing checkbox (fail-open)
      return null;
    }
  }
}

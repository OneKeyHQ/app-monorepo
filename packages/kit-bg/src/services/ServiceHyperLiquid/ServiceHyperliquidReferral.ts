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
} from '@onekeyhq/shared/src/consts/perp';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import ServiceBase from '../ServiceBase';

import type { IBackgroundApi } from '../../apis/IBackgroundApi';

// 7 days in milliseconds
const REFERRAL_PROMPT_COOLDOWN_MS = timerUtils.getTimeDurationMs({
  seconds: 0,
});

@backgroundClass()
export default class ServiceHyperliquidReferral extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: IBackgroundApi }) {
    super({ backgroundApi });
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
    const logPrefix = '[HyperliquidReferral] checkReferralPromotionConditions:';

    // Condition 1: Origin must be Hyperliquid and must be approveAgent sign
    if (origin !== HYPER_LIQUID_ORIGIN || !isApproveAgentSign) {
      console.log(
        logPrefix,
        'Not showing - origin mismatch or not approveAgent sign',
        { origin, expected: HYPER_LIQUID_ORIGIN, isApproveAgentSign },
      );
      return { shouldShow: false, reason: 'not_hyperliquid_approve_agent' };
    }

    // Condition 2: Account type must be HD, HW, or Imported (not watched)
    const isHd = accountUtils.isHdAccount({ accountId });
    const isHw = accountUtils.isHwAccount({ accountId });
    const isImported = accountUtils.isImportedAccount({ accountId });
    const isValidAccountType = isHd || isHw || isImported;
    if (!isValidAccountType) {
      console.log(logPrefix, 'Not showing - invalid account type', {
        accountId,
        isHd,
        isHw,
        isImported,
      });
      return { shouldShow: false, reason: 'invalid_account_type' };
    }

    // Condition 3: Time interval check (7 days cooldown)
    const lastShownTime =
      await this.backgroundApi.simpleDb.perp.getReferralPromptLastShownTime(
        userAddress,
      );
    if (
      lastShownTime &&
      Date.now() - lastShownTime < REFERRAL_PROMPT_COOLDOWN_MS
    ) {
      const daysSinceLastShown = Math.floor(
        (Date.now() - lastShownTime) / (24 * 60 * 60 * 1000),
      );
      console.log(logPrefix, 'Not showing - shown recently', {
        daysSinceLastShown,
        cooldownDays: 7,
        userAddress,
      });
      return { shouldShow: false, reason: 'shown_recently' };
    }

    // Condition 4: Account has balance
    const hasBalance = await this.checkAccountHasBalance({ userAddress });
    if (!hasBalance) {
      console.log(logPrefix, 'Not showing - account has no balance', {
        userAddress,
      });
      return { shouldShow: false, reason: 'no_balance' };
    }

    // Condition 5: No existing referrer
    const referralInfo = await this.getUserReferralInfo({ userAddress });
    if (referralInfo?.referredBy) {
      console.log(logPrefix, 'Not showing - already has referrer', {
        referredBy: referralInfo.referredBy,
        userAddress,
      });
      return { shouldShow: false, reason: 'already_has_referrer' };
    }

    console.log(logPrefix, 'Showing referral checkbox', { userAddress });
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
    const result = await transport.request<{
      status: string;
      response?: unknown;
    }>('exchange', {
      action,
      signature,
      nonce,
    });

    return result;
  }

  @backgroundMethod()
  async getReferralCode(): Promise<string> {
    return HYPERLIQUID_REFERRAL_CODE;
  }

  @backgroundMethod()
  async checkAccountHasBalance({
    userAddress,
  }: {
    userAddress: string;
  }): Promise<boolean> {
    // try {
    //   const balance =
    //     await this.backgroundApi.serviceWebviewPerp.getAccountBalance({
    //       userAddress,
    //     });

    //   const accountValueBN = new BigNumber(balance.accountValue ?? 0);
    //   const withdrawableBN = new BigNumber(balance.withdrawable ?? 0);

    //   return (
    //     (accountValueBN.isFinite() && accountValueBN.gt(0)) ||
    //     (withdrawableBN.isFinite() && withdrawableBN.gt(0))
    //   );
    // } catch {
    //   return false;
    // }
    return true;
  }

  @backgroundMethod()
  async getUserReferralInfo({
    userAddress,
  }: {
    userAddress: string;
  }): Promise<{ referredBy?: string } | null> {
    try {
      const transport = new HttpTransport();
      const result = await transport.request<{
        referredBy?: string | null;
        [key: string]: unknown;
      }>('info', {
        type: 'referral',
        user: userAddress,
      });

      console.log('[HyperliquidReferral] getUserReferralInfo result:', {
        userAddress,
        referredBy: result?.referredBy,
      });

      return {
        referredBy: result?.referredBy ?? undefined,
      };
    } catch (error) {
      console.warn('[HyperliquidReferral] Failed to get referral info:', error);
      // Return null on error to allow showing checkbox (fail-open)
      return null;
    }
  }
}

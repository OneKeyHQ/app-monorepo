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
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import ServiceBase from '../ServiceBase';

import type { IBackgroundApi } from '../../apis/IBackgroundApi';

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

    // Condition 3: Account has balance
    const hasBalance = await this.checkAccountHasBalance({ userAddress });
    if (!hasBalance) {
      defaultLogger.perp.hyperliquid.referralConditionCheck({
        userAddress,
        condition: 'account_balance',
        passed: false,
        reason: 'no_balance',
      });
      return { shouldShow: false, reason: 'no_balance' };
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
    const result = await transport.request<{
      status: string;
      response?: unknown;
    }>('exchange', {
      action,
      signature,
      nonce,
    });

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
   * Get whether user has opted out of referral promotion
   */
  @backgroundMethod()
  async getReferralPromptOptedOut({
    userAddress,
  }: {
    userAddress: string;
  }): Promise<boolean> {
    return this.backgroundApi.simpleDb.perp.getReferralPromptOptedOut(
      userAddress,
    );
  }

  /**
   * Set user's referral promotion opt-out preference
   * Called when user unchecks the checkbox or HW wallet rejects signature
   */
  @backgroundMethod()
  async setReferralPromptOptedOut({
    userAddress,
    optedOut,
  }: {
    userAddress: string;
    optedOut: boolean;
  }): Promise<void> {
    await this.backgroundApi.simpleDb.perp.setReferralPromptOptedOut(
      userAddress,
      optedOut,
    );
    defaultLogger.perp.hyperliquid.referralConditionCheck({
      userAddress,
      condition: 'opt_out_preference_set',
      passed: !optedOut,
      reason: `optedOut=${String(optedOut)}`,
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

      defaultLogger.perp.hyperliquid.referralConditionCheck({
        userAddress,
        condition: 'get_referral_info',
        passed: true,
        reason: `referredBy=${result?.referredBy ?? 'none'}`,
      });

      return {
        referredBy: result?.referredBy ?? undefined,
      };
    } catch (error) {
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

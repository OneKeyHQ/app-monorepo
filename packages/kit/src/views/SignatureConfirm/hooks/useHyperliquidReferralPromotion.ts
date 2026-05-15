import { useCallback, useEffect, useMemo, useState } from 'react';

import { HardwareErrorCode } from '@onekeyfe/hd-shared';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  HYPERLIQUID_REFERRAL_CODE,
  HYPER_LIQUID_ORIGIN,
  PERPS_NETWORK_ID,
} from '@onekeyhq/shared/src/consts/perp';
import type { OneKeyHardwareError } from '@onekeyhq/shared/src/errors';
import { EMessageTypesEth } from '@onekeyhq/shared/types/message';

interface IUseHyperliquidReferralPromotionParams {
  origin: string;
  accountId: string;
  userAddress: string;
  unsignedMessage: string;
}

interface IUseHyperliquidReferralPromotionResult {
  shouldShowReferralCheckbox: boolean;
  isReferralChecked: boolean;
  setIsReferralChecked: (checked: boolean) => void;
  bindReferralCodeAfterSign: () => Promise<void>;
  isCheckingConditions: boolean;
}

export function useHyperliquidReferralPromotion({
  origin,
  accountId,
  userAddress,
  unsignedMessage,
}: IUseHyperliquidReferralPromotionParams): IUseHyperliquidReferralPromotionResult {
  const [isReferralChecked, setIsReferralChecked] = useState(true); // Default checked, will be updated by opt-out check

  // Check if this is a Hyperliquid approveAgent signature
  const isApproveAgentSign = useMemo(() => {
    if (origin !== HYPER_LIQUID_ORIGIN) {
      return false;
    }
    try {
      const typedData = JSON.parse(unsignedMessage) as {
        message?: { type?: string };
        primaryType?: string;
      };
      return (
        typedData?.message?.type === 'approveAgent' &&
        typedData?.primaryType === 'HyperliquidTransaction:ApproveAgent'
      );
    } catch {
      return false;
    }
  }, [origin, unsignedMessage]);

  const shouldCheckReferralPromotion =
    Boolean(origin && accountId && userAddress) && isApproveAgentSign;

  // Check snooze state and set default checkbox state
  const { result: snoozeResult } = usePromiseResult(async () => {
    if (!shouldCheckReferralPromotion) {
      return { snoozed: false };
    }
    const snoozedUntil =
      await backgroundApiProxy.serviceHyperliquidReferral.getReferralBannerSnoozedUntil(
        { userAddress },
      );
    return { snoozed: snoozedUntil > Date.now() };
  }, [shouldCheckReferralPromotion, userAddress]);

  // Update checkbox state based on snooze preference
  useEffect(() => {
    if (snoozeResult?.snoozed) {
      setIsReferralChecked(false);
    }
  }, [snoozeResult?.snoozed]);

  const { result, isLoading } = usePromiseResult(
    async () => {
      if (!shouldCheckReferralPromotion) {
        return { shouldShow: false };
      }

      return backgroundApiProxy.serviceHyperliquidReferral.checkReferralPromotionConditions(
        {
          origin,
          accountId,
          userAddress,
          isApproveAgentSign,
        },
      );
    },
    [
      origin,
      accountId,
      userAddress,
      isApproveAgentSign,
      shouldCheckReferralPromotion,
    ],
    { watchLoading: true },
  );

  const bindReferralCodeAfterSign = useCallback(async () => {
    if (!userAddress || !accountId) return;

    void backgroundApiProxy.serviceHyperliquidReferral.logReferralBindingStep({
      step: 'start',
      userAddress,
      message: 'Starting referral code binding flow',
    });

    try {
      // Step 1: Build the TypedData for setReferrer
      void backgroundApiProxy.serviceHyperliquidReferral.logReferralBindingStep(
        {
          step: 'build_typed_data',
          userAddress,
          message: `Building typed data for referral code: ${HYPERLIQUID_REFERRAL_CODE}`,
        },
      );

      const { typedData, action, nonce } =
        await backgroundApiProxy.serviceHyperliquidReferral.buildSetReferrerTypedData(
          {
            code: HYPERLIQUID_REFERRAL_CODE,
          },
        );

      // Step 2: Sign the TypedData using serviceSend.signMessage
      void backgroundApiProxy.serviceHyperliquidReferral.logReferralBindingStep(
        {
          step: 'sign_message',
          userAddress,
          message: `Signing setReferrer typed data: ${JSON.stringify(
            typedData,
          )}`,
        },
      );

      const signatureHex = await backgroundApiProxy.serviceSend.signMessage({
        unsignedMessage: {
          type: EMessageTypesEth.TYPED_DATA_V4,
          message: JSON.stringify(typedData),
          payload: [userAddress, JSON.stringify(typedData)],
        },
        accountId,
        networkId: PERPS_NETWORK_ID,
      });

      if (!signatureHex || typeof signatureHex !== 'string') {
        void backgroundApiProxy.serviceHyperliquidReferral.logReferralBindingStep(
          {
            step: 'error',
            userAddress,
            error: 'Failed to sign setReferrer - invalid signature',
          },
        );
        void backgroundApiProxy.serviceHyperliquidReferral.logReferralBindingResult(
          {
            userAddress,
            success: false,
            referralCode: HYPERLIQUID_REFERRAL_CODE,
            errorMessage: 'Invalid signature returned',
          },
        );
        return;
      }

      // Step 3: Submit the signed request to Hyperliquid API
      void backgroundApiProxy.serviceHyperliquidReferral.logReferralBindingStep(
        {
          step: 'submit_request',
          userAddress,
          message: `Submitting setReferrer request to Hyperliquid API, signature: ${signatureHex}`,
        },
      );

      const submitResult =
        await backgroundApiProxy.serviceHyperliquidReferral.submitSetReferrerWithSignature(
          {
            action,
            nonce,
            signatureHex,
          },
        );

      if (submitResult.status === 'ok') {
        void backgroundApiProxy.serviceHyperliquidReferral.logReferralBindingStep(
          {
            step: 'complete',
            userAddress,
            message: `Successfully bound referral code: ${JSON.stringify(
              submitResult,
            )}`,
          },
        );
        void backgroundApiProxy.serviceHyperliquidReferral.logReferralBindingResult(
          {
            userAddress,
            success: true,
            referralCode: HYPERLIQUID_REFERRAL_CODE,
          },
        );
        await backgroundApiProxy.serviceHyperliquidReferral.invalidateBannerCache(
          { userAddress },
        );
      } else {
        void backgroundApiProxy.serviceHyperliquidReferral.logReferralBindingStep(
          {
            step: 'error',
            userAddress,
            error: `API returned non-ok status: ${JSON.stringify(
              submitResult,
            )}`,
          },
        );
        void backgroundApiProxy.serviceHyperliquidReferral.logReferralBindingResult(
          {
            userAddress,
            success: false,
            referralCode: HYPERLIQUID_REFERRAL_CODE,
            errorMessage: `API status: ${submitResult.status}`,
          },
        );
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      void backgroundApiProxy.serviceHyperliquidReferral.logReferralBindingStep(
        {
          step: 'error',
          userAddress,
          error: errorMessage,
        },
      );
      void backgroundApiProxy.serviceHyperliquidReferral.logReferralBindingResult(
        {
          userAddress,
          success: false,
          referralCode: HYPERLIQUID_REFERRAL_CODE,
          errorMessage,
        },
      );

      // If user rejected/cancelled signing (HW wallet rejection or user cancel),
      // snooze the banner so checkbox defaults to unchecked next time
      const isUserRejection =
        (error as OneKeyHardwareError)?.code ===
        HardwareErrorCode.ActionCancelled;
      if (isUserRejection) {
        void backgroundApiProxy.serviceHyperliquidReferral.snoozeReferralBanner(
          { userAddress },
        );
      }
      // Silent failure - don't affect signing result
    }
  }, [userAddress, accountId]);

  return {
    shouldShowReferralCheckbox: result?.shouldShow ?? false,
    isReferralChecked,
    setIsReferralChecked,
    bindReferralCodeAfterSign,
    isCheckingConditions: isLoading ?? false,
  };
}

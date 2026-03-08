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

  // Check opt-out preference and set default checkbox state
  const { result: optOutResult } = usePromiseResult(async () => {
    if (!userAddress) {
      return { optedOut: false };
    }
    const optedOut =
      await backgroundApiProxy.serviceHyperliquidReferral.getReferralPromptOptedOut(
        { userAddress },
      );
    return { optedOut };
  }, [userAddress]);

  // Update checkbox state based on opt-out preference
  useEffect(() => {
    if (optOutResult?.optedOut) {
      setIsReferralChecked(false);
    }
  }, [optOutResult?.optedOut]);

  const { result, isLoading } = usePromiseResult(
    async () => {
      if (!origin || !accountId || !userAddress) {
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
    [origin, accountId, userAddress, isApproveAgentSign],
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
      // save opt-out preference so checkbox defaults to unchecked next time
      const isUserRejection =
        (error as OneKeyHardwareError)?.code ===
        HardwareErrorCode.ActionCancelled;
      if (isUserRejection) {
        void backgroundApiProxy.serviceHyperliquidReferral.setReferralPromptOptedOut(
          {
            userAddress,
            optedOut: true,
          },
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

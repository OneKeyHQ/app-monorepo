import { useCallback, useMemo, useState } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  HYPERLIQUID_REFERRAL_CODE,
  HYPER_LIQUID_ORIGIN,
  PERPS_NETWORK_ID,
} from '@onekeyhq/shared/src/consts/perp';
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
  const [isReferralChecked, setIsReferralChecked] = useState(true); // Default checked

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

  const { result, isLoading } = usePromiseResult(
    async () => {
      if (!origin || !accountId || !userAddress) {
        return { shouldShow: false };
      }

      return backgroundApiProxy.serviceHyperliquid.checkReferralPromotionConditions(
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

    try {
      // Update last shown time first
      await backgroundApiProxy.simpleDb.perp.setReferralPromptLastShownTime(
        userAddress,
        Date.now(),
      );

      // Step 1: Build the TypedData for setReferrer
      const { typedData, action, nonce } =
        await backgroundApiProxy.serviceHyperliquid.buildSetReferrerTypedData({
          code: HYPERLIQUID_REFERRAL_CODE,
        });

      // Step 2: Sign the TypedData using serviceSend.signMessage
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
        console.warn('[HyperliquidReferral] Failed to sign setReferrer');
        return;
      }

      // Step 3: Submit the signed request to Hyperliquid API
      const submitResult =
        await backgroundApiProxy.serviceHyperliquid.submitSetReferrerWithSignature(
          {
            action,
            nonce,
            signatureHex,
          },
        );

      if (submitResult.status === 'ok') {
        console.log('[HyperliquidReferral] Successfully bound referral code');
      } else {
        console.warn(
          '[HyperliquidReferral] Failed to bind referral code:',
          submitResult,
        );
      }
    } catch (error) {
      console.warn(
        '[HyperliquidReferral] Failed to bind referral code:',
        error,
      );
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

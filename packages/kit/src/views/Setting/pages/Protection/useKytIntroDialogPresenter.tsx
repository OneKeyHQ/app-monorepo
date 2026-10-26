import { useCallback, useEffect, useRef } from 'react';

import { useIntl } from 'react-intl';

import {
  Dialog,
  Icon,
  SizableText,
  Toast,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import type { IDialogInstance } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePrimePersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { RECEIVE_RISK_MONITORING_HELP_LINK } from '@onekeyhq/shared/src/config/appConfig';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { EPrimeFeatures } from '@onekeyhq/shared/src/routes/prime';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import type { IReceiveKytIntroTrackingEntryPoint } from '@onekeyhq/shared/types/kyt';

import { getErrorMessage } from '../../../Prime/primeSubscriptionPurchaseSuccess';

import { promptKytNotificationPermissionIfNeeded } from './showKytNotificationPermissionDialog';

function buildReceiveKytIntroTrackingParams(
  entryPoint: IReceiveKytIntroTrackingEntryPoint,
) {
  return {
    featureName: EPrimeFeatures.ReceiveRiskMonitoring,
    entryPoint,
    isPrimeActive: true,
  } as const;
}

const mobileFooterButtonProps = {
  flexGrow: 0,
  flexBasis: 'auto',
  w: '100%',
  justifyContent: 'center',
  textAlign: 'center',
} as const;

function KYTIntroDialogContent({
  entryPoint,
}: {
  entryPoint: IReceiveKytIntroTrackingEntryPoint;
}) {
  const intl = useIntl();

  return (
    <YStack>
      <SizableText size="$bodyLg">
        {intl.formatMessage({
          id: ETranslations.kyt_receive_risk_monitoring_intro_1__desc,
        })}
      </SizableText>
      <SizableText size="$bodyLg" mt="$3">
        {intl.formatMessage({
          id: ETranslations.kyt_receive_risk_monitoring_intro_2__desc,
        })}
      </SizableText>
      <XStack
        mt="$3"
        ai="center"
        alignSelf="flex-start"
        gap="$1"
        onPress={() => {
          defaultLogger.prime.usage.primeReceiveKytIntroAction({
            ...buildReceiveKytIntroTrackingParams(entryPoint),
            action: 'learnMore',
          });
          openUrlExternal(RECEIVE_RISK_MONITORING_HELP_LINK);
        }}
        cursor="pointer"
      >
        <SizableText size="$bodyMdMedium" color="$textSuccess">
          {intl.formatMessage({ id: ETranslations.global_learn_more })}
        </SizableText>
        <Icon name="ArrowTopRightOutline" size="$4.5" color="$iconSuccess" />
      </XStack>
    </YStack>
  );
}

export function useKytIntroDialogPresenter() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const { md } = useMedia();
  const [{ onekeyUserId }] = usePrimePersistAtom();
  const onekeyUserIdRef = useRef(onekeyUserId);
  onekeyUserIdRef.current = onekeyUserId;
  const isMountedRef = useRef(true);
  const dialogRef = useRef<IDialogInstance | undefined>(undefined);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      void Promise.resolve(
        dialogRef.current?.close({ flag: 'accountChanged' }),
      ).catch(() => undefined);
      dialogRef.current = undefined;
    };
  }, [onekeyUserId]);

  return useCallback(
    ({
      onClose,
      stayOnCurrentPage = false,
      isActive,
      entryPoint,
      targetUserId,
    }: {
      onClose?: () => void;
      stayOnCurrentPage?: boolean;
      isActive?: () => boolean;
      entryPoint: IReceiveKytIntroTrackingEntryPoint;
      targetUserId: string;
    }) => {
      const shouldContinue = () =>
        isMountedRef.current &&
        onekeyUserIdRef.current === targetUserId &&
        (isActive?.() ?? true);
      const trackingParams = buildReceiveKytIntroTrackingParams(entryPoint);
      defaultLogger.prime.usage.primeReceiveKytIntroShown(trackingParams);
      const instance = Dialog.show({
        icon: 'ShieldCheckDoneOutline',
        title: intl.formatMessage({
          id: ETranslations.prime_feature_receive_risk_monitoring__title,
        }),
        showFooter: true,
        onConfirmText: intl.formatMessage({
          id: ETranslations.kyt_receive_risk_monitoring_enable__action,
        }),
        onCancelText: intl.formatMessage({ id: ETranslations.global_not_now }),
        footerProps: md
          ? {
              flexDirection: 'column-reverse',
              gap: '$2.5',
              // No bottom safe-area inset here: the Dialog frame already pads by
              // the safe-area bottom, so the footer keeps only its default "$5".
            }
          : undefined,
        confirmButtonProps: md
          ? {
              ...mobileFooterButtonProps,
              size: 'large',
            }
          : undefined,
        cancelButtonProps: md
          ? {
              ...mobileFooterButtonProps,
              mx: '$0',
              my: '$0',
              px: '$5',
              py: '$3',
              size: 'large',
              variant: 'tertiary',
            }
          : undefined,
        renderContent: <KYTIntroDialogContent entryPoint={entryPoint} />,
        onConfirm: async (dialogInstance) => {
          if (!shouldContinue()) {
            await dialogInstance.close({ flag: 'accountChanged' });
            return;
          }
          defaultLogger.prime.usage.primeReceiveKytIntroAction({
            ...trackingParams,
            action: 'enable',
          });
          // Enabling here records server-side authorization; only close on success.
          const result =
            await backgroundApiProxy.serviceSetting.apiSetKytEnabled({
              enabled: true,
              onekeyUserId: targetUserId,
            });
          if (!result.applied || result.accountChanged || !shouldContinue()) {
            await dialogInstance.close({ flag: 'accountChanged' });
            return;
          }
          if (!result.kytEnabled) {
            // The server acknowledged the request but left KYT disabled. Keep
            // the dialog open so the user can retry instead of permanently
            // marking the intro as shown for a feature that never turned on.
            dialogInstance.preventClose();
            Toast.error({
              title: intl.formatMessage({
                id: ETranslations.global_an_error_occurred,
              }),
            });
            return;
          }
          await dialogInstance.close({ flag: 'confirm' });
          // Close the KYT dialog first, then prompt to enable notifications so the
          // user can actually receive high-risk push alerts.
          if (shouldContinue()) {
            dialogRef.current = await promptKytNotificationPermissionIfNeeded({
              navigation,
              intl,
              stayOnCurrentPage,
              shouldContinue,
            });
          }
        },
        onClose: (extra) => {
          // Both callers persist "shown" at presentation time. Closing repeats
          // completion in case that first background request failed.
          void backgroundApiProxy.serviceSetting
            .completeKytIntroClaim({ onekeyUserId: targetUserId })
            .catch((error) => {
              defaultLogger.prime.usage.primeReceiveKytIntroFlowFailed({
                stage: 'claimComplete',
                errorMessage: getErrorMessage(error),
              });
            });
          dialogRef.current = undefined;
          onClose?.();
          if (extra?.flag !== 'confirm' && extra?.flag !== 'accountChanged') {
            defaultLogger.prime.usage.primeReceiveKytIntroAction({
              ...trackingParams,
              action: 'dismiss',
            });
          }
        },
      });
      dialogRef.current = instance;
      return instance;
    },
    [intl, md, navigation],
  );
}

import { memo, useCallback, useEffect, useRef } from 'react';

import { useIntl } from 'react-intl';

import {
  Dialog,
  Icon,
  SizableText,
  XStack,
  YStack,
  useMedia,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useOneKeyAuthMethods } from '@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth';
import { usePrimePersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { RECEIVE_RISK_MONITORING_HELP_LINK } from '@onekeyhq/shared/src/config/appConfig';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { EPrimeFeatures } from '@onekeyhq/shared/src/routes/prime';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

const receiveKytIntroTrackingParams = {
  featureName: EPrimeFeatures.ReceiveRiskMonitoring,
  entryPoint: 'homeAutoIntro',
  isPrimeActive: true,
} as const;

const mobileFooterButtonProps = {
  flexGrow: 0,
  flexBasis: 'auto',
  w: '100%',
  justifyContent: 'center',
  textAlign: 'center',
} as const;

function KYTIntroDialogContent() {
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
            ...receiveKytIntroTrackingParams,
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

function useKYTIntroDialog() {
  const intl = useIntl();
  const { md } = useMedia();
  const { bottom } = useSafeAreaInsets();
  const { isPrimeSubscriptionActive } = useOneKeyAuthMethods();
  const [{ onekeyUserId }] = usePrimePersistAtom();
  const mobileFooterBottomPadding = Math.max(bottom, 20) + 20;
  // Track the last Prime user we evaluated so switching accounts re-checks the
  // per-user "shown" flag instead of being suppressed by a single mount guard.
  const processedUserIdRef = useRef<string | undefined>(undefined);

  const showDialog = useCallback(() => {
    defaultLogger.prime.usage.primeReceiveKytIntroShown(
      receiveKytIntroTrackingParams,
    );
    Dialog.show({
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
            pb: mobileFooterBottomPadding,
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
      renderContent: <KYTIntroDialogContent />,
      onConfirm: async (dialogInstance) => {
        defaultLogger.prime.usage.primeReceiveKytIntroAction({
          ...receiveKytIntroTrackingParams,
          action: 'enable',
        });
        // Enabling here records server-side authorization; only close on success.
        await backgroundApiProxy.serviceSetting.apiSetKytEnabled({
          enabled: true,
        });
        await dialogInstance.close({ flag: 'confirm' });
      },
      onClose: (extra) => {
        if (extra?.flag !== 'confirm') {
          defaultLogger.prime.usage.primeReceiveKytIntroAction({
            ...receiveKytIntroTrackingParams,
            action: 'dismiss',
          });
        }
      },
    });
  }, [intl, md, mobileFooterBottomPadding]);

  useEffect(() => {
    if (!isPrimeSubscriptionActive || !onekeyUserId) {
      return;
    }
    if (processedUserIdRef.current === onekeyUserId) {
      return;
    }
    processedUserIdRef.current = onekeyUserId;

    void (async () => {
      const isShown = await backgroundApiProxy.serviceSetting.isKytIntroShown({
        onekeyUserId,
      });
      if (isShown) {
        return;
      }
      // Added gate: only prompt when the server reports KYT is not yet enabled,
      // so users who already turned it on never see the intro again.
      const kytEnabled = await backgroundApiProxy.serviceSetting.getKytEnabled({
        onekeyUserId,
      });
      if (kytEnabled) {
        return;
      }
      await backgroundApiProxy.serviceSetting.setKytIntroShown({
        onekeyUserId,
      });
      showDialog();
    })();
  }, [isPrimeSubscriptionActive, onekeyUserId, showDialog]);
}

function BasicKYTIntroOnMount() {
  useKYTIntroDialog();
  return null;
}

export const KYTIntroOnMount = memo(BasicKYTIntroOnMount);

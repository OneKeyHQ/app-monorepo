import { memo, useCallback, useEffect, useRef } from 'react';

import { useIntl } from 'react-intl';

import {
  Dialog,
  Icon,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useOneKeyAuthMethods } from '@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth';
import { usePrimePersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';

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
        gap="$1"
        onPress={() => {
          // TODO: open learn more link once content is ready
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
  const { isPrimeSubscriptionActive } = useOneKeyAuthMethods();
  const [{ onekeyUserId }] = usePrimePersistAtom();
  // Track the last Prime user we evaluated so switching accounts re-checks the
  // per-user "shown" flag instead of being suppressed by a single mount guard.
  const processedUserIdRef = useRef<string | undefined>(undefined);

  const showDialog = useCallback(() => {
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
      renderContent: <KYTIntroDialogContent />,
      onConfirm: async (dialogInstance) => {
        // Enabling here records server-side authorization; only close on success.
        await backgroundApiProxy.serviceSetting.apiSetKytEnabled({
          enabled: true,
        });
        await dialogInstance.close();
      },
    });
  }, [intl]);

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

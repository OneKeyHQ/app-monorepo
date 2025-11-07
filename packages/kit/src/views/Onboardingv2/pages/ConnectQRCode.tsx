import { useCallback } from 'react';

import { EDeviceType } from '@onekeyfe/hd-shared';
import { useIntl } from 'react-intl';

import type { IPageScreenProps } from '@onekeyhq/components';
import {
  Anchor,
  Button,
  EVideoResizeMode,
  Page,
  SizableText,
  Video,
  XStack,
} from '@onekeyhq/components';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type {
  EOnboardingPagesV2,
  IOnboardingParamListV2,
} from '@onekeyhq/shared/src/routes/onboardingv2';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '../../../components/AccountSelector/AccountSelectorProvider';
import { useCreateQrWallet } from '../../../components/AccountSelector/hooks/useCreateQrWallet';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { useUserWalletProfile } from '../../../hooks/useUserWalletProfile';
import { OnboardingLayout } from '../components/OnboardingLayout';
import { trackHardwareWalletConnection } from '../utils';

import { ConnectionIndicator } from './ConnectYourDevice';

function ConnectQRCodePage() {
  const { createQrWallet } = useCreateQrWallet();
  const { isSoftwareWalletOnlyUser } = useUserWalletProfile();
  const intl = useIntl();
  const navigation = useAppNavigation();
  const STEPS = [
    intl.formatMessage({ id: ETranslations.select_connect_app_on_home }),
    intl.formatMessage({ id: ETranslations.tap_more_button_on_top_right }),
    intl.formatMessage({ id: ETranslations.select_onekey_app }),
    intl.formatMessage({ id: ETranslations.tap_show_qr_code }),
    intl.formatMessage({ id: ETranslations.tap_below_to_scan }),
  ];

  const handleScanQRCode = useCallback(async () => {
    try {
      // qrHiddenCreateGuideDialog.showDialog();
      // return;
      defaultLogger.account.wallet.addWalletStarted({
        addMethod: 'ConnectHWWallet',
        details: {
          hardwareWalletType: 'Standard',
          communication: 'QRCode',
        },
        isSoftwareWalletOnlyUser,
      });
      await createQrWallet({
        isOnboarding: true,
        isOnboardingV2: true,
        onFinalizeWalletSetupError: () => {
          // only pop when finalizeWalletSetup pushed
          navigation.pop();
        },
      });

      void trackHardwareWalletConnection({
        status: 'success',
        deviceType: EDeviceType.Pro,
        isSoftwareWalletOnlyUser,
        hardwareTransportType: 'QRCode',
      });
    } catch (error) {
      // Clear force transport type on QR wallet creation error
      void backgroundApiProxy.serviceHardware.clearForceTransportType();
      errorToastUtils.toastIfError(error);
      void trackHardwareWalletConnection({
        status: 'failure',
        deviceType: EDeviceType.Pro,
        isSoftwareWalletOnlyUser,
        hardwareTransportType: 'QRCode',
      });
      throw error;
    }
  }, [createQrWallet, isSoftwareWalletOnlyUser, navigation]);

  return (
    <Page>
      <OnboardingLayout>
        <OnboardingLayout.Header
          title={intl.formatMessage({ id: ETranslations.connect_with_qr_code })}
        />
        <OnboardingLayout.Body>
          <ConnectionIndicator>
            <ConnectionIndicator.Card>
              <ConnectionIndicator.Animation>
                <Video
                  w="100%"
                  h="100%"
                  repeat
                  resizeMode={EVideoResizeMode.COVER}
                  controls={false}
                  playInBackground={false}
                  source={require('@onekeyhq/kit/assets/onboarding/onBoarding-QR.mp4')}
                />
              </ConnectionIndicator.Animation>
              <ConnectionIndicator.Content gap="$4">
                {STEPS.map((step, index) => (
                  <XStack key={index}>
                    <SizableText w="$6">{index + 1}.</SizableText>
                    <SizableText flex={1} flexShrink={1}>
                      {step}
                    </SizableText>
                  </XStack>
                ))}
                <Button mt="$2" variant="primary" onPress={handleScanQRCode}>
                  {intl.formatMessage({ id: ETranslations.scan_scan_qr_code })}
                </Button>
              </ConnectionIndicator.Content>
            </ConnectionIndicator.Card>
          </ConnectionIndicator>
        </OnboardingLayout.Body>
        <OnboardingLayout.Footer>
          <Anchor
            href="https://help.onekey.so/articles/11461088"
            target="_blank"
            size="$bodySm"
            color="$textSubdued"
          >
            {intl.formatMessage({
              id: ETranslations.learn_more_about_qr_code_wallet,
            })}
          </Anchor>
        </OnboardingLayout.Footer>
      </OnboardingLayout>
    </Page>
  );
}

export default function ConnectYourDevice() {
  return (
    <AccountSelectorProviderMirror
      enabledNum={[0]}
      config={{
        sceneName: EAccountSelectorSceneName.home,
      }}
    >
      <ConnectQRCodePage />
    </AccountSelectorProviderMirror>
  );
}

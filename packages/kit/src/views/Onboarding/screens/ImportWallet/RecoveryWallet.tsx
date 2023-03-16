import { useCallback, useMemo, useState } from 'react';

import { useRoute } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import {
  Center,
  KeyboardAvoidingView,
  Spinner,
  useThemeValue,
} from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useAppSelector } from '../../../../hooks';
import { OnboardingAddExistingWallet } from '../../../CreateWallet/AddExistingWallet';
import Layout from '../../Layout';

import { AccessoryView } from './Component/AccessoryView';
import { useAccessory } from './Component/hooks';
import Drawer from './ImportWalletGuideDrawer';
import SecondaryContent from './SecondaryContent';

import type { EOnboardingRoutes } from '../../routes/enums';
import type { IOnboardingRoutesParams } from '../../routes/types';
import type { RouteProp } from '@react-navigation/native';

const defaultProps = {} as const;

type RouteProps = RouteProp<
  IOnboardingRoutesParams,
  EOnboardingRoutes.RecoveryWallet
>;

const RecoveryWallet = () => {
  const intl = useIntl();
  const bgColor = useThemeValue('background-default');
  const onBoardingLoadingBehindModal = useAppSelector(
    (s) => s.runtime.onBoardingLoadingBehindModal,
  );
  const [drawerVisible, setDrawerVisible] = useState(false);
  const route = useRoute<RouteProps>();
  const onPressDrawerTrigger = useCallback(() => {
    setDrawerVisible(true);
  }, []);
  const { disableAnimation, mode } = route.params;
  const enableListenInput = mode === 'mnemonic';

  const { valueText, accessoryData, onChangeText, onSelectedKeybordAcessory } =
    useAccessory();

  const getPageTitleKey = useMemo(() => {
    if (mode === 'mnemonic') return 'title__import_recovery_phrase';
    if (mode === 'imported') return 'title__import_private_key';
    return 'wallet__watched_accounts';
  }, [mode]);

  return onBoardingLoadingBehindModal ? (
    <Center bgColor={bgColor} flex={1} height="full">
      <Spinner size="lg" />
    </Center>
  ) : (
    <>
      <Layout
        disableAnimation={disableAnimation}
        title={intl.formatMessage({ id: getPageTitleKey })}
        secondaryContent={
          <SecondaryContent
            mode={mode}
            onPressDrawerTrigger={onPressDrawerTrigger}
          />
        }
      >
        <OnboardingAddExistingWallet
          inputMode={mode}
          onChangeTextForMnemonic={enableListenInput ? onChangeText : undefined}
          valueTextForMnemonic={enableListenInput ? valueText : undefined}
        />
      </Layout>
      <Drawer visible={drawerVisible} onClose={() => setDrawerVisible(false)} />
      {platformEnv.isNative && mode === 'mnemonic' && (
        <KeyboardAvoidingView
          behavior={platformEnv.isNativeIOS ? 'position' : 'height'}
        >
          <AccessoryView
            p={3}
            withKeybord
            accessoryData={accessoryData}
            selected={onSelectedKeybordAcessory}
          />
        </KeyboardAvoidingView>
      )}
    </>
  );
};

RecoveryWallet.defaultProps = defaultProps;

export default RecoveryWallet;

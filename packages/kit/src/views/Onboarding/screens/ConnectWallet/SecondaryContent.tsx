import React, { FC, useMemo } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import { Box, Center, Hidden, useToast } from '@onekeyhq/components';
import LogoLedger from '@onekeyhq/kit/assets/onboarding/logo_ledger.png';
import LogoTrezor from '@onekeyhq/kit/assets/onboarding/logo_trezor.png';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useAddExternalAccount } from '../../../../components/WalletConnect/useAddExternalAccount';
import {
  ConnectWalletListItem,
  ConnectWalletListView,
} from '../../../../components/WalletConnect/WalletConnectQrcodeModal';
import { useOnboardingDone } from '../../../../hooks/useOnboardingRequired';
import { wait } from '../../../../utils/helper';

const SecondaryContent: FC = () => {
  const addExternalAccount = useAddExternalAccount();
  const onboardingDone = useOnboardingDone();
  const toast = useToast();
  const intl = useIntl();

  const options = useMemo(
    () => [
      {
        logo: LogoTrezor,
        label: 'Trezor',
        available: false,
      },
      {
        logo: LogoLedger,
        label: 'Ledger',
        available: false,
      },
    ],
    [],
  );

  return (
    <>
      <Center flex={1}>
        <Hidden from="sm">
          <Box
            testID="ConnectWallet-SecondaryContent-Divider"
            w="full"
            h={platformEnv.isNative ? StyleSheet.hairlineWidth : '1px'}
            bgColor="divider"
            mt={-4}
            mb={1}
          />
        </Hidden>
        <Box
          flexDir={{ sm: 'row' }}
          flexWrap={{ sm: 'wrap' }}
          alignSelf="stretch"
          mx={-2}
        >
          <ConnectWalletListView
            onConnectResult={async (result) => {
              await addExternalAccount(result);
              await onboardingDone();
              await wait(600);
              toast.show({
                title: intl.formatMessage({ id: 'msg__account_imported' }),
              });
            }}
          />
          {options.map((option) => (
            <ConnectWalletListItem
              key={option.label}
              label={option.label}
              available={option.available}
              logoSource={option.logo}
              onPress={() => {}}
            />
          ))}
        </Box>
      </Center>
    </>
  );
};

export default React.memo(SecondaryContent);

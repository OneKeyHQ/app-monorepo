import React, { useEffect, useMemo } from 'react';

import { useNavigation } from '@react-navigation/core';
import { StackNavigationProp } from '@react-navigation/stack';
import { useIntl } from 'react-intl';

import { Center, Spinner } from '@onekeyhq/components';

import backgroundApiProxy from '../../../../../background/instance/backgroundApiProxy';
import Protected, {
  ValidationFields,
} from '../../../../../components/Protected';
import { useData } from '../../../../../hooks/redux';
import Layout from '../../../Layout';
import { EOnboardingRoutes } from '../../../routes/enums';
import { IOnboardingRoutesParams } from '../../../routes/types';

import SecondaryContent from './SecondaryContent';

type NavigationProps = StackNavigationProp<
  IOnboardingRoutesParams,
  EOnboardingRoutes.SetPassword
>;

function RedirectToRecoveryPhrase({
  password,
  withEnableAuthentication,
}: {
  password: string;
  withEnableAuthentication?: boolean;
}) {
  const navigation = useNavigation<NavigationProps>();

  useEffect(() => {
    (async function () {
      const mnemonic = await backgroundApiProxy.engine.generateMnemonic();

      navigation.replace(EOnboardingRoutes.RecoveryPhrase, {
        password,
        withEnableAuthentication,
        mnemonic,
      });

      // navigation.replace(CreateWalletModalRoutes.AttentionsModal, {
      //   password,
      //   withEnableAuthentication,
      // });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Center h="full" w="full">
      <Spinner size="lg" />
    </Center>
  );
}

const RedirectToRecoveryPhraseMemo = React.memo(RedirectToRecoveryPhrase);

const SetPassword = () => {
  const intl = useIntl();
  const { isPasswordSet } = useData();

  const title = useMemo(
    () =>
      isPasswordSet
        ? intl.formatMessage({
            id: 'Verify_Password',
          })
        : intl.formatMessage({ id: 'title__set_password' }),
    [intl, isPasswordSet],
  );

  return (
    <>
      <Layout title={title} secondaryContent={<SecondaryContent />}>
        <Protected
          hideTitle
          walletId={null}
          skipSavePassword
          field={ValidationFields.Wallet}
        >
          {(password, { withEnableAuthentication }) => (
            <RedirectToRecoveryPhraseMemo
              password={password}
              withEnableAuthentication={withEnableAuthentication}
            />
          )}
        </Protected>
      </Layout>
    </>
  );
};

export default SetPassword;

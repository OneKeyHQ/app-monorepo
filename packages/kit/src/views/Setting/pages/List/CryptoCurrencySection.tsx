import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { ListItem } from '@onekeyhq/components';
import type { IPageNavigationProp } from '@onekeyhq/components/src/layouts/Navigation';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { EModalRoutes } from '@onekeyhq/kit/src/routes/Modal/type';
import { EModalSettingRoutes } from '@onekeyhq/kit/src/views/Setting/router/types';

import { Section } from './Section';

import type { IModalSettingParamList } from '../../router/types';

export const CryptoCurrencySection = () => {
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSettingParamList>>();
  const onPress = useCallback(() => {
    navigation.pushModal(EModalRoutes.SettingModal, {
      screen: EModalSettingRoutes.SettingSpendUTXOModal,
    });
  }, [navigation]);
  const onAccountDerivation = useCallback(() => {
    navigation.pushModal(EModalRoutes.SettingModal, {
      screen: EModalSettingRoutes.SettingAccountDerivationModal,
    });
  }, [navigation]);
  const intl = useIntl();
  return (
    <Section title="CRYPTOCURRENCY">
      <ListItem
        onPress={onPress}
        icon="CryptoCoinOutline"
        title={intl.formatMessage({ id: 'form__spend_dust_utxo' })}
        drillIn
      />
      <ListItem
        onPress={onAccountDerivation}
        icon="AlbumsOutline"
        title="Account derivation"
        drillIn
      />
    </Section>
  );
};

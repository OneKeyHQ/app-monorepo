import { useCallback, useEffect, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Box, Icon, SectionList, Typography } from '@onekeyhq/components';

import { useAppSelector, useNavigation } from '../../../../hooks';
import { showEnableExtTipsSheet } from '../enableExtSheet';

import { WalletSwitchCell } from './component/WalletSwitchCell';
import { useWalletSwitch } from './hooks/useWalletSwitch';

import type { SectionListRenderItem } from 'react-native';

export type WalletGroup = { title: string; data: string[] };

const WalletSwitch = () => {
  const navigation = useNavigation();
  const disableShowSheet = useAppSelector(
    (s) => s.settings.disableExtSwitchTips,
  );
  const intl = useIntl();
  useEffect(() => {
    navigation.setOptions({
      title: intl.formatMessage({ id: 'form__wallet_switch' }),
    });
  }, [intl, navigation]);
  const { walletSwitchSectionData } = useWalletSwitch();
  const renderItem: SectionListRenderItem<string, WalletGroup> = useCallback(
    ({ item }) => (
      <WalletSwitchCell
        toggleWalletSwitch={() => {
          if (!disableShowSheet) {
            showEnableExtTipsSheet();
          }
        }}
        walletId={item}
      />
    ),
    [disableShowSheet],
  );
  const renderSectionHeader = useCallback(
    ({ section: { title } }) => (
      <Typography.Subheading mt={4} color="text-subdued">
        {title}
      </Typography.Subheading>
    ),
    [],
  );
  const headerComponent = useMemo(
    () => (
      <Box
        borderRadius="12px"
        bgColor="surface-neutral-subdued"
        p={4}
        flexDirection="row"
        mb={2}
      >
        <Icon name="InformationCircleMini" />
        <Typography.Body2Strong ml={2}>
          {intl.formatMessage({
            id: 'content__when_the_option_is_turned_on_the_inject_cnonection_method_for_that_wallet_will_be_overridden_by_onekey',
          })}
        </Typography.Body2Strong>
        <Box />
      </Box>
    ),
    [intl],
  );
  return (
    <Box flex={1} p={4}>
      <SectionList
        sections={walletSwitchSectionData}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        ListHeaderComponent={headerComponent}
      />
    </Box>
  );
};

export default WalletSwitch;

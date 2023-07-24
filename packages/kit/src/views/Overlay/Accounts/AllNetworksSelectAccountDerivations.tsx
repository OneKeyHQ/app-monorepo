import type { FC } from 'react';
import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Box, List, ListItem, Typography, VStack } from '@onekeyhq/components';
import { shortenAddress } from '@onekeyhq/components/src/utils';
import type { Account } from '@onekeyhq/engine/src/types/account';
import type { Network } from '@onekeyhq/engine/src/types/network';

import { showOverlay } from '../../../utils/overlayUtils';
import { BottomSheetSettings } from '../BottomSheetSettings';

interface Props {
  network: Network;
  accounts: Account[];
  onClose?: () => unknown;
  onConfirm: (account: Account) => unknown;
}

const sp = () => <Box h="2" />;

const AccountDerivationsSelector: FC<Props> = ({
  accounts,
  onConfirm,
  onClose,
  network,
}) => {
  const intl = useIntl();
  const renderItem = useCallback(
    ({ item }: { item: Account }) => {
      let accountInfoName = Object.values(
        network?.settings?.accountNameInfo ?? {},
      )?.find?.((n) => n.template === item.template)?.label;

      if (typeof accountInfoName === 'object' && accountInfoName.id) {
        accountInfoName = intl.formatMessage({ id: accountInfoName.id });
      }

      return (
        <ListItem
          onPress={() => {
            onConfirm(item);
            onClose?.();
          }}
        >
          <ListItem.Column key={item.id}>
            <VStack>
              <Typography.Body1Strong mb="1">
                {shortenAddress(item.address)}
              </Typography.Body1Strong>
              <Typography.Body2>{accountInfoName}</Typography.Body2>
            </VStack>
          </ListItem.Column>
        </ListItem>
      );
    },
    [intl, network.settings, onConfirm, onClose],
  );
  return (
    <List
      data={accounts}
      renderItem={renderItem}
      ItemSeparatorComponent={sp}
      keyExtractor={(item) => item.id}
    />
  );
};

export const showAllNetworksAccountDerivationsSelector = (props: Props) =>
  showOverlay((closeOverlay) => (
    <BottomSheetSettings
      titleI18nKey="form__select_address"
      closeOverlay={closeOverlay}
    >
      <AccountDerivationsSelector {...props} onClose={closeOverlay} />
    </BottomSheetSettings>
  ));

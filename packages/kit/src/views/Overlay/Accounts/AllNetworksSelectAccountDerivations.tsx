import type { FC } from 'react';

import { Pressable, Typography, VStack } from '@onekeyhq/components';
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

const AccountDerivationsSelector: FC<Props> = ({
  accounts,
  onConfirm,
  onClose,
  network,
}) => (
  <VStack>
    {accounts?.map((a) => {
      const accountInfoName = Object.values(
        network?.settings?.accountNameInfo ?? {},
      )?.find?.((n) => n.template === a.template)?.label;
      return (
        <Pressable
          key={a.id}
          mb="4"
          onPress={() => {
            onConfirm(a);
            onClose?.();
          }}
        >
          <Typography.Body1Strong mb="1">
            {shortenAddress(a.address)}
          </Typography.Body1Strong>
          <Typography.Body2>{accountInfoName}</Typography.Body2>
        </Pressable>
      );
    })}
  </VStack>
);

export const showAllNetworksAccountDerivationsSelector = (props: Props) =>
  showOverlay((closeOverlay) => (
    <BottomSheetSettings
      titleI18nKey="form__select_address"
      closeOverlay={closeOverlay}
    >
      <AccountDerivationsSelector {...props} onClose={closeOverlay} />
    </BottomSheetSettings>
  ));

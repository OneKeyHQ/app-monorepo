import type { FC } from 'react';

import { useIntl } from 'react-intl';

import {
  HStack,
  Typography,
  VStack,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import type { ModalProps } from '@onekeyhq/components/src/Modal';

import { useActiveWalletAccount } from '../../hooks';
import { showOverlay } from '../../utils/overlayUtils';

import { BottomSheetSettings } from './BottomSheetSettings';
import AllNetworksHelp from './Svg/AllNetworksHelp';

type Props = Pick<ModalProps, 'onClose'>;

const AllNetworksHelpComp: FC<Props> = () => {
  const intl = useIntl();
  const { bottom } = useSafeAreaInsets();
  const { account } = useActiveWalletAccount();
  return (
    <VStack pb={`${bottom}px`}>
      <Typography.DisplayLarge textAlign="center">
        {intl.formatMessage({ id: 'modal__all_networks_account' })}
      </Typography.DisplayLarge>
      <Typography.Body1 textAlign="center" mt="2" mb="6" color="text-subdued">
        {intl.formatMessage({ id: 'modal__all_networks_account_desc' })}
      </Typography.Body1>
      <HStack justifyContent="center">
        <AllNetworksHelp />
      </HStack>
      <HStack w="full" justifyContent="space-between" mt="6">
        <Typography.Body1>
          {intl.formatMessage({ id: 'form__current' })}
        </Typography.Body1>
        <Typography.Body1Strong>{account?.name}</Typography.Body1Strong>
      </HStack>
    </VStack>
  );
};
export const showAllNetworksHelp = () =>
  showOverlay((closeOverlay) => (
    <BottomSheetSettings closeOverlay={closeOverlay} titleI18nKey="title__help">
      <AllNetworksHelpComp onClose={closeOverlay} />
    </BottomSheetSettings>
  ));

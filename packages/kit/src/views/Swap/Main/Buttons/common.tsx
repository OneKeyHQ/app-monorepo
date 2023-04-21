import { useCallback } from 'react';
import type { FC } from 'react';

import { useIntl } from 'react-intl';

import {
  BottomSheetModal,
  Box,
  Button,
  Center,
  HStack,
  Typography,
} from '@onekeyhq/components';

import { useNavigation } from '../../../../hooks';
import { useActiveWalletAccount } from '../../../../hooks/redux';
import { RootRoutes } from '../../../../routes/types';

export const MainButton: FC = ({ children }) => {
  const intl = useIntl();
  const navigation = useNavigation();
  const { wallet } = useActiveWalletAccount();

  const onCreateWallet = useCallback(() => {
    navigation.navigate(RootRoutes.Onboarding);
  }, [navigation]);

  if (!wallet) {
    return (
      <Button size="xl" type="primary" onPress={onCreateWallet} key="addWallet">
        {intl.formatMessage({ id: 'action__create_wallet' })}
      </Button>
    );
  }
  return <Box>{children}</Box>;
};

type SwapTransactionsCancelApprovalBottomSheetModalProps = {
  close: () => void;
  onSubmit: () => void;
};

export const SwapTransactionsCancelApprovalBottomSheetModal: FC<
  SwapTransactionsCancelApprovalBottomSheetModalProps
> = ({ close, onSubmit }) => {
  const intl = useIntl();
  const onPress = useCallback(() => {
    close();
    onSubmit();
  }, [close, onSubmit]);
  return (
    <BottomSheetModal closeOverlay={close} title="" showHeader={false}>
      <Center h="16">
        <Typography.Heading fontSize={60}> ℹ️ </Typography.Heading>
      </Center>
      <Typography.DisplayMedium mt="4">
        {intl.formatMessage(
          { id: 'msg__need_to_send_str_transactions_to_change_allowance' },
          { '0': '2' },
        )}
      </Typography.DisplayMedium>
      <Typography.Body1 color="text-subdued" my="4">
        {intl.formatMessage({
          id: 'msg__modifying_the_authorized_limit_of_usdt_requires_resetting_it_to_zero_first_so_two_authorization_transactions_may_be_initiated',
        })}
      </Typography.Body1>
      <HStack flexDirection="row" space="4">
        <Button size="xl" type="basic" onPress={close} flex="1">
          {intl.formatMessage({ id: 'action__cancel' })}
        </Button>
        <Button size="xl" type="primary" onPress={onPress} flex="1">
          {intl.formatMessage({ id: 'action__confirm' })}
        </Button>
      </HStack>
    </BottomSheetModal>
  );
};

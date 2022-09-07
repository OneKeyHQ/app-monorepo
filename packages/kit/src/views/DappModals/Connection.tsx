import React, { useCallback, useEffect, useState } from 'react';

import { RouteProp, useRoute } from '@react-navigation/core';
import { Image } from 'native-base';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Box,
  Center,
  HStack,
  Icon,
  Modal,
  Spinner,
  Token,
  Typography,
  VStack,
} from '@onekeyhq/components';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import X from '@onekeyhq/kit/assets/connect_x.png';
import Logo from '@onekeyhq/kit/assets/logo_round.png';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { IDappSourceInfo } from '../../background/IBackgroundApi';
import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useActiveWalletAccount } from '../../hooks';
import useDappApproveAction from '../../hooks/useDappApproveAction';
import useDappParams from '../../hooks/useDappParams';

import RugConfirmDialog from './RugConfirmDialog';
import { DappConnectionModalRoutes, DappConnectionRoutesParams } from './types';

const MockData = {
  permissions: [
    {
      text: 'content__view_the_address_of_your_permitted_accounts_required',
      icon: 'EyeOutline',
    },
    {
      text: 'content__send_transactions_and_signature_request',
      icon: 'CheckOutline',
    },
    // {
    //   text: 'content__send_transactions_and_signature_request',
    //   icon: X,
    // },
  ] as const,
};

const isRug = (target: string) => {
  const RUG_LIST: string[] = [];
  return RUG_LIST.some((item) => item.includes(target.toLowerCase()));
};

type RouteProps = RouteProp<
  DappConnectionRoutesParams,
  DappConnectionModalRoutes.ConnectionModal
>;

/* Connection Modal are use to accept user with permission to dapp */
const defaultSourceInfo = Object.freeze({}) as IDappSourceInfo;
const Connection = () => {
  const [rugConfirmDialogVisible, setRugConfirmDialogVisible] = useState(false);
  const intl = useIntl();
  const { networkImpl, network, accountAddress, account } =
    useActiveWalletAccount();
  const { sourceInfo } = useDappParams();
  const { origin, scope, id } = sourceInfo ?? defaultSourceInfo;
  const computedIsRug = isRug(origin);
  const route = useRoute<RouteProps>();
  const walletConnectUri = route?.params?.walletConnectUri;
  const isWalletConnectPreloading = Boolean(walletConnectUri);
  const [walletConnectError, setWalletConnectError] = useState<string>('');

  useEffect(() => {
    if (walletConnectUri) {
      backgroundApiProxy.walletConnect
        .connect({
          uri: walletConnectUri || '',
        })
        .catch((error) => {
          debugLogger.walletConnect.error(error);
          setWalletConnectError(
            // timeout or qrcode expired
            intl.formatMessage({ id: 'msg__hardware_connect_timeout_error' }),
          );
        });
    }
  }, [intl, walletConnectUri]);

  // TODO move to DappService
  const getResolveData = useCallback(() => {
    // throw web3Errors.provider.unauthorized();
    // throw new Error('Testing: some error occur in approval.');
    if (!networkImpl || !accountAddress) {
      throw new Error(
        'Wallet or account not selected, you should create or import one.',
      );
    }
    const address = accountAddress;
    let accounts: string | string[] | { accounts: string[] } = [address].filter(
      Boolean,
    );
    // data format may be different in different chain
    if (scope === 'ethereum') {
      accounts = [address].filter(Boolean);
    }
    if (scope === 'near') {
      accounts = {
        accounts: [address].filter(Boolean),
      };
    }
    if (scope === 'solana') {
      accounts = address;
    }
    backgroundApiProxy.serviceDapp.saveConnectedAccounts({
      site: {
        origin,
      },
      networkImpl,
      address,
    });
    return accounts;
  }, [accountAddress, networkImpl, origin, scope]);

  const dappApprove = useDappApproveAction({
    id,
    closeOnError: true,
  });

  // TODO
  //  - check scope=ethereum and active chain is EVM
  //  - check active account exists
  //  - check network not exists

  return (
    <>
      {/* Rug warning Confirm Dialog */}
      <RugConfirmDialog
        visible={rugConfirmDialogVisible}
        onCancel={() => setRugConfirmDialogVisible(false)}
        onConfirm={() => setRugConfirmDialogVisible(false)}
      />
      {/* Main Modal */}
      <Modal
        header={
          isWalletConnectPreloading
            ? intl.formatMessage({ id: 'content__connecting' })
            : ''
        }
        headerDescription={isWalletConnectPreloading ? 'WalletConnect' : ''}
        hidePrimaryAction={isWalletConnectPreloading}
        primaryActionTranslationId="action__confirm"
        secondaryActionTranslationId="action__cancel"
        onPrimaryActionPress={async ({ close }) => {
          if (!computedIsRug) {
            const result = getResolveData();
            return dappApprove.resolve({ close, result });
          }
          // Do confirm before approve
          setRugConfirmDialogVisible(true);
        }}
        onSecondaryActionPress={({ close }) => {
          dappApprove.reject();
          close();
        }}
        // TODO onClose may trigger many times
        onModalClose={dappApprove.reject}
        scrollViewProps={{
          children: isWalletConnectPreloading ? (
            <Center flex={1} minH="300px">
              {walletConnectError ? (
                <Typography.DisplayXLarge my="16px">
                  {walletConnectError}
                </Typography.DisplayXLarge>
              ) : (
                <Spinner size="lg" />
              )}
            </Center>
          ) : (
            // Add padding to escape the footer
            <VStack flex="1" space={6}>
              <Center flex="1" mt="12px">
                <HStack alignItems="center">
                  <Box
                    size="44px"
                    borderWidth={2}
                    borderColor="surface-subdued"
                    mr="-8px"
                    zIndex={2}
                    rounded="full"
                  >
                    <Image
                      w="full"
                      h="full"
                      borderRadius="full"
                      zIndex={100}
                      source={Logo}
                    />
                  </Box>
                  <Box size="40px" overflow="hidden" rounded="full">
                    <Image
                      w="full"
                      h="full"
                      source={{ uri: `${origin}/favicon.ico` }}
                      fallbackElement={<Token size="40px" />}
                    />
                  </Box>
                </HStack>

                <Typography.DisplayXLarge mt="16px">
                  {intl.formatMessage({
                    id: 'title__connect_to_website',
                  })}
                </Typography.DisplayXLarge>
                <Typography.Body2 textAlign="right" color="text-subdued" mt={1}>
                  {origin?.split('://')[1] ?? 'DApp'}
                </Typography.Body2>
              </Center>
              <VStack space={6} mx="8px" mt="40px">
                <HStack
                  alignItems="center"
                  borderBottomWidth={StyleSheet.hairlineWidth}
                  borderColor="border-subdued"
                  pb={6}
                >
                  <Typography.Body1Strong color="text-subdued" flex={1}>
                    {intl.formatMessage({ id: 'form__account' })}
                  </Typography.Body1Strong>
                  <HStack alignItems="center">
                    <Image
                      src={network?.logoURI}
                      size="24px"
                      borderRadius="full"
                    />
                    <Typography.Body1 ml="12px">
                      {account?.name}
                    </Typography.Body1>
                  </HStack>
                </HStack>
                {MockData.permissions.map((permission, index) => (
                  <HStack key={index}>
                    <Icon
                      size={24}
                      name={permission.icon}
                      color="icon-success"
                    />
                    <Typography.Body1 ml="12px" alignSelf="center" flex={1}>
                      {intl.formatMessage({
                        id: permission.text,
                      })}
                    </Typography.Body1>
                  </HStack>
                ))}
              </VStack>
            </VStack>
          ),
        }}
      />
    </>
  );
};

export default Connection;

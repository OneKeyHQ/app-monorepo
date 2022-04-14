import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { RouteProp, useNavigation, useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Box,
  Center,
  Icon,
  Image,
  KeyboardDismissView,
  Modal,
  Typography,
} from '@onekeyhq/components';
import { ModalProps } from '@onekeyhq/components/src/Modal';
import { Text } from '@onekeyhq/components/src/Typography';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useActiveWalletAccount } from '../../hooks/redux';
import { useToast } from '../../hooks/useToast';

import { ManageTokenRoutes, ManageTokenRoutesParams } from './types';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type RouteProps = RouteProp<
  ManageTokenRoutesParams,
  ManageTokenRoutes.AddToken
>;

type NavigationProps = NativeStackNavigationProp<
  ManageTokenRoutesParams,
  ManageTokenRoutes.AddToken
>;

type ListItem = { label: string; value: string };

export type IViewTokenModalProps = ModalProps;
function ViewTokenModal(props: IViewTokenModalProps) {
  const [balance, setBalance] = useState<string | undefined>();
  const { account: activeAccount, network: activeNetwork } =
    useActiveWalletAccount();
  const intl = useIntl();
  const {
    params: { name, symbol, decimal, address, logoURI },
  } = useRoute<RouteProps>();
  const items: ListItem[] = useMemo(() => {
    const data = [
      {
        label: intl.formatMessage({
          id: 'form__name',
          defaultMessage: 'Name',
        }),
        value: name,
      },
      {
        label: intl.formatMessage({
          id: 'form__symbol',
          defaultMessage: 'Symbol',
        }),
        value: symbol,
      },
      {
        label: intl.formatMessage({
          id: 'form__contract',
          defaultMessage: 'Contact',
        }),
        value: address,
      },
      {
        label: intl.formatMessage({
          id: 'form__decimal',
          defaultMessage: 'Decimal',
        }),
        value: String(decimal),
      },
    ];
    if (balance) {
      data.push({
        label: intl.formatMessage({
          id: 'content__balance',
          defaultMessage: 'Balance',
        }),
        value: balance,
      });
    }
    return data;
  }, [name, symbol, address, decimal, balance, intl]);
  useEffect(() => {
    async function fetchBalance() {
      if (activeAccount && activeNetwork) {
        const res = await backgroundApiProxy.engine.preAddToken(
          activeAccount?.id,
          activeNetwork.id,
          address,
        );
        if (res?.[0]) {
          setBalance(res?.[0].toString());
        }
      }
    }
    fetchBalance();
  }, [activeAccount, activeNetwork, address]);
  return (
    <Modal
      header={symbol}
      height="560px"
      hideSecondaryAction
      hidePrimaryAction
      scrollViewProps={{
        children: (
          <KeyboardDismissView>
            <Box>
              <Box
                flexDirection="column"
                alignItems="center"
                justifyContent="center"
                mb="4"
              >
                <Image
                  src={logoURI}
                  alt="logoURI"
                  size="56px"
                  borderRadius="full"
                  fallbackElement={
                    <Center
                      w="56px"
                      h="56px"
                      rounded="full"
                      bgColor="surface-neutral-default"
                    >
                      <Icon size={32} name="QuestionMarkOutline" />
                    </Center>
                  }
                />
                <Typography.Heading mt="2">
                  {name}({symbol})
                </Typography.Heading>
              </Box>
              <Box bg="surface-default" borderRadius="12" mt="2" mb="3">
                {items.map((item, index) => (
                  <Box
                    display="flex"
                    flexDirection="row"
                    justifyContent="space-between"
                    p="4"
                    alignItems="center"
                    key={index}
                    borderTopRadius={index === 0 ? '12' : undefined}
                    borderBottomRadius={
                      index === items.length - 1 ? '12' : undefined
                    }
                    borderTopColor="divider"
                    borderTopWidth={index !== 0 ? '1' : undefined}
                  >
                    <Text
                      typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
                      color="text-subdued"
                    >
                      {item.label}
                    </Text>
                    <Text
                      typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
                      maxW="56"
                      textAlign="right"
                    >
                      {item.value}
                    </Text>
                  </Box>
                ))}
              </Box>
            </Box>
          </KeyboardDismissView>
        ),
      }}
      {...props}
    />
  );
}

function AddTokenModal() {
  const { info } = useToast();
  const { account: activeAccount, network: activeNetwork } =
    useActiveWalletAccount();
  const navigation = useNavigation<NavigationProps>();
  const intl = useIntl();
  const {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    params: { name, symbol, decimal, address, logoURI },
  } = useRoute<RouteProps>();

  const onPrimaryActionPress = useCallback(async () => {
    if (activeAccount && activeNetwork) {
      await backgroundApiProxy.engine.quickAddToken(
        activeAccount.id,
        activeNetwork.id,
        address,
      );
      info(
        intl.formatMessage({
          id: 'msg__token_added',
          defaultMessage: 'Token Added',
        }),
      );
      if (navigation.canGoBack()) {
        navigation.goBack();
      }
    }
  }, [intl, activeAccount, navigation, activeNetwork, info, address]);

  return (
    <ViewTokenModal
      header={intl.formatMessage({
        id: 'title__add_token',
        defaultMessage: 'Add Token',
      })}
      hidePrimaryAction={false}
      primaryActionTranslationId="action__confirm"
      primaryActionProps={{
        onPromise: onPrimaryActionPress,
      }}
    />
  );
}

export { ViewTokenModal, AddTokenModal };
export const AddToken = AddTokenModal;
export default AddToken;

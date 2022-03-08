import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';

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
import { Text } from '@onekeyhq/components/src/Typography';
import { Token } from '@onekeyhq/engine/src/types/token';

import engine from '../../engine/EngineProvider';
import { useGeneral } from '../../hooks/redux';
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

export const AddToken: FC = () => {
  const intl = useIntl();
  const { activeAccount, activeNetwork } = useGeneral();
  const { info } = useToast();
  const [balance, setBalance] = useState<string | undefined>();
  const [token, setToken] = useState<Token>();
  const {
    params: { name, symbol, decimal, address, logoURI },
  } = useRoute<RouteProps>();
  const navigation = useNavigation<NavigationProps>();
  useEffect(() => {
    async function fetchBalance() {
      if (activeAccount && activeNetwork) {
        const res = await engine.preAddToken(
          activeAccount?.id,
          activeNetwork.network.id,
          address,
        );
        if (res?.[0]) {
          setBalance(res?.[0].toString());
        }
        if (res?.[1]) {
          setToken(res?.[1]);
        }
      }
    }
    fetchBalance();
  }, [activeAccount, activeNetwork, address]);
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
  const onPrimaryActionPress = useCallback(async () => {
    if (activeAccount && activeNetwork) {
      if (token) {
        await engine.addTokenToAccount(activeAccount?.id, token.id);
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
    }
  }, [intl, activeAccount, navigation, activeNetwork, info, token]);
  return (
    <Modal
      header={intl.formatMessage({
        id: 'title__add_token',
        defaultMessage: 'Add Token',
      })}
      height="560px"
      primaryActionProps={{
        onPromise: onPrimaryActionPress,
        isDisabled: !token,
      }}
      primaryActionTranslationId={
        !token ? 'action__checking' : 'action__confirm'
      }
      hideSecondaryAction
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
    />
  );
};

export default AddToken;

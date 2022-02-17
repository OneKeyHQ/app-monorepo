import React, { FC, useCallback } from 'react';

import { RouteProp, useNavigation, useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Box,
  Divider,
  FlatList,
  KeyboardDismissView,
  Modal,
  Token,
  Typography,
} from '@onekeyhq/components';

import engine from '../../engine/EngineProvider';
import { useAppDispatch, useGeneral } from '../../hooks/redux';
import { useToast } from '../../hooks/useToast';
import { setRefreshTS } from '../../store/reducers/settings';

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
  const dispatch = useAppDispatch();
  const { activeAccount, activeNetwork } = useGeneral();
  const { info } = useToast();
  const {
    params: { name, symbol, decimal, address },
  } = useRoute<RouteProps>();
  const navigation = useNavigation<NavigationProps>();
  const items: ListItem[] = [
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
    {
      label: intl.formatMessage({
        id: 'content__balance',
        defaultMessage: 'Balance',
      }),
      value: '11',
    },
  ];
  const renderItem = ({ item }: { item: ListItem }) => (
    <Box
      display="flex"
      flexDirection="row"
      justifyContent="space-between"
      p="4"
      alignItems="center"
    >
      <Typography.Body1 color="text-subdued">{item.label}</Typography.Body1>
      <Typography.Body1 maxW="56" textAlign="right">
        {item.value}
      </Typography.Body1>
    </Box>
  );
  const onPrimaryActionPress = useCallback(async () => {
    if (activeAccount && activeNetwork) {
      const res = await engine.preAddToken(
        activeAccount?.id,
        activeNetwork.network.id,
        address,
      );
      if (res?.[1]) {
        await engine.addTokenToAccount(activeAccount?.id, res?.[1].id);
        dispatch(setRefreshTS());
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
  }, [intl, activeAccount, navigation, activeNetwork, info, address, dispatch]);
  return (
    <Modal
      header={intl.formatMessage({
        id: 'title__add_token',
        defaultMessage: 'Add Token',
      })}
      height="560px"
      onPrimaryActionPress={onPrimaryActionPress}
      primaryActionTranslationId="action__confirm"
      hideSecondaryAction
      scrollViewProps={{
        children: (
          <KeyboardDismissView>
            <Box>
              <Box
                flexDirection="column"
                alignItems="center"
                justifyContent="center"
                my="4"
              >
                <Token
                  chain="eth"
                  address="0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"
                />
                <Typography.Heading mt="2">
                  {name}({symbol})
                </Typography.Heading>
              </Box>
              <FlatList
                bg="surface-default"
                borderRadius="12"
                mt="3"
                mb="3"
                data={items}
                renderItem={renderItem}
                ItemSeparatorComponent={() => <Divider />}
                keyExtractor={(_, index: number) => index.toString()}
                showsVerticalScrollIndicator={false}
              />
            </Box>
          </KeyboardDismissView>
        ),
      }}
    />
  );
};

export default AddToken;

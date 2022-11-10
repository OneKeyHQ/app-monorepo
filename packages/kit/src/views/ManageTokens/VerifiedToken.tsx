import React, { memo, useCallback, useMemo } from 'react';

import { RouteProp, useRoute } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import {
  Box,
  Center,
  HStack,
  Icon,
  Image,
  Modal,
  Pressable,
  Spinner,
  Text,
  Token as TokenImage,
  Typography,
  VStack,
} from '@onekeyhq/components';
import { safeItems } from '@onekeyhq/engine/src/managers/goplus';
import { TokenSource } from '@onekeyhq/engine/src/managers/token';
import NoRisks from '@onekeyhq/kit/assets/NoRisks.png';

import { useNavigation } from '../../hooks';
import { ModalRoutes, RootRoutes } from '../../routes/types';

import { useTokenSourceList } from './hooks';
import { ManageTokenRoutes, ManageTokenRoutesParams } from './types';

type NavigationProps = RouteProp<
  ManageTokenRoutesParams,
  ManageTokenRoutes.VerifiedToken
>;

const VerifiedTokens: React.FC = () => {
  const intl = useIntl();
  const navigation = useNavigation();
  const route = useRoute<NavigationProps>();
  const { loading, data } = useTokenSourceList();
  const {
    token,
    token: { source },
  } = route.params;

  const goRiskDetail = useCallback(() => {
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.ManageToken,
      params: {
        screen: ManageTokenRoutes.TokenRiskDetail,
        params: {
          token,
        },
      },
    });
  }, [navigation, token]);

  const header = useMemo(
    () => (
      <Box flexDirection="column" alignItems="center" mb={4}>
        <Icon size={44} name="BadgeCheckSolid" color="icon-success" />
        <Text typography="DisplayXLarge" mt={3} mb="1">
          {intl.formatMessage({ id: 'title__verified_token' })}
        </Text>
        <Text mt={2}>
          {intl.formatMessage({ id: 'title__verified_token_desc' })}
        </Text>
        <Pressable w="full" onPress={goRiskDetail}>
          <HStack mt="9" mb="8" w="full" alignItems="center">
            <Image size="40px" source={NoRisks} />
            <VStack flex="1" ml="3">
              <Typography.Body1Strong mb="1">
                {intl.formatMessage({ id: 'form__no_risks' })}
              </Typography.Body1Strong>
              <Typography.Body2>
                {intl.formatMessage(
                  { id: 'form__no_risks_desc' },
                  {
                    0: safeItems.length,
                  },
                )}
              </Typography.Body2>
            </VStack>
            <Icon name="ChevronRightSolid" size={20} />
          </HStack>
        </Pressable>
        <Typography.Subheading w="full" mb="2">
          {intl.formatMessage({ id: 'form__token_lists__uppercase' })}
        </Typography.Subheading>
      </Box>
    ),
    [intl, goRiskDetail],
  );

  const renderItem = useCallback(
    (props: { item: TokenSource; index: number }) => {
      const { item } = props;
      const active = source?.includes(item.name);
      return (
        <Box flexDirection="row" alignItems="center" mb={4}>
          <TokenImage
            flex={1}
            showInfo
            token={{
              logoURI: item.logo,
              name: item.name,
            }}
            description={`${item.count} tokens`}
            size={8}
            nameProps={{
              maxW: 56,
              numberOfLines: 2,
              color: active ? 'text-default' : 'text-disabled',
            }}
            descProps={{
              maxW: '56',
              numberOfLines: 1,
              color: active ? 'text-subdued' : 'text-disabled',
            }}
          />
          {active && (
            <Icon size={16} name="BadgeCheckSolid" color="icon-success" />
          )}
        </Box>
      );
    },
    [source],
  );

  if (loading) {
    return (
      <Modal height="560px" hidePrimaryAction hideSecondaryAction footer={null}>
        <Center flex={1}>
          <Spinner size="lg" />
        </Center>
      </Modal>
    );
  }
  return (
    <Modal
      height="560px"
      hidePrimaryAction
      hideSecondaryAction
      footer={null}
      flatListProps={{
        data: data.sort((s) => (source?.includes(s.name) ? -1 : 1)),
        // @ts-ignore
        renderItem,
        keyExtractor: (item) => (item as TokenSource).name,
        showsVerticalScrollIndicator: false,
        ListHeaderComponent: header,
      }}
    />
  );
};
export default memo(VerifiedTokens);

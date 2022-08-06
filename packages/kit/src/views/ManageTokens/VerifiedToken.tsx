import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';

import { RouteProp, useRoute } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import {
  Box,
  Center,
  Divider,
  Icon,
  Modal,
  Spinner,
  Text,
  Token as TokenImage,
  Typography,
} from '@onekeyhq/components';
import {
  TokenSource,
  fetchTokenSource,
} from '@onekeyhq/engine/src/managers/token';

import { ManageTokenRoutes, ManageTokenRoutesParams } from './types';

type NavigationProps = RouteProp<
  ManageTokenRoutesParams,
  ManageTokenRoutes.VerifiedToken
>;

const VerifiedTokens: React.FC = () => {
  const intl = useIntl();
  const route = useRoute<NavigationProps>();
  const [sourceList, setSources] = useState<TokenSource[]>([]);
  const { source = [] } = route.params;

  useEffect(() => {
    fetchTokenSource().then((s) => setSources(s));
  }, [source]);

  const header = useMemo(
    () => (
      <Box flexDirection="column" alignItems="center" mb={3}>
        <Icon size={44} name="BadgeCheckSolid" color="icon-success" />
        <Text typography="DisplayXLarge" mt={3}>
          {intl.formatMessage({ id: 'title__verified_token' })}
        </Text>
        <Text mt={2}>
          {intl.formatMessage({ id: 'title__verified_token_desc' })}
        </Text>
      </Box>
    ),
    [intl],
  );

  const renderItem = useCallback(
    (props: { item: TokenSource; index: number }) => {
      const { item, index } = props;
      const active = source.includes(item.name);
      return (
        <Box
          flexDirection="row"
          alignItems="center"
          py={4}
          px={4}
          bgColor="surface-default"
          borderTopRadius={index === 0 ? 12 : 0}
          borderBottomRadius={index === sourceList.length - 1 ? 12 : 0}
        >
          <TokenImage src={item.logo} size={8} />
          <Box flex="1" ml={3}>
            <Text
              maxW={56}
              numberOfLines={2}
              typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
              color={active ? 'text-default' : 'text-disabled'}
            >
              {item.name}
            </Text>
            <Typography.Body2
              maxW="56"
              numberOfLines={1}
              color={active ? 'text-subdued' : 'text-disabled'}
            >
              {`${item.count} tokens`}
            </Typography.Body2>
          </Box>
          {active && (
            <Icon size={16} name="BadgeCheckSolid" color="icon-success" />
          )}
        </Box>
      );
    },
    [source, sourceList.length],
  );

  if (!sourceList.length) {
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
        data: sourceList.sort((s) => (source.includes(s.name) ? -1 : 1)),
        // @ts-ignore
        renderItem,
        ItemSeparatorComponent: Divider,
        keyExtractor: (item) => (item as TokenSource).name,
        showsVerticalScrollIndicator: false,
        ListHeaderComponent: header,
      }}
    />
  );
};
export default memo(VerifiedTokens);

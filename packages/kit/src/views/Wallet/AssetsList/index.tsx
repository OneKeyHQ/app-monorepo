/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import React, { useCallback, useEffect, useState } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Box,
  Divider,
  Icon,
  Pressable,
  ScrollableFlatListProps,
  Text,
  Token,
  Typography,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import { Tabs } from '@onekeyhq/components/src/CollapsibleTabView';
import type { Token as TokenType } from '@onekeyhq/engine/src/types/token';
import { FormatCurrency } from '@onekeyhq/kit/src/components/Format';
import {
  ManageTokenModalRoutes,
  ManageTokenRoutesParams,
} from '@onekeyhq/kit/src/routes/Modal/ManageToken';

import engine from '../../../engine/EngineProvider';
import { useActiveWalletAccount, useAppSelector } from '../../../hooks/redux';
import { TokenDetailNavigation } from '../../TokenDetail/routes';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<
  ManageTokenRoutesParams,
  ManageTokenModalRoutes.ListTokensModal
> &
  TokenDetailNavigation;

const AssetsList = () => {
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps>();
  const isSmallScreen = useIsVerticalLayout();
  const [tokens, setTokens] = useState<TokenType[]>([]);
  const [tokenBalance, setTokenBalance] = useState({});
  const activeNetwork = useAppSelector((s) => s.general.activeNetwork?.network);
  const { account } = useActiveWalletAccount();

  useEffect(() => {
    async function main() {
      if (!activeNetwork?.id || !account?.id) return;
      const tokensBE = await engine.getTokens(
        activeNetwork.id,
        account.id,
        true,
      );
      setTokens(tokensBE);

      const balance = await engine.getAccountBalance(
        account.id,
        activeNetwork.id,
        tokensBE.map((token) => token.id),
        true,
      );
      setTokenBalance(balance);
    }
    main();
  }, [activeNetwork, account?.id]);

  const renderItem: ScrollableFlatListProps<TokenType>['renderItem'] = ({
    item,
    index,
  }) => (
    <Pressable.Item
      p={4}
      borderTopRadius={index === 0 ? '12px' : '0px'}
      borderRadius={index === tokens?.length - 1 ? '12px' : '0px'}
      // onPress={() => {
      //   navigation.navigate(HomeRoutes.ScreenTokenDetail, {
      //     defaultValues: {
      //       accountId: '',
      //       networkId: '',
      //       tokenId: '',
      //     },
      //   });
      // }}
    >
      <Box w="100%" flexDirection="row" alignItems="center">
        <Token size={8} src={item.logoURI} />
        <Box ml={3} mr={3} flexDirection="column" flex={1}>
          <Text typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}>
            {(index === 0
              ? /** @ts-expect-error */
                tokenBalance?.main?.toFixed?.(2)
              : /** @ts-expect-error */
                tokenBalance?.[item.id]?.toFixed?.(2)) ?? '-'}
            &nbsp;&nbsp;
            {item.symbol}
          </Text>
          <FormatCurrency
            numbers={[0]}
            render={(ele) => (
              <Typography.Body2 color="text-subdued">{ele}</Typography.Body2>
            )}
          />
        </Box>
        {!isSmallScreen && (
          <Box ml={3} mr={20} flexDirection="row" flex={1}>
            <Icon size={20} name="ActivityOutline" />
            <FormatCurrency
              numbers={[0]}
              render={(ele) => (
                <Typography.Body2Strong ml={3}>{ele}</Typography.Body2Strong>
              )}
            />
          </Box>
        )}
        <Icon size={20} name="ChevronRightSolid" />
      </Box>
    </Pressable.Item>
  );

  const header = useCallback(
    () => (
      <Box
        flexDirection="row"
        justifyContent="space-between"
        alignItems="center"
        pb={3}
      >
        <Typography.Heading>
          {intl.formatMessage({ id: 'asset__tokens' })}
        </Typography.Heading>
        {/* <IconButton
          onPress={() =>
            navigation.navigate(ManageTokenModalRoutes.ListTokensModal)
          }
          size="sm"
          name="AdjustmentsSolid"
          type="plain"
          circle
        /> */}
      </Box>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [intl, navigation],
  );

  return (
    <Tabs.FlatList
      contentContainerStyle={{
        paddingHorizontal: 16,
        marginTop: 24,
      }}
      data={tokens}
      renderItem={renderItem}
      ListHeaderComponent={header}
      ItemSeparatorComponent={Divider}
      ListFooterComponent={() => <Box h="20px" />}
      keyExtractor={(_item: TokenType) => _item.id}
      extraData={isSmallScreen}
      showsVerticalScrollIndicator={false}
    />
  );
};

export default AssetsList;

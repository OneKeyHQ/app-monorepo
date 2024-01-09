import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import {
  Divider,
  Empty,
  Icon,
  ListItem,
  ListView,
  Stack,
} from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IAccountToken } from '@onekeyhq/shared/types/token';

import useAppNavigation from '../../hooks/useAppNavigation';
import { EModalRoutes } from '../../routes/Modal/type';
import { useTokenListAtom } from '../../states/jotai/contexts/token-list';
import { ETokenPages } from '../../views/Token/router/type';

import { TokenListHeader } from './TokenListHeader';
import { TokenListItem } from './TokenListItem';

type IProps = {
  tableLayout?: boolean;
  isLoading?: boolean;
  onRefresh?: () => void;
  onPress?: (token: IAccountToken) => void;
  onContentSizeChange?: ((w: number, h: number) => void) | undefined;
  withHeader?: boolean;
  withFooter?: boolean;
};

function TokenListEmpty() {
  const intl = useIntl();

  return (
    <Empty
      icon="CryptoCoinOutline"
      title={intl.formatMessage({ id: 'empty__no_tokens' })}
      description={intl.formatMessage({
        id: 'content__deposit_tokens_to_your_wallet',
      })}
    />
  );
}

const ItemSeparatorComponent = () => <Divider mx="$5" />;

function TokenListView(props: IProps) {
  const { onContentSizeChange, onPress, tableLayout, withHeader, withFooter } =
    props;
  const navigation = useAppNavigation();

  const [tokenList] = useTokenListAtom();
  const { tokens } = tokenList;

  const renderHeader = useCallback(
    () => <TokenListHeader tableLayout={tableLayout} />,
    [tableLayout],
  );

  const handleTokenPress = useCallback(() => {
    navigation.pushModal(EModalRoutes.TokenModal, {
      screen: ETokenPages.TokenDetails,
    });
  }, [navigation]);

  const handleLowValueTokensPress = useCallback(() => {
    navigation.pushModal(EModalRoutes.TokenModal, {
      screen: ETokenPages.TokenList,
      params: {
        title: 'Low-value Assets',
        helpText:
          'Assets valued below 0.1% of your total holdings and less than $1,000 fall into this category.',
      },
    });
  }, [navigation]);

  return (
    <ListView
      estimatedItemSize={60}
      scrollEnabled={platformEnv.isWebTouchable}
      data={tokens}
      ListHeaderComponent={withHeader ? renderHeader : null}
      onContentSizeChange={onContentSizeChange}
      ListEmptyComponent={TokenListEmpty}
      renderItem={({ item }) => (
        <TokenListItem
          token={item}
          key={item.$key}
          // onPress={onPress}
          onPress={handleTokenPress}
          tableLayout={tableLayout}
        />
      )}
      ListFooterComponent={
        withFooter ? (
          <>
            {tableLayout && <Divider mx="$5" />}
            <ListItem
              mb="$5"
              onPress={handleLowValueTokensPress}
              userSelect="none"
            >
              <Stack
                p={tableLayout ? '$1' : '$1.5'}
                borderRadius="$full"
                bg="$bgStrong"
              >
                <Icon
                  name="ControllerRoundSolid"
                  color="$iconSubdued"
                  size={tableLayout ? '$6' : '$7'}
                />
              </Stack>
              <ListItem.Text flex={1} primary="3 Low-value Assets" />
              <ListItem.Text primary="$36.28" />
            </ListItem>
          </>
        ) : null
      }
      {...(tableLayout && {
        ItemSeparatorComponent,
      })}
    />
  );
}

export { TokenListView };

import type { FC } from 'react';
import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import {
  Badge,
  Box,
  Button,
  Center,
  CheckBox,
  HStack,
  IconButton,
  List,
  ListItem,
  Spinner,
  Text,
  ToastManager,
  VStack,
} from '@onekeyhq/components';
import { shortenAddress } from '@onekeyhq/components/src/utils';
import { FormatBalance } from '@onekeyhq/kit/src/components/Format';
import BitcoinUsedAddressListItemMenu from '@onekeyhq/kit/src/views/Account/AddNewAccount/BitcoinUsedAddressListItemMenu';

import type { ListRenderItemInfo } from 'react-native';

const ListTableHeader: FC<any> = () => {
  const intl = useIntl();
  return (
    <ListItem>
      <ListItem.Column>
        <Box
          flexDirection="row"
          alignItems="flex-start"
          justifyContent="flex-start"
          // w="65px"
        >
          <CheckBox w={5} />
        </Box>
      </ListItem.Column>
      <ListItem.Column
        text={{
          label: intl.formatMessage({ id: 'form__address' }),
          labelProps: { typography: 'Subheading', color: 'text-subdued' },
        }}
        flex={1}
      />
      <ListItem.Column
        alignItems="flex-end"
        text={{
          label: intl.formatMessage({ id: 'content__amount' }),
          labelProps: {
            typography: 'Subheading',
            textAlign: 'right',
            color: 'text-subdued',
          },
        }}
        flex={1}
      />
      <ListItem.Column>
        <Box w="auto" />
      </ListItem.Column>
    </ListItem>
  );
};

const CoinControlCell: FC<any> = () => (
  <ListItem flex={1}>
    <ListItem.Column>
      <Box
        flexDirection="row"
        alignItems="flex-start"
        justifyContent="flex-start"
        // w="65px"
      >
        <CheckBox w={5} />
      </Box>
    </ListItem.Column>
    <ListItem.Column>
      <VStack>
        <HStack>
          <Text typography="Body2Strong">
            {shortenAddress('bc1qx3ha4es24us8ug8rpge8cdr72zsxmhgnxk6pg4')}
          </Text>
          {/* <Text mx={1}>•</Text> */}
        </HStack>
        <Text>Sep 28, 2023</Text>
        <Badge size="sm" title="recommended" type="default" />
      </VStack>
    </ListItem.Column>
    <ListItem.Column>
      <Box alignItems="flex-end" flex={1}>
        <FormatBalance
          balance="0.00000448"
          formatOptions={{
            fixed: 8,
          }}
          suffix="BTC"
          render={(ele) => (
            <Text
              typography={{ sm: 'Body2', md: 'Body2' }}
              style={{
                // @ts-ignore
                userSelect: 'none',
              }}
              wordBreak="break-all"
              textAlign="right"
            >
              {ele}
            </Text>
          )}
        />
      </Box>
    </ListItem.Column>
    <ListItem.Column>
      <BitcoinUsedAddressListItemMenu>
        <IconButton
          alignItems="flex-end"
          type="plain"
          name="EllipsisVerticalMini"
          color="icon-subdued"
          size="xs"
          hitSlop={12}
          circle
        />
      </BitcoinUsedAddressListItemMenu>
    </ListItem.Column>
  </ListItem>
);

const CoinControlList: FC<any> = () => {
  const intl = useIntl();

  const rowRenderer = useCallback(
    ({ item }: ListRenderItemInfo<any>) => (
      <CoinControlCell flex={1} item={item} />
    ),
    [],
  );

  return (
    <List
      data={[1, 2, 3, 4, 5]}
      ListHeaderComponent={() => <ListTableHeader />}
      renderItem={rowRenderer}
      keyExtractor={(item) => item.id}
    />
  );
};

export { CoinControlList };

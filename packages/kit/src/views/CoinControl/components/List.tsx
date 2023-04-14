import type { FC } from 'react';
import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Badge,
  Box,
  Button,
  Center,
  CheckBox,
  Divider,
  HStack,
  Icon,
  IconButton,
  List,
  ListItem,
  Spinner,
  Text,
  ToastManager,
  Tooltip,
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
        mr={-2}
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
        <Box w="10px" />
      </ListItem.Column>
    </ListItem>
  );
};

const CoinControlCell: FC<any> = () => (
  <ListItem flex={1} space={2}>
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
        <Text typography="Body2Strong">
          {shortenAddress('bc1qx3ha4es24us8ug8rpge8cdr72zsxmhgnxk6pg4')}
        </Text>
        <HStack alignItems="center">
          <Text>Sep 28, 2023</Text>
          <Text mx={1}>•</Text>
          <Badge
            size="sm"
            title="recommend"
            type="default"
            maxWidth="80px"
            labelProps={{
              numberOfLines: 1,
              maxWidth: '80px',
            }}
          />
        </HStack>
      </VStack>
    </ListItem.Column>
    <ListItem.Column>
      <Box alignItems="flex-end" flex={1} mr={-2} minW="113px">
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
          mr={-2}
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

  const Footer = useMemo(
    () => (
      <Box>
        <Divider w="auto" mx={2} />
        <HStack mt={4} mb={2} mx={2}>
          <Tooltip
            label={intl.formatMessage({
              id: 'content__royalty_fees_are_excluded',
            })}
            placement="top left"
          >
            <HStack alignItems="center" space={1} alignSelf="flex-start">
              <Text typography="Subheading" color="text-subdued">
                {intl.formatMessage({ id: 'form__dust__uppercase' })}
              </Text>
              <Icon
                name="QuestionMarkCircleMini"
                size={16}
                color="icon-subdued"
              />
            </HStack>
          </Tooltip>
        </HStack>
        {Array.from({ length: 10 }).map((_, index) => (
          <CoinControlCell flex={1} />
        ))}
        <Divider w="auto" mx={2} />
        <HStack
          mt={4}
          mb={2}
          mx={2}
          alignItems="center"
          justifyContent="space-between"
        >
          <Text typography="Subheading" color="text-subdued">
            6 ITEMS
          </Text>
          <FormatBalance
            balance="0.00000448"
            formatOptions={{
              fixed: 8,
            }}
            suffix="BTC"
            render={(ele) => (
              <Text
                typography="Subheading"
                color="text-subdued"
                textAlign="right"
              >
                {ele}
              </Text>
            )}
          />
        </HStack>
      </Box>
    ),
    [],
  );

  return (
    <List
      data={[1, 2, 3, 4, 5]}
      ListHeaderComponent={() => <ListTableHeader />}
      ListFooterComponent={() => Footer}
      renderItem={rowRenderer}
      keyExtractor={(item) => item.id}
    />
  );
};

export { CoinControlList };

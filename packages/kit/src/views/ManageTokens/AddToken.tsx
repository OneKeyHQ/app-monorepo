import React, { FC } from 'react';

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

type ListItem = { label: string; value: string };

export const AddToken: FC = () => {
  const intl = useIntl();
  const items: ListItem[] = [
    {
      label: intl.formatMessage({
        id: 'title__add_token',
        defaultMessage: 'Name',
      }),
      value: 'USD Coain',
    },
    {
      label: intl.formatMessage({
        id: 'form__symbol',
        defaultMessage: 'Symbol',
      }),
      value: 'USDC',
    },
    {
      label: intl.formatMessage({
        id: 'form__contract',
        defaultMessage: 'Contact',
      }),
      value: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    },
    {
      label: intl.formatMessage({
        id: 'form__decimal',
        defaultMessage: 'Decimal',
      }),
      value: '6',
    },
    {
      label: intl.formatMessage({
        id: 'content__balance',
        defaultMessage: 'Balance',
      }),
      value: '11USDC',
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
  return (
    <Modal
      header={intl.formatMessage({
        id: 'title__add_token',
        defaultMessage: 'Add Token',
      })}
      height="560px"
      secondaryActionTranslationId="action__confirm"
      secondaryActionProps={{ type: 'primary' }}
      hidePrimaryAction
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
                <Typography.Heading mt="2">USDC Coin(USDC)</Typography.Heading>
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

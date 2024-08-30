import { useCallback } from 'react';

import { StyleSheet } from 'react-native';

import {
  Badge,
  Button,
  Icon,
  ListView,
  Page,
  SizableText,
  Stack,
  XStack,
} from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';

type IPortfolioItemProps = {
  txid?: string;
};

const PortfolioItem = (props: IPortfolioItemProps) => {
  const onPress = useCallback(() => {}, []);
  return (
    <Stack px={20}>
      <Stack
        borderWidth={StyleSheet.hairlineWidth}
        borderColor="$borderSubdued"
        borderRadius="$3"
      >
        <XStack px={14} pt={14} justifyContent="space-between">
          <Badge>Pending activation</Badge>
          <Button
            onPress={onPress}
            size="small"
            variant="tertiary"
            iconAfter="OpenOutline"
          >
            8ad8...fa9b
          </Button>
        </XStack>
        <XStack p={14} alignItems="center">
          <Stack pr={12}>
            <Token />
          </Stack>
          <Stack>
            <SizableText size="$headingLg">0.01 BTC</SizableText>
            <SizableText size="$bodyMd">$665.45</SizableText>
          </Stack>
        </XStack>
        <XStack p={14} bg="$bgSubdued" alignItems="center">
          <Icon name="Calendar2Outline" />
          <SizableText size="$bodyMd">
            100 days • 07/30/2024 - 10/30/2024
          </SizableText>
        </XStack>
      </Stack>
    </Stack>
  );
};

const ItemSeparatorComponent = () => <Stack h="$4" />;

const PortfolioDetails = () => {
  const renderItem = useCallback(() => <PortfolioItem />, []);
  return (
    <Page>
      <Page.Header title="Portfolio Details" />
      <Page.Body>
        <ListView
          estimatedItemSize={60}
          data={[1, 2, 3, 4]}
          renderItem={renderItem}
          ListFooterComponent={<Stack h="$2" />}
          ItemSeparatorComponent={ItemSeparatorComponent}
        />
      </Page.Body>
    </Page>
  );
};

export default PortfolioDetails;

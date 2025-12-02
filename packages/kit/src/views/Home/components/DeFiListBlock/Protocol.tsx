import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Accordion,
  Badge,
  Divider,
  Icon,
  IconButton,
  NumberSizeableText,
  SizableText,
  View,
  XStack,
} from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import type { IDeFiPosition } from '@onekeyhq/shared/types/defi';

import { RichTable } from '../RichTable';

export const userData = [
  {
    id: '1',
    name: 'Alice Johnson',
    email: 'alice@example.com',
    age: 28,
    status: 'active',
  },
  {
    id: '2',
    name: 'Bob Smith',
    email: 'bob@example.com',
    age: 34,
    status: 'inactive',
  },
  {
    id: '3',
    name: 'Charlie Brown',
    email: 'charlie@example.com',
    age: 22,
    status: 'active',
  },
];

const columns = [
  {
    title: appLocale.intl.formatMessage({ id: ETranslations.global_asset }),
    dataIndex: 'asset',
  },
  {
    title: 'Type',
    dataIndex: 'type',
  },
  {
    title: 'Amount',
    dataIndex: 'amount',
  },
  {
    title: 'USD Value',
    dataIndex: 'usd-value',
  },
];

function Protocol() {
  const intl = useIntl();
  const [settings] = useSettingsPersistAtom();

  return (
    <Accordion
      collapsible
      overflow="hidden"
      width="100%"
      type="single"
      defaultValue="protocol"
      borderRadius="$3"
      borderCurve="continuous"
      $platform-web={{
        boxShadow:
          '0 0 0 1px rgba(0, 0, 0, 0.04), 0 0 2px 0 rgba(0, 0, 0, 0.08), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
      }}
      $platform-native={{
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '$borderSubdued',
      }}
      $theme-dark={{
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '$borderSubdued',
      }}
      $platform-ios={{
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 0.5 },
        shadowOpacity: 0.2,
        shadowRadius: 0.5,
      }}
    >
      <Accordion.Item value="protocol">
        <Accordion.Trigger
          flexDirection="row"
          justifyContent="space-between"
          alignItems="center"
          px="$5"
          py="$3"
          bg="$bgSubdued"
          borderWidth={0}
        >
          {({ open }: { open: boolean }) => (
            <>
              <XStack gap="$3" alignItems="center">
                <Token />
                <SizableText size="$headingLg">Uniswap V3</SizableText>
                <IconButton
                  title={intl.formatMessage({
                    id: ETranslations.global_view_in_blockchain_explorer,
                  })}
                  variant="tertiary"
                  icon="OpenOutline"
                  size="small"
                  onPress={() => {}}
                />
              </XStack>
              <XStack alignItems="center" gap="$3">
                <NumberSizeableText
                  size="$headingLg"
                  formatter="value"
                  formatterOptions={{ currency: settings.currencyInfo.symbol }}
                >
                  123
                </NumberSizeableText>
                <View
                  animation="quick"
                  rotate={open ? '180deg' : '0deg'}
                  transformOrigin="center"
                >
                  <Icon
                    name="ChevronDownSmallOutline"
                    color="$iconSubdued"
                    size="$6"
                  />
                </View>
              </XStack>
            </>
          )}
        </Accordion.Trigger>
        <Accordion.Content exitStyle={{ opacity: 0 }} py="$2">
          <XStack
            alignItems="center"
            justifyContent="space-between"
            pl="$1"
            pr="$3"
            py="$3"
          >
            <Badge badgeType="success" badgeSize="lg">
              <Badge.Text>Liquidity</Badge.Text>
            </Badge>
            <NumberSizeableText
              size="$headingSm"
              formatter="value"
              formatterOptions={{ currency: settings.currencyInfo.symbol }}
            >
              333
            </NumberSizeableText>
          </XStack>
          <RichTable
            dataSource={userData}
            columns={columns}
            keyExtractor={(item) => item.id}
            estimatedItemSize={48}
          />
        </Accordion.Content>
      </Accordion.Item>
    </Accordion>
  );
}

export { Protocol };

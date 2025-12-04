import { useCallback, useMemo } from 'react';

import BigNumber from 'bignumber.js';
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
  Stack,
  View,
  XStack,
} from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { useDeFiListProtocolMapAtom } from '@onekeyhq/kit/src/states/jotai/contexts/deFiList';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import defiUtils from '@onekeyhq/shared/src/utils/defiUtils';
import type {
  EDeFiAssetType,
  IDeFiAsset,
  IDeFiProtocol,
} from '@onekeyhq/shared/types/defi';

import { RichTable } from '../RichTable';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

function Protocol({ protocol }: { protocol: IDeFiProtocol }) {
  const intl = useIntl();
  const [settings] = useSettingsPersistAtom();
  const [{ protocolMap }] = useDeFiListProtocolMapAtom();
  const protocolInfo =
    protocolMap[
      defiUtils.buildProtocolMapKey({
        protocol: protocol.protocol,
        networkId: protocol.networkId,
      })
    ];

  const protocolTotalValue = useMemo(() => {
    return new BigNumber(protocolInfo?.totalValue ?? 0)
      .plus(protocolInfo?.totalDebt ?? 0)
      .toFixed();
  }, [protocolInfo?.totalValue, protocolInfo?.totalDebt]);

  const columns = useMemo(() => {
    return [
      {
        title: appLocale.intl.formatMessage({ id: ETranslations.global_asset }),
        dataIndex: 'symbol',
        render: (symbol: string, record: IDeFiAsset) => (
          <XStack gap="$3" alignItems="center">
            <Token size="lg" tokenImageUri={record.meta?.logoUrl} />
            <SizableText size="$bodyMdMedium">{symbol}</SizableText>
          </XStack>
        ),
      },
      {
        title: 'Type',
        dataIndex: 'category',
        render: (category: string) => (
          <SizableText
            size="$bodyMdMedium"
            color="$textInfo"
            textTransform="capitalize"
          >
            {category}
          </SizableText>
        ),
      },
      {
        title: 'Amount',
        dataIndex: 'amount',
        render: (amount: string) => (
          <NumberSizeableText size="$bodyMdMedium" formatter="balance">
            {amount}
          </NumberSizeableText>
        ),
      },
      {
        title: appLocale.intl.formatMessage({ id: ETranslations.global_value }),
        dataIndex: 'value',
        render: (value: string) => (
          <NumberSizeableText
            size="$bodyMdMedium"
            formatter="value"
            formatterOptions={{ currency: settings.currencyInfo.symbol }}
          >
            {value}
          </NumberSizeableText>
        ),
      },
    ];
  }, [settings.currencyInfo.symbol]);

  const renderProtocolPositions = useCallback(() => {
    return protocol.positions.map((position, index) => {
      if (index !== 0 && index !== protocol.positions.length - 1) {
        return <Divider key={index} />;
      }

      return (
        <Stack key={position.category}>
          <XStack
            alignItems="center"
            justifyContent="space-between"
            pl="$1"
            pr="$3"
            py="$3"
          >
            <Badge badgeType="success" badgeSize="lg">
              <Badge.Text textTransform="capitalize">
                {position.category}
              </Badge.Text>
            </Badge>
            <NumberSizeableText
              size="$headingSm"
              formatter="value"
              formatterOptions={{ currency: settings.currencyInfo.symbol }}
            >
              {position.value}
            </NumberSizeableText>
          </XStack>
          <RichTable<IDeFiAsset & { type: EDeFiAssetType }>
            dataSource={position.all}
            columns={columns}
            keyExtractor={(item) => item.address}
            estimatedItemSize={48}
          />
        </Stack>
      );
    });
  }, [protocol.positions, settings.currencyInfo.symbol, columns]);

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
                <Token
                  size="lg"
                  tokenImageUri={protocolInfo?.protocolLogo}
                  isNFT
                />
                <SizableText size="$headingLg">
                  {protocolInfo?.protocolName ?? protocol.protocol}
                </SizableText>
                <IconButton
                  title={intl.formatMessage({
                    id: ETranslations.global_view_in_blockchain_explorer,
                  })}
                  variant="tertiary"
                  icon="OpenOutline"
                  size="small"
                  onPress={() => openUrlExternal(protocolInfo?.protocolUrl)}
                />
              </XStack>
              <XStack alignItems="center" gap="$3">
                <NumberSizeableText
                  size="$headingLg"
                  formatter="value"
                  formatterOptions={{ currency: settings.currencyInfo.symbol }}
                >
                  {protocolTotalValue}
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
          {renderProtocolPositions()}
        </Accordion.Content>
      </Accordion.Item>
    </Accordion>
  );
}

export { Protocol };

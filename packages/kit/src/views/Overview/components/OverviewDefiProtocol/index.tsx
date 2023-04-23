import type { FC } from 'react';
import { useCallback, useMemo } from 'react';

import B from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Box,
  Collapse,
  Dialog,
  Image,
  Text,
  Typography,
  VStack,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import defiLogoShadow from '@onekeyhq/kit/assets/defiLogoShadow.png';

import { ErrorBoundary } from '../../../../components/ErrorBoundary';
import { FormatCurrencyNumber } from '../../../../components/Format';
import {
  useAccountValues,
  useActiveWalletAccount,
  useNavigation,
} from '../../../../hooks';
import { useCurrentFiatValue } from '../../../../hooks/useTokens';
import { openDapp } from '../../../../utils/openUrl';
import { showDialog } from '../../../../utils/overlayUtils';

import { OverviewDefiBoxHeader } from './Header';
import { OverviewDefiPool } from './OverviewDefiPool';

import type {
  IOverviewDeFiPortfolioItem,
  OverviewDeFiPoolType,
  OverviewDefiRes,
} from '../../types';

const OpenDappDialog: FC<{
  protocol: OverviewDefiRes;
  onClose?: () => void;
  onConfirm: () => void;
}> = ({ onConfirm, protocol, onClose }) => {
  const intl = useIntl();
  const { network } = useActiveWalletAccount();
  return (
    <Dialog
      visible
      onClose={onClose}
      contentProps={{
        icon: (
          <Box
            size="52px"
            borderRadius="12px"
            borderWidth="1px"
            borderColor="border-subdued"
            overflow="hidden"
            position="relative"
          >
            <Image
              size="full"
              src={protocol.protocolIcon}
              alt={protocol.protocolName}
            />
            <Image
              source={defiLogoShadow}
              w="35px"
              h="25px"
              position="absolute"
              bottom="0"
              right="0"
              zIndex="1"
            />
            <Image
              src={network?.logoURI ?? ''}
              w="12px"
              h="12px"
              position="absolute"
              bottom="2px"
              right="2px"
              zIndex="2"
            />
          </Box>
        ),
        title: protocol.protocolName,
        contentElement: (
          <VStack>
            <Typography.Body2 textAlign="center">
              {protocol.protocolUrl ?? ''}
            </Typography.Body2>
            <Typography.Body2 mt="6" textAlign="center">
              {intl.formatMessage({
                id: 'content__you_are_about_to_visit_this_site_in_a_dapp_browser_do_you_want_to_continue',
              })}
            </Typography.Body2>
          </VStack>
        ),
      }}
      footerButtonProps={{
        primaryActionTranslationId: 'action__visit',
        // eslint-disable-next-line @typescript-eslint/no-shadow
        onPrimaryActionPress: ({ onClose }) => {
          onClose?.();
          onConfirm?.();
        },
      }}
    />
  );
};

export const useOpenProtocolUrl = (protocol: OverviewDefiRes | undefined) => {
  const navigation = useNavigation();
  const isVertical = useIsVerticalLayout();

  const open = useCallback(() => {
    openDapp(protocol?.protocolUrl ?? '');
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  }, [protocol?.protocolUrl, navigation]);

  return useCallback(() => {
    if (!protocol?.protocolUrl) {
      return;
    }
    if (!isVertical) {
      return open();
    }
    showDialog(<OpenDappDialog protocol={protocol} onConfirm={open} />);
  }, [protocol, isVertical, open]);
};

const PoolName: FC<{
  poolType: OverviewDeFiPoolType;
  poolName: string;
}> = ({ poolType }) => {
  const isVertical = useIsVerticalLayout();
  return (
    <Text ml={isVertical ? 4 : 6} my="4">
      <Box px="6px" bg="surface-highlight-default" borderRadius="6px">
        <Typography.Body2Strong color="text-default" numberOfLines={1}>
          {poolType}
        </Typography.Body2Strong>
      </Box>
    </Text>
  );
};

export const OverviewDefiProtocol: FC<
  OverviewDefiRes & {
    showHeader?: boolean;
    bgColor?: string;
    poolCode?: string;
  }
> = (props) => {
  const {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    _id,
    pools,
    protocolValue,
    protocolName,
    protocolIcon,
    claimableValue,
    showHeader = true,
    bgColor,
    poolCode,
  } = props;
  const intl = useIntl();

  const isVertical = useIsVerticalLayout();
  const fiat = useCurrentFiatValue();

  const { networkId, accountId } = useActiveWalletAccount();

  const accountAllValues = useAccountValues({
    networkId,
    accountId,
  });

  const open = useOpenProtocolUrl(props);

  const rate = useMemo(
    () =>
      new B(protocolValue)
        .multipliedBy(fiat)
        .div(accountAllValues.value)
        .multipliedBy(100),
    [protocolValue, accountAllValues, fiat],
  );

  const content = useMemo(() => {
    if (poolCode) {
      const result: [OverviewDeFiPoolType, IOverviewDeFiPortfolioItem[]][] =
        pools
          .filter(
            ([, items]) =>
              items.filter((item) => item.poolCode === poolCode).length > 0,
          )
          .map(([poolType, items]) => {
            const filterItems = items.filter(
              (item) => item.poolCode === poolCode,
            );
            return [poolType, filterItems];
          });
      return result.map(([poolType, items], idx) => (
        <VStack
          key={poolType}
          borderTopWidth={idx === 0 ? 0 : '1px'}
          borderTopColor="divider"
        >
          <PoolName poolType={poolType} poolName={items?.[0]?.poolName} />
          <OverviewDefiPool
            networkId={_id.networkId}
            poolType={poolType}
            pools={items}
          />
        </VStack>
      ));
    }
    return (
      <Box bg={bgColor}>
        {pools.map(([poolType, items], idx) => (
          <VStack
            key={poolType}
            borderTopWidth={idx === 0 ? 0 : '1px'}
            borderTopColor="divider"
          >
            <PoolName poolType={poolType} poolName={items?.[0]?.poolName} />
            <OverviewDefiPool
              networkId={_id.networkId}
              poolType={poolType}
              pools={items}
            />
          </VStack>
        ))}
      </Box>
    );
  }, [bgColor, pools, _id, poolCode]);

  return (
    <ErrorBoundary>
      <Collapse
        borderRadius="12px"
        bg="surface-default"
        borderWidth="1px"
        borderColor="border-subdued"
        mb="6"
        value={false}
        overflow="hidden"
        renderCustomTrigger={(toggle, collapsed) =>
          showHeader ? (
            <OverviewDefiBoxHeader
              name={protocolName}
              onOpenDapp={open}
              rate={rate}
              desc={
                <Text
                  typography={{ md: 'Heading', sm: 'Body1Strong' }}
                  textAlign={isVertical ? 'left' : 'right'}
                >
                  <FormatCurrencyNumber
                    value={0}
                    convertValue={new B(protocolValue)}
                  />
                </Text>
              }
              extra={
                +claimableValue > 0 ? (
                  <Text
                    color="text-subdued"
                    typography={{ md: 'Body2Strong', sm: 'CaptionStrong' }}
                    textAlign={isVertical ? 'left' : 'right'}
                  >
                    {intl.formatMessage(
                      { id: 'form__claimable_str' },
                      {
                        0: (
                          <FormatCurrencyNumber
                            value={0}
                            convertValue={new B(claimableValue)}
                          />
                        ),
                      },
                    )}
                  </Text>
                ) : undefined
              }
              icon={protocolIcon}
              toggle={toggle}
              collapsed={collapsed}
            />
          ) : null
        }
      >
        {content}
      </Collapse>
    </ErrorBoundary>
  );
};

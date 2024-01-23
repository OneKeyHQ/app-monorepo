/* eslint-disable react/prop-types */
import type { FC } from 'react';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';
import stringify from 'fast-json-stable-stringify';
import { useIntl } from 'react-intl';

import {
  Box,
  HStack,
  Icon,
  IconButton,
  Pressable,
  Skeleton,
  Text,
  Tooltip,
  Typography,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import { DesktopDragZoneAbsoluteBar } from '@onekeyhq/components/src/DesktopDragZoneBox';
import { NetworkDarkIcon } from '@onekeyhq/components/src/Network/DarkIcon';
import { shortenAddress } from '@onekeyhq/components/src/utils';
import { isAllNetworks } from '@onekeyhq/engine/src/managers/network';
import { FormatCurrencyNumber } from '@onekeyhq/kit/src/components/Format';
import {
  useActiveWalletAccount,
  useAppSelector,
} from '@onekeyhq/kit/src/hooks';
import {
  ManageNetworkModalRoutes,
  ModalRoutes,
  RootRoutes,
} from '@onekeyhq/kit/src/routes/routesEnum';
import { isBTCNetwork } from '@onekeyhq/shared/src/engine/engineConsts';
import { isWatchingAccount } from '@onekeyhq/shared/src/engine/engineUtils';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useAccountIsUpdating, useOverviewPendingTasks } from '../../../hooks';
import { useAllNetworksWalletAccounts } from '../../../hooks/useAllNetwoks';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { useCopyAddress } from '../../../hooks/useCopyAddress';
import useOpenBlockBrowser from '../../../hooks/useOpenBlockBrowser';
import { getTimeDurationMs } from '../../../utils/helper';
import { calculateGains } from '../../../utils/priceUtils';
import { showAccountValueSettings } from '../../Overlay/AccountValueSettings';

import AccountOption from './AccountOption';

export const FIXED_VERTICAL_HEADER_HEIGHT = 238;
export const FIXED_HORIZONTAL_HEDER_HEIGHT = 152;

const SectionNetworkIconGroup: FC<{
  networkIds: string[];
}> = memo(({ networkIds }) => {
  const data = useMemo(() => {
    if (!networkIds?.length) {
      return [];
    }
    const ns = networkIds.slice(0, 4);
    if (networkIds.length > 4) {
      ns.push('more');
    }
    return ns;
  }, [networkIds]);

  return (
    <>
      {data.map((n, idx) => (
        <Box key={n} ml={idx === 0 ? 0 : -1}>
          <NetworkDarkIcon networkId={n} />
        </Box>
      ))}
    </>
  );
});

SectionNetworkIconGroup.displayName = 'SectionNetworkIconGroup';

const SectionNetworks: FC = memo(() => {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const { networkId, walletId, accountId } = useActiveWalletAccount();

  const networkAccountsMap = useAllNetworksWalletAccounts({
    accountId,
  });
  const enabledNetworks = useMemo(
    () => Object.keys(networkAccountsMap ?? {}),
    [networkAccountsMap],
  );

  useEffect(() => {
    if (isAllNetworks(networkId) && networkAccountsMap === null) {
      navigation.navigate(RootRoutes.Modal, {
        screen: ModalRoutes.ManageNetwork,
        params: {
          screen: ManageNetworkModalRoutes.AllNetworksAccountsDetail,
          params: {
            walletId,
            accountId,
          },
        },
      });
    }
  }, [networkId, networkAccountsMap, walletId, navigation, accountId]);

  const toAllNetworksAccountsDetail = useCallback(() => {
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.ManageNetwork,
      params: {
        screen: ManageNetworkModalRoutes.AllNetworksAccountsDetail,
        params: {
          walletId,
          accountId,
        },
      },
    });
  }, [walletId, accountId, navigation]);
  return (
    <Pressable
      flexDirection="row"
      alignItems="center"
      py="4px"
      px="8px"
      rounded="12px"
      _hover={{ bg: 'surface-hovered' }}
      _pressed={{ bg: 'surface-pressed' }}
      onPress={toAllNetworksAccountsDetail}
    >
      <Text typography="Body2Strong" mr={2} color="text-subdued">
        {intl.formatMessage(
          { id: 'form__str_networks' },
          {
            0: enabledNetworks.length,
          },
        )}
      </Text>
      <SectionNetworkIconGroup networkIds={enabledNetworks} />
      <Icon name="ChevronDownMini" size={20} color="icon-subdued" />
    </Pressable>
  );
});

SectionNetworks.displayName = 'SectionNetworks';

const SectionCopyAddress: FC = memo(() => {
  const intl = useIntl();
  const { account, networkId, network, wallet } = useActiveWalletAccount();
  const { copyAddress } = useCopyAddress({ wallet });

  const displayAddress = useMemo(
    () => !network?.settings.hiddenAddress,
    [network?.settings.hiddenAddress],
  );

  if (isAllNetworks(networkId)) {
    return <SectionNetworks />;
  }
  if (!displayAddress) {
    return null;
  }
  return (
    <Tooltip
      hasArrow
      placement="top"
      label={intl.formatMessage({ id: 'action__copy_address' })}
    >
      <Pressable
        flexDirection="row"
        alignItems="center"
        py="4px"
        px="8px"
        rounded="12px"
        _hover={{ bg: 'surface-hovered' }}
        _pressed={{ bg: 'surface-pressed' }}
        onPress={() => {
          copyAddress({
            address: account?.address,
            displayAddress: account?.displayAddress,
          });
        }}
      >
        <Text
          typography={{ sm: 'Body2', md: 'CaptionStrong' }}
          mr={2}
          color="text-subdued"
        >
          {shortenAddress(
            account?.displayAddress ?? account?.address ?? '',
            network?.settings.displayChars,
          )}
        </Text>
        <Icon name="Square2StackOutline" color="icon-subdued" size={16} />
      </Pressable>
    </Tooltip>
  );
});
SectionCopyAddress.displayName = 'SectionCopyAddress';

const SectionOpenBlockBrowser = memo(() => {
  const intl = useIntl();
  const { account, network } = useActiveWalletAccount();
  const { openAddressDetails, hasAvailable } = useOpenBlockBrowser(network);
  if (!hasAvailable) {
    return null;
  }
  return (
    <Tooltip
      hasArrow
      placement="top"
      label={intl.formatMessage({ id: 'form__blockchain_browser' })}
    >
      <Pressable
        p={1}
        rounded="full"
        _hover={{ bg: 'surface-hovered' }}
        _pressed={{ bg: 'surface-pressed' }}
        onPress={() => openAddressDetails(account?.address)}
      >
        <Icon name="GlobeAltOutline" color="icon-subdued" size={16} />
      </Pressable>
    </Tooltip>
  );
});
SectionOpenBlockBrowser.displayName = 'SectionOpenBlockBrowser';

type AccountUpdateTipsProps = {
  networkId: string;
  accountId: string;
};

const AccountUpdateTips: FC<AccountUpdateTipsProps> = ({
  networkId,
  accountId,
}) => {
  const intl = useIntl();
  const [ellipsis, setEllipsis] = useState('');

  const refreshing = useAccountIsUpdating({
    networkId,
    accountId,
  });

  const { tasks, updatedAt } = useOverviewPendingTasks({
    networkId,
    accountId,
  });

  useEffect(() => {
    if (!tasks.length) {
      return;
    }
    const timer = setInterval(() => {
      setEllipsis((t) => (t.length < 3 ? `${t}.` : ''));
    }, 800);

    return () => clearInterval(timer);
  }, [tasks?.length]);

  const onPressUpdate = useCallback(() => {
    if (tasks.length > 0) {
      return;
    }
    backgroundApiProxy.serviceOverview.refreshCurrentAccount({
      debounceEnabled: false,
    });
  }, [tasks]);

  const updateTips = useMemo(() => {
    if (tasks?.length || refreshing || !updatedAt) {
      return (
        intl.formatMessage({
          id: 'content__updating_assets',
        }) + ellipsis
      );
    }
    const duration = Date.now() - updatedAt;
    if (
      duration <
      getTimeDurationMs({
        minute: 2,
      })
    ) {
      return intl.formatMessage({
        id: 'form__updated_just_now',
      });
    }
    if (
      duration <
      getTimeDurationMs({
        hour: 1,
      })
    ) {
      return intl.formatMessage(
        {
          id: 'form__str_mins_ago',
        },
        {
          0: Math.floor(duration / 1000 / 60),
        },
      );
    }
    if (
      duration <
      getTimeDurationMs({
        hour: 24,
      })
    ) {
      return intl.formatMessage(
        {
          id: 'form__str_hours_ago',
        },
        {
          0: Math.floor(duration / 1000 / 60 / 60),
        },
      );
    }
    if (
      duration >
      getTimeDurationMs({
        hour: 24,
      })
    ) {
      return intl.formatMessage(
        {
          id: 'form__str_days_ago',
        },
        {
          0: Math.floor(duration / 1000 / 60 / 60 / 24),
        },
      );
    }
  }, [updatedAt, intl, tasks?.length, ellipsis, refreshing]);

  if (!updateTips) {
    return null;
  }

  return (
    <Pressable onPress={onPressUpdate}>
      <Typography.Body2 color="text-subdued">{updateTips}</Typography.Body2>
    </Pressable>
  );
};

const SummedValueComp = memo(
  ({ networkId, accountId }: { networkId: string; accountId: string }) => {
    const totalValue = useAppSelector(
      (s) =>
        s.overview.overviewStats?.[networkId]?.[accountId]?.summary?.totalValue,
    );

    const nftTotalValue = useAppSelector(
      (s) =>
        s.overview.overviewStats?.[networkId]?.[accountId]?.nfts?.totalValue,
    );

    const includeNFTsInTotal = useAppSelector(
      (s) => s.settings.includeNFTsInTotal,
    );

    const isWatching = isWatchingAccount({ accountId });

    const summaryTotalValue = useMemo(() => {
      if (!totalValue || includeNFTsInTotal) {
        return totalValue;
      }
      return new BigNumber(totalValue).minus(nftTotalValue ?? 0).toFixed();
    }, [includeNFTsInTotal, nftTotalValue, totalValue]);

    return (
      <Box flexDirection="row" alignItems="center" mt={1} w="full">
        {typeof totalValue === 'undefined' ? (
          <Skeleton shape="DisplayXLarge" />
        ) : (
          <HStack flex="1" alignItems="center">
            <Typography.Display2XLarge numberOfLines={2} isTruncated>
              <FormatCurrencyNumber
                decimals={2}
                value={0}
                convertValue={summaryTotalValue}
              />
            </Typography.Display2XLarge>
            {isWatching && isBTCNetwork(networkId) ? null : (
              <IconButton
                name="ChevronDownMini"
                onPress={showAccountValueSettings}
                type="plain"
                circle
                ml={1}
              />
            )}
          </HStack>
        )}
      </Box>
    );
  },
);
SummedValueComp.displayName = 'SummedValueComp';

type ChangedValueCompProps = AccountUpdateTipsProps;

const ChangedValueComp = memo(
  ({ networkId, accountId }: ChangedValueCompProps) => {
    const intl = useIntl();
    const [showPercentage, setShowPercentage] = useState(false);

    const totalValue = useAppSelector(
      (s) =>
        s.overview.overviewStats?.[networkId]?.[accountId]?.summary?.totalValue,
    );

    const totalValue24h = useAppSelector(
      (s) =>
        s.overview.overviewStats?.[networkId]?.[accountId]?.summary
          ?.totalValue24h,
    );

    const { gainNumber, percentageGain, gainTextColor } = calculateGains({
      basePrice: Number(totalValue24h ?? 0),
      price: Number(totalValue ?? 0),
    });

    return (
      <Box flexDirection="row" mt={1}>
        <HStack alignItems="center">
          <Pressable
            onPress={() => {
              setShowPercentage(!showPercentage);
            }}
          >
            <Typography.Body2Strong color={gainTextColor} mr="4px">
              {showPercentage ? (
                percentageGain
              ) : (
                <>
                  {gainNumber >= 0 ? '+' : '-'}
                  <FormatCurrencyNumber
                    value={Math.abs(gainNumber)}
                    decimals={2}
                  />
                </>
              )}
            </Typography.Body2Strong>
          </Pressable>
          <Typography.Body2Strong color="text-subdued" ml="1">
            {intl.formatMessage({ id: 'content__today' })}
          </Typography.Body2Strong>
          <>
            <Box size="1" bg="icon-subdued" borderRadius="999px" mx="2" />
            <AccountUpdateTips networkId={networkId} accountId={accountId} />
          </>
        </HStack>
      </Box>
    );
  },
  (prev: ChangedValueCompProps, next: ChangedValueCompProps) =>
    stringify(prev) === stringify(next),
);
ChangedValueComp.displayName = 'ChangedValueComp';

const AccountAmountInfo: FC = () => {
  const { networkId, accountId } = useActiveWalletAccount();

  return (
    <Box alignItems="flex-start" flex="1">
      <Box mx="-8px" my="-4px" flexDir="row" alignItems="center">
        <SectionCopyAddress />
        <SectionOpenBlockBrowser />
      </Box>
      <SummedValueComp networkId={networkId} accountId={accountId} />
      <ChangedValueComp networkId={networkId} accountId={accountId} />
    </Box>
  );
};
const AccountInfo = () => {
  const isSmallView = useIsVerticalLayout();
  if (isSmallView) {
    return (
      <Box
        pt="16px"
        pb="24px"
        w="100%"
        px="16px"
        flexDirection="column"
        bgColor="background-default"
        h={FIXED_VERTICAL_HEADER_HEIGHT}
      >
        <AccountAmountInfo />
        <Box mt={8}>
          <AccountOption isSmallView={isSmallView} />
        </Box>
      </Box>
    );
  }
  return (
    <>
      <DesktopDragZoneAbsoluteBar />
      <Box
        h={FIXED_HORIZONTAL_HEDER_HEIGHT}
        py={8}
        px={{ sm: 8, lg: 4 }}
        flexDirection="row"
        justifyContent="space-between"
        alignItems="center"
        bgColor="background-default"
      >
        <AccountAmountInfo />
        <AccountOption isSmallView={isSmallView} />
      </Box>
    </>
  );
};

export default memo(AccountInfo);

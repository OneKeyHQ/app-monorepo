import type { FC } from 'react';
import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  IconButton,
  ToastManager,
  Typography,
} from '@onekeyhq/components';
import { copyToClipboard } from '@onekeyhq/components/src/utils/ClipboardUtils';
import { isAccountCompatibleWithNetwork } from '@onekeyhq/engine/src/managers/account';
import type { Token } from '@onekeyhq/engine/src/types/token';
import type {
  IBaseMenuOptions,
  IMenu,
} from '@onekeyhq/kit/src/views/Overlay/BaseMenu';
import BaseMenu from '@onekeyhq/kit/src/views/Overlay/BaseMenu';

import { FormatCurrency } from '../../../../components/Format';
import {
  useNavigation,
  useNetworkSimple,
  useTokenBalance,
} from '../../../../hooks';
import useOpenBlockBrowser from '../../../../hooks/useOpenBlockBrowser';
import { ModalRoutes, RootRoutes } from '../../../../routes/routesEnum';
import {
  ScanQrcodeRoutes,
  ScanSubResultCategory,
} from '../../../ScanQrcode/types';
import { useTokenPrice } from '../../hooks/useSwapTokenUtils';
import { formatAmount, lte } from '../../utils';

const TokenItemMenu: FC<
  IMenu & {
    token?: Token;
  }
> = ({ token, ...props }) => {
  const intl = useIntl();
  const navigation = useNavigation();
  const network = useNetworkSimple(token?.networkId);
  const { openAddressDetails } = useOpenBlockBrowser(network);
  const onCopy = useCallback(() => {
    copyToClipboard(token?.address ?? '');
    ToastManager.show({ title: intl.formatMessage({ id: 'msg__copied' }) });
  }, [intl, token?.address]);
  const onShowFullAddress = useCallback(() => {
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.ScanQrcode,
      params: {
        screen: ScanQrcodeRoutes.ScanQrcodeResult,
        params: {
          type: ScanSubResultCategory.TEXT,
          data: token?.address ?? '',
          hideMoreMenu: true,
        },
      },
    });
  }, [navigation, token?.address]);
  const onViewDetail = useCallback(() => {
    openAddressDetails(token?.tokenIdOnNetwork ?? '');
  }, [openAddressDetails, token]);

  const options = useMemo<IBaseMenuOptions>(() => {
    const menus: IBaseMenuOptions = [
      {
        id: 'action__copy_address',
        onPress: onCopy,
        icon: 'Square2StackOutline',
      },
      {
        id: 'action__show_full_address',
        onPress: onShowFullAddress,
        icon: 'MagnifyingGlassPlusOutline',
      },
    ];

    if (!network?.settings.hiddenBlockBrowserTokenDetailLink) {
      menus.push({
        id: 'action__view_in_browser',
        onPress: onViewDetail,
        icon: 'ArrowTopRightOnSquareOutline',
      });
    }

    return menus;
  }, [
    network?.settings.hiddenBlockBrowserTokenDetailLink,
    onCopy,
    onShowFullAddress,
    onViewDetail,
  ]);

  return <BaseMenu options={options} {...props} />;
};

type TokenBalanceAndValueProps = {
  accountId?: string;
  token?: Token;
};

const TokenBalanceAndValue: FC<TokenBalanceAndValueProps> = ({
  accountId,
  token,
}) => {
  const balance = useTokenBalance({
    networkId: token?.networkId ?? '',
    accountId: accountId ?? '',
    token,
  });

  const price = useTokenPrice(token);
  const amount = formatAmount(balance, 6);

  if (lte(amount, 0)) {
    return null;
  }
  return (
    <Box alignItems="flex-end">
      <Typography.Heading fontSize={16} lineHeight={24}>
        {amount}
      </Typography.Heading>
      <Typography.Caption color="text-subdued" numberOfLines={2}>
        <FormatCurrency
          numbers={[price ?? 0, balance ?? 0]}
          render={(ele) => (
            <Typography.Caption ml={3} color="text-subdued">
              {price ? ele : '-'}
            </Typography.Caption>
          )}
        />
      </Typography.Caption>
    </Box>
  );
};

type TokenMoreMenuProps = {
  token?: Token;
  isSearchMode?: boolean;
  accountId?: string;
};

export const TokenMoreMenu: FC<TokenMoreMenuProps> = ({ accountId, token }) => {
  const isCompatible = isAccountCompatibleWithNetwork(
    accountId ?? '',
    token?.networkId ?? '',
  );

  return (
    <Box flexDirection="row">
      {isCompatible ? (
        <TokenBalanceAndValue accountId={accountId} token={token} />
      ) : null}
      <TokenItemMenu token={token}>
        <IconButton
          w="10"
          h="10"
          name="EllipsisVerticalMini"
          type="plain"
          ml="1"
          circle
          hitSlop={8}
          isDisabled={!token?.tokenIdOnNetwork}
        />
      </TokenItemMenu>
    </Box>
  );
};

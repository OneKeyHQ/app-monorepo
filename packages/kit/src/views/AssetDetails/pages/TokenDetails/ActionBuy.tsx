import { useCallback, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  ActionList,
  Button,
  Icon,
  SizableText,
  Stack,
  Toast,
  useTabIsRefreshingFocused,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useUserWalletProfile } from '@onekeyhq/kit/src/hooks/useUserWalletProfile';
import { ActionItem } from '@onekeyhq/kit/src/views/Home/components/WalletActions/RawActions';
import { WALLET_TYPE_WATCHING } from '@onekeyhq/shared/src/consts/dbConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  openFiatCryptoUrl,
  openUrlExternal,
} from '@onekeyhq/shared/src/utils/openUrlUtils';
import type { IFiatCryptoType } from '@onekeyhq/shared/types/fiatCrypto';

import type { IActionProps } from './type';

function ActionBuy({
  networkId,
  tokenAddress,
  tokenSymbol,
  accountId,
  walletId,
  walletType,
  disabled,
  source,
  isTabView,
  ...rest
}: IActionProps) {
  const intl = useIntl();
  const [loading, setLoading] = useState(false);
  const loadingRef = useRef(false);
  const { isFocused } = useTabIsRefreshingFocused();
  const focusParam = isTabView ? isFocused : true;

  const { result: supportState } = usePromiseResult(
    async () => {
      const [buy, sell] = await Promise.all([
        backgroundApiProxy.serviceFiatCrypto.isTokenSupported({
          networkId,
          tokenAddress,
          type: 'buy',
        }),
        backgroundApiProxy.serviceFiatCrypto.isTokenSupported({
          networkId,
          tokenAddress,
          type: 'sell',
        }),
      ]);
      return { buy, sell, resolved: true };
    },
    [networkId, tokenAddress],
    {
      initResult: { buy: false, sell: false, resolved: false },
      debounced: 100,
      overrideIsFocused: (isPageFocused) => isPageFocused && focusParam,
    },
  );

  const isBuySupported = supportState.buy;
  const isSellSupported = supportState.sell;
  const isResolved = supportState.resolved;
  const bothSupported = isBuySupported && isSellSupported;
  const neitherSupported = isResolved && !isBuySupported && !isSellSupported;

  const isDisabled = useMemo(() => {
    if (!isResolved) {
      return true;
    }
    if (walletType === WALLET_TYPE_WATCHING && !platformEnv.isDev) {
      return true;
    }
    if (neitherSupported) {
      return true;
    }
    return false;
  }, [isResolved, walletType, neitherSupported]);

  const effectiveDisabled = disabled || isDisabled;

  const { isSoftwareWalletOnlyUser } = useUserWalletProfile();

  const openFiatUrl = useCallback(
    async (type: IFiatCryptoType) => {
      if (loadingRef.current) return;

      if (
        await backgroundApiProxy.serviceAccount.checkIsWalletNotBackedUp({
          walletId,
        })
      ) {
        return;
      }

      loadingRef.current = true;
      setLoading(true);

      if (type === 'buy') {
        defaultLogger.wallet.walletActions.buyStarted({
          tokenAddress,
          tokenSymbol,
          networkID: networkId,
        });
        defaultLogger.wallet.walletActions.actionBuy({
          walletType: walletType ?? '',
          networkId: networkId ?? '',
          source,
          isSoftwareWalletOnlyUser,
        });
      } else if (type === 'sell') {
        defaultLogger.wallet.walletActions.actionSell({
          walletType: walletType ?? '',
          networkId: networkId ?? '',
          source,
          isSoftwareWalletOnlyUser,
        });
      }

      try {
        const { url } =
          await backgroundApiProxy.serviceFiatCrypto.generateWidgetUrl({
            networkId,
            tokenAddress,
            accountId,
            type,
          });
        if (!url) {
          Toast.error({ title: 'Failed to get widget url' });
          return;
        }
        if (platformEnv.isDesktop || platformEnv.isNative) {
          openFiatCryptoUrl(url);
        } else {
          openUrlExternal(url);
        }
      } finally {
        loadingRef.current = false;
        setLoading(false);
      }
    },
    [
      walletId,
      tokenAddress,
      tokenSymbol,
      networkId,
      walletType,
      source,
      isSoftwareWalletOnlyUser,
      accountId,
    ],
  );

  const handleDirectPress = useCallback(async () => {
    if (effectiveDisabled) return;
    if (isBuySupported) {
      await openFiatUrl('buy');
    } else if (isSellSupported) {
      await openFiatUrl('sell');
    }
  }, [effectiveDisabled, isBuySupported, isSellSupported, openFiatUrl]);

  // Always show "出入金" — the label only changes to single-mode after the
  // support check confirms exactly one direction is available.
  /* eslint-disable no-nested-ternary */
  const label =
    bothSupported || (!isBuySupported && !isSellSupported)
      ? intl.formatMessage({ id: ETranslations.buy_and_sell })
      : isBuySupported
        ? intl.formatMessage({ id: ETranslations.global_buy })
        : intl.formatMessage({ id: ETranslations.global_cash_out });
  /* eslint-enable no-nested-ternary */

  const iconName = 'CurrencyDollarOutline' as const;

  // Single-action or loading: buy-only or sell-only → direct URL, use ActionItem
  if (!bothSupported || rest.showButtonStyle) {
    return (
      <ActionItem
        loading={loading}
        label={label}
        icon={iconName}
        disabled={effectiveDisabled}
        onPress={handleDirectPress}
        {...rest}
      />
    );
  }

  // Both supported: dropdown with Buy / Cash Out options
  // Follow ActionMore pattern: mobile → ActionList.show(), desktop → declarative <ActionList>
  const sections = [
    {
      items: [
        {
          label: intl.formatMessage({ id: ETranslations.global_buy }),
          icon: 'PlusLargeOutline' as const,
          onPress: () => openFiatUrl('buy'),
        },
        {
          label: intl.formatMessage({ id: ETranslations.global_cash_out }),
          icon: 'MinusLargeOutline' as const,
          onPress: () => openFiatUrl('sell'),
        },
      ],
    },
  ];

  const handleMobilePress = () => {
    if (effectiveDisabled) return;
    ActionList.show({
      title: label,
      sections,
    });
  };

  // showButtonStyle: compact button with ActionList popover
  if (rest.showButtonStyle) {
    return (
      <ActionList
        title={label}
        disabled={effectiveDisabled}
        sections={sections}
        renderTrigger={
          <Button
            icon={iconName}
            loading={loading}
            disabled={effectiveDisabled}
            {...rest}
          >
            {label}
          </Button>
        }
      />
    );
  }

  return (
    <>
      {/* Mobile: Card style */}
      <Stack
        flex={1}
        flexBasis={0}
        alignItems="center"
        justifyContent="center"
        bg="$bgStrong"
        borderRadius="$4"
        pt="$2.5"
        pb="$1"
        px="$1"
        userSelect="none"
        hoverStyle={{ bg: '$bgStrongHover' }}
        pressStyle={{ bg: '$bgStrongActive' }}
        focusable
        focusVisibleStyle={{
          outlineColor: '$focusRing',
          outlineStyle: 'solid',
          outlineWidth: 2,
        }}
        $gtSm={{ display: 'none' }}
        {...(effectiveDisabled && { opacity: 0.4 })}
        onPress={handleMobilePress}
      >
        <Stack>
          <Icon
            name={iconName}
            size="$6"
            color={effectiveDisabled ? '$iconDisabled' : '$icon'}
          />
        </Stack>
        <SizableText
          my="$1"
          textAlign="center"
          size="$bodySm"
          color={effectiveDisabled ? '$textDisabled' : '$text'}
        >
          {label}
        </SizableText>
      </Stack>

      {/* Desktop: Button with ActionList popover */}
      <Stack display="none" $gtSm={{ display: 'flex' }}>
        <ActionList
          title={label}
          disabled={effectiveDisabled}
          sections={sections}
          renderTrigger={
            <Button
              variant="secondary"
              size="large"
              icon={iconName}
              loading={loading}
              disabled={effectiveDisabled}
            >
              {label}
            </Button>
          }
        />
      </Stack>
    </>
  );
}

export default ActionBuy;

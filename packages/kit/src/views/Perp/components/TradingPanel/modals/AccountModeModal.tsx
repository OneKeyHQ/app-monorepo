import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import type { useInPageDialog } from '@onekeyhq/components';
import {
  Badge,
  Button,
  Dialog,
  Image,
  SizableText,
  Toast,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import { EHyperLiquidAbstractionMode } from '@onekeyhq/shared/types/hyperliquid';

import { PerpsProviderMirror } from '../../../PerpsProviderMirror';
import {
  PERP_DIALOG_BUTTON_SIZE,
  PERP_MOBILE_DIALOG_CONTENT_CONTAINER_PROPS,
} from '../../PerpDialogLayout';
import { TradingGuardWrapper } from '../../TradingGuardWrapper';

export type IPerpsAccountModeOption =
  | EHyperLiquidAbstractionMode.UNIFIED_ACCOUNT
  | EHyperLiquidAbstractionMode.PORTFOLIO_MARGIN;

const ACCOUNT_MODE_OPTIONS: {
  desc: ETranslations;
  label: ETranslations;
  learnMore?: boolean;
  modeIcon: 'single' | 'portfolio';
  recommended?: boolean;
  value: IPerpsAccountModeOption;
}[] = [
  {
    desc: ETranslations.perp_unified_account__desc,
    label: ETranslations.perp_unified_account__title,
    modeIcon: 'single',
    recommended: true,
    value: EHyperLiquidAbstractionMode.UNIFIED_ACCOUNT,
  },
  {
    desc: ETranslations.perp_portfolio_margin__desc,
    label: ETranslations.perp_portfolio_margin__title,
    learnMore: true,
    modeIcon: 'portfolio',
    value: EHyperLiquidAbstractionMode.PORTFOLIO_MARGIN,
  },
];

const PORTFOLIO_MARGIN_LEARN_MORE_URL =
  'https://hyperliquid.gitbook.io/hyperliquid-docs/support/faq/portfolio-margin#margin-sharing';

const TOKEN_LOGO_URIS = {
  BTC: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/bitcoin/info/logo.png',
  BNB: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/smartchain/info/logo.png',
  ETH: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png',
  USDC: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png',
} as const;

function TokenLogo({
  token,
  size = 28,
}: {
  token: keyof typeof TOKEN_LOGO_URIS;
  size?: number;
}) {
  return (
    <Image
      source={{ uri: TOKEN_LOGO_URIS[token] }}
      width={size}
      height={size}
      borderWidth="$px"
      borderColor="rgba(255,255,255,0.32)"
      borderRadius="$full"
      bg="$bg"
    />
  );
}

export function AccountModeTokenBadge({
  mode,
  size = 72,
}: {
  mode: 'single' | 'portfolio';
  size?: number;
}) {
  if (mode === 'single') {
    return (
      <XStack
        w={size}
        h={size}
        borderRadius="$3"
        bg="$bgActive"
        alignItems="center"
        justifyContent="center"
      >
        <TokenLogo token="USDC" size={Math.round(size * 0.44)} />
      </XStack>
    );
  }

  const tokenSize = Math.round(size * 0.26);
  return (
    <YStack
      w={size}
      h={size}
      borderRadius="$3"
      bg="$bgActive"
      alignItems="center"
      justifyContent="center"
      gap="$1.5"
    >
      <XStack gap="$1.5">
        <TokenLogo token="BTC" size={tokenSize} />
        <TokenLogo token="ETH" size={tokenSize} />
      </XStack>
      <XStack gap="$1.5">
        <TokenLogo token="USDC" size={tokenSize} />
        <TokenLogo token="BNB" size={tokenSize} />
      </XStack>
    </YStack>
  );
}

function AccountModeOption({
  desc,
  isSelected,
  label,
  learnMore,
  modeIcon,
  onPress,
  recommended,
}: {
  desc: ETranslations;
  isSelected: boolean;
  label: ETranslations;
  learnMore?: boolean;
  modeIcon: 'single' | 'portfolio';
  onPress: () => void;
  recommended?: boolean;
}) {
  const intl = useIntl();
  const handleLearnMorePress = useCallback(() => {
    openUrlExternal(PORTFOLIO_MARGIN_LEARN_MORE_URL);
  }, []);

  return (
    <YStack
      p="$4"
      borderRadius="$3"
      borderWidth="$px"
      borderColor={isSelected ? '$borderActive' : '$borderSubdued'}
      onPress={onPress}
      cursor="default"
      hoverStyle={{
        borderColor: isSelected ? '$borderActive' : '$borderStrong',
      }}
      pressStyle={{ borderColor: '$borderActive' }}
    >
      <XStack alignItems="center" gap="$4">
        <AccountModeTokenBadge mode={modeIcon} />
        <YStack flex={1} minWidth={0} gap="$1">
          <XStack alignItems="center" gap="$2" flexWrap="wrap">
            <SizableText size="$headingMd" fontWeight="600">
              {intl.formatMessage({ id: label })}
            </SizableText>
            {recommended ? (
              <Badge badgeSize="sm" badgeType="success">
                <Badge.Text>
                  {intl.formatMessage({
                    id: ETranslations.perp_account_mode_recommended__title,
                  })}
                </Badge.Text>
              </Badge>
            ) : null}
          </XStack>
          <SizableText size="$bodySm" color="$textSubdued">
            {intl.formatMessage({ id: desc })}
            {learnMore ? (
              <>
                {' '}
                <SizableText
                  size="$bodySm"
                  color="$textSubdued"
                  textDecorationLine="underline"
                  onPress={handleLearnMorePress}
                >
                  {intl.formatMessage({ id: ETranslations.global_learn_more })}
                </SizableText>
              </>
            ) : null}
          </SizableText>
        </YStack>
      </XStack>
    </YStack>
  );
}

function AccountModeContent({
  initialMode,
  onClose,
  onSelect,
}: {
  initialMode: IPerpsAccountModeOption;
  onClose?: () => void;
  onSelect?: (mode: IPerpsAccountModeOption) => void;
}) {
  const intl = useIntl();
  const [selectedMode, setSelectedMode] =
    useState<IPerpsAccountModeOption>(initialMode);

  const handleConfirm = useCallback(() => {
    onSelect?.(selectedMode);
    void onClose?.();
    Toast.success({
      title: intl.formatMessage({
        id: ETranslations.perp_account_mode_ui_updated__msg,
      }),
      message: intl.formatMessage({
        id: ETranslations.perp_account_mode_logic_pending__msg,
      }),
    });
  }, [intl, onClose, onSelect, selectedMode]);

  return (
    <YStack gap="$4">
      {ACCOUNT_MODE_OPTIONS.map((option) => (
        <AccountModeOption
          key={option.value}
          desc={option.desc}
          isSelected={selectedMode === option.value}
          label={option.label}
          learnMore={option.learnMore}
          modeIcon={option.modeIcon}
          onPress={() => setSelectedMode(option.value)}
          recommended={option.recommended}
        />
      ))}
      {selectedMode === EHyperLiquidAbstractionMode.PORTFOLIO_MARGIN ? (
        <XStack
          p="$3"
          borderRadius="$3"
          bg="$bgStrong"
          gap="$2"
          alignItems="flex-start"
        >
          <XStack
            w={14}
            h={14}
            borderRadius="$full"
            bg="$iconDisabled"
            alignItems="center"
            justifyContent="center"
            mt="$0.5"
          >
            <SizableText size="$bodySmMedium" color="$bg" lineHeight={14}>
              i
            </SizableText>
          </XStack>
          <SizableText size="$bodySm" color="$textSubdued" flex={1}>
            {intl.formatMessage({
              id: ETranslations.perp_portfolio_margin_requirement__msg,
            })}
          </SizableText>
        </XStack>
      ) : null}
      <TradingGuardWrapper buttonSize={PERP_DIALOG_BUTTON_SIZE}>
        <Button
          testID="perp-account-mode-confirm-button"
          variant="primary"
          size={PERP_DIALOG_BUTTON_SIZE}
          onPress={handleConfirm}
        >
          {intl.formatMessage({ id: ETranslations.global_confirm })}
        </Button>
      </TradingGuardWrapper>
    </YStack>
  );
}

export function showAccountModeDialog({
  dialog,
  initialMode,
  onSelect,
  title,
}: {
  dialog?: ReturnType<typeof useInPageDialog>;
  initialMode: IPerpsAccountModeOption;
  onSelect?: (mode: IPerpsAccountModeOption) => void;
  title: string;
}) {
  const DialogInstance =
    platformEnv.isNativeAndroid || !dialog ? Dialog : dialog;

  const dialogInstance = DialogInstance.show({
    title,
    floatingPanelProps: platformEnv.isNativeAndroid
      ? undefined
      : {
          width: 480,
        },
    renderContent: (
      <PerpsProviderMirror>
        <AccountModeContent
          initialMode={initialMode}
          onSelect={onSelect}
          onClose={() => {
            void dialogInstance.close();
          }}
        />
      </PerpsProviderMirror>
    ),
    contentContainerProps: PERP_MOBILE_DIALOG_CONTENT_CONTAINER_PROPS,
    showFooter: false,
    onClose: () => {
      void dialogInstance.close();
    },
  });

  return dialogInstance;
}

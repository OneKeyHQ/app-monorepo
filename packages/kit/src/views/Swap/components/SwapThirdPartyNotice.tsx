import { type KeyboardEvent as ReactKeyboardEvent, memo } from 'react';

import { useIntl } from 'react-intl';

import type { IKeyOfIcons } from '@onekeyhq/components';
import {
  DashText,
  Dialog,
  Icon,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import {
  DialogTermsOfUseLink,
  ExplainerDialogScrollView,
} from '@onekeyhq/kit/src/components/TermsOfUseLink';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { IntlShape } from 'react-intl';

const HOW_TRADING_WORKS_ITEMS: {
  icon: IKeyOfIcons;
  title: ETranslations;
  desc: ETranslations;
}[] = [
  {
    icon: 'DocumentSearch1Outline',
    title: ETranslations.swap_how_trading_works_compare__title,
    desc: ETranslations.swap_how_trading_works_compare__desc,
  },
  {
    icon: 'BuildingsOutline',
    title: ETranslations.swap_how_trading_works_provider__title,
    desc: ETranslations.swap_how_trading_works_provider__desc,
  },
  {
    icon: 'FolderUserOutline',
    title: ETranslations.swap_how_trading_works_identity__title,
    desc: ETranslations.swap_how_trading_works_identity__desc,
  },
  {
    icon: 'PercentOutline',
    title: ETranslations.swap_how_trading_works_fees__title,
    desc: ETranslations.swap_how_trading_works_fees__desc,
  },
];

function SwapHowTradingWorksDialogContent({ intl }: { intl: IntlShape }) {
  return (
    <YStack testID="swap-how-trading-works-content" gap="$4">
      {HOW_TRADING_WORKS_ITEMS.map(({ icon, title, desc }) => (
        <XStack key={icon} gap="$3" alignItems="center">
          <XStack
            w="$10"
            h="$10"
            borderRadius="$full"
            bg="$bgStrong"
            alignItems="center"
            justifyContent="center"
          >
            <Icon name={icon} size="$5" color="$iconSubdued" />
          </XStack>
          <YStack flex={1}>
            <SizableText size="$bodyLgMedium">
              {intl.formatMessage({ id: title })}
            </SizableText>
            <SizableText size="$bodyMd" color="$textSubdued">
              {intl.formatMessage({ id: desc })}
            </SizableText>
          </YStack>
        </XStack>
      ))}
      <DialogTermsOfUseLink intl={intl} testID="swap-how-trading-works-terms" />
    </YStack>
  );
}

function showSwapHowTradingWorksDialog({ intl }: { intl: IntlShape }) {
  return Dialog.show({
    title: intl.formatMessage({
      id: ETranslations.swap_how_trading_works__title,
    }),
    showCancelButton: false,
    onConfirmText: intl.formatMessage({
      id: ETranslations.global_got_it,
    }),
    renderContent: (
      <ExplainerDialogScrollView>
        <SwapHowTradingWorksDialogContent intl={intl} />
      </ExplainerDialogScrollView>
    ),
  });
}

// Tells users that swaps are provided by third parties, with an entry to the
// "How trading works" explainer. Sits below the trade card on the Swap page.
// Memoized: it takes no props, while its parents re-render on every keystroke
// and quote update and the dashed underline is expensive to reconcile on
// native.
export const SwapThirdPartyNotice = memo(function SwapThirdPartyNotice() {
  const intl = useIntl();
  return (
    <YStack testID="swap-third-party-notice" alignItems="center" gap="$1">
      <SizableText size="$bodySm" color="$textSubdued" textAlign="center">
        {intl.formatMessage({
          id: ETranslations.swap_third_party_notice__desc,
        })}
      </SizableText>
      <DashText
        testID="swap-how-trading-works"
        size="$bodySm"
        color="$textSubdued"
        dashColor="$textSubdued"
        cursor="pointer"
        role="button"
        hoverStyle={{ color: '$text' }}
        pressStyle={{ opacity: 0.7 }}
        focusVisibleStyle={{
          outlineColor: '$focusRing',
          outlineWidth: 2,
          outlineStyle: 'solid',
          outlineOffset: 2,
        }}
        onPress={() => {
          showSwapHowTradingWorksDialog({ intl });
        }}
        {...(!platformEnv.isNative && {
          tabIndex: 0,
          onKeyDown: (event: ReactKeyboardEvent<HTMLSpanElement>) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            event.stopPropagation();
            showSwapHowTradingWorksDialog({ intl });
          },
        })}
      >
        {intl.formatMessage({
          id: ETranslations.swap_how_trading_works__action,
        })}
      </DashText>
    </YStack>
  );
});

import BigNumber from 'bignumber.js';
import { noop } from 'lodash';
import { useIntl } from 'react-intl';

import { Icon, Page, SizableText, XStack, YStack } from '@onekeyhq/components';
import NumberSizeableTextWrapper from '@onekeyhq/kit/src/components/NumberSizeableTextWrapper';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { ProtocolSwitchRow } from '../../../Staking/components/UniversalStake';
import { EARN_DESKTOP_DEMO_COPY } from '../../components/desktopHome/earnDesktopHomeCopy';

import { buildOfferRowProps, getOfferName } from './EarnRouterOffer';

import type { IEarnDesktopHoldOffer } from '../../components/desktopHome/earnDesktopHome.utils';

// The withdraw modal once the withdrawal is out: what it took, and the same
// token's better rate on the same network, one press from depositing it
// there, under the rate the withdrawal left
export function EarnWithdrawDone({
  symbol,
  tokenImageUri,
  amount,
  offer,
  fromOffer,
  onDone,
  onDeposit,
}: {
  symbol: string;
  tokenImageUri?: string;
  amount: string;
  offer: IEarnDesktopHoldOffer;
  fromOffer?: IEarnDesktopHoldOffer;
  onDone: () => void;
  onDeposit: () => void;
}) {
  const intl = useIntl();
  return (
    <>
      <YStack px="$5" pt="$5" pb="$5" gap="$8">
        <YStack ai="center" gap="$3">
          <Icon name="CheckRadioSolid" size="$12" color="$iconSuccess" />
          <YStack ai="center" gap="$1">
            <XStack ai="center" gap="$2">
              <Token size="sm" tokenImageUri={tokenImageUri} />
              <NumberSizeableTextWrapper
                size="$headingXl"
                formatter="balance"
                formatterOptions={{ tokenSymbol: symbol }}
              >
                {amount}
              </NumberSizeableTextWrapper>
            </XStack>
            <SizableText size="$bodyMd" color="$textSubdued">
              {intl.formatMessage({
                id: ETranslations.feedback_transaction_submitted,
              })}
            </SizableText>
          </YStack>
        </YStack>
        <YStack gap="$2">
          <YStack gap="$0.5" px="$1">
            <SizableText size="$headingSm">
              {EARN_DESKTOP_DEMO_COPY.earnMoreOn(symbol)}
            </SizableText>
            {fromOffer ? (
              <SizableText size="$bodyMd" color="$textSubdued">
                {EARN_DESKTOP_DEMO_COPY.paysRate(
                  getOfferName(fromOffer),
                  `${new BigNumber(fromOffer.apr).toFixed(2)}%`,
                )}
              </SizableText>
            ) : null}
          </YStack>
          {/* The offer as the deposit modal's protocol row shows it */}
          <ProtocolSwitchRow
            testID="earn-withdraw-better-offer"
            {...buildOfferRowProps(offer)}
            isSwitchEnabled={false}
            showChevron={false}
            onPress={noop}
          />
        </YStack>
      </YStack>
      <Page.Footer
        onCancelText={intl.formatMessage({ id: ETranslations.global_done })}
        onCancel={onDone}
        // The amount is the one above; the router opens with it filled in
        onConfirmText={intl.formatMessage({ id: ETranslations.earn_deposit })}
        onConfirm={onDeposit}
        confirmButtonProps={{ testID: 'earn-withdraw-deposit-better' }}
        cancelButtonProps={{ testID: 'earn-withdraw-done' }}
      />
    </>
  );
}

import { useEffect } from 'react';

import BigNumber from 'bignumber.js';
import { noop } from 'lodash';
import { useIntl } from 'react-intl';

import { Page, SizableText, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { EarnFooterFade } from '../../../Staking/components/EarnFooterFade';
import { ProtocolSwitchRow } from '../../../Staking/components/UniversalStake';
import { EARN_DESKTOP_DEMO_COPY } from '../../components/desktopHome/earnDesktopHomeCopy';

import { EarnDoneHeader, formatDoneAmount } from './EarnDepositDone';
import { useWarmOfferForm } from './EarnOffersDeposit';
import {
  buildOfferRowProps,
  getOfferName,
  getOfferTarget,
} from './EarnRouterOffer';

import type { IEarnDesktopHoldOffer } from '../../components/desktopHome/earnDesktopHome.utils';

// The withdraw modal once the withdrawal is out: what it took and from
// where, under the same top as a deposit's done view, then the same token's
// better rate on the same network, one press from depositing it there, under
// the rate the withdrawal left
export function EarnWithdrawDone({
  symbol,
  amount,
  offer,
  fromOffer,
  networkId,
  logoURI,
  networkLogoURI,
  onDone,
  onDeposit,
}: {
  symbol: string;
  amount: string;
  offer: IEarnDesktopHoldOffer;
  fromOffer?: IEarnDesktopHoldOffer;
  networkId: string;
  // The token's logo, for the deposit form Deposit opens
  logoURI?: string;
  // The badge on the offer's logo, as the form's protocol card has it
  networkLogoURI?: string;
  onDone: () => void;
  onDeposit: () => void;
}) {
  const intl = useIntl();
  const withdrawn = formatDoneAmount(amount, symbol);
  // Deposit opens the offer's form: read ahead while this view shows
  const warmOfferForm = useWarmOfferForm({ networkId, symbol, logoURI });
  useEffect(() => {
    warmOfferForm(offer);
  }, [offer, warmOfferForm]);
  return (
    <>
      <YStack px="$5" pt="$5" pb="$5" gap="$8">
        <EarnDoneHeader
          line={
            fromOffer
              ? EARN_DESKTOP_DEMO_COPY.withdrewFrom(
                  withdrawn,
                  getOfferTarget(fromOffer),
                )
              : withdrawn
          }
        />
        <YStack gap="$2">
          {/* Starts where the card's content does, as the form's rows
              start where the box's text does */}
          <YStack gap="$0.5" px="$3.5">
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
            {...buildOfferRowProps(offer, { intl })}
            networkLogoURI={networkLogoURI}
            isSwitchEnabled={false}
            showChevron={false}
            onPress={noop}
          />
        </YStack>
      </YStack>
      <Page.Footer>
        <EarnFooterFade fadesIn>
          <Page.FooterActions
            onCancelText={intl.formatMessage({ id: ETranslations.global_done })}
            onCancel={onDone}
            // The amount is the one above; the router opens with it filled in
            onConfirmText={intl.formatMessage({
              id: ETranslations.earn_deposit,
            })}
            onConfirm={onDeposit}
            confirmButtonProps={{ testID: 'earn-withdraw-deposit-better' }}
            cancelButtonProps={{ testID: 'earn-withdraw-done' }}
          />
        </EarnFooterFade>
      </Page.Footer>
    </>
  );
}

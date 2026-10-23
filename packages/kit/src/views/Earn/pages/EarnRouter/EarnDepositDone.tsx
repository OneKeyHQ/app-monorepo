import { useIntl } from 'react-intl';
import { useReducedMotion } from 'react-native-reanimated';

import { Icon, Page, SizableText, YStack } from '@onekeyhq/components';
import {
  ANIMATE_ONLY_OPACITY,
  ANIMATE_ONLY_OPACITY_TRANSFORM,
} from '@onekeyhq/components/src/utils/animationConstants';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';

import { EarnFooterFade } from '../../../Staking/components/EarnFooterFade';
import { EarnOutcomeRow } from '../../../Staking/components/UniversalStake/EarnFormSummary';
import { EARN_DESKTOP_DEMO_COPY } from '../../components/desktopHome/earnDesktopHomeCopy';

import type { IEarnOutcome } from '../../../Staking/components/UniversalStake/EarnFormSummary';

export type IEarnDepositDoneInfo = {
  amount: string;
  symbol: string;
  // Where it went: the protocol, and its vault where it has one
  target?: string;
  // The result the form showed for the amount
  outcome?: IEarnOutcome;
};

const CHECK_ENTER_STYLE = { opacity: 0, scale: 0.8 } as const;
const TEXT_ENTER_STYLE = { opacity: 0 } as const;

export const formatDoneAmount = (amount: string, symbol: string) =>
  `${numberFormat(amount, { formatter: 'balance' })} ${symbol}`;

/**
 * The top of a deposit or withdraw modal once the transaction is out: the
 * check grows in, then what was submitted and where it went
 */
export function EarnDoneHeader({ line }: { line?: string }) {
  const intl = useIntl();
  const reduceMotion = useReducedMotion();
  return (
    <YStack ai="center" gap="$3">
      <YStack
        {...(reduceMotion
          ? null
          : {
              transition: 'fast',
              animateOnly: ANIMATE_ONLY_OPACITY_TRANSFORM,
              enterStyle: CHECK_ENTER_STYLE,
            })}
      >
        <Icon name="CheckRadioSolid" size="$12" color="$iconSuccess" />
      </YStack>
      <YStack
        ai="center"
        gap="$1"
        {...(reduceMotion
          ? null
          : {
              transition: 'fast',
              animateOnly: ANIMATE_ONLY_OPACITY,
              enterStyle: TEXT_ENTER_STYLE,
            })}
      >
        <SizableText size="$headingLg" textAlign="center">
          {intl.formatMessage({
            id: ETranslations.feedback_transaction_submitted,
          })}
        </SizableText>
        {line ? (
          <SizableText size="$bodyLg" color="$textSubdued" textAlign="center">
            {line}
          </SizableText>
        ) : null}
      </YStack>
    </YStack>
  );
}

// The deposit modal once the deposit is out: what went where, and the
// result the form showed for it. Closed only by its own buttons
export function EarnDepositDone({
  info,
  onPortfolio,
  onDone,
}: {
  info: IEarnDepositDoneInfo;
  onPortfolio: () => void;
  onDone: () => void;
}) {
  const intl = useIntl();
  const reduceMotion = useReducedMotion();
  const deposited = formatDoneAmount(info.amount, info.symbol);
  return (
    <>
      <YStack px="$5" pt="$5" pb="$5" gap="$8">
        <EarnDoneHeader
          line={
            info.target
              ? EARN_DESKTOP_DEMO_COPY.depositedTo(deposited, info.target)
              : deposited
          }
        />
        {info.outcome?.values.length ? (
          // Inset as the form's rows were, under the box's text
          <YStack
            px="$3.5"
            {...(reduceMotion
              ? null
              : {
                  transition: 'fast',
                  animateOnly: ANIMATE_ONLY_OPACITY,
                  enterStyle: TEXT_ENTER_STYLE,
                })}
          >
            <EarnOutcomeRow
              testID="earn-deposit-done-outcome"
              outcome={info.outcome}
            />
          </YStack>
        ) : null}
      </YStack>
      <Page.Footer>
        <EarnFooterFade fadesIn>
          <Page.FooterActions
            onCancelText={intl.formatMessage({
              id: ETranslations.earn_my_portfolio__title,
            })}
            onCancel={onPortfolio}
            onConfirmText={intl.formatMessage({
              id: ETranslations.global_done,
            })}
            onConfirm={onDone}
            cancelButtonProps={{ testID: 'earn-deposit-done-portfolio' }}
            confirmButtonProps={{ testID: 'earn-deposit-done' }}
          />
        </EarnFooterFade>
      </Page.Footer>
    </>
  );
}

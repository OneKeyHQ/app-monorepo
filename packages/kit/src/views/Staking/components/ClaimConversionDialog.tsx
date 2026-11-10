import { useSyncExternalStore } from 'react';

import { useIntl } from 'react-intl';

import { Dialog, Spinner, YStack } from '@onekeyhq/components';
import type { IKeyOfIcons } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
import type { IStakeClaimBaseParams } from '@onekeyhq/shared/types/staking';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

import { StakeProgress } from './StakeProgress';

import type { IntlShape } from 'react-intl';

/**
 * The conversion that follows a claim (OK-61790, Unitas): a claim on the USDT
 * vault pays USDu, and the server converts it back to USDT without anything
 * to sign. Figma "Unitas USDT claim and convert", 31083-28765.
 *
 * One dialog carries the wait. After a first claim it walks two steps: the
 * claim landing on-chain, then the conversion. A retry (USDu already in the
 * wallet) has no claim step and shows the spinner alone. The dialog can be
 * closed: that only stops this client from waiting, the server keeps
 * converting and the position shows the amount as awaiting conversion until
 * it ends, so nothing is prompted afterwards. Left open, it ends in a result:
 * success, a failure that names the server's reason and offers another try,
 * or a notice that it is taking long and finishes in the background.
 */

export type IClaimConversionOutcome =
  | 'success'
  | 'failed'
  | 'timeout'
  | 'dismissed';

type IConversionStep = 'claim' | 'convert';

type IStepStore = {
  get: () => IConversionStep;
  set: (step: IConversionStep) => void;
  subscribe: (listener: () => void) => () => void;
};

/** The dialog is shown imperatively; this is how the wait moves its step line. */
function createStepStore(initial: IConversionStep): IStepStore {
  let step = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => step,
    set: (next) => {
      step = next;
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

function ConversionProgress({
  store,
  withClaimStep,
  symbol,
}: {
  store: IStepStore;
  withClaimStep: boolean;
  symbol: string;
}) {
  const intl = useIntl();
  const step = useSyncExternalStore(store.subscribe, store.get, store.get);
  return (
    <YStack ai="center" gap="$4" py="$5">
      <Spinner size="large" />
      {withClaimStep ? (
        <StakeProgress
          currentStep={step === 'claim' ? 1 : 2}
          step1LabelId={ETranslations.earn_claim}
          step2Label={intl.formatMessage(
            { id: ETranslations.earn_convert_step__action },
            { symbol },
          )}
        />
      ) : null}
    </YStack>
  );
}

type IAttemptResult =
  | { kind: 'success'; amount?: string }
  | { kind: 'failed'; message?: string }
  | { kind: 'timeout' }
  | { kind: 'dismissed' };

export type IClaimConversionParams = {
  intl: IntlShape;
  /** the claim, asked for with the identity of the server-executed step */
  request: IStakeClaimBaseParams & { identity: string };
  /** the token the conversion pays out (USDT) */
  symbol: string;
  /** what the success line names when the order does not say */
  amount: string;
  /** a first claim walks "1. Claim → 2. Convert"; a retry has no claim step */
  withClaimStep: boolean;
};

/** One wait under the progress dialog, until it settles or the user closes it. */
async function runAttempt({
  intl,
  request,
  symbol,
  withClaimStep,
}: Omit<IClaimConversionParams, 'amount'>): Promise<IAttemptResult> {
  const store = createStepStore(withClaimStep ? 'claim' : 'convert');
  let closedByUs = false;
  let onDismissed: () => void = () => {};
  const dismissed = new Promise<IAttemptResult>((resolve) => {
    onDismissed = () => resolve({ kind: 'dismissed' });
  });
  const dialog = Dialog.show({
    title: intl.formatMessage(
      { id: ETranslations.earn_convert_in_progress__title },
      { symbol },
    ),
    showExitButton: true,
    dismissOnOverlayPress: false,
    disableDrag: true,
    showFooter: false,
    renderContent: (
      <ConversionProgress
        store={store}
        withClaimStep={withClaimStep}
        symbol={symbol}
      />
    ),
    onClose: () => {
      if (!closedByUs) {
        onDismissed();
      }
    },
  });

  const wait = async (): Promise<IAttemptResult> => {
    // Right after a claim the server has nothing to convert until the claim
    // is mined; the request retries until then, which is the Claim step.
    const accepted =
      await backgroundApiProxy.serviceStaking.requestServerExecutedClaim(
        request,
      );
    if (accepted.status === 'rejected') {
      return { kind: 'failed', message: accepted.message };
    }
    if (accepted.status === 'timeout') {
      return { kind: 'timeout' };
    }
    store.set('convert');
    const settled =
      await backgroundApiProxy.serviceStaking.waitForServerExecutedOrder({
        networkId: request.networkId,
        accountId: request.accountId,
        orderId: accepted.orderId,
      });
    if (settled.status === 'success') {
      return { kind: 'success', amount: settled.order?.amount };
    }
    if (settled.status === 'failed') {
      return { kind: 'failed', message: settled.order?.errorMessage };
    }
    return { kind: 'timeout' };
  };

  const result = await Promise.race([
    // Neither call throws for an expected outcome; whatever else goes wrong
    // is a failure the user can retry.
    wait().catch((): IAttemptResult => ({ kind: 'failed' })),
    dismissed,
  ]);
  if (result.kind !== 'dismissed') {
    closedByUs = true;
    await dialog.close();
  }
  return result;
}

/** A result dialog; resolves once it is gone, true when its main button closed it. */
function showResult({
  icon,
  tone,
  title,
  description,
  confirmText,
  cancelText,
}: {
  icon: IKeyOfIcons;
  tone?: 'success' | 'destructive';
  title: string;
  description: string;
  confirmText: string;
  cancelText?: string;
}): Promise<boolean> {
  return new Promise((resolve) => {
    let confirmed = false;
    Dialog.show({
      icon,
      tone,
      title,
      description,
      onConfirmText: confirmText,
      // The destructive tone colors the icon; the button stays the plain
      // primary one, since Try again is not a destructive action.
      confirmButtonProps: { variant: 'primary' },
      onConfirm: () => {
        confirmed = true;
      },
      showCancelButton: Boolean(cancelText),
      onCancelText: cancelText,
      onClose: () => resolve(confirmed),
    });
  });
}

/**
 * Converts under the dialog and reports how it ended. A failure offers
 * another try, which reruns the conversion alone: by then the claim has
 * landed, so the step line is gone. Resolves once the result dialog, if any,
 * is closed.
 */
export async function runClaimConversion({
  intl,
  request,
  symbol,
  amount,
  withClaimStep,
}: IClaimConversionParams): Promise<IClaimConversionOutcome> {
  let showClaimStep = withClaimStep;
  for (;;) {
    const result = await runAttempt({
      intl,
      request,
      symbol,
      withClaimStep: showClaimStep,
    });
    if (result.kind === 'dismissed') {
      return 'dismissed';
    }
    if (result.kind === 'success') {
      await showResult({
        icon: 'CheckRadioSolid',
        tone: 'success',
        title: intl.formatMessage(
          { id: ETranslations.earn_convert_success__title },
          { symbol },
        ),
        description: intl.formatMessage(
          { id: ETranslations.earn_convert_success__desc },
          {
            // Unitas converts 1:1, so the order's USDu amount is the USDT paid.
            amount: numberFormat(result.amount || amount, {
              formatter: 'balance',
            }),
            symbol,
          },
        ),
        confirmText: intl.formatMessage({ id: ETranslations.global_done }),
      });
      return 'success';
    }
    if (result.kind === 'timeout') {
      await showResult({
        icon: 'ClockTimeHistoryOutline',
        title: intl.formatMessage({
          id: ETranslations.earn_convert_timeout__title,
        }),
        description: intl.formatMessage({
          id: ETranslations.earn_convert_timeout__desc,
        }),
        confirmText: intl.formatMessage({ id: ETranslations.global_got_it }),
      });
      return 'timeout';
    }
    const retry = await showResult({
      icon: 'XCircleOutline',
      tone: 'destructive',
      title: intl.formatMessage(
        { id: ETranslations.earn_convert_failed__title },
        { symbol },
      ),
      // The server words its own rejections (redeem limit, vault paused,
      // request failed); a failure without one is on our side of the wire.
      description:
        result.message ||
        intl.formatMessage({ id: ETranslations.auth_server_error_text }),
      confirmText: intl.formatMessage({ id: ETranslations.global_try_again }),
      cancelText: intl.formatMessage({ id: ETranslations.global_close }),
    });
    if (!retry) {
      return 'failed';
    }
    showClaimStep = false;
  }
}

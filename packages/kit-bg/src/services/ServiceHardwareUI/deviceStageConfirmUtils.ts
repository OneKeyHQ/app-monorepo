import BigNumber from 'bignumber.js';

import type {
  IUnsignedMessage,
  IUnsignedTxPro,
} from '@onekeyhq/core/src/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import { getStakingActionLabel } from '@onekeyhq/shared/src/utils/txActionUtils';
import type {
  IDeviceStageConfirmContent,
  IDeviceStageConfirmDetail,
} from '@onekeyhq/shared/types/deviceStage';
import type { ISendSelectedFeeInfo } from '@onekeyhq/shared/types/fee';
import { privateSendProvider } from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import { EProtocolOfExchange } from '@onekeyhq/shared/types/swap/types';

/**
 * Confirm-channel content builders (OK-59934): translate what the business
 * caller holds into the confirm card's shapes. Best-effort — a flow whose
 * payload carries nothing displayable registers nothing, and the confirm
 * card plays its plain "check on device" shape.
 */

/** The fee row for the confirm card — only callers that already resolved a
 * fee (the send pipelines) can offer one; flows without it show no row.
 *
 * The label follows the chain's fee semantics. On cap-semantic chains
 * (EVM, TRON's feeLimit, Sui's budget) `totalNative` is the signed budget
 * (gas limit × max fee price), the same formula firmware renders as
 * "Maximum fee" — the row mirrors the device and the page footer keeps its
 * expected-case estimate. On chains whose fee is fully determined at signing
 * (Solana charges base fee per signature plus priority fee on the compute
 * unit LIMIT, not usage; UTXO/fixed-fee chains likewise) there is no
 * max-vs-actual gap, so the row reuses the page footer's own wording. */
function buildStageFeeDetail(
  stageFeeInfo: ISendSelectedFeeInfo | undefined,
): IDeviceStageConfirmDetail | undefined {
  const amount = stageFeeInfo?.totalNative;
  if (!stageFeeInfo || !amount) {
    return undefined;
  }
  const feeInfo = stageFeeInfo.feeInfo;
  const isExactFee = Boolean(
    feeInfo?.feeSol ||
    feeInfo?.feeUTXO ||
    feeInfo?.feeCkb ||
    feeInfo?.feeAlgo ||
    feeInfo?.feeDot,
  );
  const symbol = feeInfo?.common?.nativeSymbol;
  return {
    label: appLocale.intl.formatMessage({
      id: isExactFee
        ? ETranslations.global_est_network_fee
        : ETranslations.fee_max_fee,
    }),
    value: symbol ? `${amount} ${symbol}` : amount,
  };
}

/** For a contract call the tx's `to` is the one line firmware is guaranteed
 * to render — it is a byte-identical signing input. Chains whose encodedTx
 * carries no `to` (Solana's serialized tx, UTXO chains) get no row. */
function buildStageContractDetail(
  unsignedTx: IUnsignedTxPro,
): IDeviceStageConfirmDetail | undefined {
  const encoded = unsignedTx.encodedTx as unknown;
  if (!encoded || typeof encoded !== 'object') {
    return undefined;
  }
  const { to } = encoded as { to?: unknown };
  if (typeof to !== 'string' || !to) {
    return undefined;
  }
  return {
    label: appLocale.intl.formatMessage({
      id: ETranslations.sig_interact_contract_label,
    }),
    value: to,
    highlightEnds: true,
  };
}

export function buildStageConfirmContentForSignTx(
  unsignedTx: IUnsignedTxPro | undefined,
  stageFeeInfo?: ISendSelectedFeeInfo,
): IDeviceStageConfirmContent | undefined {
  if (!unsignedTx) {
    return undefined;
  }
  const { intl } = appLocale;
  const amountLabel = intl.formatMessage({ id: ETranslations.content__amount });
  const feeDetail = buildStageFeeDetail(stageFeeInfo);

  const transfers = unsignedTx.transfersInfo ?? [];
  const transfer = transfers[0];
  if (transfer?.to) {
    // A multi-transfer tx rides a bulk-send contract (or a multi-output
    // UTXO tx): the device screen shows that aggregate, so a single
    // recipient row would contradict the very screen the card asks the
    // person to check. Show the batch's shape instead.
    if (transfers.length > 1) {
      const details: IDeviceStageConfirmDetail[] = [
        {
          label: intl.formatMessage({ id: ETranslations.global_recipient }),
          value: intl.formatMessage(
            { id: ETranslations.global_count_addresses },
            { count: transfers.length },
          ),
        },
      ];
      const symbol = transfer.tokenInfo?.symbol;
      const total = transfers.reduce(
        (acc, item) => acc.plus(item.amount || 0),
        new BigNumber(0),
      );
      if (total.gt(0)) {
        details.push({
          label: amountLabel,
          value: symbol ? `${total.toFixed()} ${symbol}` : total.toFixed(),
        });
      }
      if (feeDetail) {
        details.push(feeDetail);
      }
      return { details };
    }
    const details: IDeviceStageConfirmDetail[] = [
      {
        label: intl.formatMessage({ id: ETranslations.global_recipient }),
        value: transfer.to,
        highlightEnds: true,
      },
    ];
    if (transfer.amount) {
      const symbol = transfer.tokenInfo?.symbol;
      details.push({
        label: amountLabel,
        value: symbol ? `${transfer.amount} ${symbol}` : transfer.amount,
      });
    }
    if (feeDetail) {
      details.push(feeDetail);
    }
    return { details };
  }

  const approve = unsignedTx.approveInfo;
  if (approve?.spender) {
    const details: IDeviceStageConfirmDetail[] = [
      {
        label: intl.formatMessage({ id: ETranslations.global_approve }),
        value: approve.spender,
        highlightEnds: true,
      },
    ];
    if (approve.isMax) {
      details.push({
        label: amountLabel,
        value: intl.formatMessage({
          id: ETranslations.approve_edit_unlimited_amount,
        }),
        warning: true,
      });
    } else if (approve.amount) {
      const symbol = approve.tokenInfo?.symbol;
      details.push({
        label: amountLabel,
        value: symbol ? `${approve.amount} ${symbol}` : approve.amount,
      });
    }
    if (feeDetail) {
      details.push(feeDetail);
    }
    return { details };
  }

  // Branch order is deliberate: order-based bridge swaps (SWFT/Changelly
  // style deposits) and BTC Babylon stakes carry transfersInfo alongside
  // swapInfo/stakingInfo, and for those the device screen shows the plain
  // transfer — the transfer branch above must keep winning. Only contract-call
  // swaps and stakes reach here. Mixed swap+staking txs (Ethena unstake)
  // follow the confirm page's precedence: swap first.
  const swap = unsignedTx.swapInfo;
  if (
    swap?.protocol === EProtocolOfExchange.SWAP &&
    swap.swapBuildResData?.result?.info?.provider !== privateSendProvider
  ) {
    // The device renders the router interaction, not the trade; pay/receive
    // are the app-side reading of it — same fields the review dialog showed.
    // The receive side is a quote, hence the estimate wording.
    const details: IDeviceStageConfirmDetail[] = [];
    if (swap.sender?.amount) {
      const symbol = swap.sender.token?.symbol;
      details.push({
        label: intl.formatMessage({ id: ETranslations.swap_review_you_pay }),
        value: symbol ? `${swap.sender.amount} ${symbol}` : swap.sender.amount,
      });
    }
    if (swap.receiver?.amount) {
      const symbol = swap.receiver.token?.symbol;
      details.push({
        label: intl.formatMessage({
          id: ETranslations.sign_swap_estimate_receive,
        }),
        value: symbol
          ? `${swap.receiver.amount} ${symbol}`
          : swap.receiver.amount,
      });
    }
    if (details.length) {
      const contractDetail = buildStageContractDetail(unsignedTx);
      if (contractDetail) {
        details.push(contractDetail);
      }
      if (feeDetail) {
        details.push(feeDetail);
      }
      return { details };
    }
  }

  const staking = unsignedTx.stakingInfo;
  if (staking?.protocol) {
    // The action word shares the confirm page title's mapper and the value
    // its Provider field; amounts are best-effort — Withdraw flows carry
    // neither side, Claim only the receive side. The send side is what the
    // person hands over — exact by construction. The receive side is a
    // request, not the built tx's decoded outcome (withdraw-all rides a
    // shares conversion the client never sees), so it must not claim
    // precision the confirm page's parsed amount can contradict.
    const details: IDeviceStageConfirmDetail[] = [
      {
        label: getStakingActionLabel({ stakingInfo: staking }),
        value: staking.protocol,
      },
    ];
    if (staking.send?.amount) {
      const symbol = staking.send.token?.symbol;
      details.push({
        label: amountLabel,
        value: symbol
          ? `${staking.send.amount} ${symbol}`
          : staking.send.amount,
      });
    }
    if (staking.receive?.amount) {
      const symbol = staking.receive.token?.symbol;
      details.push({
        label: intl.formatMessage({
          id: ETranslations.sign_swap_estimate_receive,
        }),
        value: symbol
          ? `${staking.receive.amount} ${symbol}`
          : staking.receive.amount,
      });
    }
    const contractDetail = buildStageContractDetail(unsignedTx);
    if (contractDetail) {
      details.push(contractDetail);
    }
    if (feeDetail) {
      details.push(feeDetail);
    }
    return { details };
  }

  return undefined;
}

/** Rough printable-text probe: a decoded personal-sign payload that is
 * mostly control bytes is not text — keep the original hex instead. */
function isMostlyPrintable(text: string): boolean {
  if (!text.length) {
    return false;
  }
  let printable = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    if (code >= 0x20 || code === 0x0a || code === 0x09 || code === 0x0d) {
      printable += 1;
    }
  }
  return printable / text.length > 0.9;
}

export function buildStageConfirmContentForMessage(
  unsignedMessage: IUnsignedMessage | undefined,
): IDeviceStageConfirmContent | undefined {
  try {
    const message = (unsignedMessage as { message?: unknown } | undefined)
      ?.message;
    if (typeof message !== 'string' || !message) {
      return undefined;
    }
    // Personal-sign payloads arrive hex-encoded; show the human text when
    // it decodes cleanly, the raw payload otherwise.
    if (/^0x[0-9a-fA-F]+$/.test(message)) {
      const decoded = Buffer.from(message.slice(2), 'hex').toString('utf8');
      return { message: isMostlyPrintable(decoded) ? decoded : message };
    }
    // Typed data rides as a JSON string — pretty-print it; the card clamps
    // long content and the device screen stays the full read.
    try {
      return {
        message: JSON.stringify(JSON.parse(message), null, 2),
      };
    } catch {
      return { message };
    }
  } catch {
    return undefined;
  }
}

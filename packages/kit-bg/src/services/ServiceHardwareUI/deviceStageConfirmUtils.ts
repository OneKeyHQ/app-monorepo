import type {
  IUnsignedMessage,
  IUnsignedTxPro,
} from '@onekeyhq/core/src/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import type {
  IDeviceStageConfirmContent,
  IDeviceStageConfirmDetail,
} from '@onekeyhq/shared/types/deviceStage';

/**
 * Confirm-channel content builders (OK-59934): translate what the business
 * caller holds into the confirm card's shapes. Best-effort — a flow whose
 * payload carries nothing displayable registers nothing, and the confirm
 * card plays its plain "check on device" shape.
 */

export function buildStageConfirmContentForSignTx(
  unsignedTx: IUnsignedTxPro | undefined,
): IDeviceStageConfirmContent | undefined {
  if (!unsignedTx) {
    return undefined;
  }
  const { intl } = appLocale;
  const amountLabel = intl.formatMessage({ id: ETranslations.content__amount });

  const transfer = unsignedTx.transfersInfo?.[0];
  if (transfer?.to) {
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

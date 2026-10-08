import { createIntl, createIntlCache } from 'react-intl';

import enUS from '@onekeyhq/shared/src/locale/json/en_US.json';
import { EHostSecurityLevel } from '@onekeyhq/shared/types/discovery';
import type { IHostSecurity } from '@onekeyhq/shared/types/discovery';

import {
  computeSignExitGate,
  formatRecipientLine,
  normalizeNativePrice,
} from './utils';

const intl = createIntl(
  {
    locale: 'en-US',
    messages: enUS as Record<string, string>,
  },
  createIntlCache(),
);

describe('formatRecipientLine', () => {
  it('formats a single external recipient', () => {
    expect(
      formatRecipientLine({
        recipient: 'tb1qexample',
        extraRecipientCount: 0,
        intl,
      }),
    ).toBe('To tb1qexample');
  });

  it('appends +N for extra external recipients', () => {
    expect(
      formatRecipientLine({
        recipient: 'tb1qexample',
        extraRecipientCount: 2,
        intl,
      }),
    ).toBe('To tb1qexample +2');
  });

  it('formats a pure self-transfer psbt like any other recipient (own address in `recipient`)', () => {
    expect(
      formatRecipientLine({
        recipient: 'tb1pownaddress',
        extraRecipientCount: 0,
        intl,
      }),
    ).toBe('To tb1pownaddress');
  });

  it('keeps the generic fallback when no recipient address is decodable', () => {
    expect(
      formatRecipientLine({
        recipient: '',
        extraRecipientCount: 0,
        intl,
      }),
    ).toBe('To multiple outputs');
  });
});

describe('normalizeNativePrice', () => {
  it('passes through a valid positive numeric price', () => {
    expect(normalizeNativePrice(63_725)).toBe('63725');
    expect(normalizeNativePrice('63725.5')).toBe('63725.5');
  });

  it('rejects the server "--" no-price sentinel (signet)', () => {
    expect(normalizeNativePrice('--')).toBeUndefined();
  });

  it('rejects zero prices so testnets do not render a $0.00 fiat line', () => {
    expect(normalizeNativePrice('0')).toBeUndefined();
    expect(normalizeNativePrice(0)).toBeUndefined();
  });

  it('rejects missing and non-finite prices', () => {
    expect(normalizeNativePrice(undefined)).toBeUndefined();
    expect(normalizeNativePrice(NaN)).toBeUndefined();
    expect(normalizeNativePrice(Infinity)).toBeUndefined();
    expect(normalizeNativePrice('not-a-number')).toBeUndefined();
  });

  it('rejects negative prices', () => {
    expect(normalizeNativePrice(-1)).toBeUndefined();
    expect(normalizeNativePrice('-0.5')).toBeUndefined();
  });
});

describe('computeSignExitGate', () => {
  const securityInfo = (level: EHostSecurityLevel): IHostSecurity =>
    ({ level }) as IHostSecurity;

  it('blocks every exit while the risk query is still pending', () => {
    // urlSecurityInfo stays undefined until checkUrlSecurity settles; in
    // The risk checkbox is hidden while pending, so the gate must not depend
    // on checkbox visibility alone.
    const gate = computeSignExitGate({
      origin: 'https://dapp.example',
      urlSecurityInfo: undefined,
      showContinueOperate: false,
      continueOperate: true,
    });
    expect(gate.isRiskCheckPending).toBe(true);
    expect(gate.isSignExitBlocked).toBe(true);
  });

  it('does not treat a missing origin as a pending query', () => {
    // useRiskDetection skips checkUrlSecurity entirely for an empty origin,
    // so there is no verdict to wait for.
    const gate = computeSignExitGate({
      origin: '',
      urlSecurityInfo: undefined,
      showContinueOperate: false,
      continueOperate: true,
    });
    expect(gate.isRiskCheckPending).toBe(false);
    expect(gate.isSignExitBlocked).toBe(false);
  });

  it('unblocks Security and Unknown origins once the verdict lands', () => {
    for (const level of [
      EHostSecurityLevel.Security,
      EHostSecurityLevel.Unknown,
    ]) {
      const gate = computeSignExitGate({
        origin: 'https://dapp.example',
        urlSecurityInfo: securityInfo(level),
        showContinueOperate: false,
        continueOperate: true,
      });
      expect(gate.isRiskCheckPending).toBe(false);
      expect(gate.isSignExitBlocked).toBe(false);
    }
  });

  it('hard-blocks High origins even after the risk checkbox is ticked', () => {
    const gate = computeSignExitGate({
      origin: 'https://scam.example',
      urlSecurityInfo: securityInfo(EHostSecurityLevel.High),
      showContinueOperate: true,
      continueOperate: true,
    });
    expect(gate.isBlockingRisk).toBe(true);
    expect(gate.isSignExitBlocked).toBe(true);
  });

  it('blocks Medium origins until the risk checkbox is ticked', () => {
    const unacknowledged = computeSignExitGate({
      origin: 'https://sus.example',
      urlSecurityInfo: securityInfo(EHostSecurityLevel.Medium),
      showContinueOperate: true,
      continueOperate: false,
    });
    expect(unacknowledged.isRiskUnacknowledged).toBe(true);
    expect(unacknowledged.isSignExitBlocked).toBe(true);

    const acknowledged = computeSignExitGate({
      origin: 'https://sus.example',
      urlSecurityInfo: securityInfo(EHostSecurityLevel.Medium),
      showContinueOperate: true,
      continueOperate: true,
    });
    expect(acknowledged.isSignExitBlocked).toBe(false);
  });
});

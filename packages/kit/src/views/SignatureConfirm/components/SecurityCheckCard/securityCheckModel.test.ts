import {
  EHostSecurityLevel,
  type IHostSecurity,
} from '@onekeyhq/shared/types/discovery';
import type { ISignatureConfirmDisplay } from '@onekeyhq/shared/types/signatureConfirm';
import type { ITransactionSecurityCheckResult } from '@onekeyhq/shared/types/transactionSecurity';

import { buildSecurityCheckModel } from './securityCheckModel';

import type { IntlShape } from 'react-intl';

const intl = {
  formatMessage: ({ id }: { id?: string }) => id ?? '',
} as Pick<IntlShape, 'formatMessage'>;

const verifiedSite = {
  level: EHostSecurityLevel.Security,
} as IHostSecurity;

const parsedMessage: ISignatureConfirmDisplay = {
  title: 'Signature request',
  components: [],
  alerts: [],
};

function buildTransactionSecurityResult(
  level: EHostSecurityLevel,
): ITransactionSecurityCheckResult {
  return {
    level,
    detail: {
      code: `result-${level}`,
      title: `Result ${level}`,
      features: [],
    },
  };
}

describe('securityCheckModel', () => {
  it('keeps request confirmation separate from a safe verdict', () => {
    const model = buildSecurityCheckModel({
      kind: 'message',
      origin: 'https://app.example.com',
      urlSecurityInfo: verifiedSite,
      messageDisplay: parsedMessage,
      isConfirmationRequired: true,
      transactionSecurityInfo: buildTransactionSecurityResult(
        EHostSecurityLevel.Security,
      ),
      intl,
    });

    expect(model.status).toBe('success');
    expect(model.confirmation).toBe('request');
    expect(model.findings).toEqual([]);
  });

  it('uses a Prime risk result for both the card and confirmation gate', () => {
    const model = buildSecurityCheckModel({
      kind: 'message',
      origin: 'https://app.example.com',
      urlSecurityInfo: verifiedSite,
      messageDisplay: parsedMessage,
      transactionSecurityInfo: buildTransactionSecurityResult(
        EHostSecurityLevel.High,
      ),
      intl,
    });

    expect(model.status).toBe('critical');
    expect(model.confirmation).toBe('risk');
    expect(model.findings.map((finding) => finding.id)).toEqual([
      'tx-security-result-high',
    ]);
  });

  it('keeps an existing warning visible while Prime is still checking', () => {
    const model = buildSecurityCheckModel({
      kind: 'message',
      origin: 'https://app.example.com',
      urlSecurityInfo: verifiedSite,
      messageDisplay: {
        ...parsedMessage,
        alerts: ['Review this request'],
      },
      isTransactionSecurityPending: true,
      intl,
    });

    expect(model.status).toBe('warning');
    expect(model.confirmation).toBe('pending');
    expect(model.isPending).toBe(true);
    expect(model.findings).toHaveLength(1);
    expect(model.findings[0].id).toContain('parser-alert');
  });

  it('keeps a visible loading state before the first finding arrives', () => {
    const model = buildSecurityCheckModel({
      kind: 'message',
      origin: 'https://app.example.com',
      urlSecurityInfo: verifiedSite,
      messageDisplay: parsedMessage,
      isTransactionSecurityPending: true,
      intl,
    });

    expect(model.status).toBe('loading');
    expect(model.confirmation).toBe('pending');
    expect(model.isPending).toBe(true);
    expect(model.findings).toEqual([]);
    expect(model.shouldShowNoIssue).toBe(false);
  });

  it('does not force confirmation when the scan cannot assess the request', () => {
    const model = buildSecurityCheckModel({
      kind: 'message',
      origin: 'https://app.example.com',
      urlSecurityInfo: verifiedSite,
      messageDisplay: parsedMessage,
      transactionSecurityInfo: buildTransactionSecurityResult(
        EHostSecurityLevel.Unknown,
      ),
      intl,
    });

    expect(model.status).toBe('unknown');
    expect(model.confirmation).toBe('none');
  });
});

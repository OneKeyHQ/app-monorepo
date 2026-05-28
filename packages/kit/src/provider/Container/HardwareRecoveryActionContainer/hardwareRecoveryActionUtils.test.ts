import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import {
  buildLedgerAppInstallRequestKey,
  mergeLedgerAppInstallRequests,
} from './hardwareRecoveryActionUtils';

describe('hardwareRecoveryActionUtils', () => {
  it('dedupes ledger app install requests by vendor, connectId and appName', () => {
    const requests = mergeLedgerAppInstallRequests(
      [],
      [
        {
          type: 'ledger_app_install_required',
          vendor: EHardwareVendor.ledger,
          connectId: 'ledger-1',
          appName: 'Solana',
          source: 'batchCreateAccount',
        },
        {
          type: 'ledger_app_install_required',
          vendor: EHardwareVendor.ledger,
          connectId: 'ledger-1',
          appName: 'Solana',
          source: 'createAccount',
        },
        {
          type: 'ledger_app_install_required',
          vendor: EHardwareVendor.ledger,
          connectId: 'ledger-1',
          appName: 'Bifrost',
          source: 'batchCreateAccount',
        },
      ],
    );

    expect(requests).toHaveLength(2);
    expect(requests.map((request) => request.appName)).toEqual([
      'Solana',
      'Bifrost',
    ]);
    expect(requests[0].sources).toEqual([
      'batchCreateAccount',
      'createAccount',
    ]);
  });

  it('ignores silent requests', () => {
    const requests = mergeLedgerAppInstallRequests(
      [],
      [
        {
          type: 'ledger_app_install_required',
          vendor: EHardwareVendor.ledger,
          connectId: 'ledger-1',
          appName: 'Solana',
          source: 'onboarding',
          silent: true,
        },
      ],
    );

    expect(requests).toEqual([]);
  });

  it('normalizes missing connectId for key generation', () => {
    expect(
      buildLedgerAppInstallRequestKey({
        type: 'ledger_app_install_required',
        vendor: EHardwareVendor.ledger,
        connectId: '',
        appName: 'Solana',
      }),
    ).toBe('ledger::Solana');
  });
});

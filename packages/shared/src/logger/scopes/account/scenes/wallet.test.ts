import { EDeviceType } from '@onekeyfe/hd-shared';

import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import { WalletScene } from './wallet';

import type { IMethodDecoratorMetadata } from '../../../types';

class TestWalletScene extends WalletScene {
  emissions: Array<{
    methodName: string;
    args: unknown[];
    metadataList: IMethodDecoratorMetadata[];
  }> = [];

  override _emitLog(
    methodName: string,
    args: unknown[],
    metadataList: IMethodDecoratorMetadata[],
  ) {
    this.emissions.push({ methodName, args, metadataList });
  }
}

describe('WalletScene vendor passthrough', () => {
  // Vendor is an optional field on ConnectHWWallet details — when callers
  // pass it (OneKey or Ledger paths after this change), it must reach the
  // Mixpanel payload. When callers don't pass it (legacy hidden-wallet edge
  // paths, or callers from yet-unaudited code), the field must be omitted so
  // we don't pollute Mixpanel with `vendor: undefined` rows.

  describe('addWalletStarted', () => {
    it('includes vendor when ConnectHWWallet details carry it', () => {
      const scene = new TestWalletScene();
      scene.addWalletStarted({
        addMethod: 'ConnectHWWallet',
        details: {
          communication: 'USB',
          hardwareWalletType: 'Standard',
          vendor: EHardwareVendor.ledger,
        },
        isSoftwareWalletOnlyUser: false,
      });
      expect(scene.emissions).toHaveLength(1);
      const payload = scene.emissions[0].args[0] as {
        details: { vendor?: string };
      };
      expect(payload.details.vendor).toBe('ledger');
    });

    it('omits vendor field when ConnectHWWallet details lack it', () => {
      const scene = new TestWalletScene();
      scene.addWalletStarted({
        addMethod: 'ConnectHWWallet',
        details: {
          communication: 'USB',
          hardwareWalletType: 'Standard',
        },
        isSoftwareWalletOnlyUser: false,
      });
      const payload = scene.emissions[0].args[0] as {
        details: Record<string, unknown>;
      };
      expect(Object.keys(payload.details)).not.toContain('vendor');
    });
  });

  describe('walletAdded', () => {
    it('includes vendor on success path when ConnectHWWallet details carry it', () => {
      const scene = new TestWalletScene();
      scene.walletAdded({
        status: 'success',
        addMethod: 'ConnectHWWallet',
        details: {
          communication: 'USB',
          deviceType: EDeviceType.Pro,
          hardwareWalletType: 'Standard',
          vendor: EHardwareVendor.onekey,
        },
        isSoftwareWalletOnlyUser: false,
      });
      const payload = scene.emissions[0].args[0] as {
        details: { vendor?: string };
      };
      expect(payload.details.vendor).toBe('onekey');
    });

    it('includes vendor on failure path when ConnectHWWallet details carry it', () => {
      // Critical for Ledger funnel: previously the Ledger path didn't emit
      // failure events at all. Now it does, and the vendor field is what
      // makes the funnel comparison "Ledger fails X% / OneKey fails Y%"
      // possible in Mixpanel.
      const scene = new TestWalletScene();
      scene.walletAdded({
        status: 'failure',
        addMethod: 'ConnectHWWallet',
        details: {
          communication: 'Bluetooth',
          deviceType: EDeviceType.Unknown,
          hardwareWalletType: 'Standard',
          vendor: EHardwareVendor.ledger,
        },
        isSoftwareWalletOnlyUser: false,
      });
      const payload = scene.emissions[0].args[0] as {
        status: string;
        details: { vendor?: string };
      };
      expect(payload.status).toBe('failure');
      expect(payload.details.vendor).toBe('ledger');
    });

    it('omits vendor field when ConnectHWWallet details lack it', () => {
      // Defensive coverage: a stale caller (e.g. a not-yet-audited hidden
      // wallet variant) that doesn't pass vendor should produce events
      // without the vendor key, not events with `vendor: undefined`.
      const scene = new TestWalletScene();
      scene.walletAdded({
        status: 'success',
        addMethod: 'ConnectHWWallet',
        details: {
          communication: 'QRCode',
          deviceType: EDeviceType.Pro,
          hardwareWalletType: 'Hidden',
        },
        isSoftwareWalletOnlyUser: false,
      });
      const payload = scene.emissions[0].args[0] as {
        details: Record<string, unknown>;
      };
      expect(Object.keys(payload.details)).not.toContain('vendor');
    });

    it('does not add a vendor field for non-HW add methods', () => {
      // Schema sanity: vendor lives on ConnectHWWallet only. CreateWallet
      // / ImportWallet / Connect3rdPartyWallet branches must not gain a
      // vendor field even by accident.
      const scene = new TestWalletScene();
      scene.walletAdded({
        status: 'success',
        addMethod: 'CreateWallet',
        details: { isBiometricSet: true },
        isSoftwareWalletOnlyUser: true,
      });
      const payload = scene.emissions[0].args[0] as {
        details: Record<string, unknown>;
      };
      expect(payload.details).not.toHaveProperty('vendor');
    });
  });
});

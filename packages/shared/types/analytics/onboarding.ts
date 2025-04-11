import type { IBaseEventPayload } from './base';
import type { IDeviceType } from '@onekeyfe/hd-core';

// Specific parameter details for each add method
interface ICreateWalletPayload {
  isBiometricSet: boolean;
}

interface IImportWalletPayload {
  importSource:
    | 'mnemonic'
    | 'privateKey'
    | 'watchOnly'
    | 'keyTag'
    | 'cloud'
    | 'liteCard';
}

interface IConnectHardwareWalletPayload {
  connectionType?: 'USB' | 'Bluetooth' | 'WebUSB' | 'QRCode';
  deviceType: IDeviceType | undefined;
  firmwareVersions?: {
    bleVersion?: string;
    firmwareVersion?: string;
    bootloaderVersion?: string;
  };
  hardwareWalletType: 'Hidden' | 'Standard' | 'QRCode';
}

interface IConnectExternalWalletPayload {
  protocol: 'WalletConnect' | string;
  network: string;
  walletName?: string;
}

// Discriminated union type for the wallet events
export type IWalletAddMethod =
  | 'CreateWallet'
  | 'Import'
  | 'ConnectHardware'
  | 'Connect3rdParty';

export type IWalletStartedParams =
  | {
      addMethod: Extract<IWalletAddMethod, 'CreateWallet'>;
    }
  | {
      addMethod: Extract<IWalletAddMethod, 'Import'>;
      details: IImportWalletPayload;
    }
  | {
      addMethod: Extract<IWalletAddMethod, 'ConnectHardware'>;
      details: {
        hardwareWalletType: 'Hidden' | 'Standard' | 'QRCode';
      };
    };

export type IWalletAddedEventParams = IBaseEventPayload &
  (
    | {
        addMethod: Extract<IWalletAddMethod, 'CreateWallet'>;
        details: ICreateWalletPayload;
      }
    | {
        addMethod: Extract<IWalletAddMethod, 'Import'>;
        details: IImportWalletPayload;
      }
    | {
        addMethod: Extract<IWalletAddMethod, 'ConnectHardware'>;
        details: IConnectHardwareWalletPayload;
      }
    | {
        addMethod: Extract<IWalletAddMethod, 'Connect3rdParty'>;
        details: IConnectExternalWalletPayload;
      }
  );

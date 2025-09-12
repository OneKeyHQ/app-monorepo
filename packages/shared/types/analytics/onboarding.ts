import type { IBaseEventPayload } from './base';
import type { IDeviceType } from '@onekeyfe/hd-core';

// Specific parameter details for each add method
interface ICreateWalletPayload {
  isBiometricSet: boolean;
  unbackedUp?: boolean;
}

interface IImportWalletPayload {
  importType:
    | 'recoveryPhrase'
    | 'privateKey'
    | 'address'
    | 'keyTag'
    | 'cloud'
    | 'lite'
    | 'transfer';
}

type IHardwareTransportType = 'USB' | 'Bluetooth' | 'WebUSB' | 'QRCode';
interface IConnectHardwareWalletPayload {
  communication?: IHardwareTransportType;
  deviceType: IDeviceType | undefined;
  firmwareVersions?: {
    bleVersion?: string;
    firmwareVersion?: string;
    bootloaderVersion?: string;
  };
  hardwareWalletType: 'Hidden' | 'Standard';
}

export interface IConnectExternalWalletPayload {
  protocol: 'WalletConnect' | 'EIP6963' | 'EVMInjected' | 'unknown';
  network: string;
  walletName?: string;
}

// Discriminated union type for the wallet events
export type IWalletAddMethod =
  | 'CreateWallet'
  | 'ImportWallet'
  | 'ConnectHWWallet'
  | 'Connect3rdPartyWallet';

export type IWalletStartedParams =
  | {
      addMethod: Extract<IWalletAddMethod, 'CreateWallet'>;
      isSoftwareWalletOnlyUser: boolean;
      details: ICreateWalletPayload;
    }
  | {
      addMethod: Extract<IWalletAddMethod, 'ImportWallet'>;
      details: IImportWalletPayload;
      isSoftwareWalletOnlyUser: boolean;
    }
  | {
      addMethod: Extract<IWalletAddMethod, 'ConnectHWWallet'>;
      details: {
        communication?: IHardwareTransportType;
        hardwareWalletType: 'Hidden' | 'Standard';
      };
      isSoftwareWalletOnlyUser: boolean;
    }
  | {
      addMethod: Extract<IWalletAddMethod, 'Connect3rdPartyWallet'>;
      details: IConnectExternalWalletPayload;
      isSoftwareWalletOnlyUser: boolean;
    };

export type IWalletAddedEventParams = IBaseEventPayload &
  (
    | {
        addMethod: Extract<IWalletAddMethod, 'CreateWallet'>;
        details: ICreateWalletPayload;
        isSoftwareWalletOnlyUser: boolean;
      }
    | {
        addMethod: Extract<IWalletAddMethod, 'ImportWallet'>;
        details: IImportWalletPayload;
        isSoftwareWalletOnlyUser: boolean;
      }
    | {
        addMethod: Extract<IWalletAddMethod, 'ConnectHWWallet'>;
        details: IConnectHardwareWalletPayload;
        isSoftwareWalletOnlyUser: boolean;
      }
    | {
        addMethod: Extract<IWalletAddMethod, 'Connect3rdPartyWallet'>;
        details: IConnectExternalWalletPayload;
        isSoftwareWalletOnlyUser: boolean;
      }
  );

import { cloneDeep, isFunction } from 'lodash';

import { formatTime } from '@onekeyhq/shared/src/utils/dateUtils';

import type {
  IV4DBAccount,
  IV4DBDevice,
  IV4DBWallet,
} from './v4local/v4localDBTypesSchema';
import type { IDBAccount, IDBDevice, IDBWallet } from '../../dbs/local/types';

export class V4MigrationLogger {
  private logs: string[] = [];

  detailsWallet: {
    [v4walletId: string]: {
      v4wallet?: IV4DBWallet;
      v5wallet?: IDBWallet;

      v4device?: IV4DBDevice;
      v5device?: IDBDevice;
    };
  } = {};

  detailsAccount: {
    [v4accountId: string]: {
      v4account?: IV4DBAccount;
      v4accountFixed?: IV4DBAccount;
      v5account?: IDBAccount;
    };
  } = {};

  saveWalletDeviceDetailsV4({
    v4walletId,
    v4device,
  }: {
    v4walletId: string;
    v4device: IV4DBDevice;
  }) {
    try {
      //
      this.detailsWallet[v4walletId] = this.detailsWallet[v4walletId] || {};
      if (v4device)
        this.detailsWallet[v4walletId].v4device = cloneDeep(v4device);
    } catch (error) {
      //
    }
  }

  saveWalletDeviceDetailsV5({
    v4walletId,
    v5device,
  }: {
    v4walletId: string;
    v5device?: IDBDevice;
  }) {
    try {
      //
      this.detailsWallet[v4walletId] = this.detailsWallet[v4walletId] || {};
      if (v5device)
        this.detailsWallet[v4walletId].v5device = cloneDeep(v5device);
    } catch (error) {
      //
    }
  }

  saveWalletDetailsV4({
    v4walletId,
    v4wallet,
  }: {
    v4walletId: string;
    v4wallet: IV4DBWallet;
  }) {
    try {
      //
      this.detailsWallet[v4walletId] = this.detailsWallet[v4walletId] || {};
      if (v4wallet)
        this.detailsWallet[v4walletId].v4wallet = cloneDeep(v4wallet);
    } catch (error) {
      //
    }
  }

  saveWalletDetailsV5({
    v4walletId,
    v5wallet,
  }: {
    v4walletId: string;
    v5wallet?: IDBWallet;
  }) {
    try {
      //
      this.detailsWallet[v4walletId] = this.detailsWallet[v4walletId] || {};
      if (v5wallet)
        this.detailsWallet[v4walletId].v5wallet = cloneDeep(v5wallet);
    } catch (error) {
      //
    }
  }

  saveAccountDetailsV4({
    v4accountId,
    v4account,
    v4accountFixed,
  }: {
    v4accountId: string;
    v4account?: IV4DBAccount;
    v4accountFixed?: IV4DBAccount;
  }) {
    try {
      //
      this.detailsAccount[v4accountId] = this.detailsAccount[v4accountId] || {};
      if (v4account) {
        const item = cloneDeep(v4account);
        this.detailsAccount[v4accountId].v4account = item;
        return item;
      }
      if (v4accountFixed) {
        const item = cloneDeep(v4accountFixed);
        this.detailsAccount[v4accountId].v4accountFixed = item;
        return item;
      }
    } catch (error) {
      //
    }
  }

  saveAccountDetailsV5({
    v4accountId,
    v5account,
  }: {
    v4accountId: string;
    v5account?: IDBAccount;
  }) {
    try {
      this.detailsAccount[v4accountId] = this.detailsAccount[v4accountId] || {};
      if (v5account)
        this.detailsAccount[v4accountId].v5account = cloneDeep(v5account);
    } catch (error) {
      //
    }
  }

  log({
    name,
    type,
    payload,
  }: {
    name: string;
    type: 'info' | 'call' | 'success' | 'result' | 'error';
    payload?: string;
  }) {
    try {
      this.logs.push(
        `${formatTime(new Date(), {
          // hideSeconds: true,
        })} [${name}] #${type}# ${payload || ''}`,
      );
    } catch (error) {
      //
    }
  }

  getLogs() {
    return {
      logs: this.logs,
      detailsAccount: this.detailsAccount,
      detailsWallet: this.detailsWallet,
    };
  }

  clearLogs() {
    this.logs = [];
    this.detailsAccount = {};
    this.detailsWallet = {};
  }

  async runAsyncWithCatch<T>(
    fn: () => Promise<T>,
    {
      name,
      logResultFn,
      logErrorFn = (error) => error?.message || 'error',
      errorResultFn = 'throwError',
      logErrorOnly,
    }: {
      name: string;
      logResultFn?: (result: T) => string;
      logErrorFn?: (error: Error | undefined) => string;
      errorResultFn: (() => T) | 'throwError';
      logErrorOnly?: boolean;
    },
  ): Promise<T> {
    try {
      if (!logErrorOnly) {
        this.log({ name, type: 'call' });
      }

      //
      const result = await fn();
      //

      if (!logErrorOnly) {
        this.log({ name, type: 'success' });
      }
      if (!logErrorOnly && logResultFn) {
        try {
          this.log({ name, type: 'result', payload: logResultFn(result) });
        } catch (error) {
          //
        }
      }
      return result;
    } catch (error) {
      this.log({ name, type: 'error', payload: logErrorFn(error as Error) });
      if (errorResultFn === 'throwError') {
        throw error;
      }
      if (isFunction(errorResultFn)) {
        // eslint-disable-next-line no-useless-catch
        try {
          return errorResultFn();
        } catch (error1) {
          throw error1;
        }
      }
      throw error;
    }
  }
}

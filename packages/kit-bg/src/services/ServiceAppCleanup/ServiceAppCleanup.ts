import { debounce } from 'lodash';

import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import localDb from '../../dbs/local/localDb';
import simpleDb from '../../dbs/simple/simpleDb';
import ServiceBase from '../ServiceBase';

import type { IDBAccount, IDBIndexedAccount } from '../../dbs/local/types';

class ServiceAppCleanup extends ServiceBase {
  // Debounced so bulk wallet removal (which fires many AccountRemove events)
  // coalesces into a single sweep. Bypasses the isCleanupTime() daily gate —
  // post-deletion cleanup should be prompt.
  private cleanupOrphanedAssetCachesDebounced = debounce(() => {
    void this.cleanupOrphanedAssetCaches();
  }, 3000);

  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
    // Reclaim orphaned per-account asset caches promptly after a deletion. The
    // daily-gated cleanup() also runs the same sweep to reclaim orphans that
    // accumulated before this listener existed.
    appEventBus.on(EAppEventBusNames.AccountRemove, () => {
      this.cleanupOrphanedAssetCachesDebounced();
    });
    appEventBus.on(EAppEventBusNames.WalletRemove, () => {
      this.cleanupOrphanedAssetCachesDebounced();
    });
  }

  async isCleanupTime() {
    const appCleanupData = await simpleDb.appCleanup.getRawData();
    const lastCleanupTime = appCleanupData?.lastCleanupTime;
    const currentTime = Date.now();
    if (
      lastCleanupTime &&
      currentTime - lastCleanupTime <
        timerUtils.getTimeDurationMs({
          day: 1,
        })
    ) {
      return false;
    }
    return true;
  }

  async updateCleanupTime() {
    await simpleDb.appCleanup.setRawData((v) => ({
      ...v,
      lastCleanupTime: Date.now(),
    }));
  }

  @backgroundMethod()
  async clearCleanupTime() {
    await simpleDb.appCleanup.setRawData((v) => ({
      ...v,
      lastCleanupTime: undefined,
    }));
  }

  @backgroundMethod()
  async cleanup(
    params: {
      accountsRemoved: IDBAccount[] | undefined;
      indexedAccountsRemoved: IDBIndexedAccount[] | undefined;
    } = {
      accountsRemoved: undefined,
      indexedAccountsRemoved: undefined,
    },
  ) {
    const isCleanupTime = await this.isCleanupTime();
    if (!isCleanupTime && !platformEnv.isDev) {
      return;
    }
    await this.updateCleanupTime();

    // **** cleanup accounts
    await this.cleanupAccounts(params.accountsRemoved);

    // **** cleanup indexed accounts
    await this.cleanupIndexedAccounts(params.indexedAccountsRemoved);

    // **** cleanup credentials
    // The number of private key and mnemonic wallets will not be many, so we don't clean up here
    // await this.cleanupCredentials();

    // **** cleanup HyperLiquid agent credentials
    // await this.cleanupHyperLiquidAgentCredentials();

    // **** cleanup orphaned per-account asset caches (tokens / tx history / nft /
    // defi / aggregate token / account value) left behind by deleted accounts and
    // wallets, plus size/age caps on the uncapped maps.
    await this.runCleanupTask(async () => {
      await this.cleanupOrphanedAssetCaches();
    });

    // **** cleanup sign messages history
    // **** cleanup sign transactions history
    // **** cleanup connected sites history
    // TODO export log with connected sites records counts

    // **** cleanup not keep hidden wallets

    // **** cleanup device which not associated with any wallet

    return {
      success: true,
    };
  }

  // Sweep simpleDb caches that are keyed per-account/per-network, dropping keys
  // that no longer map to a surviving account. Self-derives the valid set from
  // getAllAccounts, so it does not depend on which account was just removed (the
  // AccountRemove event carries no payload). Over-/under-matching is benign: every
  // touched entity is a pure cache the normal refresh repopulates.
  //
  // Capping strategy (why some maps get an extra size cap and others don't) —
  // growth is bounded on two independent axes:
  //   • Horizontal (number of account/owner keys): the orphan sweep below drops
  //     keys for deleted accounts. Every per-account entity (tokenList, DeFi
  //     overview, aggregateToken, history, accountValue) relies on this ALONE —
  //     each per-account payload is naturally small (bounded by what one account
  //     holds) and a removed account's keys are reclaimed wholesale, so no
  //     per-array cap is warranted.
  //   • Vertical (entries inside a single key): only two maps add a size cap on
  //     top of the sweep, because the sweep cannot bound them:
  //       - localTokens.data — GLOBAL token metadata keyed by
  //         networkId_tokenAddress and shared across accounts, so it has no owner
  //         to orphan-filter → capped to the most-recent 5000 entries.
  //       - localNFTs.list — per-account, but one NFT-whale account alone can
  //         hold thousands of entries that each embed a full-resolution image URL
  //         + attributes → capped to 500 per account.
  //     The other per-account lists are deliberately NOT vertically capped.
  //   localHistory.confirmedTxs keeps its pre-existing 50-per-account cap;
  //   pendingTxs is intentionally left uncapped (ServiceFreshAddress reads it to
  //   avoid BTC address reuse — see removeOrphanData).
  @backgroundMethod()
  async cleanupOrphanedAssetCaches() {
    try {
      // Derive the keep-set from the RAW DB enumeration (localDb), NOT
      // serviceAccount.getAllAccounts({ filterRemoved: true }). The latter drops
      // (a) locked passphrase/hidden wallets (isTempWalletRemoved — their rows
      // are still on disk, this session just hasn't entered the passphrase) and
      // (b) the URL account (isUrlAccountFn). Both still physically exist, so
      // their caches — including localHistory.pendingTxs that ServiceFreshAddress
      // reads to avoid BTC address reuse — must NOT be treated as orphans.
      // localDb returns every account row, so the only keys dropped are those
      // with no surviving row at all.
      //
      // A genuine enumeration failure throws and is caught below (sweep skipped,
      // caches kept). A successful empty result is NOT a failure — the user has
      // zero accounts (e.g. just deleted their last one), so we proceed and drop
      // every per-account key. Do NOT early-return on empty, or deleting the last
      // account would leave its caches behind forever.
      const [{ accounts }, { indexedAccounts: allIndexedAccounts }] =
        await Promise.all([
          localDb.getAllAccounts(),
          localDb.getAllIndexedAccounts(),
        ]);

      const validOwners: string[] = [];
      const validAccountIds: string[] = [];
      for (const account of accounts) {
        if (account.address) {
          validOwners.push(account.address);
        }
        // The cache key uses `(xpub || address)`; nested-segwit (P2SH-P2WPKH)
        // accounts key by `xpubSegwit`. Push every variant — plus any per-network
        // addresses some account types hold in `addresses` — so a live account's
        // cache is never wrongly treated as orphaned. (A false drop only costs a
        // re-fetch, but minimizing churn is cheap here.)
        const { xpub, xpubSegwit, addresses } = account as {
          xpub?: string;
          xpubSegwit?: string;
          addresses?: Record<string, string>;
        };
        if (xpub) {
          validOwners.push(xpub);
        }
        if (xpubSegwit) {
          validOwners.push(xpubSegwit);
        }
        if (addresses) {
          for (const addr of Object.values(addresses)) {
            if (typeof addr === 'string' && addr) {
              validOwners.push(addr);
            }
          }
        }
        validAccountIds.push(account.id);
        if (account.indexedAccountId) {
          validAccountIds.push(account.indexedAccountId);
        }
      }
      for (const indexedAccount of allIndexedAccounts ?? []) {
        validAccountIds.push(indexedAccount.id);
      }

      const tasks: [string, Promise<unknown>][] = [
        ['localTokens', simpleDb.localTokens.removeOrphanData({ validOwners })],
        [
          'localHistory',
          simpleDb.localHistory.removeOrphanData({ validOwners }),
        ],
        ['localNFTs', simpleDb.localNFTs.removeOrphanData({ validOwners })],
        ['deFi', simpleDb.deFi.removeOrphanData({ validOwners })],
        [
          'accountValue',
          simpleDb.accountValue.removeOrphanData({ validOwners }),
        ],
        [
          'aggregateToken',
          simpleDb.aggregateToken.removeOrphanData({ validAccountIds }),
        ],
      ];
      const results = await Promise.allSettled(tasks.map(([, p]) => p));
      results.forEach((r, i) => {
        if (r.status === 'rejected') {
          defaultLogger.app.error.log(
            `cleanupOrphanedAssetCaches: ${tasks[i][0]} cleanup failed: ${String(
              r.reason,
            )}`,
          );
        }
      });
    } catch (error) {
      defaultLogger.app.error.log(
        `cleanupOrphanedAssetCaches error: ${String(error)}`,
      );
    }
  }

  async cleanupAccounts(accountsRemoved?: IDBAccount[]) {
    await this.runCleanupTask(async () => {
      if (!accountsRemoved) {
        // eslint-disable-next-line no-param-reassign
        ({ accountsRemoved } =
          await this.backgroundApi.serviceAccount.getAllAccounts({
            filterRemoved: true,
          }));
      }
      if (accountsRemoved?.length) {
        await localDb.removeAccounts({ accounts: accountsRemoved });
      }
    });
  }

  async cleanupIndexedAccounts(indexedAccountsRemoved?: IDBIndexedAccount[]) {
    await this.runCleanupTask(async () => {
      if (!indexedAccountsRemoved) {
        // eslint-disable-next-line no-param-reassign
        ({ indexedAccountsRemoved } =
          await this.backgroundApi.serviceAccount.getAllIndexedAccounts({
            filterRemoved: true,
          }));
      }
      if (indexedAccountsRemoved.length) {
        await localDb.removeIndexedAccounts({
          indexedAccounts: indexedAccountsRemoved,
        });
      }
    });
  }

  async cleanupCredentials() {
    await this.runCleanupTask(async () => {
      const { credentialsRemoved } =
        await this.backgroundApi.serviceAccount.getAllCredentials();
      if (credentialsRemoved.length) {
        await localDb.removeCredentials({ credentials: credentialsRemoved });
      }
    });
  }

  async cleanupHyperLiquidAgentCredentials() {
    await this.runCleanupTask(async () => {
      // Scan all orphaned HyperLiquid agent credentials and cleanup
      await this.backgroundApi.serviceAccount.cleanupOrphanedHyperLiquidAgentCredentials(
        {},
      );
    });
  }

  async runCleanupTask(fn: () => Promise<void>) {
    await timerUtils.setTimeoutPromised(async () => {
      try {
        await fn();
      } catch (error) {
        console.error(error);
      }
    });
  }
}

export default ServiceAppCleanup;

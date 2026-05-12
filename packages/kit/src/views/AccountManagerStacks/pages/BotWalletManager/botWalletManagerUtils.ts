import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import {
  BOT_WALLET_STATUS_ACTIVE,
  BOT_WALLET_STATUS_DEACTIVATED,
} from '@onekeyhq/shared/src/consts/dbConsts';
import type {
  IBotWalletMetadata,
  IBotWalletStatus,
} from '@onekeyhq/shared/types/botWallet';

export type IBotWalletEntry = {
  wallet: IDBWallet;
  metadata: IBotWalletMetadata;
};

export type IBotWalletSection = {
  title?: string;
  data: IBotWalletEntry[];
};

export type IBotWalletListItemAction =
  | 'export-mnemonic'
  | 'visibility'
  | 'deactivate'
  | 'reactivate';

const BOT_WALLET_SECTION_TITLE_BY_STATUS: Record<IBotWalletStatus, string> = {
  [BOT_WALLET_STATUS_ACTIVE]: 'Bot 钱包',
  [BOT_WALLET_STATUS_DEACTIVATED]: '已停用',
};

const BOT_WALLET_ACTIONS_BY_STATUS: Record<
  IBotWalletStatus,
  IBotWalletListItemAction[]
> = {
  [BOT_WALLET_STATUS_ACTIVE]: ['export-mnemonic', 'visibility', 'deactivate'],
  [BOT_WALLET_STATUS_DEACTIVATED]: ['visibility', 'reactivate'],
};

export function getBotWalletListItemActions(
  status: IBotWalletStatus,
): IBotWalletListItemAction[] {
  return BOT_WALLET_ACTIONS_BY_STATUS[status] ?? [];
}

export function buildBotWalletSections(
  entries: IBotWalletEntry[],
): IBotWalletSection[] {
  const sortByIndex = (items: IBotWalletEntry[]) =>
    items.toSorted((a, b) => a.metadata.index - b.metadata.index);

  return [
    {
      // title: BOT_WALLET_SECTION_TITLE_BY_STATUS[BOT_WALLET_STATUS_ACTIVE],
      data: sortByIndex(
        entries.filter(
          (entry) => entry.metadata.status === BOT_WALLET_STATUS_ACTIVE,
        ),
      ),
    },
    {
      title: BOT_WALLET_SECTION_TITLE_BY_STATUS[BOT_WALLET_STATUS_DEACTIVATED],
      data: sortByIndex(
        entries.filter(
          (entry) => entry.metadata.status === BOT_WALLET_STATUS_DEACTIVATED,
        ),
      ),
    },
  ].filter((section) => section.data.length > 0);
}

export function updateBotWalletEntryMetadata(
  entries: IBotWalletEntry[],
  walletId: string,
  metadataPatch: Partial<IBotWalletMetadata>,
): IBotWalletEntry[] {
  return entries.map((entry) =>
    entry.wallet.id === walletId
      ? {
          ...entry,
          metadata: {
            ...entry.metadata,
            ...metadataPatch,
          },
        }
      : entry,
  );
}

export function formatBotWalletBadgeLabel(entry: IBotWalletEntry): string {
  const indexLabel = `No.${entry.metadata.index + 1}`;
  const walletHashPrefix = entry.wallet.hash?.slice(0, 8);

  return walletHashPrefix ? `${indexLabel} (${walletHashPrefix})` : indexLabel;
}

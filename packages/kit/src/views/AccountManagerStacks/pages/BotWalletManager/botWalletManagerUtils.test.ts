import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import {
  BOT_WALLET_STATUS_ACTIVE,
  BOT_WALLET_STATUS_DEACTIVATED,
} from '@onekeyhq/shared/src/consts/dbConsts';

import {
  type IBotWalletEntry,
  buildBotWalletSections,
  formatBotWalletBadgeLabel,
  getBotWalletListItemActions,
  updateBotWalletEntryMetadata,
} from './botWalletManagerUtils';

function createEntry({
  walletId,
  index,
  status,
  visible = true,
  hash,
}: {
  walletId: string;
  index: number;
  status:
    | typeof BOT_WALLET_STATUS_ACTIVE
    | typeof BOT_WALLET_STATUS_DEACTIVATED;
  visible?: boolean;
  hash?: string;
}): IBotWalletEntry {
  return {
    wallet: {
      id: walletId,
      name: `Wallet ${index}`,
      backuped: true,
      hash,
    } as IDBWallet,
    metadata: {
      index,
      name: `Bot #${index + 1}`,
      visible,
      status,
      createdAt: 1_743_000_000_000 + index,
    },
  };
}

describe('botWalletManagerUtils', () => {
  it('builds active and deactivated sections in fixed order', () => {
    const sections = buildBotWalletSections([
      createEntry({
        walletId: 'bot--3',
        index: 2,
        status: BOT_WALLET_STATUS_ACTIVE,
      }),
      createEntry({
        walletId: 'bot--2',
        index: 1,
        status: BOT_WALLET_STATUS_DEACTIVATED,
      }),
      createEntry({
        walletId: 'bot--1',
        index: 0,
        status: BOT_WALLET_STATUS_ACTIVE,
      }),
    ]);

    expect(sections.map((section) => section.title)).toEqual([
      undefined,
      '已停用',
    ]);
    expect(sections[0].data.map((entry) => entry.wallet.id)).toEqual([
      'bot--1',
      'bot--3',
    ]);
    expect(sections[1].data.map((entry) => entry.wallet.id)).toEqual([
      'bot--2',
    ]);
  });

  it('returns status-specific action visibility', () => {
    expect(getBotWalletListItemActions(BOT_WALLET_STATUS_ACTIVE)).toEqual([
      'export-mnemonic',
      'visibility',
      'deactivate',
    ]);
    expect(getBotWalletListItemActions(BOT_WALLET_STATUS_DEACTIVATED)).toEqual([
      'visibility',
      'reactivate',
    ]);
  });

  it('moves a wallet between sections when status changes', () => {
    const activeSections = buildBotWalletSections([
      createEntry({
        walletId: 'bot--1',
        index: 0,
        status: BOT_WALLET_STATUS_ACTIVE,
      }),
    ]);
    const deactivatedSections = buildBotWalletSections([
      createEntry({
        walletId: 'bot--1',
        index: 0,
        status: BOT_WALLET_STATUS_DEACTIVATED,
      }),
    ]);

    expect(activeSections).toHaveLength(1);
    expect(activeSections[0].title).toBeUndefined();
    expect(activeSections[0].data[0].wallet.id).toBe('bot--1');

    expect(deactivatedSections).toHaveLength(1);
    expect(deactivatedSections[0].title).toBe('已停用');
    expect(deactivatedSections[0].data[0].wallet.id).toBe('bot--1');
  });

  it('updates target wallet metadata without changing other entries', () => {
    const entries = [
      createEntry({
        walletId: 'bot--1',
        index: 0,
        status: BOT_WALLET_STATUS_ACTIVE,
      }),
      createEntry({
        walletId: 'bot--2',
        index: 1,
        status: BOT_WALLET_STATUS_ACTIVE,
      }),
    ];

    const nextEntries = updateBotWalletEntryMetadata(entries, 'bot--2', {
      visible: false,
      status: BOT_WALLET_STATUS_DEACTIVATED,
    });

    expect(nextEntries[0]).toBe(entries[0]);
    expect(nextEntries[1]).not.toBe(entries[1]);
    expect(nextEntries[1].metadata.visible).toBe(false);
    expect(nextEntries[1].metadata.status).toBe(BOT_WALLET_STATUS_DEACTIVATED);
  });

  it('formats badge label with wallet hash prefix when available', () => {
    expect(
      formatBotWalletBadgeLabel(
        createEntry({
          walletId: 'bot--1',
          index: 0,
          status: BOT_WALLET_STATUS_ACTIVE,
          hash: '1234567890abcdef',
        }),
      ),
    ).toBe('No.1 (12345678)');
  });

  it('falls back to index-only badge label when wallet hash is missing', () => {
    expect(
      formatBotWalletBadgeLabel(
        createEntry({
          walletId: 'bot--1',
          index: 0,
          status: BOT_WALLET_STATUS_ACTIVE,
        }),
      ),
    ).toBe('No.1');
  });
});

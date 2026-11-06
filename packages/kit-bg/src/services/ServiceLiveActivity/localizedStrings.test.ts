import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';

import { getLiveActivityLocalizedStrings } from './localizedStrings';

const defaultLocale = appLocale.intl.locale;
const defaultMessages = appLocale.intl.messages;

afterEach(() => appLocale.setLocale(defaultLocale, defaultMessages));

it('uses the current App language and updates the network names and timestamp', () => {
  const directory = path.join(process.cwd(), 'packages/shared/src/locale/json');
  const load = (name: string): Record<string, string> =>
    JSON.parse(
      readFileSync(path.join(directory, `${name}.json`), 'utf8'),
    ) as Record<string, string>;
  const args = {
    fromNetworkName: 'Bitcoin',
    toNetworkName: 'Ethereum',
    updatedAtMs: 1_700_000_000_000,
  };
  appLocale.setLocale('en-US', load('en_US'));
  const english = getLiveActivityLocalizedStrings(args);
  expect(english.done).toBe('Done');
  expect(english.confirmingFrom).toContain('Bitcoin');
  expect(english.confirmingTo).toContain('Ethereum');
  expect(english.lastUpdated).toContain('Last updated');
  expect(english.etaTemplate).toBe('~{number} min');
  appLocale.setLocale('zh-CN', load('zh_CN'));
  const chinese = getLiveActivityLocalizedStrings(args);
  expect(chinese.done).toBe('完成');
  expect(chinese.lastUpdated).toContain('最后更新');
  expect(chinese.etaTemplate).toBe('~{number} 分钟');
});

it('provides all strings and preserves the minute placeholder in every bundled locale', () => {
  const directory = path.join(process.cwd(), 'packages/shared/src/locale/json');
  const files = readdirSync(directory).filter((name) => name.endsWith('.json'));
  expect(files.length).toBeGreaterThan(1);
  for (const file of files) {
    const messages: Record<string, string> = JSON.parse(
      readFileSync(path.join(directory, file), 'utf8'),
    );
    const required = [
      'global.done',
      'global.failed',
      'swap_history.status_canceled',
      'swap_history.status_pending',
      'swap_history_detail.badge_refunded',
      'swap_history_detail.badge_refunding',
      'swap_page.toast.swap_failed',
      'live_swap_almost_complete',
      'live_swap_bitcoin_confirmation_status',
      'receive_arrival_time_min',
      'market.last_updated',
    ];
    for (const key of required) expect(messages[key]?.trim()).toBeTruthy();
    expect(
      messages.live_swap_bitcoin_confirmation_status.split('{networkName}'),
    ).toHaveLength(2);
    expect(messages.receive_arrival_time_min.split('{number}')).toHaveLength(2);
    appLocale.setLocale(file.replace('.json', '').replace('_', '-'), messages);
    const strings = getLiveActivityLocalizedStrings({
      fromNetworkName: 'Bitcoin',
      toNetworkName: 'Ethereum',
      updatedAtMs: 1_700_000_000_000,
    });
    expect(strings.confirmingFrom).toContain('Bitcoin');
    expect(strings.confirmingTo).toContain('Ethereum');
    expect(strings.etaTemplate.split('{number}')).toHaveLength(2);
    for (const value of Object.values(strings))
      expect(value.trim()).toBeTruthy();
    const longNames = getLiveActivityLocalizedStrings({
      fromNetworkName: '🟠'.repeat(1000),
      toNetworkName: '🟠'.repeat(1000),
      updatedAtMs: 1_700_000_000_000,
    });
    expect(
      Buffer.byteLength(
        JSON.stringify({
          status: 'confirming',
          updatedAtMs: 1_700_000_000_000,
          revision: 1_700_000_000_000,
          displayPhase: 'eta',
          etaMinutes: 10,
          almostDone: false,
          strings: longNames,
        }),
        'utf8',
      ),
    ).toBeLessThan(4096);
  }
});

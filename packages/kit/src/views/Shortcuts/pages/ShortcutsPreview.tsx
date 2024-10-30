import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Page, Shortcut } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { Section } from '@onekeyhq/kit/src/components/Section';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EShortcutEvents,
  shortcutsMap,
} from '@onekeyhq/shared/src/shortcuts/shortcuts.enum';
import { shortcutsKeys } from '@onekeyhq/shared/src/shortcuts/shortcutsKeys.enum';

const sections = [
  {
    titleId: ETranslations.global_general,
    items: [
      {
        titleId: ETranslations.shortcuts_account_selector,
        shortcutKey: EShortcutEvents.AccountSelector,
      },
      {
        titleId: ETranslations.shortcuts_network_selector,
        shortcutKey: EShortcutEvents.NetworkSelector,
      },
      {
        titleId: ETranslations.settings_settings,
        keys: [shortcutsKeys.CmdOrCtrl, ','],
      },
      {
        titleIds: [
          ETranslations.shortcut_show_sidebar,
          ETranslations.shortcut_hide_sidebar,
        ],
        shortcutKey: EShortcutEvents.SideBar,
      },
      {
        titleId: ETranslations.shortcuts_go_to_wallet_tab,
        shortcutKey: EShortcutEvents.TabWallet,
      },
      {
        titleId: ETranslations.shortcuts_go_to_earn_tab,
        shortcutKey: EShortcutEvents.TabEarn,
      },
      {
        titleId: ETranslations.shortcuts_go_to_swap_tab,
        shortcutKey: EShortcutEvents.TabSwap,
      },
      {
        titleId: ETranslations.shortcuts_go_to_market_tab,
        shortcutKey: EShortcutEvents.TabMarket,
      },
      {
        titleId: ETranslations.shortcuts_go_to_browser_tab,
        shortcutKey: EShortcutEvents.TabBrowser,
      },
      {
        titleId: ETranslations.settings_lock_now,
        keys: [shortcutsKeys.CmdOrCtrl, shortcutsKeys.Shift, 'L'],
      },
      {
        titleId: ETranslations.global_quit,
        keys: [shortcutsKeys.CmdOrCtrl, 'Q'],
      },
    ],
  },
  {
    titleId: ETranslations.global_browser,
    items: [
      {
        titleId: ETranslations.explore_new_tab,
        shortcutKey: EShortcutEvents.NewTab,
      },
      {
        titleId: ETranslations.global_refresh,
        shortcutKey: EShortcutEvents.Refresh,
      },
      {
        titleId: ETranslations.shortcut_go_forward,
        shortcutKey: EShortcutEvents.GoForwardHistory,
      },
      {
        titleId: ETranslations.shortcut_go_back,
        shortcutKey: EShortcutEvents.GoBackHistory,
      },
      {
        titleId: ETranslations.global_copy_url,
        shortcutKey: EShortcutEvents.CopyAddressOrUrl,
      },
      {
        titleId: ETranslations.shortcuts_close_current_tab,
        shortcutKey: EShortcutEvents.CloseTab,
      },
      {
        titleId: ETranslations.explore_bookmarks,
        shortcutKey: EShortcutEvents.ViewBookmark,
      },
      {
        titleIds: [
          ETranslations.explore_add_bookmark,
          ETranslations.explore_remove_bookmark,
        ],
        shortcutKey: EShortcutEvents.AddOrRemoveBookmark,
      },
      {
        titleId: ETranslations.explore_history,
        shortcutKey: EShortcutEvents.ViewHistory,
      },
      {
        titleIds: [
          ETranslations.global_pin_to_top,
          ETranslations.global_unpin_from_top,
        ],
        shortcutKey: EShortcutEvents.PinOrUnpinTab,
      },
      {
        titleId: ETranslations.global_copy_url,
        shortcutKey: EShortcutEvents.CopyAddressOrUrl,
      },
    ],
  },
];

function ShortcutItem({
  titleId,
  titleIds,
  keys,
  shortcutKey,
}: {
  titleId?: ETranslations;
  titleIds?: ETranslations[];
  keys?: string[];
  shortcutKey?: EShortcutEvents;
}) {
  const intl = useIntl();
  const title = useMemo(
    () =>
      titleIds
        ? titleIds.map((id) => intl.formatMessage({ id })).join(' / ')
        : intl.formatMessage({ id: titleId }),
    [intl, titleId, titleIds],
  );
  const sKeys = useMemo(
    () => (shortcutKey ? shortcutsMap[shortcutKey].keys : keys),
    [keys, shortcutKey],
  );
  return (
    <ListItem title={title}>
      <Shortcut>
        {sKeys?.map((key) => (
          <Shortcut.Key key={key}>{key}</Shortcut.Key>
        ))}
      </Shortcut>
    </ListItem>
  );
}

function ShortcutsPreview() {
  const intl = useIntl();
  return (
    <Page scrollEnabled>
      <Page.Header
        headerTitle={intl.formatMessage({
          id: ETranslations.settings_shortcuts,
        })}
      />
      <Page.Body userSelect="none">
        {sections.map(({ titleId, items }) => (
          <Section title={intl.formatMessage({ id: titleId })} key={titleId}>
            {items.map(
              ({ titleId: subTitleId, keys, titleIds, shortcutKey }) => (
                <ShortcutItem
                  key={subTitleId}
                  titleId={subTitleId}
                  keys={keys}
                  titleIds={titleIds}
                  shortcutKey={shortcutKey}
                />
              ),
            )}
          </Section>
        ))}
      </Page.Body>
    </Page>
  );
}

export default ShortcutsPreview;

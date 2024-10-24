import { useIntl } from 'react-intl';

import { Page, Shortcut } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { Section } from '@onekeyhq/kit/src/components/Section';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { shortcutsKeys } from '@onekeyhq/shared/src/shortcuts/shortcutsKeys.enum';

const sections = [
  {
    titleId: ETranslations.global_general,
    items: [
      {
        titleId: ETranslations.global_search_account_selector,
        keys: [shortcutsKeys.CmdOrCtrl, 'P'],
      },
      {
        titleId: ETranslations.network_selector_unavailable_networks,
        keys: [shortcutsKeys.CmdOrCtrl, 'O'],
      },
      {
        titleId: ETranslations.global_search,
        keys: [shortcutsKeys.CmdOrCtrl, 'F'],
      },
      {
        titleId: ETranslations.settings_settings,
        keys: [shortcutsKeys.CmdOrCtrl, ','],
      },
      {
        titleId: ETranslations.global_copy_address,
        keys: [shortcutsKeys.CmdOrCtrl, shortcutsKeys.Shift, 'C'],
      },
      {
        titleId: ETranslations.open_as_sidebar,
        keys: [shortcutsKeys.CmdOrCtrl, 'S'],
      },
      {
        titleId: ETranslations.global_wallet,
        keys: [shortcutsKeys.CmdOrCtrl, '1'],
      },
      {
        titleId: ETranslations.global_earn,
        keys: [shortcutsKeys.CmdOrCtrl, '2'],
      },
      {
        titleId: ETranslations.global_swap,
        keys: [shortcutsKeys.CmdOrCtrl, '3'],
      },
      {
        titleId: ETranslations.global_market,
        keys: [shortcutsKeys.CmdOrCtrl, '4'],
      },
      {
        titleId: ETranslations.global_browser,
        keys: [shortcutsKeys.CmdOrCtrl, '5'],
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
        keys: [shortcutsKeys.CmdOrCtrl, 'T'],
      },
      {
        titleId: ETranslations.global_refresh,
        keys: [shortcutsKeys.CmdOrCtrl, 'R'],
      },
      {
        titleId: ETranslations.global_close,
        keys: [shortcutsKeys.CmdOrCtrl, 'W'],
      },
      {
        titleId: ETranslations.explore_open_in_browser,
        keys: [shortcutsKeys.CmdOrCtrl, shortcutsKeys.Shift, 'T'],
      },
      {
        titleId: ETranslations.explore_add_bookmark,
        keys: [shortcutsKeys.CmdOrCtrl, 'D'],
      },
      {
        titleId: ETranslations.global_pin_to_top,
        keys: [shortcutsKeys.CmdOrCtrl, shortcutsKeys.Shift, 'P'],
      },
      {
        titleId: ETranslations.global_copy_url,
        keys: [shortcutsKeys.CmdOrCtrl, shortcutsKeys.Shift, 'C'],
      },
      {
        titleId: ETranslations.explore_tab_prompt,
        keys: [shortcutsKeys.CmdOrCtrl, shortcutsKeys.Alt, shortcutsKeys.Up],
      },
      {
        titleId: ETranslations.explore_tab_prompt,
        keys: [shortcutsKeys.CmdOrCtrl, shortcutsKeys.Alt, shortcutsKeys.Down],
      },
      {
        titleId: ETranslations.explore_tab_prompt,
        keys: [shortcutsKeys.CmdOrCtrl, shortcutsKeys.Right],
      },
      {
        titleId: ETranslations.global_backup,
        keys: [shortcutsKeys.CmdOrCtrl, shortcutsKeys.Left],
      },
      {
        titleId: ETranslations.explore_history,
        keys: [shortcutsKeys.CmdOrCtrl, 'Y'],
      },
      {
        titleId: ETranslations.explore_bookmarks,
        keys: [shortcutsKeys.CmdOrCtrl, shortcutsKeys.Shift, 'B'],
      },
    ],
  },
];

function ShortcutsPreview() {
  const intl = useIntl();
  return (
    <Page scrollEnabled>
      <Page.Header headerTitle="Shortcuts" />
      <Page.Body userSelect="none">
        {sections.map(({ titleId, items }) => (
          <Section title={intl.formatMessage({ id: titleId })} key={titleId}>
            {items.map(({ titleId: subTitleId, keys }) => (
              <ListItem
                title={intl.formatMessage({ id: subTitleId })}
                key={subTitleId}
              >
                <Shortcut>
                  {keys.map((key) => (
                    <Shortcut.Key key={key}>{key}</Shortcut.Key>
                  ))}
                </Shortcut>
              </ListItem>
            ))}
            <ListItem title="Account Selector">
              <Shortcut>
                <Shortcut.Key>{shortcutsKeys.CmdOrCtrl}</Shortcut.Key>
                <Shortcut.Key>P</Shortcut.Key>
              </Shortcut>
            </ListItem>
          </Section>
        ))}
      </Page.Body>
    </Page>
  );
}

export default ShortcutsPreview;

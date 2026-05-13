import { useIntl } from 'react-intl';

import { SearchBar, Shortcut, View, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EShortcutEvents } from '@onekeyhq/shared/src/shortcuts/shortcuts.enum';

import { withBrowserProvider } from '../../pages/Browser/WithBrowserProvider';
import { DiscoveryTestIDs } from '../../testIDs';

interface ICustomHeaderRightProps {
  handleSearchBarPress: (url: string) => void;
}

function CustomHeaderSearch({ handleSearchBarPress }: ICustomHeaderRightProps) {
  const intl = useIntl();

  return (
    <XStack $gtMd={{ minWidth: 280 }}>
      <SearchBar
        testID={DiscoveryTestIDs.searchBar}
        placeholder={intl.formatMessage({
          id: ETranslations.browser_search_dapp_or_enter_url,
        })}
        containerProps={{ w: '100%' }}
        $gtMd={{ size: 'small' }}
        key="MarketHomeSearchInput"
        {...(platformEnv.isDesktop
          ? {
              addOns: [
                {
                  label: (
                    <Shortcut
                      alignSelf="center"
                      shortcutKey={EShortcutEvents.SearchInPage}
                    />
                  ),
                },
              ],
            }
          : {})}
      />
      <View
        position="absolute"
        top={0}
        left={0}
        right={0}
        bottom={0}
        onPress={() => handleSearchBarPress('')}
      />
    </XStack>
  );
}

export default withBrowserProvider<ICustomHeaderRightProps>(CustomHeaderSearch);

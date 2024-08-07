import { useIntl } from 'react-intl';

import { SearchBar, Shortcut, View, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { shortcutsKeys } from '@onekeyhq/shared/src/shortcuts/shortcutsKeys.enum';

import { withBrowserProvider } from '../../pages/Browser/WithBrowserProvider';

interface ICustomHeaderRightProps {
  handleSearchBarPress: (url: string) => void;
}

function CustomHeaderSearch({ handleSearchBarPress }: ICustomHeaderRightProps) {
  const intl = useIntl();

  return (
    <XStack $gtMd={{ minWidth: 280 }}>
      <SearchBar
        placeholder={intl.formatMessage({
          id: ETranslations.explore_search_dapps,
        })}
        containerProps={{ w: '100%' }}
        $gtMd={{ size: 'small' }}
        key="MarketHomeSearchInput"
        addOns={[
          {
            renderContent: (
              <Shortcut alignSelf="center" mr="$2.5">
                <Shortcut.Key>{shortcutsKeys.CmdOrCtrl}</Shortcut.Key>
                <Shortcut.Key>T</Shortcut.Key>
              </Shortcut>
            ),
          },
        ]}
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

// @ts-expect-error
export default withBrowserProvider<ICustomHeaderRightProps>(CustomHeaderSearch);

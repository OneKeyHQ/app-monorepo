import { useLayoutEffect, useMemo } from 'react';

import { useNavigation } from '@react-navigation/native';

import { Page, useSafeAreaInsets, useTheme } from '@onekeyhq/components';
import { MoreActionContentPage } from '@onekeyhq/kit/src/components/MoreActionButton';
import { useThemeVariant } from '@onekeyhq/kit/src/hooks/useThemeVariant';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { ActionCenterTestIDs } from '../testIDs';

const ACTION_CENTER_CANVAS_DARK_STYLE = { bg: '$bgApp' } as const;

export default function ActionCenter() {
  const { top } = useSafeAreaInsets();
  const navigation = useNavigation();
  const theme = useTheme();
  const themeVariant = useThemeVariant();
  const nativeHeaderStyle = useMemo(
    () => ({
      backgroundColor:
        themeVariant === 'light' ? theme.bgSubdued.val : theme.bgApp.val,
    }),
    [theme.bgApp.val, theme.bgSubdued.val, themeVariant],
  );

  useLayoutEffect(() => {
    if (platformEnv.isNativeIOS26Plus) {
      navigation.setOptions({ headerStyle: nativeHeaderStyle });
    }
  }, [nativeHeaderStyle, navigation]);

  // On iOS 26 MoreActionContentHeader emits a native <Page.Header />,
  // and the screens framework already positions Page.Body below the bar
  // (HeaderScreenOptions does NOT set headerTransparent for this modal
  // style page, so content does not extend under the bar). Don't add
  // any top inset here — that would double-shift the body and leave a
  // tall empty band under the bar. The pt: top branch is kept for iOS
  // <26 / Android / web where there's no native bar to reserve space.
  return (
    <Page>
      <Page.Body
        pt={platformEnv.isNativeIOS26Plus ? 0 : top}
        bg="$bgSubdued"
        $theme-dark={ACTION_CENTER_CANVAS_DARK_STYLE}
        testID={ActionCenterTestIDs.pageBody}
      >
        <MoreActionContentPage />
      </Page.Body>
    </Page>
  );
}

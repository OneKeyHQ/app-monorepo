import { memo, useCallback } from 'react';

import { MotiView } from 'moti';
import { useIntl } from 'react-intl';
import { getTokenValue } from 'tamagui';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EShortcutEvents } from '@onekeyhq/shared/src/shortcuts/shortcuts.enum';

import { Tooltip } from '../../../actions';
import useProviderSideBarValue from '../../../hocs/Provider/hooks/useProviderSideBarValue';
import { useShortcuts } from '../../../hooks/useShortcuts';

import HeaderIconButton from './HeaderIconButton';

function HeaderCollapseButton({
  isRootScreen = true,
}: {
  isRootScreen?: boolean;
}) {
  const intl = useIntl();
  const {
    leftSidebarCollapsed: isCollapse,
    setLeftSidebarCollapsed: setIsCollapse,
  } = useProviderSideBarValue();

  const onPressCall = useCallback(() => {
    setIsCollapse?.(!isCollapse);
    defaultLogger.app.page.navigationToggle();
  }, [isCollapse, setIsCollapse]);

  const paddingLeft = getTokenValue(
    platformEnv.isDesktopMac && isRootScreen && isCollapse ? '$20' : '$0',
    'size',
  );

  useShortcuts(EShortcutEvents.SideBar, onPressCall);

  return (
    <MotiView
      testID="Desktop-AppSideBar-Button"
      animate={{ paddingLeft }}
      transition={{
        duration: 200,
        type: 'timing',
      }}
    >
      <HeaderIconButton
        onPress={onPressCall}
        icon="SidebarOutline"
        title={
          <Tooltip.Text shortcutKey={EShortcutEvents.SideBar}>
            {intl.formatMessage({
              id: isCollapse
                ? ETranslations.shortcut_show_sidebar
                : ETranslations.shortcut_hide_sidebar,
            })}
          </Tooltip.Text>
        }
        titlePlacement="bottom"
      />
    </MotiView>
  );
}

export default memo(HeaderCollapseButton);

import { memo, useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';
import { AnimatePresence } from 'tamagui';

import { Stack } from '@onekeyhq/components/src/primitives';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EShortcutEvents } from '@onekeyhq/shared/src/shortcuts/shortcuts.enum';

import { Tooltip } from '../../../actions';
import useProviderSideBarValue from '../../../hocs/Provider/hooks/useProviderSideBarValue';
import { useShortcuts } from '../../../hooks/useShortcuts';

import HeaderIconButton from './HeaderIconButton';

export const useHeaderCollapseButtonVisibility = ({
  hideWhenOpen,
  hideWhenCollapse,
}: {
  hideWhenOpen?: boolean;
  hideWhenCollapse?: boolean;
}) => {
  const { leftSidebarCollapsed: isCollapse } = useProviderSideBarValue();

  const shouldHideWhenCollapse = hideWhenCollapse && isCollapse;
  const shouldHideWhenOpen = hideWhenOpen && !isCollapse;

  return {
    shouldHide: shouldHideWhenCollapse || shouldHideWhenOpen,
    shouldHideWhenCollapse,
    shouldHideWhenOpen,
  };
};

function HeaderCollapseButton({
  isRootScreen = true,
  hideWhenOpen,
  hideWhenCollapse,
}: {
  isRootScreen?: boolean;
  hideWhenOpen?: boolean;
  hideWhenCollapse?: boolean;
}) {
  const intl = useIntl();
  const {
    leftSidebarCollapsed: isCollapse,
    setLeftSidebarCollapsed: setIsCollapse,
  } = useProviderSideBarValue();

  const { shouldHide } = useHeaderCollapseButtonVisibility({
    hideWhenOpen,
    hideWhenCollapse,
  });

  const onPressCall = useCallback(() => {
    setIsCollapse?.(!isCollapse);
    defaultLogger.app.page.navigationToggle();
  }, [isCollapse, setIsCollapse]);

  useShortcuts(EShortcutEvents.SideBar, onPressCall);

  const paddingLeft = useMemo(
    () =>
      platformEnv.isDesktopMac && hideWhenOpen && isRootScreen ? '$20' : 0,
    [hideWhenOpen, isRootScreen],
  );

  return (
    <AnimatePresence>
      {shouldHide ? null : (
        <Stack
          pl={paddingLeft}
          testID="Desktop-AppSideBar-Button"
          animation="100ms"
          opacity={1}
          enterStyle={{
            opacity: 0,
          }}
          exitStyle={{
            opacity: 0,
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
        </Stack>
      )}
    </AnimatePresence>
  );
}

export default memo(HeaderCollapseButton);

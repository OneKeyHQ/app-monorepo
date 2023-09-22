import { useCallback } from 'react';

import useProviderSideBarValue from '../../Provider/hooks/useProviderSideBarValue';

import HeaderButtonIcon from './HeaderButtonIcon';

export default function HeaderButtonSide() {
  const {
    leftSidebarCollapsed: isCollpase,
    setLeftSidebarCollapsed: setIsCollapse,
  } = useProviderSideBarValue();

  const onPressCall = useCallback(() => {
    setIsCollapse?.(!isCollpase);
  }, [isCollpase, setIsCollapse]);

  return <HeaderButtonIcon onPress={onPressCall} name="SidebarOutline" />;
}

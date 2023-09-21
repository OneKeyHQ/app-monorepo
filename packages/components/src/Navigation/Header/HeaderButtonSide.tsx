import { useCallback, useContext } from 'react';

import { Context } from '../../Provider/hooks/useProviderValue';

import HeaderButtonIcon from './HeaderButtonIcon';

export default function HeaderButtonSide() {
  const {
    leftSidebarCollapsed: isCollpase,
    setLeftSidebarCollapsed: setIsCollapse,
  } = useContext(Context);

  const onPressCall = useCallback(() => {
    setIsCollapse?.(!isCollpase);
  }, [isCollpase, setIsCollapse]);

  return <HeaderButtonIcon onPress={onPressCall} name="SidebarOutline" />;
}

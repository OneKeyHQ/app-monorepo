import { useMemo } from 'react';

import type { IIconProps, ISizableTextProps } from '@onekeyhq/components';

import { useSettingsLayout } from '../Tab/useIsTabNavigator';

/**
 * Row styles for the OneKey ID pages, matching TabSettingsListGrid's
 * sizing: tab layouts use the compact md styles, list layouts the lg ones.
 * Only phones restyle the value text to the subdued mobile look — list
 * layouts (extension popup, narrow web) keep the emphasized value text.
 */
export function useOneKeyIdListItemStyles() {
  const { isTabNavigator, isMobileLayout } = useSettingsLayout();
  const styles = useMemo(() => {
    const titleProps: ISizableTextProps = {
      size: isTabNavigator ? '$bodyMdMedium' : '$bodyLgMedium',
    };
    const valueTextProps: ISizableTextProps = isMobileLayout
      ? { size: '$bodyLg', color: '$textSubdued' }
      : titleProps;
    const iconProps: IIconProps = {
      size: isTabNavigator ? '$5' : '$6',
    };
    return { titleProps, valueTextProps, iconProps };
  }, [isMobileLayout, isTabNavigator]);
  return { ...styles, isTabNavigator };
}

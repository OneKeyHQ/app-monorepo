import { useMemo } from 'react';

// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { useAppSideBarStatusAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/settings';

export const useHeaderCollapseButtonVisibility = ({
  hideWhenOpen,
  hideWhenCollapse,
}: {
  hideWhenOpen?: boolean;
  hideWhenCollapse?: boolean;
}) => {
  const [{ isCollapsed = false }] = useAppSideBarStatusAtom();

  const shouldHideWhenCollapse = hideWhenCollapse && isCollapsed;
  const shouldHideWhenOpen = hideWhenOpen && !isCollapsed;

  return useMemo(() => {
    return {
      shouldHide: shouldHideWhenCollapse || shouldHideWhenOpen,
      shouldHideWhenCollapse,
      shouldHideWhenOpen,
    };
  }, [shouldHideWhenCollapse, shouldHideWhenOpen]);
};

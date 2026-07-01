import { useCallback } from 'react';
import type { RefObject } from 'react';

import {
  Dialog,
  Toast,
  rootNavigationRef,
  tabletMainViewNavigationRef,
  useClipboard,
} from '@onekeyhq/components';
import { stableStringify } from '@onekeyhq/shared/src/utils/stringUtils';

import {
  type INavigationStateLike,
  inspectMainRoutes,
} from './navigationDiagnosticsUtils';
import { SectionPressItem } from './SectionPressItem';

import type { NavigationContainerRef } from '@react-navigation/native';

type INavigationRef = RefObject<NavigationContainerRef<any> | null>;

function getRootState(ref: INavigationRef) {
  return ref.current?.getRootState() as INavigationStateLike | undefined;
}

export function NavigationDiagnosticsSection() {
  const { copyText } = useClipboard();
  const hasTabletMainViewNavigation = Boolean(
    tabletMainViewNavigationRef.current,
  );

  const handleCopyRootState = useCallback(
    (label: string, ref: INavigationRef) => {
      const rootState = getRootState(ref);
      if (!rootState) {
        Toast.error({
          title: `${label} rootState unavailable`,
          message: 'Navigation container is not ready yet.',
        });
        return;
      }

      copyText(stableStringify(rootState, null, 2), undefined, false);
      Toast.success({
        title: `${label} rootState copied`,
      });
    },
    [copyText],
  );

  const handleInspectMainRoutes = useCallback(
    (label: string, ref: INavigationRef) => {
      const rootState = getRootState(ref);
      if (!rootState) {
        Dialog.confirm({
          title: `${label} unavailable`,
          description: 'Navigation not ready.',
        });
        return;
      }

      const inspection = inspectMainRoutes(rootState);
      const mainRouteDetails = inspection.mainRoutes
        .map((item, index) => {
          const routes = item.tabRouteNames.length
            ? item.tabRouteNames.join(', ')
            : '(empty)';
          const active = item.activeTabRouteName
            ? `\nActive: ${item.activeTabRouteName}`
            : '';
          return `${index + 1}. Tabs: ${routes}${active}`;
        })
        .join('\n');

      Dialog.confirm({
        title: inspection.hasTwoOrMoreMainRoutes
          ? `${label}: duplicated`
          : `${label}: OK`,
        description: `${inspection.mainRouteCount} Main\n${mainRouteDetails || 'No Main tabs'}`,
      });
    },
    [],
  );

  return (
    <>
      <SectionPressItem
        icon="ClipboardOutline"
        title="Copy rootState"
        subtitle="rootNavigationRef"
        onPress={() => {
          handleCopyRootState('rootNavigationRef', rootNavigationRef);
        }}
      />
      <SectionPressItem
        icon="SearchOutline"
        title="Check root tabs"
        subtitle="rootNavigationRef"
        onPress={() => {
          handleInspectMainRoutes('rootNavigationRef', rootNavigationRef);
        }}
      />
      {hasTabletMainViewNavigation ? (
        <>
          <SectionPressItem
            icon="ClipboardOutline"
            title="Copy tabletState"
            subtitle="tabletMainViewNavigationRef"
            onPress={() => {
              handleCopyRootState(
                'tabletMainViewNavigationRef',
                tabletMainViewNavigationRef,
              );
            }}
          />
          <SectionPressItem
            icon="SearchOutline"
            title="Check tablet tabs"
            subtitle="tabletMainViewNavigationRef"
            onPress={() => {
              handleInspectMainRoutes(
                'tabletMainViewNavigationRef',
                tabletMainViewNavigationRef,
              );
            }}
          />
        </>
      ) : null}
    </>
  );
}

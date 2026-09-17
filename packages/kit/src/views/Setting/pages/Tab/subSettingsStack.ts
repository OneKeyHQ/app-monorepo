import type { ComponentType } from 'react';

import type { ITabSubNavigatorConfig } from '@onekeyhq/components/src/layouts/Navigation/Navigator';

import { BasicSubSettingsModalStack } from './basicSubSettingsModalStack';

/**
 * Every settings pane hosts the same sub stack: the pane's own screen plus
 * the shared settings modal routes. Built here so the platform-resolved modal
 * stack and its config cast live in exactly one place.
 */
export function buildSubSettingsPaneStack(
  name: string,
  component: ComponentType<any>,
): ITabSubNavigatorConfig<string, any>[] {
  return [
    { name, component },
    ...(BasicSubSettingsModalStack as unknown as ITabSubNavigatorConfig<
      string,
      any
    >[]),
  ];
}

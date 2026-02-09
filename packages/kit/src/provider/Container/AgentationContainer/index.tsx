import { memo } from 'react';
import type { ComponentType } from 'react';

import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import LazyLoad from '@onekeyhq/shared/src/lazyLoad';

const AgentationDevTool = LazyLoad<{ endpoint?: string }>(
  () =>
    import('agentation').then((mod) => ({
      default:
        mod.Agentation as unknown as ComponentType<{ endpoint?: string }>,
    })) as Promise<{ default: ComponentType<{ endpoint?: string }> }>,
);

function BasicAgentationContainer() {
  const [devSettings] = useDevSettingsPersistAtom();
  if (!devSettings.enabled || !devSettings.settings?.showAgentation) {
    return null;
  }
  return <AgentationDevTool endpoint="http://localhost:4747" />;
}

export const AgentationContainer = memo(BasicAgentationContainer);

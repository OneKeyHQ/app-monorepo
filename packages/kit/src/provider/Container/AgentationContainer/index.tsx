import { memo } from 'react';

import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import LazyLoad from '@onekeyhq/shared/src/lazyLoad';

const AgentationDevTool = LazyLoad(() =>
  import('agentation').then((mod) => ({
    default: mod.Agentation,
  })),
);

function BasicAgentationContainer() {
  const [devSettings] = useDevSettingsPersistAtom();
  if (!devSettings.enabled || !devSettings.settings?.showAgentation) {
    return null;
  }
  return <AgentationDevTool endpoint="http://localhost:4747" />;
}

export const AgentationContainer = memo(BasicAgentationContainer);

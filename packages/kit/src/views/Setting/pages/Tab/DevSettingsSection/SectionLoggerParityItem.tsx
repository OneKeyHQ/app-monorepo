import { useCallback, useEffect, useState } from 'react';

import { ESwitchSize, Switch } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { defaultLoggerConfig } from '@onekeyhq/shared/src/logger/loggerConfig';

import { useMatchesDevSearch } from './DevSettingsSearchContext';

const TITLE = 'Persist all logs';
const SUBTITLE = 'Dev builds write every log to file like production';

/**
 * Dev-only production-parity logging switch. The state lives in the logger
 * config (shared layer, same store as the Gallery logger settings), not in
 * devSettings: the logger cannot depend on kit-bg atoms.
 */
export function SectionLoggerParityItem() {
  const [enabled, setEnabled] = useState(false);
  const matches = useMatchesDevSearch(
    TITLE,
    SUBTITLE,
    'logger file log enableAllScenes 日志 落盘 生产',
  );

  useEffect(() => {
    void (async () => {
      const config = await defaultLoggerConfig.getSavedLoggerConfig();
      setEnabled(Boolean(config.enableAllScenes));
    })();
  }, []);

  const handleChange = useCallback(async (value: boolean) => {
    setEnabled(value);
    const config = await defaultLoggerConfig.getSavedLoggerConfig();
    defaultLoggerConfig.saveLoggerConfig({
      ...config,
      enableAllScenes: value,
    });
  }, []);

  if (!matches) {
    return null;
  }
  return (
    <ListItem
      icon="FileTextOutline"
      title={TITLE}
      subtitle={SUBTITLE}
      titleProps={{ color: '$textCritical' }}
    >
      <Switch
        size={ESwitchSize.small}
        value={enabled}
        onChange={handleChange}
      />
    </ListItem>
  );
}

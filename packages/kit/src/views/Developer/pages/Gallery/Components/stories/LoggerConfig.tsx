import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';

import { noop } from 'lodash';

import { Checkbox, Stack, XStack, YStack } from '@onekeyhq/components';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { defaultLoggerConfig } from '@onekeyhq/shared/src/logger/loggerConfig';

interface ILoggingConfig {
  [key: string]: boolean | ILoggingConfig;
}

const LoggingConfigCheckbox = () => {
  noop(defaultLogger.account.getName());
  const [config, setConfig] = useState<ILoggingConfig>({});

  useEffect(() => {
    void (async () => {
      const savedConfig = await defaultLoggerConfig.getSavedLoggerConfig();
      setConfig(savedConfig);
    })();
  }, []);

  const handleChange = (path: string[], value: boolean) => {
    const newConfig = { ...config };
    let current: ILoggingConfig | boolean = newConfig;
    for (let i = 0; i < path.length - 1; i += 1) {
      // @ts-ignore
      current = current[path[i]] as any;
    }
    // @ts-ignore
    current[path[path.length - 1]] = value;
    setConfig(newConfig);
    void defaultLoggerConfig.saveLoggerConfig(newConfig as any);
  };

  const isGroupChecked = (group: ILoggingConfig): boolean =>
    Object.values(group).every((value) => {
      if (typeof value === 'object') {
        return isGroupChecked(value);
      }
      return value;
    });

  const renderCheckBoxes = (
    obj: ILoggingConfig,
    path: string[] = [],
  ): ReactNode =>
    Object.entries(obj).map(([key, value]) => {
      const currentPath = [...path, key];
      if (typeof value === 'object') {
        const groupChecked = isGroupChecked(value);
        return (
          <YStack key={key} ml="$2">
            <XStack alignItems="center">
              <Checkbox
                value={groupChecked}
                onChange={(checked) => {
                  const newValue = { ...value };
                  Object.keys(newValue).forEach((subKey) => {
                    if (typeof newValue[subKey] === 'object') {
                      Object.keys(newValue[subKey]).forEach((subSubKey) => {
                        // @ts-ignore
                        newValue[subKey][subSubKey] = checked;
                      });
                    } else {
                      // @ts-ignore
                      newValue[subKey] = checked;
                    }
                  });
                  // @ts-ignore
                  handleChange(currentPath, newValue);
                }}
                label={key}
                labelProps={{
                  fontSize: '$heading3xl',
                }}
              />
            </XStack>
            {renderCheckBoxes(value, currentPath)}
          </YStack>
        );
      }
      return (
        <XStack key={key} ml="$8" alignItems="center">
          <Checkbox
            value={value}
            onChange={(checked) => handleChange(currentPath, !!checked)}
            label={key}
          />
        </XStack>
      );
    });

  return <Stack>{renderCheckBoxes(config)}</Stack>;
};

export default LoggingConfigCheckbox;

import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';

import { noop } from 'lodash';
import { useDebouncedCallback } from 'use-debounce';

import {
  Checkbox,
  Input,
  SizableText,
  Stack,
  Switch,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { ILoggerConfig } from '@onekeyhq/shared/src/logger/loggerConfig';
import { defaultLoggerConfig } from '@onekeyhq/shared/src/logger/loggerConfig';
import perfUtils, {
  EPerformanceTimerLogNames,
} from '@onekeyhq/shared/src/utils/perfUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

interface ILoggingEnabledConfig {
  [key: string]: boolean | ILoggingEnabledConfig;
}

const LoggingConfigCheckbox = () => {
  noop(defaultLogger.account.getName());

  const [highlightDurationGt, setHighlightDurationGt] = useState('');
  const highlightDurationGtRef = useRef(highlightDurationGt);
  highlightDurationGtRef.current = highlightDurationGt;

  const [enabledConfig, setEnabledConfig] = useState<ILoggingEnabledConfig>({});
  const enabledConfigRef = useRef(enabledConfig);
  enabledConfigRef.current = enabledConfig;

  const [config, setConfig] = useState<ILoggerConfig>({
    highlightDurationGt: '',
    enabled: {},
  });
  const configRef = useRef(config);
  configRef.current = config;

  useEffect(() => {
    void (async () => {
      const savedConfig = await defaultLoggerConfig.getSavedLoggerConfig();
      setConfig(savedConfig);
      setEnabledConfig(savedConfig.enabled);
      setHighlightDurationGt(savedConfig.highlightDurationGt || '');
    })();
  }, []);

  const saveLoggerConfig = useDebouncedCallback(
    async () => {
      // use debounce to wait state update
      await timerUtils.wait(0);
      void defaultLoggerConfig.saveLoggerConfig({
        ...configRef.current,
        highlightDurationGt: highlightDurationGtRef.current,
        enabled: enabledConfigRef.current as any,
      });
    },
    300,
    {
      leading: false,
      trailing: true,
    },
  );

  const handleChange = (path: string[], value: boolean) => {
    const newConfig = { ...enabledConfig };
    let current: ILoggingEnabledConfig | boolean = newConfig;
    for (let i = 0; i < path.length - 1; i += 1) {
      // @ts-ignore
      current = current[path[i]] as any;
    }
    // @ts-ignore
    current[path[path.length - 1]] = value;
    setEnabledConfig(newConfig);
    void saveLoggerConfig();
  };

  const isGroupChecked = (group: ILoggingEnabledConfig): boolean =>
    Object.values(group).every((value) => {
      if (typeof value === 'object') {
        return isGroupChecked(value);
      }
      return value;
    });

  const renderCheckBoxes = (
    obj: ILoggingEnabledConfig,
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

  return (
    <Stack>
      <SizableText>
        Highlight Duration Greater Than ({config.highlightDurationGt}ms)
      </SizableText>

      {config.highlightDurationGt ? (
        <Input
          value={highlightDurationGt}
          onBlur={() => {
            void saveLoggerConfig();
          }}
          onChangeText={(text) => {
            setHighlightDurationGt(text);
          }}
        />
      ) : null}

      <Stack py="$4" flexDirection="row" alignItems="center" gap="$2">
        <Switch
          value={config.colorfulLog}
          onChange={(v) => {
            setConfig((prev) => ({
              ...prev,
              colorfulLog: v,
            }));
            void saveLoggerConfig();
          }}
        />
        <SizableText>Colorful log original message objects</SizableText>
      </Stack>

      <XStack alignItems="center" mb="$4">
        <Checkbox
          value={isGroupChecked(enabledConfig)}
          onChange={(checked) => {
            const newConfig = { ...enabledConfig };
            Object.keys(newConfig).forEach((key) => {
              if (
                typeof newConfig[key] === 'object' &&
                newConfig[key] !== null
              ) {
                Object.keys(newConfig[key] as ILoggingEnabledConfig).forEach(
                  (subKey) => {
                    (newConfig[key] as ILoggingEnabledConfig)[subKey] =
                      !!checked;
                  },
                );
              } else {
                newConfig[key] = !!checked;
              }
            });
            handleChange([], newConfig as any);
          }}
          label="Select All"
          labelProps={{
            fontSize: '$heading2xl',
            fontWeight: 'bold',
          }}
        />
      </XStack>
      {renderCheckBoxes(enabledConfig)}

      <SizableText>PerformanceTimer Log</SizableText>
      {Object.values(EPerformanceTimerLogNames).map((logName) => (
        <Checkbox
          key={logName}
          isUncontrolled
          defaultChecked={perfUtils.getPerformanceTimerLogConfig(logName)}
          label={logName}
          onChange={(v) =>
            perfUtils.updatePerformanceTimerLogConfig(logName as any, !!v)
          }
        />
      ))}
    </Stack>
  );
};

export default LoggingConfigCheckbox;

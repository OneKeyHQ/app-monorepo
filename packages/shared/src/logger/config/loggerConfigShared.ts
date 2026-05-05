export type ILoggerConfig = {
  highlightDurationGt?: string;
  colorfulLog?: boolean;
  enabled: {
    [scope: string]: {
      [scene: string]: boolean;
    };
  };
};

export const LOGGER_CONFIG_STORAGE_KEY = '$$OneKeyV5LoggerConfig';

export function createDefaultLoggerConfig({
  colorfulLog,
}: {
  colorfulLog: boolean;
}): ILoggerConfig {
  return {
    highlightDurationGt: '100',
    colorfulLog,
    enabled: {},
  };
}

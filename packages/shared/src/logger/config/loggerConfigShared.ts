export type ILoggerConfig = {
  highlightDurationGt?: string;
  colorfulLog?: boolean;
  /**
   * Dev-only production parity switch: when true, every scope/scene logs and
   * persists exactly like production builds (which ignore the `enabled` map).
   */
  enableAllScenes?: boolean;
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

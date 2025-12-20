export const buildDefaultFileBaseName = () =>
  `OneKeyLogs-${new Date().toISOString().replace(/[-:.]/g, '')}`;

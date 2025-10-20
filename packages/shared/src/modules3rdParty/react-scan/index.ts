// Lazy load react-scan for use in Bootstrap
export const scanAsync = async (options: {
  enabled: boolean;
  showToolbar?: boolean;
  animationSpeed?: 'fast' | 'slow' | 'off';
  trackUnnecessaryRenders?: boolean;
}) => {
  const { scan } = await import('react-scan');
  scan(options);
};

export const initReactScan = async () => {
  await scanAsync({ enabled: false, showToolbar: false });
};

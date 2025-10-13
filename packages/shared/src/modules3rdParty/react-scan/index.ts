// Re-export scan from react-scan for use in Bootstrap
import { scan } from 'react-scan';

export const initReactScan = () => {
  // Initialize with disabled state, will be enabled by devSettings in Bootstrap
  scan({ enabled: false, showToolbar: false });
};

export { scan };

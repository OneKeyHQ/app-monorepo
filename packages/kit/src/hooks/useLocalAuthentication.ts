import { useEffect, useState } from 'react';

import {
  getPassword,
  hasHardwareSupported,
  localAuthenticate,
  savePassword,
} from '../utils/localAuthentication';

export function useLocalAuthentication() {
  const [isOk, setOk] = useState(false);

  useEffect(() => {
    hasHardwareSupported().then(setOk);
  }, []);

  return {
    isOk,
    localAuthenticate,
    hasHardwareSupported,
    savePassword,
    getPassword,
  };
}

import bridge from 'react-native-mymonero-core';

import type { CppBridge } from 'react-native-mymonero-core';

export const loadWasmInstance = async (): Promise<CppBridge | null> => bridge;

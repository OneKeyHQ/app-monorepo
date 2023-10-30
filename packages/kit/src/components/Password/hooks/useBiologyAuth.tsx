import { useEffect, useState } from 'react';

import { hasHardwareSupported } from '../../../utils/localAuthentication';

const useBiologyAuth = () => {
  const [isSupportBiologyAuth, setIsSupportBiologyAuth] = useState(false);

  // TODO get authenticationType supportedAuthenticationTypesAsync 获取支持的生物识别类型
  // TODO 获取生物识别开关状态
  useEffect(() => {
    hasHardwareSupported()
      .then(setIsSupportBiologyAuth)
      .catch(() => {});
  }, []);
  return { isSupportBiologyAuth };
};

export default useBiologyAuth;

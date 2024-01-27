import { useEffect, useMemo, useState } from 'react';

import type { IRiskLevel } from '../types';

function useRiskDetection({ origin }: { origin: string }) {
  const [riskLevel, setRiskLevel] = useState<IRiskLevel>('Unknown');
  const [continueOperate, setContinueOperate] = useState(false);

  const canContinueOperate = useMemo(
    () => riskLevel === 'Verified' || continueOperate,
    [continueOperate, riskLevel],
  );

  useEffect(() => {
    if (!origin) return;

    // 定义一个获取随机风险等级的函数
    const getRandomRiskLevel = (): IRiskLevel => {
      const riskLevels: IRiskLevel[] = ['Verified', 'Unknown', 'Scam'];
      const randomIndex = Math.floor(Math.random() * riskLevels.length);
      return riskLevels[randomIndex];
    };

    // 使用上面定义的函数设置随机风险等级
    setRiskLevel(getRandomRiskLevel());
    // setRiskLevel('Verified');
  }, [origin]);

  return {
    continueOperate,
    setContinueOperate,
    canContinueOperate,
    riskLevel,
  };
}

export { useRiskDetection };

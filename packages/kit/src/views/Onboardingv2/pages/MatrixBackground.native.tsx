// Native-optimized MatrixBackground: uses a single SizableText with pre-generated
// text blocks instead of multiple SizableText per line. This avoids per-tick string
// allocation and React reconciliation of 50+ text nodes, reducing Hermes GC pressure
// during wallet creation which can cause OOM crashes on memory-constrained iOS devices.
import { useEffect, useRef, useState } from 'react';

import { SizableText } from '@onekeyhq/components';

import {
  generateMatrixPool,
  type IMatrixBackgroundProps,
} from './matrixBackgroundUtils';

const TEXT_POOL_COUNT = 10;
const TEXT_TOTAL_CHARS = 3000;

const MatrixBackground = ({
  updateInterval = 500,
}: IMatrixBackgroundProps) => {
  const poolRef = useRef<string[]>(
    generateMatrixPool(TEXT_POOL_COUNT, TEXT_TOTAL_CHARS),
  );
  const [text, setText] = useState(poolRef.current[0]);

  useEffect(() => {
    const pool = poolRef.current;
    let index = 0;
    const tick = () => {
      index = (index + 1) % pool.length;
      setText(pool[index]);
    };
    const interval = setInterval(tick, updateInterval);
    return () => clearInterval(interval);
  }, [updateInterval]);

  return (
    <SizableText
      textAlign="center"
      fontFamily="$monoRegular"
      letterSpacing={2}
    >
      {text}
    </SizableText>
  );
};

export default MatrixBackground;

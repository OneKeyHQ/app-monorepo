import { useEffect, useState } from 'react';

import { SizableText, YStack } from '@onekeyhq/components';

import { type IMatrixBackgroundProps, useMatrixPool } from './useMatrixPool';

const LINE_POOL_SIZE = 120;

const MatrixBackground = ({
  lineCount = 30,
  charsPerLine = 60,
  updateInterval = 200,
}: IMatrixBackgroundProps) => {
  const pool = useMatrixPool(LINE_POOL_SIZE, charsPerLine);
  const [lines, setLines] = useState<string[]>([]);

  useEffect(() => {
    const pickLines = () => {
      const picked: string[] = [];
      for (let i = 0; i < lineCount; i += 1) {
        picked.push(pool[Math.floor(Math.random() * pool.length)]);
      }
      setLines(picked);
    };

    pickLines();
    const interval = setInterval(pickLines, updateInterval);
    return () => clearInterval(interval);
  }, [pool, lineCount, updateInterval]);

  return (
    <YStack>
      {lines.map((line, idx) => (
        <SizableText
          textAlign="center"
          fontFamily="$monoRegular"
          letterSpacing={2}
          key={idx}
          numberOfLines={1}
          ellipsizeMode="clip"
        >
          {line}
        </SizableText>
      ))}
    </YStack>
  );
};

export default MatrixBackground;

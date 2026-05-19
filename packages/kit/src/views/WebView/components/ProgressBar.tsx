import { memo, useEffect, useState } from 'react';

import { Progress, Stack } from '@onekeyhq/components';

const FADE_DURATION_MS = 200;

/**
 * Thin animated progress bar driven by webview load progress.
 * Visible while progress < 100, then fades out.
 */
function ProgressBar({ progress }: { progress: number }) {
  const [visible, setVisible] = useState(progress < 100);

  useEffect(() => {
    if (progress < 100) {
      setVisible(true);
      return;
    }
    const timer = setTimeout(() => setVisible(false), FADE_DURATION_MS);
    return () => clearTimeout(timer);
  }, [progress]);

  if (!visible) {
    return null;
  }

  return (
    <Stack
      width="100%"
      opacity={progress < 100 ? 1 : 0}
      animation="quick"
      animateOnly={['opacity']}
    >
      <Progress
        value={Math.max(0, Math.min(100, progress))}
        width="100%"
        borderRadius={0}
        height="$0.5"
      />
    </Stack>
  );
}

export default memo(ProgressBar);

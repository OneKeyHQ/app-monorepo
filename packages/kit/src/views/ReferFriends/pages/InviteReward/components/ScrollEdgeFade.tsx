import { useImperativeHandle, useState } from 'react';
import type { Ref } from 'react';

import { LinearGradient } from '@onekeyhq/components';
import { getChartColorWithAlpha } from '@onekeyhq/kit/src/components/LightweightChart/utils/chartColor';

export interface IScrollEdgeFadeControl {
  setVisible: (visible: boolean) => void;
}

// A short fade under the compact bar softens content scrolling beneath it;
// it only shows once the content has moved. It keeps its own state so the
// scroll handler toggles it without re-rendering the page.
export function ScrollEdgeFade({
  color,
  controlRef,
}: {
  color: string;
  controlRef: Ref<IScrollEdgeFadeControl>;
}) {
  const [isVisible, setIsVisible] = useState(false);
  useImperativeHandle(controlRef, () => ({ setVisible: setIsVisible }), []);

  if (!isVisible) {
    return null;
  }
  return (
    <LinearGradient
      position="absolute"
      top={0}
      left={0}
      right={0}
      height={24}
      pointerEvents="none"
      colors={[color, getChartColorWithAlpha(color, 0)]}
    />
  );
}

import { useEffect, useState } from 'react';

import {
  attachModifierHintRevealListeners,
  createModifierHintRevealHandlers,
} from './modifierHintRevealHandlers';

export { MODIFIER_HINT_HOLD_MS } from './modifierHintRevealUtils';

export function useModifierHintReveal(enabled = true): boolean {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handlers = createModifierHintRevealHandlers({
      enabled,
      onVisibleChange: setVisible,
    });

    if (!handlers) {
      return undefined;
    }

    return attachModifierHintRevealListeners(handlers);
  }, [enabled]);

  return visible;
}

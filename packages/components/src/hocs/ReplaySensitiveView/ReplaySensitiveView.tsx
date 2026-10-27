import { useReplaySensitive } from '../../hooks/useReplaySensitive';

import type { IReplaySensitiveViewProps } from './types';

// Web and desktop: no wrapper element, so layout is untouched. The pause
// token alone keeps the content out of the recording.
export function ReplaySensitiveView({
  children,
  active = true,
  tag = 'sensitiveView',
}: IReplaySensitiveViewProps) {
  useReplaySensitive(active, tag);
  return <>{children}</>;
}

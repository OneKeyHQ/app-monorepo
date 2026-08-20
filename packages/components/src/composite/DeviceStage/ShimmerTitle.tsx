import { SizableText } from '../../primitives';

/**
 * Base engine of the capsule's live title: plain text. The left-to-right
 * gradient sweep is the native sibling's — it rides a masked view, which
 * has no web counterpart, and the overlay targets iOS first anyway.
 * `paused` belongs to the sweep, so plain text takes it and lets it rest.
 */
export function ShimmerTitle({
  children,
}: {
  children: string;
  paused?: boolean;
}) {
  return (
    <SizableText size="$headingMd" color="$textSubdued">
      {children}
    </SizableText>
  );
}

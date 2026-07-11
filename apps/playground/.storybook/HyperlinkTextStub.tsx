import { SizableText } from '@onekeyhq/components/src/primitives/SizeableText';
import type { HyperlinkText } from '@onekeyhq/kit/src/components/HyperlinkText';

// ConfigProvider requires a `HyperlinkText` component prop. The real one lives
// in `@onekeyhq/kit`, which we deliberately keep out of the playground's
// runtime module graph (it would drag in backgroundApiProxy / jotai /
// navigation). None of the v1 target components (Button / Input / Badge)
// consume it, so a stub that renders its children is enough. The type-only kit
// import is erased at compile time (the same pattern ConfigProvider itself uses
// for this prop), so the stub stays contract-checked against the real
// component without pulling kit in.
export const HyperlinkTextStub: typeof HyperlinkText = ({ children }) => (
  <SizableText>{children}</SizableText>
);

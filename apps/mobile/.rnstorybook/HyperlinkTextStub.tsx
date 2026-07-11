import { SizableText } from '@onekeyhq/components/src/primitives/SizeableText';
import type { HyperlinkText } from '@onekeyhq/kit/src/components/HyperlinkText';

// ConfigProvider requires a HyperlinkText implementation (normally injected by
// kit at app bootstrap). A type-only kit import keeps the runtime graph free of
// kit — none of the v1 story components consume it.
export const HyperlinkTextStub: typeof HyperlinkText = ({ children }) => (
  <SizableText>{children}</SizableText>
);

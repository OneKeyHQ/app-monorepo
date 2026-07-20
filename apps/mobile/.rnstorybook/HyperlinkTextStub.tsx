import { SizableText } from '@onekeyhq/components/src/primitives/SizeableText';
import type { HyperlinkText } from '@onekeyhq/kit/src/components/HyperlinkText';

// ConfigProvider requires a HyperlinkText implementation (normally injected by
// kit at app bootstrap). Some components (e.g. Toast's RenderLines) call it
// with `translationId`/`defaultMessage` and NO children, so the stub falls
// back through that chain — story text is literal English, never a real
// translation key. Custom props are destructured off so only text-style props
// reach SizableText. The type-only kit import keeps the runtime graph free of
// kit.
export const HyperlinkTextStub: typeof HyperlinkText = ({
  children,
  translationId,
  defaultMessage,
  onAction,
  messages,
  values,
  autoExecuteParsedAction,
  urlTextProps,
  actionTextProps,
  underlineTextProps,
  boldTextProps,
  textProps,
  subscriptsTextProps,
  scoped,
  ...textStyleProps
}) => (
  <SizableText {...textStyleProps}>
    {children ?? defaultMessage ?? translationId}
  </SizableText>
);

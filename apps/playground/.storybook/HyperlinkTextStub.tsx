import { SizableText } from '@onekeyhq/components/src/primitives/SizeableText';
import type { HyperlinkText } from '@onekeyhq/kit/src/components/HyperlinkText';

// ConfigProvider requires a `HyperlinkText` component prop. The real one lives
// in `@onekeyhq/kit`, which we deliberately keep out of the playground's
// runtime module graph (it would drag in backgroundApiProxy / jotai /
// navigation). Some components (e.g. Toast's RenderLines) call it with
// `translationId`/`defaultMessage` and NO children, so the stub must fall back
// through that chain — story text is always literal English, never a real
// translation key, so skipping intl formatting is safe. The custom props are
// destructured off so only real text-style props reach SizableText. The
// type-only kit import is erased at compile time (the same pattern
// ConfigProvider itself uses for this prop), so the stub stays
// contract-checked against the real component without pulling kit in.
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

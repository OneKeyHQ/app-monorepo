import type { ComponentType, ReactElement } from 'react';

import type { ETranslations } from '@onekeyhq/shared/src/locale';

import type { ISizableTextProps } from '../../primitives';

export type IHyperlinkTextProps = {
  translationId?: ETranslations;
  defaultMessage?: string;
  onAction?: (url: string) => void;
  messages?: Record<string, string>;
  values?: Record<
    string,
    string | ReactElement | ((v: string) => ReactElement | string)
  >;
  /**
   * Whether a recognized URL should trigger built-in navigation/action side
   * effects immediately, instead of returning parsed data for the caller.
   */
  autoExecuteParsedAction?: boolean;
  /**
   * Awaited before a url/urlInApp link opens. For a link inside a dialog that
   * has to get out of the way first: `onAction` fires in a detached timeout, so
   * a dismissal started there races the navigation instead of preceding it.
   */
  onBeforeOpenUrl?: () => void | Promise<void>;
  urlTextProps?: ISizableTextProps;
  actionTextProps?: ISizableTextProps;
  underlineTextProps?: ISizableTextProps;
  boldTextProps?: ISizableTextProps;
  textProps?: ISizableTextProps;
  subscriptsTextProps?: ISizableTextProps;
  scoped?: boolean;
} & ISizableTextProps;

export type IHyperlinkTextComponent = ComponentType<IHyperlinkTextProps>;

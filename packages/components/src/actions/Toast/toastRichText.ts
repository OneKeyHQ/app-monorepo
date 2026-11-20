import { createElement, isValidElement } from 'react';
import type { ReactNode } from 'react';

import type { ETranslations } from '@onekeyhq/shared/src/locale';

import type { IOverlayToastTextRun } from '@onekeyfe/react-native-native-overlay';
import type { IntlShape } from 'react-intl';

/** How a link run names its target for `Toast`'s link handler. */
export const TOAST_LINK_URL_PREFIX = 'url:';
export const TOAST_LINK_URL_IN_APP_PREFIX = 'urlInApp:';

export interface IToastRichTextStyle {
  intl: IntlShape;
  /** Font size of the paragraph, for `<subscripts>`. */
  fontSize: number;
  colors: {
    underline: string;
    red: string;
    green: string;
    yellow: string;
    blue: string;
    grey: string;
  };
}

type IRunStyle = Omit<IOverlayToastTextRun, 'text'>;

type IRunGroupProps = { runs: IOverlayToastTextRun[] };

// The intl formatter only passes React nodes through, so a tag hands its runs
// back inside an element of this marker type. It is never rendered.
function RunGroupMarker(_props: IRunGroupProps) {
  return null;
}

function runGroup(runs: IOverlayToastTextRun[]) {
  return createElement(RunGroupMarker, { runs });
}

type IChunk = ReactNode;

// Inner tags win: a run keeps what it already set and takes the rest from the
// tag that wraps it, as nested text components did.
function toRuns(chunk: IChunk, style: IRunStyle = {}): IOverlayToastTextRun[] {
  if (chunk === null || chunk === undefined || typeof chunk === 'boolean') {
    return [];
  }
  if (typeof chunk === 'string' || typeof chunk === 'number') {
    const text = String(chunk);
    return text ? [{ ...style, text }] : [];
  }
  if (Array.isArray(chunk)) {
    return chunk.flatMap((item: IChunk) => toRuns(item, style));
  }
  if (isValidElement<IRunGroupProps>(chunk) && chunk.type === RunGroupMarker) {
    return chunk.props.runs.map((run) => ({ ...style, ...run }));
  }
  return [];
}

function mergePlainRuns(runs: IOverlayToastTextRun[]): IOverlayToastTextRun[] {
  const merged: IOverlayToastTextRun[] = [];
  runs.forEach((run) => {
    const previous = merged[merged.length - 1];
    const isPlain = Object.keys(run).length === 1;
    if (previous && isPlain && Object.keys(previous).length === 1) {
      previous.text += run.text;
      return;
    }
    merged.push({ ...run });
  });
  return merged;
}

/**
 * Formats one line of toast text into styled runs. The tags and their
 * meaning are the ones `HyperlinkText` renders: `<url>`, `<urlInApp>`,
 * `<action>`, `<underline>`, `<bold>`, `<subscripts>`, the semantic color
 * tags and `<text>`. The line is both the translation id and its default
 * message, so plain text passes through unchanged.
 */
export function formatToastLine(
  line: string,
  style: IToastRichTextStyle,
): IOverlayToastTextRun[] {
  if (!line) {
    return [];
  }
  const url =
    (prefix: string, showExternalIndicator: boolean) => (params: IChunk[]) => {
      const [link, chunks] = params;
      const isLinkString = typeof link === 'string';
      const linkStyle: IRunStyle = {
        underline: true,
        link: `${prefix}${isLinkString ? link : ''}`,
      };
      const runs = toRuns(isLinkString ? chunks : link, linkStyle);
      if (showExternalIndicator) {
        runs.push({ ...linkStyle, text: ' ↗' });
      }
      return runGroup(runs);
    };
  const first =
    (runStyle: IRunStyle) =>
    ([chunk]: IChunk[]) =>
      runGroup(toRuns(chunk, runStyle));
  const formatted = style.intl.formatMessage(
    { id: line as ETranslations, defaultMessage: line },
    {
      action: (params: IChunk[]) => {
        const [actionId, chunks] = params;
        return runGroup(
          toRuns(typeof actionId === 'string' ? chunks : actionId),
        );
      },
      url: url(TOAST_LINK_URL_PREFIX, true),
      urlInApp: url(TOAST_LINK_URL_IN_APP_PREFIX, false),
      subscripts: first({ fontSize: Math.ceil(style.fontSize * 0.6) }),
      underline: first({ underline: true, color: style.colors.underline }),
      bold: first({ fontWeight: '600' }),
      red: first({ color: style.colors.red }),
      green: first({ color: style.colors.green }),
      yellow: first({ color: style.colors.yellow }),
      blue: first({ color: style.colors.blue }),
      grey: first({ color: style.colors.grey }),
      text: (chunks: IChunk[]) => runGroup(toRuns(chunks)),
      // The formatter's typed overloads expect string or element handlers;
      // these return marker elements, which it passes through untouched.
    } as unknown as Record<string, string>,
  ) as unknown as IChunk;
  return mergePlainRuns(toRuns(formatted));
}

/** One paragraph per line of the text, as the toast laid lines out before. */
export function formatToastText(
  text: string,
  style: IToastRichTextStyle,
): IOverlayToastTextRun[][] {
  return text.split('\n').map((line) => formatToastLine(line, style));
}

import type { ComponentType } from 'react';

import { ReplaySensitiveView } from './ReplaySensitiveView';

import type { IReplaySensitiveViewProps } from './types';

// Wraps a component so its replay pause (and native mask) mounts in the same
// commit as its content, without re-indenting the wrapped JSX.
export function withReplaySensitive<P extends object>(
  Component: ComponentType<P>,
  tag: string,
  options?: Pick<IReplaySensitiveViewProps, 'style'>,
): ComponentType<P> {
  function ReplaySensitiveComponent(props: P) {
    return (
      <ReplaySensitiveView tag={tag} style={options?.style}>
        <Component {...props} />
      </ReplaySensitiveView>
    );
  }
  ReplaySensitiveComponent.displayName = `withReplaySensitive(${
    Component.displayName || Component.name || 'Component'
  })`;
  return ReplaySensitiveComponent;
}

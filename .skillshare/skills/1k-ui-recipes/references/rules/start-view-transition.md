# Smooth State Transitions with `startViewTransition`

## Problem

When a large state update triggers a heavy re-render (e.g. switching from a placeholder to a fully initialized component tree), the UI can feel janky or flash abruptly.

## Solution

Wrap the state update in `startViewTransition`. This is a OneKey wrapper with **platform-specific behavior**:

| Platform | Behavior |
|----------|----------|
| Web / Desktop | Uses View Transition API — produces a smooth **fade-in/fade-out** effect |
| Native (iOS / Android) | **Falls back to `setTimeout`** — no visual fade, but still defers the update to the next tick to avoid blocking the current frame |

```typescript
import { startViewTransition } from '@onekeyhq/components';
```

> **Note:** On native platforms there is no fade animation. The callback is simply scheduled via `setTimeout`, which helps avoid janky synchronous re-renders but does not produce a visual transition.

## Pattern

```typescript
import { useEffect, useState } from 'react';

import { startViewTransition } from '@onekeyhq/components';

function MyComponent({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    void someAsyncInit().then((result) => {
      // Web: smooth fade transition; Native: deferred via setTimeout
      startViewTransition(() => {
        setIsReady(result);
      });
    });
  }, []);

  if (!isReady) {
    return <Placeholder />;
  }

  return children;
}
```

## When to Use

| Scenario | Use `startViewTransition`? |
|----------|--------------------------|
| Async init completing, switching from placeholder to full UI | Yes |
| Tab switching that triggers heavy re-renders | Yes |
| User typing in a search input (urgent feedback needed) | No - use `useDeferredValue` instead |
| Simple boolean toggle with minimal re-render | No - unnecessary overhead |

## Real Example

```typescript
import { useEffect, useState } from 'react';

import { startViewTransition } from '@onekeyhq/components';

export function GlobalJotaiReady({ children }: { children: any }) {
  const [isReady, setIsReady] = useState(false);
  useEffect(() => {
    void globalJotaiStorageReadyHandler.ready.then((ready) => {
      startViewTransition(() => {
        setIsReady(ready);
      });
    });
  }, []);

  if (!isReady) {
    return <View testID="GlobalJotaiReady-not-ready-placeholder" />;
  }

  return children;
}
```

## `startViewTransition` vs `useTransition`

```typescript
// startViewTransition - OneKey wrapper, no pending state
// Web: fade effect via View Transition API
// Native: falls back to setTimeout (no visual fade)
import { startViewTransition } from '@onekeyhq/components';

startViewTransition(() => {
  setState(newValue);
});

// useTransition - React hook, provides isPending for loading indicators
import { useTransition } from 'react';

const [isPending, startTransition] = useTransition();

startTransition(() => {
  setState(newValue);
});

// isPending can be used to show a spinner overlay
// while keeping the old UI visible
```

Use `useTransition` when you need to track pending state for a loading indicator. Use `startViewTransition` when you want a smooth fade on web (with graceful `setTimeout` fallback on native).

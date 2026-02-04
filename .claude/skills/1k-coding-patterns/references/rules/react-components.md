# React Components

Best practices for writing React components in OneKey.

## Core Rules

- Avoid default React import; use named imports only
- Prefer functional components over class components
- Use pure functions to create components; avoid importing `import type { FC } from 'react'`
- Follow React hooks rules (dependencies array, call only at top level)
- Use the `usePromiseResult` and `useAsyncCall` hooks with proper dependency arrays

## Code Examples

### Correct Component Pattern

```typescript
// GOOD: Named imports, functional component
import { useState, useEffect, useCallback } from 'react';
import { Stack, Button } from '@onekeyhq/components';

function MyComponent({ data }: { data: MyData }) {
  const [state, setState] = useState(null);

  const handlePress = useCallback(() => {
    // handler logic
  }, []);

  return (
    <Stack>
      <Button onPress={handlePress}>Action</Button>
    </Stack>
  );
}

export default MyComponent;
```

### Incorrect Patterns

```typescript
// BAD: Default import
import React from 'react'; // ❌

// BAD: FC type
import type { FC } from 'react';
const MyComponent: FC<Props> = () => {}; // ❌

// BAD: Class component
class MyComponent extends React.Component {} // ❌
```

## Hooks Best Practices

### useCallback

```typescript
// GOOD: Stable callback reference
const handlePress = useCallback(() => {
  doSomething(value);
}, [value]); // Include all dependencies

// BAD: Missing dependencies
const handlePress = useCallback(() => {
  doSomething(value); // ❌ value not in deps
}, []);
```

### useEffect

```typescript
// GOOD: Proper cleanup
useEffect(() => {
  const subscription = subscribe();
  return () => {
    subscription.unsubscribe();
  };
}, []);

// BAD: Missing cleanup
useEffect(() => {
  subscribe(); // ❌ No cleanup
}, []);
```

### usePromiseResult (OneKey specific)

```typescript
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';

function MyComponent() {
  const { result, isLoading } = usePromiseResult(
    async () => {
      return await fetchData();
    },
    [dependency1, dependency2], // Dependencies array
    { checkIsFocused: true }
  );

  if (isLoading) return <Loading />;
  return <DataView data={result} />;
}
```

### useAsyncCall (OneKey specific)

```typescript
import { useAsyncCall } from '@onekeyhq/kit/src/hooks/useAsyncCall';

function MyComponent() {
  const { run, isLoading, error } = useAsyncCall(async () => {
    await submitData();
  });

  return (
    <Button onPress={run} loading={isLoading}>
      Submit
    </Button>
  );
}
```

## Component Structure

### Recommended Order

```typescript
import { useState, useCallback, useMemo } from 'react';
// 1. External imports
import { Stack, Button } from '@onekeyhq/components';
// 2. Internal imports
import { useMyHook } from '../hooks/useMyHook';
// 3. Types
import type { IMyProps } from './types';

// 4. Component
function MyComponent({ prop1, prop2 }: IMyProps) {
  // 5. State
  const [state, setState] = useState(null);

  // 6. Derived state / memos
  const derivedValue = useMemo(() => compute(state), [state]);

  // 7. Callbacks
  const handlePress = useCallback(() => {
    // logic
  }, []);

  // 8. Effects
  useEffect(() => {
    // side effects
  }, []);

  // 9. Render
  return (
    <Stack>
      {/* content */}
    </Stack>
  );
}

export default MyComponent;
```

## Props Pattern

```typescript
// GOOD: Destructure props with types
function MyComponent({
  title,
  onPress,
  isDisabled = false,
}: {
  title: string;
  onPress: () => void;
  isDisabled?: boolean;
}) {
  return (
    <Button onPress={onPress} disabled={isDisabled}>
      {title}
    </Button>
  );
}

// For complex props, use interface
interface IMyComponentProps {
  title: string;
  onPress: () => void;
  isDisabled?: boolean;
}

function MyComponent({ title, onPress, isDisabled = false }: IMyComponentProps) {
  // ...
}
```

## Checklist

- [ ] No default React import
- [ ] No FC type annotation
- [ ] Functional component (not class)
- [ ] All hooks have correct dependency arrays
- [ ] useCallback for event handlers passed as props
- [ ] useMemo for expensive computations
- [ ] Proper cleanup in useEffect

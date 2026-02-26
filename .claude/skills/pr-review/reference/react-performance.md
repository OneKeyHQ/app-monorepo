# React / React Native Performance Checklist

## Re-render Prevention

### Unstable Props
- Inline objects/arrays/functions passed to memoized children cause re-renders every time
- **Fix**: Extract to module-level constants, `useMemo`, or `useCallback`

```typescript
// Bad: new object every render
<Child style={{ flex: 1 }} />

// Good: stable reference
const STYLE = { flex: 1 };
<Child style={STYLE} />
```

### Default Value Traps
- `?? []` / `?? {}` in render creates new reference each time
- **Fix**: Use module-level constant

```typescript
// Bad: new array every render when data is undefined
const list = data ?? [];

// Good: stable empty reference
const EMPTY_ARRAY: readonly string[] = [];
const list = data ?? EMPTY_ARRAY;
```

---

## Hook Dependencies

### Missing Deps → Stale Closures
- Function reads state/prop but isn't in dependency array
- Effect never re-runs when the value it depends on changes

### Extra Deps → Effect Churn / Render Loops
- Object/array in dependency array that is recreated each render
- Effect runs every render, potentially causing infinite loops

### Verification Steps
1. Check every `useMemo` / `useCallback` / `useEffect` dependency array
2. Verify all referenced state/props are included
3. Verify no unstable references are included
4. Watch for `useEffect` → `setState` → re-render → `useEffect` loops

---

## State Placement

### State Too High → Wide Re-render Fanout
- State in parent causes all children to re-render
- **Fix**: Move state closer to where it's consumed, or memoize children

### State Derived from Props
- If state is just a transform of props, use `useMemo` instead of `useState` + `useEffect`

---

## List Rendering (React Native)

### FlashList over FlatList
- Project uses FlashList for large lists — verify new lists follow this pattern
- Provide `estimatedItemSize` for optimal performance
- Use `keyExtractor` that returns stable string keys

### Virtualization
- Lists with >50 items should use virtualization
- Avoid rendering all items at once (`initialNumToRender` should be reasonable)
- Check `getItemLayout` is provided when item heights are known

### Item Memoization
- List item components should be wrapped in `memo()`
- Verify `renderItem` doesn't create new function/object refs per render

---

## Expensive Render Work

### Derived Data → useMemo
- Filtering, sorting, mapping large arrays should be memoized
- Verify dependency array is correct (not too broad, not too narrow)

### Heavy Computation → Background
- Crypto operations, large data transforms should not run on UI thread
- Use `InteractionManager.runAfterInteractions` for deferred work on RN

---

## Subscriptions & Cleanup

### Listeners / Timers
- Every `addEventListener` / `subscribe` / `setInterval` / `setTimeout` needs cleanup
- Verify `useEffect` return function unsubscribes/clears

### Async Operations After Unmount
- `setState` after component unmount causes warnings and potential bugs
- Use abort controller or mounted flag for async operations

---

## Cross-Platform Render Differences

| Concern | Native (iOS/Android) | Web | Desktop |
|---------|---------------------|-----|---------|
| List performance | FlashList + virtualization | CSS-based scroll, virtual scroll for large lists | Same as web |
| Image loading | `<Image>` with caching | `<img>` with lazy loading | Same as web |
| Animation | `react-native-reanimated` (UI thread) | CSS transitions preferred | Same as web |
| Layout | Flexbox (Yoga engine) | Flexbox (browser) | Flexbox (browser) |
| Touch handling | Gesture handlers | Click events | Click events |

### Platform-Specific Perf Tips
- **iOS**: Watch for `useLayoutEffect` causing visible jank; prefer `useEffect`
- **Android**: More sensitive to JS thread blocking — offload heavy work
- **Web**: Bundle size matters — check for unnecessary RN polyfills
- **Desktop**: Memory usage important for long-running app — check for leaks

---

## Quick Audit Commands

```bash
# Find inline objects in JSX
rg '\{\{.*\}\}' --include='*.tsx' -l

# Find potential default value traps
rg '\?\? \[\]|\?\? \{\}' --include='*.tsx' --include='*.ts' -l

# Find useEffect without cleanup
rg 'useEffect\(' --include='*.tsx' --include='*.ts' -l

# Find setState in async callbacks (potential unmount issue)
rg 'await.*\n.*set[A-Z]' --include='*.tsx' --include='*.ts' -l
```

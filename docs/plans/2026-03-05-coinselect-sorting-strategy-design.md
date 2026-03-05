# Coinselect SDK: Expose `sortingStrategy` Parameter

**Date:** 2026-03-05
**Status:** Approved

## Problem

`@onekeyfe/coinselect/witness.js` hardcodes `sortingStrategy: 'random'` when calling `composeTx()`. This causes the change output to be randomly inserted before or after the payment output (~50% chance). Certain third-party protocols require the `to` address to be the first output in the transaction.

## Decision

Expose `sortingStrategy` as an optional parameter in `witness.js`, defaulting to `'random'` for backward compatibility.

## Changes

Two files in the `@onekeyfe/coinselect` SDK:

### `witness.js`

Add `sortingStrategy = 'random'` to the function signature and pass it through to `composeTx` instead of the hardcoded value.

### `witness.d.ts`

Add `sortingStrategy?: 'bip69' | 'none' | 'random'` to `ICoinSelectParams`.

## Behavior

| `sortingStrategy` | Outputs order | Inputs order |
|---|---|---|
| `'random'` (default) | Change inserted at random position | Shuffled |
| `'none'` | `[payment, opreturn?, change?]` — to address guaranteed first | Original order |
| `'bip69'` | BIP-69 lexicographic | BIP-69 |

## Backward Compatibility

- Default value `'random'` ensures all existing callers are unaffected.
- No breaking changes.

## Callers (x-app-monorepo)

No changes required. Callers pass `sortingStrategy: 'none'` when they need deterministic output ordering for specific protocol integrations.

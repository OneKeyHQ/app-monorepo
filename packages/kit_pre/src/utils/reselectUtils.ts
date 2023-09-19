import isEqual from 'lodash/isEqual';
import { createSelectorCreator, defaultMemoize } from 'reselect';

export const createDeepEqualSelector = createSelectorCreator(
  defaultMemoize,
  isEqual,
);

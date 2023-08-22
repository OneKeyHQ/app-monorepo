import type { CleanupPolicy } from './types';

// For example:
// export const cleanupPolicies: CleanupPolicy[] = [
//   {
//     source: 'simpledb',
//     simpleDbEntity: simpleDb.history,
//     dataPath: ['items'],
//     strategy: {
//       type: 'array-slice',
//       maxToKeep: 1000,
//       keepItemsAt: 'tail',
//     },
//   } as SimpleDbCleanupPolicy<typeof simpleDb.history>,
//   {
//     source: 'redux',
//     statePath: ['discover.userBrowserHistories'],
//     strategy: {
//       type: 'array-slice',
//       maxToKeep: 1,
//       keepItemsAt: 'head',
//     },
//   }
// ];
export const cleanupPolicies: CleanupPolicy[] = [];

# React Native Startup Performance Analysis

These scripts are used to add/remove performance monitoring tracking points to all TypeScript and TSX files in the project.

## Features

### add-performance-tracking.js

This script creates corresponding performance tracking files for each `.ts` and `.tsx` file:

1. **Create Ready Files**: Create a `.perfReady.ts` or `.perfReady.tsx` file for each file
2. **Record Start Time**: Record performance tracking start time in the ready file and store it in `globalThis`
3. **Add Import Statements**: Add `/* eslint-disable import/order */` and import ready file at the beginning of the original file
4. **Add End Code**: Add performance tracking end code and log output at the end of the original file

This approach ensures:
- ✅ Performance tracking is recorded before all other code executes
- ✅ More accurate measurement of file loading time
- ✅ Follows existing project patterns (like `import './jsReady'` in `apps/mobile/index.ts`)

Automatically skips:
- Files that already have performance tracking
- Empty files
- `.d.ts` type definition files
- `node_modules`, `build`, `dist` and other directories

### remove-performance-tracking.js

This script removes all performance tracking code added by `add-performance-tracking.js`:
- Delete all `.perfReady.ts` and `.perfReady.tsx` files
- Remove import statements
- Remove end tracking code
- Remove added `eslint-disable` comments if applicable

## Usage

### Add Performance Tracking

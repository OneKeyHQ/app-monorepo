# Adding Analytics Events

## Step-by-Step Workflow

### Step 1: Decide scope and scene

Check existing scopes in `packages/shared/src/logger/logger.ts` (DefaultLogger class). Each scope maps to a feature domain:

| Scope | Domain | Example scenes |
|-------|--------|----------------|
| `dex` | DEX/Market trading | banner, enter, swap, watchlist, list, actions, tradingView |
| `transaction` | Send/receive | send, receive |
| `hardware` | Hardware wallet | sdkLog, homescreen, verify, liteCard |
| `market` | Market info (scopeName=`token`) | token |
| `swap` | Token swapping | swap |
| `ui` | UI interactions | button |
| `app` | App lifecycle | bootstrap |
| `update` | Firmware updates (scopeName=`app`) | app, firmware |

**Rule:** Add to existing scope/scene if the event belongs to that domain. Only create a new scope for an entirely new feature domain.

### Step 2: Define event params type

Create or extend types in the scope's `types.ts` file:

```typescript
// packages/shared/src/logger/scopes/{scope}/types.ts
export interface IMyEventParams {
  deviceType: string;
  firmwareType: 'btconly' | 'universal';
}
```

Use specific types over `string` when possible. Use enums for fixed values:

```typescript
export enum EFirmwareTrackingType {
  BtcOnly = 'btconly',
  Universal = 'universal',
}
```

### Step 3: Create scene method

```typescript
// packages/shared/src/logger/scopes/{scope}/scenes/{scene}.ts
import { BaseScene } from '../../../base/baseScene';
import { LogToServer } from '../../../base/decorators';

export class MyFeatureScene extends BaseScene {
  /**
   * Track when user performs a specific action
   */
  @LogToServer()
  public myFeatureAction(params: {
    actionType: string;
    source: string;
  }) {
    return params;
  }
}
```

Key rules:
- Method name = Mixpanel event name (camelCase, e.g., `hwDeviceConnected`)
- **MUST return params synchronously** — never `async`, never return a Promise
- Use `@LogToServer()` for analytics events
- Add `@LogToLocal()` below `@LogToServer()` if you also want device-side logging
- Add JSDoc comment explaining what the event tracks

### Step 4: Register scene in scope

```typescript
// packages/shared/src/logger/scopes/{scope}/index.ts
import { BaseScope } from '../../base/baseScope';
import { EScopeName } from '../../types';
import { MyFeatureScene } from './scenes/myFeature';

export class MyScope extends BaseScope {
  protected override scopeName = EScopeName.myScope;

  // ... existing scenes ...

  myFeature = this.createScene('myFeature', MyFeatureScene);
}
```

**Note:** Some scopes use a different `EScopeName` than their class name. For example, `MarketScope` uses `EScopeName.token` and `UpdateScope` uses `EScopeName.app`. Always check the actual scope file to confirm.

### Step 5: (If new scope) Register in DefaultLogger and EScopeName

Only needed when creating an entirely new scope:

1. Add to `EScopeName` in `packages/shared/src/logger/types.ts`
2. Create scope class in `packages/shared/src/logger/scopes/{newScope}/index.ts`
3. Add instance to `DefaultLogger` in `packages/shared/src/logger/logger.ts`

### Step 6: Call from business code

```typescript
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

// In business logic
defaultLogger.myScope.myFeature.myFeatureAction({
  actionType: 'click',
  source: 'homepage',
});
```

## Full Example: Adding a new event to existing scope

Goal: Track firmware switch start event.

**1. Add method to existing scene** (`packages/shared/src/logger/scopes/update/scenes/firmware.ts`):

```typescript
import { BaseScene } from '../../../base/baseScene';
import { LogToServer } from '../../../base/decorators';
import type { IDeviceType } from '@onekeyfe/hd-core';
import type { EFirmwareType } from '../../../../types/device';

export class FirmwareScene extends BaseScene {
  // ... existing methods ...

  @LogToServer()
  public firmwareSwitchStart(params: {
    deviceType: IDeviceType | undefined;
    fromFirmwareType: EFirmwareType | undefined;
    toFirmwareType: EFirmwareType | undefined;
  }) {
    return params;
  }
}
```

**2. Call from UI** (`packages/kit/src/views/FirmwareUpdate/components/FirmwareChangeLogView.tsx`):

```typescript
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

// Inside event handler, after user confirms
if (fromFirmwareType !== toFirmwareType) {
  defaultLogger.update.firmware.firmwareSwitchStart({
    deviceType: result?.deviceType,
    fromFirmwareType,
    toFirmwareType,
  });
}
```

## Full Example: Adding a new scene to existing scope

> This example is based on PR #10419 (proposed, not yet merged). It demonstrates the pattern for adding a new scene.

Goal: Track hardware device connections.

**1. Create new scene file** (`packages/shared/src/logger/scopes/hardware/scenes/connection.ts`):

```typescript
import { BaseScene } from '../../../base/baseScene';
import { LogToServer } from '../../../base/decorators';
import type { IDeviceType } from '@onekeyfe/hd-core';

export class HardwareConnectionScene extends BaseScene {
  @LogToServer()
  public hwDeviceConnected(params: {
    deviceType: IDeviceType;
    firmwareType: 'btconly' | 'universal';
  }) {
    return params;
  }
}
```

**2. Register in scope index** (`packages/shared/src/logger/scopes/hardware/index.ts`):

```typescript
import { HardwareConnectionScene } from './scenes/connection';

export class HardwareScope extends BaseScope {
  // ... existing scenes ...
  connection = this.createScene('connection', HardwareConnectionScene);
}
```

**3. Call from service** (`packages/kit-bg/src/services/ServiceHardware/ServiceHardware.ts`):

```typescript
defaultLogger.hardware.connection.hwDeviceConnected({
  deviceType,
  firmwareType: firmwareType === EFirmwareType.BitcoinOnly ? 'btconly' : 'universal',
});
```

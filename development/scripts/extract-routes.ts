/**
 * Script to extract all navigable routes and generate Mode 1 JSON payloads
 * for the notification system page navigation.
 *
 * Usage: npx tsx development/scripts/extract-routes.ts
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROUTES_DIR = path.join(__dirname, '../../packages/shared/src/routes');

const OUTPUT_DIR = path.join(__dirname, '../../build/routes');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'ROUTES.md');
const JSON_OUTPUT_FILE = path.join(OUTPUT_DIR, 'routes.json');

interface IRouteInfo {
  modalName: string;
  modalRouteName: string;
  rootRoute: string;
  enumName: string;
  fileName: string;
  screens: IScreenInfo[];
}

interface IScreenInfo {
  name: string;
  hasParams: boolean;
  requiredParams: string[];
  optionalParams: string[];
  rawParamsType: string;
}

// Root route for each enum (modal, onboarding, main, gallery)
const ROOT_ROUTE_MAPPING: Record<string, string> = {
  // Onboarding routes (direct under 'onboarding' root)
  EOnboardingPages: 'onboarding',

  // Main/Tab routes (direct under 'main' root)
  ETabRoutes: 'main',
  ETabHomeRoutes: 'main',
  ETabMarketRoutes: 'main',
  ETabSwapRoutes: 'main',
  ETabDiscoveryRoutes: 'main',
  ETabEarnRoutes: 'main',
  ETabDeveloperRoutes: 'main',
  ETabDeviceManagementRoutes: 'main',
  ETabReferFriendsRoutes: 'main',

  // Gallery routes (direct under 'gallery' root)
  EGalleryRoutes: 'gallery',

  // All other routes default to 'modal'
};

// Mapping from Tab sub-routes enum to parent Tab name (for 3-level main routes)
// Structure: main -> tabName -> screenName
const TAB_ROUTE_MAPPING: Record<string, string> = {
  ETabHomeRoutes: 'Home',
  ETabMarketRoutes: 'Market',
  ETabSwapRoutes: 'Swap',
  ETabDiscoveryRoutes: 'Discovery',
  ETabEarnRoutes: 'Earn',
  ETabDeveloperRoutes: 'Developer',
  ETabDeviceManagementRoutes: 'DeviceManagement',
  ETabReferFriendsRoutes: 'ReferFriends',
};

// Mapping from route file enum to EModalRoutes name (for modal routes)
const MODAL_ROUTE_MAPPING: Record<string, string> = {
  EPrimePages: 'PrimeModal',
  EModalSettingRoutes: 'SettingModal',
  EModalStakingRoutes: 'StakingModal',
  EModalSwapRoutes: 'SwapModal',
  EModalSendRoutes: 'SendModal',
  EModalReceiveRoutes: 'ReceiveModal',
  EModalAssetDetailRoutes: 'MainModal',
  EModalAssetListRoutes: 'MainModal',
  EModalNotificationsRoutes: 'NotificationsModal',
  EDiscoveryModalRoutes: 'DiscoveryModal',
  EModalFiatCryptoRoutes: 'FiatCryptoModal',
  EModalReferFriendsRoutes: 'ReferFriendsModal',
  EModalDeviceManagementRoutes: 'DeviceManagementModal',
  ECloudBackupRoutes: 'CloudBackupModal',
  EModalKeyTagRoutes: 'KeyTagModal',
  EModalAddressBookRoutes: 'AddressBookModal',
  EModalWebViewRoutes: 'WebViewModal',
  EModalFirmwareUpdateRoutes: 'FirmwareUpdateModal',
  EAssetSelectorRoutes: 'AssetSelectorModal',
  EAccountManagerStacksRoutes: 'AccountManagerStacks',
  EOnboardingRoutes: 'OnboardingModal',
  EModalSignatureConfirmRoutes: 'SignatureConfirmModal',
  EModalApprovalManagementRoutes: 'ApprovalManagementModal',
  EModalBulkCopyAddressesRoutes: 'BulkCopyAddressesModal',
  EModalShortcutsRoutes: 'ShortcutsModal',
  EModalSignAndVerifyRoutes: 'SignAndVerifyModal',
  EModalPerpRoutes: 'PerpModal',
  ELiteCardRoutes: 'LiteCardModal',
  EManualBackupRoutes: 'ManualBackupModal',
  EModalWalletAddressRoutes: 'WalletAddress',
  EModalRewardCenterRoutes: 'MainModal',
  EAppUpdateRoutes: 'AppUpdateModal',
  EModalNetworkDoctorRoutes: 'NetworkDoctorModal',
  EUniversalSearchRoutes: 'UniversalSearchModal',
};

// Common params that should use local template variables
const LOCAL_PARAM_MAPPINGS: Record<string, string> = {
  accountId: '{local_accountId}',
  networkId: '{local_networkId}',
  walletId: '{local_walletId}',
  indexedAccountId: '{local_indexedAccountId}',
};

// Known base types and their params
const BASE_TYPE_PARAMS: Record<
  string,
  { required: string[]; optional: string[] }
> = {
  IBaseRouteParams: {
    required: ['networkId', 'accountId'],
    optional: ['indexedAccountId'],
  },
  IDetailPageInfoParams: {
    required: ['networkId', 'accountId'],
    optional: [
      'indexedAccountId',
      'protocolInfo',
      'tokenInfo',
      'symbol',
      'provider',
    ],
  },
};

function extractEnumMembers(content: string, enumName: string): string[] {
  const enumRegex = new RegExp(
    `export\\s+enum\\s+${enumName}\\s*\\{([^}]+)\\}`,
    's',
  );
  const match = content.match(enumRegex);
  if (!match) return [];

  const enumBody = match[1];
  const memberRegex = /(\w+)\s*=\s*['"](\w+)['"]/g;
  const members: string[] = [];

  for (
    let memberMatch = memberRegex.exec(enumBody);
    memberMatch !== null;
    memberMatch = memberRegex.exec(enumBody)
  ) {
    members.push(memberMatch[1]);
  }

  return members;
}

function parseTypeParams(typeStr: string): {
  required: string[];
  optional: string[];
} {
  const required: string[] = [];
  const optional: string[] = [];

  // Check for base type references
  for (const [baseType, params] of Object.entries(BASE_TYPE_PARAMS)) {
    if (typeStr.includes(baseType)) {
      required.push(...params.required);
      optional.push(...params.optional);
    }
  }

  // Parse inline object properties - handle nested braces
  let braceCount = 0;
  let currentProp = '';
  let inObject = false;

  for (let i = 0; i < typeStr.length; i += 1) {
    const char = typeStr[i];

    if (char === '{') {
      braceCount += 1;
      if (braceCount === 1) {
        inObject = true;
      }
    } else if (char === '}') {
      braceCount -= 1;
      if (braceCount === 0) {
        inObject = false;
      }
    }

    if (inObject && braceCount === 1 && char !== '{') {
      if (char === ';' || char === '\n') {
        // Process the property
        const propMatch = currentProp.trim().match(/^(\w+)(\?)?:/);
        if (propMatch) {
          const propName = propMatch[1];
          const isOptional = propMatch[2] === '?';
          if (!required.includes(propName) && !optional.includes(propName)) {
            if (isOptional) {
              optional.push(propName);
            } else {
              required.push(propName);
            }
          }
        }
        currentProp = '';
      } else {
        currentProp += char;
      }
    }
  }

  // Process last property if any
  if (currentProp.trim()) {
    const propMatch = currentProp.trim().match(/^(\w+)(\?)?:/);
    if (propMatch) {
      const propName = propMatch[1];
      const isOptional = propMatch[2] === '?';
      if (!required.includes(propName) && !optional.includes(propName)) {
        if (isOptional) {
          optional.push(propName);
        } else {
          required.push(propName);
        }
      }
    }
  }

  return { required, optional };
}

function extractParamInfo(
  content: string,
  enumName: string,
  screenName: string,
): { hasParams: boolean; required: string[]; optional: string[]; raw: string } {
  // Find the param list type
  const paramListMatch = content.match(
    new RegExp(`\\[${enumName}\\.${screenName}\\]\\s*:\\s*([^;]+);`, 's'),
  );

  if (!paramListMatch) {
    return { hasParams: false, required: [], optional: [], raw: 'unknown' };
  }

  const paramType = paramListMatch[1].trim();

  if (paramType === 'undefined') {
    return { hasParams: false, required: [], optional: [], raw: 'undefined' };
  }

  const { required, optional } = parseTypeParams(paramType);

  return {
    hasParams: required.length > 0 || optional.length > 0,
    required,
    optional,
    raw: paramType.replace(/\s+/g, ' ').substring(0, 300),
  };
}

function extractRoutes(): IRouteInfo[] {
  const routeFiles = fs
    .readdirSync(ROUTES_DIR)
    .filter((f) => f.endsWith('.ts') && f !== 'index.ts');

  const routes: IRouteInfo[] = [];

  for (const file of routeFiles) {
    const filePath = path.join(ROUTES_DIR, file);
    const content = fs.readFileSync(filePath, 'utf-8');

    // Find all enum declarations
    const enumRegex = /export\s+enum\s+(E\w+(?:Routes|Pages)?)\s*\{/g;

    for (
      let enumMatch = enumRegex.exec(content);
      enumMatch !== null;
      enumMatch = enumRegex.exec(content)
    ) {
      const enumName = enumMatch[1];

      // Only process route enums
      if (enumName.includes('Route') || enumName.includes('Pages')) {
        const screenNames = extractEnumMembers(content, enumName);
        const rootRoute = ROOT_ROUTE_MAPPING[enumName] || 'modal';
        const modalRouteName =
          MODAL_ROUTE_MAPPING[enumName] ||
          enumName
            .replace('EModal', '')
            .replace('Routes', 'Modal')
            .replace('Pages', 'Modal');

        const screens: IScreenInfo[] = screenNames.map((name) => {
          const paramInfo = extractParamInfo(content, enumName, name);
          return {
            name,
            hasParams: paramInfo.hasParams,
            requiredParams: paramInfo.required,
            optionalParams: paramInfo.optional,
            rawParamsType: paramInfo.raw,
          };
        });

        if (screens.length > 0) {
          routes.push({
            modalName: enumName
              .replace('EModal', '')
              .replace('Routes', '')
              .replace('Pages', '')
              .replace(/^E/, ''),
            modalRouteName,
            rootRoute,
            enumName,
            fileName: file,
            screens,
          });
        }
      }
    }
  }

  return routes;
}

function generatePayload(
  rootRoute: string,
  modalRouteName: string,
  screenName: string,
  requiredParams: string[],
  enumName: string,
): object {
  const params: Record<string, string> = {};

  // Add required params with local template variables or placeholder
  for (const param of requiredParams) {
    if (LOCAL_PARAM_MAPPINGS[param]) {
      params[param] = LOCAL_PARAM_MAPPINGS[param];
    } else {
      params[param] = `<${param}>`;
    }
  }

  const screenParams: Record<string, unknown> =
    Object.keys(params).length > 0
      ? { screen: screenName, params }
      : { screen: screenName };

  // For 'modal' root: 3 levels (modal -> modalRouteName -> screenName)
  if (rootRoute === 'modal') {
    return {
      screen: rootRoute,
      params: {
        screen: modalRouteName,
        params: screenParams,
      },
    };
  }

  // For 'main' root with Tab sub-routes: 3 levels (main -> tabName -> screenName)
  const tabName = TAB_ROUTE_MAPPING[enumName];
  if (rootRoute === 'main' && tabName) {
    return {
      screen: rootRoute,
      params: {
        screen: tabName,
        params: screenParams,
      },
    };
  }

  // For other roots (onboarding, gallery) or main without tab: 2 levels (root -> screenName)
  if (Object.keys(params).length > 0) {
    return {
      screen: rootRoute,
      params: {
        screen: screenName,
        params,
      },
    };
  }

  return {
    screen: rootRoute,
    params: {
      screen: screenName,
    },
  };
}

function generateMode1Json(payload: object): string {
  return JSON.stringify(
    {
      mode: 1,
      payload,
    },
    null,
    2,
  );
}

function generateMarkdown(routes: IRouteInfo[]): string {
  let md = `# Mode 1: Page Navigation - Ready-to-Use Payloads

> Auto-generated Mode 1 JSON payloads for notification system page navigation.
>
> Generated at: ${new Date().toISOString()}

## How to Use

Copy the JSON payload and use it in your notification configuration:

\`\`\`json
{
  "mode": 1,
  "payload": {
    "screen": "modal",
    "params": {
      "screen": "<ModalName>",
      "params": {
        "screen": "<ScreenName>",
        "params": { ... }
      }
    }
  }
}
\`\`\`

## Available Local Parameters

These template variables will be replaced with current context values:

| Variable | Description |
|----------|-------------|
| \`{local_accountId}\` | Current account ID |
| \`{local_indexedAccountId}\` | Current indexed account ID |
| \`{local_networkId}\` | Current network ID |
| \`{local_walletId}\` | Current wallet ID |

---

## Quick Navigation Index

`;

  // Generate index
  const sortedRoutes = routes.toSorted((a, b) =>
    a.modalName.localeCompare(b.modalName),
  );
  for (const route of sortedRoutes) {
    if (route.screens.length > 0) {
      md += `- [${route.modalName}](#${route.modalName.toLowerCase()})\n`;
    }
  }

  md += '\n---\n\n';

  for (const route of sortedRoutes) {
    md += `## ${route.modalName}\n\n`;
    md += `**Root**: \`${route.rootRoute}\` | **Modal**: \`${route.modalRouteName}\` | **Source**: \`${route.fileName}\`\n\n`;

    for (const screen of route.screens) {
      md += `### ${screen.name}\n\n`;

      const payload = generatePayload(
        route.rootRoute,
        route.modalRouteName,
        screen.name,
        screen.requiredParams,
        route.enumName,
      );

      // Show params info
      if (screen.hasParams) {
        if (screen.requiredParams.length > 0) {
          md += `**Required**: ${screen.requiredParams
            .map((p) => `\`${p}\``)
            .join(', ')}\n\n`;
        }
        if (screen.optionalParams.length > 0) {
          md += `**Optional**: ${screen.optionalParams
            .map((p) => `\`${p}\``)
            .join(', ')}\n\n`;
        }
      }

      // Complete Mode 1 JSON (ready to copy)
      md += `\`\`\`json\n${generateMode1Json(payload)}\n\`\`\`\n\n`;

      md += '---\n\n';
    }
  }

  return md;
}

function generateJsonOutput(routes: IRouteInfo[]): object {
  const output: Record<string, Record<string, object>> = {};

  for (const route of routes) {
    const modalScreens: Record<string, object> = {};

    for (const screen of route.screens) {
      const payload = generatePayload(
        route.rootRoute,
        route.modalRouteName,
        screen.name,
        screen.requiredParams,
        route.enumName,
      );

      modalScreens[screen.name] = {
        rootRoute: route.rootRoute,
        modalRouteName: route.modalRouteName,
        screenName: screen.name,
        hasParams: screen.hasParams,
        requiredParams: screen.requiredParams,
        optionalParams: screen.optionalParams,
        payload,
        mode1Json: {
          mode: 1,
          payload,
        },
      };
    }

    output[route.modalName] = modalScreens;
  }

  return {
    generatedAt: new Date().toISOString(),
    localParams: {
      '{local_accountId}': 'Current account ID',
      '{local_indexedAccountId}': 'Current indexed account ID',
      '{local_networkId}': 'Current network ID',
      '{local_walletId}': 'Current wallet ID',
    },
    routes: output,
  };
}

async function main() {
  console.log('📂 Extracting routes from:', ROUTES_DIR);

  const routes = extractRoutes();

  const totalScreens = routes.reduce((sum, r) => sum + r.screens.length, 0);
  console.log(
    `✅ Found ${routes.length} modal routes with ${totalScreens} total screens`,
  );

  const markdown = generateMarkdown(routes);

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  fs.writeFileSync(OUTPUT_FILE, markdown);
  console.log('📄 Markdown generated:', OUTPUT_FILE);

  const jsonData = generateJsonOutput(routes);
  fs.writeFileSync(JSON_OUTPUT_FILE, JSON.stringify(jsonData, null, 2));
  console.log('📋 JSON generated:', JSON_OUTPUT_FILE);

  // Print summary
  console.log('\n📊 Summary by Modal:');
  for (const route of routes
    .toSorted((a, b) => b.screens.length - a.screens.length)
    .slice(0, 10)) {
    console.log(
      `   ${route.modalName} (${route.modalRouteName}): ${route.screens.length} screens`,
    );
  }

  console.log('\n✨ Done! Output generated at: build/routes/');
  console.log('   - ROUTES.md');
  console.log('   - routes.json');
}

main().catch(console.error);

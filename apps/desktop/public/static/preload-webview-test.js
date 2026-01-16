/* eslint-disable no-undef */
/* eslint-disable no-plusplus */
/* eslint-disable import/no-dynamic-require */
// preload-webview-test.js - Test Electron API access in webview environment
console.log('=== WEBVIEW Electron API Access Test ===');

// Add identifier to distinguish environment
// eslint-disable-next-line no-undef
globalThis.WEBVIEW_TEST = true;

try {
  const electron = require('electron');

  console.log('\n[WEBVIEW] 1. Available Electron modules:');
  console.log('Total modules found:', Object.keys(electron).length);

  Object.keys(electron).forEach((module) => {
    const moduleType = typeof electron[module];
    const moduleValue = electron[module];
    console.log(`  ✅ ${module}: ${moduleType}`);

    // If it's an object, show its properties
    if (moduleType === 'object' && moduleValue) {
      const props = Object.getOwnPropertyNames(moduleValue);
      if (props.length > 0) {
        console.log(
          `    Properties: ${props.slice(0, 5).join(', ')}${
            props.length > 5 ? '...' : ''
          }`,
        );
      }
    }
  });

  console.log('\n[WEBVIEW] 2. ipcRenderer detailed analysis:');
  if (electron.ipcRenderer) {
    const ipcRenderer = electron.ipcRenderer;

    // Test all ipcRenderer methods
    const ipcMethods = [
      'send',
      'sendSync',
      'sendTo',
      'sendToHost',
      'invoke',
      'postMessage',
      'on',
      'once',
      'removeListener',
      'removeAllListeners',
    ];

    ipcMethods.forEach((method) => {
      const exists = typeof ipcRenderer[method] === 'function';
      console.log(
        `  ${exists ? '✅' : '❌'} ipcRenderer.${method}: ${
          exists ? 'Available' : 'Not available'
        }`,
      );
    });

    // Test sendToHost (webview specific)
    if (typeof ipcRenderer.sendToHost === 'function') {
      console.log(
        '  🎯 sendToHost is available - this confirms webview environment',
      );

      // Send test message to host
      try {
        ipcRenderer.sendToHost('webview-test-message', {
          timestamp: Date.now(),
          availableModules: Object.keys(electron),
          userAgent: navigator.userAgent,
        });
        console.log('  ✅ Successfully sent test message to host');
      } catch (error) {
        console.log('  ❌ Failed to send message to host:', error.message);
      }
    }
  }

  console.log('\n[WEBVIEW] 3. Node.js modules access test:');
  const criticalModules = [
    'fs',
    'path',
    'os',
    'crypto',
    'child_process',
    'net',
    'http',
    'https',
    'stream',
    'events',
  ];

  const accessResults = {};

  criticalModules.forEach((moduleName) => {
    try {
      const module = require(moduleName);
      const hasModule = !!module;
      accessResults[moduleName] = hasModule;

      console.log(
        `  ${hasModule ? '🔥' : '❌'} ${moduleName}: ${
          hasModule ? 'ACCESSIBLE' : 'Not accessible'
        }`,
      );

      // For critical modules, test specific methods
      if (hasModule) {
        if (moduleName === 'fs') {
          console.log(`    - readFileSync: ${typeof module.readFileSync}`);
          console.log(`    - writeFileSync: ${typeof module.writeFileSync}`);
          console.log(`    - existsSync: ${typeof module.existsSync}`);
        } else if (moduleName === 'child_process') {
          console.log(`    - exec: ${typeof module.exec}`);
          console.log(`    - spawn: ${typeof module.spawn}`);
        } else if (moduleName === 'os') {
          console.log(`    - homedir: ${typeof module.homedir}`);
          console.log(`    - platform: ${typeof module.platform}`);
        }
      }
    } catch (error) {
      accessResults[moduleName] = false;
      console.log(`  ❌ ${moduleName}: Blocked - ${error.message}`);
    }
  });

  console.log('\n[WEBVIEW] 4. Comprehensive security breach test:');
  let securityScore = 0;
  let totalTests = 0;

  // Test 1: File system reading
  totalTests++;
  try {
    const fs = require('fs');
    const testContent = fs.readFileSync(__filename, 'utf8');
    console.log(
      `  🚨 SECURITY RISK: Can read files (${testContent.length} chars)`,
    );
    securityScore++;
  } catch (error) {
    console.log(`  ✅ File reading blocked: ${error.message}`);
  }

  // Test 2: System information access
  totalTests++;
  try {
    const os = require('os');
    const info = {
      homedir: os.homedir(),
      platform: os.platform(),
      hostname: os.hostname(),
      userInfo: os.userInfo(),
    };
    console.log(`  🚨 SECURITY RISK: Can access system info:`, info);
    securityScore++;
  } catch (error) {
    console.log(`  ✅ System info access blocked: ${error.message}`);
  }

  // Test 3: Process execution
  totalTests++;
  try {
    require('child_process');
    console.log(`  🚨 CRITICAL RISK: Can execute processes!`);
    securityScore++;
  } catch (error) {
    console.log(`  ✅ Process execution blocked: ${error.message}`);
  }

  // Test 4: Network access
  totalTests++;
  try {
    const net = require('net');
    const http = require('http');
    console.log(
      `  🚨 SECURITY RISK: Can access network modules (net: ${typeof net.createServer}, http: ${typeof http.createServer})`,
    );
    securityScore++;
  } catch (error) {
    console.log(`  ✅ Network modules blocked: ${error.message}`);
  }

  // Test 5: Main process Electron APIs
  totalTests++;
  try {
    const { app, BrowserWindow, dialog } = electron;
    if (app || BrowserWindow || dialog) {
      console.log(
        `  🚨 CRITICAL RISK: Can access main process APIs! (app: ${!!app}, BrowserWindow: ${!!BrowserWindow}, dialog: ${!!dialog})`,
      );
      securityScore++;
    } else {
      console.log(`  ✅ Main process APIs not accessible`);
    }
  } catch (error) {
    console.log(`  ✅ Main process APIs blocked: ${error.message}`);
  }

  // Test 6: Dangerous ipcRenderer methods
  totalTests++;
  try {
    if (
      electron.ipcRenderer &&
      (electron.ipcRenderer.send || electron.ipcRenderer.invoke)
    ) {
      console.log(
        `  🚨 SECURITY RISK: Can directly communicate with main process! (send: ${!!electron
          .ipcRenderer.send}, invoke: ${!!electron.ipcRenderer.invoke})`,
      );
      securityScore++;
    } else {
      console.log(`  ✅ Direct main process communication blocked`);
    }
  } catch (error) {
    console.log(
      `  ✅ IPC main process communication blocked: ${error.message}`,
    );
  }

  // Test 7: Shell and external access
  totalTests++;
  try {
    const { shell } = electron;
    if (shell && shell.openExternal) {
      console.log(
        `  🚨 SECURITY RISK: Can access shell APIs! (openExternal: ${typeof shell.openExternal})`,
      );
      securityScore++;
    } else {
      console.log(`  ✅ Shell APIs not accessible`);
    }
  } catch (error) {
    console.log(`  ✅ Shell APIs blocked: ${error.message}`);
  }

  // Test 8: Clipboard access
  totalTests++;
  try {
    const { clipboard } = electron;
    if (clipboard && clipboard.readText) {
      console.log(
        `  🚨 SECURITY RISK: Can access clipboard! (readText: ${typeof clipboard.readText})`,
      );
      securityScore++;
    } else {
      console.log(`  ✅ Clipboard access blocked`);
    }
  } catch (error) {
    console.log(`  ✅ Clipboard access blocked: ${error.message}`);
  }

  // Test 9: Screen capture access
  totalTests++;
  try {
    const { desktopCapturer, screen } = electron;
    if (desktopCapturer || screen) {
      console.log(
        `  🚨 SECURITY RISK: Can access screen APIs! (desktopCapturer: ${!!desktopCapturer}, screen: ${!!screen})`,
      );
      securityScore++;
    } else {
      console.log(`  ✅ Screen APIs not accessible`);
    }
  } catch (error) {
    console.log(`  ✅ Screen APIs blocked: ${error.message}`);
  }

  // Test 10: Environment variables access
  totalTests++;
  try {
    const envVars = process.env;
    if (envVars && Object.keys(envVars).length > 0) {
      const allKeys = Object.keys(envVars);
      const sensitiveKeys = allKeys.filter(
        (key) =>
          key.toLowerCase().includes('password') ||
          key.toLowerCase().includes('secret') ||
          key.toLowerCase().includes('key') ||
          key.toLowerCase().includes('token') ||
          key.toLowerCase().includes('auth') ||
          key.toLowerCase().includes('api') ||
          key.toLowerCase().includes('private'),
      );

      console.log(
        `  🚨 SECURITY RISK: Can access environment variables! (${allKeys.length} vars, ${sensitiveKeys.length} potentially sensitive)`,
      );

      // Print all environment variables in collapsed groups
      console.groupCollapsed(
        `📋 All Environment Variables (${allKeys.length} total)`,
      );
      allKeys.toSorted().forEach((key) => {
        const value = envVars[key];
        const isSensitive = sensitiveKeys.includes(key);
        const displayValue =
          isSensitive && value
            ? `${value.substring(0, 8)}${'*'.repeat(
                Math.max(0, value.length - 8),
              )}`
            : value;
        console.log(`${isSensitive ? '🔑' : '📝'} ${key} = ${displayValue}`);
      });
      console.groupEnd();

      if (sensitiveKeys.length > 0) {
        console.groupCollapsed(
          `🔑 Potentially Sensitive Variables (${sensitiveKeys.length} found)`,
        );
        sensitiveKeys.forEach((key) => {
          const value = envVars[key];
          const maskedValue = value
            ? `${value.substring(0, 8)}${'*'.repeat(
                Math.max(0, value.length - 8),
              )}`
            : 'undefined';
          console.warn(
            `🚨 ${key} = ${maskedValue} (${value ? value.length : 0} chars)`,
          );
        });
        console.groupEnd();
      }

      // System PATH analysis
      if (envVars.PATH) {
        const pathEntries = envVars.PATH.split(
          process.platform === 'win32' ? ';' : ':',
        );
        console.groupCollapsed(
          `🛣️ System PATH Analysis (${pathEntries.length} entries)`,
        );
        pathEntries.forEach((path, index) => {
          console.log(`${index + 1}. ${path}`);
        });
        console.groupEnd();
      }

      securityScore++;
    } else {
      console.log(`  ✅ Environment variables not accessible`);
    }
  } catch (error) {
    console.log(`  ✅ Environment variables blocked: ${error.message}`);
  }

  // Test 11: File system write operations
  totalTests++;
  try {
    const fs = require('fs');
    const tempPath = require('path').join(
      require('os').tmpdir(),
      `webview-test-${Date.now()}.txt`,
    );
    fs.writeFileSync(tempPath, 'security test');
    fs.unlinkSync(tempPath);
    console.log(`  🚨 CRITICAL RISK: Can write to file system!`);
    securityScore++;
  } catch (error) {
    console.log(`  ✅ File system write blocked: ${error.message}`);
  }

  // Test 12: Remote module access (if available)
  totalTests++;
  try {
    const { remote } = electron;
    if (remote) {
      console.log(
        `  🚨 CRITICAL RISK: Remote module is accessible! This is extremely dangerous!`,
      );
      securityScore++;
    } else {
      console.log(`  ✅ Remote module not accessible (good, it's deprecated)`);
    }
  } catch (error) {
    console.log(`  ✅ Remote module blocked: ${error.message}`);
  }

  console.log(
    `\n[WEBVIEW] Security Assessment: ${securityScore}/${totalTests} risks detected`,
  );
  if (securityScore > 0) {
    console.log('  🚨 WEBVIEW IS NOT SECURE - Node.js access is available!');
  } else {
    console.log('  ✅ Webview appears to be properly sandboxed');
  }

  console.log('\n[WEBVIEW] 5. Environment information:');
  console.log(`  - User Agent: ${navigator.userAgent}`);
  console.log(`  - Location: ${globalThis.location?.href || 'N/A'}`);
  console.log(`  - Document ready state: ${document.readyState}`);
  console.log(`  - Process PID: ${process?.pid || 'N/A'}`);

  // Expose results to webpage
  globalThis.ELECTRON_ACCESS_RESULTS = {
    electronModules: Object.keys(electron),
    nodeAccess: accessResults,
    securityRisks: securityScore,
    environment: 'webview',
  };
} catch (error) {
  console.error('[WEBVIEW] Failed to access electron:', error);
  globalThis.ELECTRON_ACCESS_RESULTS = {
    error: error.message,
    environment: 'webview',
  };
}

console.log('\n=== WEBVIEW Test Complete ===');

// Listen for messages from host
if (typeof require !== 'undefined') {
  try {
    const { ipcRenderer } = require('electron');
    if (ipcRenderer && ipcRenderer.on) {
      ipcRenderer.on('host-to-webview-test', (event, data) => {
        console.log('[WEBVIEW] Received message from host:', data);
      });
    }
  } catch (error) {
    console.log('❌ [WEBVIEW] Cannot set up IPC listener:', error.message);
  }
}

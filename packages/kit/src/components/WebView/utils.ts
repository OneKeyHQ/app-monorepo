/**
 * Creates an injectable script to post a message to the WebView window
 * @param message - The message to be posted to the WebView window
 * @returns A string containing the injectable script
 */
export const createMessageInjectedScript = (message: unknown): string => {
  const script = `
    (function() {
      try {
        window.postMessage(${JSON.stringify(message)});
      } catch (error) {
        console.error('Failed to send message via injected script:', error);
      }
    })();
  `;
  return script;
};

/**
 * Creates an injectable script to dynamically log a message to the WebView console
 * @param message - The message to be logged to the WebView console
 * @param level - The log level (log, info, warn, error)
 * @returns A string containing the injectable script
 */
export const createConsoleLogInjectedScript = (
  message: unknown, 
  level: 'log' | 'info' | 'warn' | 'error' = 'log'
): string => {
  const script = `
    (function() {
      try {
        console.${level}('OneKey WebView:', ${JSON.stringify(message)});
      } catch (error) {
        console.error('Failed to log message via injected script:', error);
      }
    })();
  `;
  return script;
};

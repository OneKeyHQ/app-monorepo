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

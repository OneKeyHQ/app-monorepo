function createCodeWithScriptTag({ code }: { code: string }): string {
  // TODO script id check, only inject once.
  return `
    (function(){
      const s = document.createElement('script');
      s.setAttribute('async', 'false');
      s.textContent=${JSON.stringify(code)};
      document.head.appendChild(s);
    })();
  `;
}

function createCodeJsBridgeReceive(payloadStr: string): string {
  return `
    window.onekey.jsBridge.receive(${JSON.stringify(payloadStr)});
  `;
}

export default {
  createCodeWithScriptTag,
  createCodeJsBridgeReceive,
};

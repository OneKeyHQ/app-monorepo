function createCodeWithScriptTag({ code }: { code: string }): string {
  // TODO script id check, only inject once.
  return `
    (function(){
      const s = document.createElement('script');
      s.setAttribute('async', 'false');
      s.setAttribute('data-onekey-injected', 'true');
      s.textContent=${JSON.stringify(code)};
      (document.head || document.documentElement).appendChild(s);
      s.remove();
    })();
  `;
}

function injectCodeWithScriptTag({
  code,
  file,
  remove = true,
}: {
  code?: string;
  file?: string;
  remove?: boolean;
}): void {
  console.log('injectCodeWithScriptTag: ', { remove, file });
  (function () {
    const s = document.createElement('script');
    s.setAttribute('async', 'false');
    s.setAttribute('defer', 'false');
    s.setAttribute('data-onekey-injected', 'true');
    if (code) {
      s.textContent = JSON.stringify(code);
    }
    if (file) {
      s.src = file;
    }
    s.onload = function () {
      if (remove && file) {
        s.remove();
      }
    };
    (document.head || document.documentElement).appendChild(s);
    if (remove && code) {
      s.remove();
    }
  })();
}

function createCodeJsBridgeReceive(payloadStr: string): string {
  return `
    window.$onekey.jsBridge.receive(${JSON.stringify(payloadStr)});
  `;
}

export default {
  injectCodeWithScriptTag,
  createCodeWithScriptTag,
  createCodeJsBridgeReceive,
};

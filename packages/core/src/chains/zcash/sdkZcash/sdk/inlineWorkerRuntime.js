// Used by every client-scanning chain's inline Worker loader (Zcash, Monero).
// WKWebView resolves OPFS access through the Blob URL's origin; revoking it at
// construction loses that access, and the wallet database goes with it.
//
// A Blob Worker cannot load release-meta.js, so it gets the page's release
// values in front of its code.
function releaseEnvPrelude() {
  const releaseEnv = globalThis.__ONEKEY_RELEASE_ENV__;
  return releaseEnv
    ? `globalThis.__ONEKEY_RELEASE_ENV__=${JSON.stringify(releaseEnv)};\n`
    : '';
}

export default function createInlineWorker(content, _constructor, options) {
  const objectUrl = URL.createObjectURL(
    new Blob([releaseEnvPrelude(), content], { type: 'text/javascript' }),
  );
  let worker;
  try {
    worker = new Worker(objectUrl, options);
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
  const terminate = worker.terminate.bind(worker);
  let terminated = false;
  worker.terminate = () => {
    if (!terminated) {
      terminated = true;
      terminate();
      URL.revokeObjectURL(objectUrl);
    }
  };
  return worker;
}

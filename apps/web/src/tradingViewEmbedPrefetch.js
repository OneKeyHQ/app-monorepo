export async function runTradingViewEmbedPrefetch({
  getErrorCode,
  prepare,
  replyPort,
}) {
  let ready;
  try {
    ready = await prepare();
  } catch (error) {
    replyPort?.postMessage({
      error: getErrorCode(error),
      ok: false,
    });
    return;
  }

  replyPort?.postMessage({ ok: true, version: ready.version });
  try {
    await ready.complete();
  } catch {
    // Critical assets are ready; a later warmup can retry the background cache.
  }
}

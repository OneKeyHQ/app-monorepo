// Used only by the Zcash inline Worker loader. WKWebView resolves OPFS access
// through the Blob URL's origin; revoking it at construction loses that access.
export default function createInlineWorker(content, _constructor, options) {
  const objectUrl = URL.createObjectURL(
    new Blob([content], { type: 'text/javascript' }),
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

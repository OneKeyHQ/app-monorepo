const importPerpsMobileTokenSelectorPage = () =>
  import('../components/TokenSelector/MoblieTokenSelector');

type IMobileTokenSelectorModule = Awaited<
  ReturnType<typeof importPerpsMobileTokenSelectorPage>
>;

let mobileTokenSelectorModule: IMobileTokenSelectorModule | undefined;
let mobileTokenSelectorPromise: Promise<IMobileTokenSelectorModule> | undefined;

export function loadPerpsMobileTokenSelectorPage() {
  if (!mobileTokenSelectorPromise) {
    mobileTokenSelectorPromise = importPerpsMobileTokenSelectorPage()
      .then((module) => {
        mobileTokenSelectorModule = module;
        return module;
      })
      .catch((error) => {
        mobileTokenSelectorPromise = undefined;
        throw error;
      });
  }
  return mobileTokenSelectorPromise;
}

export function getLoadedPerpsMobileTokenSelectorPage() {
  return mobileTokenSelectorModule;
}

export function preloadPerpsMobileTokenSelectorPage() {
  return loadPerpsMobileTokenSelectorPage();
}

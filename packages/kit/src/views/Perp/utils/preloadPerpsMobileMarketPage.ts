const importPerpsMobileMarketPage = () => import('../pages/MobilePerpMarket');

type IPerpsMobileMarketPageModule = Awaited<
  ReturnType<typeof importPerpsMobileMarketPage>
>;

let mobileMarketPagePromise: Promise<IPerpsMobileMarketPageModule> | undefined;

export function loadPerpsMobileMarketPage() {
  if (!mobileMarketPagePromise) {
    mobileMarketPagePromise = importPerpsMobileMarketPage().catch((error) => {
      mobileMarketPagePromise = undefined;
      throw error;
    });
  }
  return mobileMarketPagePromise;
}

export function preloadPerpsMobileMarketPage() {
  return loadPerpsMobileMarketPage();
}

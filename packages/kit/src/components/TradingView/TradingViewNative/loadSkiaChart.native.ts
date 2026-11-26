// Catch evaluation inside a Metro module factory before the outer require can report it as fatal.
export const loadResult = (() => {
  try {
    const { TradingViewNativeChart } =
      require('./native/TradingViewNativeChart') as typeof import('./native/TradingViewNativeChart');
    return { chart: TradingViewNativeChart };
  } catch (error) {
    return { error };
  }
})();

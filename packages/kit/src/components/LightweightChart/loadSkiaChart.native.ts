// Catch evaluation inside a Metro module factory before the outer require can report it as fatal.
export const loadResult = (() => {
  try {
    const { LightweightChart } =
      require('./LightweightChart.native') as typeof import('./LightweightChart.native');
    return { chart: LightweightChart };
  } catch (error) {
    return { error };
  }
})();

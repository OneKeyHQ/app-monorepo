// cspell:ignore skia
// Catch evaluation inside a Metro module factory before the outer require can report it as fatal.
export const loadResult = (() => {
  try {
    const skia =
      require('@shopify/react-native-skia') as typeof import('@shopify/react-native-skia');
    return { skia };
  } catch (error) {
    return { error };
  }
})();

export default function useLoadCustomFonts(): [boolean, Error | null] {
  // Any web-stack entry can register these fonts with:
  // cspell:disable-next-line
  // import '@onekeyhq/components/src/hocs/Provider/web-fonts.css';
  // There is no expo-font async loading state to wait for in the browser runtime.
  return [true, null];
}

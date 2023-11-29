import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgFolders = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M8 3a3 3 0 0 0-3 3v1H4a3 3 0 0 0-3 3v8a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3v-1h1a3 3 0 0 0 3-3V8a3 3 0 0 0-3-3h-5.586l-1.121-1.121A3 3 0 0 0 11.172 3H8Zm11 12h1a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1h-5.586A2 2 0 0 1 13 6.414l-1.121-1.121A1 1 0 0 0 11.172 5H8a1 1 0 0 0-1 1v1h.172a3 3 0 0 1 2.12.879L10.415 9H16a3 3 0 0 1 3 3v3Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgFolders;

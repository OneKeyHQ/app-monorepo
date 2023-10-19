import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgUsb = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M11 6a1 1 0 1 0-2 0v1a1 1 0 1 0 2 0V6Zm3-1a1 1 0 0 1 1 1v1a1 1 0 1 1-2 0V6a1 1 0 0 1 1-1Z"
    />
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M6 2a1 1 0 0 0-1 1v6H4a1 1 0 0 0-1 1v9a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3v-9a1 1 0 0 0-1-1h-1V3a1 1 0 0 0-1-1H6Zm11 7V4H7v5h10Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgUsb;

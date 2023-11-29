import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgAirpods = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M7.5 3A4.5 4.5 0 0 0 3 7.5V9h18V7.5A4.5 4.5 0 0 0 16.5 3h-9Z"
    />
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M3 16.5V11h18v5.5a4.5 4.5 0 0 1-4.5 4.5h-9A4.5 4.5 0 0 1 3 16.5Zm9-1a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgAirpods;

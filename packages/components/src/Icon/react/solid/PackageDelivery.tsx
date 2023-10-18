import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgPackageDelivery = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M3 4a1 1 0 0 1 1-1h1a3 3 0 0 1 3 3v7.126A4.007 4.007 0 0 1 10.874 16H20a1 1 0 1 1 0 2h-9.126A4.002 4.002 0 0 1 3 17a4.002 4.002 0 0 1 3-3.874V6a1 1 0 0 0-1-1H4a1 1 0 0 1-1-1Zm4 11a2 2 0 1 1 0 4 2 2 0 0 1 0-4Z"
      clipRule="evenodd"
    />
    <Path
      fill="currentColor"
      d="M13 4h1.5v4a1 1 0 1 0 2 0V4H18a3 3 0 0 1 3 3v4a3 3 0 0 1-3 3h-5a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3Z"
    />
  </Svg>
);
export default SvgPackageDelivery;

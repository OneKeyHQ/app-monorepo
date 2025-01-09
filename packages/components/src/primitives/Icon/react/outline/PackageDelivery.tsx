import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgPackageDelivery = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4 4h1a2 2 0 0 1 2 2v8m0 0a3 3 0 1 0 3 3m-3-3a3 3 0 0 1 3 3m0 0h10m-4.5-9V5m0 0H13a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h5a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2.5Z"
    />
  </Svg>
);
export default SvgPackageDelivery;

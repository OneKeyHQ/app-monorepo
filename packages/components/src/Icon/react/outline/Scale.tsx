import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgScale = (props: SvgProps) => (
  <Svg
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="m3 6 3 1m0 0-3 9a5.002 5.002 0 0 0 6.001 0M6 7l3 9M6 7l6-2m6 2 3-1m-3 1-3 9a5.002 5.002 0 0 0 6.001 0M18 7l3 9m-3-9-6-2m0-2v2m0 16V5m0 16H9m3 0h3"
    />
  </Svg>
);
export default SvgScale;

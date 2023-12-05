import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgLaunch = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4.5 17.5 2 20m4.5-.5L5 21m-2-8.5s3.77 1.27 5.5 3 3 5.5 3 5.5l2.802-2.401A2 2 0 0 0 15 17.08V15c4-2 6.5-5 6-12-7-.5-10 2-12 6H6.92a2 2 0 0 0-1.519.698L3 12.5Zm14-4a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z"
    />
  </Svg>
);
export default SvgLaunch;

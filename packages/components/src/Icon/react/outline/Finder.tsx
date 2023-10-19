import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgFinder = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M13.25 13h-2c.179-3.08.662-6.047 1.433-9M8 9v1m8-1v1m-8 5.5c3 2 5 2 8 0M12.683 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-5.317Z"
    />
  </Svg>
);
export default SvgFinder;

import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCalendarFailur = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M9 3a1 1 0 0 0-2 0v1H6a3 3 0 0 0-3 3v11a3 3 0 0 0 3 3h5a1 1 0 1 0 0-2H6a1 1 0 0 1-1-1v-8h14v1a1 1 0 1 0 2 0V7a3 3 0 0 0-3-3h-1V3a1 1 0 1 0-2 0v1H9V3Z"
    />
    <Path
      fill="currentColor"
      d="M15.293 15.293a1 1 0 0 0 0 1.414L16.586 18l-1.293 1.293a1 1 0 0 0 1.414 1.414L18 19.414l1.293 1.293a1 1 0 0 0 1.414-1.414L19.414 18l1.293-1.293a1 1 0 0 0-1.414-1.414L18 16.586l-1.293-1.293a1 1 0 0 0-1.414 0Z"
    />
  </Svg>
);
export default SvgCalendarFailur;

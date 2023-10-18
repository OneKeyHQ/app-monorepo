import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCalendarCheckDone = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M9 3a1 1 0 0 0-2 0v1H6a3 3 0 0 0-3 3v11a3 3 0 0 0 3 3h5a1 1 0 1 0 0-2H6a1 1 0 0 1-1-1v-8h14v2a1 1 0 1 0 2 0V7a3 3 0 0 0-3-3h-1V3a1 1 0 1 0-2 0v1H9V3Z"
    />
    <Path
      fill="currentColor"
      d="M21.78 16.625a1 1 0 1 0-1.56-1.25l-3.303 4.128-1.21-1.21a1 1 0 0 0-1.414 1.414l2 2a1 1 0 0 0 1.488-.082l4-5Z"
    />
  </Svg>
);
export default SvgCalendarCheckDone;

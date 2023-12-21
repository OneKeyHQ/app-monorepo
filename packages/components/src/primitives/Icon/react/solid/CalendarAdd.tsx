import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCalendarAdd = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M9 3a1 1 0 0 0-2 0v1H6a3 3 0 0 0-3 3v11a3 3 0 0 0 3 3h5a1 1 0 1 0 0-2H6a1 1 0 0 1-1-1v-8h14v1a1 1 0 1 0 2 0V7a3 3 0 0 0-3-3h-1V3a1 1 0 1 0-2 0v1H9V3Z"
    />
    <Path
      fill="currentColor"
      d="M19 15a1 1 0 1 0-2 0v2h-2a1 1 0 1 0 0 2h2v2a1 1 0 1 0 2 0v-2h2a1 1 0 1 0 0-2h-2v-2Z"
    />
  </Svg>
);
export default SvgCalendarAdd;

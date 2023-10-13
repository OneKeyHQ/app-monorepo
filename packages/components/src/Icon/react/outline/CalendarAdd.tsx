import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCalendarAdd = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M11 20H6a2 2 0 0 1-2-2V9m0 0V7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2M4 9h16m0 0v2M8 5V3m8 2V3m2 12v3m0 0v3m0-3h-3m3 0h3"
    />
  </Svg>
);
export default SvgCalendarAdd;

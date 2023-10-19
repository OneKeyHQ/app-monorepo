import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCalendarEdit = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M11 20H6a2 2 0 0 1-2-2V9m0 0V7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2M4 9h16m0 0v2M8 5V3m8 2V3m-1 18h1.172a2 2 0 0 0 1.414-.586L21 17a1.414 1.414 0 1 0-2-2l-3.414 3.414A2 2 0 0 0 15 19.828V21Z"
    />
  </Svg>
);
export default SvgCalendarEdit;

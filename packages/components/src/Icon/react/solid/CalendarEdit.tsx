import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCalendarEdit = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M9 3a1 1 0 0 0-2 0v1H6a3 3 0 0 0-3 3v11a3 3 0 0 0 3 3h5a1 1 0 1 0 0-2H6a1 1 0 0 1-1-1v-8h14v1a1 1 0 1 0 2 0V7a3 3 0 0 0-3-3h-1V3a1 1 0 1 0-2 0v1H9V3Zm12.707 11.293a2.414 2.414 0 0 0-3.414 0l-3.414 3.414A3 3 0 0 0 14 19.828V21a1 1 0 0 0 1 1h1.172a3 3 0 0 0 2.12-.879l3.415-3.414a2.414 2.414 0 0 0 0-3.414Z"
    />
  </Svg>
);
export default SvgCalendarEdit;

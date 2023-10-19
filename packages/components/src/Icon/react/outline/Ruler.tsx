import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgRuler = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="m9 9 2.25 2.25M9 9l3.5-3.5M9 9l-3.5 3.5m7-7 2.086-2.086a2 2 0 0 1 2.828 0l3.172 3.172a2 2 0 0 1 0 2.828L9.414 20.586a2 2 0 0 1-2.828 0l-3.172-3.172a2 2 0 0 1 0-2.828L5.5 12.5m7-7 1.25 1.25M5.5 12.5l1.25 1.25"
    />
  </Svg>
);
export default SvgRuler;

import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgFocus = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="m9 5.25 1.586-1.586a2 2 0 0 1 2.828 0L15 5.25M5.25 9l-1.586 1.586a2 2 0 0 0 0 2.828L5.25 15m13.5-6 1.586 1.586a2 2 0 0 1 0 2.828L18.75 15M15 18.75l-1.586 1.586a2 2 0 0 1-2.828 0L9 18.75"
    />
  </Svg>
);
export default SvgFocus;

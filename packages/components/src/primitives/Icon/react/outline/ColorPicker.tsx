import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgColorPicker = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="m10 7 7 7M4.293 15.707 15.586 4.414a2 2 0 0 1 2.828 0l1.172 1.172a2 2 0 0 1 0 2.828L8.293 19.707a1 1 0 0 1-.707.293H5a1 1 0 0 1-1-1v-2.586a1 1 0 0 1 .293-.707Z"
    />
  </Svg>
);
export default SvgColorPicker;

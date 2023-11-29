import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgArrowBottom = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="m18 14.829-4.586 4.585a2 2 0 0 1-2.828 0L6 14.828m6 4.25v-15"
    />
  </Svg>
);
export default SvgArrowBottom;

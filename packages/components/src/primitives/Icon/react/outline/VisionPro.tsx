import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgVisionPro = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="square"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 15c-2.5 0-2.5 3-6 3s-5-3-5-6c0-5.5 6-6 11-6s11 .5 11 6c0 2.935-1.5 6-5 6s-3.5-3-6-3Z"
    />
  </Svg>
);
export default SvgVisionPro;

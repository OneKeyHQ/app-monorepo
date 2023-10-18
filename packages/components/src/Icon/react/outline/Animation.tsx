import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgAnimation = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={2}
      d="M16 8h-.05c-3.905.001-3.995 8-7.9 8H8M6 4h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"
    />
  </Svg>
);
export default SvgAnimation;

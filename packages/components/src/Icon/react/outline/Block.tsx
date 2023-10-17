import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgBlock = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={2}
      d="M18.364 5.636A9 9 0 1 0 5.636 18.364M18.364 5.636A9 9 0 1 1 5.636 18.364M18.364 5.636 5.636 18.364"
    />
  </Svg>
);
export default SvgBlock;

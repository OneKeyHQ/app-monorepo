import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgBagSmile = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={2}
      d="M15 8a3 3 0 0 1-6 0M4.883 5.875l-.75 12A2 2 0 0 0 6.129 20h11.742a2 2 0 0 0 1.996-2.125l-.75-12A2 2 0 0 0 17.121 4H6.88a2 2 0 0 0-1.996 1.875Z"
    />
  </Svg>
);
export default SvgBagSmile;

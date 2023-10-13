import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgDrop = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M19 14a7 7 0 1 1-14 0c0-4.009 3.718-8.378 5.735-10.454a1.746 1.746 0 0 1 2.53 0C15.282 5.622 19 9.991 19 14Z"
    />
  </Svg>
);
export default SvgDrop;

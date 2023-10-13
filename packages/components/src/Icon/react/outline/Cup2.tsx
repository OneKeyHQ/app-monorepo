import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCup2 = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={2}
      d="M11 5V3M7 5V3m8 2V3M7 21h8a2 2 0 0 0 2-2V9a1 1 0 0 0-1-1H6a1 1 0 0 0-1 1v10a2 2 0 0 0 2 2Zm10-11h1.5a2.5 2.5 0 0 1 0 5H17v-5Z"
    />
  </Svg>
);
export default SvgCup2;

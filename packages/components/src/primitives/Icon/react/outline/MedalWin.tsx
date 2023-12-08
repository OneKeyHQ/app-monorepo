import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgMedalWin = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 16a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm0 0a6.968 6.968 0 0 1-4-1.255v6.291a.75.75 0 0 0 1.085.671l2.58-1.29a.75.75 0 0 1 .67 0l2.58 1.29a.75.75 0 0 0 1.085-.67v-6.292A6.968 6.968 0 0 1 12 16Z"
    />
  </Svg>
);
export default SvgMedalWin;

import Svg, { SvgProps, Path, Circle } from 'react-native-svg';
const SvgPiggyMoney = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M22.731 12a2 2 0 0 1-2.897 2.626m0 0a2.006 2.006 0 0 1-.268-.23l.269.23ZM5.5 7.5V5c0-.552.452-1.011.996-.92C8.72 4.452 9.474 6 9.474 6H14a6 6 0 0 1 6 6 5.978 5.978 0 0 1-2 4.463V19a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v0a1 1 0 0 0-1-1h-2a1 1 0 0 0-1 1v0a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-2c-.906-.527-1.475-1.092-2-2H3a1 1 0 0 1-1-1v-3.065a1 1 0 0 1 1-1h1c.338-.925.782-1.787 1.5-2.435Z"
    />
    <Circle cx={8.25} cy={10.75} r={1.25} fill="currentColor" />
  </Svg>
);
export default SvgPiggyMoney;

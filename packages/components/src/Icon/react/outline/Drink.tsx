import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgDrink = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="m17.667 12-.543 8.133A2 2 0 0 1 15.13 22H8.87a2 2 0 0 1-1.995-1.867L6.333 12m11.334 0 .262-3.933A1 1 0 0 0 16.93 7H7.07a1 1 0 0 0-.998 1.067L6.333 12m11.334 0H6.333M12 7V3l4.5-1"
    />
  </Svg>
);
export default SvgDrink;

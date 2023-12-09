import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgGift = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeWidth={2}
      d="M19 11.732V18a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-6.268m14 0V11.5m0 .232A2 2 0 0 0 18 8H6a2 2 0 0 0-1 3.732m14 0A1.99 1.99 0 0 1 18 12H6a1.99 1.99 0 0 1-1-.268m0-.232v.232M12 8V6.333M12 8h-1.667A3.333 3.333 0 0 1 7 4.667C7 3.747 7.746 3 8.667 3A3.333 3.333 0 0 1 12 6.333M12 8h1.667A3.333 3.333 0 0 0 17 4.667C17 3.747 16.254 3 15.333 3A3.333 3.333 0 0 0 12 6.333M12 8v12"
    />
  </Svg>
);
export default SvgGift;

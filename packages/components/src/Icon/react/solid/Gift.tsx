import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgGift = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M6 4.667A2.667 2.667 0 0 1 8.667 2c1.34 0 2.538.608 3.333 1.564A4.324 4.324 0 0 1 15.333 2 2.667 2.667 0 0 1 18 4.667c0 .859-.25 1.66-.681 2.333H19a2 2 0 1 1 0 4h-6V7h.667A2.333 2.333 0 0 0 16 4.667.667.667 0 0 0 15.333 4 2.333 2.333 0 0 0 13 6.333V7h-2v-.667A2.333 2.333 0 0 0 8.667 4 .667.667 0 0 0 8 4.667 2.333 2.333 0 0 0 10.333 7H11v4H5a2 2 0 1 1 0-4h1.681A4.313 4.313 0 0 1 6 4.667ZM13 13h7v5a3 3 0 0 1-3 3h-4v-8Zm-2 0H4v5a3 3 0 0 0 3 3h4v-8Z"
    />
  </Svg>
);
export default SvgGift;

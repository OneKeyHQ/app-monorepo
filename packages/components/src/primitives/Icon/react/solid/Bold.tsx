import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgBold = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M5 6.75C5 4.772 6.55 3 8.667 3h4.166c3.037 0 5.334 2.556 5.334 5.5a5.63 5.63 0 0 1-.855 2.984A5.607 5.607 0 0 1 19 15.5c0 2.945-2.297 5.5-5.333 5.5h-5C6.55 21 5 19.228 5 17.25V6.75ZM12.833 10c.646 0 1.334-.579 1.334-1.5S13.479 7 12.833 7H9v3h3.833ZM9 14h4.667c.645 0 1.333.579 1.333 1.5 0 .922-.688 1.5-1.333 1.5H9v-3Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgBold;

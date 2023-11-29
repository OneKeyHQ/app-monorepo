import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgWorld = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={2}
      d="M19.778 4.222 4.222 19.778M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-2.636 6.364c-1.171 1.171-4.97-.728-8.485-4.243-3.515-3.514-5.414-7.313-4.243-8.485 1.172-1.172 4.971.728 8.486 4.243 3.515 3.514 5.414 7.313 4.242 8.485Z"
    />
  </Svg>
);
export default SvgWorld;

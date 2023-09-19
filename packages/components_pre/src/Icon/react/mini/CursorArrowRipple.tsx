import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCursorArrowRipple = (props: SvgProps) => (
  <Svg
    viewBox="0 0 20 20"
    fill="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M6.111 11.89A5.5 5.5 0 1 1 15.501 8 .75.75 0 1 0 17 8a7 7 0 1 0-11.95 4.95.75.75 0 0 0 1.06-1.06zm2.121-5.658a2.5 2.5 0 0 0 0 3.536.75.75 0 1 1-1.06 1.06A4 4 0 1 1 14 8a.75.75 0 0 1-1.5 0 2.5 2.5 0 0 0-4.268-1.768zm2.534 1.279a.75.75 0 0 0-1.37.364l-.492 6.861a.75.75 0 0 0 1.204.65l1.043-.799.985 3.678a.75.75 0 0 0 1.45-.388l-.978-3.646 1.292.204a.75.75 0 0 0 .74-1.16l-3.874-5.764z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCursorArrowRipple;

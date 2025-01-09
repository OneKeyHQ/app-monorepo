import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgKeyboardConnect = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M19 3a1 1 0 1 0-2 0v.5a.5.5 0 0 1-.5.5H8a3 3 0 0 0-3 3v1H4a3 3 0 0 0-3 3v8a3 3 0 0 0 3 3h16a3 3 0 0 0 3-3v-8a3 3 0 0 0-3-3H7V7a1 1 0 0 1 1-1h8.5A2.5 2.5 0 0 0 19 3.5V3Zm-9 13a1 1 0 1 0 0 2h4a1 1 0 1 0 0-2h-4Zm-5.25-3a1.25 1.25 0 1 0 2.5 0 1.25 1.25 0 0 0-2.5 0Zm12 0a1.25 1.25 0 1 0 2.5 0 1.25 1.25 0 0 0-2.5 0ZM14 14.25a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5ZM8.75 13a1.25 1.25 0 1 0 2.5 0 1.25 1.25 0 0 0-2.5 0ZM6 18.25a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5ZM16.75 17a1.25 1.25 0 1 0 2.5 0 1.25 1.25 0 0 0-2.5 0Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgKeyboardConnect;

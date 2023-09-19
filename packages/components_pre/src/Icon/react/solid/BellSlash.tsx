import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgBellSlash = (props: SvgProps) => (
  <Svg
    viewBox="0 0 24 24"
    fill="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M3.53 2.47a.75.75 0 0 0-1.06 1.06l18 18a.75.75 0 1 0 1.06-1.06l-18-18zm17.04 14.006c-.223.082-.448.161-.674.238L7.319 4.137A6.75 6.75 0 0 1 18.75 9v.75c0 2.123.8 4.057 2.118 5.52a.75.75 0 0 1-.297 1.206z" />
    <Path
      fillRule="evenodd"
      d="M5.25 9c0-.184.007-.366.022-.546l10.384 10.384a3.751 3.751 0 0 1-7.396-1.119 24.585 24.585 0 0 1-4.831-1.244.75.75 0 0 1-.298-1.205A8.217 8.217 0 0 0 5.25 9.75V9zm4.502 8.9a2.25 2.25 0 1 0 4.496 0 25.057 25.057 0 0 1-4.496 0z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgBellSlash;

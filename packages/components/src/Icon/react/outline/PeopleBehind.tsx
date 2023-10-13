import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgPeopleBehind = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M18 19h2c1.16 0 2.108-1.002 1.753-2.106-.978-3.042-3.498-4.301-5.753-3.78M11 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm8.5.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0ZM11.854 20H4.146c-1.16 0-2.102-1-1.79-2.118 1.816-6.51 9.472-6.51 11.288 0C13.956 19 13.014 20 11.854 20Z"
    />
  </Svg>
);
export default SvgPeopleBehind;

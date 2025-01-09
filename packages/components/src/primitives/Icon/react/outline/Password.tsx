import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgPassword = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M18 11a3 3 0 0 0-1.25 5.728v3.532a.5.5 0 0 0 .188.39l.75.6a.5.5 0 0 0 .624 0l.75-.6a.5.5 0 0 0 .188-.39v-.833l-.75-.677.75-.75v-1.272A3 3 0 0 0 18 11Zm-1 3a1 1 0 1 1 2 0 1 1 0 0 1-2 0Z"
      clipRule="evenodd"
    />
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 13c-3.391 0-5.964 2.014-7.017 4.863C4.573 18.968 5.518 20 6.697 20H14m1.5-13.5a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0Z"
    />
  </Svg>
);
export default SvgPassword;

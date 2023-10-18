import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCookies = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M2 12C2 6.477 6.477 2 12 2c.385 0 .766.022 1.14.064a1 1 0 0 1 .88 1.119 2.5 2.5 0 0 0 2.144 2.795 1 1 0 0 1 .858.858 2.5 2.5 0 0 0 3.352 2.007 1 1 0 0 1 1.32.691c.2.79.306 1.616.306 2.466 0 5.523-4.477 10-10 10S2 17.523 2 12Zm8-3.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Zm4 3a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Zm3 3.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm-4 1.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0ZM7 15a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCookies;

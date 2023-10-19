import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCameraGopro = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M11 7c0-1.126.372-2.164 1-3H5a3 3 0 0 0-3 3v11a3 3 0 0 0 3 3h14a3 3 0 0 0 3-3v-4c-.836.628-1.874 1-3 1h-3a5 5 0 0 1-5-5V7Zm-5 9a1 1 0 1 0 0 2h2a1 1 0 1 0 0-2H6Z"
      clipRule="evenodd"
    />
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M13 7a3 3 0 0 1 3-3h3a3 3 0 0 1 3 3v3a3 3 0 0 1-3 3h-3a3 3 0 0 1-3-3V7Zm4.5 2.75a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCameraGopro;

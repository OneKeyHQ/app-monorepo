import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgMessageExclamation = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M18.002 3h-12a3 3 0 0 0-3 3v10.036a3 3 0 0 0 3 3h2.65l2.704 2.266a1 1 0 0 0 1.28.004l2.74-2.27h2.626a3 3 0 0 0 3-3V6a3 3 0 0 0-3-3ZM12 7.5a1 1 0 0 1 1 1v2a1 1 0 1 1-2 0v-2a1 1 0 0 1 1-1Zm0 4.75a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgMessageExclamation;

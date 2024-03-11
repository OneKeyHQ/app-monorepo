import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgApiConnection = (props: SvgProps) => (
  <Svg viewBox="0 0 22 18" fill="none" accessibilityRole="image" {...props}>
    <Path
      d="M4 9a7 7 0 0 1 13.064-3.5 1 1 0 0 0 1.731-1A9.001 9.001 0 0 0 2.055 8H1a1 1 0 0 0 0 2h1.055a9.001 9.001 0 0 0 16.74 3.5 1 1 0 1 0-1.73-1A7 7 0 0 1 4 9Z"
      fill="currentColor"
    />
    <Path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M11 4a5 5 0 1 0 4.9 6H21a1 1 0 1 0 0-2h-5.1A5.002 5.002 0 0 0 11 4ZM8 9a3 3 0 1 1 6 0 3 3 0 0 1-6 0Z"
      fill="currentColor"
    />
  </Svg>
);
export default SvgApiConnection;

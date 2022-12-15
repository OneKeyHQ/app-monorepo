import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgLibrary = (props: SvgProps) => (
  <Svg
    viewBox="0 0 20 20"
    fill="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M10.496 2.132a1 1 0 0 0-.992 0l-7 4A1 1 0 0 0 3 8v7a1 1 0 1 0 0 2h14a1 1 0 1 0 0-2V8a1 1 0 0 0 .496-1.868l-7-4zM6 9a1 1 0 0 0-1 1v3a1 1 0 1 0 2 0v-3a1 1 0 0 0-1-1zm3 1a1 1 0 0 1 2 0v3a1 1 0 1 1-2 0v-3zm5-1a1 1 0 0 0-1 1v3a1 1 0 1 0 2 0v-3a1 1 0 0 0-1-1z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgLibrary;

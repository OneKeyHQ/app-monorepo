import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgFileLock = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M7 2h5v5a3 3 0 0 0 3 3h5v9a3 3 0 0 1-3 3h-5.127a3.484 3.484 0 0 0 .627-2v-2a3.49 3.49 0 0 0-1.025-2.474A4.5 4.5 0 0 0 4 12.646V5a3 3 0 0 1 3-3Z"
    />
    <Path fill="currentColor" d="M14 2.586 19.414 8H15a1 1 0 0 1-1-1V2.586Z" />
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M10 16.268V16a3 3 0 1 0-6 0v.268A2 2 0 0 0 3 18v2a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-2a2 2 0 0 0-1-1.732ZM6 16h2a1 1 0 1 0-2 0Zm3 2H5v2h4v-2Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgFileLock;

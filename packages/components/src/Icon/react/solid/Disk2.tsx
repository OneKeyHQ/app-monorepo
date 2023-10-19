import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgDisk2 = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path fill="currentColor" d="M10 15a2 2 0 1 1 4 0 2 2 0 0 1-4 0Z" />
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M6 3h2v5a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V3h.172a3 3 0 0 1 2.12.879l1.83 1.828A3 3 0 0 1 21 7.828V18a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3Zm6 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"
      clipRule="evenodd"
    />
    <Path fill="currentColor" d="M10 3h4v4h-4V3Z" />
  </Svg>
);
export default SvgDisk2;

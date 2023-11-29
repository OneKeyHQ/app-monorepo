import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgDocumentAttach = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M7 4.5a.5.5 0 0 1 1 0V9a2 2 0 1 1-4 0V5a1 1 0 0 0-2 0v4a4 4 0 0 0 8 0V4.5a2.5 2.5 0 0 0-5 0V9a1 1 0 0 0 2 0V4.5Z"
    />
    <Path
      fill="currentColor"
      d="M6 15a5.99 5.99 0 0 1-2-.341V19a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V5a3 3 0 0 0-3-3h-5.758c.479.715.758 1.575.758 2.5V9a6 6 0 0 1-6 6Z"
    />
  </Svg>
);
export default SvgDocumentAttach;

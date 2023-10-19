import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgBezierEdit = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M19.126 14.874a.65.65 0 0 0-.919 0L15 18.08V19h.92l3.206-3.207a.65.65 0 0 0 0-.92Zm-2.333-1.414a2.65 2.65 0 1 1 3.747 3.747l-3.5 3.5a1 1 0 0 1-.707.293H14a1 1 0 0 1-1-1v-2.333a1 1 0 0 1 .293-.707l3.5-3.5Z"
      clipRule="evenodd"
    />
    <Path
      fill="currentColor"
      d="M5 3a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2v6a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2h1a1 1 0 1 0 0-2H9a2 2 0 0 0-2-2V9a2 2 0 0 0 2-2h6a2 2 0 0 0 2 2v1a1 1 0 1 0 2 0V9a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2H9a2 2 0 0 0-2-2H5Z"
    />
  </Svg>
);
export default SvgBezierEdit;

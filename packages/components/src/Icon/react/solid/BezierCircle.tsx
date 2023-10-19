import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgBezierCircle = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M2 13a2 2 0 0 0 2 2h.582A8.023 8.023 0 0 0 9 19.418V20a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-.582A8.024 8.024 0 0 0 19.418 15H20a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2h-.582A8.023 8.023 0 0 0 15 4.582V4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v.582A8.024 8.024 0 0 0 4.582 9H4a2 2 0 0 0-2 2v2Zm7.136 4.274a6.032 6.032 0 0 1-2.41-2.41A2 2 0 0 0 8 13v-2a2 2 0 0 0-1.274-1.864 6.032 6.032 0 0 1 2.41-2.41A2 2 0 0 0 11 8h2a2 2 0 0 0 1.864-1.274 6.033 6.033 0 0 1 2.41 2.41A2 2 0 0 0 16 11v2a2 2 0 0 0 1.274 1.864 6.033 6.033 0 0 1-2.41 2.41A2 2 0 0 0 13 16h-2a2 2 0 0 0-1.864 1.274Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgBezierCircle;

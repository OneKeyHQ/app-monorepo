import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgNote = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M20 11v1a2 2 0 0 1-2 2h-2a2 2 0 0 0-2 2v2a2 2 0 0 1-2 2h-1M6 4h12a2 2 0 0 1 2 2v7.672a2 2 0 0 1-.586 1.414l-4.328 4.328a2 2 0 0 1-1.414.586H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"
    />
  </Svg>
);
export default SvgNote;

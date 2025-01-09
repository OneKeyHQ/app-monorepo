import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgDocumentAttach = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M13 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-3m1-7V4.5a1.5 1.5 0 1 1 3 0V9a3 3 0 1 1-6 0V5"
    />
  </Svg>
);
export default SvgDocumentAttach;

import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgGarage = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="square"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M7 19v-4m10 4v-4M7 15h10M7 15v-2a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2M3.992 8.421l7-4.083a2 2 0 0 1 2.016 0l7 4.083A2 2 0 0 1 21 10.15V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-6.851a2 2 0 0 1 .992-1.728Z"
    />
  </Svg>
);
export default SvgGarage;

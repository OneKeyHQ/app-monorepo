import Svg, { SvgProps, Path, Ellipse } from 'react-native-svg';
const SvgWcPaperToilet = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M7 4h10c1.657 0 3 2.686 3 6v8a2 2 0 0 1-2 2h-6a2 2 0 0 1-2-2v-2M7 4c1.657 0 3 2.686 3 6M7 4c-1.657 0-3 2.686-3 6s1.343 6 3 6m3-6v6m0-6c0 3.314-1.343 6-3 6m3 0H7"
    />
    <Ellipse cx={7} cy={10} fill="currentColor" rx={0.75} ry={1.25} />
  </Svg>
);
export default SvgWcPaperToilet;

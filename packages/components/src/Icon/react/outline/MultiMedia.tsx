import Svg, { SvgProps, Path, Circle } from 'react-native-svg';
const SvgMultiMedia = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M15 9V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h4m-6-3 1.89-1.26a2 2 0 0 1 2.22 0L9 12m2-3h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Z"
    />
    <Circle cx={6.25} cy={6.25} r={1.25} fill="currentColor" />
    <Path
      fill="currentColor"
      d="M13 16.675v-3.35a.75.75 0 0 1 1.136-.643l2.792 1.675a.75.75 0 0 1 0 1.286l-2.792 1.675A.75.75 0 0 1 13 16.675Z"
    />
  </Svg>
);
export default SvgMultiMedia;

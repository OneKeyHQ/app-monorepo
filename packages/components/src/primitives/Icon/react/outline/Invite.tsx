import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgInvite = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M5 11V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v6m-9-3h4M3 12.387V18a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5.613a1 1 0 0 0-1.316-.948l-7.052 2.35a2 2 0 0 1-1.264 0l-7.052-2.35A1 1 0 0 0 3 12.387Z"
    />
  </Svg>
);
export default SvgInvite;

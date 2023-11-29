import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgSpeakerPromote = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M17.998 14a3 3 0 0 0 0-6m-5.17 10a3.001 3.001 0 0 1-5.83-1v-1.5M7 6.5v9m10.998-9.763v10.526a2 2 0 0 1-2.608 1.905l-11-3.51a2 2 0 0 1-1.392-1.905V9.247A2 2 0 0 1 4.39 7.342l11-3.51a2 2 0 0 1 2.608 1.905Z"
    />
  </Svg>
);
export default SvgSpeakerPromote;

import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgSpeakerPromote = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M21.996 11a4 4 0 0 1-3 3.874v5.495l-5.361-1.711A3.998 3.998 0 0 1 5.996 17v-.779l-4-1.276v-7.89l17-5.424v5.495c1.725.444 3 2.01 3 3.874m-2 0c0-.74-.402-1.385-1-1.731v3.46c.597-.345 1-.989 1-1.729M7.998 7.24v7.521l8.998 2.871V4.368l-8.998 2.87ZM3.996 8.516v4.967l2.002.638V7.877zm4 8.484a2 2 0 0 0 3.706 1.041L7.996 16.86z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgSpeakerPromote;

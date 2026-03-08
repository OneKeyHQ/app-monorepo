import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgThumbUp = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M11.615 2a3 3 0 0 1 2.965 3.462L14.184 8h3.88a4 4 0 0 1 3.962 4.54l-.681 5A4 4 0 0 1 17.38 21H2V10h4.382l4-8zM4 19h2v-7H4zm4-7.764V19h9.38a2 2 0 0 0 1.983-1.73l.682-5A2 2 0 0 0 18.063 10h-6.215l.755-4.846A1 1 0 0 0 11.617 4z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgThumbUp;

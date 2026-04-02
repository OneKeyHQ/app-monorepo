import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgTarget = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M13 4.063A8 8 0 0 1 19.936 11H23v2h-3.064A8 8 0 0 1 13 19.936V23h-2v-3.064A8 8 0 0 1 4.064 13H1v-2h3.064A8 8 0 0 1 11 4.063V1h2zM13 9h-2V6.084A6 6 0 0 0 6.085 11H9v2H6.085A6 6 0 0 0 11 17.915V15h2v2.915A6 6 0 0 0 17.915 13H15v-2h2.915A6 6 0 0 0 13 6.084z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgTarget;

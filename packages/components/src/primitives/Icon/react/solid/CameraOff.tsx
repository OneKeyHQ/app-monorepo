import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCameraOff = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M2.293 2.293a1 1 0 0 1 1.414 0l18 18a1 1 0 1 1-1.414 1.414L19.586 21H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h.586L2.293 3.707a1 1 0 0 1 0-1.414m6.817 8.231a3.5 3.5 0 0 0 4.865 4.865L9.11 10.525Z"
      clipRule="evenodd"
    />
    <Path d="M13.965 3a2 2 0 0 1 1.664.89L17.035 6H20a2 2 0 0 1 2 2v9.758L8.276 4.033l.095-.142A2 2 0 0 1 10.035 3z" />
  </Svg>
);
export default SvgCameraOff;

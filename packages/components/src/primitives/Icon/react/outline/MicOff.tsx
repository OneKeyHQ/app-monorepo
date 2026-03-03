import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgMicOff = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M22.414 21 21 22.414l-3.957-3.957A8.6 8.6 0 0 1 13 19.945V22h-2v-2.054c-3.553-.37-5.7-2.67-6.824-4.402l-.545-.839 1.678-1.088.545.84C6.894 16.057 8.8 18 12 18c1.467 0 2.648-.406 3.598-.988l-1.483-1.483A5 5 0 0 1 7 11V8.415L1.586 3 3 1.586zM9 11l.004.154a3 3 0 0 0 3.533 2.797L9 10.414z"
      clipRule="evenodd"
    />
    <Path d="M12 2a5 5 0 0 1 5 5v4.344h-2V7a3 3 0 0 0-4.86-2.354l-.785.62L8.115 3.7l.783-.62A4.98 4.98 0 0 1 12 2" />
  </Svg>
);
export default SvgMicOff;

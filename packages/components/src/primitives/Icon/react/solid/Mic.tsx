import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgMic = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="m20.37 14.705-.544.839c-1.123 1.731-3.27 4.035-6.824 4.405V22h-2v-2.05c-3.554-.371-5.702-2.675-6.825-4.406l-.544-.839 1.678-1.088.543.84C6.894 16.057 8.802 18 12.002 18s5.107-1.942 6.146-3.544l.545-.839z" />
    <Path d="M12.002 2a5 5 0 0 1 5 5v4a5 5 0 0 1-10 0V7a5 5 0 0 1 5-5" />
  </Svg>
);
export default SvgMic;

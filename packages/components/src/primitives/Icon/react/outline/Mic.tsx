import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgMic = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="m20.37 14.705-.544.839c-1.123 1.731-3.271 4.032-6.825 4.402V22h-2v-2.054c-3.553-.37-5.7-2.67-6.824-4.402l-.544-.839 1.678-1.088.543.84C6.894 16.056 8.801 18 12.001 18s5.108-1.942 6.147-3.544l.544-.839z" />
    <Path
      fillRule="evenodd"
      d="M12.001 2a5 5 0 0 1 5 5v4a5 5 0 0 1-10 0V7a5 5 0 0 1 5-5m0 2a3 3 0 0 0-3 3v4a3 3 0 0 0 6 0V7a3 3 0 0 0-3-3"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgMic;

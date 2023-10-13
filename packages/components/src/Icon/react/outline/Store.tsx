import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgStore = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="m21 8-2.4-3.2A2 2 0 0 0 17 4H7a2 2 0 0 0-1.6.8L3 8m18 0v1a2.99 2.99 0 0 1-1 2.236M21 8H3m0 0v1a2.99 2.99 0 0 0 1 2.236M15 9a3 3 0 0 0 5 2.236M15 9V8m0 1a3 3 0 1 1-6 0m0 0a3 3 0 0 1-5 2.236M9 9V8m5 12v-3a2 2 0 1 0-4 0v3m-6-8.764V18a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6.764"
    />
  </Svg>
);
export default SvgStore;

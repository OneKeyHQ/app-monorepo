import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgMultipleDevices = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M2 16v-1a1 1 0 0 0-1 1h1Zm11 1h1v-2h-1v2Zm0 4h1v-2h-1v2Zm4-4a1 1 0 1 0 0 2v-2Zm1 2a1 1 0 1 0 0-2v2ZM6 5h12V3H6v2ZM5 16V6H3v10h2Zm-3 1h2v-2H2v2Zm2 0h9v-2H4v2Zm9 2H4v2h9v-2ZM3 18v-2H1v2h2ZM19 6v3h2V6h-2ZM4 19a1 1 0 0 1-1-1H1a3 3 0 0 0 3 3v-2ZM18 5a1 1 0 0 1 1 1h2a3 3 0 0 0-3-3v2ZM6 3a3 3 0 0 0-3 3h2a1 1 0 0 1 1-1V3Zm9 7h5V8h-5v2Zm6 1v8h2v-8h-2Zm-1 9h-5v2h5v-2Zm-6-1v-8h-2v8h2Zm3 0h1v-2h-1v2Zm-2 1a1 1 0 0 1-1-1h-2a3 3 0 0 0 3 3v-2Zm6-1a1 1 0 0 1-1 1v2a3 3 0 0 0 3-3h-2Zm-1-9a1 1 0 0 1 1 1h2a3 3 0 0 0-3-3v2Zm-5-2a3 3 0 0 0-3 3h2a1 1 0 0 1 1-1V8Z"
    />
  </Svg>
);
export default SvgMultipleDevices;

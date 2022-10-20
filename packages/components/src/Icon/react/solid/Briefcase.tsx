import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgBriefcase = (props: SvgProps) => (
  <Svg
    viewBox="0 0 20 20"
    fill="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M6 6V5a3 3 0 0 1 3-3h2a3 3 0 0 1 3 3v1h2a2 2 0 0 1 2 2v3.57A22.952 22.952 0 0 1 10 13a22.95 22.95 0 0 1-8-1.43V8a2 2 0 0 1 2-2h2zm2-1a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1H8V5zm1 5a1 1 0 0 1 1-1h.01a1 1 0 1 1 0 2H10a1 1 0 0 1-1-1z"
      clipRule="evenodd"
    />
    <Path d="M2 13.692V16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2.308A24.974 24.974 0 0 1 10 15a24.98 24.98 0 0 1-8-1.308z" />
  </Svg>
);
export default SvgBriefcase;

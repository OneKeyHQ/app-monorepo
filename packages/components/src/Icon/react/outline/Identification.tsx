import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgIdentification = (props: SvgProps) => (
  <Svg
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M10 6H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-5m-4 0V5a2 2 0 1 1 4 0v1m-4 0a2 2 0 1 0 4 0m-5 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 0 0-2.83 2M15 11h3m-3 4h2"
    />
  </Svg>
);
export default SvgIdentification;

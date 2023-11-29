import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgFaceId = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M3 5a2 2 0 0 1 2-2h3a1 1 0 0 1 0 2H5v3a1 1 0 0 1-2 0V5Zm12-1a1 1 0 0 1 1-1h3a2 2 0 0 1 2 2v3a1 1 0 1 1-2 0V5h-3a1 1 0 0 1-1-1Zm-2.5 3.75a1 1 0 0 1 1 1V11a3 3 0 0 1-2.25 2.905 1 1 0 1 1-.5-1.936A1 1 0 0 0 11.5 11V8.75a1 1 0 0 1 1-1ZM8 8a1 1 0 0 1 1 1v1a1 1 0 1 1-2 0V9a1 1 0 0 1 1-1Zm8 0a1 1 0 0 1 1 1v1a1 1 0 1 1-2 0V9a1 1 0 0 1 1-1Zm-7.866 7.197a1 1 0 0 1 1.367-.365A4.972 4.972 0 0 0 12 15.5c.912 0 1.765-.243 2.5-.668a1 1 0 1 1 1 1.73 6.972 6.972 0 0 1-3.5.938 6.96 6.96 0 0 1-3.5-.937 1 1 0 0 1-.366-1.366ZM4 15a1 1 0 0 1 1 1v3h3a1 1 0 1 1 0 2H5a2 2 0 0 1-2-2v-3a1 1 0 0 1 1-1Zm16 0a1 1 0 0 1 1 1v3a2 2 0 0 1-2 2h-3a1 1 0 1 1 0-2h3v-3a1 1 0 0 1 1-1Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgFaceId;

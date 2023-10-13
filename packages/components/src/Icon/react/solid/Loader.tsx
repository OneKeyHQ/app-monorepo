import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgLoader = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M12 2a1 1 0 0 1 1 1v3a1 1 0 1 1-2 0V3a1 1 0 0 1 1-1Zm7.071 2.929a1 1 0 0 1 0 1.414L16.95 8.464a1 1 0 1 1-1.414-1.414l2.121-2.121a1 1 0 0 1 1.414 0Zm-14.142 0a1 1 0 0 1 1.414 0L8.465 7.05A1 1 0 1 1 7.05 8.464l-2.122-2.12a1 1 0 0 1 0-1.415ZM2 12a1 1 0 0 1 1-1h3a1 1 0 1 1 0 2H3a1 1 0 0 1-1-1Zm15 0a1 1 0 0 1 1-1h3a1 1 0 1 1 0 2h-3a1 1 0 0 1-1-1Zm-8.535 3.535a1 1 0 0 1 0 1.414L6.343 19.07a1 1 0 0 1-1.414-1.414l2.122-2.121a1 1 0 0 1 1.414 0Zm7.07 0a1 1 0 0 1 1.415 0l2.121 2.12a1 1 0 0 1-1.414 1.415l-2.121-2.121a1 1 0 0 1 0-1.414ZM12 17a1 1 0 0 1 1 1v3a1 1 0 1 1-2 0v-3a1 1 0 0 1 1-1Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgLoader;

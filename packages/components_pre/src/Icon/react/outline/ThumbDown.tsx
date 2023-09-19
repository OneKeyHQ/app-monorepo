import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgThumbDown = (props: SvgProps) => (
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
      d="M10 14H5.236a2 2 0 0 1-1.789-2.894l3.5-7A2 2 0 0 1 8.736 3h4.018a2 2 0 0 1 .485.06l3.76.94m-7 10v5a2 2 0 0 0 2 2h.096c.5 0 .905-.405.905-.904 0-.715.211-1.413.608-2.008L17 13V4m-7 10h2m5-10h2a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-2.5"
    />
  </Svg>
);
export default SvgThumbDown;

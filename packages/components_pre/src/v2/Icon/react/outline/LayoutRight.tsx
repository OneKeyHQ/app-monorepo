import Svg, { Path } from 'react-native-svg';

import type { SvgProps } from 'react-native-svg';

const SvgLayoutRight = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="m5.092 19.782.454-.891-.454.891Zm-.874-.874.891-.454-.891.454Zm15.564 0-.891-.454.891.454Zm-.874.874-.454-.891.454.891Zm.874-14.69-.891.454.891-.454Zm-.874-.874-.454.891.454-.891Zm-14.69.874-.891-.454.891.454Zm.874-.874-.454-.891.454.891ZM15 4V3h-2v1h2Zm-2 16v1h2v-1h-2Zm6-12.8v9.6h2V7.2h-2ZM16.8 19H7.2v2h9.6v-2ZM5 16.8V7.2H3v9.6h2ZM7.2 5h9.6V3H7.2v2Zm0 14c-.577 0-.949 0-1.232-.024-.272-.022-.373-.06-.422-.085l-.908 1.782c.378.193.772.264 1.167.296.384.032.851.031 1.395.031v-2ZM3 16.8c0 .543 0 1.011.03 1.395.033.395.104.789.297 1.167l1.782-.908c-.025-.05-.063-.15-.085-.422C5 17.75 5 17.377 5 16.8H3Zm2.546 2.091a1 1 0 0 1-.437-.437l-1.782.908a3 3 0 0 0 1.311 1.311l.908-1.782ZM19 16.8c0 .576 0 .949-.024 1.232-.022.272-.06.372-.085.422l1.782.908c.193-.378.264-.772.296-1.167.032-.384.031-.852.031-1.395h-2ZM16.8 21c.544 0 1.011 0 1.395-.03.395-.033.789-.104 1.167-.297l-.908-1.782c-.05.025-.15.063-.422.085C17.75 19 17.377 19 16.8 19v2Zm2.091-2.546a1 1 0 0 1-.437.437l.908 1.782a3 3 0 0 0 1.311-1.311l-1.782-.908ZM21 7.2c0-.544 0-1.011-.03-1.395-.033-.395-.104-.789-.297-1.167l-1.782.908c.025.05.063.15.085.422C19 6.25 19 6.623 19 7.2h2ZM16.8 5c.577 0 .949 0 1.232.024.272.022.372.06.422.085l.908-1.782c-.378-.193-.772-.264-1.167-.296C17.811 2.999 17.344 3 16.8 3v2Zm3.873-.362a3 3 0 0 0-1.311-1.311l-.908 1.782a1 1 0 0 1 .437.437l1.782-.908ZM5 7.2c0-.577 0-.949.024-1.232.022-.272.06-.373.085-.422l-1.782-.908c-.193.378-.264.772-.296 1.167C2.999 6.189 3 6.656 3 7.2h2ZM7.2 3c-.544 0-1.011 0-1.395.03-.395.033-.789.104-1.167.297l.908 1.782c.05-.025.15-.063.422-.085C6.25 5 6.623 5 7.2 5V3ZM5.109 5.546a1 1 0 0 1 .437-.437l-.908-1.782a3 3 0 0 0-1.311 1.311l1.782.908ZM13 4v16h2V4h-2Z"
    />
  </Svg>
);
export default SvgLayoutRight;

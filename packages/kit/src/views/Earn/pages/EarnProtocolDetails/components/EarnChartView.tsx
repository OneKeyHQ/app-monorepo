import type { FC } from 'react';

import type { IChartViewProps } from '@onekeyhq/kit/src/views/Market/components/Chart/chartUtils';
import ChartView from '@onekeyhq/kit/src/views/Market/components/Chart/ChartView';

const EarnChartView: FC<IChartViewProps> = (props) => <ChartView {...props} />;

export default EarnChartView;
export type { IChartViewProps };

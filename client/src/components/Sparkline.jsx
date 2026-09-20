import { SparkAreaChart } from '@tremor/react';

import { toTremorColor } from './charts';

export default function Sparkline({ values = [], color = '#8B5CF6', height = 40, className = '', strokeWidth = 2 }) {
  const data = values.map((v, i) => ({ i: `p${i}`, v: Number(v) || 0 }));

  if (!data.length) return <div className={className} style={{ height }} />;

  return (
    <div className={className} style={{ height }}>
      <SparkAreaChart
        className="h-full w-full"
        data={data}
        index="i"
        categories={['v']}
        colors={[toTremorColor(color)]}
      />
    </div>
  );
}
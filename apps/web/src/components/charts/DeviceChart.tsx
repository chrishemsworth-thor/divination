import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

type Props = {
  data: Array<{ device: string; count: number }>;
};

const COLORS: Record<string, string> = {
  desktop: '#0ea5e9',
  mobile: '#8b5cf6',
  tablet: '#f59e0b',
  unknown: '#e2e8f0',
};

export default function DeviceChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="h-40 flex items-center justify-center text-gray-400 text-sm">
        No data yet
      </div>
    );
  }

  const total = data.reduce((s, d) => s + d.count, 0);

  return (
    <ResponsiveContainer width="100%" height={160}>
      <PieChart>
        <Pie
          data={data}
          dataKey="count"
          nameKey="device"
          cx="50%"
          cy="50%"
          innerRadius={40}
          outerRadius={64}
          paddingAngle={2}
        >
          {data.map((entry) => (
            <Cell
              key={entry.device}
              fill={COLORS[entry.device] ?? '#cbd5e1'}
            />
          ))}
        </Pie>
        <Tooltip
          formatter={(v: number) => [
            `${v.toLocaleString()} (${Math.round((v / total) * 100)}%)`,
          ]}
          contentStyle={{
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            fontSize: '12px',
          }}
        />
        <Legend
          iconType="circle"
          iconSize={8}
          formatter={(val) => (
            <span style={{ fontSize: 12, color: '#64748b', textTransform: 'capitalize' }}>
              {val}
            </span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

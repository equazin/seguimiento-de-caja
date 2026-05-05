import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { formatMoney } from '@/lib/formatters'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'

interface CatData {
  categoria: string
  color: string
  icono: string
  total: number
}

interface Props {
  data: CatData[]
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="bg-surface-2 border border-border rounded-lg p-3 shadow-xl">
      <p className="text-xs font-semibold text-white">{d.icono} {d.categoria}</p>
      <p className="text-xs text-muted-foreground mt-1">{formatMoney(d.total)}</p>
    </div>
  )
}

export function ChartDonutEgresos({ data }: Props) {
  const top6 = data.slice(0, 6)

  return (
    <Card className="w-80 flex-shrink-0">
      <CardHeader>
        <CardTitle>Egresos por categoría</CardTitle>
      </CardHeader>
      {top6.length === 0 ? (
        <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
          Sin egresos este mes
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={top6}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={85}
              paddingAngle={3}
              dataKey="total"
              nameKey="categoria"
            >
              {top6.map((entry) => (
                <Cell key={entry.categoria} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend
              iconType="circle"
              iconSize={8}
              formatter={(value) => <span style={{ color: '#9ca3af', fontSize: 10 }}>{value}</span>}
            />
          </PieChart>
        </ResponsiveContainer>
      )}
    </Card>
  )
}

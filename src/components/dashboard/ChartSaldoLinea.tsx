import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts'
import { formatMoneyShort, formatMoney } from '@/lib/formatters'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'

interface Props {
  data: { fecha: string; saldo: number }[]
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-surface-2 border border-border rounded-lg p-3 shadow-xl">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold text-white">{formatMoney(payload[0].value)}</p>
    </div>
  )
}

export function ChartSaldoLinea({ data }: Props) {
  const min = Math.min(...data.map(d => d.saldo))
  const max = Math.max(...data.map(d => d.saldo))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Saldo acumulado</CardTitle>
        <span className="text-xs text-muted-foreground">Últimos 30 días</span>
      </CardHeader>
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={data}>
          <defs>
            <linearGradient id="saldoGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#2A2D3A" vertical={false} />
          <XAxis
            dataKey="fecha"
            tick={{ fill: '#6b7280', fontSize: 9 }}
            axisLine={false}
            tickLine={false}
            interval={6}
          />
          <YAxis
            domain={[min * 0.95, max * 1.05]}
            tickFormatter={formatMoneyShort}
            tick={{ fill: '#6b7280', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={55}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine y={0} stroke="#2A2D3A" />
          <Line
            type="monotone"
            dataKey="saldo"
            stroke="#6366f1"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: '#6366f1' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </Card>
  )
}

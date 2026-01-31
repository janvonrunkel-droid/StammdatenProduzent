'use client'

import { useMemo } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendingUp } from 'lucide-react'
import type { PriceData } from './types'

interface PriceChartProps {
  prices: PriceData[]
  unit: { abbreviation: string | null; name: string } | null
  isLoading?: boolean
}

const COLORS = [
  '#3B82F6', // blue
  '#10B981', // green
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#84CC16', // lime
]

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
  })
}

function formatCurrency(value: number): string {
  return value.toLocaleString('de-DE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

interface ChartDataPoint {
  date: string
  dateFormatted: string
  [key: string]: string | number
}

export function PriceChart({ prices, unit, isLoading }: PriceChartProps) {
  const unitDisplay = unit?.abbreviation || unit?.name || ''

  // Transform prices into chart data
  const { chartData, suppliers } = useMemo(() => {
    // Group prices by date and supplier
    const dateMap = new Map<string, Map<string, number>>()
    const supplierSet = new Set<string>()

    for (const price of prices) {
      if (price.supplier) {
        const supplierName = price.supplier.name
        supplierSet.add(supplierName)

        const dateKey = price.price_date
        if (!dateMap.has(dateKey)) {
          dateMap.set(dateKey, new Map())
        }
        dateMap.get(dateKey)!.set(supplierName, price.price_per_unit)
      }
    }

    // Sort dates and create chart data
    const sortedDates = Array.from(dateMap.keys()).sort()
    const chartData: ChartDataPoint[] = sortedDates.map(date => {
      const supplierPrices = dateMap.get(date)!
      const dataPoint: ChartDataPoint = {
        date,
        dateFormatted: formatDate(date),
      }

      for (const supplier of supplierSet) {
        const price = supplierPrices.get(supplier)
        if (price !== undefined) {
          dataPoint[supplier] = price
        }
      }

      return dataPoint
    })

    return {
      chartData,
      suppliers: Array.from(supplierSet),
    }
  }, [prices])

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Preisentwicklung
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] animate-pulse bg-muted rounded" />
        </CardContent>
      </Card>
    )
  }

  if (prices.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Preisentwicklung
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[300px] text-muted-foreground">
            Keine Preisdaten für den gewählten Zeitraum
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Preisentwicklung
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart
            data={chartData}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="dateFormatted"
              tick={{ fontSize: 12 }}
              className="text-muted-foreground"
            />
            <YAxis
              tick={{ fontSize: 12 }}
              tickFormatter={(value) => `${formatCurrency(value)} €`}
              className="text-muted-foreground"
              width={80}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="rounded-lg border bg-background p-3 shadow-md">
                      <p className="text-sm font-medium mb-2">{label}</p>
                      {payload.map((entry, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-2 text-sm"
                        >
                          <div
                            className="h-3 w-3 rounded-full"
                            style={{ backgroundColor: entry.color }}
                          />
                          <span className="text-muted-foreground">{entry.name}:</span>
                          <span className="font-medium">
                            {formatCurrency(entry.value as number)} €/{unitDisplay}
                          </span>
                        </div>
                      ))}
                    </div>
                  )
                }
                return null
              }}
            />
            <Legend />
            {suppliers.map((supplier, index) => (
              <Line
                key={supplier}
                type="monotone"
                dataKey={supplier}
                stroke={COLORS[index % COLORS.length]}
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

'use client'

import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { TimeRange, timeRangeConfig } from './types'

interface TimeRangeSelectorProps {
  value: TimeRange
  onChange: (value: TimeRange) => void
}

export function TimeRangeSelector({ value, onChange }: TimeRangeSelectorProps) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(newValue) => {
        if (newValue) {
          onChange(newValue as TimeRange)
        }
      }}
      className="justify-start"
    >
      {(Object.keys(timeRangeConfig) as TimeRange[]).map((range) => (
        <ToggleGroupItem
          key={range}
          value={range}
          className="px-3 py-1.5 text-sm"
        >
          {timeRangeConfig[range].label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}

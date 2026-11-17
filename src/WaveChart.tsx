import type { DayPoint } from './data'

export function WaveChart({ points }: { points: DayPoint[] }) {
  if (points.length === 0) {
    return <p className="muted">No days in this period.</p>
  }
  const width = 720
  const height = 148
  const padX = 28
  const padTop = 16
  const padBottom = 32
  const max = Math.max(...points.map((point) => Math.max(point.total, point.profit, 0)), 1)
  const step = points.length === 1 ? 0 : (width - padX * 2) / (points.length - 1)
  const yFor = (value: number) => padTop + (1 - value / max) * (height - padTop - padBottom)
  const sales = points.map((point, index) => ({ x: padX + step * index, y: yFor(point.total), point }))
  const profit = points.map((point, index) => ({ x: padX + step * index, y: yFor(Math.max(point.profit, 0)), point }))
  const salesLine = smooth(sales)
  const profitLine = smooth(profit)
  const base = height - padBottom
  const salesArea = `${salesLine} L ${sales[sales.length - 1].x} ${base} L ${sales[0].x} ${base} Z`
  const labelEvery = Math.max(1, Math.ceil(points.length / 6))
  const grid = [0.25, 0.5, 0.75, 1]

  return (
    <figure className="chart">
      <svg className="wave" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Sales and profit by day">
        <defs>
          <linearGradient id="sales-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1565c0" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#1565c0" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="profit-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2e7d32" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#2e7d32" stopOpacity="0" />
          </linearGradient>
        </defs>
        {grid.map((mark) => {
          const y = yFor(max * mark)
          return <line key={mark} x1={padX} x2={width - padX} y1={y} y2={y} className="grid-line" />
        })}
        <path d={salesArea} fill="url(#sales-fill)" />
        <path d={`${profitLine} L ${profit[profit.length - 1].x} ${base} L ${profit[0].x} ${base} Z`} fill="url(#profit-fill)" />
        <path d={salesLine} fill="none" stroke="#1565c0" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        <path d={profitLine} fill="none" stroke="#2e7d32" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {sales.map((item, index) =>
          index % labelEvery === 0 || index === sales.length - 1 ? (
            <text key={item.point.key} x={item.x} y={height - 8} textAnchor="middle" className="wave-label">
              {item.point.label}
            </text>
          ) : null,
        )}
      </svg>
      <figcaption className="legend">
        <span><i className="swatch sales" /> Sales</span>
        <span><i className="swatch profit" /> Profit</span>
      </figcaption>
    </figure>
  )
}

function smooth(points: { x: number; y: number }[]): string {
  if (points.length === 1) {
    const point = points[0]
    const left = Math.max(16, point.x - 36)
    const right = point.x + 36
    return `M ${left} ${point.y} Q ${point.x} ${point.y - 18} ${right} ${point.y}`
  }
  let path = `M ${points[0].x} ${points[0].y}`
  for (let index = 0; index < points.length - 1; index += 1) {
    const current = points[index]
    const next = points[index + 1]
    const mid = (current.x + next.x) / 2
    path += ` C ${mid} ${current.y}, ${mid} ${next.y}, ${next.x} ${next.y}`
  }
  return path
}

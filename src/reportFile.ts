import type { OrderRow, PeriodSummary, RefundRow, StoreRow } from './data'
import type { TimeWindow } from './time'
import { dayKey } from './time'

function cell(value: string | number): string {
  const text = String(value)
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

function line(values: Array<string | number>): string {
  return values.map(cell).join(',')
}

function amount(value: number): string {
  return (Number.isFinite(value) ? value : 0).toFixed(2)
}

function inclusiveEnd(range: TimeWindow): string {
  const end = new Date(range.end)
  if (Number.isNaN(end.getTime())) return range.end
  return new Date(end.getTime() - 1000).toISOString()
}

export function salesReportCsv(input: {
  store: StoreRow
  range: TimeWindow
  summary: PeriodSummary
  orders: OrderRow[]
  refunds: RefundRow[]
  customerNames: Map<string, string>
}): string {
  const { store, range, summary, orders, refunds, customerNames } = input
  const zone = store.timezone
  const from = dayKey(range.start, zone)
  const to = dayKey(inclusiveEnd(range), zone)
  const rows: string[] = [
    line(['Mentura POS sales report']),
    line(['Store', store.name]),
    line(['Currency', store.currency_symbol]),
    line(['Timezone', zone]),
    line(['From', from]),
    line(['To', to]),
    '',
    line(['Summary']),
    line(['Sales', amount(summary.sales)]),
    line(['Orders', summary.orderCount]),
    line(['Completed orders', summary.completedCount]),
    line(['Refunds', amount(summary.refunds)]),
    line(['Tax', amount(summary.tax)]),
    line(['Discount', amount(summary.discount)]),
    line(['Item cost', amount(summary.cost)]),
    line(['Net profit', amount(summary.profit)]),
    line(['Cash', amount(summary.payments.cash)]),
    line(['Card', amount(summary.payments.card)]),
    line(['UPI', amount(summary.payments.upi)]),
    line(['Credit', amount(summary.payments.credit)]),
    line(['Other', amount(summary.payments.other)]),
    '',
    line(['Sales by day']),
    line(['Day', 'Sales', 'Profit']),
    ...summary.days.map((day) => line([day.label, amount(day.total), amount(day.profit)])),
    '',
    line(['Fast selling']),
    line(['Rank', 'Item', 'Quantity', 'Total']),
    ...[...summary.topItems]
      .sort((a, b) => b.quantity - a.quantity || b.total - a.total)
      .map((item, index) => line([index + 1, item.name, item.quantity, amount(item.total)])),
    '',
    line(['Top items']),
    line(['Item', 'Quantity', 'Total']),
    ...summary.topItems.map((item) => line([item.name, item.quantity, amount(item.total)])),
    '',
    line(['Orders']),
    line(['When', 'Order', 'Customer', 'Status', 'Payment', 'Total', 'Tax', 'Discount', 'Refunded', 'Cash', 'Card', 'UPI']),
    ...orders.map((order) =>
      line([
        dayKey(order.completed_at, zone),
        order.local_id,
        (order.customer_local_id && customerNames.get(order.customer_local_id)) || 'Walk-in',
        order.status,
        order.payment_method ?? '',
        amount(order.total),
        amount(order.tax_amount),
        amount(order.discount_amount),
        amount(order.refunded_amount),
        amount(order.cash_amount ?? 0),
        amount(order.card_amount ?? 0),
        amount(order.upi_amount ?? 0),
      ]),
    ),
    '',
    line(['Refunds']),
    line(['When', 'Number', 'Reason', 'Method', 'Total']),
    ...refunds.map((refund) =>
      line([
        dayKey(refund.created_at, zone),
        refund.refund_number,
        refund.reason,
        refund.payment_method,
        amount(refund.total_amount),
      ]),
    ),
  ]
  return `\uFEFF${rows.join('\n')}`
}

export function salesReportFilename(storeName: string, range: TimeWindow, timeZone: string): string {
  const from = dayKey(range.start, timeZone)
  const to = dayKey(inclusiveEnd(range), timeZone)
  const safe = storeName.replace(/[^\w.-]+/g, '-').replace(/^-|-$/g, '') || 'store'
  return `mentura-sales-${safe}-${from}-to-${to}.csv`
}

export function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

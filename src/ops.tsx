import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  loadBatches,
  loadCashOps,
  loadGrns,
  loadProducts,
  loadPromotions,
  loadPurchaseOrders,
  loadPurchaseReturns,
  loadShiftDirectory,
  loadStockTakeItems,
  loadStockTakes,
  loadSuppliers,
  type BatchRow,
  type BuyLine,
  type CashOpRow,
  type GrnRow,
  type ProductRow,
  type PromotionRow,
  type PurchaseOrderRow,
  type PurchaseReturnRow,
  type StockTakeItemRow,
  type StockTakeRow,
  type StoreRow,
  type SupplierRow,
} from './data'
import { asNumber, money, qty } from './format'
import { dayKey, formatDay, formatWhen, type TimeWindow } from './time'

function inWindow(iso: string | null, window: TimeWindow): boolean {
  if (!iso) return false
  const time = new Date(iso).getTime()
  return time >= new Date(window.start).getTime() && time < new Date(window.end).getTime()
}

function supplierName(suppliers: SupplierRow[], localId: string): string {
  return suppliers.find((row) => row.local_id === localId)?.name ?? 'Supplier'
}

function productName(products: ProductRow[], localId: string): string {
  return products.find((row) => row.local_id === localId)?.name ?? 'Product'
}

function Lines({ lines, symbol }: { lines: BuyLine[]; symbol: string }) {
  if (lines.length === 0) return <p className="muted">No lines on this document.</p>
  return (
    <ul className="lines">
      {lines.map((line, index) => (
        <li key={`${line.name}-${index}`}>
          <span>
            {line.name}
            <small>
              {qty(line.quantity)} × {money(line.cost, symbol)}
            </small>
          </span>
          <strong className="price">{money(line.quantity * line.cost, symbol)}</strong>
        </li>
      ))}
    </ul>
  )
}

export function Buying({
  client,
  store,
  range,
}: {
  client: SupabaseClient
  store: StoreRow
  range: TimeWindow | null
}) {
  const [section, setSection] = useState<'suppliers' | 'orders' | 'received' | 'returns'>('orders')
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([])
  const [orders, setOrders] = useState<PurchaseOrderRow[]>([])
  const [receipts, setReceipts] = useState<GrnRow[]>([])
  const [returns, setReturns] = useState<PurchaseReturnRow[]>([])
  const [selected, setSelected] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const symbol = store.currency_symbol

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    setSelected('')
    const documents = range
      ? Promise.all([
          loadPurchaseOrders(client, store.id, range),
          loadGrns(client, store.id, range),
          loadPurchaseReturns(client, store.id, range),
        ])
      : Promise.resolve([[] as PurchaseOrderRow[], [] as GrnRow[], [] as PurchaseReturnRow[]] as const)
    Promise.all([loadSuppliers(client, store.id), documents])
      .then(([nextSuppliers, [nextOrders, nextReceipts, nextReturns]]) => {
        if (!active) return
        setSuppliers(nextSuppliers)
        setOrders(nextOrders)
        setReceipts(nextReceipts)
        setReturns(nextReturns)
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : 'Could not load buying')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [client, store.id, range?.start, range?.end])

  const sections = [
    ['suppliers', 'Suppliers'],
    ['orders', 'Orders'],
    ['received', 'Received'],
    ['returns', 'Returns'],
  ] as const

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Buying</h2>
      </div>
      <div className="chips" role="tablist" aria-label="Buying sections">
        {sections.map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={section === id ? 'chip active' : 'chip'}
            onClick={() => {
              setSection(id)
              setSelected('')
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {error ? <p className="error">{error}</p> : null}
      {loading ? <p className="muted">Loading buying…</p> : null}
      {!loading && section === 'suppliers' ? (
        <Suppliers rows={suppliers} />
      ) : null}
      {!loading && section !== 'suppliers' && !range ? <p className="muted">Choose a start date and an end date.</p> : null}
      {!loading && range && section === 'orders' ? (
        <Documents
          empty="No purchase orders in this period."
          rows={orders.map((row) => ({
            id: row.id,
            when: formatWhen(row.created_at, store.timezone),
            number: row.po_number,
            who: supplierName(suppliers, row.supplier_local_id),
            status: row.status,
            amount: row.total_amount,
            note: row.expected_date ? `Expected ${formatDay(row.expected_date, store.timezone)}` : null,
            lines: row.lines,
          }))}
          selected={selected}
          onSelect={setSelected}
          symbol={symbol}
        />
      ) : null}
      {!loading && range && section === 'received' ? (
        <Documents
          empty="No goods received in this period."
          rows={receipts.map((row) => ({
            id: row.id,
            when: formatWhen(row.received_at, store.timezone),
            number: row.grn_number,
            who: supplierName(suppliers, row.supplier_local_id),
            status: 'received',
            amount: row.total_cost,
            note: row.notes,
            lines: row.lines,
          }))}
          selected={selected}
          onSelect={setSelected}
          symbol={symbol}
        />
      ) : null}
      {!loading && range && section === 'returns' ? (
        <Documents
          empty="No purchase returns in this period."
          rows={returns.map((row) => ({
            id: row.id,
            when: formatWhen(row.created_at, store.timezone),
            number: row.return_number,
            who: supplierName(suppliers, row.supplier_local_id),
            status: 'returned',
            amount: row.total_amount,
            note: row.reason,
            lines: row.lines,
          }))}
          selected={selected}
          onSelect={setSelected}
          symbol={symbol}
        />
      ) : null}
    </section>
  )
}

function Suppliers({ rows }: { rows: SupplierRow[] }) {
  if (rows.length === 0) return <p className="muted">No suppliers on file.</p>
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Supplier</th>
            <th>Contact</th>
            <th>Phone</th>
            <th>Terms</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{row.name}</td>
              <td>{row.contact_person ?? row.email ?? '—'}</td>
              <td>{row.phone ?? '—'}</td>
              <td>{row.payment_terms ?? '—'}</td>
              <td>{row.is_active ? 'Active' : 'Inactive'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Documents({
  rows,
  empty,
  selected,
  onSelect,
  symbol,
}: {
  rows: {
    id: string
    when: string
    number: string
    who: string
    status: string
    amount: number
    note: string | null
    lines: BuyLine[]
  }[]
  empty: string
  selected: string
  onSelect: (id: string) => void
  symbol: string
}) {
  const current = rows.find((row) => row.id === selected)
  if (rows.length === 0) return <p className="muted">{empty}</p>
  return (
    <div className="split-layout">
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>When</th>
              <th>Number</th>
              <th>Supplier</th>
              <th className="num">Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className={row.id === selected ? 'clickable selected' : 'clickable'}
                tabIndex={0}
                onClick={() => onSelect(row.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onSelect(row.id)
                  }
                }}
              >
                <td>{row.when}</td>
                <td>{row.number}</td>
                <td>{row.who}</td>
                <td className="num price">{money(row.amount, symbol)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <article className="card detail">
        {current ? (
          <>
            <h3>{current.number}</h3>
            <p className="muted">
              {current.who} · {current.status}
              {current.note ? ` · ${current.note}` : ''}
            </p>
            <Lines lines={current.lines} symbol={symbol} />
          </>
        ) : (
          <p className="muted">Select a document to see its lines.</p>
        )}
      </article>
    </div>
  )
}

export function Expiry({ client, store }: { client: SupabaseClient; store: StoreRow }) {
  const [rows, setRows] = useState<BatchRow[]>([])
  const [products, setProducts] = useState<ProductRow[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    Promise.all([loadBatches(client, store.id), loadProducts(client, store.id)])
      .then(([batches, catalog]) => {
        if (!active) return
        setRows(batches)
        setProducts(catalog)
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : 'Could not load expiry')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [client, store.id])

  const today = dayKey(new Date().toISOString(), store.timezone)
  const soonLimit = new Date()
  soonLimit.setUTCDate(soonLimit.getUTCDate() + 30)
  const soonKey = dayKey(soonLimit.toISOString(), store.timezone)

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Expiry</h2>
      </div>
      <p className="muted">Batches still on hand that carry an expiry date.</p>
      {error ? <p className="error">{error}</p> : null}
      {loading ? <p className="muted">Loading batches…</p> : null}
      {!loading && rows.length === 0 ? <p className="muted">No stock on hand has an expiry date.</p> : null}
      {rows.length > 0 ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Batch</th>
                <th>Expires</th>
                <th className="num">On hand</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const expires = row.expiry_date ? dayKey(row.expiry_date, store.timezone) : ''
                const status = expires < today ? 'Expired' : expires <= soonKey ? 'Within 30 days' : 'Later'
                return (
                  <tr key={row.id}>
                    <td>{productName(products, row.product_local_id)}</td>
                    <td>{row.batch_number}</td>
                    <td>{row.expiry_date ? formatDay(row.expiry_date, store.timezone) : '—'}</td>
                    <td className="num">{qty(row.qty)}</td>
                    <td>{status}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  )
}

export function Counts({
  client,
  store,
  range,
}: {
  client: SupabaseClient
  store: StoreRow
  range: TimeWindow | null
}) {
  const [rows, setRows] = useState<StockTakeRow[]>([])
  const [products, setProducts] = useState<ProductRow[]>([])
  const [selected, setSelected] = useState('')
  const [items, setItems] = useState<StockTakeItemRow[]>([])
  const [error, setError] = useState('')
  const [itemError, setItemError] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadingItems, setLoadingItems] = useState(false)

  useEffect(() => {
    let active = true
    setLoading(true)
    setSelected('')
    setItems([])
    Promise.all([loadStockTakes(client, store.id), loadProducts(client, store.id)])
      .then(([takes, catalog]) => {
        if (!active) return
        setRows(takes)
        setProducts(catalog)
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : 'Could not load stock counts')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [client, store.id])

  useEffect(() => {
    if (!selected) return
    let active = true
    setLoadingItems(true)
    setItemError('')
    loadStockTakeItems(client, store.id, selected)
      .then((next) => {
        if (active) setItems(next)
      })
      .catch((err: unknown) => {
        if (active) setItemError(err instanceof Error ? err.message : 'Could not load count lines')
      })
      .finally(() => {
        if (active) setLoadingItems(false)
      })
    return () => {
      active = false
    }
  }, [client, store.id, selected])

  const visible = range
    ? rows.filter((row) => inWindow(row.created_at, range) || inWindow(row.completed_at, range))
    : []
  const current = visible.find((row) => row.id === selected)

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Counts</h2>
      </div>
      <p className="muted">Physical stock counts started or finished in this period.</p>
      {!range ? <p className="muted">Choose a start date and an end date.</p> : null}
      {error ? <p className="error">{error}</p> : null}
      {loading ? <p className="muted">Loading counts…</p> : null}
      {!loading && range && visible.length === 0 ? <p className="muted">No stock counts in this period.</p> : null}
      {visible.length > 0 ? (
        <div className="split-layout">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Number</th>
                  <th>Status</th>
                  <th>Started</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => (
                  <tr
                    key={row.id}
                    className={row.id === selected ? 'clickable selected' : 'clickable'}
                    tabIndex={0}
                    onClick={() => setSelected(row.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        setSelected(row.id)
                      }
                    }}
                  >
                    <td>{row.stock_take_number}</td>
                    <td>{row.status}</td>
                    <td>{formatWhen(row.created_at, store.timezone)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <article className="card detail">
            {current ? (
              <>
                <h3>{current.stock_take_number}</h3>
                <p className="muted">
                  {current.status}
                  {current.completed_at ? ` · finished ${formatWhen(current.completed_at, store.timezone)}` : ''}
                  {current.notes ? ` · ${current.notes}` : ''}
                </p>
                {itemError ? <p className="error">{itemError}</p> : null}
                {loadingItems ? <p className="muted">Loading lines…</p> : null}
                {!loadingItems && items.length === 0 ? <p className="muted">No lines on this count.</p> : null}
                {items.length > 0 ? (
                  <div className="table-wrap inset">
                    <table>
                      <thead>
                        <tr>
                          <th>Product</th>
                          <th className="num">System</th>
                          <th className="num">Counted</th>
                          <th className="num">Variance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item) => (
                          <tr key={item.id}>
                            <td>{productName(products, item.product_local_id)}</td>
                            <td className="num">{qty(item.system_qty)}</td>
                            <td className="num">{qty(item.counted_qty)}</td>
                            <td className="num">{qty(item.counted_qty - item.system_qty)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </>
            ) : (
              <p className="muted">Select a count to see the variance on each line.</p>
            )}
          </article>
        </div>
      ) : null}
    </section>
  )
}

const OFFER_LABEL: Record<string, string> = {
  pct_off: '% off',
  amt_off: 'Amount off',
  bogo: 'Buy one, get one',
  buy_x_get_y: 'Buy X, get Y',
  combo: 'Combo',
  happy_hour: 'Happy hour',
}

function clockFromMinutes(minutes: number): string {
  const hour = Math.floor(minutes / 60) % 24
  const minute = minutes % 60
  const sample = new Date()
  sample.setHours(hour, minute, 0, 0)
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(sample)
}

function offerDetail(row: PromotionRow, symbol: string): string {
  if (row.type === 'pct_off') return `${asNumber(row.reward.discountPct)}% off`
  if (row.type === 'amt_off') return `${money(asNumber(row.reward.discountAmt), symbol)} off`
  if (row.type === 'buy_x_get_y') {
    return `Buy ${asNumber(row.conditions.buyQty)}, get ${asNumber(row.conditions.getQty)}`
  }
  if (row.type === 'happy_hour' && row.start_time != null && row.end_time != null) {
    return `${clockFromMinutes(row.start_time)}–${clockFromMinutes(row.end_time)}`
  }
  return OFFER_LABEL[row.type] ?? row.type
}

function offerState(row: PromotionRow, timeZone: string): string {
  if (!row.is_active) return 'Off'
  const today = dayKey(new Date().toISOString(), timeZone)
  const start = dayKey(row.start_date, timeZone)
  const end = dayKey(row.end_date, timeZone)
  if (today < start) return 'Scheduled'
  if (today > end) return 'Ended'
  return 'On'
}

export function Promotions({ client, store }: { client: SupabaseClient; store: StoreRow }) {
  const [rows, setRows] = useState<PromotionRow[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const symbol = store.currency_symbol

  useEffect(() => {
    let active = true
    setLoading(true)
    loadPromotions(client, store.id)
      .then((next) => {
        if (active) setRows(next)
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : 'Could not load promotions')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [client, store.id])

  const ordered = [...rows].sort((a, b) => {
    const rank = (row: PromotionRow) => (offerState(row, store.timezone) === 'On' ? 0 : 1)
    return rank(a) - rank(b) || a.name.localeCompare(b.name)
  })

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Promotions</h2>
      </div>
      {error ? <p className="error">{error}</p> : null}
      {loading ? <p className="muted">Loading promotions…</p> : null}
      {!loading && ordered.length === 0 ? <p className="muted">No promotions on file.</p> : null}
      {ordered.length > 0 ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Offer</th>
                <th>Type</th>
                <th>Dates</th>
                <th>Code</th>
                <th className="num">Uses</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {ordered.map((row) => (
                <tr key={row.id}>
                  <td>
                    {row.name}
                    <small className="cell-note">{offerDetail(row, symbol)}</small>
                  </td>
                  <td>{OFFER_LABEL[row.type] ?? row.type}</td>
                  <td>
                    {formatDay(row.start_date, store.timezone)} – {formatDay(row.end_date, store.timezone)}
                  </td>
                  <td>{row.promo_code ?? '—'}</td>
                  <td className="num">{row.usage_count}</td>
                  <td>{offerState(row, store.timezone)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  )
}

const CASH_LABEL: Record<string, string> = {
  paid_in: 'Paid in',
  paid_out: 'Paid out',
  open_drawer: 'Drawer opened',
}

export function Cash({
  client,
  store,
  range,
}: {
  client: SupabaseClient
  store: StoreRow
  range: TimeWindow | null
}) {
  const [rows, setRows] = useState<CashOpRow[]>([])
  const [shifts, setShifts] = useState<Map<string, { cashier_name: string; opened_at: string }>>(new Map())
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const symbol = store.currency_symbol

  useEffect(() => {
    if (!range) {
      setLoading(false)
      return
    }
    let active = true
    setLoading(true)
    setError('')
    Promise.all([loadCashOps(client, store.id, range), loadShiftDirectory(client, store.id)])
      .then(([ops, directory]) => {
        if (!active) return
        setRows(ops)
        setShifts(directory)
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : 'Could not load cash movements')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [client, store.id, range?.start, range?.end])

  const paidIn = rows.filter((row) => row.type === 'paid_in').reduce((sum, row) => sum + (row.amount ?? 0), 0)
  const paidOut = rows.filter((row) => row.type === 'paid_out').reduce((sum, row) => sum + (row.amount ?? 0), 0)
  const opened = rows.filter((row) => row.type === 'open_drawer').length

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Cash</h2>
      </div>
      <p className="muted">Money paid into the drawer, paid out, and times the drawer was opened.</p>
      {!range ? <p className="muted">Choose a start date and an end date.</p> : null}
      {error ? <p className="error">{error}</p> : null}
      {loading ? <p className="muted">Loading cash…</p> : null}
      {range && !loading ? (
        <>
          <div className="metrics">
            <article className="card metric">
              <p>Paid in</p>
              <strong className="price">{money(paidIn, symbol)}</strong>
            </article>
            <article className="card metric">
              <p>Paid out</p>
              <strong className="price">{money(paidOut, symbol)}</strong>
            </article>
            <article className="card metric">
              <p>Drawer opened</p>
              <strong>{opened}</strong>
            </article>
          </div>
          {rows.length === 0 ? <p className="muted">No cash movements in this period.</p> : null}
          {rows.length > 0 ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Shift</th>
                    <th>Type</th>
                    <th className="num">Amount</th>
                    <th>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const shift = shifts.get(row.shift_id)
                    return (
                      <tr key={row.id}>
                        <td>{formatWhen(row.created_at, store.timezone)}</td>
                        <td>{shift ? shift.cashier_name : '—'}</td>
                        <td>{CASH_LABEL[row.type] ?? row.type}</td>
                        <td className="num price">{row.amount == null ? '—' : money(row.amount, symbol)}</td>
                        <td>{row.reason ?? '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  )
}

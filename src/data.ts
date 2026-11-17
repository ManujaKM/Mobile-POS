import type { SupabaseClient } from '@supabase/supabase-js'
import { asNumber } from './format'
import { dayBuckets, dayKey, type TimeWindow } from './time'

export type StoreRow = {
  id: string
  name: string
  currency_symbol: string
  timezone: string
}

export type OrderRow = {
  id: string
  local_id: string
  total: number
  tax_amount: number
  discount_amount: number
  payment_method: string | null
  cash_amount: number | null
  card_amount: number | null
  upi_amount: number | null
  status: string
  refunded_amount: number
  completed_at: string
  customer_local_id: string | null
}

export type OrderItemRow = {
  id: string
  product_name: string
  quantity: number
  unit_price: number
  discount_amount: number
  subtotal: number
}

export type LowStockRow = {
  id: string
  name: string
  stock_qty: number
  reorder_point: number
  unit: string
}

export type PaymentSplit = {
  cash: number
  card: number
  upi: number
  credit: number
  other: number
}

export type TopItem = {
  name: string
  quantity: number
  total: number
}

export type RefundRow = {
  id: string
  refund_number: string
  total_amount: number
  reason: string
  payment_method: string
  created_at: string
}

export type VoidRow = {
  id: string
  product_name: string
  quantity: number
  unit_price: number
  reason: string | null
  type: string
  cashier_name: string
  voided_at: string
}

export type ShiftRow = {
  id: string
  cashier_name: string
  opening_cash: number
  expected_cash: number | null
  actual_cash: number | null
  variance: number | null
  status: string
  opened_at: string
  closed_at: string | null
}

export type CreditCustomer = {
  id: string
  name: string
  phone: string | null
  credit_balance: number
  credit_limit: number
}

export type DayPoint = {
  key: string
  label: string
  total: number
  profit: number
}

export type ProductRow = {
  id: string
  local_id: string
  name: string
  barcode: string | null
  price: number
  stock_qty: number
  unit: string
  is_active: boolean
  reorder_point: number
}

export type SupplierRow = {
  id: string
  local_id: string
  name: string
  contact_person: string | null
  phone: string | null
  email: string | null
  payment_terms: string | null
  is_active: boolean
}

export type BuyLine = {
  name: string
  quantity: number
  cost: number
}

export type PurchaseOrderRow = {
  id: string
  po_number: string
  supplier_local_id: string
  status: string
  lines: BuyLine[]
  total_amount: number
  expected_date: string | null
  created_at: string
}

export type GrnRow = {
  id: string
  grn_number: string
  supplier_local_id: string
  lines: BuyLine[]
  total_cost: number
  notes: string | null
  received_at: string
}

export type PurchaseReturnRow = {
  id: string
  return_number: string
  supplier_local_id: string
  lines: BuyLine[]
  total_amount: number
  reason: string | null
  created_at: string
}

export type BatchRow = {
  id: string
  product_local_id: string
  batch_number: string
  qty: number
  cost_price: number
  expiry_date: string | null
  status: string
  received_at: string
}

export type StockTakeRow = {
  id: string
  stock_take_number: string
  status: string
  notes: string | null
  created_at: string
  completed_at: string | null
}

export type StockTakeItemRow = {
  id: string
  stock_take_id: string
  product_local_id: string
  system_qty: number
  counted_qty: number
}

export type PromotionRow = {
  id: string
  name: string
  type: string
  start_date: string
  end_date: string
  start_time: number | null
  end_time: number | null
  is_active: boolean
  promo_code: string | null
  usage_count: number
  min_order_amount: number | null
  reward: Record<string, unknown>
  conditions: Record<string, unknown>
}

export type CashOpRow = {
  id: string
  shift_id: string
  type: string
  amount: number | null
  reason: string | null
  created_at: string
}

export type CustomerRow = {
  id: string
  local_id: string
  name: string
  phone: string | null
  email: string | null
  total_spent: number
  credit_balance: number
  credit_limit: number
}

export type PeriodSummary = {
  sales: number
  orderCount: number
  refunds: number
  completedCount: number
  cost: number
  profit: number
  tax: number
  discount: number
  payments: PaymentSplit
  topItems: TopItem[]
  days: DayPoint[]
}

const PAGE = 1000

async function eachPage<T>(
  load: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await load(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    const batch = data ?? []
    rows.push(...batch)
    if (batch.length < PAGE) return rows
  }
}

export async function loadStores(client: SupabaseClient): Promise<StoreRow[]> {
  const { data, error } = await client
    .from('stores')
    .select('id,name,currency_symbol,timezone')
    .order('name')
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => ({
    id: String(row.id),
    name: String(row.name ?? 'Store'),
    currency_symbol: String(row.currency_symbol ?? ''),
    timezone: String(row.timezone ?? 'UTC'),
  }))
}

function mapOrder(row: Record<string, unknown>): OrderRow {
  return {
    id: String(row.id),
    local_id: String(row.local_id ?? ''),
    total: asNumber(row.total),
    tax_amount: asNumber(row.tax_amount),
    discount_amount: asNumber(row.discount_amount),
    payment_method: row.payment_method == null ? null : String(row.payment_method),
    cash_amount: row.cash_amount == null ? null : asNumber(row.cash_amount),
    card_amount: row.card_amount == null ? null : asNumber(row.card_amount),
    upi_amount: row.upi_amount == null ? null : asNumber(row.upi_amount),
    status: String(row.status ?? 'completed'),
    refunded_amount: asNumber(row.refunded_amount),
    completed_at: String(row.completed_at),
    customer_local_id: row.customer_local_id == null ? null : String(row.customer_local_id),
  }
}

const ORDER_COLUMNS =
  'id,local_id,total,tax_amount,discount_amount,payment_method,cash_amount,card_amount,upi_amount,status,refunded_amount,completed_at,customer_local_id'

export async function loadOrdersInWindow(
  client: SupabaseClient,
  storeId: string,
  window: TimeWindow,
): Promise<OrderRow[]> {
  const rows = await eachPage<Record<string, unknown>>(async (from, to) => {
    const result = await client
      .from('orders')
      .select(ORDER_COLUMNS)
      .eq('store_id', storeId)
      .gte('completed_at', window.start)
      .lt('completed_at', window.end)
      .order('completed_at', { ascending: false })
      .range(from, to)
    return { data: (result.data as Record<string, unknown>[] | null) ?? null, error: result.error }
  })
  return rows.map(mapOrder)
}

export async function loadOrderItems(client: SupabaseClient, orderId: string): Promise<OrderItemRow[]> {
  const { data, error } = await client
    .from('order_items')
    .select('id,product_name,quantity,unit_price,discount_amount,subtotal')
    .eq('order_id', orderId)
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => ({
    id: String(row.id),
    product_name: String(row.product_name ?? ''),
    quantity: asNumber(row.quantity),
    unit_price: asNumber(row.unit_price),
    discount_amount: asNumber(row.discount_amount),
    subtotal: asNumber(row.subtotal),
  }))
}

export async function loadLowStock(client: SupabaseClient, storeId: string): Promise<LowStockRow[]> {
  const rows = await eachPage<Record<string, unknown>>(async (from, to) => {
    const result = await client
      .from('products')
      .select('id,name,stock_qty,reorder_point,unit')
      .eq('store_id', storeId)
      .eq('is_active', true)
      .order('name')
      .range(from, to)
    return { data: (result.data as Record<string, unknown>[] | null) ?? null, error: result.error }
  })
  return rows
    .map((row) => ({
      id: String(row.id),
      name: String(row.name ?? ''),
      stock_qty: asNumber(row.stock_qty),
      reorder_point: asNumber(row.reorder_point),
      unit: String(row.unit ?? ''),
    }))
    .filter((row) => row.stock_qty <= row.reorder_point)
    .sort((a, b) => a.stock_qty - a.reorder_point - (b.stock_qty - b.reorder_point))
}

async function loadSoldCost(
  client: SupabaseClient,
  storeId: string,
  orderIds: string[],
): Promise<{ total: number; byOrder: Map<string, number> }> {
  const products = await eachPage<Record<string, unknown>>(async (from, to) => {
    const result = await client
      .from('products')
      .select('id,local_id,cost_price')
      .eq('store_id', storeId)
      .order('id')
      .range(from, to)
    return { data: (result.data as Record<string, unknown>[] | null) ?? null, error: result.error }
  })
  const costByKey = new Map<string, number>()
  for (const row of products) {
    const cost = asNumber(row.cost_price)
    costByKey.set(String(row.id), cost)
    if (row.local_id != null) costByKey.set(String(row.local_id), cost)
  }
  let total = 0
  const byOrder = new Map<string, number>()
  const size = 80
  for (let index = 0; index < orderIds.length; index += size) {
    const ids = orderIds.slice(index, index + size)
    const { data, error } = await client.from('order_items').select('order_id,product_id,quantity').in('order_id', ids)
    if (error) throw new Error(error.message)
    for (const row of data ?? []) {
      const key = row.product_id == null ? '' : String(row.product_id)
      const amount = asNumber(row.quantity) * (costByKey.get(key) ?? 0)
      const orderId = String(row.order_id)
      total += amount
      byOrder.set(orderId, (byOrder.get(orderId) ?? 0) + amount)
    }
  }
  return { total, byOrder }
}

async function loadTopItems(client: SupabaseClient, orderIds: string[]): Promise<TopItem[]> {
  const totals = new Map<string, { quantity: number; total: number }>()
  const size = 80
  for (let index = 0; index < orderIds.length; index += size) {
    const ids = orderIds.slice(index, index + size)
    const { data, error } = await client.from('order_items').select('product_name,quantity,subtotal').in('order_id', ids)
    if (error) throw new Error(error.message)
    for (const row of data ?? []) {
      const name = String(row.product_name ?? 'Item')
      const current = totals.get(name) ?? { quantity: 0, total: 0 }
      current.quantity += asNumber(row.quantity)
      current.total += asNumber(row.subtotal)
      totals.set(name, current)
    }
  }
  return [...totals.entries()]
    .map(([name, value]) => ({ name, quantity: value.quantity, total: value.total }))
    .sort((a, b) => b.quantity - a.quantity || b.total - a.total)
    .slice(0, 12)
}

export async function loadRefunds(client: SupabaseClient, storeId: string, window: TimeWindow): Promise<RefundRow[]> {
  const rows = await eachPage<Record<string, unknown>>(async (from, to) => {
    const result = await client
      .from('refunds')
      .select('id,refund_number,total_amount,reason,payment_method,created_at')
      .eq('store_id', storeId)
      .gte('created_at', window.start)
      .lt('created_at', window.end)
      .order('created_at', { ascending: false })
      .range(from, to)
    return { data: (result.data as Record<string, unknown>[] | null) ?? null, error: result.error }
  })
  return rows.map((row) => ({
    id: String(row.id),
    refund_number: String(row.refund_number ?? ''),
    total_amount: asNumber(row.total_amount),
    reason: String(row.reason ?? ''),
    payment_method: String(row.payment_method ?? ''),
    created_at: String(row.created_at),
  }))
}

export async function loadVoids(client: SupabaseClient, storeId: string, window: TimeWindow): Promise<VoidRow[]> {
  const rows = await eachPage<Record<string, unknown>>(async (from, to) => {
    const result = await client
      .from('void_logs')
      .select('id,product_name,quantity,unit_price,reason,type,cashier_name,voided_at')
      .eq('store_id', storeId)
      .gte('voided_at', window.start)
      .lt('voided_at', window.end)
      .order('voided_at', { ascending: false })
      .range(from, to)
    return { data: (result.data as Record<string, unknown>[] | null) ?? null, error: result.error }
  })
  return rows.map((row) => ({
    id: String(row.id),
    product_name: String(row.product_name ?? ''),
    quantity: asNumber(row.quantity),
    unit_price: asNumber(row.unit_price),
    reason: row.reason == null ? null : String(row.reason),
    type: String(row.type ?? 'void'),
    cashier_name: String(row.cashier_name ?? ''),
    voided_at: String(row.voided_at),
  }))
}

export async function loadShifts(client: SupabaseClient, storeId: string, window: TimeWindow): Promise<ShiftRow[]> {
  const rows = await eachPage<Record<string, unknown>>(async (from, to) => {
    const result = await client
      .from('shifts')
      .select('id,cashier_name,opening_cash,expected_cash,actual_cash,variance,status,opened_at,closed_at')
      .eq('store_id', storeId)
      .gte('opened_at', window.start)
      .lt('opened_at', window.end)
      .order('opened_at', { ascending: false })
      .range(from, to)
    return { data: (result.data as Record<string, unknown>[] | null) ?? null, error: result.error }
  })
  return rows.map((row) => ({
    id: String(row.id),
    cashier_name: String(row.cashier_name ?? ''),
    opening_cash: asNumber(row.opening_cash),
    expected_cash: row.expected_cash == null ? null : asNumber(row.expected_cash),
    actual_cash: row.actual_cash == null ? null : asNumber(row.actual_cash),
    variance: row.variance == null ? null : asNumber(row.variance),
    status: String(row.status ?? ''),
    opened_at: String(row.opened_at),
    closed_at: row.closed_at == null ? null : String(row.closed_at),
  }))
}

export async function loadProducts(client: SupabaseClient, storeId: string): Promise<ProductRow[]> {
  const rows = await eachPage<Record<string, unknown>>(async (from, to) => {
    const result = await client
      .from('products')
      .select('id,local_id,name,barcode,price,stock_qty,unit,is_active,reorder_point')
      .eq('store_id', storeId)
      .order('name')
      .range(from, to)
    return { data: (result.data as Record<string, unknown>[] | null) ?? null, error: result.error }
  })
  return rows.map((row) => ({
    id: String(row.id),
    local_id: String(row.local_id ?? ''),
    name: String(row.name ?? ''),
    barcode: row.barcode == null ? null : String(row.barcode),
    price: asNumber(row.price),
    stock_qty: asNumber(row.stock_qty),
    unit: String(row.unit ?? ''),
    is_active: Boolean(row.is_active),
    reorder_point: asNumber(row.reorder_point),
  }))
}

export async function loadCustomers(client: SupabaseClient, storeId: string): Promise<CustomerRow[]> {
  const rows = await eachPage<Record<string, unknown>>(async (from, to) => {
    const result = await client
      .from('customers')
      .select('id,local_id,name,phone,email,total_spent,credit_balance,credit_limit')
      .eq('store_id', storeId)
      .order('name')
      .range(from, to)
    return { data: (result.data as Record<string, unknown>[] | null) ?? null, error: result.error }
  })
  return rows.map((row) => ({
    id: String(row.id),
    local_id: String(row.local_id ?? ''),
    name: String(row.name ?? ''),
    phone: row.phone == null ? null : String(row.phone),
    email: row.email == null ? null : String(row.email),
    total_spent: asNumber(row.total_spent),
    credit_balance: asNumber(row.credit_balance),
    credit_limit: asNumber(row.credit_limit),
  }))
}

export async function loadCreditCustomers(client: SupabaseClient, storeId: string): Promise<CreditCustomer[]> {
  const { data, error } = await client
    .from('customers')
    .select('id,name,phone,credit_balance,credit_limit')
    .eq('store_id', storeId)
    .eq('is_active', true)
    .gt('credit_balance', 0)
    .order('credit_balance', { ascending: false })
    .limit(100)
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => ({
    id: String(row.id),
    name: String(row.name ?? ''),
    phone: row.phone == null ? null : String(row.phone),
    credit_balance: asNumber(row.credit_balance),
    credit_limit: asNumber(row.credit_limit),
  }))
}

function emptySplit(): PaymentSplit {
  return { cash: 0, card: 0, upi: 0, credit: 0, other: 0 }
}

function addPayment(order: OrderRow, split: PaymentSplit) {
  const cash = order.cash_amount ?? 0
  const card = order.card_amount ?? 0
  const upi = order.upi_amount ?? 0
  if (cash + card + upi > 0) {
    split.cash += cash
    split.card += card
    split.upi += upi
    return
  }
  const method = (order.payment_method ?? 'cash').toLowerCase()
  if (method === 'card') split.card += order.total
  else if (method === 'upi') split.upi += order.total
  else if (method === 'credit') split.credit += order.total
  else if (method === 'mixed') split.other += order.total
  else split.cash += order.total
}

export async function loadPeriodSummary(
  client: SupabaseClient,
  storeId: string,
  window: TimeWindow,
  timeZone: string,
): Promise<PeriodSummary> {
  const orders = await eachPage<Record<string, unknown>>(async (from, to) => {
    const result = await client
      .from('orders')
      .select(ORDER_COLUMNS)
      .eq('store_id', storeId)
      .gte('completed_at', window.start)
      .lt('completed_at', window.end)
      .order('completed_at', { ascending: true })
      .range(from, to)
    return { data: (result.data as Record<string, unknown>[] | null) ?? null, error: result.error }
  })
  const refunds = await eachPage<{ total_amount: unknown }>(async (from, to) => {
    const result = await client
      .from('refunds')
      .select('total_amount')
      .eq('store_id', storeId)
      .gte('created_at', window.start)
      .lt('created_at', window.end)
      .range(from, to)
    return { data: result.data, error: result.error }
  })

  const mapped = orders.map(mapOrder)
  const payments = emptySplit()
  let sales = 0
  let tax = 0
  let discount = 0
  for (const order of mapped) {
    sales += order.total
    tax += order.tax_amount
    discount += order.discount_amount
    addPayment(order, payments)
  }
  const refundTotal = refunds.reduce((sum, row) => sum + asNumber(row.total_amount), 0)
  const orderIds = mapped.map((order) => order.id)
  const [topItems, sold] = await Promise.all([loadTopItems(client, orderIds), loadSoldCost(client, storeId, orderIds)])
  const cost = sold.total
  const completedCount = mapped.filter((order) => order.status === 'completed' || order.status === 'refunded').length
  const totals = new Map<string, number>()
  const costs = new Map<string, number>()
  for (const order of mapped) {
    const key = dayKey(order.completed_at, timeZone)
    totals.set(key, (totals.get(key) ?? 0) + order.total)
    costs.set(key, (costs.get(key) ?? 0) + (sold.byOrder.get(order.id) ?? 0))
  }
  const days = dayBuckets(window, timeZone).map((bucket) => {
    const total = totals.get(bucket.key) ?? 0
    return {
      key: bucket.key,
      label: bucket.label,
      total,
      profit: total - (costs.get(bucket.key) ?? 0),
    }
  })
  return {
    sales,
    orderCount: mapped.length,
    refunds: refundTotal,
    completedCount,
    cost,
    profit: sales - refundTotal - cost,
    tax,
    discount,
    payments,
    topItems,
    days,
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>
  return {}
}

function buyLines(value: unknown, quantityKey: string): BuyLine[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => {
    const row = asRecord(item)
    return {
      name: String(row.productName ?? 'Item'),
      quantity: asNumber(row[quantityKey]),
      cost: asNumber(row.costPrice),
    }
  })
}

export async function loadSuppliers(client: SupabaseClient, storeId: string): Promise<SupplierRow[]> {
  const rows = await eachPage<Record<string, unknown>>(async (from, to) => {
    const result = await client
      .from('suppliers')
      .select('id,local_id,name,contact_person,phone,email,payment_terms,is_active')
      .eq('store_id', storeId)
      .order('name')
      .range(from, to)
    return { data: (result.data as Record<string, unknown>[] | null) ?? null, error: result.error }
  })
  return rows.map((row) => ({
    id: String(row.id),
    local_id: String(row.local_id ?? ''),
    name: String(row.name ?? ''),
    contact_person: row.contact_person == null ? null : String(row.contact_person),
    phone: row.phone == null ? null : String(row.phone),
    email: row.email == null ? null : String(row.email),
    payment_terms: row.payment_terms == null ? null : String(row.payment_terms),
    is_active: Boolean(row.is_active),
  }))
}

export async function loadPurchaseOrders(
  client: SupabaseClient,
  storeId: string,
  window: TimeWindow,
): Promise<PurchaseOrderRow[]> {
  const rows = await eachPage<Record<string, unknown>>(async (from, to) => {
    const result = await client
      .from('purchase_orders')
      .select('id,po_number,supplier_local_id,status,items,total_amount,expected_date,created_at')
      .eq('store_id', storeId)
      .gte('created_at', window.start)
      .lt('created_at', window.end)
      .order('created_at', { ascending: false })
      .range(from, to)
    return { data: (result.data as Record<string, unknown>[] | null) ?? null, error: result.error }
  })
  return rows.map((row) => ({
    id: String(row.id),
    po_number: String(row.po_number ?? ''),
    supplier_local_id: String(row.supplier_local_id ?? ''),
    status: String(row.status ?? ''),
    lines: buyLines(row.items, 'orderedQty'),
    total_amount: asNumber(row.total_amount),
    expected_date: row.expected_date == null ? null : String(row.expected_date),
    created_at: String(row.created_at),
  }))
}

export async function loadGrns(client: SupabaseClient, storeId: string, window: TimeWindow): Promise<GrnRow[]> {
  const rows = await eachPage<Record<string, unknown>>(async (from, to) => {
    const result = await client
      .from('grn_records')
      .select('id,grn_number,supplier_local_id,items,total_cost,notes,received_at')
      .eq('store_id', storeId)
      .gte('received_at', window.start)
      .lt('received_at', window.end)
      .order('received_at', { ascending: false })
      .range(from, to)
    return { data: (result.data as Record<string, unknown>[] | null) ?? null, error: result.error }
  })
  return rows.map((row) => ({
    id: String(row.id),
    grn_number: String(row.grn_number ?? ''),
    supplier_local_id: String(row.supplier_local_id ?? ''),
    lines: buyLines(row.items, 'receivedQty'),
    total_cost: asNumber(row.total_cost),
    notes: row.notes == null ? null : String(row.notes),
    received_at: String(row.received_at),
  }))
}

export async function loadPurchaseReturns(
  client: SupabaseClient,
  storeId: string,
  window: TimeWindow,
): Promise<PurchaseReturnRow[]> {
  const rows = await eachPage<Record<string, unknown>>(async (from, to) => {
    const result = await client
      .from('purchase_returns')
      .select('id,return_number,supplier_local_id,items,total_amount,reason,created_at')
      .eq('store_id', storeId)
      .gte('created_at', window.start)
      .lt('created_at', window.end)
      .order('created_at', { ascending: false })
      .range(from, to)
    return { data: (result.data as Record<string, unknown>[] | null) ?? null, error: result.error }
  })
  return rows.map((row) => ({
    id: String(row.id),
    return_number: String(row.return_number ?? ''),
    supplier_local_id: String(row.supplier_local_id ?? ''),
    lines: buyLines(row.items, 'returnQty'),
    total_amount: asNumber(row.total_amount),
    reason: row.reason == null ? null : String(row.reason),
    created_at: String(row.created_at),
  }))
}

export async function loadBatches(client: SupabaseClient, storeId: string): Promise<BatchRow[]> {
  const rows = await eachPage<Record<string, unknown>>(async (from, to) => {
    const result = await client
      .from('product_batches')
      .select('id,product_local_id,batch_number,qty,cost_price,expiry_date,status,received_at')
      .eq('store_id', storeId)
      .gt('qty', 0)
      .not('expiry_date', 'is', null)
      .order('expiry_date', { ascending: true })
      .range(from, to)
    return { data: (result.data as Record<string, unknown>[] | null) ?? null, error: result.error }
  })
  return rows.map((row) => ({
    id: String(row.id),
    product_local_id: String(row.product_local_id ?? ''),
    batch_number: String(row.batch_number ?? ''),
    qty: asNumber(row.qty),
    cost_price: asNumber(row.cost_price),
    expiry_date: row.expiry_date == null ? null : String(row.expiry_date),
    status: String(row.status ?? ''),
    received_at: String(row.received_at),
  }))
}

export async function loadStockTakes(client: SupabaseClient, storeId: string): Promise<StockTakeRow[]> {
  const rows = await eachPage<Record<string, unknown>>(async (from, to) => {
    const result = await client
      .from('stock_takes')
      .select('id,stock_take_number,status,notes,created_at,completed_at')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false })
      .range(from, to)
    return { data: (result.data as Record<string, unknown>[] | null) ?? null, error: result.error }
  })
  return rows.map((row) => ({
    id: String(row.id),
    stock_take_number: String(row.stock_take_number ?? ''),
    status: String(row.status ?? ''),
    notes: row.notes == null ? null : String(row.notes),
    created_at: String(row.created_at),
    completed_at: row.completed_at == null ? null : String(row.completed_at),
  }))
}

export async function loadStockTakeItems(
  client: SupabaseClient,
  storeId: string,
  stockTakeId: string,
): Promise<StockTakeItemRow[]> {
  const rows = await eachPage<Record<string, unknown>>(async (from, to) => {
    const result = await client
      .from('stock_take_items')
      .select('id,stock_take_id,product_local_id,system_qty,counted_qty')
      .eq('store_id', storeId)
      .eq('stock_take_id', stockTakeId)
      .range(from, to)
    return { data: (result.data as Record<string, unknown>[] | null) ?? null, error: result.error }
  })
  return rows.map((row) => ({
    id: String(row.id),
    stock_take_id: String(row.stock_take_id ?? ''),
    product_local_id: String(row.product_local_id ?? ''),
    system_qty: asNumber(row.system_qty),
    counted_qty: asNumber(row.counted_qty),
  }))
}

export async function loadPromotions(client: SupabaseClient, storeId: string): Promise<PromotionRow[]> {
  const rows = await eachPage<Record<string, unknown>>(async (from, to) => {
    const result = await client
      .from('promotions')
      .select('id,name,type,start_date,end_date,start_time,end_time,is_active,promo_code,usage_count,min_order_amount,reward,conditions')
      .eq('store_id', storeId)
      .order('start_date', { ascending: false })
      .range(from, to)
    return { data: (result.data as Record<string, unknown>[] | null) ?? null, error: result.error }
  })
  return rows.map((row) => ({
    id: String(row.id),
    name: String(row.name ?? ''),
    type: String(row.type ?? ''),
    start_date: String(row.start_date),
    end_date: String(row.end_date),
    start_time: row.start_time == null ? null : asNumber(row.start_time),
    end_time: row.end_time == null ? null : asNumber(row.end_time),
    is_active: Boolean(row.is_active),
    promo_code: row.promo_code == null || String(row.promo_code) === '' ? null : String(row.promo_code),
    usage_count: asNumber(row.usage_count),
    min_order_amount: row.min_order_amount == null ? null : asNumber(row.min_order_amount),
    reward: asRecord(row.reward),
    conditions: asRecord(row.conditions),
  }))
}

export async function loadCashOps(client: SupabaseClient, storeId: string, window: TimeWindow): Promise<CashOpRow[]> {
  const rows = await eachPage<Record<string, unknown>>(async (from, to) => {
    const result = await client
      .from('cash_operations')
      .select('id,shift_id,type,amount,reason,created_at')
      .eq('store_id', storeId)
      .gte('created_at', window.start)
      .lt('created_at', window.end)
      .order('created_at', { ascending: false })
      .range(from, to)
    return { data: (result.data as Record<string, unknown>[] | null) ?? null, error: result.error }
  })
  return rows.map((row) => ({
    id: String(row.id),
    shift_id: String(row.shift_id ?? ''),
    type: String(row.type ?? ''),
    amount: row.amount == null ? null : asNumber(row.amount),
    reason: row.reason == null ? null : String(row.reason),
    created_at: String(row.created_at),
  }))
}

export async function loadShiftDirectory(
  client: SupabaseClient,
  storeId: string,
): Promise<Map<string, { cashier_name: string; opened_at: string }>> {
  const rows = await eachPage<Record<string, unknown>>(async (from, to) => {
    const result = await client
      .from('shifts')
      .select('id,cashier_name,opened_at')
      .eq('store_id', storeId)
      .order('opened_at', { ascending: false })
      .range(from, to)
    return { data: (result.data as Record<string, unknown>[] | null) ?? null, error: result.error }
  })
  return new Map(
    rows.map((row) => [
      String(row.id),
      { cashier_name: String(row.cashier_name ?? 'cashier'), opened_at: String(row.opened_at ?? '') },
    ]),
  )
}

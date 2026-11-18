import type { SupabaseClient } from '@supabase/supabase-js'
import { asNumber } from './format'
import { round2, round3, type GroceryStore } from './grocery'

export type DeskProduct = {
  id: string
  localId: string
  name: string
  barcode: string
  categoryLocalId: string
  price: number
  costPrice: number
  stockQty: number
  reorderPoint: number
  reorderQty: number
  unit: string
  active: boolean
}

export type DeskCustomer = {
  id: string
  localId: string
  name: string
  phone: string
  email: string
  totalSpent: number
  creditBalance: number
  creditLimit: number
}

export type DeskSupplier = {
  localId: string
  name: string
  contact: string
  phone: string
  email: string
}

export type BuyItem = {
  productLocalId: string
  name: string
  qty: number
  cost: number
}

export type DeskPurchase = {
  id: string
  number: string
  supplierLocalId: string
  status: string
  items: BuyItem[]
  total: number
  createdAt: string
}

export type DeskGrn = {
  id: string
  number: string
  supplierLocalId: string
  poId: string
  items: BuyItem[]
  total: number
  receivedAt: string
}

export type DeskOrder = {
  id: string
  number: string
  total: number
  tax: number
  discount: number
  method: string
  status: string
  refunded: number
  completedAt: string
}

export type DeskOrderItem = {
  productId: string
  productLocalId: string
  name: string
  qty: number
  price: number
  subtotal: number
}

export type DeskPromotion = {
  id: string
  name: string
  type: string
  value: number
  code: string
  active: boolean
  start: string
  end: string
}

export type DeskShift = {
  id: string
  opening: number
  expected: number | null
  actual: number | null
  variance: number | null
  status: string
  openedAt: string
}

function itemsOf(value: unknown): BuyItem[] {
  if (!Array.isArray(value)) return []
  return value.map((row) => {
    const item = row as Record<string, unknown>
    return {
      productLocalId: String(item.productLocalId ?? ''),
      name: String(item.name ?? ''),
      qty: asNumber(item.qty),
      cost: asNumber(item.cost),
    }
  })
}

export async function loadDeskProducts(client: SupabaseClient, storeId: string): Promise<DeskProduct[]> {
  const { data, error } = await client
    .from('products')
    .select('id, local_id, name, barcode, category_local_id, price, cost_price, stock_qty, reorder_point, reorder_qty, unit, is_active')
    .eq('store_id', storeId)
    .order('name')
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => ({
    id: String(row.id),
    localId: String(row.local_id),
    name: String(row.name),
    barcode: String(row.barcode ?? ''),
    categoryLocalId: String(row.category_local_id ?? ''),
    price: asNumber(row.price),
    costPrice: asNumber(row.cost_price),
    stockQty: asNumber(row.stock_qty),
    reorderPoint: asNumber(row.reorder_point),
    reorderQty: asNumber(row.reorder_qty),
    unit: String(row.unit || 'piece'),
    active: Boolean(row.is_active),
  }))
}

export async function saveDeskProduct(
  client: SupabaseClient,
  storeId: string,
  input: {
    id?: string
    localId?: string
    name: string
    barcode: string
    categoryLocalId: string
    price: number
    costPrice: number
    stockQty: number
    reorderPoint: number
    unit: string
  },
): Promise<void> {
  const now = new Date().toISOString()
  const row = {
    name: input.name.trim(),
    barcode: input.barcode.trim() || null,
    category_local_id: input.categoryLocalId || null,
    price: round2(input.price),
    cost_price: round2(input.costPrice),
    stock_qty: round3(input.stockQty),
    reorder_point: round3(input.reorderPoint),
    unit: input.unit.trim() || 'piece',
    is_active: true,
    updated_at: now,
  }
  if (input.id) {
    const { error } = await client.from('products').update(row).eq('id', input.id).eq('store_id', storeId)
    if (error) throw new Error(error.message)
    return
  }
  const { error } = await client.from('products').insert({
    ...row,
    id: crypto.randomUUID(),
    store_id: storeId,
    local_id: crypto.randomUUID(),
  })
  if (error) throw new Error(error.message)
}

export async function setProductActive(client: SupabaseClient, storeId: string, id: string, active: boolean): Promise<void> {
  const { error } = await client
    .from('products')
    .update({ is_active: active, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('store_id', storeId)
  if (error) throw new Error(error.message)
}

export async function saveDeskCategory(client: SupabaseClient, storeId: string, name: string): Promise<void> {
  const label = name.trim()
  if (!label) throw new Error('Enter a category name')
  const { error } = await client.from('categories').insert({
    id: crypto.randomUUID(),
    store_id: storeId,
    local_id: crypto.randomUUID(),
    name: label,
    color: '#2E7D32',
    icon: 'category',
    updated_at: new Date().toISOString(),
  })
  if (error) throw new Error(error.message)
}

export async function adjustDeskStock(
  client: SupabaseClient,
  storeId: string,
  product: DeskProduct,
  nextQty: number,
  note: string,
): Promise<void> {
  const next = round3(nextQty)
  const { error } = await client
    .from('products')
    .update({ stock_qty: next, updated_at: new Date().toISOString() })
    .eq('id', product.id)
    .eq('store_id', storeId)
  if (error) throw new Error(error.message)
  const { error: moveError } = await client.from('stock_movements').insert({
    id: crypto.randomUUID(),
    store_id: storeId,
    local_id: crypto.randomUUID(),
    product_local_id: product.localId,
    type: 'adjustment',
    quantity: round3(next - product.stockQty),
    note: note.trim() || 'Stock count',
  })
  if (moveError) throw new Error(moveError.message)
}

export async function loadDeskCustomers(client: SupabaseClient, storeId: string): Promise<DeskCustomer[]> {
  const { data, error } = await client
    .from('customers')
    .select('id, local_id, name, phone, email, total_spent, credit_balance, credit_limit')
    .eq('store_id', storeId)
    .eq('is_active', true)
    .order('name')
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => ({
    id: String(row.id),
    localId: String(row.local_id),
    name: String(row.name),
    phone: String(row.phone ?? ''),
    email: String(row.email ?? ''),
    totalSpent: asNumber(row.total_spent),
    creditBalance: asNumber(row.credit_balance),
    creditLimit: asNumber(row.credit_limit),
  }))
}

export async function saveDeskCustomer(
  client: SupabaseClient,
  storeId: string,
  input: { name: string; phone: string; email: string; creditLimit: number },
): Promise<void> {
  const { error } = await client.from('customers').insert({
    id: crypto.randomUUID(),
    store_id: storeId,
    local_id: crypto.randomUUID(),
    name: input.name.trim(),
    phone: input.phone.trim() || null,
    email: input.email.trim() || null,
    credit_limit: round2(input.creditLimit),
    credit_balance: 0,
    total_spent: 0,
    is_active: true,
  })
  if (error) throw new Error(error.message)
}

export async function collectDeskCredit(
  client: SupabaseClient,
  storeId: string,
  customer: DeskCustomer,
  amount: number,
  method: string,
): Promise<void> {
  const paid = round2(amount)
  if (paid <= 0) throw new Error('Enter the amount collected')
  if (paid > customer.creditBalance + 0.009) throw new Error('Amount is more than the credit balance')
  const { error } = await client.from('credit_payments').insert({
    id: crypto.randomUUID(),
    store_id: storeId,
    local_id: crypto.randomUUID(),
    customer_local_id: customer.localId,
    amount: paid,
    payment_method: method,
    note: 'Collected on the till',
  })
  if (error) throw new Error(error.message)
  const { error: updateError } = await client
    .from('customers')
    .update({ credit_balance: round2(customer.creditBalance - paid), updated_at: new Date().toISOString() })
    .eq('id', customer.id)
    .eq('store_id', storeId)
  if (updateError) throw new Error(updateError.message)
}

export async function loadDeskSuppliers(client: SupabaseClient, storeId: string): Promise<DeskSupplier[]> {
  const { data, error } = await client
    .from('suppliers')
    .select('local_id, name, contact_person, phone, email')
    .eq('store_id', storeId)
    .eq('is_active', true)
    .order('name')
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => ({
    localId: String(row.local_id),
    name: String(row.name),
    contact: String(row.contact_person ?? ''),
    phone: String(row.phone ?? ''),
    email: String(row.email ?? ''),
  }))
}

export async function saveDeskSupplier(
  client: SupabaseClient,
  storeId: string,
  input: { name: string; contact: string; phone: string },
): Promise<void> {
  const { error } = await client.from('suppliers').insert({
    id: crypto.randomUUID(),
    store_id: storeId,
    local_id: crypto.randomUUID(),
    name: input.name.trim(),
    contact_person: input.contact.trim() || null,
    phone: input.phone.trim() || null,
    is_active: true,
  })
  if (error) throw new Error(error.message)
}

export async function loadDeskPurchases(client: SupabaseClient, storeId: string): Promise<DeskPurchase[]> {
  const { data, error } = await client
    .from('purchase_orders')
    .select('id, po_number, supplier_local_id, status, items, total_amount, created_at')
    .eq('store_id', storeId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => ({
    id: String(row.id),
    number: String(row.po_number),
    supplierLocalId: String(row.supplier_local_id),
    status: String(row.status),
    items: itemsOf(row.items),
    total: asNumber(row.total_amount),
    createdAt: String(row.created_at),
  }))
}

export async function saveDeskPurchase(
  client: SupabaseClient,
  storeId: string,
  supplierLocalId: string,
  items: BuyItem[],
): Promise<void> {
  if (!supplierLocalId) throw new Error('Choose a supplier')
  if (items.length === 0) throw new Error('Add at least one product')
  const total = round2(items.reduce((sum, item) => sum + item.qty * item.cost, 0))
  const { error } = await client.from('purchase_orders').insert({
    id: crypto.randomUUID(),
    store_id: storeId,
    po_number: `PO-${Date.now()}`,
    supplier_local_id: supplierLocalId,
    status: 'draft',
    items,
    total_amount: total,
  })
  if (error) throw new Error(error.message)
}

export async function loadDeskGrns(client: SupabaseClient, storeId: string): Promise<DeskGrn[]> {
  const { data, error } = await client
    .from('grn_records')
    .select('id, grn_number, supplier_local_id, po_id, items, total_cost, received_at')
    .eq('store_id', storeId)
    .order('received_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => ({
    id: String(row.id),
    number: String(row.grn_number),
    supplierLocalId: String(row.supplier_local_id),
    poId: String(row.po_id ?? ''),
    items: itemsOf(row.items),
    total: asNumber(row.total_cost),
    receivedAt: String(row.received_at),
  }))
}

export async function receiveDeskGrn(client: SupabaseClient, storeId: string, order: DeskPurchase): Promise<void> {
  if (order.items.length === 0) throw new Error('This purchase order has no lines')
  const { error } = await client.from('grn_records').insert({
    id: crypto.randomUUID(),
    store_id: storeId,
    grn_number: `GRN-${Date.now()}`,
    supplier_local_id: order.supplierLocalId,
    po_id: order.id,
    items: order.items,
    total_cost: order.total,
    notes: order.number,
  })
  if (error) throw new Error(error.message)
  for (const item of order.items) {
    const { data, error: findError } = await client
      .from('products')
      .select('id, stock_qty')
      .eq('store_id', storeId)
      .eq('local_id', item.productLocalId)
      .maybeSingle()
    if (findError) throw new Error(findError.message)
    if (!data) continue
    const next = round3(asNumber(data.stock_qty) + item.qty)
    const { error: stockError } = await client
      .from('products')
      .update({ stock_qty: next, cost_price: round2(item.cost), updated_at: new Date().toISOString() })
      .eq('id', data.id)
    if (stockError) throw new Error(stockError.message)
    await client.from('stock_movements').insert({
      id: crypto.randomUUID(),
      store_id: storeId,
      local_id: crypto.randomUUID(),
      product_local_id: item.productLocalId,
      type: 'grn',
      quantity: item.qty,
      note: order.number,
    })
  }
  const { error: statusError } = await client.from('purchase_orders').update({ status: 'received' }).eq('id', order.id)
  if (statusError) throw new Error(statusError.message)
}

export async function returnDeskGrn(client: SupabaseClient, storeId: string, grn: DeskGrn, reason: string): Promise<void> {
  const { error } = await client.from('purchase_returns').insert({
    id: crypto.randomUUID(),
    store_id: storeId,
    return_number: `PR-${Date.now()}`,
    grn_id: grn.id,
    supplier_local_id: grn.supplierLocalId,
    items: grn.items,
    total_amount: grn.total,
    reason: reason.trim() || 'Returned to supplier',
  })
  if (error) throw new Error(error.message)
  for (const item of grn.items) {
    const { data } = await client
      .from('products')
      .select('id, stock_qty')
      .eq('store_id', storeId)
      .eq('local_id', item.productLocalId)
      .maybeSingle()
    if (!data) continue
    const next = round3(Math.max(0, asNumber(data.stock_qty) - item.qty))
    await client.from('products').update({ stock_qty: next, updated_at: new Date().toISOString() }).eq('id', data.id)
    await client.from('stock_movements').insert({
      id: crypto.randomUUID(),
      store_id: storeId,
      local_id: crypto.randomUUID(),
      product_local_id: item.productLocalId,
      type: 'purchase_return',
      quantity: -item.qty,
      note: grn.number,
    })
  }
}

export async function loadDeskOrders(client: SupabaseClient, storeId: string): Promise<DeskOrder[]> {
  const { data, error } = await client
    .from('orders')
    .select('id, local_id, total, tax_amount, discount_amount, payment_method, status, refunded_amount, completed_at')
    .eq('store_id', storeId)
    .order('completed_at', { ascending: false })
    .limit(80)
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => ({
    id: String(row.id),
    number: String(row.local_id),
    total: asNumber(row.total),
    tax: asNumber(row.tax_amount),
    discount: asNumber(row.discount_amount),
    method: String(row.payment_method ?? ''),
    status: String(row.status),
    refunded: asNumber(row.refunded_amount),
    completedAt: String(row.completed_at),
  }))
}

export async function loadDeskOrderItems(client: SupabaseClient, orderId: string): Promise<DeskOrderItem[]> {
  const { data, error } = await client
    .from('order_items')
    .select('product_id, product_name, quantity, unit_price, subtotal')
    .eq('order_id', orderId)
  if (error) throw new Error(error.message)
  const items = data ?? []
  const productIds = items.map((row) => String(row.product_id ?? '')).filter(Boolean)
  const locals = new Map<string, string>()
  if (productIds.length > 0) {
    const { data: products } = await client.from('products').select('id, local_id').in('id', productIds)
    for (const product of products ?? []) locals.set(String(product.id), String(product.local_id))
  }
  return items.map((row) => ({
    productId: String(row.product_id ?? ''),
    productLocalId: locals.get(String(row.product_id ?? '')) ?? '',
    name: String(row.product_name),
    qty: asNumber(row.quantity),
    price: asNumber(row.unit_price),
    subtotal: asNumber(row.subtotal),
  }))
}

export async function refundDeskOrder(client: SupabaseClient, storeId: string, order: DeskOrder): Promise<void> {
  if (order.refunded > 0) throw new Error('This bill is already refunded')
  const items = await loadDeskOrderItems(client, order.id)
  const { error } = await client.from('refunds').insert({
    id: crypto.randomUUID(),
    store_id: storeId,
    order_local_id: order.number,
    refund_number: `RF-${Date.now()}`,
    items: items.map((item) => ({ name: item.name, qty: item.qty, subtotal: item.subtotal })),
    total_amount: order.total,
    reason: 'Refunded from the till',
    payment_method: order.method || 'cash',
  })
  if (error) throw new Error(error.message)
  const { error: orderError } = await client
    .from('orders')
    .update({ refunded_amount: order.total, status: 'refunded' })
    .eq('id', order.id)
  if (orderError) throw new Error(orderError.message)
  for (const item of items) {
    if (!item.productId) continue
    const { data } = await client.from('products').select('stock_qty, local_id').eq('id', item.productId).maybeSingle()
    if (!data) continue
    const next = round3(asNumber(data.stock_qty) + item.qty)
    await client.from('products').update({ stock_qty: next, updated_at: new Date().toISOString() }).eq('id', item.productId)
    await client.from('stock_movements').insert({
      id: crypto.randomUUID(),
      store_id: storeId,
      local_id: crypto.randomUUID(),
      product_local_id: String(data.local_id ?? item.productLocalId),
      type: 'refund',
      quantity: item.qty,
      note: order.number,
    })
    await client.from('void_logs').insert({
      id: crypto.randomUUID(),
      store_id: storeId,
      local_id: crypto.randomUUID(),
      order_local_id: order.number,
      product_local_id: String(data.local_id ?? item.productLocalId),
      product_name: item.name,
      quantity: item.qty,
      unit_price: item.price,
      reason: 'Refunded from the till',
      type: 'refund',
      cashier_name: 'Owner',
    })
  }
}

export async function loadDeskPromotions(client: SupabaseClient, storeId: string): Promise<DeskPromotion[]> {
  const { data, error } = await client
    .from('promotions')
    .select('id, name, type, reward, promo_code, is_active, start_date, end_date')
    .eq('store_id', storeId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => {
    const reward = (row.reward ?? {}) as { value?: unknown }
    return {
      id: String(row.id),
      name: String(row.name),
      type: String(row.type),
      value: asNumber(reward.value),
      code: String(row.promo_code ?? ''),
      active: Boolean(row.is_active),
      start: String(row.start_date),
      end: String(row.end_date),
    }
  })
}

export async function saveDeskPromotion(
  client: SupabaseClient,
  storeId: string,
  input: { name: string; type: string; value: number; code: string },
): Promise<void> {
  const start = new Date()
  const end = new Date(start)
  end.setDate(end.getDate() + 30)
  const { error } = await client.from('promotions').insert({
    id: crypto.randomUUID(),
    store_id: storeId,
    name: input.name.trim(),
    type: input.type,
    conditions: {},
    reward: { value: round2(input.value) },
    start_date: start.toISOString(),
    end_date: end.toISOString(),
    is_active: true,
    promo_code: input.code.trim() || null,
    product_ids: [],
    category_ids: [],
  })
  if (error) throw new Error(error.message)
}

export async function loadOpenShift(client: SupabaseClient, storeId: string): Promise<DeskShift | null> {
  const { data, error } = await client
    .from('shifts')
    .select('id, opening_cash, expected_cash, actual_cash, variance, status, opened_at')
    .eq('store_id', storeId)
    .eq('status', 'open')
    .order('opened_at', { ascending: false })
    .limit(1)
  if (error) throw new Error(error.message)
  const row = data?.[0]
  if (!row) return null
  return {
    id: String(row.id),
    opening: asNumber(row.opening_cash),
    expected: row.expected_cash == null ? null : asNumber(row.expected_cash),
    actual: row.actual_cash == null ? null : asNumber(row.actual_cash),
    variance: row.variance == null ? null : asNumber(row.variance),
    status: String(row.status),
    openedAt: String(row.opened_at),
  }
}

export async function recordCashMove(
  client: SupabaseClient,
  storeId: string,
  shiftId: string,
  type: 'paid_in' | 'paid_out',
  amount: number,
  reason: string,
): Promise<void> {
  const { error } = await client.from('cash_operations').insert({
    id: crypto.randomUUID(),
    store_id: storeId,
    shift_id: shiftId,
    type,
    amount: round2(amount),
    reason: reason.trim() || type,
  })
  if (error) throw new Error(error.message)
}

export async function openDeskShift(client: SupabaseClient, storeId: string, opening: number): Promise<void> {
  const existing = await loadOpenShift(client, storeId)
  if (existing) throw new Error('A shift is already open')
  const { error } = await client.from('shifts').insert({
    id: crypto.randomUUID(),
    store_id: storeId,
    cashier_name: 'Owner',
    opening_cash: round2(opening),
    status: 'open',
  })
  if (error) throw new Error(error.message)
}

export async function closeDeskShift(client: SupabaseClient, storeId: string, shift: DeskShift, actual: number): Promise<void> {
  const { data, error } = await client
    .from('orders')
    .select('total, payment_method')
    .eq('store_id', storeId)
    .eq('status', 'completed')
    .gte('completed_at', shift.openedAt)
  if (error) throw new Error(error.message)
  const cashSales = (data ?? [])
    .filter((row) => String(row.payment_method ?? 'cash') === 'cash')
    .reduce((sum, row) => sum + asNumber(row.total), 0)
  const expected = round2(shift.opening + cashSales)
  const counted = round2(actual)
  const { error: closeError } = await client
    .from('shifts')
    .update({
      status: 'closed',
      expected_cash: expected,
      actual_cash: counted,
      variance: round2(counted - expected),
      closed_at: new Date().toISOString(),
    })
    .eq('id', shift.id)
  if (closeError) throw new Error(closeError.message)
  await client.from('cash_operations').insert({
    id: crypto.randomUUID(),
    store_id: storeId,
    shift_id: shift.id,
    type: 'close',
    amount: counted,
    reason: 'Shift closed',
  })
}

export async function saveStoreProfile(
  client: SupabaseClient,
  store: GroceryStore,
  input: { name: string; address: string; phone: string; currency: string; taxPercent: number },
): Promise<void> {
  const { error } = await client
    .from('stores')
    .update({
      name: input.name.trim() || store.name,
      address: input.address.trim() || null,
      phone: input.phone.trim() || null,
      currency_symbol: input.currency.trim() || store.currencySymbol,
      tax_rate: round2(input.taxPercent) / 100,
      updated_at: new Date().toISOString(),
    })
    .eq('id', store.id)
  if (error) throw new Error(error.message)
}

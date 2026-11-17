import type { SupabaseClient } from '@supabase/supabase-js'
import { v5 as uuidv5 } from 'uuid'
import { asNumber } from './format'

export const SHOP_CATEGORIES = [
  { id: 'grocery', label: 'Grocery' },
  { id: 'textile', label: 'Textile' },
  { id: 'pharmacy', label: 'Pharmacy' },
  { id: 'restaurant', label: 'Restaurant' },
  { id: 'bakery', label: 'Bakery' },
  { id: 'retail', label: 'Retail' },
] as const

export type ShopCategory = (typeof SHOP_CATEGORIES)[number]['id']

export type GroceryStore = {
  id: string
  name: string
  category: string
  currencySymbol: string
  taxRate: number
}

export function shopCategory(value: string): ShopCategory {
  const id = value.trim().toLowerCase()
  const match = SHOP_CATEGORIES.find((item) => item.id === id)
  return match ? match.id : 'grocery'
}

export type GroceryCategory = {
  localId: string
  name: string
}

export type GroceryProduct = {
  id: string
  name: string
  barcode: string
  categoryLocalId: string
  price: number
  costPrice: number
  stockQty: number
  reorderPoint: number
  unit: string
}

export type CartLine = {
  product: GroceryProduct
  qty: number
}

export type PayMethod = 'cash' | 'card' | 'upi'

export type CompletedSale = {
  orderNumber: string
  total: number
  change: number
  stockWarning: string
}

const BILL_PATTERN = /^MG-(\d+)(?:-[A-Z0-9]+)?$/

export function money(amount: number, symbol: string): string {
  const value = Number.isFinite(amount) ? amount : 0
  const formatted = value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  const gap = symbol.length > 1 ? ' ' : ''
  return `${symbol}${gap}${formatted}`
}

export function qtyLabel(amount: number): string {
  const value = Number.isFinite(amount) ? amount : 0
  return value.toLocaleString(undefined, { maximumFractionDigits: 3 })
}

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function round3(value: number): number {
  return Math.round((value + Number.EPSILON) * 1000) / 1000
}

export function lineSubtotal(price: number, qty: number): number {
  return round2(price * qty)
}

export function saleTotals(lines: CartLine[], taxRate: number, discount: number) {
  const subtotal = round2(lines.reduce((sum, line) => sum + lineSubtotal(line.product.price, line.qty), 0))
  const discountAmount = round2(Math.min(Math.max(0, discount), subtotal))
  const taxable = round2(subtotal - discountAmount)
  const tax = round2(taxable * taxRate)
  const total = round2(taxable + tax)
  return { subtotal, discountAmount, tax, total }
}

export function qtyStep(unit: string): number {
  const normalized = unit.trim().toLowerCase()
  if (['kg', 'g', 'l', 'liter', 'litre', 'lb', 'oz', 'ml'].includes(normalized)) return 0.1
  return 1
}

export function isWeighed(unit: string): boolean {
  return qtyStep(unit) < 1
}

const STARTERS: Record<ShopCategory, { color: string; groups: { category: string; items: [string, string, string][] }[] }> = {
  grocery: {
    color: '#2E7D32',
    groups: [
      { category: 'Produce', items: [['Tomatoes', '240', 'kg'], ['Bananas', '180', 'kg'], ['Onions', '160', 'kg']] },
      { category: 'Grocery', items: [['Rice 5kg', '1250', 'piece'], ['Sugar 1kg', '280', 'piece'], ['Dhal 1kg', '420', 'piece']] },
      { category: 'Dairy', items: [['Fresh milk 1L', '490', 'piece'], ['Eggs 10', '380', 'piece']] },
    ],
  },
  textile: {
    color: '#3949AB',
    groups: [
      { category: 'Fabric', items: [['Cotton', '850', 'm'], ['Linen', '1200', 'm']] },
      { category: 'Clothing', items: [['Shirt', '2500', 'piece'], ['Sarong', '1800', 'piece']] },
    ],
  },
  pharmacy: {
    color: '#0D6E6E',
    groups: [
      { category: 'Medicine', items: [['Paracetamol', '40', 'strip'], ['Vitamin C', '180', 'bottle']] },
      { category: 'Care', items: [['Hand sanitizer', '320', 'bottle'], ['Face mask', '150', 'box']] },
    ],
  },
  restaurant: {
    color: '#9E2A2B',
    groups: [
      { category: 'Meals', items: [['Rice and curry', '850', 'plate'], ['Noodles', '750', 'plate']] },
      { category: 'Drinks', items: [['Tea', '150', 'glass'], ['Soft drink', '250', 'bottle']] },
    ],
  },
  bakery: {
    color: '#9E2A2B',
    groups: [
      { category: 'Bread', items: [['White loaf', '220', 'loaf'], ['Burger bun', '80', 'piece']] },
      { category: 'Cakes', items: [['Butter cake', '450', 'slice'], ['Fish bun', '120', 'piece']] },
    ],
  },
  retail: {
    color: '#1A56A8',
    groups: [
      { category: 'Home', items: [['Notebook', '180', 'piece'], ['Pen', '50', 'piece']] },
      { category: 'Personal', items: [['Soap', '160', 'piece'], ['Shampoo', '480', 'bottle']] },
    ],
  },
}

let shopInFlight: Promise<string> | null = null

export function createGroceryShop(client: SupabaseClient, name: string, category: ShopCategory = 'grocery'): Promise<string> {
  if (shopInFlight) return shopInFlight
  shopInFlight = insertGroceryShop(client, name, category).finally(() => {
    shopInFlight = null
  })
  return shopInFlight
}

async function insertGroceryShop(client: SupabaseClient, name: string, category: ShopCategory): Promise<string> {
  const existing = await loadGroceryStores(client)
  if (existing.length > 0) return existing[0].id

  const { data: userData, error: userError } = await client.auth.getUser()
  if (userError) throw new Error(userError.message)
  const ownerId = userData.user?.id
  if (!ownerId) throw new Error('Sign in before creating the shop')

  const { data: store, error: storeError } = await client
    .from('stores')
    .insert({
      owner_id: ownerId,
      category,
      name: name.trim() || 'POS',
      currency_symbol: 'Rs',
      tax_rate: 0,
      timezone: 'Asia/Colombo',
    })
    .select('id')
    .single()
  if (storeError) throw new Error(storeError.message)
  const storeId = String(store.id)

  const starter = STARTERS[category]
  const categories = starter.groups.map((group) => ({
    id: crypto.randomUUID(),
    store_id: storeId,
    local_id: slug(group.category),
    name: group.category,
    color: starter.color,
    icon: 'category',
  }))
  const { error: categoryError } = await client.from('categories').insert(categories)
  if (categoryError) throw new Error(categoryError.message)

  const products = starter.groups.flatMap((group) =>
    group.items.map(([itemName, price, unit]) => ({
      id: crypto.randomUUID(),
      store_id: storeId,
      local_id: slug(itemName),
      name: itemName,
      barcode: '',
      category_local_id: slug(group.category),
      price: Number(price),
      cost_price: 0,
      stock_qty: 20,
      unit,
      is_active: true,
      reorder_point: 5,
    })),
  )
  const { error: productError } = await client.from('products').insert(products)
  if (productError) throw new Error(productError.message)
  return storeId
}

function slug(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export async function loadGroceryStores(client: SupabaseClient): Promise<GroceryStore[]> {
  const { data, error } = await client
    .from('stores')
    .select('id, name, category, currency_symbol, tax_rate')
    .order('name')
  if (error) throw new Error(error.message)
  const rows = (data ?? []).map((row) => ({
    id: String(row.id),
    name: String(row.name || 'Store'),
    category: String(row.category || ''),
    currencySymbol: String(row.currency_symbol || 'Rs'),
    taxRate: asNumber(row.tax_rate),
  }))
  return rows.filter((row) => row.category.toLowerCase() !== 'archived')
}

export async function setStoreCategory(client: SupabaseClient, storeId: string, category: ShopCategory): Promise<void> {
  const { error } = await client
    .from('stores')
    .update({ category, updated_at: new Date().toISOString() })
    .eq('id', storeId)
  if (error) throw new Error(error.message)
}

export async function loadGroceryCatalog(
  client: SupabaseClient,
  storeId: string,
): Promise<{ categories: GroceryCategory[]; products: GroceryProduct[] }> {
  const [categories, products] = await Promise.all([
    eachPage(async (from, to) => {
      const result = await client
        .from('categories')
        .select('local_id, name')
        .eq('store_id', storeId)
        .order('name')
        .range(from, to)
      return { data: result.data, error: result.error }
    }),
    eachPage(async (from, to) => {
      const result = await client
        .from('products')
        .select('id, name, barcode, category_local_id, price, cost_price, stock_qty, reorder_point, unit, is_active')
        .eq('store_id', storeId)
        .eq('is_active', true)
        .order('name')
        .range(from, to)
      return { data: result.data, error: result.error }
    }),
  ])

  return {
    categories: categories.map((row) => ({
      localId: String(row.local_id ?? ''),
      name: String(row.name || 'Category'),
    })),
    products: products.map((row) => ({
      id: String(row.id),
      name: String(row.name || 'Product'),
      barcode: String(row.barcode ?? ''),
      categoryLocalId: String(row.category_local_id ?? ''),
      price: asNumber(row.price),
      costPrice: asNumber(row.cost_price),
      stockQty: asNumber(row.stock_qty),
      reorderPoint: asNumber(row.reorder_point),
      unit: String(row.unit || 'piece'),
    })),
  }
}

export async function completeGrocerySale(
  client: SupabaseClient,
  storeId: string,
  lines: CartLine[],
  taxRate: number,
  discount: number,
  method: PayMethod,
  tendered: number | null,
): Promise<CompletedSale> {
  if (lines.length === 0) throw new Error('Add a product before taking payment')
  const totals = saleTotals(lines, taxRate, discount)
  if (method === 'cash') {
    const paid = tendered ?? 0
    if (paid + 0.009 < totals.total) throw new Error('Cash received is less than the total')
  }

  const orderNumber = await nextBill(client, storeId)
  const orderId = uuidv5(orderNumber, storeId)
  const completedAt = new Date().toISOString()
  const change = method === 'cash' ? round2(Math.max(0, (tendered ?? totals.total) - totals.total)) : 0

  const { error: orderError } = await client.from('orders').insert({
    id: orderId,
    store_id: storeId,
    local_id: orderNumber,
    subtotal: totals.subtotal,
    discount_amount: totals.discountAmount,
    total: totals.total,
    tax_amount: totals.tax,
    payment_method: method,
    cash_amount: method === 'cash' ? round2(tendered ?? totals.total) : null,
    card_amount: method === 'card' ? totals.total : null,
    upi_amount: method === 'upi' ? totals.total : null,
    status: 'completed',
    refunded_amount: 0,
    is_credit_sale: false,
    completed_at: completedAt,
  })
  if (orderError) throw new Error(orderError.message)

  const { error: itemError } = await client.from('order_items').insert(
    lines.map((line, index) => ({
      id: uuidv5(String(index + 1), orderId),
      order_id: orderId,
      product_id: line.product.id,
      product_name: line.product.name,
      quantity: line.qty,
      unit_price: line.product.price,
      discount_amount: 0,
      is_price_overridden: false,
      subtotal: lineSubtotal(line.product.price, line.qty),
    })),
  )
  if (itemError) {
    await client.from('orders').delete().eq('id', orderId)
    throw new Error(itemError.message)
  }

  let stockWarning = ''
  try {
    for (const line of lines) {
      await reduceStock(client, storeId, line.product.id, line.qty)
    }
  } catch (err) {
    stockWarning = err instanceof Error ? err.message : 'Stock was not updated'
  }

  return { orderNumber, total: totals.total, change, stockWarning }
}

async function nextBill(client: SupabaseClient, storeId: string): Promise<string> {
  const { data, error } = await client
    .from('orders')
    .select('local_id')
    .eq('store_id', storeId)
    .like('local_id', 'MG-%')
  if (error) throw new Error(error.message)
  let max = 999
  for (const row of data ?? []) {
    const match = BILL_PATTERN.exec(String(row.local_id || '').trim())
    if (!match) continue
    const n = Number(match[1])
    if (Number.isFinite(n) && n > max) max = n
  }
  const bytes = new Uint8Array(3)
  crypto.getRandomValues(bytes)
  const suffix = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('').toUpperCase()
  return `MG-${max + 1}-${suffix}`
}

async function reduceStock(client: SupabaseClient, storeId: string, productId: string, sold: number) {
  const { data, error } = await client
    .from('products')
    .select('stock_qty')
    .eq('id', productId)
    .eq('store_id', storeId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return
  const next = round3(asNumber(data.stock_qty) - sold)
  const { error: updateError } = await client
    .from('products')
    .update({ stock_qty: next, updated_at: new Date().toISOString() })
    .eq('id', productId)
    .eq('store_id', storeId)
  if (updateError) throw new Error(updateError.message)
}

async function eachPage(
  load: (from: number, to: number) => Promise<{ data: Record<string, unknown>[] | null; error: { message: string } | null }>,
): Promise<Record<string, unknown>[]> {
  const pageSize = 1000
  const rows: Record<string, unknown>[] = []
  for (let from = 0; from < 20000; from += pageSize) {
    const result = await load(from, from + pageSize - 1)
    if (result.error) throw new Error(result.error.message)
    const chunk = result.data ?? []
    rows.push(...chunk)
    if (chunk.length < pageSize) break
  }
  return rows
}

import { useEffect, useMemo, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import bakeryLogo from './assets/bakery-logo.png'
import groceryLogo from './assets/grocery-logo.png'
import pharmacyLogo from './assets/pharmacy-logo.png'
import restaurantLogo from './assets/restaurant-logo.png'
import retailLogo from './assets/retail-logo.png'
import textileLogo from './assets/textile-logo.png'
import {
  completeGrocerySale,
  createGroceryShop,
  isWeighed,
  lineSubtotal,
  loadGroceryCatalog,
  loadGroceryStores,
  money,
  qtyLabel,
  qtyStep,
  round3,
  saleTotals,
  SHOP_CATEGORIES,
  shopTitle,
  setStoreCategory,
  type CartLine,
  type GroceryCategory,
  type GroceryProduct,
  type GroceryStore,
  type PayMethod,
  type ShopCategory,
} from './grocery'
import { readRememberedStore, writeRememberedStore } from './prefs'
import './grocery.css'

type Sheet = 'cart' | 'pay' | 'done' | 'weigh' | null

const STORE_PICK = 'mentura-grocery-store'

export function GroceryPos({
  client,
  category,
  onSignOut,
  onOpenPortal,
}: {
  client: SupabaseClient
  category: ShopCategory
  onSignOut: () => void
  onOpenPortal: () => void
}) {
  const [stores, setStores] = useState<GroceryStore[] | null>(null)
  const [storeId, setStoreId] = useState('')
  const [categories, setCategories] = useState<GroceryCategory[]>([])
  const [products, setProducts] = useState<GroceryProduct[]>([])
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [cart, setCart] = useState<CartLine[]>([])
  const [discount, setDiscount] = useState('0')
  const [sheet, setSheet] = useState<Sheet>(null)
  const [weighProduct, setWeighProduct] = useState<GroceryProduct | null>(null)
  const [weighQty, setWeighQty] = useState('1')
  const [method, setMethod] = useState<PayMethod>('cash')
  const [tendered, setTendered] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [loadError, setLoadError] = useState('')
  const [receipt, setReceipt] = useState<{ orderNumber: string; total: number; change: number; stockWarning: string } | null>(null)

  useEffect(() => {
    let active = true
    loadGroceryStores(client)
      .then((rows) => {
        if (!active) return
        setStores(rows)
        const saved = localStorage.getItem(STORE_PICK) || readRememberedStore(true)
        const chosen = rows.find((row) => row.id === saved) ?? (rows.length === 1 ? rows[0] : null)
        if (chosen) setStoreId(chosen.id)
      })
      .catch((err: unknown) => {
        if (!active) return
        setStores([])
        setLoadError(err instanceof Error ? err.message : 'Could not load shops')
      })
    return () => {
      active = false
    }
  }, [client])

  useEffect(() => {
    if (!storeId) return
    let active = true
    setLoadError('')
    localStorage.setItem(STORE_PICK, storeId)
    writeRememberedStore(storeId, true)
    loadGroceryCatalog(client, storeId)
      .then((catalog) => {
        if (!active) return
        setCategories(catalog.categories)
        setProducts(catalog.products)
      })
      .catch((err: unknown) => {
        if (active) setLoadError(err instanceof Error ? err.message : 'Could not load products')
      })
    return () => {
      active = false
    }
  }, [client, storeId])

  const store = stores?.find((row) => row.id === storeId) ?? null
  const symbol = store?.currencySymbol || 'Rs'
  const discountValue = Number(discount) || 0
  const totals = useMemo(
    () => saleTotals(cart, store?.taxRate ?? 0, discountValue),
    [cart, store?.taxRate, discountValue],
  )
  const itemCount = cart.reduce((sum, line) => sum + (line.qty > 0 ? 1 : 0), 0)
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return products.filter((product) => {
      if (categoryId && product.categoryLocalId !== categoryId) return false
      if (!needle) return true
      return product.name.toLowerCase().includes(needle) || product.barcode.toLowerCase().includes(needle)
    })
  }, [products, query, categoryId])

  function addLine(product: GroceryProduct, qty: number) {
    if (qty <= 0) return
    setError('')
    setCart((current) => {
      const existing = current.find((line) => line.product.id === product.id)
      if (!existing) return [...current, { product, qty: round3(qty) }]
      return current.map((line) =>
        line.product.id === product.id ? { ...line, qty: round3(line.qty + qty) } : line,
      )
    })
  }

  function addProduct(product: GroceryProduct) {
    if (product.stockQty <= 0) return
    if (isWeighed(product.unit)) {
      setWeighProduct(product)
      setWeighQty('1')
      setSheet('weigh')
      return
    }
    addLine(product, 1)
  }

  function changeQty(productId: string, delta: number) {
    setCart((current) =>
      current.flatMap((line) => {
        if (line.product.id !== productId) return [line]
        const next = round3(line.qty + delta)
        if (next <= 0) return []
        return [{ ...line, qty: next }]
      }),
    )
  }

  function onSearchKey(key: string) {
    if (key !== 'Enter') return
    const code = query.trim().toLowerCase()
    if (!code) return
    const match = products.find((product) => product.barcode.trim().toLowerCase() === code)
    if (!match || match.stockQty <= 0) return
    addProduct(match)
    setQuery('')
  }

  async function pay() {
    if (!store) return
    setBusy(true)
    setError('')
    try {
      const sale = await completeGrocerySale(
        client,
        store.id,
        cart,
        store.taxRate,
        discountValue,
        method,
        method === 'cash' ? Number(tendered) : null,
      )
      setReceipt(sale)
      setCart([])
      setDiscount('0')
      setSheet('done')
      setTendered('')
      const fresh = await loadGroceryCatalog(client, store.id)
      setProducts(fresh.products)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed')
    } finally {
      setBusy(false)
    }
  }

  if (!stores) {
    return (
      <main className="grocery-gate">
        <p className="grocery-status">Opening the till</p>
      </main>
    )
  }

  if (!store) {
    return (
      <main className="grocery-gate">
        <section>
          <h1>{stores.length === 0 ? 'No shop yet' : 'Choose a shop'}</h1>
          <p>{stores.length === 0 ? 'The shop could not be opened. Sign out and choose a category again.' : 'This account has more than one shop.'}</p>
          {loadError ? <p className="g-error">{loadError}</p> : null}
          {stores.map((row) => (
            <button key={row.id} type="button" className="g-pay" onClick={() => setStoreId(row.id)}>
              {row.name}
            </button>
          ))}
          <button type="button" className="grocery-link" onClick={onSignOut}>
            Sign out
          </button>
        </section>
      </main>
    )
  }

  const cashShort = method === 'cash' && (Number(tendered) || 0) + 0.009 < totals.total
  const logoUrl = CATEGORY_LOGOS[category]
  const categoryLabel = SHOP_CATEGORIES.find((item) => item.id === category)?.label ?? 'Grocery'

  return (
    <div className="grocery" data-category={category}>
      <header className="grocery-top">
        <img className="grocery-logo" src={logoUrl} alt={`POS ${categoryLabel}`} />
        <div className="grocery-shop">
          {stores.length > 1 ? (
            <select
              aria-label="Shop"
              value={store.id}
              onChange={(event) => {
                setStoreId(event.target.value)
                setCart([])
                setCategoryId(null)
                setQuery('')
              }}
            >
              {stores.map((row) => {
                const known = SHOP_CATEGORIES.find((item) => item.id === row.category)
                return (
                  <option key={row.id} value={row.id}>
                    {known ? shopTitle(known.id) : row.name}
                  </option>
                )
              })}
            </select>
          ) : (
            <strong>{shopTitle(category)}</strong>
          )}
          <button type="button" className="grocery-link" onClick={onOpenPortal}>
            Portal
          </button>
          <button type="button" className="grocery-link" onClick={onSignOut}>
            Sign out
          </button>
        </div>
      </header>

      <label className="grocery-search">
        <span className="sr">Search products or scan a barcode</span>
        <input
          value={query}
          placeholder="Search products or scan barcode…"
          enterKeyHint="search"
          autoCapitalize="off"
          autoCorrect="off"
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => onSearchKey(event.key)}
        />
      </label>

      {categories.length > 0 ? (
        <div className="grocery-chips">
          <button type="button" className={categoryId === null ? 'on' : ''} onClick={() => setCategoryId(null)}>
            All
          </button>
          {categories.map((category) => (
            <button
              key={category.localId}
              type="button"
              className={categoryId === category.localId ? 'on' : ''}
              onClick={() => setCategoryId(categoryId === category.localId ? null : category.localId)}
            >
              {category.name}
            </button>
          ))}
        </div>
      ) : null}

      <div className="grocery-grid">
        {loadError ? <p className="grocery-banner">{loadError}</p> : null}
        {error && sheet !== 'pay' ? <p className="grocery-banner">{error}</p> : null}
        {visible.length === 0 ? <p className="grocery-empty">No products found</p> : null}
        {visible.map((product) => {
          const out = product.stockQty <= 0
          const low = !out && product.reorderPoint > 0 && product.stockQty <= product.reorderPoint
          return (
            <button
              key={product.id}
              type="button"
              className={out ? 'g-card off' : 'g-card'}
              disabled={out}
              onClick={() => addProduct(product)}
            >
              <span className="g-art">
                <BagIcon />
                {out ? <span className="g-badge out">Out of stock</span> : null}
                {low ? (
                  <span className="g-badge">
                    Low: {qtyLabel(product.stockQty)} {product.unit}
                  </span>
                ) : null}
              </span>
              <span className="g-meta">
                <span className="g-name">{product.name}</span>
                <span className="g-price">{money(product.price, symbol)}</span>
              </span>
            </button>
          )
        })}
      </div>

      <button type="button" className="grocery-order" onClick={() => setSheet('cart')}>
        <BagIcon />
        {itemCount > 0 ? <span className="g-count">{itemCount}</span> : null}
        View Order
      </button>

      {sheet ? (
        <div className="g-sheet-wrap" role="presentation" onClick={() => sheet !== 'done' && setSheet(null)}>
          <section className="g-sheet" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            {sheet === 'weigh' && weighProduct ? (
              <form
                className="g-weigh"
                onSubmit={(event) => {
                  event.preventDefault()
                  const qty = Number(weighQty)
                  if (!Number.isFinite(qty) || qty <= 0) return
                  addLine(weighProduct, qty)
                  setSheet(null)
                }}
              >
                <header className="g-sheet-head">
                  <h2>{weighProduct.name}</h2>
                  <button type="button" className="grocery-close" onClick={() => setSheet(null)}>
                    Close
                  </button>
                </header>
                <label>
                  Quantity ({weighProduct.unit})
                  <input inputMode="decimal" value={weighQty} onChange={(event) => setWeighQty(event.target.value)} />
                </label>
                <button type="submit" className="g-pay">
                  Add {money(lineSubtotal(weighProduct.price, Number(weighQty) || 0), symbol)}
                </button>
              </form>
            ) : null}

            {sheet === 'cart' ? (
              <>
                <header className="g-sheet-head">
                  <h2>Current order</h2>
                  <button type="button" className="grocery-close" onClick={() => setSheet(null)}>
                    Close
                  </button>
                </header>
                {cart.length === 0 ? <p className="grocery-empty">The order is empty.</p> : null}
                <ul className="g-lines">
                  {cart.map((line) => (
                    <li key={line.product.id} className="g-line">
                      <div>
                        <p className="g-line-name">{line.product.name}</p>
                        <p className="g-line-meta">{money(lineSubtotal(line.product.price, line.qty), symbol)}</p>
                      </div>
                      <div className="g-stepper">
                        <button type="button" aria-label={`Decrease ${line.product.name}`} onClick={() => changeQty(line.product.id, -qtyStep(line.product.unit))}>
                          −
                        </button>
                        <span>{qtyLabel(line.qty)}</span>
                        <button type="button" aria-label={`Increase ${line.product.name}`} onClick={() => changeQty(line.product.id, qtyStep(line.product.unit))}>
                          +
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
                <footer className="g-foot">
                  <label>
                    Discount
                    <input inputMode="decimal" value={discount} onChange={(event) => setDiscount(event.target.value)} />
                  </label>
                  <p className="g-tax">Subtotal {money(totals.subtotal, symbol)}</p>
                  {totals.discountAmount > 0 ? <p className="g-tax">Discount {money(totals.discountAmount, symbol)}</p> : null}
                  {totals.tax > 0 ? <p className="g-tax">Tax {money(totals.tax, symbol)}</p> : null}
                  <p className="g-due">
                    Total <strong>{money(totals.total, symbol)}</strong>
                  </p>
                  <button
                    type="button"
                    className="g-pay"
                    disabled={cart.length === 0}
                    onClick={() => {
                      setTendered(totals.total.toFixed(2))
                      setMethod('cash')
                      setError('')
                      setSheet('pay')
                    }}
                  >
                    Pay {money(totals.total, symbol)}
                  </button>
                </footer>
              </>
            ) : null}

            {sheet === 'pay' ? (
              <>
                <header className="g-sheet-head">
                  <h2>Payment</h2>
                  <button type="button" className="grocery-close" onClick={() => setSheet('cart')}>
                    Back
                  </button>
                </header>
                <p className="g-due">
                  Charge <strong>{money(totals.total, symbol)}</strong>
                </p>
                <div className="g-methods">
                  {(['cash', 'card', 'upi'] as PayMethod[]).map((item) => (
                    <button key={item} type="button" className={item === method ? 'on' : ''} onClick={() => setMethod(item)}>
                      {item === 'upi' ? 'UPI' : item[0].toUpperCase() + item.slice(1)}
                    </button>
                  ))}
                </div>
                {method === 'cash' ? (
                  <label>
                    Cash received
                    <input inputMode="decimal" value={tendered} onChange={(event) => setTendered(event.target.value)} />
                  </label>
                ) : null}
                {method === 'cash' && tendered !== '' && !cashShort ? (
                  <p className="g-ok">Change {money(Math.max(0, Number(tendered) - totals.total), symbol)}</p>
                ) : null}
                {error ? <p className="g-error">{error}</p> : null}
                <button type="button" className="g-pay" disabled={busy || cart.length === 0 || cashShort} onClick={() => void pay()}>
                  {busy ? 'Saving…' : 'Complete sale'}
                </button>
              </>
            ) : null}

            {sheet === 'done' && receipt ? (
              <div className="g-done">
                <p className="g-ok">Payment successful</p>
                <h2>{receipt.orderNumber}</h2>
                <p className="g-due">
                  Total <strong>{money(receipt.total, symbol)}</strong>
                </p>
                {receipt.change > 0 ? <p className="g-ok">Give change {money(receipt.change, symbol)}</p> : null}
                {receipt.stockWarning ? <p className="g-error">Sale saved. Stock did not update: {receipt.stockWarning}</p> : null}
                <button
                  type="button"
                  className="g-pay"
                  onClick={() => {
                    setReceipt(null)
                    setSheet(null)
                  }}
                >
                  New sale
                </button>
              </div>
            ) : null}
          </section>
        </div>
      ) : null}
    </div>
  )
}

export function CategoryPick({
  client,
  onSignOut,
  onChoose,
}: {
  client: SupabaseClient
  onSignOut: () => void
  onChoose: (category: ShopCategory) => void
}) {
  const [busy, setBusy] = useState<ShopCategory | null>(null)
  const [error, setError] = useState('')

  async function choose(category: ShopCategory) {
    setBusy(category)
    setError('')
    try {
      const rows = await loadGroceryStores(client)
      if (rows.length === 0) {
        await createGroceryShop(client, shopTitle(category), category)
      } else {
        const saved = localStorage.getItem(STORE_PICK) || readRememberedStore(true)
        const store = rows.find((row) => row.id === saved) ?? rows[0]
        await setStoreCategory(client, store.id, category)
        localStorage.setItem(STORE_PICK, store.id)
        writeRememberedStore(store.id, true)
      }
      onChoose(category)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open that category')
      setBusy(null)
    }
  }

  return (
    <main className="category-pick">
      <header>
        <h1>Choose your category</h1>
        <p>Pick the kind of shop you are opening. You can sign out and choose again later.</p>
      </header>
      {error ? <p className="g-error">{error}</p> : null}
      <div className="category-grid">
        {SHOP_CATEGORIES.map((item) => (
          <button key={item.id} type="button" className="category-card" disabled={busy !== null} onClick={() => void choose(item.id)}>
            <img src={CATEGORY_LOGOS[item.id]} alt="" />
            <span>{busy === item.id ? 'Opening…' : item.label}</span>
          </button>
        ))}
      </div>
      <button type="button" className="grocery-link" onClick={onSignOut}>
        Sign out
      </button>
    </main>
  )
}

const CATEGORY_LOGOS: Record<ShopCategory, string> = {
  grocery: groceryLogo,
  textile: textileLogo,
  pharmacy: pharmacyLogo,
  restaurant: restaurantLogo,
  bakery: bakeryLogo,
  retail: retailLogo,
}

function BagIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M6 8h12l-1 12H7L6 8zm3-1a3 3 0 0 1 6 0h2a1 1 0 0 1 1 1.08l-1.2 13.2A2 2 0 0 1 14.82 23H9.18a2 2 0 0 1-1.98-1.72L6 8.08A1 1 0 0 1 7 7h2zm2 0h2a1 1 0 0 0-2 0z"
      />
    </svg>
  )
}

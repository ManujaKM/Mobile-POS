import { useEffect, useState, type ReactNode } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  loadCreditCustomers,
  loadLowStock,
  loadPeriodSummary,
  loadVoids,
  type CreditCustomer,
  type LowStockRow,
  type PeriodSummary,
  type VoidRow,
} from './data'
import groceryLogo from './assets/grocery-logo.png'
import { GroceryPos } from './GroceryPos'
import {
  adjustDeskStock,
  closeDeskShift,
  collectDeskCredit,
  loadDeskCustomers,
  loadDeskGrns,
  loadDeskOrders,
  loadDeskOrderItems,
  loadDeskProducts,
  loadDeskPromotions,
  loadDeskPurchases,
  loadDeskSuppliers,
  loadOpenShift,
  openDeskShift,
  receiveDeskGrn,
  refundDeskOrder,
  returnDeskGrn,
  saveDeskCategory,
  saveDeskCustomer,
  saveDeskProduct,
  saveDeskPromotion,
  saveDeskPurchase,
  saveDeskSupplier,
  saveStoreProfile,
  setProductActive,
  type BuyItem,
  type DeskCustomer,
  type DeskGrn,
  type DeskOrder,
  type DeskOrderItem,
  type DeskProduct,
  type DeskPromotion,
  type DeskPurchase,
  type DeskShift,
  type DeskSupplier,
} from './groceryDesk'
import { loadGroceryCatalog, loadGroceryStores, money, type GroceryCategory, type GroceryStore, type ShopCategory } from './grocery'
import { readRememberedStore, writeRememberedStore } from './prefs'
import { periodWindow } from './time'
import './grocery.css'

type Section = 'pos' | 'products' | 'buying' | 'orders' | 'customers' | 'reports' | 'assistant' | 'contact' | 'settings'

const STORE_PICK = 'mentura-grocery-store'

export function GroceryHome({
  client,
  onSignOut,
  onOpenPortal,
}: {
  client: SupabaseClient
  onSignOut: () => void
  onOpenPortal: () => void
}) {
  const [section, setSection] = useState<Section>('pos')
  const [store, setStore] = useState<GroceryStore | null>(null)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    let active = true
    loadGroceryStores(client)
      .then((rows) => {
        if (!active) return
        const saved = localStorage.getItem(STORE_PICK) || readRememberedStore(true)
        const chosen = rows.find((row) => row.id === saved) ?? rows[0] ?? null
        setStore(chosen)
        if (chosen) {
          localStorage.setItem(STORE_PICK, chosen.id)
          writeRememberedStore(chosen.id, true)
        }
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : 'Could not open the shop')
      })
    return () => {
      active = false
    }
  }, [client, revision])

  function open(next: Section) {
    setSection(next)
  }

  return (
    <div className="grocery-home" data-category="grocery">
      <aside className="grocery-side">
        <div className="grocery-side-logo">
          <img src={groceryLogo} alt="Mentura POS" />
        </div>
        <nav className="grocery-nav" aria-label="Grocery sections">
          <NavButton current={section} id="pos" label="POS" icon="pos" onOpen={open} />
          <NavButton current={section} id="products" label="Products" icon="products" onOpen={open} />
          <NavButton current={section} id="buying" label="Procurement" icon="buy" onOpen={open} />
          <NavButton current={section} id="orders" label="Orders" icon="orders" onOpen={open} />
          <NavButton current={section} id="customers" label="Customers" icon="customers" onOpen={open} />
          <NavButton current={section} id="reports" label="Reports" icon="reports" onOpen={open} />
          <NavButton current={section} id="assistant" label="AI Assistant" icon="assistant" onOpen={open} />
          <NavButton current={section} id="contact" label="Contact Us" icon="contact" onOpen={open} />
          <NavButton current={section} id="settings" label="Settings" icon="settings" onOpen={open} />
        </nav>
        <button type="button" className="grocery-switch" onClick={onSignOut}>
          <NavGlyph name="switch" />
          <span>
            <strong>Admin</strong>
            Sign out
          </span>
        </button>
      </aside>
      <div className="grocery-home-body">
        {section === 'pos' ? (
          <GroceryPos
            client={client}
            category={'grocery' satisfies ShopCategory}
            onSignOut={onSignOut}
            onOpenPortal={onOpenPortal}
            docked
            reloadToken={revision}
          />
        ) : null}
        {section !== 'pos' && !store ? <p className="grocery-empty">{error || 'Opening the shop…'}</p> : null}
        {section === 'products' && store ? (
          <ProductsPane client={client} store={store} onChanged={() => setRevision((value) => value + 1)} />
        ) : null}
        {section === 'buying' && store ? (
          <BuyingPane client={client} store={store} onChanged={() => setRevision((value) => value + 1)} />
        ) : null}
        {section === 'orders' && store ? (
          <OrdersPane client={client} store={store} onChanged={() => setRevision((value) => value + 1)} />
        ) : null}
        {section === 'customers' && store ? <CustomersPane client={client} store={store} /> : null}
        {section === 'reports' && store ? <ReportsPane client={client} store={store} /> : null}
        {section === 'assistant' && store ? <AssistantPane client={client} store={store} /> : null}
        {section === 'contact' ? <ContactPane /> : null}
        {section === 'settings' && store ? (
          <SettingsPane
            client={client}
            store={store}
            onChanged={() => setRevision((value) => value + 1)}
          />
        ) : null}
      </div>
    </div>
  )
}

function NavButton({
  current,
  id,
  label,
  icon,
  onOpen,
}: {
  current: Section
  id: Section
  label: string
  icon: string
  onOpen: (section: Section) => void
}) {
  return (
    <button type="button" className={current === id ? 'on' : ''} onClick={() => onOpen(id)}>
      <NavGlyph name={icon} />
      {label}
    </button>
  )
}

function NavGlyph({ name }: { name: string }) {
  const common = { viewBox: '0 0 24 24', 'aria-hidden': true as const }
  if (name === 'pos') {
    return (
      <svg {...common}>
        <path fill="currentColor" d="M4 4h16a2 2 0 0 1 2 2v8H2V6a2 2 0 0 1 2-2zm-2 12h20v2a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-2zm4 1h2v2H6v-2z" />
      </svg>
    )
  }
  if (name === 'products') {
    return (
      <svg {...common}>
        <path fill="currentColor" d="M4 7h16v12H4V7zm2-3h12l1 2H5l1-2zm2 6v2h8V10H8z" />
      </svg>
    )
  }
  if (name === 'buy') {
    return (
      <svg {...common}>
        <path fill="currentColor" d="M7 4h10l1 3h3v2h-1.2l-1.4 9H5.6L4.2 9H3V7h3L7 4zm1.2 2-.7 2h9l-.7-2H8.2zM7 11v6h10v-6H7z" />
      </svg>
    )
  }
  if (name === 'orders') {
    return (
      <svg {...common}>
        <path fill="currentColor" d="M6 2h9l5 5v15H6V2zm8 1.5V8h4.5L14 3.5zM8 11h8v2H8v-2zm0 4h8v2H8v-2z" />
      </svg>
    )
  }
  if (name === 'customers') {
    return (
      <svg {...common}>
        <path fill="currentColor" d="M9 11a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7zm6 1a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2 20c0-3.3 2.7-5 7-5s7 1.7 7 5v1H2v-1zm14 .5c.1-2.2 1.2-3.7 3.2-4.4 1.6.6 2.8 1.8 2.8 3.9V21h-6v-.5z" />
      </svg>
    )
  }
  if (name === 'reports') {
    return (
      <svg {...common}>
        <path fill="currentColor" d="M4 19h16v2H4v-2zM6 10h3v7H6v-7zm5-6h3v13h-3V4zm5 4h3v9h-3V8z" />
      </svg>
    )
  }
  if (name === 'assistant') {
    return (
      <svg {...common}>
        <path fill="currentColor" d="m12 2 1.6 4.8L18.5 8.5 13.6 10 12 15l-1.6-5L6.5 8.5 11 6.8 12 2zm6 10 .8 2.4 2.4.8-2.4.8L18 18l-.8-2.4-2.4-.8 2.4-.8L18 12zM6 14l.9 2.6L9.5 17.5 6.9 18.4 6 21l-.9-2.6L2.5 17.5l2.6-.9L6 14z" />
      </svg>
    )
  }
  if (name === 'contact') {
    return (
      <svg {...common}>
        <path fill="currentColor" d="M12 2a8 8 0 0 0-8 8v1H3v5h3v-6a6 6 0 1 1 12 0v6h3v-5h-1v-1a8 8 0 0 0-8-8zm-5 11v5a2 2 0 0 0 2 2h1v-7H7zm8 7h1a2 2 0 0 0 2-2v-5h-3v7z" />
      </svg>
    )
  }
  if (name === 'switch') {
    return (
      <svg {...common}>
        <path fill="currentColor" d="M10 7V4L4 10l6 6v-3h8v-6H10zm4 10v3l6-6-6-6v3H6v6h8z" />
      </svg>
    )
  }
  return (
    <svg {...common}>
      <path fill="currentColor" d="M19.4 13a7.8 7.8 0 0 0 .1-1 7.8 7.8 0 0 0-.1-1l2-1.6-2-3.4-2.4 1a7.4 7.4 0 0 0-1.7-1L15 3h-4l-.3 2.9a7.4 7.4 0 0 0-1.7 1l-2.4-1-2 3.4L6.6 11a7.8 7.8 0 0 0-.1 1 7.8 7.8 0 0 0 .1 1l-2 1.6 2 3.4 2.4-1a7.4 7.4 0 0 0 1.7 1L11 21h4l.3-2.9a7.4 7.4 0 0 0 1.7-1l2.4 1 2-3.4-2-1.7zM12 15.5A3.5 3.5 0 1 1 12 8a3.5 3.5 0 0 1 0 7.5z" />
    </svg>
  )
}

function AssistantPane({ client, store }: { client: SupabaseClient; store: GroceryStore }) {
  const [answer, setAnswer] = useState('')
  const [error, setError] = useState('')

  async function ask() {
    setError('')
    const range = periodWindow('today', store.timezone, '', '')
    if (!range) return
    const [summary, low] = await Promise.all([
      loadPeriodSummary(client, store.id, range, store.timezone),
      loadLowStock(client, store.id),
    ])
    setAnswer(
      `Today's sales are ${money(summary.sales, store.currencySymbol)} from ${summary.completedCount} completed orders. Profit is ${money(summary.profit, store.currencySymbol)}. ${low.length} products are at or below the reorder point.`,
    )
  }

  return (
    <Pane title="AI Assistant">
      <p>Ask about today's sales, profit, and stock that needs reordering.</p>
      {error ? <p className="g-error">{error}</p> : null}
      <button
        type="button"
        className="g-pay"
        onClick={() => {
          ask().catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not answer'))
        }}
      >
        How is the shop today?
      </button>
      {answer ? <p className="desk-answer">{answer}</p> : null}
    </Pane>
  )
}

function ContactPane() {
  return (
    <Pane title="Contact Us">
      <ul className="desk-list">
        <li>
          <strong>Phone</strong>
          <span>+94 71 145 0490</span>
        </li>
        <li>
          <strong>Email</strong>
          <span>contact@menturaglobal.com</span>
        </li>
        <li>
          <strong>Website</strong>
          <span>www.menturaglobal.com</span>
        </li>
      </ul>
    </Pane>
  )
}

function Pane({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grocery-desk">
      <header>
        <h1>{title}</h1>
      </header>
      {children}
    </section>
  )
}

function ProductsPane({
  client,
  store,
  onChanged,
}: {
  client: SupabaseClient
  store: GroceryStore
  onChanged: () => void
}) {
  const [products, setProducts] = useState<DeskProduct[]>([])
  const [categories, setCategories] = useState<GroceryCategory[]>([])
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<DeskProduct | 'new' | null>(null)
  const [categoryName, setCategoryName] = useState('')
  const symbol = store.currencySymbol

  async function reload() {
    const [rows, catalog] = await Promise.all([
      loadDeskProducts(client, store.id),
      loadGroceryCatalog(client, store.id),
    ])
    setProducts(rows)
    setCategories(catalog.categories)
  }

  useEffect(() => {
    reload().catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not load products'))
  }, [client, store.id])

  const visible = products.filter((product) => product.name.toLowerCase().includes(query.trim().toLowerCase()))

  return (
    <Pane title="Products">
      {error ? <p className="g-error">{error}</p> : null}
      <label className="desk-field">
        Search
        <input value={query} placeholder="Search products" onChange={(event) => setQuery(event.target.value)} />
      </label>
      <form
        className="desk-inline"
        onSubmit={(event) => {
          event.preventDefault()
          saveDeskCategory(client, store.id, categoryName)
            .then(() => {
              setCategoryName('')
              onChanged()
              return reload()
            })
            .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not add the category'))
        }}
      >
        <input value={categoryName} placeholder="New category" onChange={(event) => setCategoryName(event.target.value)} />
        <button type="submit" className="g-pay slim">Add category</button>
      </form>
      <button type="button" className="g-pay" onClick={() => setEditing('new')}>Add product</button>
      <ul className="desk-list">
        {visible.map((product) => (
          <li key={product.id}>
            <button type="button" onClick={() => setEditing(product)}>
              <strong>{product.name}</strong>
              <span>
                {money(product.price, symbol)} · {product.stockQty} {product.unit}
                {product.active ? '' : ' · hidden'}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {editing ? (
        <ProductForm
          store={store}
          categories={categories}
          product={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSave={async (input) => {
            await saveDeskProduct(client, store.id, input)
            if (editing !== 'new') {
              /* keep id */
            }
            setEditing(null)
            onChanged()
            await reload()
          }}
          onHide={
            editing === 'new'
              ? undefined
              : async () => {
                  await setProductActive(client, store.id, editing.id, !editing.active)
                  setEditing(null)
                  onChanged()
                  await reload()
                }
          }
          onStock={
            editing === 'new'
              ? undefined
              : async (qty) => {
                  await adjustDeskStock(client, store.id, editing, qty, 'Counted on the till')
                  onChanged()
                  await reload()
                }
          }
        />
      ) : null}
    </Pane>
  )
}

function ProductForm({
  store,
  categories,
  product,
  onClose,
  onSave,
  onHide,
  onStock,
}: {
  store: GroceryStore
  categories: GroceryCategory[]
  product: DeskProduct | null
  onClose: () => void
  onSave: (input: {
    id?: string
    name: string
    barcode: string
    categoryLocalId: string
    price: number
    costPrice: number
    stockQty: number
    reorderPoint: number
    unit: string
  }) => Promise<void>
  onHide?: () => Promise<void>
  onStock?: (qty: number) => Promise<void>
}) {
  const [name, setName] = useState(product?.name ?? '')
  const [barcode, setBarcode] = useState(product?.barcode ?? '')
  const [categoryLocalId, setCategoryLocalId] = useState(product?.categoryLocalId ?? categories[0]?.localId ?? '')
  const [price, setPrice] = useState(String(product?.price ?? ''))
  const [cost, setCost] = useState(String(product?.costPrice ?? ''))
  const [stock, setStock] = useState(String(product?.stockQty ?? '0'))
  const [reorder, setReorder] = useState(String(product?.reorderPoint ?? '0'))
  const [unit, setUnit] = useState(product?.unit ?? 'piece')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  return (
    <div className="g-sheet-wrap" role="presentation" onClick={onClose}>
      <form
        className="g-sheet"
        onClick={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault()
          setBusy(true)
          onSave({
            id: product?.id,
            name,
            barcode,
            categoryLocalId,
            price: Number(price) || 0,
            costPrice: Number(cost) || 0,
            stockQty: Number(stock) || 0,
            reorderPoint: Number(reorder) || 0,
            unit,
          })
            .catch((err: unknown) => {
              setError(err instanceof Error ? err.message : 'Could not save the product')
              setBusy(false)
            })
        }}
      >
        <header className="g-sheet-head">
          <h2>{product ? product.name : 'New product'}</h2>
          <button type="button" className="grocery-close" onClick={onClose}>Close</button>
        </header>
        <label>Name<input value={name} required onChange={(event) => setName(event.target.value)} /></label>
        <label>Barcode<input value={barcode} onChange={(event) => setBarcode(event.target.value)} /></label>
        <label>
          Category
          <select value={categoryLocalId} onChange={(event) => setCategoryLocalId(event.target.value)}>
            <option value="">None</option>
            {categories.map((category) => (
              <option key={category.localId} value={category.localId}>{category.name}</option>
            ))}
          </select>
        </label>
        <label>Price ({store.currencySymbol})<input inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} /></label>
        <label>Cost<input inputMode="decimal" value={cost} onChange={(event) => setCost(event.target.value)} /></label>
        <label>Unit<input value={unit} onChange={(event) => setUnit(event.target.value)} /></label>
        {product ? null : (
          <label>Opening stock<input inputMode="decimal" value={stock} onChange={(event) => setStock(event.target.value)} /></label>
        )}
        <label>Reorder point<input inputMode="decimal" value={reorder} onChange={(event) => setReorder(event.target.value)} /></label>
        {error ? <p className="g-error">{error}</p> : null}
        <button type="submit" className="g-pay" disabled={busy}>{busy ? 'Saving…' : 'Save product'}</button>
        {product && onStock ? (
          <button
            type="button"
            className="g-pay ghost"
            onClick={() => {
              const next = window.prompt('Counted quantity', String(product.stockQty))
              if (next == null) return
              setBusy(true)
              onStock(Number(next) || 0).catch((err: unknown) => {
                setError(err instanceof Error ? err.message : 'Could not update stock')
                setBusy(false)
              })
            }}
          >
            Count stock
          </button>
        ) : null}
        {product && onHide ? (
          <button type="button" className="grocery-link" onClick={() => void onHide()}>
            {product.active ? 'Hide product' : 'Show product'}
          </button>
        ) : null}
      </form>
    </div>
  )
}

function BuyingPane({
  client,
  store,
  onChanged,
}: {
  client: SupabaseClient
  store: GroceryStore
  onChanged: () => void
}) {
  const [tab, setTab] = useState<'suppliers' | 'orders' | 'grn'>('suppliers')
  const [suppliers, setSuppliers] = useState<DeskSupplier[]>([])
  const [orders, setOrders] = useState<DeskPurchase[]>([])
  const [grns, setGrns] = useState<DeskGrn[]>([])
  const [products, setProducts] = useState<DeskProduct[]>([])
  const [error, setError] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [supplierId, setSupplierId] = useState('')
  const [productId, setProductId] = useState('')
  const [qty, setQty] = useState('1')
  const [lines, setLines] = useState<BuyItem[]>([])

  async function reload() {
    const [nextSuppliers, nextOrders, nextGrns, nextProducts] = await Promise.all([
      loadDeskSuppliers(client, store.id),
      loadDeskPurchases(client, store.id),
      loadDeskGrns(client, store.id),
      loadDeskProducts(client, store.id),
    ])
    setSuppliers(nextSuppliers)
    setOrders(nextOrders)
    setGrns(nextGrns)
    setProducts(nextProducts.filter((product) => product.active))
    setSupplierId((current) => current || nextSuppliers[0]?.localId || '')
    setProductId((current) => current || nextProducts[0]?.localId || '')
  }

  useEffect(() => {
    reload().catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not load buying'))
  }, [client, store.id])

  const names = new Map(suppliers.map((supplier) => [supplier.localId, supplier.name]))

  return (
    <Pane title="Procurement">
      {error ? <p className="g-error">{error}</p> : null}
      <div className="g-methods">
        <button type="button" className={tab === 'suppliers' ? 'on' : ''} onClick={() => setTab('suppliers')}>Suppliers</button>
        <button type="button" className={tab === 'orders' ? 'on' : ''} onClick={() => setTab('orders')}>Purchase orders</button>
        <button type="button" className={tab === 'grn' ? 'on' : ''} onClick={() => setTab('grn')}>GRN</button>
      </div>
      {tab === 'suppliers' ? (
        <>
          <form
            className="desk-inline"
            onSubmit={(event) => {
              event.preventDefault()
              saveDeskSupplier(client, store.id, { name, contact: '', phone })
                .then(() => {
                  setName('')
                  setPhone('')
                  return reload()
                })
                .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not add the supplier'))
            }}
          >
            <input value={name} required placeholder="Supplier name" onChange={(event) => setName(event.target.value)} />
            <input value={phone} placeholder="Phone" onChange={(event) => setPhone(event.target.value)} />
            <button type="submit" className="g-pay slim">Add</button>
          </form>
          <ul className="desk-list">
            {suppliers.map((supplier) => (
              <li key={supplier.localId}><strong>{supplier.name}</strong><span>{supplier.phone || 'No phone'}</span></li>
            ))}
          </ul>
        </>
      ) : null}
      {tab === 'orders' ? (
        <>
          <label className="desk-field">
            Supplier
            <select value={supplierId} onChange={(event) => setSupplierId(event.target.value)}>
              {suppliers.map((supplier) => (
                <option key={supplier.localId} value={supplier.localId}>{supplier.name}</option>
              ))}
            </select>
          </label>
          <div className="desk-inline">
            <select value={productId} onChange={(event) => setProductId(event.target.value)}>
              {products.map((product) => (
                <option key={product.localId} value={product.localId}>{product.name}</option>
              ))}
            </select>
            <input inputMode="decimal" value={qty} onChange={(event) => setQty(event.target.value)} />
            <button
              type="button"
              className="g-pay slim"
              onClick={() => {
                const product = products.find((row) => row.localId === productId)
                if (!product) return
                setLines((current) => [...current, { productLocalId: product.localId, name: product.name, qty: Number(qty) || 1, cost: product.costPrice || product.price }])
              }}
            >
              Add line
            </button>
          </div>
          <ul className="desk-list">
            {lines.map((line, index) => (
              <li key={`${line.productLocalId}-${index}`}><strong>{line.name}</strong><span>{line.qty} × {money(line.cost, store.currencySymbol)}</span></li>
            ))}
          </ul>
          <button
            type="button"
            className="g-pay"
            onClick={() => {
              saveDeskPurchase(client, store.id, supplierId, lines)
                .then(() => {
                  setLines([])
                  return reload()
                })
                .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not save the order'))
            }}
          >
            Save purchase order
          </button>
          <ul className="desk-list">
            {orders.map((order) => (
              <li key={order.id}>
                <strong>{order.number}</strong>
                <span>{names.get(order.supplierLocalId) ?? 'Supplier'} · {order.status} · {money(order.total, store.currencySymbol)}</span>
                {order.status !== 'received' ? (
                  <button
                    type="button"
                    className="grocery-link"
                    onClick={() => {
                      receiveDeskGrn(client, store.id, order)
                        .then(() => {
                          onChanged()
                          return reload()
                        })
                        .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not receive the goods'))
                    }}
                  >
                    Receive goods
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {tab === 'grn' ? (
        <ul className="desk-list">
          {grns.map((grn) => (
            <li key={grn.id}>
              <strong>{grn.number}</strong>
              <span>{money(grn.total, store.currencySymbol)} · {grn.items.length} lines</span>
              <button
                type="button"
                className="grocery-link"
                onClick={() => {
                  const reason = window.prompt('Reason for the return', 'Returned to supplier')
                  if (reason == null) return
                  returnDeskGrn(client, store.id, grn, reason)
                    .then(() => {
                      onChanged()
                      return reload()
                    })
                    .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not return the goods'))
                }}
              >
                Return to supplier
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </Pane>
  )
}

function OrdersPane({
  client,
  store,
  onChanged,
}: {
  client: SupabaseClient
  store: GroceryStore
  onChanged: () => void
}) {
  const [orders, setOrders] = useState<DeskOrder[]>([])
  const [selected, setSelected] = useState<DeskOrder | null>(null)
  const [items, setItems] = useState<DeskOrderItem[]>([])
  const [error, setError] = useState('')

  function reload() {
    return loadDeskOrders(client, store.id).then(setOrders)
  }

  useEffect(() => {
    reload().catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not load orders'))
  }, [client, store.id])

  return (
    <Pane title="Orders">
      {error ? <p className="g-error">{error}</p> : null}
      <ul className="desk-list">
        {orders.map((order) => (
          <li key={order.id}>
            <button
              type="button"
              onClick={() => {
                setSelected(order)
                loadDeskOrderItems(client, order.id)
                  .then(setItems)
                  .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not load the bill'))
              }}
            >
              <strong>{order.number}</strong>
              <span>{order.status} · {order.method || 'cash'} · {money(order.total, store.currencySymbol)}</span>
            </button>
          </li>
        ))}
      </ul>
      {selected ? (
        <div className="g-sheet-wrap" role="presentation" onClick={() => setSelected(null)}>
          <section className="g-sheet" onClick={(event) => event.stopPropagation()}>
            <header className="g-sheet-head">
              <h2>{selected.number}</h2>
              <button type="button" className="grocery-close" onClick={() => setSelected(null)}>Close</button>
            </header>
            <ul className="desk-list">
              {items.map((item) => (
                <li key={`${item.name}-${item.qty}`}><strong>{item.name}</strong><span>{item.qty} × {money(item.price, store.currencySymbol)}</span></li>
              ))}
            </ul>
            <p>Tax {money(selected.tax, store.currencySymbol)} · Discount {money(selected.discount, store.currencySymbol)}</p>
            {selected.refunded === 0 ? (
              <button
                type="button"
                className="g-pay"
                onClick={() => {
                  refundDeskOrder(client, store.id, selected)
                    .then(() => {
                      setSelected(null)
                      onChanged()
                      return reload()
                    })
                    .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not refund the bill'))
                }}
              >
                Refund bill
              </button>
            ) : (
              <p className="g-ok">Refunded {money(selected.refunded, store.currencySymbol)}</p>
            )}
          </section>
        </div>
      ) : null}
    </Pane>
  )
}

function CustomersPane({ client, store }: { client: SupabaseClient; store: GroceryStore }) {
  const [customers, setCustomers] = useState<DeskCustomer[]>([])
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [limit, setLimit] = useState('0')
  const [error, setError] = useState('')

  function reload() {
    return loadDeskCustomers(client, store.id).then(setCustomers)
  }

  useEffect(() => {
    reload().catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not load customers'))
  }, [client, store.id])

  return (
    <Pane title="Customers">
      {error ? <p className="g-error">{error}</p> : null}
      <form
        className="desk-inline"
        onSubmit={(event) => {
          event.preventDefault()
          saveDeskCustomer(client, store.id, { name, phone, email: '', creditLimit: Number(limit) || 0 })
            .then(() => {
              setName('')
              setPhone('')
              setLimit('0')
              return reload()
            })
            .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not add the customer'))
        }}
      >
        <input value={name} required placeholder="Name" onChange={(event) => setName(event.target.value)} />
        <input value={phone} placeholder="Phone" onChange={(event) => setPhone(event.target.value)} />
        <input inputMode="decimal" value={limit} placeholder="Credit limit" onChange={(event) => setLimit(event.target.value)} />
        <button type="submit" className="g-pay slim">Add</button>
      </form>
      <ul className="desk-list">
        {customers.map((customer) => (
          <li key={customer.id}>
            <strong>{customer.name}</strong>
            <span>
              {customer.phone || 'No phone'} · spent {money(customer.totalSpent, store.currencySymbol)} · credit{' '}
              {money(customer.creditBalance, store.currencySymbol)}
            </span>
            {customer.creditBalance > 0 ? (
              <button
                type="button"
                className="grocery-link"
                onClick={() => {
                  const amount = window.prompt('Amount collected', String(customer.creditBalance))
                  if (amount == null) return
                  collectDeskCredit(client, store.id, customer, Number(amount) || 0, 'cash')
                    .then(reload)
                    .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not collect the payment'))
                }}
              >
                Collect credit
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </Pane>
  )
}

function ReportsPane({ client, store }: { client: SupabaseClient; store: GroceryStore }) {
  const [tab, setTab] = useState<'sales' | 'stock' | 'voids' | 'credit' | 'reorder'>('sales')
  const [summary, setSummary] = useState<PeriodSummary | null>(null)
  const [low, setLow] = useState<LowStockRow[]>([])
  const [voids, setVoids] = useState<VoidRow[]>([])
  const [credit, setCredit] = useState<CreditCustomer[]>([])
  const [reorder, setReorder] = useState<DeskProduct[]>([])
  const [error, setError] = useState('')
  const range = periodWindow('today', store.timezone, '', '')

  useEffect(() => {
    if (!range) return
    Promise.all([
      loadPeriodSummary(client, store.id, range, store.timezone),
      loadLowStock(client, store.id),
      loadVoids(client, store.id, range),
      loadCreditCustomers(client, store.id),
      loadDeskProducts(client, store.id),
    ])
      .then(([nextSummary, nextLow, nextVoids, nextCredit, products]) => {
        setSummary(nextSummary)
        setLow(nextLow)
        setVoids(nextVoids)
        setCredit(nextCredit)
        setReorder(products.filter((product) => product.active && product.reorderPoint > 0 && product.stockQty <= product.reorderPoint))
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not load reports'))
  }, [client, store.id, range?.start, range?.end, store.timezone])

  return (
    <Pane title="Reports">
      {error ? <p className="g-error">{error}</p> : null}
      <div className="g-methods wrap">
        {(['sales', 'stock', 'voids', 'credit', 'reorder'] as const).map((item) => (
          <button key={item} type="button" className={tab === item ? 'on' : ''} onClick={() => setTab(item)}>
            {item === 'sales' ? 'Sales' : item === 'stock' ? 'Inventory' : item === 'voids' ? 'Voids' : item === 'credit' ? 'Credit' : 'Reorder'}
          </button>
        ))}
      </div>
      {tab === 'sales' && summary ? (
        <div className="desk-stats">
          <p>Sales <strong>{money(summary.sales, store.currencySymbol)}</strong></p>
          <p>Orders <strong>{summary.completedCount}</strong></p>
          <p>Tax <strong>{money(summary.tax, store.currencySymbol)}</strong></p>
          <p>Discount <strong>{money(summary.discount, store.currencySymbol)}</strong></p>
          <p>Profit <strong>{money(summary.profit, store.currencySymbol)}</strong></p>
          <p>Cash <strong>{money(summary.payments.cash, store.currencySymbol)}</strong></p>
          <p>Card <strong>{money(summary.payments.card, store.currencySymbol)}</strong></p>
          <p>UPI <strong>{money(summary.payments.upi, store.currencySymbol)}</strong></p>
          <p>Credit <strong>{money(summary.payments.credit, store.currencySymbol)}</strong></p>
        </div>
      ) : null}
      {tab === 'stock' ? (
        <ul className="desk-list">
          {low.length === 0 ? <li><span>Stock is above the reorder points.</span></li> : null}
          {low.map((row) => (
            <li key={row.id}><strong>{row.name}</strong><span>{row.stock_qty} {row.unit}</span></li>
          ))}
        </ul>
      ) : null}
      {tab === 'voids' ? (
        <ul className="desk-list">
          {voids.length === 0 ? <li><span>No voids or refunds today.</span></li> : null}
          {voids.map((row) => (
            <li key={row.id}><strong>{row.product_name}</strong><span>{row.type} · {row.quantity}</span></li>
          ))}
        </ul>
      ) : null}
      {tab === 'credit' ? (
        <ul className="desk-list">
          {credit.length === 0 ? <li><span>No credit balances.</span></li> : null}
          {credit.map((row) => (
            <li key={row.id}><strong>{row.name}</strong><span>{money(row.credit_balance, store.currencySymbol)}</span></li>
          ))}
        </ul>
      ) : null}
      {tab === 'reorder' ? (
        <ul className="desk-list">
          {reorder.length === 0 ? <li><span>Nothing to reorder.</span></li> : null}
          {reorder.map((product) => (
            <li key={product.id}>
              <strong>{product.name}</strong>
              <span>On hand {product.stockQty}. Suggest buying {product.reorderQty || product.reorderPoint} {product.unit}.</span>
            </li>
          ))}
        </ul>
      ) : null}
    </Pane>
  )
}

function SettingsPane({
  client,
  store,
  onChanged,
}: {
  client: SupabaseClient
  store: GroceryStore
  onChanged: () => void
}) {
  const [name, setName] = useState(store.name)
  const [address, setAddress] = useState(store.address)
  const [phone, setPhone] = useState(store.phone)
  const [currency, setCurrency] = useState(store.currencySymbol)
  const [tax, setTax] = useState(String(Math.round(store.taxRate * 10000) / 100))
  const [promos, setPromos] = useState<DeskPromotion[]>([])
  const [shift, setShift] = useState<DeskShift | null>(null)
  const [promoName, setPromoName] = useState('')
  const [promoValue, setPromoValue] = useState('10')
  const [opening, setOpening] = useState('0')
  const [counted, setCounted] = useState('')
  const [error, setError] = useState('')
  const [saved, setSaved] = useState('')

  useEffect(() => {
    Promise.all([loadDeskPromotions(client, store.id), loadOpenShift(client, store.id)])
      .then(([nextPromos, nextShift]) => {
        setPromos(nextPromos)
        setShift(nextShift)
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not load settings'))
  }, [client, store.id])

  return (
    <Pane title="Settings">
      {error ? <p className="g-error">{error}</p> : null}
      {saved ? <p className="g-ok">{saved}</p> : null}
      <form
        className="desk-form"
        onSubmit={(event) => {
          event.preventDefault()
          saveStoreProfile(client, store, { name, address, phone, currency, taxPercent: Number(tax) || 0 })
            .then(() => {
              setSaved('Shop details saved')
              onChanged()
            })
            .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not save the shop'))
        }}
      >
        <label>Shop name<input value={name} onChange={(event) => setName(event.target.value)} /></label>
        <label>Address<input value={address} onChange={(event) => setAddress(event.target.value)} /></label>
        <label>Phone<input value={phone} onChange={(event) => setPhone(event.target.value)} /></label>
        <label>Currency<input value={currency} onChange={(event) => setCurrency(event.target.value)} /></label>
        <label>Tax %<input inputMode="decimal" value={tax} onChange={(event) => setTax(event.target.value)} /></label>
        <button type="submit" className="g-pay">Save shop</button>
      </form>
      <h2>Shift</h2>
      {shift ? (
        <form
          className="desk-form"
          onSubmit={(event) => {
            event.preventDefault()
            closeDeskShift(client, store.id, shift, Number(counted) || 0)
              .then(() => {
                setShift(null)
                setSaved('Shift closed')
              })
              .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not close the shift'))
          }}
        >
          <p>Opened with {money(shift.opening, store.currencySymbol)}</p>
          <label>Counted cash<input inputMode="decimal" value={counted} onChange={(event) => setCounted(event.target.value)} /></label>
          <button type="submit" className="g-pay">Close shift</button>
        </form>
      ) : (
        <form
          className="desk-inline"
          onSubmit={(event) => {
            event.preventDefault()
            openDeskShift(client, store.id, Number(opening) || 0)
              .then(() => loadOpenShift(client, store.id))
              .then((next) => {
                setShift(next)
                setSaved('Shift opened')
              })
              .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not open the shift'))
          }}
        >
          <input inputMode="decimal" value={opening} onChange={(event) => setOpening(event.target.value)} />
          <button type="submit" className="g-pay slim">Open shift</button>
        </form>
      )}
      <h2>Promotions</h2>
      <form
        className="desk-inline"
        onSubmit={(event) => {
          event.preventDefault()
          saveDeskPromotion(client, store.id, { name: promoName, type: 'percent', value: Number(promoValue) || 0, code: '' })
            .then(() => {
              setPromoName('')
              return loadDeskPromotions(client, store.id)
            })
            .then(setPromos)
            .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not add the promotion'))
        }}
      >
        <input value={promoName} required placeholder="Promotion name" onChange={(event) => setPromoName(event.target.value)} />
        <input inputMode="decimal" value={promoValue} onChange={(event) => setPromoValue(event.target.value)} />
        <button type="submit" className="g-pay slim">Add % off</button>
      </form>
      <ul className="desk-list">
        {promos.map((promo) => (
          <li key={promo.id}><strong>{promo.name}</strong><span>{promo.value}% · {promo.active ? 'Active' : 'Off'}</span></li>
        ))}
      </ul>
    </Pane>
  )
}

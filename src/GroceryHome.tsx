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
import { formatWhen, periodWindow, todayYmd } from './time'
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
  const [tab, setTab] = useState<'products' | 'categories' | 'inventory'>('products')
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

  const needle = query.trim().toLowerCase()
  const visible = products.filter((product) => {
    if (tab === 'products' && !product.active) return false
    return product.name.toLowerCase().includes(needle) || product.barcode.toLowerCase().includes(needle)
  })
  const categoryMatches = categories.filter((category) => category.name.toLowerCase().includes(needle))
  const lowStock = products.filter((product) => product.active && product.reorderPoint > 0 && product.stockQty <= product.reorderPoint)

  return (
    <section className="products-screen">
      <header className="products-title">
        <h1>{tab === 'inventory' ? 'Inventory' : 'Products'}</h1>
      </header>
      <div className="products-tabs" role="tablist">
        <button type="button" className={tab === 'products' ? 'on' : ''} onClick={() => { setTab('products'); setQuery('') }}>
          <TabGlyph name="products" />
          Products
        </button>
        <button type="button" className={tab === 'categories' ? 'on' : ''} onClick={() => { setTab('categories'); setQuery('') }}>
          <TabGlyph name="categories" />
          Categories
        </button>
        <button type="button" className={tab === 'inventory' ? 'on' : ''} onClick={() => { setTab('inventory'); setQuery('') }}>
          <TabGlyph name="inventory" />
          Inventory
        </button>
      </div>
      {error ? <p className="g-error products-error">{error}</p> : null}
      {tab === 'products' ? (
        <>
          <div className="products-toolbar">
            <label className="products-search">
              <span className="sr">Search products or scan a barcode</span>
              <input
                value={query}
                placeholder="Search products or scan barcode..."
                onChange={(event) => setQuery(event.target.value)}
              />
              <span className="scan-mark" aria-hidden="true">▦</span>
            </label>
            <span className="products-count">{visible.length} products</span>
            <button type="button" className="products-add" onClick={() => setEditing('new')}>+ Add product</button>
          </div>
          <div className="products-body">
            {products.filter((product) => product.active).length === 0 && !needle ? (
              <div className="products-empty">
                <span className="pos-empty-icon" aria-hidden="true">▢</span>
                <strong>No products yet</strong>
                <p>Add your first product to start selling.</p>
                <button type="button" className="products-add wide" onClick={() => setEditing('new')}>+ Add Product</button>
              </div>
            ) : visible.length === 0 ? (
              <div className="products-empty">
                <strong>No products found</strong>
                <p>Try a different search or barcode.</p>
              </div>
            ) : (
              <div className="products-grid">
                {visible.map((product) => (
                  <button key={product.id} type="button" className="products-card" onClick={() => setEditing(product)}>
                    <span className="products-art" aria-hidden="true">👜</span>
                    <strong>{product.name}</strong>
                    <span className="products-price">{money(product.price, symbol)}</span>
                    <span className="products-stock">Stock: {product.stockQty} {product.unit}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button type="button" className="products-fab" onClick={() => setEditing('new')}>+ Add Product</button>
        </>
      ) : null}
      {tab === 'categories' ? (
        <>
          <form
            className="products-toolbar"
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
            <label className="products-search">
              <span className="sr">Search categories</span>
              <input value={query} placeholder="Search categories..." onChange={(event) => setQuery(event.target.value)} />
            </label>
            <input className="products-name" value={categoryName} placeholder="New category" onChange={(event) => setCategoryName(event.target.value)} />
            <button type="submit" className="products-add">+ Add category</button>
          </form>
          <div className="products-body">
            {categoryMatches.length === 0 ? (
              <div className="products-empty">
                <strong>No categories yet</strong>
                <p>Add a category to group products.</p>
              </div>
            ) : (
              <div className="products-grid">
                {categoryMatches.map((category) => {
                  const count = products.filter((product) => product.categoryLocalId === category.localId && product.active).length
                  return (
                    <article key={category.localId} className="products-card static">
                      <strong>{category.name}</strong>
                      <span className="products-stock">{count} products</span>
                    </article>
                  )
                })}
              </div>
            )}
          </div>
        </>
      ) : null}
      {tab === 'inventory' ? (
        <>
          <div className="products-toolbar">
            <label className="products-search">
              <span className="sr">Search stock</span>
              <input value={query} placeholder="Search stock..." onChange={(event) => setQuery(event.target.value)} />
            </label>
            <span className="products-count">{lowStock.length} to reorder</span>
          </div>
          <div className="products-body">
            <ul className="stock-list">
              {visible.map((product) => {
                const low = product.reorderPoint > 0 && product.stockQty <= product.reorderPoint
                return (
                  <li key={product.id} className={low ? 'low' : ''}>
                    <div>
                      <strong>{product.name}</strong>
                      <span>Stock {product.stockQty} {product.unit} · reorder {product.reorderPoint}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const next = window.prompt('Counted quantity', String(product.stockQty))
                        if (next == null) return
                        adjustDeskStock(client, store.id, product, Number(next) || 0, 'Counted on the till')
                          .then(() => {
                            onChanged()
                            return reload()
                          })
                          .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not update stock'))
                      }}
                    >
                      Count
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        </>
      ) : null}
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
    </section>
  )
}

function TabGlyph({ name }: { name: 'products' | 'categories' | 'inventory' }) {
  const common = { viewBox: '0 0 24 24', 'aria-hidden': true as const }
  if (name === 'categories') {
    return (
      <svg {...common}>
        <path fill="currentColor" d="M4 4h7v7H4V4zm9 0h7v7h-7V4zM4 13h7v7H4v-7zm9 3h7v4h-7v-4z" />
      </svg>
    )
  }
  if (name === 'inventory') {
    return (
      <svg {...common}>
        <path fill="currentColor" d="M3 10 12 4l9 6v9H3v-9zm2 1.2V17h14v-5.8l-7-4.6-7 4.6z" />
      </svg>
    )
  }
  return (
    <svg {...common}>
      <path fill="currentColor" d="M4 7h16v12H4V7zm2-3h12l1 2H5l1-2z" />
    </svg>
  )
}

function StudioGlyph({ name }: { name: 'truck' | 'po' | 'grn' | 'calendar' | 'receipt' | 'people' | 'person' | 'wallet' }) {
  const common = { viewBox: '0 0 24 24', 'aria-hidden': true as const }
  if (name === 'truck') {
    return (
      <svg {...common}>
        <path fill="currentColor" d="M3 6h11v9H3V6zm12 2h3.2L21 11.2V15h-6V8zM7 18a2 2 0 1 0 0.01 0H7zm10 0a2 2 0 1 0 0.01 0H17z" />
      </svg>
    )
  }
  if (name === 'po') {
    return (
      <svg {...common}>
        <path fill="currentColor" d="M6 3h9l4 4v14H6V3zm8 1.5V8h3.5L14 4.5zM8 12h8v1.5H8V12zm0 3h8v1.5H8V15z" />
      </svg>
    )
  }
  if (name === 'grn') {
    return (
      <svg {...common}>
        <path fill="currentColor" d="M7 3h7l4 4v14H7V3zm6 1.6V8h3.4L13 4.6zM9 12h6v1.4H9V12zm0 3h6v1.4H9V15z" />
      </svg>
    )
  }
  if (name === 'calendar') {
    return (
      <svg {...common}>
        <path fill="currentColor" d="M7 2h2v2h6V2h2v2h3v16H4V4h3V2zm11 8H6v8h12v-8z" />
      </svg>
    )
  }
  if (name === 'receipt') {
    return (
      <svg {...common}>
        <path fill="currentColor" d="M6 3h12v18l-2-1.4L14 21l-2-1.4L10 21l-2-1.4L6 21V3zm2 4v1.5h8V7H8zm0 3.5V12h8v-1.5H8zm0 3.5v1.5h5V14H8z" />
      </svg>
    )
  }
  if (name === 'people') {
    return (
      <svg {...common}>
        <path fill="currentColor" d="M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm6.2 0a2.4 2.4 0 1 0 0-4.8 2.4 2.4 0 0 0 0 4.8zM3.5 18.5c.4-2.6 2.6-4 5.5-4s5.1 1.4 5.5 4v1H3.5v-1zm11.2-.4c.2.5.3.9.3 1.4v1h5.5v-.8c-.3-2-2-3.2-4.2-3.2-.6 0-1.1.1-1.6.2z" />
      </svg>
    )
  }
  if (name === 'person') {
    return (
      <svg {...common}>
        <path fill="currentColor" d="M12 12a3.2 3.2 0 1 0 0-6.4A3.2 3.2 0 0 0 12 12zm-5.5 7.2c.5-2.8 2.7-4.2 5.5-4.2s5 1.4 5.5 4.2v.8h-11v-.8z" />
      </svg>
    )
  }
  return (
    <svg {...common}>
      <path fill="currentColor" d="M3 7h18v10H3V7zm2 2v6h14V9H5zm11.2 1.2h2.3v1.6h-2.3V10.2z" />
    </svg>
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
  const [query, setQuery] = useState('')
  const [addingSupplier, setAddingSupplier] = useState(false)
  const [addingOrder, setAddingOrder] = useState(false)

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
  const needle = query.trim().toLowerCase()
  const visibleSuppliers = suppliers.filter((supplier) =>
    supplier.name.toLowerCase().includes(needle) || supplier.phone.toLowerCase().includes(needle),
  )
  const visibleOrders = orders.filter((order) => {
    const label = `${order.number} ${names.get(order.supplierLocalId) ?? ''} ${order.status}`.toLowerCase()
    return label.includes(needle)
  })
  const visibleGrns = grns.filter((grn) => grn.number.toLowerCase().includes(needle))

  return (
    <section className="products-screen">
      <header className="products-title">
        <h1>Procurement</h1>
      </header>
      <div className="products-tabs" role="tablist">
        <button type="button" className={tab === 'suppliers' ? 'on' : ''} onClick={() => { setTab('suppliers'); setQuery('') }}>
          <StudioGlyph name="truck" />
          Suppliers
        </button>
        <button type="button" className={tab === 'orders' ? 'on' : ''} onClick={() => { setTab('orders'); setQuery('') }}>
          <StudioGlyph name="po" />
          Purchase Orders
        </button>
        <button type="button" className={tab === 'grn' ? 'on' : ''} onClick={() => { setTab('grn'); setQuery('') }}>
          <StudioGlyph name="grn" />
          GRN
        </button>
      </div>
      {error ? <p className="g-error products-error">{error}</p> : null}
      {tab === 'suppliers' ? (
        <>
          <div className="products-toolbar">
            <label className="products-search">
              <span className="sr">Search suppliers</span>
              <input value={query} placeholder="Search suppliers..." onChange={(event) => setQuery(event.target.value)} />
            </label>
            <button type="button" className="products-add" onClick={() => setAddingSupplier(true)}>+ Add supplier</button>
          </div>
          <div className="products-body">
            {visibleSuppliers.length === 0 ? (
              <div className="products-empty">
                <strong>{needle ? 'No suppliers found' : 'No suppliers yet'}</strong>
              </div>
            ) : (
              <ul className="studio-list">
                {visibleSuppliers.map((supplier) => (
                  <li key={supplier.localId}>
                    <strong>{supplier.name}</strong>
                    <span>{supplier.phone || 'No phone'}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : null}
      {tab === 'orders' ? (
        <>
          <div className="products-toolbar">
            <label className="products-search">
              <span className="sr">Search purchase orders</span>
              <input value={query} placeholder="Search purchase orders..." onChange={(event) => setQuery(event.target.value)} />
            </label>
            <button type="button" className="products-add" onClick={() => setAddingOrder(true)}>+ New order</button>
          </div>
          <div className="products-body">
            {visibleOrders.length === 0 ? (
              <div className="products-empty">
                <strong>{needle ? 'No purchase orders found' : 'No purchase orders yet'}</strong>
              </div>
            ) : (
              <ul className="studio-list">
                {visibleOrders.map((order) => (
                  <li key={order.id}>
                    <div>
                      <strong>{order.number}</strong>
                      <span>{names.get(order.supplierLocalId) ?? 'Supplier'} · {order.status} · {money(order.total, store.currencySymbol)}</span>
                    </div>
                    {order.status !== 'received' ? (
                      <button
                        type="button"
                        onClick={() => {
                          receiveDeskGrn(client, store.id, order)
                            .then(() => {
                              onChanged()
                              return reload()
                            })
                            .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not receive the goods'))
                        }}
                      >
                        Receive
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : null}
      {tab === 'grn' ? (
        <>
          <div className="products-toolbar">
            <label className="products-search">
              <span className="sr">Search goods receipts</span>
              <input value={query} placeholder="Search GRN..." onChange={(event) => setQuery(event.target.value)} />
            </label>
          </div>
          <div className="products-body">
            {visibleGrns.length === 0 ? (
              <div className="products-empty">
                <strong>{needle ? 'No receipts found' : 'No goods receipts yet'}</strong>
              </div>
            ) : (
              <ul className="studio-list">
                {visibleGrns.map((grn) => (
                  <li key={grn.id}>
                    <div>
                      <strong>{grn.number}</strong>
                      <span>{money(grn.total, store.currencySymbol)} · {grn.items.length} lines</span>
                    </div>
                    <button
                      type="button"
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
                      Return
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : null}
      {addingSupplier ? (
        <div className="g-sheet-wrap" role="presentation" onClick={() => setAddingSupplier(false)}>
          <form
            className="g-sheet"
            onClick={(event) => event.stopPropagation()}
            onSubmit={(event) => {
              event.preventDefault()
              saveDeskSupplier(client, store.id, { name, contact: '', phone })
                .then(() => {
                  setName('')
                  setPhone('')
                  setAddingSupplier(false)
                  return reload()
                })
                .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not add the supplier'))
            }}
          >
            <header className="g-sheet-head">
              <h2>Add supplier</h2>
              <button type="button" className="grocery-close" onClick={() => setAddingSupplier(false)}>Close</button>
            </header>
            <label className="desk-field">Supplier name<input value={name} required onChange={(event) => setName(event.target.value)} /></label>
            <label className="desk-field">Phone<input value={phone} onChange={(event) => setPhone(event.target.value)} /></label>
            <button type="submit" className="g-pay">Save supplier</button>
          </form>
        </div>
      ) : null}
      {addingOrder ? (
        <div className="g-sheet-wrap" role="presentation" onClick={() => setAddingOrder(false)}>
          <section className="g-sheet" onClick={(event) => event.stopPropagation()}>
            <header className="g-sheet-head">
              <h2>New purchase order</h2>
              <button type="button" className="grocery-close" onClick={() => setAddingOrder(false)}>Close</button>
            </header>
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
                    setAddingOrder(false)
                    return reload()
                  })
                  .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not save the order'))
              }}
            >
              Save purchase order
            </button>
          </section>
        </div>
      ) : null}
    </section>
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
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState<'today' | 'yesterday' | 'week' | 'month' | 'custom'>('today')
  const today = todayYmd(store.timezone)
  const [customStart, setCustomStart] = useState(today)
  const [customEnd, setCustomEnd] = useState(today)

  function reload() {
    return loadDeskOrders(client, store.id).then(setOrders)
  }

  useEffect(() => {
    reload().catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not load orders'))
  }, [client, store.id])

  const needle = query.trim().toLowerCase()
  const range =
    kind === 'yesterday'
      ? periodWindow('custom', store.timezone, shiftYmd(today, -1), shiftYmd(today, -1))
      : kind === 'week'
        ? periodWindow('week', store.timezone, '', '')
        : kind === 'month'
          ? periodWindow('month', store.timezone, '', '')
          : kind === 'custom'
            ? periodWindow('custom', store.timezone, customStart, customEnd)
            : periodWindow('today', store.timezone, '', '')
  const visible = orders.filter((order) => {
    const text = `${order.number} ${order.method} ${order.status}`.toLowerCase()
    if (needle && !text.includes(needle)) return false
    if (!range) return false
    const at = new Date(order.completedAt).getTime()
    if (Number.isNaN(at)) return false
    return at >= new Date(range.start).getTime() && at < new Date(range.end).getTime()
  })
  const ranges: { id: typeof kind; label: string }[] = [
    { id: 'today', label: 'Today' },
    { id: 'yesterday', label: 'Yesterday' },
    { id: 'week', label: 'This Week' },
    { id: 'month', label: 'This Month' },
    { id: 'custom', label: 'Custom' },
  ]

  return (
    <section className="products-screen">
      <header className="products-title split">
        <h1>Orders</h1>
        <button type="button" className="icon-btn" aria-label="Custom date" onClick={() => setKind('custom')}>
          <StudioGlyph name="calendar" />
        </button>
      </header>
      {error ? <p className="g-error products-error">{error}</p> : null}
      <div className="date-row">
        <span className="date-label">Date</span>
        {ranges.map((item) => (
          <button key={item.id} type="button" className={kind === item.id ? 'date-chip on' : 'date-chip'} onClick={() => setKind(item.id)}>
            {kind === item.id ? '✓ ' : ''}{item.label}
          </button>
        ))}
      </div>
      {kind === 'custom' ? (
        <div className="date-custom">
          <label>From<input type="date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} /></label>
          <label>To<input type="date" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} /></label>
        </div>
      ) : null}
      <div className="products-toolbar">
        <label className="products-search">
          <span className="sr">Search orders</span>
          <input value={query} placeholder="Search orders..." onChange={(event) => setQuery(event.target.value)} />
        </label>
      </div>
      <div className="products-body">
        {visible.length === 0 ? (
          <div className="products-empty">
            <StudioGlyph name="receipt" />
            <strong>{needle ? 'No orders found' : 'No orders in this period'}</strong>
            <p>{needle ? 'Try a different search.' : 'Try a different date range.'}</p>
          </div>
        ) : (
          <ul className="studio-list">
            {visible.map((order) => (
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
                  <span>{formatWhen(order.completedAt, store.timezone)} · {order.status} · {order.method || 'cash'} · {money(order.total, store.currencySymbol)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
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
    </section>
  )
}

function shiftYmd(ymd: string, days: number): string {
  const [year, month, day] = ymd.split('-').map(Number)
  const date = new Date(Date.UTC(year || 1970, (month || 1) - 1, (day || 1) + days))
  const nextMonth = String(date.getUTCMonth() + 1).padStart(2, '0')
  const nextDay = String(date.getUTCDate()).padStart(2, '0')
  return `${date.getUTCFullYear()}-${nextMonth}-${nextDay}`
}

function CustomersPane({ client, store }: { client: SupabaseClient; store: GroceryStore }) {
  const [customers, setCustomers] = useState<DeskCustomer[]>([])
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [limit, setLimit] = useState('0')
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [creditOnly, setCreditOnly] = useState(false)
  const [adding, setAdding] = useState(false)

  function reload() {
    return loadDeskCustomers(client, store.id).then(setCustomers)
  }

  useEffect(() => {
    reload().catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not load customers'))
  }, [client, store.id])

  const needle = query.trim().toLowerCase()
  const visible = customers.filter((customer) => {
    if (creditOnly && customer.creditBalance <= 0) return false
    return customer.name.toLowerCase().includes(needle) || customer.phone.toLowerCase().includes(needle)
  })

  return (
    <section className="products-screen">
      <header className="products-title">
        <h1>Customers</h1>
      </header>
      {error ? <p className="g-error products-error">{error}</p> : null}
      <div className="products-toolbar">
        <label className="products-search">
          <span className="sr">Search by name or phone</span>
          <input value={query} placeholder="Search by name or phone..." onChange={(event) => setQuery(event.target.value)} />
        </label>
        <button type="button" className="products-add" onClick={() => setAdding(true)}>
          <StudioGlyph name="person" />
          + Add customer
        </button>
      </div>
      <div className="studio-segment" role="tablist">
        <button type="button" className={creditOnly ? '' : 'on'} onClick={() => setCreditOnly(false)}>
          {creditOnly ? '' : '✓ '}All
        </button>
        <button type="button" className={creditOnly ? 'on' : ''} onClick={() => setCreditOnly(true)}>
          {creditOnly ? '✓ ' : <StudioGlyph name="wallet" />}
          Credit
        </button>
      </div>
      <div className="products-body">
        {visible.length === 0 ? (
          <div className="products-empty">
            <StudioGlyph name="people" />
            <strong>{needle || creditOnly ? 'No customers found' : 'No customers yet'}</strong>
            <p>{needle || creditOnly ? 'Try another search or the All list.' : 'Add your first customer to start tracking purchases.'}</p>
            {needle || creditOnly ? null : (
              <button type="button" className="products-add wide" onClick={() => setAdding(true)}>+ Add customer</button>
            )}
          </div>
        ) : (
          <ul className="studio-list">
            {visible.map((customer) => (
              <li key={customer.id}>
                <div>
                  <strong>{customer.name}</strong>
                  <span>
                    {customer.phone || 'No phone'} · spent {money(customer.totalSpent, store.currencySymbol)} · credit{' '}
                    {money(customer.creditBalance, store.currencySymbol)}
                  </span>
                </div>
                {customer.creditBalance > 0 ? (
                  <button
                    type="button"
                    onClick={() => {
                      const amount = window.prompt('Amount collected', String(customer.creditBalance))
                      if (amount == null) return
                      collectDeskCredit(client, store.id, customer, Number(amount) || 0, 'cash')
                        .then(reload)
                        .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not collect the payment'))
                    }}
                  >
                    Collect
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
      {adding ? (
        <div className="g-sheet-wrap" role="presentation" onClick={() => setAdding(false)}>
          <form
            className="g-sheet"
            onClick={(event) => event.stopPropagation()}
            onSubmit={(event) => {
              event.preventDefault()
              saveDeskCustomer(client, store.id, { name, phone, email: '', creditLimit: Number(limit) || 0 })
                .then(() => {
                  setName('')
                  setPhone('')
                  setLimit('0')
                  setAdding(false)
                  return reload()
                })
                .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not add the customer'))
            }}
          >
            <header className="g-sheet-head">
              <h2>Add customer</h2>
              <button type="button" className="grocery-close" onClick={() => setAdding(false)}>Close</button>
            </header>
            <label className="desk-field">Name<input value={name} required onChange={(event) => setName(event.target.value)} /></label>
            <label className="desk-field">Phone<input value={phone} onChange={(event) => setPhone(event.target.value)} /></label>
            <label className="desk-field">Credit limit<input inputMode="decimal" value={limit} onChange={(event) => setLimit(event.target.value)} /></label>
            <button type="submit" className="g-pay">Save customer</button>
          </form>
        </div>
      ) : null}
    </section>
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

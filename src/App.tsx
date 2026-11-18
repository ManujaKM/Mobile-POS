import { useEffect, useState, type FormEvent } from 'react'
import type { Session, SupabaseClient } from '@supabase/supabase-js'
import logoUrl from './assets/logo.png'
import logoDarkUrl from './assets/logo-dark.png'
import { getClient } from './client'
import { readConfig } from './config'
import {
  loadCreditCustomers,
  loadCustomers,
  loadLowStock,
  loadOrderItems,
  loadOrdersInWindow,
  loadPeriodSummary,
  loadProducts,
  loadRefunds,
  loadShifts,
  loadStores,
  loadVoids,
  type CreditCustomer,
  type CustomerRow,
  type LowStockRow,
  type OrderItemRow,
  type OrderRow,
  type PeriodSummary,
  type ProductRow,
  type RefundRow,
  type ShiftRow,
  type StoreRow,
  type VoidRow,
} from './data'
import { money, qty, setMoneyCents } from './format'
import {
  STORE_KEY,
  applyTheme,
  loadPrefs,
  readRememberedStore,
  savePrefs,
  writeRememberedStore,
  type PortalPrefs,
  type StartPeriod,
  type StartTab,
} from './prefs'
import { formatWhen, periodWindow, todayYmd, type PeriodKind, type TimeWindow } from './time'
import { downloadText, salesReportCsv, salesReportFilename } from './reportFile'
import { WaveChart } from './WaveChart'
import { GroceryHome } from './GroceryHome'
import { CategoryPick, GroceryPos } from './GroceryPos'
import type { ShopCategory } from './grocery'
import { Buying, Cash, Counts, Expiry, Promotions } from './ops'

type Tab =
  | 'dashboard'
  | 'overview'
  | 'orders'
  | 'products'
  | 'customers'
  | 'reports'
  | 'activity'
  | 'stock'
  | 'buying'
  | 'expiry'
  | 'counts'
  | 'cash'
  | 'promotions'
  | 'settings'

const NAV: { id: Tab; label: string; phone: 'bar' | 'more' }[] = [
  { id: 'dashboard', label: 'Dashboard', phone: 'bar' },
  { id: 'overview', label: 'Sales', phone: 'bar' },
  { id: 'orders', label: 'Orders', phone: 'more' },
  { id: 'products', label: 'Products', phone: 'more' },
  { id: 'customers', label: 'Customers', phone: 'more' },
  { id: 'stock', label: 'Stock', phone: 'bar' },
  { id: 'activity', label: 'Activity', phone: 'bar' },
  { id: 'buying', label: 'Buying', phone: 'more' },
  { id: 'expiry', label: 'Expiry', phone: 'more' },
  { id: 'counts', label: 'Counts', phone: 'more' },
  { id: 'cash', label: 'Cash', phone: 'more' },
  { id: 'promotions', label: 'Promotions', phone: 'more' },
  { id: 'reports', label: 'Reports', phone: 'more' },
  { id: 'settings', label: 'Settings', phone: 'more' },
]

const PERIOD_TABS: Tab[] = ['dashboard', 'overview', 'orders', 'reports', 'activity', 'buying', 'counts', 'cash']

const emptySummary = (): PeriodSummary => ({
  sales: 0,
  orderCount: 0,
  refunds: 0,
  completedCount: 0,
  cost: 0,
  profit: 0,
  tax: 0,
  discount: 0,
  payments: { cash: 0, card: 0, upi: 0, credit: 0, other: 0 },
  topItems: [],
  days: [],
})

export function App() {
  applyTheme(loadPrefs().theme)
  const client = getClient()
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)
  const [recovery, setRecovery] = useState(false)

  useEffect(() => {
    if (!client) {
      setReady(true)
      return
    }
    let active = true
    client.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      setReady(true)
    })
    const { data } = client.auth.onAuthStateChange((event, next) => {
      setSession(next)
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
    })
    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [client])

  if (!ready) {
    return (
      <main className="gate">
        <Preloader label="Opening Mentura POS" />
        <Credit />
      </main>
    )
  }

  if (!client || !readConfig()) {
    return (
      <main className="gate">
        <section className="card narrow">
          <Mark />
          <h1>Portal is not configured</h1>
          <p>
            Add the mentura-ops URL and public anon key to .env, then restart the site.
          </p>
        </section>
        <Credit />
      </main>
    )
  }

  if (recovery) {
    return <Recovery client={client} onDone={() => setRecovery(false)} />
  }

  if (!session) {
    return <Login client={client} />
  }

  return (
    <ShopHome
      client={client}
      email={session.user.email ?? ''}
      onSignOut={() => {
        void client.auth.signOut()
      }}
    />
  )
}

function ShopHome({
  client,
  email,
  onSignOut,
}: {
  client: SupabaseClient
  email: string
  onSignOut: () => void
}) {
  const [category, setCategory] = useState<ShopCategory | null>(null)
  const [screen, setScreen] = useState<'pos' | 'portal'>('pos')
  if (!category) {
    return <CategoryPick client={client} onSignOut={onSignOut} onChoose={setCategory} />
  }
  if (screen === 'portal') {
    return (
      <div className="portal-wrap">
        <button type="button" className="portal-back" onClick={() => setScreen('pos')}>
          Back to till
        </button>
        <Dashboard client={client} email={email} onSignOut={onSignOut} />
      </div>
    )
  }
  if (category === 'grocery') {
    return <GroceryHome client={client} onSignOut={onSignOut} onOpenPortal={() => setScreen('portal')} />
  }
  return (
    <GroceryPos
      client={client}
      category={category}
      onSignOut={onSignOut}
      onOpenPortal={() => setScreen('portal')}
    />
  )
}

function currentLogo() {
  return loadPrefs().theme === 'dark' ? logoDarkUrl : logoUrl
}

function Mark() {
  return <img className="brand-logo" src={currentLogo()} alt="Mentura POS" />
}

function Credit() {
  return (
    <p className="credit">
      Mentura POS™ - Powered by{' '}
      <a href="https://menturaglobal.com/" target="_blank" rel="noopener noreferrer">
        Mentura Global (Pvt) Ltd.
      </a>
    </p>
  )
}

function Preloader({ label }: { label: string }) {
  return (
    <div className="preloader" role="status" aria-live="polite">
      <img className="preloader-logo" src={currentLogo()} alt="" />
      <div className="preloader-bar" aria-hidden="true">
        <span />
      </div>
      <p>{label}</p>
    </div>
  )
}

function MoreIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 7h12M6 12h12M6 17h12" />
    </svg>
  )
}

function NavIcon({ name }: { name: Tab }) {
  const paths: Record<Tab, string> = {
    dashboard: 'M4 13a8 8 0 0 1 16 0M4 13c2-3 4-4 8-4s6 1 8 4M8 17h.01M12 16h.01M16 17h.01',
    overview: 'M4 19V5h16v14H4Zm3-3h4M7 12h10M7 8h10',
    orders: 'M6 4h12v16H6V4Zm2 4h8M8 12h8M8 16h5',
    products: 'M4 7h16v12H4V7Zm4-3h8v3H8V4Z',
    customers: 'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7 0a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM4 19c0-2.5 2.2-4 5-4s5 1.5 5 4M14 15c1.8 0 4 .9 4 3',
    reports: 'M6 3h8l4 4v14H6V3Zm8 0v4h4M8 12h8M8 16h6',
    activity: 'M8 7h8M8 12h8M8 17h5M5 3h14v18H5V3Z',
    stock: 'M4 7.5 12 4l8 3.5L12 11 4 7.5Zm0 4.5 8 3.5 8-3.5M4 16.5 12 20l8-3.5',
    buying: 'M3 7h13l2 4h3v6h-2.2a2.2 2.2 0 0 1-4.1 0H9.3a2.2 2.2 0 0 1-4.1 0H3V7Zm2.2 8.2a1 1 0 1 0 0 2 1 1 0 0 0 0-2Zm9.8 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z',
    expiry: 'M7 3v3M17 3v3M4 8h16M6 5h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z',
    counts: 'M8 4h8v3H8V4ZM6 7h12v13H6V7Zm3 4h6M9 14h6M9 17h4',
    cash: 'M4 7h16v10H4V7Zm0 3h16M7 14h3',
    promotions: 'M4 12 12 4h7v7l-8 8-7-7Zm11.5-4.5h.01',
    settings: 'M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4ZM12 3.5v2.1M12 18.4v2.1M4.8 6.2l1.6 1.4M17.6 16.4l1.6 1.4M3.5 12h2.1M18.4 12h2.1M4.8 17.8l1.6-1.4M17.6 7.6l1.6-1.4',
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={paths[name]} />
    </svg>
  )
}

function Login({ client }: { client: SupabaseClient }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [mode, setMode] = useState<'sign-in' | 'reset' | 'sign-up'>('sign-in')

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setNotice('')
    setBusy(true)
    try {
      if (mode === 'reset') {
        const redirectTo = window.location.href.split('#')[0]
        const { error: resetError } = await client.auth.resetPasswordForEmail(email.trim(), { redirectTo })
        if (resetError) throw resetError
        setNotice('If that email is a Mentura Cloud account, a reset link is on its way.')
        return
      }
      if (mode === 'sign-up') {
        if (password.length < 6) throw new Error('Use a password of at least 6 characters')
        const { data, error: signUpError } = await client.auth.signUp({
          email: email.trim(),
          password,
        })
        if (signUpError) throw signUpError
        if (!data.session) {
          setNotice('Account created. Confirm the email if Mentura Cloud asks, then sign in and choose a category.')
          setMode('sign-in')
        }
        return
      }
      const { error: signInError } = await client.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (signInError) throw signInError
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="gate auth-screen">
      <section className="card narrow">
        <Mark />
        <h1>{mode === 'sign-up' ? 'Create account' : mode === 'sign-in' ? 'Sign in' : 'Reset password'}</h1>
        <p className="lede">
          {mode === 'sign-up'
            ? 'Use an email and password for this till. After sign-in, choose grocery, textile, or another category.'
            : 'Use the email and password from Mentura Cloud on the shop till. Staff PIN codes stay on the till.'}
        </p>
        <form onSubmit={onSubmit} className="stack">
          <label>
            Email
            <input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          {mode === 'reset' ? null : (
            <label>
              Password
              <input
                type="password"
                autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'}
                required
                minLength={mode === 'sign-up' ? 6 : undefined}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
          )}
          {error ? <p className="error">{error}</p> : null}
          {notice ? <p className="notice">{notice}</p> : null}
          <button type="submit" className="primary" disabled={busy}>
            {busy ? 'Please wait…' : mode === 'sign-up' ? 'Create account' : mode === 'sign-in' ? 'Sign in' : 'Send reset link'}
          </button>
        </form>
        <button
          type="button"
          className="text"
          onClick={() => {
            setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')
            setError('')
            setNotice('')
          }}
        >
          {mode === 'sign-in' ? 'Create account' : 'Back to sign in'}
        </button>
        {mode === 'sign-in' ? (
          <button
            type="button"
            className="text"
            onClick={() => {
              setMode('reset')
              setError('')
              setNotice('')
            }}
          >
            Forgot password
          </button>
        ) : null}
      </section>
      <Credit />
    </main>
  )
}

function Recovery({ client, onDone }: { client: SupabaseClient; onDone: () => void }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    const { error: updateError } = await client.auth.updateUser({ password })
    setBusy(false)
    if (updateError) {
      setError(updateError.message)
      return
    }
    onDone()
  }

  return (
    <main className="gate auth-screen">
      <section className="card narrow">
        <Mark />
        <h1>Choose a new password</h1>
        <form onSubmit={onSubmit} className="stack">
          <label>
            New password
            <input
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          {error ? <p className="error">{error}</p> : null}
          <button type="submit" className="primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save password'}
          </button>
        </form>
      </section>
      <Credit />
    </main>
  )
}

function Dashboard({
  client,
  email,
  onSignOut,
}: {
  client: SupabaseClient
  email: string
  onSignOut: () => void
}) {
  const [stores, setStores] = useState<StoreRow[]>([])
  const [storeId, setStoreId] = useState('')
  const [prefs, setPrefs] = useState<PortalPrefs>(() => loadPrefs())
  const [tab, setTab] = useState<Tab>(() => loadPrefs().startTab)
  const [moreOpen, setMoreOpen] = useState(false)
  const [period, setPeriod] = useState<PeriodKind>(() => loadPrefs().startPeriod)
  const [rangeStart, setRangeStart] = useState('')
  const [rangeEnd, setRangeEnd] = useState('')
  const [bootError, setBootError] = useState('')
  const [loadingStores, setLoadingStores] = useState(true)

  useEffect(() => {
    let active = true
    loadStores(client)
      .then((rows) => {
        if (!active) return
        setStores(rows)
        const saved = readRememberedStore(loadPrefs().rememberStore)
        const pick = rows.find((store) => store.id === saved) ?? rows[0]
        setStoreId(pick?.id ?? '')
        if (pick?.id) writeRememberedStore(pick.id, loadPrefs().rememberStore)
      })
      .catch((err: unknown) => {
        if (!active) return
        setBootError(err instanceof Error ? err.message : 'Could not load stores')
      })
      .finally(() => {
        if (active) setLoadingStores(false)
      })
    return () => {
      active = false
    }
  }, [client])

  setMoneyCents(prefs.showCents)
  applyTheme(prefs.theme)

  function patchPrefs(patch: Partial<PortalPrefs>) {
    setPrefs((current) => {
      const next = { ...current, ...patch }
      savePrefs(next)
      if (patch.rememberStore === false) localStorage.removeItem(STORE_KEY)
      if (patch.rememberStore === true && storeId) writeRememberedStore(storeId, true)
      return next
    })
  }

  const store = stores.find((row) => row.id === storeId) ?? null
  const range = store ? periodWindow(period, store.timezone, rangeStart, rangeEnd) : null

  useEffect(() => {
    if (!store) return
    const ymd = todayYmd(store.timezone)
    setRangeStart((current) => current || ymd)
    setRangeEnd((current) => current || ymd)
  }, [store])

  return (
    <div className="app">
      <aside className="sidebar">
        <Mark />
        <nav className="nav" aria-label="Portal sections">
          {NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              className={
                tab === item.id
                  ? `nav-item active${item.phone === 'more' ? ' phone-more' : ''}`
                  : `nav-item${item.phone === 'more' ? ' phone-more' : ''}`
              }
              onClick={() => {
                setTab(item.id)
                setMoreOpen(false)
              }}
            >
              <NavIcon name={item.id} />
              {item.label}
            </button>
          ))}
          <button
            type="button"
            className={
              moreOpen || NAV.some((item) => item.phone === 'more' && item.id === tab)
                ? 'nav-item more-toggle active'
                : 'nav-item more-toggle'
            }
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen((open) => !open)}
          >
            <MoreIcon />
            More
          </button>
        </nav>
        {moreOpen ? (
          <div className="more-sheet" role="menu">
            {NAV.filter((item) => item.phone === 'more').map((item) => (
              <button
                key={item.id}
                type="button"
                className={tab === item.id ? 'more-item active' : 'more-item'}
                onClick={() => {
                  setTab(item.id)
                  setMoreOpen(false)
                }}
              >
                <NavIcon name={item.id} />
                {item.label}
              </button>
            ))}
            <div className="more-account">
              <p className="more-email" title={email}>
                {email}
              </p>
              <button type="button" className="more-signout" onClick={onSignOut}>
                Sign out
              </button>
            </div>
          </div>
        ) : null}
        <div className="account">
          <p className="email" title={email}>
            {email}
          </p>
          <button type="button" className="ghost" onClick={onSignOut}>
            Sign out
          </button>
        </div>
      </aside>
      <div className="main">
        <header className="top">
          <div className="title-block">
            <img className="brand-logo mobile-only" src={currentLogo()} alt="Mentura POS" />
            <div className="title-copy">
              <p className="kicker">Owner portal</p>
              <h1>{store?.name ?? 'Your stores'}</h1>
              {stores.length > 1 ? (
                <label className="inline">
                  Store
                  <select
                    value={storeId}
                    onChange={(event) => {
                      setStoreId(event.target.value)
                      writeRememberedStore(event.target.value, prefs.rememberStore)
                    }}
                  >
                    {stores.map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>
          </div>
        </header>
        {loadingStores ? <Preloader label="Opening your store" /> : null}
        {bootError ? <p className="error">{bootError}</p> : null}
        {!loadingStores && !bootError && stores.length === 0 ? (
          <section className="card">
            <h2>No store yet</h2>
            <p>
              This account has no shop in Mentura Cloud. Sign in to Mentura Cloud on the till and let it sync once. This
              page will then show that store.
            </p>
          </section>
        ) : null}
        {store && PERIOD_TABS.includes(tab) ? (
          <PeriodBar
            period={period}
            start={rangeStart}
            end={rangeEnd}
            onPeriod={setPeriod}
            onStart={setRangeStart}
            onEnd={setRangeEnd}
          />
        ) : null}
        {store && tab === 'dashboard' ? <Home client={client} store={store} range={range} onOpen={setTab} /> : null}
        {store && tab === 'overview' ? <Overview client={client} store={store} range={range} /> : null}
        {store && tab === 'orders' ? <Orders client={client} store={store} range={range} /> : null}
        {store && tab === 'products' ? <Products client={client} store={store} /> : null}
        {store && tab === 'customers' ? <Customers client={client} store={store} /> : null}
        {store && tab === 'reports' ? <Reports client={client} store={store} range={range} /> : null}
        {store && tab === 'activity' ? <Activity client={client} store={store} range={range} /> : null}
        {store && tab === 'stock' ? <Stock client={client} store={store} /> : null}
        {store && tab === 'buying' ? <Buying client={client} store={store} range={range} /> : null}
        {store && tab === 'expiry' ? <Expiry client={client} store={store} /> : null}
        {store && tab === 'counts' ? <Counts client={client} store={store} range={range} /> : null}
        {store && tab === 'cash' ? <Cash client={client} store={store} range={range} /> : null}
        {store && tab === 'promotions' ? <Promotions client={client} store={store} /> : null}
        {tab === 'settings' ? <Settings prefs={prefs} onChange={patchPrefs} /> : null}
        <footer className="sync-note">
          Figures match the last upload from the shop till. If the till is offline, this is not the live drawer.
          <Credit />
        </footer>
      </div>
    </div>
  )
}

function PeriodBar({
  period,
  start,
  end,
  onPeriod,
  onStart,
  onEnd,
}: {
  period: PeriodKind
  start: string
  end: string
  onPeriod: (period: PeriodKind) => void
  onStart: (value: string) => void
  onEnd: (value: string) => void
}) {
  const choices: { id: PeriodKind; label: string }[] = [
    { id: 'today', label: 'Today' },
    { id: 'week', label: 'This week' },
    { id: 'month', label: 'This month' },
    { id: 'custom', label: 'Custom' },
  ]
  return (
    <div className="period">
      <div className="chips" role="tablist" aria-label="Time period">
        {choices.map((choice) => (
          <button
            key={choice.id}
            type="button"
            className={period === choice.id ? 'chip active' : 'chip'}
            onClick={() => onPeriod(choice.id)}
          >
            {choice.label}
          </button>
        ))}
      </div>
      {period === 'custom' ? (
        <div className="dates">
          <label>
            From
            <input type="date" value={start} onChange={(event) => onStart(event.target.value)} />
          </label>
          <label>
            To
            <input type="date" value={end} onChange={(event) => onEnd(event.target.value)} />
          </label>
        </div>
      ) : null}
    </div>
  )
}

function Home({
  client,
  store,
  range,
  onOpen,
}: {
  client: SupabaseClient
  store: StoreRow
  range: TimeWindow | null
  onOpen: (tab: Tab) => void
}) {
  const [summary, setSummary] = useState<PeriodSummary>(emptySummary)
  const [productCount, setProductCount] = useState(0)
  const [restockCount, setRestockCount] = useState(0)
  const [restock, setRestock] = useState<ProductRow[]>([])
  const [customerCount, setCustomerCount] = useState(0)
  const [recent, setRecent] = useState<OrderRow[]>([])
  const [names, setNames] = useState<Map<string, string>>(new Map())
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
    Promise.all([
      loadPeriodSummary(client, store.id, range, store.timezone),
      loadProducts(client, store.id),
      loadCustomers(client, store.id),
      loadOrdersInWindow(client, store.id, range),
    ])
      .then(([next, products, customers, orders]) => {
        if (!active) return
        setSummary(next)
        setProductCount(products.filter((row) => row.is_active).length)
        const low = products
          .filter((row) => row.is_active && row.stock_qty <= row.reorder_point)
          .sort((a, b) => a.stock_qty - b.stock_qty)
        setRestockCount(low.length)
        setRestock(low.slice(0, 8))
        setCustomerCount(customers.length)
        setNames(new Map(customers.map((row) => [row.local_id, row.name])))
        setRecent(orders.slice(0, 8))
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : 'Could not load the dashboard')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [client, store.id, store.timezone, range?.start, range?.end])

  const bestSeller = [...summary.topItems].sort((a, b) => b.quantity - a.quantity || b.total - a.total)[0] ?? null

  return (
    <section className="panel">
      {loading ? <Preloader label="Loading your dashboard" /> : <h2>Dashboard</h2>}
      {!range ? <p className="muted">Choose a start date and an end date.</p> : null}
      {error ? <p className="error">{error}</p> : null}
      {range && !loading ? (
        <>
          <div className="stats">
            <article className="card stat">
              <p>Completed orders</p>
              <strong>{summary.completedCount}</strong>
              <span>Finished in this period</span>
            </article>
            <article className="card stat">
              <p>Sales</p>
              <strong>{money(summary.sales, symbol)}</strong>
              <span>{customerCount} customers on file</span>
            </article>
            <article className="card stat">
              <p>Net profit</p>
              <strong>{money(summary.profit, symbol)}</strong>
              <span>After refunds and item cost</span>
            </article>
            <article className="card stat">
              <p>Total cost</p>
              <strong>{money(summary.cost, symbol)}</strong>
              <span>{productCount} active products</span>
            </article>
          </div>
          <article className="card chart-card">
            <div className="section-head">
              <div>
                <h3>Period performance</h3>
                <p className="muted">Sales and profit across the days you selected</p>
              </div>
            </div>
            <div className="chart-layout">
              <WaveChart points={summary.days} />
              <div className="monitors">
                <div className="monitor">
                  <p>Refunds</p>
                  <strong>{money(summary.refunds, symbol)}</strong>
                </div>
                <div className="monitor">
                  <p>Discount</p>
                  <strong>{money(summary.discount, symbol)}</strong>
                </div>
                <div className="monitor">
                  <p>Tax</p>
                  <strong>{money(summary.tax, symbol)}</strong>
                </div>
                <div className="monitor">
                  <p>Cash</p>
                  <strong>{money(summary.payments.cash, symbol)}</strong>
                </div>
                <div className="monitor">
                  <p>Card</p>
                  <strong>{money(summary.payments.card, symbol)}</strong>
                </div>
                <div className="monitor">
                  <p>UPI</p>
                  <strong>{money(summary.payments.upi, symbol)}</strong>
                </div>
              </div>
            </div>
          </article>
          <article className="card bestseller">
            <div>
              <p>Most sold</p>
              <strong>{bestSeller ? bestSeller.name : 'No product sales'}</strong>
              <span>
                {bestSeller
                  ? `${qty(bestSeller.quantity)} sold in this period · ${money(bestSeller.total, symbol)}`
                  : 'Nothing sold in this period'}
              </span>
            </div>
            {bestSeller ? <em>Fastest</em> : null}
          </article>
          <div className="split-layout">
            <article className="card">
              <div className="section-head">
                <h3>Needs restock</h3>
                <button type="button" className="text" onClick={() => onOpen('products')}>
                  Products
                </button>
              </div>
              <p className="muted">{restockCount} products at or under the reorder point</p>
              {restock.length === 0 ? <p className="muted top-gap">Nothing needs restocking.</p> : null}
              {restock.length > 0 ? (
                <div className="table-wrap inset">
                  <table>
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th className="num">On hand</th>
                      </tr>
                    </thead>
                    <tbody>
                      {restock.map((row) => (
                        <tr key={row.id}>
                          <td>{row.name}</td>
                          <td className={row.stock_qty <= 0 ? 'num out' : 'num'}>{row.stock_qty <= 0 ? 'Out' : qty(row.stock_qty)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </article>
            <article className="card">
              <div className="section-head">
                <h3>Recent orders</h3>
                <button type="button" className="text" onClick={() => onOpen('orders')}>
                  Orders
                </button>
              </div>
              {recent.length === 0 ? <p className="muted top-gap">No orders in this period.</p> : null}
              {recent.length > 0 ? (
                <div className="table-wrap inset">
                  <table>
                    <thead>
                      <tr>
                        <th>When</th>
                        <th>Customer</th>
                        <th>Status</th>
                        <th className="num">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recent.map((order) => (
                        <tr key={order.id}>
                          <td>{formatWhen(order.completed_at, store.timezone)}</td>
                          <td>{(order.customer_local_id && names.get(order.customer_local_id)) || 'Walk-in'}</td>
                          <td>{order.status}</td>
                          <td className="num price">{money(order.total, symbol)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </article>
          </div>
        </>
      ) : null}
    </section>
  )
}

function LegalNotice({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="legal-screen" role="dialog" aria-modal="true" aria-labelledby="legal-title">
      <header className="legal-mast">
        <p>Mentura Global (Pvt) Ltd.</p>
        <button type="button" className="legal-close" onClick={onClose}>
          Close
        </button>
      </header>
      <div className="legal-scroll">
        <article className="legal-doc">
          <p className="legal-kicker">Legal notice</p>
          <h1 id="legal-title">Privacy Policy</h1>
          <p className="legal-meta">© 2026 Mentura Global (Pvt) Ltd. All Rights Reserved.</p>
          <ol>
            <li>
              Mentura POS™ is a proprietary software product of Mentura Global (Pvt) Ltd. All software, source code,
              system architecture, user interface, designs, graphics, documentation, content, trademarks, service marks,
              and other intellectual property associated with Mentura POS are owned by or licensed to Mentura Global
              (Pvt) Ltd and are protected by applicable intellectual property and other laws.
            </li>
            <li>
              Unauthorised copying, reproduction, modification, distribution, resale, reverse engineering, decompilation,
              extraction, or commercial exploitation of any part of this software or its associated materials is
              prohibited, except as expressly permitted by a valid licence or applicable law.
            </li>
          </ol>
          <p className="legal-sign">
            Mentura POS™ - Powered by{' '}
            <a href="https://menturaglobal.com/" target="_blank" rel="noopener noreferrer">
              Mentura Global (Pvt) Ltd.
            </a>
          </p>
        </article>
      </div>
    </div>
  )
}

function Settings({ prefs, onChange }: { prefs: PortalPrefs; onChange: (patch: Partial<PortalPrefs>) => void }) {
  const [legalOpen, setLegalOpen] = useState(false)
  const screens: { id: StartTab; label: string }[] = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'overview', label: 'Sales' },
    { id: 'orders', label: 'Orders' },
    { id: 'products', label: 'Products' },
  ]
  const periods: { id: StartPeriod; label: string }[] = [
    { id: 'today', label: 'Today' },
    { id: 'week', label: 'This week' },
    { id: 'month', label: 'This month' },
  ]
  return (
    <section className="panel">
      <div>
        <h2>Settings</h2>
        <p className="lede">These change how this portal opens on this device. The shop till is unchanged.</p>
      </div>
      <article className="card settings-card">
        <h3>When you open</h3>
        <p className="muted">Used the next time you sign in on this browser.</p>
        <p className="setting-label">First screen</p>
        <div className="chips">
          {screens.map((choice) => (
            <button
              key={choice.id}
              type="button"
              className={prefs.startTab === choice.id ? 'chip active' : 'chip'}
              onClick={() => onChange({ startTab: choice.id })}
            >
              {choice.label}
            </button>
          ))}
        </div>
        <p className="setting-label">Period</p>
        <div className="chips">
          {periods.map((choice) => (
            <button
              key={choice.id}
              type="button"
              className={prefs.startPeriod === choice.id ? 'chip active' : 'chip'}
              onClick={() => onChange({ startPeriod: choice.id })}
            >
              {choice.label}
            </button>
          ))}
        </div>
      </article>
      <article className="card settings-card">
        <h3>Appearance</h3>
        <p className="muted">Light is the default.</p>
        <div className="chips top-gap">
          <button
            type="button"
            className={prefs.theme === 'light' ? 'chip active' : 'chip'}
            onClick={() => onChange({ theme: 'light' })}
          >
            Light
          </button>
          <button
            type="button"
            className={prefs.theme === 'dark' ? 'chip active' : 'chip'}
            onClick={() => onChange({ theme: 'dark' })}
          >
            Dark
          </button>
        </div>
      </article>
      <article className="card settings-card">
        <h3>Figures</h3>
        <div className="setting-row">
          <div>
            <p className="setting-title">Show cents</p>
            <p className="muted">{prefs.showCents ? 'Rs1,250.00' : 'Rs1,250'}</p>
          </div>
          <button
            type="button"
            className={prefs.showCents ? 'switch on' : 'switch'}
            role="switch"
            aria-checked={prefs.showCents}
            aria-label="Show cents"
            onClick={() => onChange({ showCents: !prefs.showCents })}
          >
            <i />
          </button>
        </div>
      </article>
      <article className="card settings-card">
        <h3>This browser</h3>
        <div className="setting-row">
          <div>
            <p className="setting-title">Remember the last store</p>
            <p className="muted">The next visit opens the store you used last.</p>
          </div>
          <button
            type="button"
            className={prefs.rememberStore ? 'switch on' : 'switch'}
            role="switch"
            aria-checked={prefs.rememberStore}
            aria-label="Remember the last store"
            onClick={() => onChange({ rememberStore: !prefs.rememberStore })}
          >
            <i />
          </button>
        </div>
      </article>
      <article className="card settings-card">
        <h3>Legal</h3>
        <button type="button" className="legal-link" onClick={() => setLegalOpen(true)}>
          <span>
            <span className="setting-title">Privacy Policy</span>
            <span className="muted">Proprietary rights of Mentura Global (Pvt) Ltd.</span>
          </span>
          <span aria-hidden="true">›</span>
        </button>
      </article>
      {legalOpen ? <LegalNotice onClose={() => setLegalOpen(false)} /> : null}
    </section>
  )
}

function Products({ client, store }: { client: SupabaseClient; store: StoreRow }) {
  const [rows, setRows] = useState<ProductRow[]>([])
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const symbol = store.currency_symbol

  useEffect(() => {
    let active = true
    setLoading(true)
    loadProducts(client, store.id)
      .then((list) => {
        if (active) setRows(list)
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : 'Could not load products')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [client, store.id])

  const needle = query.trim().toLowerCase()
  const visible = rows.filter((row) => {
    if (!needle) return true
    return row.name.toLowerCase().includes(needle) || (row.barcode ?? '').toLowerCase().includes(needle)
  })

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Products</h2>
        <input className="search" value={query} placeholder="Search name or barcode" onChange={(event) => setQuery(event.target.value)} />
      </div>
      {error ? <p className="error">{error}</p> : null}
      {loading ? <p className="muted">Loading products…</p> : null}
      {!loading && visible.length === 0 ? <p className="muted">No products match.</p> : null}
      {visible.length > 0 ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Barcode</th>
                <th className="num">Price</th>
                <th className="num">On hand</th>
                <th>Unit</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr key={row.id}>
                  <td>{row.name}</td>
                  <td>{row.barcode ?? '—'}</td>
                  <td className="num price">{money(row.price, symbol)}</td>
                  <td className="num">{qty(row.stock_qty)}</td>
                  <td>{row.unit}</td>
                  <td>{row.is_active ? 'Active' : 'Inactive'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  )
}

function Customers({ client, store }: { client: SupabaseClient; store: StoreRow }) {
  const [rows, setRows] = useState<CustomerRow[]>([])
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const symbol = store.currency_symbol

  useEffect(() => {
    let active = true
    setLoading(true)
    loadCustomers(client, store.id)
      .then((list) => {
        if (active) setRows(list)
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : 'Could not load customers')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [client, store.id])

  const needle = query.trim().toLowerCase()
  const visible = rows.filter((row) => {
    if (!needle) return true
    return (
      row.name.toLowerCase().includes(needle) ||
      (row.phone ?? '').toLowerCase().includes(needle) ||
      (row.email ?? '').toLowerCase().includes(needle)
    )
  })

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Customers</h2>
        <input className="search" value={query} placeholder="Search name, phone, or email" onChange={(event) => setQuery(event.target.value)} />
      </div>
      {error ? <p className="error">{error}</p> : null}
      {loading ? <p className="muted">Loading customers…</p> : null}
      {!loading && visible.length === 0 ? <p className="muted">No customers match.</p> : null}
      {visible.length > 0 ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Phone</th>
                <th>Email</th>
                <th className="num">Spent</th>
                <th className="num">Credit</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr key={row.id}>
                  <td>{row.name}</td>
                  <td>{row.phone ?? '—'}</td>
                  <td>{row.email ?? '—'}</td>
                  <td className="num price">{money(row.total_spent, symbol)}</td>
                  <td className="num">{money(row.credit_balance, symbol)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  )
}

function Reports({
  client,
  store,
  range,
}: {
  client: SupabaseClient
  store: StoreRow
  range: TimeWindow | null
}) {
  const [summary, setSummary] = useState<PeriodSummary>(emptySummary)
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [refunds, setRefunds] = useState<RefundRow[]>([])
  const [customerNames, setCustomerNames] = useState<Map<string, string>>(new Map())
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
    Promise.all([
      loadPeriodSummary(client, store.id, range, store.timezone),
      loadOrdersInWindow(client, store.id, range),
      loadRefunds(client, store.id, range),
      loadCustomers(client, store.id),
    ])
      .then(([next, nextOrders, nextRefunds, customers]) => {
        if (!active) return
        setSummary(next)
        setOrders(nextOrders)
        setRefunds(nextRefunds)
        setCustomerNames(new Map(customers.map((row) => [row.local_id, row.name])))
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : 'Could not load the report')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [client, store.id, store.timezone, range?.start, range?.end])

  function downloadReport() {
    if (!range) return
    const csv = salesReportCsv({
      store,
      range,
      summary,
      orders,
      refunds,
      customerNames,
    })
    downloadText(salesReportFilename(store.name, range, store.timezone), csv)
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Reports</h2>
        <button type="button" className="ghost" onClick={downloadReport} disabled={loading || !range}>
          Download report
        </button>
      </div>
      {!range ? <p className="muted">Choose a start date and an end date.</p> : null}
      {error ? <p className="error">{error}</p> : null}
      {loading ? <p className="muted">Loading report…</p> : null}
      {range && !loading ? (
        <>
          <div className="metrics">
            <article className="card metric">
              <p>Sales</p>
              <strong className="price">{money(summary.sales, symbol)}</strong>
              <span>{summary.orderCount} orders</span>
            </article>
            <article className="card metric">
              <p>Tax</p>
              <strong className="price">{money(summary.tax, symbol)}</strong>
              <span>Discount {money(summary.discount, symbol)}</span>
            </article>
            <article className="card metric">
              <p>Refunds</p>
              <strong className="price">{money(summary.refunds, symbol)}</strong>
              <span>In this period</span>
            </article>
            <article className="card metric">
              <p>Net profit</p>
              <strong className="price">{money(summary.profit, symbol)}</strong>
              <span>Cost {money(summary.cost, symbol)}</span>
            </article>
            <article className="card metric">
              <p>Cash</p>
              <strong className="price">{money(summary.payments.cash, symbol)}</strong>
              <span>Card {money(summary.payments.card, symbol)}</span>
            </article>
            <article className="card metric">
              <p>UPI</p>
              <strong className="price">{money(summary.payments.upi, symbol)}</strong>
              <span>
                Credit {money(summary.payments.credit, symbol)} · Other {money(summary.payments.other, symbol)}
              </span>
            </article>
          </div>
          <article className="card">
            <h3>Sales by day</h3>
            <div className="table-wrap inset">
              <table>
                <thead>
                  <tr>
                    <th>Day</th>
                    <th className="num">Sales</th>
                    <th className="num">Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.days.map((day) => (
                    <tr key={day.key}>
                      <td>{day.label}</td>
                      <td className="num price">{money(day.total, symbol)}</td>
                      <td className="num price">{money(day.profit, symbol)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
          <article className="card">
            <h3>Fast selling</h3>
            <p className="muted">Ranked by quantity in this period. The fastest are highlighted.</p>
            {summary.topItems.length === 0 ? <p className="muted top-gap">No item sales in this period.</p> : null}
            <ol className="fast-list">
              {[...summary.topItems]
                .sort((a, b) => b.quantity - a.quantity || b.total - a.total)
                .slice(0, 6)
                .map((item, index, list) => {
                  const peak = list[0]?.quantity ?? 1
                  const share = peak > 0 ? item.quantity / peak : 0
                  const tone = index === 0 ? 'lead' : share >= 0.65 ? 'hot' : ''
                  return (
                    <li key={item.name} className={tone ? `fast-row ${tone}` : 'fast-row'}>
                      <span className="fast-rank">{index + 1}</span>
                      <div>
                        <p className="fast-name">
                          {item.name}
                          {index === 0 ? <em>Fastest</em> : tone === 'hot' ? <em>Fast</em> : null}
                        </p>
                        <div className="fast-bar" aria-hidden="true">
                          <span style={{ width: `${Math.max(8, Math.round(share * 100))}%` }} />
                        </div>
                      </div>
                      <div className="fast-qty">
                        <strong>{qty(item.quantity)}</strong>
                        <small>{money(item.total, symbol)}</small>
                      </div>
                    </li>
                  )
                })}
            </ol>
          </article>
          <article className="card">
            <h3>Top items</h3>
            {summary.topItems.length === 0 ? <p className="muted top-gap">No item sales in this period.</p> : null}
            <ul className="lines">
              {[...summary.topItems]
                .sort((a, b) => b.total - a.total)
                .slice(0, 8)
                .map((item) => (
                  <li key={item.name}>
                    <span>
                      {item.name}
                      <small>{qty(item.quantity)} sold</small>
                    </span>
                    <strong className="price">{money(item.total, symbol)}</strong>
                  </li>
                ))}
            </ul>
          </article>
        </>
      ) : null}
    </section>
  )
}

function Overview({
  client,
  store,
  range,
}: {
  client: SupabaseClient
  store: StoreRow
  range: TimeWindow | null
}) {
  const [summary, setSummary] = useState<PeriodSummary>(emptySummary)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!range) {
      setLoading(false)
      return
    }
    let active = true
    setLoading(true)
    setError('')
    loadPeriodSummary(client, store.id, range, store.timezone)
      .then((next) => {
        if (active) setSummary(next)
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : 'Could not load sales')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [client, store.id, range?.start, range?.end, tick])

  const symbol = store.currency_symbol
  const average = summary.orderCount > 0 ? summary.sales / summary.orderCount : 0

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Sales</h2>
        <button type="button" className="ghost" onClick={() => setTick((value) => value + 1)} disabled={loading || !range}>
          Refresh
        </button>
      </div>
      {!range ? <p className="muted">Choose a start date and an end date.</p> : null}
      {error ? <p className="error">{error}</p> : null}
      {loading ? <p className="muted">Loading sales…</p> : null}
      {range ? (
        <>
          <div className="metrics">
            <article className="card metric">
              <p>Sales</p>
              <strong className="price">{money(summary.sales, symbol)}</strong>
              <span>{summary.orderCount} orders</span>
            </article>
            <article className="card metric">
              <p>Average order</p>
              <strong className="price">{money(average, symbol)}</strong>
              <span>Sales divided by orders</span>
            </article>
            <article className="card metric">
              <p>Refunds</p>
              <strong className="price">{money(summary.refunds, symbol)}</strong>
              <span>From refund records</span>
            </article>
            <article className="card metric">
              <p>Discount / tax</p>
              <strong className="price">{money(summary.discount, symbol)}</strong>
              <span>Tax {money(summary.tax, symbol)}</span>
            </article>
          </div>
          <div className="split-layout">
            <article className="card">
              <h3>By payment</h3>
              <ul className="split">
                <li>
                  <span>Cash</span>
                  <strong className="price">{money(summary.payments.cash, symbol)}</strong>
                </li>
                <li>
                  <span>Card</span>
                  <strong className="price">{money(summary.payments.card, symbol)}</strong>
                </li>
                <li>
                  <span>UPI</span>
                  <strong className="price">{money(summary.payments.upi, symbol)}</strong>
                </li>
                {summary.payments.credit > 0 ? (
                  <li>
                    <span>Credit</span>
                    <strong className="price">{money(summary.payments.credit, symbol)}</strong>
                  </li>
                ) : null}
                {summary.payments.other > 0 ? (
                  <li>
                    <span>Mixed</span>
                    <strong className="price">{money(summary.payments.other, symbol)}</strong>
                  </li>
                ) : null}
              </ul>
            </article>
            <article className="card">
              <h3>Top items</h3>
              {summary.topItems.length === 0 ? <p className="muted top-gap">No item sales in this period.</p> : null}
              <ul className="lines">
                {summary.topItems.map((item) => (
                  <li key={item.name}>
                    <span>
                      {item.name}
                      <small>{qty(item.quantity)} sold</small>
                    </span>
                    <strong className="price">{money(item.total, symbol)}</strong>
                  </li>
                ))}
              </ul>
            </article>
          </div>
        </>
      ) : null}
    </section>
  )
}

function Orders({
  client,
  store,
  range,
}: {
  client: SupabaseClient
  store: StoreRow
  range: TimeWindow | null
}) {
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [selected, setSelected] = useState<string>('')
  const [items, setItems] = useState<OrderItemRow[]>([])
  const [error, setError] = useState('')
  const [itemError, setItemError] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadingItems, setLoadingItems] = useState(false)

  useEffect(() => {
    if (!range) {
      setOrders([])
      setLoading(false)
      return
    }
    let active = true
    setLoading(true)
    setError('')
    setSelected('')
    setItems([])
    loadOrdersInWindow(client, store.id, range)
      .then((rows) => {
        if (active) setOrders(rows)
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : 'Could not load orders')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [client, store.id, range?.start, range?.end])

  useEffect(() => {
    if (!selected) return
    let active = true
    setLoadingItems(true)
    setItemError('')
    loadOrderItems(client, selected)
      .then((rows) => {
        if (active) setItems(rows)
      })
      .catch((err: unknown) => {
        if (active) setItemError(err instanceof Error ? err.message : 'Could not load items')
      })
      .finally(() => {
        if (active) setLoadingItems(false)
      })
    return () => {
      active = false
    }
  }, [client, selected])

  const symbol = store.currency_symbol
  const current = orders.find((order) => order.id === selected)
  const visible = orders.slice(0, 400)

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Orders</h2>
        <span className="muted">{orders.length} in this period</span>
      </div>
      {!range ? <p className="muted">Choose a start date and an end date.</p> : null}
      {error ? <p className="error">{error}</p> : null}
      {loading ? <p className="muted">Loading orders…</p> : null}
      {!loading && range && orders.length === 0 ? <p className="muted">No orders in this period.</p> : null}
      {orders.length > visible.length ? (
        <p className="muted">Showing the latest {visible.length} of {orders.length}.</p>
      ) : null}
      {visible.length > 0 ? (
        <div className="split-layout">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>When</th>
                  <th>Status</th>
                  <th>Pay</th>
                  <th className="num">Total</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((order) => (
                  <tr
                    key={order.id}
                    className={order.id === selected ? 'clickable selected' : 'clickable'}
                    tabIndex={0}
                    onClick={() => setSelected(order.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        setSelected(order.id)
                      }
                    }}
                  >
                    <td>{formatWhen(order.completed_at, store.timezone)}</td>
                    <td>{order.status}</td>
                    <td>{order.payment_method ?? '—'}</td>
                    <td className="num price">{money(order.total, symbol)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <article className="card detail">
            {current ? (
              <>
                <h3>{formatWhen(current.completed_at, store.timezone)}</h3>
                <p className="muted">
                  {current.status} · {current.payment_method ?? 'payment not set'} · refunded{' '}
                  {money(current.refunded_amount, symbol)}
                </p>
                {itemError ? <p className="error">{itemError}</p> : null}
                {loadingItems ? <p className="muted">Loading lines…</p> : null}
                <ul className="lines">
                  {items.map((item) => (
                    <li key={item.id}>
                      <span>
                        {item.product_name}
                        <small>
                          {qty(item.quantity)} × {money(item.unit_price, symbol)}
                        </small>
                      </span>
                      <strong className="price">{money(item.subtotal, symbol)}</strong>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="muted">Select an order to see its lines.</p>
            )}
          </article>
        </div>
      ) : null}
    </section>
  )
}

function Activity({
  client,
  store,
  range,
}: {
  client: SupabaseClient
  store: StoreRow
  range: TimeWindow | null
}) {
  const [refunds, setRefunds] = useState<RefundRow[]>([])
  const [voids, setVoids] = useState<VoidRow[]>([])
  const [shifts, setShifts] = useState<ShiftRow[]>([])
  const [credit, setCredit] = useState<CreditCustomer[]>([])
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
    Promise.all([
      loadRefunds(client, store.id, range),
      loadVoids(client, store.id, range),
      loadShifts(client, store.id, range),
      loadCreditCustomers(client, store.id),
    ])
      .then(([nextRefunds, nextVoids, nextShifts, nextCredit]) => {
        if (!active) return
        setRefunds(nextRefunds)
        setVoids(nextVoids)
        setShifts(nextShifts)
        setCredit(nextCredit)
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : 'Could not load activity')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [client, store.id, range?.start, range?.end])

  return (
    <section className="panel">
      <h2>Activity</h2>
      {!range ? <p className="muted">Choose a start date and an end date.</p> : null}
      {error ? <p className="error">{error}</p> : null}
      {loading ? <p className="muted">Loading activity…</p> : null}
      {range && !loading ? (
        <>
          <article className="card">
            <h3>Refunds</h3>
            {refunds.length === 0 ? <p className="muted top-gap">No refunds in this period.</p> : null}
            {refunds.length > 0 ? (
              <div className="table-wrap inset">
                <table>
                  <thead>
                    <tr>
                      <th>When</th>
                      <th>Number</th>
                      <th>Reason</th>
                      <th className="num">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {refunds.map((row) => (
                      <tr key={row.id}>
                        <td>{formatWhen(row.created_at, store.timezone)}</td>
                        <td>{row.refund_number}</td>
                        <td>{row.reason}</td>
                        <td className="num price">{money(row.total_amount, symbol)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </article>
          <article className="card">
            <h3>Voids and price changes</h3>
            {voids.length === 0 ? <p className="muted top-gap">None in this period.</p> : null}
            {voids.length > 0 ? (
              <div className="table-wrap inset">
                <table>
                  <thead>
                    <tr>
                      <th>When</th>
                      <th>Item</th>
                      <th>Type</th>
                      <th>Cashier</th>
                      <th className="num">Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {voids.map((row) => (
                      <tr key={row.id}>
                        <td>{formatWhen(row.voided_at, store.timezone)}</td>
                        <td>{row.product_name}</td>
                        <td>{row.type}</td>
                        <td>{row.cashier_name}</td>
                        <td className="num">{qty(row.quantity)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </article>
          <article className="card">
            <h3>Shifts</h3>
            {shifts.length === 0 ? <p className="muted top-gap">No shifts opened in this period.</p> : null}
            {shifts.length > 0 ? (
              <div className="table-wrap inset">
                <table>
                  <thead>
                    <tr>
                      <th>Opened</th>
                      <th>Cashier</th>
                      <th>Status</th>
                      <th className="num">Variance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shifts.map((row) => (
                      <tr key={row.id}>
                        <td>{formatWhen(row.opened_at, store.timezone)}</td>
                        <td>{row.cashier_name}</td>
                        <td>{row.status}</td>
                        <td className="num price">{row.variance == null ? '—' : money(row.variance, symbol)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </article>
          <article className="card">
            <h3>Customers on credit</h3>
            <p className="muted top-gap">Current balances, not limited to the period.</p>
            {credit.length === 0 ? <p className="muted top-gap">No active customer has a credit balance.</p> : null}
            {credit.length > 0 ? (
              <div className="table-wrap inset">
                <table>
                  <thead>
                    <tr>
                      <th>Customer</th>
                      <th>Phone</th>
                      <th className="num">Balance</th>
                      <th className="num">Limit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {credit.map((row) => (
                      <tr key={row.id}>
                        <td>{row.name}</td>
                        <td>{row.phone ?? '—'}</td>
                        <td className="num price">{money(row.credit_balance, symbol)}</td>
                        <td className="num">{money(row.credit_limit, symbol)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </article>
        </>
      ) : null}
    </section>
  )
}

function Stock({ client, store }: { client: SupabaseClient; store: StoreRow }) {
  const [rows, setRows] = useState<LowStockRow[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    loadLowStock(client, store.id)
      .then((list) => {
        if (active) setRows(list)
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : 'Could not load stock')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [client, store.id])

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>At or under reorder point</h2>
      </div>
      {error ? <p className="error">{error}</p> : null}
      {loading ? <p className="muted">Loading stock…</p> : null}
      {!loading && rows.length === 0 ? <p className="muted">No active product is at or under its reorder point.</p> : null}
      {rows.length > 0 ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th className="num">On hand</th>
                <th className="num">Reorder at</th>
                <th>Unit</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.name}</td>
                  <td className="num">{qty(row.stock_qty)}</td>
                  <td className="num">{qty(row.reorder_point)}</td>
                  <td>{row.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  )
}

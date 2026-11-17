type CalendarDate = { y: number; m: number; d: number }

function calendarInZone(date: Date, timeZone: string): CalendarDate {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const read = (type: string) => Number(parts.find((part) => part.type === type)?.value)
  return { y: read('year'), m: read('month'), d: read('day') }
}

function shiftDate(date: CalendarDate, days: number): CalendarDate {
  const utc = new Date(Date.UTC(date.y, date.m - 1, date.d))
  utc.setUTCDate(utc.getUTCDate() + days)
  return { y: utc.getUTCFullYear(), m: utc.getUTCMonth() + 1, d: utc.getUTCDate() }
}

/** UTC instant for 00:00:00 on a calendar date in an IANA timezone. */
export function zonedMidnightUtc(date: CalendarDate, timeZone: string): Date {
  let utc = Date.UTC(date.y, date.m - 1, date.d, 0, 0, 0)
  for (let pass = 0; pass < 3; pass += 1) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).formatToParts(new Date(utc))
    const read = (type: string) => Number(parts.find((part) => part.type === type)?.value)
    const got = Date.UTC(read('year'), read('month') - 1, read('day'), read('hour'), read('minute'), read('second'))
    const wanted = Date.UTC(date.y, date.m - 1, date.d, 0, 0, 0)
    const delta = wanted - got
    if (delta === 0) break
    utc += delta
  }
  return new Date(utc)
}

export type TimeWindow = {
  start: string
  end: string
}

function windowFrom(today: CalendarDate, daysBack: number, timeZone: string): TimeWindow {
  const startDate = shiftDate(today, -(daysBack - 1))
  const endDate = shiftDate(today, 1)
  return {
    start: zonedMidnightUtc(startDate, timeZone).toISOString(),
    end: zonedMidnightUtc(endDate, timeZone).toISOString(),
  }
}

export type PeriodKind = 'today' | 'week' | 'month' | 'custom'

const WEEKDAY: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
}

function formatYmd(date: CalendarDate): string {
  return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`
}

function parseYmd(value: string): CalendarDate | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const y = Number(match[1])
  const m = Number(match[2])
  const d = Number(match[3])
  if (m < 1 || m > 12 || d < 1 || d > 31) return null
  return { y, m, d }
}

function weekday(date: CalendarDate, timeZone: string): number {
  const label = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }).format(zonedMidnightUtc(date, timeZone))
  return WEEKDAY[label] ?? 0
}

function bounds(start: CalendarDate, endExclusive: CalendarDate, timeZone: string): TimeWindow {
  return {
    start: zonedMidnightUtc(start, timeZone).toISOString(),
    end: zonedMidnightUtc(endExclusive, timeZone).toISOString(),
  }
}

export function todayYmd(timeZone: string, now = new Date()): string {
  return formatYmd(calendarInZone(now, timeZone || 'UTC'))
}

/** Store-local today, Monday–today week, calendar month, or an inclusive custom range. */
export function periodWindow(
  kind: PeriodKind,
  timeZone: string,
  customStart: string,
  customEnd: string,
  now = new Date(),
): TimeWindow | null {
  const zone = timeZone || 'UTC'
  const today = calendarInZone(now, zone)
  if (kind === 'today') return windowFrom(today, 1, zone)
  if (kind === 'week') {
    const back = (weekday(today, zone) + 6) % 7
    return bounds(shiftDate(today, -back), shiftDate(today, 1), zone)
  }
  if (kind === 'month') {
    return bounds({ y: today.y, m: today.m, d: 1 }, shiftDate(today, 1), zone)
  }
  const from = parseYmd(customStart)
  const to = parseYmd(customEnd)
  if (!from || !to) return null
  const end = zonedMidnightUtc(shiftDate(to, 1), zone)
  const start = zonedMidnightUtc(from, zone)
  if (end.getTime() <= start.getTime()) return null
  return { start: start.toISOString(), end: end.toISOString() }
}

export type DayBucket = {
  key: string
  label: string
}

export function dayBuckets(window: TimeWindow, timeZone: string): DayBucket[] {
  const zone = timeZone || 'UTC'
  const buckets: DayBucket[] = []
  let cursor = new Date(window.start)
  const end = new Date(window.end).getTime()
  for (let guard = 0; cursor.getTime() < end && guard < 400; guard += 1) {
    const date = calendarInZone(cursor, zone)
    const key = formatYmd(date)
    const label = new Intl.DateTimeFormat(undefined, {
      timeZone: zone,
      month: 'short',
      day: 'numeric',
    }).format(cursor)
    buckets.push({ key, label })
    cursor = zonedMidnightUtc(shiftDate(date, 1), zone)
  }
  return buckets
}

export function dayKey(iso: string, timeZone: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return formatYmd(calendarInZone(date, timeZone || 'UTC'))
}

export function formatDay(iso: string, timeZone: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return new Intl.DateTimeFormat(undefined, {
    timeZone: timeZone || 'UTC',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

export function formatWhen(iso: string, timeZone: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return new Intl.DateTimeFormat(undefined, {
    timeZone: timeZone || 'UTC',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

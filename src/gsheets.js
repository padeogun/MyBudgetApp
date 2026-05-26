// Google Sheets API v4 — data layer for Bappy
// One spreadsheet per user ("Bappy Budget") with one tab per collection.

const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets'
const DRIVE_API  = 'https://www.googleapis.com/drive/v3/files'
const APP_TITLE  = 'Bappy Budget'

// Tab name → ordered column keys
// Complex/nested values are JSON-stringified automatically.
const TABS = {
  Categories:   ['id','name','glyph','tint'],
  Accounts:     ['id','name','type','balance','last4','apr','limit','rate','principal','termMonths','monthly','minRepayRule'],
  Transactions: ['id','date','amount','direction','accountId','transferToId','categoryId','type','description','status','recurrenceTemplateId'],
  Recurring:    ['id','payee','accountId','amount','direction','frequency','anchorDay','categoryId','active','source','nextDue','baseline'],
  Budgets:      ['id','scope','categoryId','period','amount','spent'],
  NudgeRules:   ['id','axis','priority','name','when','then','active'],
  Settings:     ['key','value'],   // single data row: key="data", value=JSON blob
}

const h = (token) => ({
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
})

// ── Ensure all expected tabs exist (handles schema migrations) ─
async function ensureTabs(token, spreadsheetId) {
  const res = await fetch(`${SHEETS_API}/${spreadsheetId}?fields=sheets.properties.title`, { headers: h(token) })
  if (!res.ok) return  // non-fatal — worst case write will fail and surface the error
  const { sheets } = await res.json()
  const existing = new Set((sheets || []).map(s => s.properties.title))
  const missing  = Object.keys(TABS).filter(name => !existing.has(name))
  if (!missing.length) return
  await fetch(`${SHEETS_API}/${spreadsheetId}:batchUpdate`, {
    method: 'POST', headers: h(token),
    body: JSON.stringify({ requests: missing.map(title => ({ addSheet: { properties: { title } } })) }),
  })
}

// ── Find or create the user's "Bappy Budget" spreadsheet ──────
export async function getOrCreateSpreadsheet(token) {
  const q   = encodeURIComponent(`name='${APP_TITLE}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`)
  const res = await fetch(`${DRIVE_API}?q=${q}&fields=files(id,name)&spaces=drive`, { headers: h(token) })
  if (!res.ok) throw new Error('Drive search failed: ' + res.status)
  const { files } = await res.json()
  if (files?.length) {
    // Existing spreadsheet — ensure any new tabs from schema migrations exist
    await ensureTabs(token, files[0].id)
    return files[0].id
  }

  // Create fresh spreadsheet with all tabs
  const body = {
    properties: { title: APP_TITLE },
    sheets: Object.keys(TABS).map(name => ({ properties: { title: name } })),
  }
  const cr  = await fetch(SHEETS_API, { method: 'POST', headers: h(token), body: JSON.stringify(body) })
  if (!cr.ok) throw new Error('Create spreadsheet failed: ' + cr.status)
  const { spreadsheetId } = await cr.json()
  return spreadsheetId
}

// ── Read all state from spreadsheet ───────────────────────────
export async function readAll(token, spreadsheetId) {
  const ranges = Object.keys(TABS).map(name => `${name}!A:Z`)
  const url    = `${SHEETS_API}/${spreadsheetId}/values:batchGet?` +
    ranges.map(r => `ranges=${encodeURIComponent(r)}`).join('&') +
    '&valueRenderOption=UNFORMATTED_VALUE'
  const res  = await fetch(url, { headers: h(token) })
  if (!res.ok) throw new Error('Read failed: ' + res.status)
  const data = await res.json()

  const result = {}
  ;(data.valueRanges || []).forEach((vr, i) => {
    const key  = Object.keys(TABS)[i]   // e.g. 'Accounts'
    result[key] = parseTab(key, vr.values || [])
  })
  return result  // { Accounts: [...], Transactions: [...], Settings: {...}, ... }
}

function parseTab(tabKey, rows) {
  if (rows.length < 2) return tabKey === 'Settings' ? null : []
  const [, ...dataRows] = rows  // skip header row

  if (tabKey === 'Settings') {
    const dataRow = dataRows.find(r => r[0] === 'data')
    const verRow  = dataRows.find(r => r[0] === 'lastModifiedAt')
    const remoteModifiedAt = verRow?.[1] ? Number(verRow[1]) : 0
    if (!dataRow?.[1]) return { __remoteModifiedAt: remoteModifiedAt }
    let settings = null
    try { settings = JSON.parse(dataRow[1]) } catch { settings = {} }
    // __remoteModifiedAt is a transport-only field — stripped before merging into state.settings
    return { ...settings, __remoteModifiedAt: remoteModifiedAt }
  }

  return dataRows
    .filter(r => r.length > 0 && r[0] !== '')
    .map(row => {
      const obj = {}
      TABS[tabKey].forEach((col, i) => {
        const val = row[i]
        if (val === undefined || val === '' || val === null) return
        // Re-inflate JSON-stringified objects/arrays
        if (typeof val === 'string' && (val[0] === '{' || val[0] === '[')) {
          try { obj[col] = JSON.parse(val); return } catch {}
        }
        obj[col] = val
      })
      return obj
    })
}

// ── Write full state to spreadsheet ───────────────────────────
export async function writeAll(token, spreadsheetId, state) {
  const lastModifiedAt = state.lastModifiedAt || 0
  const data = [
    makeRange('Categories',   state.categories),
    makeRange('Accounts',     state.accounts),
    makeRange('Transactions', state.transactions),
    makeRange('Recurring',    state.recurring),
    makeRange('Budgets',      state.budgets),
    makeRange('NudgeRules',   state.nudgeRules),
    makeRange('Settings',     state.settings, lastModifiedAt),
  ]

  // Clear then write — ensures deleted rows are removed
  const clearRanges = data.map(d => d.range.split('!')[0] + '!A:Z')
  const clearRes = await fetch(`${SHEETS_API}/${spreadsheetId}/values:batchClear`, {
    method: 'POST', headers: h(token),
    body: JSON.stringify({ ranges: clearRanges }),
  })
  if (!clearRes.ok) console.warn('[gsheets] batchClear failed:', clearRes.status, '— attempting write anyway')

  const res = await fetch(`${SHEETS_API}/${spreadsheetId}/values:batchUpdate`, {
    method: 'POST', headers: h(token),
    body: JSON.stringify({ valueInputOption: 'RAW', data }),
  })
  if (!res.ok) throw new Error('Write failed: ' + res.status)
}

function makeRange(tabKey, stateVal, lastModifiedAt = 0) {
  let values
  if (tabKey === 'Settings') {
    // Strip internal transport field before storing
    const { __remoteModifiedAt: _, ...cleanSettings } = stateVal || {}
    values = [
      ['key', 'value'],
      ['data', JSON.stringify(cleanSettings)],
      ['lastModifiedAt', lastModifiedAt],
    ]
  } else {
    const cols = TABS[tabKey]
    const rows = (stateVal || []).map(obj =>
      cols.map(col => {
        const v = obj[col]
        if (v === null || v === undefined) return ''
        if (typeof v === 'object') return JSON.stringify(v)
        return v
      })
    )
    values = [cols, ...rows]
  }
  return { range: `${tabKey}!A1`, values }
}

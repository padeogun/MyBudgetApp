// Google Identity Services — OAuth 2.0 token client
// Handles access tokens for Sheets + Drive APIs.

export const GOOGLE_SCOPE = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/gmail.send',
  'email',
  'profile',
].join(' ')

// Build and send a simple HTML email via Gmail API
export async function sendGmailMessage(token, { to, subject, html, text }) {
  // RFC 2047 Base64 encode a header value so non-ASCII chars survive transit
  const encodeHeader = (str) => {
    if (/^[\x20-\x7E]*$/.test(str)) return str   // pure ASCII — no encoding needed
    return `=?UTF-8?B?${btoa(unescape(encodeURIComponent(str)))}?=`
  }
  // Base64-encode a UTF-8 string, split into 76-char lines as required by RFC 2045
  const b64Body = (str) =>
    btoa(unescape(encodeURIComponent(str))).match(/.{1,76}/g).join('\r\n')

  const boundary = 'bappy_' + Math.random().toString(36).slice(2)
  const raw = [
    `To: ${to}`,
    `Subject: ${encodeHeader(subject)}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: base64',
    '',
    b64Body(text || subject),
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset=utf-8',
    'Content-Transfer-Encoding: base64',
    '',
    b64Body(html),
    '',
    `--${boundary}--`,
  ].join('\r\n')

  const encoded = btoa(unescape(encodeURIComponent(raw)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw: encoded }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message || `Gmail API error ${res.status}`)
  }
  return res.json()
}

let _client = null
let _token  = null
let _expiry = 0

// Call once GIS is loaded (window.google available)
export function initGoogleAuth(clientId) {
  _client = window.google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: GOOGLE_SCOPE,
    callback: () => {},   // replaced per-request below
  })
}

// Returns a valid access token, requesting one if needed.
// silent=true: attempt without showing the popup (may fail if no active session)
export function getToken(silent = false) {
  if (_token && Date.now() < _expiry - 60_000) return Promise.resolve(_token)

  if (!_client) {
    return Promise.reject(
      new Error('Google sign-in not initialised. Gmail features require the Google OAuth client. Re-sign-in with Google to use this feature.')
    )
  }

  return new Promise((resolve, reject) => {
    _client.callback = (resp) => {
      if (resp.error) { reject(new Error(resp.error)); return }
      _token  = resp.access_token
      _expiry = Date.now() + resp.expires_in * 1000
      resolve(_token)
    }
    _client.requestAccessToken({ prompt: silent ? '' : 'select_account' })
  })
}

// Fetch basic profile from Google
export async function getGoogleProfile(token) {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${token}` },
  })
  return res.json()   // { sub, email, name, picture }
}

// Clear token on sign-out
export function revokeToken() {
  if (_token) {
    window.google?.accounts.oauth2.revoke(_token, () => {})
    _token  = null
    _expiry = 0
  }
}

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve, dirname } from 'node:path'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = path => readFileSync(resolve(root, path), 'utf8')

test('premium stylesheet exists and is imported after base theme', () => {
  assert.ok(existsSync(resolve(root, 'src/premium-theme.css')))
  const entry = read('src/main.jsx')
  assert.match(entry, /import '\.\/theme\.css'/)
  assert.match(entry, /import '\.\/premium-theme\.css'/)
  assert.ok(entry.indexOf("import './premium-theme.css'") > entry.indexOf("import './theme.css'"))
})

test('premium theme provides brand tokens and accessible keyboard focus', () => {
  const css = read('src/premium-theme.css')
  for (const token of ['--c-ocean-teal', '--c-seafoam', '--c-coral', '--c-amber']) {
    assert.ok(css.includes(token), `Missing ${token}`)
  }
  assert.match(css, /:focus-visible/)
  assert.match(css, /prefers-reduced-motion/)
})

test('development tweaks panel is not rendered in production', () => {
  const app = read('src/bappy-app.jsx')
  assert.match(app, /import\.meta\.env\.DEV\s*&&\s*<BappyTweaks\s*\/>/)
})

test('desktop content width is expanded', () => {
  const app = read('src/bappy-app.jsx')
  assert.match(app, /maxWidth:\s*1240/)
})

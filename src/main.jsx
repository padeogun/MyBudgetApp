import React from 'react'
import ReactDOM from 'react-dom/client'
import './theme.css'
import './premium-theme.css'
import { BappyApp } from './bappy-app.jsx'

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(e) { return { error: e }; }
  render() {
    if (this.state.error) return (
      <div style={{ padding: 32, fontFamily: 'Roboto, sans-serif', color: '#1F2C2C' }}>
        <h2 style={{ color: '#E8566A' }}>Something went wrong</h2>
        <pre style={{ fontSize: 12, whiteSpace: 'pre-wrap', opacity: 0.7 }}>
          {this.state.error?.message}
        </pre>
        <button onClick={() => window.location.reload()}
          style={{ marginTop: 16, padding: '10px 20px', background: '#02A8B9', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
          Reload
        </button>
      </div>
    );
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BappyApp />
    </ErrorBoundary>
  </React.StrictMode>
)

// Only register the service worker in production.
// In dev mode the SW would intercept Vite's HMR requests and serve stale
// cached files, causing code changes to be invisible in the browser.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(err => {
      console.warn('SW registration failed:', err)
    })
  })
}

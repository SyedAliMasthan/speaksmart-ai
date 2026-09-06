import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(err, info) {
    console.error('ErrorBoundary:', err, info);
    if (window.posthog) window.posthog.captureException(err);
  }
  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div style={{ minHeight:'100vh', background:'#0d0f14', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Plus Jakarta Sans,sans-serif', padding:24 }}>
        <div style={{ maxWidth:480, textAlign:'center', color:'#f1f5f9' }}>
          <div style={{ fontSize:64, marginBottom:16 }}>😵</div>
          <h1 style={{ fontSize:24, fontWeight:700, marginBottom:12 }}>Something unexpected happened</h1>
          <p style={{ color:'#94a3b8', fontSize:15, lineHeight:1.6, marginBottom:24 }}>
            We hit a snag. This has been logged. Try refreshing or head back to the dashboard.
          </p>
          <div style={{ display:'flex', gap:12, justifyContent:'center' }}>
            <button onClick={() => window.location.reload()} style={{ padding:'10px 24px', background:'#1B998B', color:'#fff', border:'none', borderRadius:8, fontSize:14, fontWeight:600, cursor:'pointer' }}>Refresh</button>
            <button onClick={() => window.location.href='/dashboard'} style={{ padding:'10px 24px', background:'transparent', color:'#94a3b8', border:'1px solid #334155', borderRadius:8, fontSize:14, fontWeight:600, cursor:'pointer' }}>Dashboard</button>
          </div>
        </div>
      </div>
    );
  }
}

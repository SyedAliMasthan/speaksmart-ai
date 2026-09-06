export default function PrivacyPolicy() {
  const H2 = ({ children }) => <h2 style={{ fontSize:20, fontWeight:700, color:'#f1f5f9', marginTop:32, marginBottom:12 }}>{children}</h2>;
  return (
    <div className="page-wrap">
      <div className="page-inner" style={{ maxWidth:720, paddingTop:60, paddingBottom:80 }}>
        <a href="/" style={{ color:'#1B998B', fontSize:14 }}>← Back to SpeakSmart</a>
        <h1 style={{ fontSize:32, fontWeight:800, marginTop:24, marginBottom:8 }}>Privacy Policy</h1>
        <p style={{ color:'#64748b', fontSize:14, marginBottom:32 }}>Last updated: March 12, 2026</p>
        <div style={{ color:'#cbd5e1', fontSize:15, lineHeight:1.8 }}>
          <H2>1. Information We Collect</H2>
          <p><strong>Account:</strong> Email, name, auth credentials. Google sign-in shares name, email, and profile picture.</p>
          <p style={{ marginTop:12 }}><strong>Usage:</strong> Lessons completed, practice sessions, vocabulary, streaks, fluency scores — used to personalize learning.</p>
          <p style={{ marginTop:12 }}><strong>Voice:</strong> Audio processed in real-time for speech recognition. We do not store raw recordings after processing.</p>
          <H2>2. How We Use It</H2>
          <p>To provide and improve the learning platform, personalize AI tutor responses, track progress, and send learning reminders (if enabled).</p>
          <H2>3. Data Storage & Security</H2>
          <p>Data stored on Supabase (PostgreSQL on AWS). All transit encrypted via TLS 1.2+. Row Level Security ensures you only access your own data. No data sold to third parties. Ever.</p>
          <H2>4. Third-Party Services</H2>
          <p>Supabase (auth/database), Groq (AI engine), Cloudflare (CDN/protection). No advertising networks. No tracking pixels.</p>
          <H2>5. Your Rights</H2>
          <p><strong>Access:</strong> Export all data from Settings. <strong>Correction:</strong> Update profile anytime. <strong>Deletion:</strong> Delete account and all data from Settings. <strong>Portability:</strong> Download in JSON format.</p>
          <H2>6. Children</H2>
          <p>Not directed at children under 13. We don't knowingly collect data from children under 13.</p>
          <H2>7. Contact</H2>
          <p>Questions: <a href="mailto:privacy@speaksmarts.in" style={{ color:'#1B998B' }}>privacy@speaksmarts.in</a></p>
        </div>
      </div>
    </div>
  );
}

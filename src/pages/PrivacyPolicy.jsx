export default function PrivacyPolicy() {
  const H2 = ({ children }) => <h2 style={{ fontSize:20, fontWeight:700, color:'#f1f5f9', marginTop:32, marginBottom:12 }}>{children}</h2>;
  return (
    <div className="page-wrap">
      <div className="page-inner" style={{ maxWidth:720, paddingTop:60, paddingBottom:80 }}>
        <a href="/" style={{ color:'#1B998B', fontSize:14 }}>← Back to SpeakSmart</a>
        <h1 style={{ fontSize:32, fontWeight:800, marginTop:24, marginBottom:8 }}>Privacy Policy</h1>
        <p style={{ color:'#64748b', fontSize:14, marginBottom:32 }}>Last updated: September 7, 2026</p>
        <div style={{ color:'#cbd5e1', fontSize:15, lineHeight:1.8 }}>
          <H2>1. Information We Collect</H2>
          <p><strong>Account:</strong> Email and profile name; Supabase manages authentication credentials.</p>
          <p style={{ marginTop:12 }}><strong>Usage:</strong> Completed practice paragraphs and their lesson and date are stored for your dashboard.</p>
          <p style={{ marginTop:12 }}><strong>Voice:</strong> Recordings are sent through our server to Sarvam for transcription. This application does not persist raw recordings. Provider retention is governed by provider policies.</p>
          <H2>2. How We Use It</H2>
          <p>To authenticate your account, generate learning responses, and save completed practice. Conversation text is sent to Groq; text for AI speech is sent to Sarvam.</p>
          <H2>3. Data Storage & Security</H2>
          <p>Account and learning data use Supabase. Access controls restrict learning records to their owner. Your browser stores a login session; sign out on shared devices.</p>
          <H2>4. Third-Party Services</H2>
          <p>Supabase provides authentication and storage, Groq generates responses, and Sarvam processes speech. Avoid putting sensitive personal or financial information in practice messages. SpendWise is a separate application with a separate login and database.</p>
          <H2>5. Your Rights</H2>
          <p>Update your display name in Profile. Contact the operator below to request data access or account deletion; self-service account deletion is not currently available.</p>
          <H2>6. Children</H2>
          <p>Not directed at children under 13. We don't knowingly collect data from children under 13.</p>
          <H2>7. Contact</H2>
          <p>Questions: <a href="mailto:privacy@speaksmarts.in" style={{ color:'#1B998B' }}>privacy@speaksmarts.in</a></p>
        </div>
      </div>
    </div>
  );
}


export default function TermsOfService() {
  const H2 = ({ children }) => <h2 style={{ fontSize:20, fontWeight:700, color:'#f1f5f9', marginTop:32, marginBottom:12 }}>{children}</h2>;
  return (
    <div className="page-wrap">
      <div className="page-inner" style={{ maxWidth:720, paddingTop:60, paddingBottom:80 }}>
        <a href="/" style={{ color:'#1B998B', fontSize:14 }}>← Back to SpeakSmart</a>
        <h1 style={{ fontSize:32, fontWeight:800, marginTop:24, marginBottom:8 }}>Terms of Service</h1>
        <p style={{ color:'#64748b', fontSize:14, marginBottom:32 }}>Last updated: March 12, 2026</p>
        <div style={{ color:'#cbd5e1', fontSize:15, lineHeight:1.8 }}>
          <H2>1. Acceptance</H2>
          <p>By using SpeakSmart AI ("Service"), you agree to these Terms. If you don't agree, don't use it.</p>
          <H2>2. The Service</H2>
          <p>SpeakSmart AI is a free AI-powered English learning platform with conversational practice, saved practice paragraphs, and voice input and playback for Tamil, Hindi, and Telugu speakers.</p>
          <H2>3. Your Account</H2>
          <p>Provide accurate info. Keep credentials secure. Must be 13+ to use.</p>
          <H2>4. Free Service</H2>
          <p>SpeakSmart is 100% free. AI requests are subject to usage limits and provider availability. We reserve the right to modify features, but we will never retroactively charge for existing functionality.</p>
          <H2>5. Acceptable Use</H2>
          <p>Don't use for unlawful purposes, don't attempt unauthorized access, don't interfere with other users, don't reverse engineer, don't scrape with automated tools.</p>
          <H2>6. AI Content</H2>
          <p>AI-generated responses may occasionally contain errors. This is a learning tool, not a substitute for professional language instruction.</p>
          <H2>7. Intellectual Property</H2>
          <p>SpeakSmart's design and technology belong to SpeakSmart. Your personal content (practice recordings, notes) belongs to you.</p>
          <H2>8. Limitation of Liability</H2>
          <p>Provided "as is" without warranties. Not liable for indirect or consequential damages.</p>
          <H2>9. Changes</H2>
          <p>We may update these Terms. Continued use = acceptance.</p>
          <H2>10. Contact</H2>
          <p><a href="mailto:legal@speaksmarts.in" style={{ color:'#1B998B' }}>legal@speaksmarts.in</a></p>
        </div>
      </div>
    </div>
  );
}


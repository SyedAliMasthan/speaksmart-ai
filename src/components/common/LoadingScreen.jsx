export default function LoadingScreen() {
  return (
    <div style={{ minHeight:'100vh', background:'#0d0f14', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ width:44, height:44, border:'3px solid #1e293b', borderTopColor:'#1B998B', borderRadius:'50%', animation:'spin .8s linear infinite', margin:'0 auto 14px' }} />
        <p style={{ color:'#64748b', fontSize:14 }}>Loading...</p>
      </div>
    </div>
  );
}

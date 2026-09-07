import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useVoiceInput } from '../hooks/useVoiceInput';
import { sanitizeInput } from '../utils/sanitize';
import { speakWithLiya, stopSpeaking } from '../utils/sarvam';

import { LESSONS } from '../../shared/lessons';
import { apiRequest } from '../utils/api';
import { supabase } from '../config/supabase';

async function askLiya(messages, lesson, facts) {
  return apiRequest('/api/chat', { lessonId: lesson.id, messages: messages.slice(-20), facts: facts.slice(-8) });
}

function LiyaAvatar({size=32}) {
  return <div style={{width:size,height:size,borderRadius:size*.3,background:'linear-gradient(135deg,#ec4899,#a855f7)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:size*.45,color:'#fff',fontWeight:800,boxShadow:'0 2px 8px rgba(236,72,153,.3)',flexShrink:0}}>L</div>;
}

function SuggestionCard({corrected,suggestion,onListen}) {
  if(!corrected&&!suggestion) return null;
  return (
    <div style={{margin:'8px 0 4px',borderRadius:14,overflow:'hidden',border:'1px solid #ec489922',background:'linear-gradient(135deg,#1a0e1e,#111827)'}}>
      {corrected&&<div style={{padding:'12px 16px',borderBottom:suggestion?'1px solid #1e293b':'none'}}>
        <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:6}}><span style={{fontSize:13}}>✨</span><span style={{fontSize:12,fontWeight:700,color:'#a78bfa'}}>Better way to say it</span></div>
        <p style={{fontSize:14,color:'#e2e8f0',lineHeight:1.6,fontWeight:500}}>"{corrected}"</p>
        <button onClick={()=>onListen(corrected)} style={{background:'none',border:'none',color:'#a78bfa',fontSize:12,cursor:'pointer',padding:'4px 0',fontWeight:600,display:'flex',alignItems:'center',gap:4,marginTop:4}}>🔊 Listen</button>
      </div>}
      {suggestion&&<div style={{padding:'12px 16px',background:'#ec489908'}}>
        <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:6}}><span style={{fontSize:13}}>💡</span><span style={{fontSize:12,fontWeight:700,color:'#f472b6'}}>You could also say</span></div>
        <p style={{fontSize:14,color:'#fce7f3',lineHeight:1.6,fontStyle:'italic',fontWeight:500}}>"{suggestion}"</p>
        <button onClick={()=>onListen(suggestion)} style={{background:'none',border:'none',color:'#f472b6',fontSize:12,cursor:'pointer',padding:'4px 0',fontWeight:600,display:'flex',alignItems:'center',gap:4,marginTop:4}}>🔊 Listen</button>
      </div>}
    </div>
  );
}

function FinalCard({title,paragraph,onListen}) {
  const [copied,setCopied]=useState(false);
  const [saved,setSaved]=useState(false);
  const copy=async()=>{try{await navigator.clipboard.writeText(paragraph);setCopied(true);setTimeout(()=>setCopied(false),2000)}catch{}};
  const save=()=>{const b=new Blob([`${title}\n\n${paragraph}\n\n— Practiced on SpeakSmart AI`],{type:'text/plain'});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=`${title.replace(/\s+/g,'_')}.txt`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);setSaved(true);setTimeout(()=>setSaved(false),2000)};
  return (
    <div style={{margin:'12px 0',borderRadius:18,border:'2px solid #ec489944',background:'linear-gradient(135deg,#1a0a1e,#0f1729,#0a1e1a)',overflow:'hidden',animation:'scaleIn .5s cubic-bezier(.16,1,.3,1)'}}>
      <div style={{padding:'16px 20px 12px',background:'linear-gradient(135deg,#ec489915,#a855f715)',borderBottom:'1px solid #ec489922'}}>
        <div style={{display:'flex',alignItems:'center',gap:8}}><span style={{fontSize:20}}>📝</span><div><h3 style={{fontSize:16,fontWeight:800}}>{title}</h3><p style={{fontSize:12,color:'#a78bfa',marginTop:2}}>Your complete paragraph — memorize this!</p></div></div>
      </div>
      <div style={{padding:'16px 20px'}}><p style={{fontSize:16,lineHeight:1.8,color:'#e2e8f0',fontWeight:500}}>"{paragraph}"</p></div>
      <div style={{padding:'12px 20px 16px',display:'flex',gap:8,flexWrap:'wrap'}}>
        <button onClick={()=>onListen(paragraph)} style={{display:'flex',alignItems:'center',gap:6,padding:'8px 16px',borderRadius:10,background:'linear-gradient(135deg,#ec4899,#a855f7)',border:'none',color:'#fff',fontSize:13,fontWeight:700,cursor:'pointer'}}>🔊 Listen</button>
        <button onClick={copy} style={{display:'flex',alignItems:'center',gap:6,padding:'8px 16px',borderRadius:10,background:'#1e293b',border:'1px solid #334155',color:copied?'#4ade80':'#94a3b8',fontSize:13,fontWeight:600,cursor:'pointer'}}>{copied?'✓ Copied!':'📋 Copy'}</button>
        <button onClick={save} style={{display:'flex',alignItems:'center',gap:6,padding:'8px 16px',borderRadius:10,background:'#1e293b',border:'1px solid #334155',color:saved?'#4ade80':'#94a3b8',fontSize:13,fontWeight:600,cursor:'pointer'}}>{saved?'✓ Saved!':'💾 Save'}</button>
      </div>
    </div>
  );
}

function Msg({msg,index,onListen}) {
  const isUser=msg.role==='user';
  const [vis,setVis]=useState(false);
  useEffect(()=>{const t=setTimeout(()=>setVis(true),50+index*40);return()=>clearTimeout(t)},[index]);
  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:isUser?'flex-end':'flex-start',marginBottom:6,opacity:vis?1:0,transform:vis?'none':'translateY(10px)',transition:'all .4s cubic-bezier(.16,1,.3,1)'}}>
      {!isUser&&<div style={{display:'flex',alignItems:'center',gap:6,marginBottom:4,paddingLeft:2}}><LiyaAvatar size={22}/><span style={{fontSize:12,color:'#a78bfa',fontWeight:700}}>Liya</span></div>}
      <div style={{maxWidth:'88%',padding:'12px 16px',borderRadius:isUser?'16px 16px 4px 16px':'16px 16px 16px 4px',background:isUser?'linear-gradient(135deg,rgba(27,153,139,.15),rgba(27,153,139,.08))':'#1a1d28',border:isUser?'1px solid rgba(27,153,139,.2)':'1px solid #1e293b'}}>
        <p style={{fontSize:15,lineHeight:1.65,wordBreak:'break-word',color:isUser?'#d1fae5':'#e2e8f0'}}>{msg.text}</p>
        {!isUser&&<button onClick={()=>onListen(msg.text)} style={{background:'none',border:'none',color:'#64748b',fontSize:11,cursor:'pointer',padding:'4px 0 0',display:'flex',alignItems:'center',gap:4}}>🔊 Listen</button>}
      </div>
      {!isUser&&(msg.corrected||msg.suggestion)&&<div style={{maxWidth:'92%',width:'100%'}}><SuggestionCard corrected={msg.corrected} suggestion={msg.suggestion} onListen={onListen}/></div>}
      {!isUser&&msg.finalParagraph&&<div style={{maxWidth:'95%',width:'100%'}}><FinalCard title={msg.pTitle||'Your Paragraph'} paragraph={msg.finalParagraph} onListen={onListen}/></div>}
    </div>
  );
}

function Dots() {
  return <div style={{display:'flex',alignItems:'center',gap:6,padding:'8px 2px'}}><LiyaAvatar size={22}/><div style={{background:'#1a1d28',border:'1px solid #1e293b',borderRadius:'16px 16px 16px 4px',padding:'12px 16px',display:'flex',gap:5}}>{[0,1,2].map(i=><div key={i} style={{width:7,height:7,borderRadius:'50%',background:'#ec4899',animation:`d${i} 1.4s ease-in-out infinite`,opacity:.4}}/>)}</div><style>{`@keyframes d0{0%,60%,100%{transform:translateY(0);opacity:.4}30%{transform:translateY(-7px);opacity:1}}@keyframes d1{0%,70%,100%{transform:translateY(0);opacity:.4}40%{transform:translateY(-7px);opacity:1}}@keyframes d2{0%,80%,100%{transform:translateY(0);opacity:.4}50%{transform:translateY(-7px);opacity:1}}`}</style></div>;
}

function Ring({current,total,size=38}) {
  const r=(size-6)/2,c=2*Math.PI*r;
  return <svg width={size} height={size} style={{transform:'rotate(-90deg)'}}><circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#1e293b" strokeWidth={3}/><circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#ec4899" strokeWidth={3} strokeDasharray={c} strokeDashoffset={c*(1-current/total)} strokeLinecap="round" style={{transition:'stroke-dashoffset .6s cubic-bezier(.16,1,.3,1)'}}/><text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="central" fill="#e2e8f0" fontSize={10} fontWeight={700} style={{transform:'rotate(90deg)',transformOrigin:'center'}}>{current}</text></svg>;
}

export default function Practice() {
  const {topic}=useParams();
  const { user } = useAuth();
  const [error, setError] = useState('');
  const sending = useRef(false);
  const generation = useRef(0);
  const nav=useNavigate();
  const lesson=LESSONS[topic]||LESSONS['introduce-yourself'];
  const [msgs,setMsgs]=useState([]);
  const [input,setInput]=useState('');
  const [busy,setBusy]=useState(false);
  const [step,setStep]=useState(0);
  const [facts,setFacts]=useState([]);
  const [done,setDone]=useState(false);
  const chatRef=useRef(null);
  const inputRef=useRef(null);

  const {isListening,isProcessing,transcript,startListening,stopListening}=useVoiceInput({
    language:'en-IN',onResult:(t)=>{if(t.trim())send(t.trim())},onError:()=>setError('Voice input is unavailable. You can type your answer.'),
  });

  useEffect(()=>{if(chatRef.current)chatRef.current.scrollTo({top:chatRef.current.scrollHeight,behavior:'smooth'})},[msgs,busy]);

  useEffect(()=>{
    const o={
      'introduce-yourself':"Hi! I'm Liya, your English coach 😊 Let's practice introducing yourself! What's your name?",
      'my-family':"Hey there! I'm Liya 😊 Let's talk about your family! How many people are in your family?",
      'daily-routine':"Hi! I'm Liya 😊 Let's build your daily routine paragraph! What time do you usually wake up?",
      'food-i-love':"Hey! I'm Liya 😊 I love food talk! What's your favourite food?",
      'my-hometown':"Hi! I'm Liya 😊 Tell me about your city or town! Where do you live?",
      'weekend-plans':"Hey! I'm Liya 😊 What do you usually do on weekends?",
      'dream-job':"Hi! I'm Liya 😊 Let's dream big! What job would you love to have?",
      'job-interview':"Hello! I'm Liya 😊 Let's practice a job interview! Tell me about yourself.",
      'at-restaurant':"Hi! I'm Liya 😊 Imagine we're at a restaurant — what would you like to order?",
      'travel':"Hey! I'm Liya 😊 What's a place you've visited or want to visit?",
    };
    const t=o[lesson.id]||`Hi! I'm Liya 😊 Let's practice "${lesson.title}"!`;
    setMsgs([{role:'assistant',text:t,corrected:null,suggestion:null,finalParagraph:null}]);
    generation.current++; sending.current = false; setBusy(false); setError('');
    setStep(1);setFacts([]);setDone(false);
    const greeting = setTimeout(()=>speakWithLiya(t),500);
    return ()=>{ clearTimeout(greeting); generation.current++; stopSpeaking(); };
  },[lesson.id]);

  useEffect(()=>{if(transcript)setInput(transcript)},[transcript]);

  const send=useCallback(async(override)=>{
    const text=sanitizeInput(override||input).trim();
    if(!text||sending.current||done) return;
    sending.current = true; setError('');
    const requestGeneration = generation.current;
    setInput('');
    const u={role:'user',text};
    setMsgs(p=>[...p,u]);
    setBusy(true);
    const hist=[...msgs,u].map(m=>({role:m.role==='user'?'user':'assistant',content:m.text}));
    try {
    const ai=await askLiya(hist,lesson,facts);
    if (requestGeneration !== generation.current) return;
    let display=ai.reply||'';
    if(ai.followUpQuestion&&!ai.isComplete) display+=' '+ai.followUpQuestion;
    const a={role:'assistant',text:display,corrected:ai.corrected||null,suggestion:ai.suggestion||null,finalParagraph:ai.isComplete?ai.finalParagraph:null,pTitle:lesson.pTitle};
    setMsgs(p=>[...p,a]);
    setStep(s=>Math.min(s+1,lesson.steps));
    if(ai.collectedFact) setFacts(p=>[...p,ai.collectedFact]);
    if(ai.isComplete) {
      setDone(true);
      const { error: saveError } = await supabase.from('practice_sessions').insert({ user_id: user.id, lesson_id: lesson.id, summary: ai.finalParagraph || '', completed: true });
      if (requestGeneration !== generation.current) return;
      if (saveError) setError('Your paragraph is ready, but progress could not be saved. Download a copy below.');
    }
    speakWithLiya(display);
    } catch (err) {
      if (requestGeneration === generation.current) { setError(err.message); setInput(text); setMsgs(p=>p.filter(m=>m!==u)); }
    } finally {
      if (requestGeneration === generation.current) { sending.current=false; setBusy(false); inputRef.current?.focus(); }
    }
  },[input,done,msgs,lesson,facts,user]);

  return (
    <div style={{height:'100dvh',display:'flex',flexDirection:'column',background:'#0d0f14',fontFamily:"'Plus Jakarta Sans',sans-serif",color:'#f1f5f9',maxWidth:720,margin:'0 auto'}}>
      <header style={{padding:'10px 14px',borderBottom:'1px solid #1e293b',background:'rgba(13,15,20,.95)',backdropFilter:'blur(12px)',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <button onClick={()=>{stopSpeaking();nav('/dashboard')}} style={{background:'none',border:'1px solid #1e293b',borderRadius:8,width:32,height:32,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:'#94a3b8',fontSize:15}}>←</button>
          <div><div style={{display:'flex',alignItems:'center',gap:6}}><span style={{fontSize:15}}>{lesson.icon}</span><h1 style={{fontSize:14,fontWeight:700}}>{lesson.title}</h1></div><p style={{fontSize:11,color:'#64748b',marginTop:1}}>{lesson.subtitle}</p></div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          {facts.length>0&&<div style={{textAlign:'right'}}><div style={{fontSize:14,fontWeight:800,color:'#ec4899',lineHeight:1}}>{facts.length}</div><div style={{fontSize:9,color:'#64748b'}}>facts</div></div>}
          <Ring current={step} total={lesson.steps}/>
          <button onClick={()=>{stopSpeaking();nav('/dashboard')}} style={{background:'#dc262612',border:'1px solid #dc262633',color:'#f87171',padding:'5px 12px',borderRadius:8,fontSize:11,fontWeight:700,cursor:'pointer'}}>End</button>
        </div>
      </header>

      <div ref={chatRef} style={{flex:1,overflowY:'auto',padding:'14px 14px 8px',display:'flex',flexDirection:'column',gap:6}}>
        {error && <p role="alert" className="notice error">{error}</p>}
        {msgs.map((m,i)=><Msg key={i} msg={m} index={i} onListen={speakWithLiya}/>)}
        {busy&&<Dots/>}
        {done&&<div style={{textAlign:'center',padding:'20px 16px',margin:'8px 0',animation:'fadeUp .5s ease-out'}}>
          <div style={{fontSize:40,marginBottom:8}}>🎉</div>
          <p style={{fontSize:15,fontWeight:700}}>Amazing work!</p>
          <p style={{fontSize:13,color:'#94a3b8',marginTop:4}}>Practice reading your paragraph aloud!</p>
          <button onClick={()=>nav('/dashboard')} style={{marginTop:16,padding:'10px 28px',borderRadius:12,background:'linear-gradient(135deg,#ec4899,#a855f7)',border:'none',color:'#fff',fontSize:14,fontWeight:700,cursor:'pointer'}}>Back to Dashboard →</button>
        </div>}
      </div>

      {!done&&<div style={{padding:'10px 14px 14px',borderTop:'1px solid #1e293b',background:'rgba(13,15,20,.95)',backdropFilter:'blur(12px)',flexShrink:0}}>
        {(isListening||isProcessing)&&<div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8,padding:'7px 12px',background:isListening?'#dc262610':'#a855f710',border:`1px solid ${isListening?'#dc262630':'#a855f730'}`,borderRadius:10}}>
          {isListening?<><div style={{width:9,height:9,borderRadius:'50%',background:'#f87171',animation:'breathe 1s ease-in-out infinite'}}/><span style={{fontSize:12,color:'#f87171',fontWeight:500}}>Listening... speak now</span><button onClick={stopListening} style={{marginLeft:'auto',background:'#dc262620',border:'1px solid #dc262640',borderRadius:6,color:'#f87171',padding:'3px 8px',fontSize:11,fontWeight:600,cursor:'pointer'}}>Stop</button></>
          :<><div style={{width:12,height:12,borderRadius:'50%',border:'2px solid #1e293b',borderTopColor:'#a855f7',animation:'spin .8s linear infinite'}}/><span style={{fontSize:12,color:'#94a3b8',fontWeight:500}}>Processing with Sarvam AI...</span></>}
        </div>}
        <div style={{display:'flex',alignItems:'flex-end',gap:8}}>
          <button onClick={isListening?stopListening:startListening} disabled={isProcessing||busy} style={{width:44,height:44,borderRadius:12,flexShrink:0,background:isListening?'linear-gradient(135deg,#dc2626,#b91c1c)':'#1a1d28',border:isListening?'none':'1px solid #1e293b',color:isListening?'#fff':'#94a3b8',fontSize:18,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',animation:isListening?'micPulse 1.5s ease-in-out infinite':'none',opacity:(isProcessing||busy)?0.4:1}}>🎤</button>
          <div style={{flex:1,position:'relative',background:'#161923',borderRadius:14,border:'1px solid #1e293b'}}>
            <textarea ref={inputRef} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send()}}} placeholder="Type or use mic to speak..." rows={1} disabled={busy||isListening} style={{width:'100%',padding:'12px 48px 12px 16px',background:'transparent',border:'none',outline:'none',color:'#e2e8f0',fontSize:15,lineHeight:1.5,resize:'none',fontFamily:'inherit',maxHeight:100}}/>
            <button onClick={()=>send()} disabled={!input.trim()||busy} style={{position:'absolute',right:6,bottom:6,width:34,height:34,borderRadius:10,border:'none',fontSize:14,cursor:input.trim()?'pointer':'default',background:input.trim()?'linear-gradient(135deg,#ec4899,#a855f7)':'#1e2330',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',opacity:input.trim()?1:.3,transition:'all .2s'}}>↑</button>
          </div>
        </div>
        <div style={{textAlign:'center',marginTop:6}}><span style={{fontSize:10,color:'#334155'}}>{step}/{lesson.steps} · Voice by Sarvam AI · Brain by Groq</span></div>
      </div>}
    </div>
  );
}


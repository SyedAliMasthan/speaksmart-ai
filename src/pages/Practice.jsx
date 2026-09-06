import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useVoiceInput } from '../hooks/useVoiceInput';
import { sanitizeInput } from '../utils/sanitize';
import { speakWithLiya, stopSpeaking } from '../utils/sarvam';

const LESSONS = {
  'my-family':{id:'my-family',title:'My Family',subtitle:'Possessives / Describing people',icon:'👨‍👩‍👧',steps:15,pTitle:'About My Family'},
  'introduce-yourself':{id:'introduce-yourself',title:'Introduce Yourself',subtitle:'Self-introduction',icon:'👋',steps:12,pTitle:'My Self-Introduction'},
  'daily-routine':{id:'daily-routine',title:'My Daily Routine',subtitle:'Present Simple / Time words',icon:'⏰',steps:15,pTitle:'My Daily Routine'},
  'food-i-love':{id:'food-i-love',title:'Food I Love',subtitle:'Describing food & preferences',icon:'🍛',steps:12,pTitle:'My Favourite Food'},
  'my-hometown':{id:'my-hometown',title:'My Hometown',subtitle:'There is/are / Prepositions',icon:'🏙️',steps:12,pTitle:'About My Hometown'},
  'weekend-plans':{id:'weekend-plans',title:'Weekend Plans',subtitle:'Future tense / Going to',icon:'🎉',steps:12,pTitle:'My Weekend Plans'},
  'dream-job':{id:'dream-job',title:'My Dream Job',subtitle:'Would like to / Ambitions',icon:'💼',steps:15,pTitle:'My Dream Job'},
  'job-interview':{id:'job-interview',title:'Job Interview',subtitle:'Professional English',icon:'🎯',steps:20,pTitle:'My Interview Introduction'},
  'at-restaurant':{id:'at-restaurant',title:'At a Restaurant',subtitle:'Ordering / Polite English',icon:'🍽️',steps:12,pTitle:null},
  'travel':{id:'travel',title:'Travel & Places',subtitle:'Describing places',icon:'✈️',steps:12,pTitle:'My Travel Story'},
};

async function askLiya(messages, lesson, factsStr) {
  const sys = `You are Liya, a warm friendly female English coach. Clear, encouraging, works for children AND adults.

LESSON: "${lesson.title}" — ${lesson.subtitle}

YOUR JOB ON EVERY USER MESSAGE:
1. Correct their English naturally (show better version, don't lecture)
2. Give a SUGGESTION — a more polished/natural way to say it. ALWAYS provide this.
3. Ask a follow-up question to collect more info
4. Build toward a complete paragraph

FACTS SO FAR:\n${factsStr}

RESPOND IN EXACT JSON:
{"reply":"Your warm response","corrected":"Corrected version or null","suggestion":"More polished way — ALWAYS give this","followUpQuestion":"Next question","collectedFact":"Short fact from their msg","isComplete":false,"finalParagraph":null}

When 5-8 facts collected, set isComplete=true, write beautiful finalParagraph combining everything.

RULES:
- ALWAYS give suggestion even if English is perfect
- Keep examples Indian daily life relevant
- NEVER dump grammar rules or tense labels
- Suggestion = heart of this app`;

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':`Bearer ${import.meta.env.VITE_GROQ_API_KEY}`},
      body:JSON.stringify({model:'llama-3.3-70b-versatile',messages:[{role:'system',content:sys},...messages],temperature:0.7,max_tokens:600,response_format:{type:'json_object'}}),
    });
    if(!res.ok) throw new Error();
    return JSON.parse((await res.json()).choices[0].message.content);
  } catch {
    return {reply:"Oops, I missed that! Could you say it again? 😊",corrected:null,suggestion:null,followUpQuestion:null,collectedFact:null,isComplete:false,finalParagraph:null};
  }
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
  const save=()=>{const b=new Blob([`${title}\n\n${paragraph}\n\n— Practiced on SpeakSmart AI`],{type:'text/plain'});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=`${title.replace(/\s+/g,'_')}.txt`;a.click();setSaved(true);setTimeout(()=>setSaved(false),2000)};
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
    language:'en-IN',onResult:(t)=>{if(t.trim())send(t.trim())},onError:()=>{},
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
    setStep(1);setFacts([]);setDone(false);
    setTimeout(()=>speakWithLiya(t),500);
    return ()=>stopSpeaking();
  },[lesson.id]);

  useEffect(()=>{if(transcript)setInput(transcript)},[transcript]);

  const send=useCallback(async(override)=>{
    const text=sanitizeInput(override||input).trim();
    if(!text||busy||done) return;
    setInput('');
    const u={role:'user',text};
    setMsgs(p=>[...p,u]);
    setBusy(true);
    const hist=[...msgs,u].map(m=>({role:m.role==='user'?'user':'assistant',content:m.text}));
    const fs=facts.length?facts.map((f,i)=>`${i+1}. ${f}`).join('\n'):'Nothing yet';
    const ai=await askLiya(hist,lesson,fs);
    let display=ai.reply||'';
    if(ai.followUpQuestion&&!ai.isComplete) display+=' '+ai.followUpQuestion;
    const a={role:'assistant',text:display,corrected:ai.corrected||null,suggestion:ai.suggestion||null,finalParagraph:ai.isComplete?ai.finalParagraph:null,pTitle:lesson.pTitle};
    setMsgs(p=>[...p,a]);
    setStep(s=>Math.min(s+1,lesson.steps));
    if(ai.collectedFact) setFacts(p=>[...p,ai.collectedFact]);
    if(ai.isComplete) setDone(true);
    speakWithLiya(display);
    setBusy(false);
    inputRef.current?.focus();
  },[input,busy,done,msgs,lesson,facts]);

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
          <button onClick={isListening?stopListening:startListening} disabled={isProcessing||busy} style={{width:44,height:44,borderRadius:12,flexShrink:0,background:isListening?'linear-gradient(135deg,#dc2626,#b91c1c)':'#1a1d28',border:isListening?'none':'1px solid #1e293b',color:isListening?'#fff':'#94a3b8',fontSize:18,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',animation:isListening?'micPulse 1.5s ease-in-out infinite':'none',opacity:(isProcessing||busy)?.4:1}}>🎤</button>
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

'use strict';
const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = p => new Intl.NumberFormat('en-IN', {style:'currency',currency:'INR',maximumFractionDigits:2}).format(p / 100);
const today = () => new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const monthLabel = m => new Date(m + '-01T12:00:00').toLocaleDateString('en-IN',{month:'long',year:'numeric'});
const dayLabel = d => new Date(d + 'T12:00:00').toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'});
const iconPaths = {
 overview:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
 transactions:'<path d="M4 7h16m-4-4 4 4-4 4M20 17H4m4-4-4 4 4 4"/>',
 budget:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
 leaf:'<path d="M20 4C8 2 2 9 6 16s16 4 14-12Z"/><path d="m4 21 11-12"/>',
 settings:'<path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"/><path d="m10 3-1 3-3 1-3 1 1 3-1 3 3 1 1 3 3 1 3-1 3 1 1-3 3-1-1-3 1-3-3-1-1-3-3 1-3-1Z"/>',
 refresh:'<path d="M20 7v5h-5M4 17v-5h5"/><path d="M6 6a8 8 0 0 1 13 3M18 18a8 8 0 0 1-13-3"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',
 'chevron-left':'<path d="m15 5-7 7 7 7"/>',
 'chevron-right':'<path d="m9 5 7 7-7 7"/>',
 incoming:'<path d="M18 5 6 17M6 5v12h12"/>',
 outgoing:'<path d="M6 19 18 7M6 7h12v12"/>',
 wallet:'<path d="M20 7H5a2 2 0 0 1 0-4h13v4M4 7v13h17V7"/><path d="M21 11h-6v5h6"/><path d="M17 13.5h.01"/>',
 search:'<circle cx="10.5" cy="10.5" r="7"/><path d="m16 16 5 5"/>',
 download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
 close:'<path d="m6 6 12 12M6 18 18 6"/>',
 bag:'<path d="M5 7h14l1 14H4L5 7Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
 food:'<path d="M4 3v5a3 3 0 0 0 6 0V3M7 3v18M19 3c-4 0-5 7-3 10h3M19 3v18"/>',
 home:'<path d="m3 10 9-7 9 7M5 9v12h14V9M9 21v-8h6v8"/>',
 bill:'<path d="m6 3 3 2 3-2 3 2 3-2v18l-3-2-3 2-3-2-3 2V3Z"/><path d="M9 9h6M9 13h6"/>',
 health:'<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6V3Z"/>',
 transport:'<path d="m5 7 2-4h10l2 4 2 3v8H3v-8l2-3Zm0 0h14M6 18v3m12-3v3M6 12h2m8 0h2"/>',
 education:'<path d="m2 9 10-5 10 5-10 5L2 9Zm4 2v6c4 4 8 4 12 0v-6M22 9v8"/>'
};
function icon(name){return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPaths[name] || iconPaths.wallet}</svg>`;}
function paintIcons(root=document){$$('[data-icon]',root).forEach(e=>{e.innerHTML=icon(e.dataset.icon);});}
const state = {user:null, csrf:'', view:'overview', month:today().slice(0,7), page:1, entries:[], total:0,
 summary:null, categories:[], income:[], methods:[], editing:null, kind:'expense', requestId:'', budgetCategory:'Overall', refreshSeq:0, toastTimer:null, refreshing:false};
const titles = {overview:['THE BIG PICTURE','Your money, clearly.','A little attention today. More confidence tomorrow.'],
 transactions:['EVERY ENTRY COUNTS','Your transactions.','Find, review and keep track of every spend.'],
 budgets:['SPEND WITH INTENTION','A plan for your money.','Set limits that leave room for what matters.']};
function notify(message){clearTimeout(state.toastTimer);$('#toast').textContent=message;$('#toast').hidden=false;state.toastTimer=setTimeout(()=>$('#toast').hidden=true,4200);}
function setBusy(form, busy){$$('button[type="submit"]',form).forEach(b=>{b.disabled=busy;});}
function signedOut(){state.user=null;state.csrf='';state.refreshSeq++;$$('dialog[open]').forEach(d=>d.close());$('#workspace').hidden=true;$('#auth').hidden=false;$('#loading').hidden=true;$('#login-form').elements.password.value='';}
async function api(path, options={}){
 const headers = {...(options.body ? {'Content-Type':'application/json','X-CSRF-Token':state.csrf} : {}),...options.headers};
 let response;
 try{response=await fetch(path,{credentials:'same-origin',cache:'no-store',...options,headers});}
 catch(_){throw new Error('Cannot reach your tracker. Check your connection and try again. Your form has been kept.');}
 let data;try{data=await response.json();}catch(_){throw new Error('Your tracker returned an unexpected response. Please try again.');}
 if(!response.ok){if(response.status===401 && !['/api/login','/api/session'].includes(path)){signedOut();notify('Your session ended. Please sign in again.');}const error=new Error(data.error || 'Something went wrong. Please try again.');error.status=response.status;throw error;}
 return data;
}
async function startSession(){
 const data=await api('/api/session');state.user=data.username;state.csrf=data.csrf;state.categories=data.categories;state.income=data.income_categories;state.methods=data.methods;
 $('#profile-name').textContent=data.username;$('#avatar').textContent=data.username.slice(0,1).toUpperCase();$('#account-username').textContent=`Signed in as ${data.username}`;
 $('#entry-form').elements.method.innerHTML=state.methods.map(m=>`<option>${esc(m)}</option>`).join('');
 $('#category-filter').innerHTML='<option value="">All categories</option>'+[...state.categories,...state.income,'Transfer','Credit-card repayment'].filter((v,i,a)=>a.indexOf(v)===i).map(c=>`<option>${esc(c)}</option>`).join('');
 $('#loading').hidden=true;$('#auth').hidden=true;$('#workspace').hidden=false;await refresh();
}
function filtersQuery(){const p=new URLSearchParams();if(!$('#all-time').checked)p.set('month',state.month);if($('#type-filter').value)p.set('kind',$('#type-filter').value);if($('#category-filter').value)p.set('category',$('#category-filter').value);if($('#search').value.trim())p.set('q',$('#search').value.trim());p.set('page',state.page);return p;}
async function refresh(){
 if(!state.user)return;
 const seq=++state.refreshSeq;$('#sync-status').textContent='Refreshing…';
 const params=state.view==='transactions'?filtersQuery():new URLSearchParams({month:state.month});
 try{
  const [summary,list]=await Promise.all([api('/api/summary?month='+encodeURIComponent(state.month)),api('/api/transactions?'+params)]);
  if(seq!==state.refreshSeq || !state.user)return;
  state.summary=summary;state.entries=list.items;state.total=list.total;$('#load-error').hidden=true;$('#sync-status').classList.remove('failed');$('#sync-status').textContent='Updated just now';render();
 }catch(error){if(seq!==state.refreshSeq)return;$('#load-error').textContent=error.message;$('#load-error').hidden=false;$('#sync-status').textContent='Could not refresh';$('#sync-status').classList.add('failed');}
}
function changeView(view){state.view=view;state.page=1;const t=titles[view];$('#heading-eyebrow').textContent=t[0];$('#page-title').textContent=t[1];$('#page-subtitle').textContent=t[2];$('#breadcrumb-view').textContent=view.charAt(0).toUpperCase()+view.slice(1);$$('[data-view]').forEach(b=>{b.classList.toggle('active',b.dataset.view===view);if(b.dataset.view===view)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});Object.keys(titles).forEach(v=>$('#'+v+'-view').hidden=v!==view);refresh();}
function categoryIcon(category,kind){if(kind==='income')return 'incoming';if(kind==='transfer')return 'transactions';if(category.includes('Food'))return 'food';if(category==='Groceries'||category==='Shopping')return 'bag';if(category==='Rent')return 'home';if(category.includes('Bills')||category.includes('EMI'))return 'bill';if(category==='Health')return 'health';if(category==='Transport'||category==='Travel')return 'transport';if(category==='Education')return 'education';return 'wallet';}
function emptyState(title,text,action=false){return `<div class="empty-state"><span data-icon="wallet">${icon('wallet')}</span><h3>${esc(title)}</h3><p>${esc(text)}</p>${action?'<button class="text-button" data-new-entry>Add your first transaction →</button>':''}</div>`;}
function transactionTable(items){
 if(!items.length)return emptyState('No transactions here yet','Add an entry, or choose a different month or filter.',true);
 return `<table class="transaction-table"><thead><tr><th>Description</th><th class="category-col">Category</th><th class="date-col">Date</th><th class="method-col">Payment</th><th>Amount</th></tr></thead><tbody>${items.map(r=>`<tr data-entry="${esc(r.id)}"><td><div class="desc-cell"><span class="category-icon">${icon(categoryIcon(r.category,r.kind))}</span><div><button class="entry-link" data-edit="${esc(r.id)}">${esc(r.description||r.category)}</button><span class="entry-sub">${esc(r.account)}${r.kind==='transfer'?' → '+esc(r.to_account):''} · ${dayLabel(r.day)}</span></div></div></td><td class="category-col">${esc(r.category)}</td><td class="date-col">${dayLabel(r.day)}</td><td class="method-col">${esc(r.method)}</td><td><div class="amount-cell ${r.kind==='income'?'tone-green':''}">${r.kind==='income'?'+':r.kind==='expense'?'−':''}${money(r.amount)}</div>${r.kind==='transfer'?'<span class="type-badge">Transfer</span>':''}</td></tr>`).join('')}</tbody></table>`;
}
function render(){
 const s=state.summary;if(!s)return;
 $('#total-expense').textContent=money(s.expense);$('#total-income').textContent=money(s.income);$('#net-flow').textContent=money(s.net);$('#net-flow').classList.toggle('negative',s.net<0);
 const max=Math.max(...Object.values(s.daily),1);
 $('#daily-chart').innerHTML=`<div class="chart-bars">${Array.from({length:s.days},(_,i)=>{const day=s.month+'-'+String(i+1).padStart(2,'0');const n=s.daily[day]||0;return `<div class="bar-wrap" tabindex="0" title="${dayLabel(day)}: ${money(n)}" aria-label="${dayLabel(day)}: ${money(n)}"><div class="bar" style="height:${n/max*100}%"></div></div>`;}).join('')}</div>${s.expense===0?'<div class="chart-empty">Your spending pattern will appear here.</div>':''}`;
 $('#chart-range').textContent=`1–${s.days} ${monthLabel(s.month)}`;
 let elapsed=s.days;if(s.month===today().slice(0,7))elapsed=Number(today().slice(8));
 $('#daily-average').textContent=`${money(Math.round(s.expense/elapsed))} / day`;
 const top=s.categories.slice(0,4);const remainder=s.categories.slice(4).reduce((a,c)=>a+c.amount,0);if(remainder)top.push({category:'Remaining categories',amount:remainder});
 $('#category-chart').innerHTML=top.length?top.map((r,i)=>`<div class="category-row"><div class="category-row-header"><span><i class="category-dot" style="background:${['#16705a','#539585','#87bca1','#6b85a1','#9badb9'][i]}"></i>${esc(r.category)}</span><strong>${money(r.amount)}</strong></div><div class="progress-track" role="meter" aria-label="${esc(r.category)} share of expenses" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(r.amount/s.expense*100)}"><div style="width:${r.amount/s.expense*100}%"></div></div></div>`).join(''):emptyState('A fresh start','Your expense categories will appear as you add entries.');
 const overall=s.budgets.Overall||0;const left=overall-s.expense;
 $('#overview-budget-title').textContent=overall?(left>=0?`${money(left)} left in your monthly budget`:`${money(-left)} over your monthly budget`):'Give your month a plan';
 $('#overview-budget-text').textContent=overall?`${money(s.expense)} spent of ${money(overall)} planned for ${monthLabel(s.month)}.`:'Set a monthly budget to see what is left to spend.';
 $('#open-budgets').textContent=overall?'View budgets →':'Set budget →';
 $('#budget-total').textContent=overall?(left>=0?`${money(left)} left to spend`:`${money(-left)} over budget`):'Set your spending limit';
 $('#budget-detail').textContent=overall?`${money(s.expense)} spent of ${money(overall)} · ${monthLabel(s.month)}`:`A limit for all expenses in ${monthLabel(s.month)}.`;
 $('#overall-progress>div').style.width=overall?`${Math.min(100,s.expense/overall*100)}%`:'0%';
 $('#budget-categories').innerHTML=state.categories.map(c=>{const spent=s.categories.find(x=>x.category===c)?.amount||0;const limit=s.budgets[c]||0;const over=limit&&spent>limit;return `<article class="budget-card ${over?'over':''}"><div class="budget-card-head"><h3>${esc(c)}</h3><button class="text-button" data-budget="${esc(c)}">${limit?'Edit':'Set limit'}</button></div><div class="budget-amounts"><strong>${money(spent)}</strong><span class="muted">${limit?'of '+money(limit):'No limit set'}</span></div><div class="progress-track"><div style="width:${limit?Math.min(100,spent/limit*100):0}%"></div></div><p>${limit?(over?money(spent-limit)+' over budget':money(limit-spent)+' remaining'):'Set a limit to keep this category in view.'}</p></article>`;}).join('');
 if(state.view==='overview')$('#recent-list').innerHTML=transactionTable(state.entries.slice(0,5));
 if(state.view==='transactions'){$('#transaction-list').innerHTML=transactionTable(state.entries);$('#page-count').textContent=state.total?`${(state.page-1)*50+1}–${Math.min(state.page*50,state.total)} of ${state.total}`:'0 transactions';$('#prev-page').disabled=state.page<=1;$('#next-page').disabled=state.page*50>=state.total;}
 const accounts=[...new Set(['Bank account','Cash','Credit card',...state.entries.flatMap(e=>[e.account,e.to_account]).filter(Boolean)])];
 $('#account-options').innerHTML=accounts.map(a=>`<option value="${esc(a)}">`).join('');
}
function setKind(kind,selectedCategory){state.kind=kind;$$('[data-kind]').forEach(b=>{b.classList.toggle('active',b.dataset.kind===kind);b.setAttribute('aria-pressed',String(b.dataset.kind===kind));});const options=kind==='expense'?state.categories:kind==='income'?state.income:['Transfer','Credit-card repayment'];const form=$('#entry-form');form.elements.category.innerHTML=options.map(c=>`<option>${esc(c)}</option>`).join('');if(selectedCategory)form.elements.category.value=selectedCategory;$('#to-account-field').hidden=kind!=='transfer';form.elements.to_account.required=kind==='transfer';$('#transfer-hint').hidden=kind!=='transfer';$('#account-label').textContent=kind==='transfer'?'From account':'Account / wallet';}
function openEntry(id){const row=id?state.entries.find(e=>e.id===id):null;if(id&&!row)return;state.editing=row;state.requestId=row?.id||crypto.randomUUID();const form=$('#entry-form');form.reset();$('#entry-error').textContent='';$('#entry-title').textContent=row?'Edit transaction':'Add a transaction';$('#delete-entry').hidden=!row;setKind(row?.kind||'expense',row?.category);form.elements.day.value=row?.day||today();form.elements.amount.value=row?(row.amount/100).toFixed(2):'';form.elements.account.value=row?.account||'Bank account';form.elements.method.value=row?.method||'UPI';form.elements.to_account.value=row?.to_account||'';form.elements.description.value=row?.description||'';$('#entry-dialog').showModal();setTimeout(()=>form.elements.amount.focus(),60);}
function openBudget(category){if(!state.summary){notify('Please wait for your budget to load, then try again.');return;}state.budgetCategory=category;$('#budget-title').textContent=category==='Overall'?'Monthly budget':category+' budget';$('#budget-month-label').textContent=monthLabel(state.month);$('#budget-form').elements.amount.value=((state.summary.budgets[category]||0)/100).toFixed(2);$('#budget-error').textContent='';$('#budget-dialog').showModal();$('#budget-form').elements.amount.select();}
async function exportCSV(all){const params=all?'':filtersQuery().toString();try{const response=await fetch('/api/export.csv'+(params?'?'+params:''),{credentials:'same-origin',cache:'no-store'});if(!response.ok){if(response.status===401)signedOut();throw new Error('Could not export. Refresh your tracker and try again.');}const blob=await response.blob();const href=URL.createObjectURL(blob);const a=document.createElement('a');a.href=href;a.download=all?'spendwise-all-transactions.csv':'spendwise-transactions.csv';a.click();setTimeout(()=>URL.revokeObjectURL(href),30000);notify('Your transaction export is ready.');}catch(error){notify(error.message);}}

paintIcons();$('#month').value=state.month;
document.addEventListener('click',e=>{
 const nav=e.target.closest('[data-view]');if(nav){changeView(nav.dataset.view);return;}
 const close=e.target.closest('[data-close]');if(close){$('#'+close.dataset.close).close();return;}
 const kind=e.target.closest('[data-kind]');if(kind){setKind(kind.dataset.kind);return;}
 const budget=e.target.closest('[data-budget]');if(budget){openBudget(budget.dataset.budget);return;}
 const row=e.target.closest('[data-entry]');if(row){openEntry(row.dataset.entry);return;}
 if(e.target.closest('[data-new-entry]'))openEntry();
});
$('#login-form').addEventListener('submit',async e=>{e.preventDefault();const form=e.target;setBusy(form,true);$('#login-error').textContent='';try{await api('/api/login',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(form)))});form.elements.password.value='';await startSession();}catch(error){$('#login-error').textContent=error.message;}finally{setBusy(form,false);}});
$('#add-entry').addEventListener('click',()=>openEntry());$('#refresh').addEventListener('click',refresh);$('#view-all').addEventListener('click',()=>changeView('transactions'));$('#open-budgets').addEventListener('click',()=>changeView('budgets'));
['account-button','mobile-account'].forEach(id=>$('#'+id).addEventListener('click',()=>{$('#password-form').reset();$('#password-error').textContent='';$('#account-dialog').showModal();}));
function changeMonth(value){if(!/^\d{4}-\d{2}$/.test(value)||value.slice(0,4)==='0000')return;state.month=value;$('#month').value=value;state.page=1;refresh();}
$('#month').addEventListener('change',e=>changeMonth(e.target.value));
function moveMonth(step){const d=new Date(state.month+'-01T12:00:00');d.setMonth(d.getMonth()+step);if(d.getFullYear()<1900||d.getFullYear()>9999)return;changeMonth(String(d.getFullYear()).padStart(4,'0')+'-'+String(d.getMonth()+1).padStart(2,'0'));}
$('#prev-month').addEventListener('click',()=>moveMonth(-1));$('#next-month').addEventListener('click',()=>moveMonth(1));
let searchTimer;$('#search').addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>{state.page=1;refresh();},300);});
['type-filter','category-filter','all-time'].forEach(id=>$('#'+id).addEventListener('change',()=>{state.page=1;refresh();}));
$('#prev-page').addEventListener('click',()=>{state.page--;refresh();});$('#next-page').addEventListener('click',()=>{state.page++;refresh();});
$('#entry-form').addEventListener('submit',async e=>{e.preventDefault();const form=e.target;setBusy(form,true);$('#entry-error').textContent='';const data={...Object.fromEntries(new FormData(form)),id:state.requestId,kind:state.kind};if(state.editing)data.version=state.editing.version;try{await api('/api/transactions'+(state.editing?'/'+state.editing.id:''),{method:state.editing?'PUT':'POST',body:JSON.stringify(data)});$('#entry-dialog').close();notify(state.editing?'Transaction updated.':'Transaction saved.');await refresh();}catch(error){$('#entry-error').textContent=error.message;}finally{setBusy(form,false);}});
$('#delete-entry').addEventListener('click',()=>{$('#delete-error').textContent='';$('#delete-dialog').showModal();});
$('#confirm-delete').addEventListener('click',async()=>{if(!state.editing)return;$('#confirm-delete').disabled=true;try{await api('/api/transactions/'+state.editing.id,{method:'DELETE',body:JSON.stringify({version:state.editing.version})});$('#delete-dialog').close();$('#entry-dialog').close();notify('Transaction deleted.');if(state.entries.length===1&&state.page>1)state.page--;await refresh();}catch(error){$('#delete-error').textContent=error.message;}finally{$('#confirm-delete').disabled=false;}});
$('#budget-form').addEventListener('submit',async e=>{e.preventDefault();setBusy(e.target,true);$('#budget-error').textContent='';try{await api('/api/budgets',{method:'PUT',body:JSON.stringify({month:state.month,category:state.budgetCategory,amount:e.target.elements.amount.value})});$('#budget-dialog').close();notify('Budget saved.');await refresh();}catch(error){$('#budget-error').textContent=error.message;}finally{setBusy(e.target,false);}});
$('#logout').addEventListener('click',async()=>{try{await api('/api/logout',{method:'POST',body:'{}'});signedOut();}catch(error){notify(error.message);}});
$('#password-form').addEventListener('submit',async e=>{e.preventDefault();setBusy(e.target,true);$('#password-error').textContent='';try{await api('/api/password',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(e.target)))});e.target.reset();signedOut();notify('Password changed. Please sign in again.');}catch(error){$('#password-error').textContent=error.message;}finally{setBusy(e.target,false);}});
$('#export-all').addEventListener('click',()=>exportCSV(true));$('#export-filtered').addEventListener('click',()=>exportCSV(false));
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&state.user&&!$('dialog[open]'))refresh();});
window.addEventListener('online',()=>{if(state.user&&!$('dialog[open]'))refresh();});
window.addEventListener('offline',()=>{$('#sync-status').textContent='Offline';$('#sync-status').classList.add('failed');});
setInterval(()=>{if(state.user&&!document.hidden&&!$('dialog[open]'))refresh();},30000);
startSession().catch(error=>{signedOut();if(error.status!==401)$('#login-error').textContent=error.message;});

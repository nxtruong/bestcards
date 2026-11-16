import {CATEGORIES, normalize, validateApp, validateProfile, applyOverrides, rankCards, matches, offerState} from './core.js';
import {fetchNearby, distanceMeters, DEMO_PLACES} from './places.js';

const $=id=>document.getElementById(id);
const state={app:null,config:null,user:null,source:null,places:[],selected:null,used:[],demo:false,loadSequence:0,busy:false,cache:null};
const money=value=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(value);
const percent=value=>`${new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(value)}%`;
let storageWarning=false;
const storage={get(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}},set(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true;}catch{storageWarning=true;return false;}}};
function el(tag,className,text){const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;}
function notice(text,type=''){const node=$('status');node.textContent=text;node.className=`notice ${type}`;}
function statusForConfig(){
  if(!state.config)return;
  const suffix=storageWarning?' Device storage is unavailable; offer history will last only until you leave this page.':'';
  notice(state.config.sample?`Sample wallet for ${state.user.name} — replace the example card rates and offers before relying on recommendations.${suffix}`:`${state.user.name}’s wallet · ${state.config.cards.length} cards · config loaded ${new Date().toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})}.${suffix}`,state.config.sample?'demo':'');
}
function allowedUrl(raw,base){const url=new URL(raw,base);if(!['http:','https:'].includes(url.protocol))throw new Error('Config URLs must use HTTP or HTTPS.');if(location.protocol==='https:' && url.protocol!=='https:')throw new Error('Config URLs must use HTTPS on an HTTPS site.');return url.href;}
async function fetchJson(url){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);try{const response=await fetch(url,{cache:'no-store',credentials:'same-origin',signal:controller.signal});if(!response.ok)throw new Error(`HTTP ${response.status}`);return await response.json();}catch(error){throw new Error(`Could not load ${url}. ${error.name==='AbortError'?'Request timed out.':error.message} Check the URL, valid JSON, and cross-origin (CORS) permissions.`);}finally{clearTimeout(timer);}}
const usedKey=()=>`pocket-perks:v1:used:${state.user.id}:${state.source}`;
function fillCategories(select,includeAuto=false){select.replaceChildren();if(includeAuto){const option=el('option','','Use detected category');option.value='';select.append(option);}for(const [value,label]of Object.entries(CATEGORIES)){const option=el('option','',label);option.value=value;select.append(option);}}
async function loadProfile(){
  const sequence=++state.loadSequence;
  state.user=state.app.users.find(u=>u.id===$('profile').value);state.config=null;state.selected=null;state.used=[];
  $('reload').disabled=true;$('locate').disabled=true;$('demo').disabled=true;
  $('offers').replaceChildren();renderResults();renderBusinesses();$('config-info').textContent='Loading profile…';
  notice(`Loading ${state.user.name}’s config…`);
  const raw=state.user.configUrl||state.app.profileUrlTemplate.replaceAll('{id}',encodeURIComponent(state.user.id));
  try{
    const source=allowedUrl(raw,state.app.url),config=validateProfile(await fetchJson(source));
    if(sequence!==state.loadSequence)return;
    state.config=config;state.source=source;const used=storage.get(usedKey(),[]);state.used=Array.isArray(used)?used.filter(x=>typeof x==='string'):[];
    storage.set('pocket-perks:v1:profile',state.user.id);$('config-info').textContent=`Profile: ${state.user.name} · Loaded from ${source}${config.updated?` · File updated: ${config.updated}`:''}.`;
    statusForConfig();renderBusinesses();renderResults();renderOffers();$('locate').disabled=state.busy;$('demo').disabled=state.busy;
  }catch(error){if(sequence!==state.loadSequence)return;notice(error.message,'error');$('config-info').textContent='Profile loading failed. Fix the config and tap Reload config.';}
  finally{if(sequence===state.loadSequence)$('reload').disabled=false;}
}
function renderBusinesses(){
  const list=$('businesses');list.replaceChildren();const filter=normalize($('search').value);
  const places=state.places.filter(p=>normalize(`${p.name} ${p.brand||''}`).includes(filter));
  if(!places.length){list.append(el('p','empty',state.places.length?'No matching businesses. Try another name or choose a category.':'Your nearby businesses will appear here. You can also choose a category below.'));return;}
  for(const original of places){
    const p=applyOverrides(original,state.config?.categoryOverrides),button=el('button',`business${state.selected?.id===p.id?' active':''}`);
    button.type='button';button.disabled=!state.config;button.setAttribute('aria-pressed',String(state.selected?.id===p.id));
    const icon=el('span','business-icon',({gas:'⛽',groceries:'◈',dining:'☕',wholesale:'▦'})[p.category]||'⌂');icon.setAttribute('aria-hidden','true');
    const text=el('span','business-text');text.append(el('strong','',p.name),el('small','',`${CATEGORIES[p.category]}${p.address?' · '+p.address:''}`));
    button.append(icon,text,el('span','distance',p.distance<1000?`${Math.round(p.distance)} m`:`${(p.distance/1000).toFixed(1)} km`));
    button.addEventListener('click',()=>selectPlace(p));list.append(button);
  }
}
function selectPlace(place){state.selected={...place};$('category-override').value='';renderBusinesses();renderResults();renderOffers();if(matchMedia('(max-width:620px)').matches)$('results-heading').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});}
function selectedMerchant(){if(!state.selected)return null;const category=$('category-override').value;return category?{...state.selected,category,categorySource:'Your category selection'}:state.selected;}
function renderResults(){
  const root=$('recommendations');root.replaceChildren();const merchant=selectedMerchant();
  $('category-adjustment').hidden=!merchant;
  if(!state.config||!merchant){$('selected-store').textContent='Select a business or category to begin.';const box=el('div','waiting');box.append(el('span','','✦'),el('h3','','Your wallet, working together.'),el('p','','We’ll compare your cards and matching offers here.'));root.append(box);return;}
  $('selected-store').textContent=`${state.demo&&merchant.id.startsWith('demo-')?'Sample: ':''}${merchant.name} · ${CATEGORIES[merchant.category]}`;
  const raw=$('amount').value.trim(),amount=raw?Number(raw):null;
  if(raw && (!Number.isFinite(amount)||amount<=0||amount>1000000)){root.append(el('p','notice error','Enter a purchase amount greater than $0 and no more than $1,000,000.'));return;}
  const ranked=rankCards(state.config,merchant,amount,{channel:$('channel').value,usedIds:state.used});
  root.append(el('p','ranking-note',amount?`${merchant.categorySource||'Estimated category'} · estimated reward value for ${money(amount)}.`:'Enter a purchase amount to include offers. Until then, only ordinary category rewards are compared.'));
  const best=ranked[0]?.total;
  ranked.forEach((result,index)=>{
    const tied=index>0&&Math.abs(result.total-best)<0.000001,article=el('article',`card-result${index===0?' best':''}`);
    if(index===0)article.append(el('span','best-label',amount?'BEST ESTIMATED VALUE':'BEST EVERYDAY RATE'));else if(tied)article.append(el('span','best-label','SAME ESTIMATED VALUE'));
    const top=el('div','result-top'),left=el('div');left.append(el('h3','card-name',result.card.name),el('p','card-description',result.card.unit==='points'?`${result.card.centsPerPoint}¢ per point · your valuation`:'Cash back'));
    const value=el('div','reward-value',amount?money(result.total):percent(result.effectivePercent));value.append(el('small','',amount?`${percent(result.effectivePercent)} effective return`:'estimated value'));top.append(left,value);article.append(top);
    const breakdown=el('div','breakdown'),base=el('div','breakdown-line');base.append(el('span','',`${result.baseRate}${result.card.unit==='points'?'× points':'% cash back'} · ${CATEGORIES[merchant.category]}`),el('span','',amount?money(result.base):''));breakdown.append(base);
    for(const item of result.applied){const row=el('div','breakdown-line');row.append(el('span','',item.offer.title),el('span','',`+${money(item.value)}`));breakdown.append(row);}
    article.append(breakdown);
    if(result.pending.length)article.append(el('p','offer-notes',amount?`${result.pending.length} matching offer(s) need a higher purchase amount.`:`${result.pending.length} matching offer(s) available. Enter an amount to evaluate them.`));
    if(result.applied.length)article.append(el('p','offer-notes','Check activation and offer terms. Remaining caps and past spending are not tracked automatically.'));
    root.append(article);
  });
}
function offerDescription(offer,card){
  const suffix=card.unit==='points'?'× points':'% cash back';
  return ({total_rate:`${offer.value}${suffix} total on eligible spend`,extra_rate:`Extra ${offer.value}${suffix}`,fixed_points:`${offer.value.toLocaleString()} bonus points`,fixed_cash:`${money(offer.value)} bonus`,percent_cashback:`Extra ${offer.value}% cash back`})[offer.kind];
}
function renderOffers(){
  const root=$('offers');root.replaceChildren();if(!state.config)return;
  const merchant=selectedMerchant(),offers=state.config.offers||[];
  if(!offers.length){root.append(el('p','muted','No offers in this config yet. Add them to your profile JSON file.'));return;}
  const list=el('div','offer-list');
  for(const offer of offers){
    const card=state.config.cards.find(c=>c.id===offer.card),status=offerState(offer,state.used),box=el('article',`offer${status!=='active'?' used':''}`);
    const top=el('div','offer-top'),text=el('div');text.append(el('h3','',offer.title),el('p','',card.name));top.append(text);
    const button=el('button','secondary',state.used.includes(offer.id)?'Undo used':'Mark used');button.type='button';button.addEventListener('click',()=>{
      state.used=state.used.includes(offer.id)?state.used.filter(id=>id!==offer.id):[...state.used,offer.id];storage.set(usedKey(),state.used);statusForConfig();renderResults();renderOffers();
    });top.append(button);box.append(top,el('p','',offerDescription(offer,card)));
    const scope=[...(offer.match?.categories||[]).map(x=>CATEGORIES[x]),...(offer.match?.merchants||[])].join(' + ')||'All merchants';
    box.append(el('p','',`${scope} · ${offer.channel==='online'?'Online only':offer.channel==='in_store'?'In store only':'Any channel'}`));
    const terms=[];if(offer.minSpend)terms.push(`Minimum ${money(offer.minSpend)}`);if(offer.spendCap!==undefined)terms.push(`${money(offer.spendCap)} eligible spend remaining`);if(offer.rewardCap!==undefined)terms.push(`Reward cap: ${offer.rewardCap} ${['total_rate','extra_rate','fixed_points'].includes(offer.kind)&&card.unit==='points'?'points':'USD'}`);if(offer.starts)terms.push(`From ${offer.starts}`);if(offer.expires)terms.push(`Through ${offer.expires}`);if(terms.length)box.append(el('p','',terms.join(' · ')));
    if(offer.note)box.append(el('p','',offer.note));
    const matching=merchant&&matches(offer,merchant,$('channel').value);box.append(el('span','badge',status!=='active'?status:matching?'Matches selected merchant':'Available'));list.append(box);
  }root.append(list);
}
async function locate(){
  if(!state.config||state.busy)return;state.busy=true;$('locate').disabled=true;$('demo').disabled=true;$('location-status').textContent='Requesting your location…';
  try{
    if(!window.isSecureContext)throw new Error('Location needs HTTPS (or localhost). You can still choose a category manually.');
    if(!navigator.geolocation)throw new Error('This browser does not provide location. Choose a category manually.');
    const position=await new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:true,timeout:15000,maximumAge:30000}));
    const location={lat:position.coords.latitude,lon:position.coords.longitude},radius=Number($('radius').value);
    $('location-status').textContent='Looking up nearby businesses in OpenStreetMap…';
    const cached=state.cache&&state.cache.radius===radius&&Date.now()-state.cache.time<300000&&distanceMeters(location,state.cache.location)<60;
    const places=cached?state.cache.places.map(p=>({...p,distance:distanceMeters(location,p)})).sort((a,b)=>a.distance-b.distance):await fetchNearby(location,radius,state.app.overpassEndpoints);
    if(!cached)state.cache={time:Date.now(),location,radius,places};
    state.demo=false;state.places=places;state.selected=null;$('search').value='';renderBusinesses();renderResults();renderOffers();
    $('location-status').textContent=`${places.length} businesses found${cached?' · recent results reused':''}. Location accuracy: about ${Math.round(position.coords.accuracy)} m.${!places.length?' Try a larger radius or select a category.':''}`;
  }catch(error){
    const errors={1:'Location permission was denied. Allow it in your browser settings, or choose a category manually.',2:'Your location is unavailable. Try again outdoors or choose a category.',3:'Location timed out. Try again or choose a category.'};
    $('location-status').textContent=(errors[error.code]||error.message)+(state.places.length?' Previously shown results remain below; they have not been refreshed.':'');
  }finally{state.busy=false;$('locate').disabled=!state.config;$('demo').disabled=!state.config;}
}
async function boot(){
  fillCategories($('manual-category'));fillCategories($('category-override'),true);
  $('locate').addEventListener('click',locate);$('search').addEventListener('input',renderBusinesses);
  $('amount').addEventListener('input',renderResults);$('channel').addEventListener('change',()=>{renderResults();renderOffers();});
  $('category-override').addEventListener('change',()=>{renderResults();renderOffers();});
  $('profile').addEventListener('change',loadProfile);$('reload').addEventListener('click',loadProfile);
  $('demo').addEventListener('click',()=>{state.places=DEMO_PLACES.map(p=>({...p}));state.demo=true;state.selected=null;$('search').value='';$('location-status').textContent='Sample businesses — not based on your location. Tap Find nearby businesses for live results.';renderBusinesses();renderResults();renderOffers();});
  $('manual-form').addEventListener('submit',event=>{event.preventDefault();if(!state.config)return;const category=$('manual-category').value,name=$('merchant-name').value.trim()||CATEGORIES[category];selectPlace(applyOverrides({id:'manual',name,category,categorySource:'Your category selection'},state.config.categoryOverrides));});
  $('reset').addEventListener('click',()=>{if(!state.config)return;if(confirm(`Reset all locally marked-used offers for ${state.user.name}?`)){state.used=[];storage.set(usedKey(),[]);statusForConfig();renderResults();renderOffers();}});
  try{
    const appUrl=new URL('../config/app.json',import.meta.url).href;
    state.app={...validateApp(await fetchJson(appUrl)),url:appUrl};
    document.title=`${state.app.appName||'Pocket Perks'} — choose your card`;
    $('profile').replaceChildren();for(const user of state.app.users){const option=el('option','',user.name);option.value=user.id;$('profile').append(option);}
    const saved=storage.get('pocket-perks:v1:profile',null);if(state.app.users.some(u=>u.id===saved))$('profile').value=saved;
    $('profile').disabled=false;$('radius').value=String(state.app.radiusMeters||200);await loadProfile();
  }catch(error){notice(error.message,'error');}
}
boot();

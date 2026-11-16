// Pure reward and configuration logic. No DOM, storage, or network dependencies.
export const CATEGORIES = {
  groceries: 'Groceries', gas: 'Gas stations', dining: 'Dining & cafés',
  pharmacy: 'Pharmacies', wholesale: 'Warehouse clubs', department: 'Department stores',
  home_improvement: 'Home improvement', electronics: 'Electronics', clothing: 'Clothing',
  hotel: 'Hotels', travel: 'Travel', entertainment: 'Entertainment', other: 'Other purchases'
};
export const normalize = value => String(value ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
export function containsName(value, pattern) {
  const a = normalize(value), b = normalize(pattern);
  return !!b && (` ${a} `).includes(` ${b} `);
}
export function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
const validDate = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s+'T12:00:00Z')) && new Date(s+'T12:00:00Z').toISOString().slice(0,10) === s;
const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
function assert(condition, message) { if (!condition) throw new Error(message); }
function number(n, field, {positive=false}={}) { assert(typeof n === 'number' && Number.isFinite(n) && (positive ? n > 0 : n >= 0), `${field} must be a ${positive?'positive':'nonnegative'} number.`); }
function strings(x, field) { assert(Array.isArray(x) && x.length>0 && x.every(v=>typeof v==='string' && v.trim()), `${field} must be a nonempty list of strings.`); }
function checkMatch(match, label) {
  assert(object(match), `${label} must be an object.`);
  const allowed=['categories','merchants','excludeMerchants'];
  Object.keys(match).forEach(key=>assert(allowed.includes(key),`${label}: unknown key ${key}.`));
  for(const key of allowed) if(match[key]!==undefined) strings(match[key],`${label}.${key}`);
  (match.categories||[]).forEach(v=>assert(v in CATEGORIES, `${label}: unknown category ${v}.`));
}
function uniqueIds(items, label) {
  const ids = new Set();
  for(const x of items) { assert(object(x) && typeof x.id==='string' && /^[a-zA-Z0-9_-]+$/.test(x.id),`${label} IDs must use letters, numbers, underscores, or hyphens.`); assert(!ids.has(x.id),`Duplicate ${label} ID: ${x.id}.`); ids.add(x.id); }
}
export function validateApp(config) {
  assert(object(config) && config.schemaVersion===1, 'app.json schemaVersion must be 1.');
  assert(Array.isArray(config.users) && config.users.length>0,'app.json needs at least one user.'); uniqueIds(config.users,'user');
  config.users.forEach(u=>{assert(typeof u.name==='string' && u.name.trim(),'Each user needs a name.');if(u.configUrl!==undefined)assert(typeof u.configUrl==='string' && u.configUrl.trim(),'configUrl must be a nonempty URL string.');});
  assert(typeof config.profileUrlTemplate==='string' && config.profileUrlTemplate.includes('{id}'),'profileUrlTemplate must contain {id}.');
  if(config.radiusMeters!==undefined) assert([200,500,1000].includes(config.radiusMeters),'radiusMeters must be 200, 500, or 1000.');
  if(config.overpassEndpoints!==undefined){strings(config.overpassEndpoints,'overpassEndpoints');config.overpassEndpoints.forEach(url=>assert(/^https:\/\//.test(url),'Overpass endpoints must use HTTPS.'));}
  return config;
}
export function validateProfile(config) {
  assert(object(config) && config.schemaVersion===1,'Profile schemaVersion must be 1.');
  assert(Array.isArray(config.cards) && config.cards.length>0,'Profile needs at least one card.'); uniqueIds(config.cards,'card');
  for(const card of config.cards) {
    assert(typeof card.name==='string' && card.name.trim(),'Each card needs a name.');
    assert(['points','cashback'].includes(card.unit),`${card.id}.unit must be points or cashback.`);
    number(card.baseRate,`${card.id}.baseRate`);
    if(card.unit==='points') number(card.centsPerPoint,`${card.id}.centsPerPoint`,{positive:true});
    if(card.categoryRates!==undefined){ assert(object(card.categoryRates),`${card.id}.categoryRates must be an object.`); for(const [category,rate] of Object.entries(card.categoryRates)){assert(category in CATEGORIES,`Unknown category ${category}.`);number(rate,`${card.id}.${category}`);}}
  }
  assert(config.offers===undefined || Array.isArray(config.offers),'offers must be a list.'); uniqueIds(config.offers||[],'offer');
  for(const offer of config.offers||[]) {
    assert(config.cards.some(c=>c.id===offer.card),`${offer.id}: unknown card ${offer.card}.`);
    assert(typeof offer.title==='string' && offer.title.trim(),`${offer.id} needs a title.`);
    assert(['total_rate','extra_rate','fixed_points','fixed_cash','percent_cashback'].includes(offer.kind),`${offer.id}: unknown kind.`);
    number(offer.value,`${offer.id}.value`); checkMatch(offer.match||{},`${offer.id}.match`);
    if(offer.kind==='fixed_points')assert(config.cards.find(c=>c.id===offer.card).unit==='points',`${offer.id}: fixed_points requires a points card.`);
    for(const key of ['minSpend','spendCap','rewardCap'])if(offer[key]!==undefined)number(offer[key],`${offer.id}.${key}`);
    assert(offer.spendCap===undefined || ['total_rate','extra_rate','percent_cashback'].includes(offer.kind),`${offer.id}: spendCap only applies to rate offers.`);
    for(const key of ['starts','expires'])if(offer[key]!==undefined)assert(validDate(offer[key]),`${offer.id}.${key} must be a real YYYY-MM-DD date.`);
    if(offer.starts && offer.expires)assert(offer.starts<=offer.expires,`${offer.id}: starts must not be after expires.`);
    if(offer.channel!==undefined)assert(['in_store','online','both'].includes(offer.channel),`${offer.id}: invalid channel.`);
    if(offer.enabled!==undefined)assert(typeof offer.enabled==='boolean',`${offer.id}.enabled must be true or false.`);
    if(offer.exclusiveGroup!==undefined){assert(typeof offer.exclusiveGroup==='string' && offer.exclusiveGroup.trim(),`${offer.id}.exclusiveGroup must be a nonempty string.`);assert(offer.kind!=='total_rate',`${offer.id}: total_rate offers already compete with each other; exclusiveGroup applies to additive offers only.`);}
  }
  assert(config.categoryOverrides===undefined || Array.isArray(config.categoryOverrides),'categoryOverrides must be a list.');
  for(const override of config.categoryOverrides||[]){assert(object(override),'Category override must be an object.');strings(override.merchants,'override.merchants');assert(override.category in CATEGORIES,'Invalid override category.');}
  return config;
}
export function merchantMatches(merchant, patterns) {
  const names=[merchant.name,merchant.brand,merchant.operator,...(merchant.aliases||[])];
  return patterns.some(pattern=>names.some(name=>containsName(name,pattern)));
}
export function matches(offer, merchant, channel='in_store') {
  const match=offer.match||{};
  return (!offer.channel || offer.channel==='both' || offer.channel===channel)
    && (!match.categories || match.categories.includes(merchant.category))
    && (!match.merchants || merchantMatches(merchant,match.merchants))
    && (!match.excludeMerchants || !merchantMatches(merchant,match.excludeMerchants));
}
export function offerState(offer, usedIds=[], date=localDate()) {
  if(offer.enabled===false) return 'disabled';
  if(usedIds.includes(offer.id)) return 'used';
  if(offer.starts && date<offer.starts) return 'upcoming';
  if(offer.expires && date>offer.expires) return 'expired';
  return 'active';
}
export function applyOverrides(merchant, overrides=[]) {
  const rule=overrides.find(x=>merchantMatches(merchant,x.merchants));
  return rule ? {...merchant, category:rule.category, categorySource:'Your merchant rule'} : {...merchant};
}
export function rateToCash(card, rate, spend) {
  return card.unit==='points' ? spend*rate*card.centsPerPoint/100 : spend*rate/100;
}
export function rankCards(config, merchant, amount, {channel='in_store', usedIds=[], date=localDate()}={}) {
  const hasAmount=typeof amount==='number' && Number.isFinite(amount) && amount>0;
  const spend=hasAmount?amount:100;
  return config.cards.map(card=>{
    const rate=card.categoryRates?.[merchant.category]??card.baseRate;
    const base=rateToCash(card,rate,spend);
    const eligible=(config.offers||[]).filter(o=>o.card===card.id && offerState(o,usedIds,date)==='active' && matches(o,merchant,channel));
    const candidates=hasAmount ? eligible.filter(o=>spend>=(o.minSpend??0)).map(o=>{
      const covered=Math.min(spend,o.spendCap??spend);
      let value=0;
      if(o.kind==='total_rate')value=rateToCash(card,Math.max(0,o.value-rate),covered);
      if(o.kind==='extra_rate')value=rateToCash(card,o.value,covered);
      if(o.kind==='fixed_points')value=o.value*card.centsPerPoint/100;
      if(o.kind==='fixed_cash')value=o.value;
      if(o.kind==='percent_cashback')value=covered*o.value/100;
      if(o.rewardCap!==undefined){const cap=['total_rate','extra_rate','fixed_points'].includes(o.kind)&&card.unit==='points'?o.rewardCap*card.centsPerPoint/100:o.rewardCap;value=Math.min(value,cap);}
      // All replacement rates compete. Additive offers stack unless assigned a common group.
      return {offer:o,value,group:o.kind==='total_rate'?'__replacement':(o.exclusiveGroup?`custom:${o.exclusiveGroup}`:null)};
    }).filter(x=>x.value>0):[];
    const picked=[], groups=new Map();
    for(const x of candidates){if(x.group){if(!groups.has(x.group)||groups.get(x.group).value<x.value)groups.set(x.group,x);}else picked.push(x);}
    picked.push(...groups.values());
    const total=base+picked.reduce((n,x)=>n+x.value,0);
    return {card,baseRate:rate,base,total,effectivePercent:total/spend*100,applied:picked,pending:eligible.filter(o=>!hasAmount || spend<(o.minSpend??0)),hasAmount};
  }).sort((a,b)=>b.total-a.total || a.card.name.localeCompare(b.card.name));
}

import { normalize } from './core.js';
export const DEFAULT_ENDPOINTS=['https://overpass-api.de/api/interpreter'];
export function distanceMeters(a,b){const rad=n=>n*Math.PI/180,R=6371000;const lat=rad(b.lat-a.lat),lon=rad(b.lon-a.lon);const x=Math.sin(lat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(lon/2)**2;return 2*R*Math.atan2(Math.sqrt(x),Math.sqrt(Math.max(0,1-x)));}
export function inferCategory(tags){
  if(tags.amenity==='fuel')return 'gas';
  if(['restaurant','cafe','fast_food','food_court','bar','pub','ice_cream'].includes(tags.amenity))return 'dining';
  if(tags.amenity==='pharmacy'||tags.shop==='chemist')return 'pharmacy';
  if(tags.shop==='wholesale'||tags.wholesale==='yes'||/\b(costco|sam s club|bj s wholesale)\b/.test(normalize(tags.brand||tags.name)))return 'wholesale';
  if(tags.shop==='supermarket')return 'groceries';
  if(['hardware','doityourself','trade'].includes(tags.shop))return 'home_improvement';
  if(['electronics','computer','mobile_phone'].includes(tags.shop))return 'electronics';
  if(['clothes','shoes','fashion'].includes(tags.shop))return 'clothing';
  if(tags.shop==='department_store')return 'department';
  if(['hotel','motel','guest_house','hostel'].includes(tags.tourism))return 'hotel';
  if(tags.shop==='travel_agency'||tags.amenity==='car_rental')return 'travel';
  if(['cinema','theatre'].includes(tags.amenity)||['theme_park','museum'].includes(tags.tourism))return 'entertainment';
  // Convenience stores and general retailers intentionally stay "other".
  return 'other';
}
export function makeQuery(lat,lon,radius){
  if(!Number.isFinite(lat)||Math.abs(lat)>90||!Number.isFinite(lon)||Math.abs(lon)>180||![200,500,1000].includes(radius))throw new Error('Invalid search coordinates or radius.');
  return `[out:json][timeout:20];(nwr(around:${radius},${lat},${lon})["shop"];nwr(around:${radius},${lat},${lon})["amenity"~"^(fuel|restaurant|cafe|fast_food|food_court|bar|pub|ice_cream|pharmacy|car_rental|cinema|theatre)$"];nwr(around:${radius},${lat},${lon})["tourism"~"^(hotel|motel|guest_house|hostel|theme_park|museum)$"];);out center tags;`;
}
export function parsePlaces(data,location){
  if(!data||!Array.isArray(data.elements))throw new Error('The business service returned an unexpected response.');
  if(data.remark)throw new Error('The business service could not complete the search. Please try again later.');
  const results=[];
  for(const element of data.elements){
    const t=element.tags||{}, lat=element.lat??element.center?.lat,lon=element.lon??element.center?.lon;
    if(!Number.isFinite(lat)||!Number.isFinite(lon)||!['node','way','relation'].includes(element.type)||!Number.isInteger(element.id))continue;
    if(t.shop==='vacant'||t.disused==='yes'||t.abandoned==='yes'||t['disused:shop'])continue;
    const name=t.name||t.brand||t.operator;if(!name)continue;
    const p={id:`${element.type}/${element.id}`,name,brand:t.brand||'',operator:t.operator||'',aliases:[t.alt_name,t.short_name,t['name:en']].filter(Boolean).flatMap(x=>x.split(';')),category:inferCategory(t),categorySource:'Estimated from OpenStreetMap',lat,lon,address:[t['addr:housenumber'],t['addr:street']].filter(Boolean).join(' '),distance:distanceMeters(location,{lat,lon})};
    // A building and POI node often describe the same shop; keep the closer one.
    const duplicate=results.findIndex(x=>normalize(x.name)===normalize(p.name)&&distanceMeters(x,p)<40);
    if(duplicate>=0){if(results[duplicate].distance>p.distance)results[duplicate]=p;}else results.push(p);
  }
  return results.sort((a,b)=>a.distance-b.distance);
}
export async function fetchNearby(location,radius,endpoints=DEFAULT_ENDPOINTS){
  const body=new URLSearchParams({data:makeQuery(location.lat,location.lon,radius)});
  let lastError;
  for(const endpoint of endpoints){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),26000);
    try{const response=await fetch(endpoint,{method:'POST',body,credentials:'omit',signal:controller.signal});if(!response.ok)throw new Error(`Business service HTTP ${response.status}.`);return parsePlaces(await response.json(),location);}
    catch(error){lastError=error;}finally{clearTimeout(timer);}
  }
  throw new Error(`${lastError?.name==='AbortError'?'Business lookup timed out.':lastError?.message||'Business lookup failed.'} Try again later, expand the radius, or choose a category manually.`);
}
export const DEMO_PLACES=[
  {id:'demo-chevron',name:'Chevron',brand:'Chevron',category:'gas',categorySource:'Sample business',distance:65},
  {id:'demo-publix',name:'Publix Super Market',brand:'Publix',category:'groceries',categorySource:'Sample business',distance:120},
  {id:'demo-cafe',name:'Neighborhood Café',category:'dining',categorySource:'Sample business',distance:155},
  {id:'demo-costco',name:'Costco Wholesale',brand:'Costco',category:'wholesale',categorySource:'Sample business',distance:230}
];

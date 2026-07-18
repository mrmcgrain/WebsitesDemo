const data = window.LEADS_DASHBOARD_DATA || {summary:{}, leads:[], batches:[], rejected:[]};
const $ = (id) => document.getElementById(id);
const state = { search:'', category:'all', query:'all', rating:0, sort:'score', selected:null };
const fmt = new Intl.NumberFormat();
const clean = (v) => (v ?? '').toString().trim();
const unique = (arr) => [...new Set(arr.filter(Boolean))].sort((a,b)=>a.localeCompare(b));
const tel = (phone) => 'tel:' + clean(phone).replace(/[^+\d]/g,'');
function setOptions(select, values, allLabel){ select.innerHTML = `<option value="all">${allLabel}</option>` + values.map(v=>`<option value="${escapeAttr(v)}">${escapeHtml(v)}</option>`).join(''); }
function escapeHtml(s){ return clean(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function escapeAttr(s){ return escapeHtml(s); }
function init(){
  $('stat-leads').textContent = fmt.format(data.summary.lead_count || data.leads.length);
  $('stat-files').textContent = fmt.format(data.summary.file_count || data.batches.length);
  $('stat-rejected').textContent = fmt.format(data.summary.rejected_count || data.rejected.length);
  const avg = data.leads.reduce((a,l)=>a+(Number(l.rating)||0),0)/(data.leads.length||1);
  $('stat-avg').textContent = avg ? avg.toFixed(1) : '—';
  $('last-generated').textContent = data.summary.generated_at ? `Data bundle generated ${new Date(data.summary.generated_at).toLocaleString()}` : 'Generated data bundle unavailable';
  setOptions($('category'), unique(data.leads.map(l=>l.category || 'Unknown')), 'All categories');
  setOptions($('query'), unique(data.leads.map(l=>l.query || 'Unknown query')), 'All queries');
  ['search','category','query','rating','sort'].forEach(id => $(id).addEventListener(id==='search'?'input':'change', (event)=>{ state[id] = id==='rating' ? Number(event.target.value) : event.target.value; render(); }));
  $('export-csv').addEventListener('click', copyCsv);
  renderBatches(); render();
}
function filtered(){
  const q = state.search.toLowerCase();
  let rows = data.leads.filter(l => {
    const hay = [l.name,l.category,l.phone,l.address,l.query,(l.social_links&&Object.values(l.social_links).join(' '))].join(' ').toLowerCase();
    return (!q || hay.includes(q)) && (state.category==='all' || (l.category||'Unknown')===state.category) && (state.query==='all' || (l.query||'Unknown query')===state.query) && (Number(l.rating)||0) >= state.rating;
  });
  const by = {score:l=>Number(l.priority_score)||0, reviews:l=>Number(l.review_count)||0, rating:l=>Number(l.rating)||0, name:l=>clean(l.name).toLowerCase()};
  rows.sort((a,b)=> state.sort==='name' ? by.name(a).localeCompare(by.name(b)) : by[state.sort](b)-by[state.sort](a));
  return rows;
}
function render(){
  const rows = filtered();
  $('result-count').textContent = `${fmt.format(rows.length)} of ${fmt.format(data.leads.length)} leads shown`;
  if(!state.selected || !rows.some(l=>l.place_id===state.selected)) state.selected = rows[0]?.place_id || null;
  $('lead-list').innerHTML = rows.length ? rows.map(card).join('') : '<div class="empty-state">No leads match these filters.</div>';
  document.querySelectorAll('.lead-card').forEach(btn => btn.addEventListener('click', () => { state.selected = btn.dataset.id; renderDetail(); document.querySelectorAll('.lead-card').forEach(b=>b.setAttribute('aria-selected', b.dataset.id===state.selected)); }));
  renderDetail();
}
function card(l){
  const selected = l.place_id === state.selected;
  const noSite = !clean(l.website);
  return `<button class="lead-card" role="listitem" type="button" data-id="${escapeAttr(l.place_id)}" aria-selected="${selected}"><span><h3>${escapeHtml(l.name)}</h3><p>${escapeHtml(l.category)} · ${escapeHtml(l.address)}</p><div class="chips"><span class="chip ${noSite?'good':''}">${noSite?'No website':'Has website'}</span><span class="chip">★ ${escapeHtml(l.rating)} (${fmt.format(l.review_count||0)})</span><span class="chip">${escapeHtml(l.query)}</span></div></span><span class="score-pill">${l.priority_score}</span></button>`;
}
function renderDetail(){
  const lead = data.leads.find(l=>l.place_id===state.selected);
  $('detail-empty').hidden = !!lead; $('detail-content').hidden = !lead; if(!lead) return;
  $('detail-score').textContent = `${lead.priority_score} priority`;
  $('detail-source').textContent = lead.source_files?.length > 1 ? `${lead.source_files.length} source files` : lead.source_file;
  $('detail-title').textContent = lead.name || 'Unnamed lead';
  $('detail-meta').textContent = `${lead.category || 'Uncategorized'} · ${lead.business_status || 'Unknown status'} · ${lead.address || 'No address'}`;
  $('call-link').href = lead.phone ? tel(lead.phone) : '#'; $('call-link').textContent = lead.phone ? `Call ${lead.phone}` : 'No phone';
  $('call-link').toggleAttribute('aria-disabled', !lead.phone);
  $('maps-link').href = lead.google_maps_url || '#';
  const socials = lead.social_links || {};
  const socialLinks = Object.entries(socials).filter(([,v])=>v).map(([k,v])=>`<a href="${escapeAttr(v)}" target="_blank" rel="noreferrer">${escapeHtml(k)}</a>`).join(', ') || 'None found';
  $('facts').innerHTML = `<dt>Website</dt><dd>${clean(lead.website) ? `<a href="${escapeAttr(lead.website)}" target="_blank" rel="noreferrer">${escapeHtml(lead.website)}</a>` : 'No website in source record'}</dd><dt>Phone</dt><dd>${escapeHtml(lead.phone || 'Missing')}</dd><dt>Rating</dt><dd>★ ${escapeHtml(lead.rating)} from ${fmt.format(lead.review_count||0)} reviews</dd><dt>Social</dt><dd>${socialLinks}</dd><dt>Photos</dt><dd>${fmt.format(lead.photo_count||0)} Google photo references</dd><dt>Source</dt><dd>${escapeHtml((lead.source_files||[lead.source_file]).join(', '))}</dd>`;
  const hours = lead.hours?.weekdayDescriptions || [];
  $('hours').innerHTML = hours.length ? hours.map(h=>`<li>${escapeHtml(h)}</li>`).join('') : '<li>No weekly hours in source record.</li>';
  const reviews = (lead.reviews || []).slice(0,3);
  const snippet = (text) => { const value = clean(text || 'No text review'); return value.length > 260 ? value.slice(0,257).trim() + '…' : value; };
  $('reviews').innerHTML = reviews.length ? reviews.map(r=>`<article class="review"><strong>★ ${escapeHtml(r.rating)} · ${escapeHtml(r.author || 'Google reviewer')} <span class="muted">${escapeHtml(r.relative_time || '')}</span></strong><p>${escapeHtml(snippet(r.text))}</p></article>`).join('') : '<p class="muted">No review snippets in source record.</p>';
}
function renderBatches(){
  const reasons = data.rejected.reduce((acc,r)=>{ acc[r.reason||'Unknown']=(acc[r.reason||'Unknown']||0)+1; return acc; },{});
  const reasonText = Object.entries(reasons).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`${k}: ${fmt.format(v)}`).join(' · ');
  $('batch-list').innerHTML = data.batches.map(b=>`<article class="batch-item"><strong>${escapeHtml(b.query || b.file)}</strong><p>${fmt.format(b.lead_count||0)} leads · ${fmt.format(b.rejected_count_actual||0)} rejected · ${escapeHtml(b.file)}</p></article>`).join('') + `<article class="batch-item"><strong>Top rejection reasons</strong><p>${escapeHtml(reasonText || 'None')}</p></article>`;
}
function copyCsv(){
  const rows = filtered();
  const headers = ['name','category','phone','rating','review_count','address','google_maps_url','query','priority_score'];
  const csv = [headers.join(','), ...rows.map(l=>headers.map(h=>`"${clean(l[h]).replace(/"/g,'""')}"`).join(','))].join('\n');
  navigator.clipboard?.writeText(csv).then(()=>{$('export-csv').textContent='Copied CSV'; setTimeout(()=>$('export-csv').textContent='Copy CSV',1500);}).catch(()=>alert(csv));
}
init();

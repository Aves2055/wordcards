let savedWords = JSON.parse(localStorage.getItem('wh_saved') || '[]');
let settings = JSON.parse(localStorage.getItem('wh_cfg') || '{"lang":"hi","theme":"light","showTrl":true}');
let translationCache = JSON.parse(localStorage.getItem('wh_tr_cache') || '{}');
let currentResult = null;

// Built-in word family nuances database
const WORD_FAMILIES = {
  ego: {
    base: "ego",
    summary: "Roots centered around 'self' or 'I'. The distinction lies in whether it describes internal self-identity, self-serving actions, verbal boastfulness, or obsessive psychological fixation.",
    members: [
      { word: "ego", role: "concept", pos: "noun", desc: "Your sense of self-esteem and identity. Neutral by itself." },
      { word: "egoist", role: "person", pos: "noun", desc: "A self-centered person whose ACTIONS always put their own interest first." },
      { word: "egotist", role: "person", pos: "noun", desc: "A boastful person who SPEAKS constantly about themselves and brags." },
      { word: "egoism", role: "concept", pos: "noun", desc: "The ethical theory or practice of acting solely in one's self-interest." },
      { word: "egotism", role: "concept", pos: "noun", desc: "Excessive self-importance and non-stop talk about oneself." },
      { word: "egomaniac", role: "condition", pos: "noun", desc: "A person with an extreme, obsessive fixation on their own power/importance." },
      { word: "egomaniacal", role: "attribute", pos: "adjective", desc: "Exhibiting morbidly excessive self-centeredness or mania." }
    ]
  },
  empathy: {
    base: "path",
    summary: "Words derived from 'pathos' (feeling/suffering). Differ by how emotional connection is shared or felt.",
    members: [
      { word: "empathy", role: "concept", pos: "noun", desc: "Truly understanding and sharing another's feelings from their perspective." },
      { word: "sympathy", role: "concept", pos: "noun", desc: "Feeling pity or compassion for someone else's trouble." },
      { word: "apathy", role: "condition", pos: "noun", desc: "Complete lack of feeling, interest, or emotional concern." },
      { word: "antipathy", role: "concept", pos: "noun", desc: "A deep-seated, natural feeling of dislike or aversion." }
    ]
  }
};

function saveStorage() {
  localStorage.setItem('wh_saved', JSON.stringify(savedWords));
  localStorage.setItem('wh_cfg', JSON.stringify(settings));
  localStorage.setItem('wh_tr_cache', JSON.stringify(translationCache));
  updateSavedCount();
}

function updateSavedCount() {
  const el = document.getElementById('saved-count');
  if(el) el.textContent = savedWords.length;
}

function applyTheme() {
  document.documentElement.dataset.t = settings.theme === 'dark' ? 'd' : 'l';
  const langEl = document.getElementById('langSelect');
  if(langEl) langEl.value = settings.lang || 'hi';
  const trlEl = document.getElementById('showTrlToggle');
  if(trlEl) trlEl.checked = settings.showTrl !== false;
}

function setTab(tab) {
  ['search', 'saved', 'settings'].forEach(t => {
    const tabEl = document.getElementById('tab-' + t);
    const navEl = document.getElementById('nav-' + t);
    if(tabEl) tabEl.style.display = (t === tab) ? 'block' : 'none';
    if(navEl) navEl.classList.toggle('on', t === tab);
  });
  if(tab === 'saved') renderSaved();
}

function toggleTheme(t) {
  settings.theme = t;
  saveStorage();
  applyTheme();
}

function updateSettings() {
  settings.lang = document.getElementById('langSelect').value;
  settings.showTrl = document.getElementById('showTrlToggle').checked;
  saveStorage();
  if(currentResult) renderResult(currentResult);
}

// Inline Translation Fetcher (MyMemory)
async function fetchTranslation(text, lang) {
  if(!text || lang === 'en') return '';
  const key = `${lang}:${text.trim().toLowerCase()}`;
  if(translationCache[key]) return translationCache[key];
  
  try {
    const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text.slice(0, 300))}&langpair=en|${lang}`);
    const data = await res.json();
    const tr = data?.responseData?.translatedText;
    if(tr && !/MYMEMORY WARNING|INVALID/i.test(tr)) {
      translationCache[key] = tr;
      saveStorage();
      return tr;
    }
  } catch(e) {}
  return '';
}

// Main Lookup Function
async function doSearch(term) {
  const query = (term || document.getElementById('searchInput').value).trim().toLowerCase();
  if(!query) return;
  document.getElementById('searchInput').value = query;
  
  const container = document.getElementById('searchResults');
  container.innerHTML = `<div class="card mute">Searching dictionary & analyzing connections for "<b>${query}</b>"...</div>`;
  
  try {
    const [dictRes, synRes, antRes] = await Promise.allSettled([
      fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(query)}`).then(r => r.ok ? r.json() : null),
      fetch(`https://api.datamuse.com/words?rel_syn=${encodeURIComponent(query)}&max=8`).then(r => r.json()),
      fetch(`https://api.datamuse.com/words?rel_ant=${encodeURIComponent(query)}&max=6`).then(r => r.json())
    ]);
    
    const entry = (dictRes.status === 'fulfilled' && Array.isArray(dictRes.value)) ? dictRes.value[0] : null;
    const synonyms = synRes.status === 'fulfilled' ? synRes.value.map(x => x.word) : [];
    const antonyms = antRes.status === 'fulfilled' ? antRes.value.map(x => x.word) : [];
    
    currentResult = {
      word: query,
      phonetic: entry?.phonetic || (entry?.phonetics?.find(p=>p.text)?.text) || '',
      audio: entry?.phonetics?.find(p=>p.audio)?.audio || '',
      meanings: entry?.meanings || [],
      synonyms: [...new Set(synonyms)],
      antonyms: [...new Set(antonyms)]
    };

    renderResult(currentResult);
  } catch(e) {
    container.innerHTML = `<div class="card">Could not load details for "${query}". Check network.</div>`;
  }
}

async function renderResult(res) {
  const isSaved = savedWords.some(w => w.word === res.word);
  
  let defsHtml = '';
  if(res.meanings.length) {
    for (const m of res.meanings.slice(0, 3)) {
      const firstDef = m.definitions[0];
      if(!firstDef) continue;
      
      let trDefHtml = '', trExHtml = '';
      if(settings.showTrl) {
        const trDef = await fetchTranslation(firstDef.definition, settings.lang);
        if(trDef) trDefHtml = `<div class="inline-trl"><small>${settings.lang}</small> ${trDef}</div>`;
        
        if(firstDef.example) {
          const trEx = await fetchTranslation(firstDef.example, settings.lang);
          if(trEx) trExHtml = `<div class="inline-trl"><small>${settings.lang}</small> ${trEx}</div>`;
        }
      }
      
      defsHtml += `
        <div class="def-box">
          <span class="pos-tag">${m.partOfSpeech}</span>
          <div style="font-size:15px; font-weight:500;">${firstDef.definition}</div>
          ${trDefHtml}
          ${firstDef.example ? `<div class="ex">"${firstDef.example}"</div>${trExHtml}` : ''}
        </div>
      `;
    }
  } else {
    defsHtml = `<div class="mute" style="padding:10px 0;">No direct dictionary definition found, but related terms are shown below.</div>`;
  }

  const linkedSaved = savedWords.filter(w => {
    if(w.word === res.word) return false;
    const isSyn = res.synonyms.includes(w.word) || (w.synonyms && w.synonyms.includes(res.word));
    const isAnt = res.antonyms.includes(w.word) || (w.antonyms && w.antonyms.includes(res.word));
    const isFam = w.word.slice(0, 4) === res.word.slice(0, 4);
    return isSyn || isAnt || isFam;
  });

  const familyKey = Object.keys(WORD_FAMILIES).find(k => res.word.startsWith(k) || WORD_FAMILIES[k].members.some(m=>m.word===res.word));
  const familyData = familyKey ? WORD_FAMILIES[familyKey] : null;

  document.getElementById('searchResults').innerHTML = `
    <div class="card">
      <div class="row" style="justify-content:space-between">
        <div>
          <h2 style="margin:0; font-size:26px; font-weight:800;">${res.word}</h2>
          <span class="mute">${res.phonetic}</span>
        </div>
        <div class="row">
          ${res.audio ? `<button class="btn" onclick="new Audio('${res.audio}').play()">🔊 Pronounce</button>` : ''}
          <button class="btn ${isSaved?'':'btn-pri'}" onclick="toggleSaveCurrent()">
            ${isSaved ? 'Saved ✓' : '+ Save Word'}
          </button>
        </div>
      </div>
      <div style="margin-top:14px;">${defsHtml}</div>
    </div>

    ${familyData ? `
      <div class="card" style="border-left: 4px solid var(--acc);">
        <h3 style="margin-top:0; color:var(--acc);">💡 Word Family & Nuance Breakdown</h3>
        <p class="mute" style="margin-bottom:10px;">${familyData.summary}</p>
        <div class="nuance-grid">
          ${familyData.members.map(m => `
            <div class="nuance-card" style="${m.word===res.word?'border-color:var(--acc); background:var(--accb);':''}">
              <div class="row" style="justify-content:space-between; margin-bottom:6px;">
                <b onclick="doSearch('${m.word}')">${m.word}</b>
                <span class="badge ${m.role}">${m.role}</span>
              </div>
              <div style="font-size:13px;">${m.desc}</div>
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}

    <div class="card">
      <h3 style="margin-top:0">Synonyms & Antonyms</h3>
      <div>
        <b>Synonyms: </b>
        ${res.synonyms.map(s => `<span class="pill ok" onclick="doSearch('${s}')">${s}</span>`).join('') || '<span class="mute">None</span>'}
      </div>
      <div style="margin-top:8px;">
        <b>Antonyms: </b>
        ${res.antonyms.map(a => `<span class="pill bad" onclick="doSearch('${a}')">${a}</span>`).join('') || '<span class="mute">None</span>'}
      </div>
    </div>

    <div class="card">
      <h3 style="margin-top:0">Visual Connection Graph (Saved Dictionary Links)</h3>
      <p class="mute" style="margin-top:-6px; margin-bottom:12px;">Shows how <b>${res.word}</b> links to words in your saved dictionary database.</p>
      ${renderConnectionMap(res, linkedSaved)}
    </div>
  `;
}

function renderConnectionMap(centerRes, linkedItems) {
  if(!linkedItems.length) {
    return `<div class="mute" style="padding:20px; text-align:center; background:var(--bg); border-radius:10px;">No direct links found with your current saved dictionary. Save more related words to build your network!</div>`;
  }
  
  let svg = `<svg viewBox="0 0 440 240">`;
  const cx = 220, cy = 120, R = 85;
  
  linkedItems.slice(0, 8).forEach((item, i) => {
    const angle = (2 * Math.PI * i) / Math.min(8, linkedItems.length);
    const x = cx + R * Math.cos(angle);
    const y = cy + R * Math.sin(angle);
    
    const isSyn = centerRes.synonyms.includes(item.word);
    const isAnt = centerRes.antonyms.includes(item.word);
    
    let strokeColor = 'var(--acc)';
    let strokeDash = '';
    let nodeBg = 'var(--accb)';
    let nodeColor = 'var(--acc)';
    
    if(isSyn) {
      strokeColor = 'var(--ok)';
      nodeBg = 'var(--okb)';
      nodeColor = 'var(--ok)';
    } else if(isAnt) {
      strokeColor = 'var(--bad)';
      strokeDash = 'stroke-dasharray="4"';
      nodeBg = 'var(--badb)';
      nodeColor = 'var(--bad)';
    }
    
    svg += `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="${strokeColor}" ${strokeDash} stroke-width="2.5" opacity="0.8"/>`;
    svg += `<g onclick="doSearch('${item.word}')" style="cursor:pointer">`;
    svg += `<circle cx="${x}" cy="${y}" r="22" fill="${nodeBg}" stroke="${strokeColor}" stroke-width="1.5"/>`;
    svg += `<text x="${x}" y="${y+4}" text-anchor="middle" font-size="11" font-weight="600" fill="${nodeColor}">${item.word.length>7?item.word.slice(0,6)+'..':item.word}</text>`;
    svg += `</g>`;
  });
  
  svg += `<circle cx="${cx}" cy="${cy}" r="30" fill="var(--acc)" stroke="var(--card)" stroke-width="3"/>`;
  svg += `<text x="${cx}" y="${cy+5}" text-anchor="middle" font-size="13" fill="var(--on)" font-weight="bold">${centerRes.word.length>8?centerRes.word.slice(0,7)+'..':centerRes.word}</text>`;
  svg += `</svg>`;
  
  const legend = `
    <div class="legend">
      <span><span class="legend-dot" style="background:var(--ok)"></span> Green = Synonym</span>
      <span><span class="legend-dot" style="background:var(--bad)"></span> Red (Dashed) = Antonym</span>
      <span><span class="legend-dot" style="background:var(--acc)"></span> Blue = Family Root</span>
    </div>
  `;
  
  return svg + legend;
}

function toggleSaveCurrent() {
  if(!currentResult) return;
  const idx = savedWords.findIndex(w => w.word === currentResult.word);
  if(idx >= 0) {
    savedWords.splice(idx, 1);
  } else {
    savedWords.push(currentResult);
  }
  saveStorage();
  renderResult(currentResult);
}

function renderSaved() {
  const filter = document.getElementById('savedFilter').value.toLowerCase();
  const list = savedWords.filter(w => w.word.toLowerCase().includes(filter));
  
  const html = list.map(w => `
    <div class="card">
      <div class="row" style="justify-content:space-between">
        <div>
          <h3 style="margin:0; font-size:18px; color:var(--acc); cursor:pointer;" onclick="setTab('search'); doSearch('${w.word}')">${w.word}</h3>
          <div class="mute" style="margin-top:4px;">${w.meanings[0]?.definitions[0]?.definition || 'No definition saved.'}</div>
        </div>
        <button class="btn" onclick="removeSaved('${w.word}')">Remove</button>
      </div>
    </div>
  `).join('');
  
  document.getElementById('savedList').innerHTML = html || '<div class="card mute">No saved words found.</div>';
}

function removeSaved(word) {
  savedWords = savedWords.filter(w => w.word !== word);
  saveStorage();
  renderSaved();
}

function exportData() {
  const blob = new Blob([JSON.stringify(savedWords, null, 2)], {type: 'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'my-word-hub-backup.json';
  a.click();
}

document.addEventListener('DOMContentLoaded', () => {
  applyTheme();
  updateSavedCount();
});

/* WordHub Master Application Engine */
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const LS = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const SV = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
const JD = (k, d) => { try { return JSON.parse(LS(k)) || d; } catch (e) { return d; } };

let words = JD("wh_words", []);
let cfg = Object.assign({ theme: "auto", lang: "hi", voice: "en-US", rate: "0.9" }, JD("wh_cfg", {}));
let translationCache = JD("wh_tr_cache", {});
let currentTab = "home";
let practicePhase = "beginner";
let currentQuiz = null;

function toast(t) {
  const e = $("toast");
  if (!e) return;
  e.textContent = t;
  e.classList.add("on");
  setTimeout(() => e.classList.remove("on"), 1800);
}

function say(text) {
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = cfg.voice;
    u.rate = parseFloat(cfg.rate) || 0.9;
    speechSynthesis.speak(u);
  } catch (e) {
    toast("Voice synthesis unavailable");
  }
}

function applyTheme() {
  const d = cfg.theme === "dark" || (cfg.theme === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.t = d ? "d" : "l";
}

function setTab(tab) {
  currentTab = tab;
  render();
  window.scrollTo(0, 0);
}

// Built-in Practice Bank for Random Web-Pushed Tests
const PRACTICE_BANK = {
  beginner: [
    { type: "blank", word: "brave", question: "The ___ firefighter entered the burning building.", opts: ["brave", "timid", "fragile", "reluctant"], ans: "brave", pos: "Adjective", def: "Ready to face danger without fear." },
    { type: "blank", word: "polite", question: "It is always ___ to say thank you.", opts: ["polite", "hostile", "rude", "harsh"], ans: "polite", pos: "Adjective", def: "Having or showing good manners." },
    { type: "pos", word: "gather", question: "What part of speech is 'gather' in: 'Please gather your books.'?", opts: ["Verb", "Noun", "Adjective", "Adverb"], ans: "Verb", pos: "Verb", def: "To bring together in one place." },
    { type: "syn", word: "rapid", question: "Which word is a synonym for 'rapid'?", opts: ["quick", "slow", "heavy", "clumsy"], ans: "quick", pos: "Adjective", def: "Happening or moving with great speed." }
  ],
  intermediate: [
    { type: "blank", word: "diligent", question: "A ___ student revises their notes every evening.", opts: ["diligent", "careless", "slothful", "vague"], ans: "diligent", pos: "Adjective", def: "Showing care and effort in work." },
    { type: "syn", word: "ambiguous", question: "Which word is closest in meaning to 'ambiguous'?", opts: ["unclear", "precise", "definite", "obvious"], ans: "unclear", pos: "Adjective", def: "Open to more than one interpretation." },
    { type: "ant", word: "scarce", question: "Which word is the opposite of 'scarce'?", opts: ["abundant", "rare", "few", "limited"], ans: "abundant", pos: "Adjective", def: "Insufficient to satisfy the need or demand." }
  ],
  hard: [
    { type: "blank", word: "ephemeral", question: "Fame in the digital age is often ___, lasting only a few days.", opts: ["ephemeral", "permanent", "enduring", "eternal"], ans: "ephemeral", pos: "Adjective", def: "Lasting for a very short time." },
    { type: "syn", word: "ubiquitous", question: "Which word means 'found everywhere'?", opts: ["ubiquitous", "isolated", "sparse", "hidden"], ans: "ubiquitous", pos: "Adjective", def: "Present, appearing, or found everywhere." },
    { type: "pos", word: "sycophant", question: "Identify the part of speech for 'sycophant'.", opts: ["Noun", "Verb", "Adjective", "Preposition"], ans: "Noun", pos: "Noun", def: "A person who acts obsequiously toward someone important to gain advantage." }
  ]
};

// Grammar Notes Data for "Learn" Tab
const GRAMMAR_NOTES = [
  { title: "Tenses Overview", desc: "Understand Past, Present, and Future sentence structures.", content: "Tenses express the time of action. <br><b>Present Simple:</b> Habits/facts (<i>'She writes every day.'</i>)<br><b>Past Simple:</b> Completed past events (<i>'She wrote yesterday.'</i>)<br><b>Future Simple:</b> Intentions (<i>'She will write tomorrow.'</i>)" },
  { title: "Modal Verbs", desc: "Master 'Can', 'Could', 'May', 'Might', 'Must', 'Should'.", content: "Modal verbs express necessity, permission, ability, or possibility.<br><b>Ability:</b> Can / Could<br><b>Permission:</b> May / Can<br><b>Obligation:</b> Must / Should" },
  { title: "Prepositions of Place & Time", desc: "Using 'In', 'On', 'At' correctly.", content: "<b>AT:</b> Specific times or points (<i>at 5 PM, at the door</i>).<br><b>ON:</b> Days and surfaces (<i>on Monday, on the table</i>).<br><b>IN:</b> Months, years, enclosed spaces (<i>in July, in the room</i>)." },
  { title: "Articles (A, An, The)", desc: "Definite vs. Indefinite usage rules.", content: "<b>A / AN:</b> Indefinite (singular countable nouns). Use <b>An</b> before vowel sounds.<br><b>THE:</b> Definite (specific items known to listener/reader)." }
];

// Views Renders
function renderHome() {
  return `
    <div class="card hero-card">
      <h2>Welcome to WordHub 👋</h2>
      <p class="mute">Master English vocabulary, explore morphology, practice random quizzes, and study comprehensive grammar notes.</p>
    </div>

    <div class="stats-grid">
      <div class="stat-box"><b>${words.length}</b>Saved Words</div>
      <div class="stat-box"><b>4 Tiers</b>Grammar Notes</div>
      <div class="stat-box"><b>3 Levels</b>Practice Hub</div>
    </div>

    <div class="card">
      <h3>🔍 Quick Word Search</h3>
      <div class="row">
        <input type="text" id="homeSearchInput" placeholder="Search any English word..." class="grow" onkeydown="if(event.key==='Enter') doSearch($('homeSearchInput').value)">
        <button class="pri" onclick="doSearch($('homeSearchInput').value)">Search</button>
      </div>
    </div>

    <div class="card">
      <h3>🚀 Quick Navigation</h3>
      <div class="row">
        <button onclick="setTab('search')">🔍 Word Search</button>
        <button onclick="setTab('practice')">🎯 Practice Hub</button>
        <button onclick="setTab('learn')">📖 Grammar Notes</button>
        <button onclick="setTab('saved')">📚 My Saved Deck</button>
      </div>
    </div>
  `;
}

function renderSearch() {
  return `
    <h2>Word Search & Insights</h2>
    <div class="card">
      <div class="row">
        <input type="text" id="searchInput" placeholder="Type a word (e.g. ego, brave, diligent)..." class="grow" onkeydown="if(event.key==='Enter') doSearch($('searchInput').value)">
        <button class="pri" onclick="doSearch($('searchInput').value)">Search</button>
      </div>
    </div>
    <div id="searchResults"></div>
  `;
}

async function doSearch(term) {
  if (!term || !term.trim()) return;
  const q = term.trim().toLowerCase();
  setTab('search');
  const container = $('searchResults');
  if (!container) return;

  container.innerHTML = `<div class="card mute">Searching live dictionary data for "<b>${esc(q)}</b>"...</div>`;

  try {
    const [dictRes, synRes, antRes] = await Promise.allSettled([
      fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(q)}`).then(r => r.ok ? r.json() : null),
      fetch(`https://api.datamuse.com/words?rel_syn=${encodeURIComponent(q)}&max=8`).then(r => r.json()),
      fetch(`https://api.datamuse.com/words?rel_ant=${encodeURIComponent(q)}&max=6`).then(r => r.json())
    ]);

    const entry = (dictRes.status === 'fulfilled' && Array.isArray(dictRes.value)) ? dictRes.value[0] : null;
    const synonyms = synRes.status === 'fulfilled' ? synRes.value.map(x => x.word) : [];
    const antonyms = antRes.status === 'fulfilled' ? antRes.value.map(x => x.word) : [];

    const res = {
      word: q,
      phonetic: entry?.phonetic || (entry?.phonetics?.find(p=>p.text)?.text) || '',
      audio: entry?.phonetics?.find(p=>p.audio)?.audio || '',
      meanings: entry?.meanings || [],
      synonyms: [...new Set(synonyms)],
      antonyms: [...new Set(antonyms)]
    };

    renderSearchResult(res);
  } catch(e) {
    container.innerHTML = `<div class="card">Could not load details for "${esc(q)}". Please check network connection.</div>`;
  }
}

function renderSearchResult(res) {
  const container = $('searchResults');
  const isSaved = words.some(w => w.word === res.word);

  let defsHtml = '';
  if (res.meanings.length) {
    res.meanings.forEach(m => {
      const d = m.definitions[0];
      if (d) {
        defsHtml += `
          <div class="def">
            <span class="tag">${esc(m.partOfSpeech)}</span>
            <div style="font-weight:600; margin-top:4px;">${esc(d.definition)}</div>
            ${d.example ? `<div class="ex">"${esc(d.example)}"</div>` : ''}
          </div>
        `;
      }
    });
  } else {
    defsHtml = `<div class="mute">No direct dictionary entry found. Related terms shown below.</div>`;
  }

  container.innerHTML = `
    <div class="card">
      <div class="row" style="justify-content:space-between;">
        <div>
          <h2 style="margin:0;">${esc(res.word)}</h2>
          <span class="mute">${esc(res.phonetic)}</span>
        </div>
        <div class="row">
          ${res.audio ? `<button class="sm" onclick="new Audio('${res.audio}').play()">🔊 Pronounce</button>` : `<button class="sm" onclick="say('${res.word}')">🔊 Pronounce</button>`}
          <button class="sm ${isSaved ? '' : 'pri'}" onclick="toggleSaveWord('${esc(res.word)}', '${esc(res.meanings[0]?.definitions[0]?.definition || '')}')">
            ${isSaved ? 'Saved ✓' : '+ Save Word'}
          </button>
        </div>
      </div>
      <div style="margin-top:16px;">${defsHtml}</div>
    </div>

    <details open class="card">
      <summary>Synonyms &amp; Antonyms Accordion</summary>
      <div style="margin-top:12px;">
        <b>Synonyms: </b>
        ${res.synonyms.map(s => `<span class="pill ok" onclick="doSearch('${esc(s)}')">${esc(s)}</span>`).join('') || '<span class="mute">None found</span>'}
      </div>
      <div style="margin-top:12px;">
        <b>Antonyms: </b>
        ${res.antonyms.map(a => `<span class="pill bad" onclick="doSearch('${esc(a)}')">${esc(a)}</span>`).join('') || '<span class="mute">None found</span>'}
      </div>
    </details>
  `;
}

function toggleSaveWord(word, def) {
  const idx = words.findIndex(w => w.word === word);
  if (idx >= 0) {
    words.splice(idx, 1);
    toast("Word removed from deck");
  } else {
    words.push({ word, def, added: Date.now() });
    toast("Word saved to deck ✓");
  }
  SV("wh_words", words);
  doSearch(word);
}

function renderPractice() {
  if (!currentQuiz) {
    return `
      <h2>Practice Hub (3 Difficulty Phases)</h2>
      <div class="card">
        <h3>Select Difficulty Tier</h3>
        <div class="row">
          <button class="pill ${practicePhase === 'beginner' ? 'on' : ''}" onclick="setPhase('beginner')">🟢 Beginner</button>
          <button class="pill ${practicePhase === 'intermediate' ? 'on' : ''}" onclick="setPhase('intermediate')">🟡 Intermediate</button>
          <button class="pill ${practicePhase === 'hard' ? 'on' : ''}" onclick="setPhase('hard')">🔴 Hard</button>
        </div>
        <p class="mute" style="margin-top:12px;">Includes fill-in-the-blanks, synonym matching, and parts-of-speech questions generated automatically.</p>
        <button class="pri" style="margin-top:10px;" onclick="startQuiz()">Start ${practicePhase.toUpperCase()} Quiz</button>
      </div>
    `;
  }

  const q = currentQuiz.list[currentQuiz.index];
  return `
    <h2>Practice Hub — ${practicePhase.toUpperCase()}</h2>
    <div class="card">
      <div class="mute">Question ${currentQuiz.index + 1} of ${currentQuiz.list.length}</div>
      <h3 style="font-size:18px; margin-top:8px;">${esc(q.question)}</h3>
      <div class="row" style="flex-direction:column; align-items:stretch;">
        ${q.opts.map(o => `<button class="pill" style="text-align:left; padding:12px 16px;" onclick="checkAnswer('${esc(o)}', '${esc(q.ans)}')">${esc(o)}</button>`).join('')}
      </div>
    </div>
  `;
}

function setPhase(p) {
  practicePhase = p;
  render();
}

function startQuiz() {
  const list = PRACTICE_BANK[practicePhase] || PRACTICE_BANK.beginner;
  currentQuiz = { index: 0, score: 0, list };
  render();
}

function checkAnswer(selected, correct) {
  if (selected === correct) {
    toast("Correct! 🎉");
    currentQuiz.score++;
  } else {
    toast(`Incorrect! Answer: ${correct}`);
  }
  currentQuiz.index++;
  if (currentQuiz.index >= currentQuiz.list.length) {
    alert(`Quiz Complete! Score: ${currentQuiz.score} / ${currentQuiz.list.length}`);
    currentQuiz = null;
  }
  render();
}

function renderLearn() {
  return `
    <h2>English Grammar &amp; Concept Notes</h2>
    <p class="mute">Simple, interactive reference notes for core English mechanics.</p>
    ${GRAMMAR_NOTES.map(n => `
      <details class="card">
        <summary>${esc(n.title)}</summary>
        <p class="mute">${esc(n.desc)}</p>
        <div style="margin-top:10px; font-size:14.5px;">${n.content}</div>
      </details>
    `).join('')}
  `;
}

function renderSaved() {
  return `
    <h2>My Saved Deck (${words.length})</h2>
    ${words.length ? words.map(w => `
      <div class="card">
        <div class="row" style="justify-content:space-between;">
          <div>
            <b style="font-size:18px; color:var(--acc); cursor:pointer;" onclick="doSearch('${esc(w.word)}')">${esc(w.word)}</b>
            <div class="mute" style="margin-top:4px;">${esc(w.def || 'Saved word')}</div>
          </div>
          <button class="sm" onclick="toggleSaveWord('${esc(w.word)}', ''); render();">Remove</button>
        </div>
      </div>
    `).join('') : '<div class="card mute">No saved words yet. Use Search to add words.</div>'}
  `;
}

function renderSettings() {
  return `
    <h2>Platform Preferences</h2>
    <div class="card">
      <h3>Appearance Theme</h3>
      <div class="row">
        <button class="pill ${cfg.theme === 'light' ? 'on' : ''}" onclick="setTheme('light')">☀️ Light</button>
        <button class="pill ${cfg.theme === 'dark' ? 'on' : ''}" onclick="setTheme('dark')">🌙 Dark</button>
        <button class="pill ${cfg.theme === 'auto' ? 'on' : ''}" onclick="setTheme('auto')">🔄 Auto System</button>
      </div>
    </div>
  `;
}

function setTheme(t) {
  cfg.theme = t;
  SV("wh_cfg", cfg);
  applyTheme();
  render();
}

function render() {
  applyTheme();
  const main = $('main');
  const sb = $('sb');
  const bn = $('bn');

  // Sidebar Links
  if (sb) {
    sb.querySelectorAll('.nav-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.go === currentTab);
    });
  }

  // Mobile Nav Links
  if (bn) {
    bn.innerHTML = `
      <button class="${currentTab === 'home' ? 'active' : ''}" onclick="setTab('home')"><span>🏠</span>Home</button>
      <button class="${currentTab === 'search' ? 'active' : ''}" onclick="setTab('search')"><span>🔍</span>Search</button>
      <button class="${currentTab === 'practice' ? 'active' : ''}" onclick="setTab('practice')"><span>🎯</span>Practice</button>
      <button class="${currentTab === 'learn' ? 'active' : ''}" onclick="setTab('learn')"><span>📖</span>Learn</button>
      <button class="${currentTab === 'saved' ? 'active' : ''}" onclick="setTab('saved')"><span>📚</span>Deck</button>
    `;
  }

  if (!main) return;
  if (currentTab === 'home') main.innerHTML = renderHome();
  else if (currentTab === 'search') main.innerHTML = renderSearch();
  else if (currentTab === 'practice') main.innerHTML = renderPractice();
  else if (currentTab === 'learn') main.innerHTML = renderLearn();
  else if (currentTab === 'saved') main.innerHTML = renderSaved();
  else if (currentTab === 'set') main.innerHTML = renderSettings();
}

document.addEventListener('click', e => {
  const btn = e.target.closest('[data-go]');
  if (btn) setTab(btn.dataset.go);
});

document.addEventListener('DOMContentLoaded', () => {
  render();
});

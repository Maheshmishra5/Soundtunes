document.addEventListener("DOMContentLoaded", () => {

let currentQueue = [];
let currentIndex = 0;

const audio = document.getElementById("audio");

// ▶️ Controls
function togglePlay() {
  if (audio.paused) audio.play();
  else audio.pause();
}

function prevSong() {
  if (currentIndex > 0) {
    currentIndex--;
    playSong(currentQueue[currentIndex]);
  }
}

function nextSong() {
  if (currentIndex < currentQueue.length - 1) {
    currentIndex++;
    playSong(currentQueue[currentIndex]);
  }
}

audio.addEventListener("ended", nextSong);

// 🎤 Lyrics
function toggleLyrics() {
  document.getElementById("lyricsPanel").classList.toggle("hidden");
  document.body.classList.toggle("lyrics-open");
}

async function loadLyrics(artist, title) {
  const lyricsDiv = document.getElementById("lyrics");
  lyricsDiv.innerHTML = `<span class="lyrics-loading-text">Loading lyrics…</span>`;

  // ── 1. Try lyrics.ovh first ──
  try {
    const res  = await fetch(`/api/song-lyrics?artist=${encodeURIComponent(artist)}&title=${encodeURIComponent(title)}`);
    const data = await res.json();
    if (data.lyrics && data.lyrics.trim().length > 20) {
      lyricsDiv.innerText = data.lyrics;
      return;
    }
  } catch { /* fall through to AI */ }

  // ── 2. Fallback: generate with AI via backend ──
  lyricsDiv.innerHTML = `<span class="lyrics-loading-text">✦ Writing lyrics with AI…</span>`;

  try {
    const prompt = `Write realistic, creative song lyrics for a song called "${title}" by ${artist}. Format with [Verse 1], [Chorus], [Verse 2], [Chorus], [Bridge], [Chorus] structure. Make the lyrics feel authentic to the artist style. Output only the lyrics.`;

    const response = await fetch('/api/explain', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });

    const json = await response.json();
    if (!response.ok || json.error) throw new Error(json.error || 'AI request failed');
    const fullText = json.text || '';
    if (!fullText.trim()) throw new Error('Empty response');

    lyricsDiv.innerHTML = `<span class="lyrics-ai-badge">✦ AI Generated</span>`;
    const lyricsBody = document.createElement('pre');
    lyricsBody.className = 'lyrics-ai-body';
    lyricsBody.textContent = fullText;
    lyricsDiv.appendChild(lyricsBody);

  } catch {
    lyricsDiv.innerHTML = `<span class="lyrics-error">Could not load lyrics for this song.</span>`;
  }
}

// 📂 Sections — animated transitions
let _activeSection = 'home';
let _transitioning = false;

function showSection(section) {
  if (section === _activeSection || _transitioning) return;
  _transitioning = true;

  const current = document.getElementById(_activeSection);
  const next    = document.getElementById(section);
  if (!next) { _transitioning = false; return; }

  // Animate current out
  if (current) {
    current.classList.add('leaving');
    current.classList.remove('active');
    setTimeout(() => {
      current.classList.remove('leaving');
    }, 300);
  }

  // Animate next in after a tiny stagger
  setTimeout(() => {
    next.classList.add('active');
    _activeSection = section;
    _transitioning = false;

    // Init LyricMind canvases when entering
    if (section === 'lyricmind') lmInitCanvases();

    // Scroll section to top smoothly
    const main = document.querySelector('.main');
    if (main) main.scrollTo({ top: 0, behavior: 'smooth' });
  }, 60);

  if (section === "recent")    loadRecent();
  if (section === "playlist")  loadPlaylist();
  if (section === "favorites") loadFavorites();
}

// 🎧 Songs
async function loadTrending() {
  const res = await fetch("/api/itunes?term=top&entity=song&limit=20");
  const data = await res.json();
  displaySongs(data.results, "trendingSongs");
}

async function searchSongs() {
  const q = document.getElementById("searchInput").value;
  const res = await fetch(`/api/itunes?term=${encodeURIComponent(q)}&entity=song&limit=20`);
  const data = await res.json();

  displaySongs(data.results, "searchResults");
  showSection("search");
}

function displaySongs(songs, containerId) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";

  const filtered = songs.filter(s => s.previewUrl);
  currentQueue = filtered;

  filtered.forEach((song, index) => {
    const card = document.createElement("div");
    card.className = "card";

    const isFav = isFavorite(song);
    const inPl  = isInPlaylist(song);

    card.innerHTML = `
      <div class="card-img-wrap">
        <img src="${song.artworkUrl100}" alt="${song.trackName}">
        <div class="card-play-overlay">
          <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
        </div>
      </div>
      <p class="card-title">${song.trackName}</p>
      <p class="card-artist">${song.artistName}</p>
      <div class="card-actions">
        <button class="card-action-btn fav-btn ${isFav ? 'active' : ''}" title="${isFav ? 'Remove from Favorites' : 'Add to Favorites'}">
          <svg viewBox="0 0 24 24" fill="${isFav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
        </button>
        <button class="card-action-btn pl-btn ${inPl ? 'active' : ''}" title="${inPl ? 'Remove from Playlist' : 'Add to Playlist'}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
        <button class="card-action-btn next-btn" title="Play next">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 12h14M15 7l5 5-5 5"/></svg>
        </button>
        <button class="card-action-btn explain-btn" title="AI Song Explainer">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a10 10 0 100 20A10 10 0 0012 2z"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
        </button>
      </div>
    `;

    // Play on card click (not on action buttons)
    card.onclick = (e) => {
      if (e.target.closest('.card-action-btn')) return;
      currentIndex = index;
      playSong(song);
    };

    // Favorite button
    card.querySelector('.fav-btn').onclick = (e) => {
      e.stopPropagation();
      const btn = e.currentTarget;
      const added = toggleFavorite(song);
      btn.classList.toggle('active', added);
      btn.title = added ? 'Remove from Favorites' : 'Add to Favorites';
      btn.querySelector('svg').setAttribute('fill', added ? 'currentColor' : 'none');
      showToast(added ? '❤️ Added to Favorites' : 'Removed from Favorites');
    };

    // Playlist button
    card.querySelector('.pl-btn').onclick = (e) => {
      e.stopPropagation();
      const btn = e.currentTarget;
      const added = togglePlaylist(song);
      btn.classList.toggle('active', added);
      btn.title = added ? 'Remove from Playlist' : 'Add to Playlist';
      showToast(added ? '＋ Added to Playlist' : 'Removed from Playlist');
    };

    // Play next button
    card.querySelector('.next-btn').onclick = (e) => {
      e.stopPropagation();
      addToQueueNext(song);
      showToast('⏭ Playing next');
    };

    // AI Explain button
    card.querySelector('.explain-btn').onclick = (e) => {
      e.stopPropagation();
      openAIExplainer(song);
    };

    card.style.setProperty('--card-i', index);
    container.appendChild(card);
  });
}

// ▶️ Play
function playSong(song) {
  document.getElementById("title").innerText = song.trackName;
  document.getElementById("artist").innerText = song.artistName;
  document.getElementById("cover").src = song.artworkUrl100;

  audio.src = song.previewUrl;
  audio.play();

  // Cover glow animation
  const coverWrap = document.querySelector('.player-cover-wrap');
  if (coverWrap) {
    coverWrap.classList.remove('playing-glow');
    void coverWrap.offsetWidth; // reflow to restart animation
    coverWrap.classList.add('playing-glow');
  }
  // Fullscreen art breathing
  const fsArtWrap = document.querySelector('.fs-art-wrap');
  if (fsArtWrap) fsArtWrap.classList.add('is-playing');

  loadLyrics(song.artistName, song.trackName);
  saveRecent(song);
}

// 🕒 Recent
function saveRecent(song) {
  let r = JSON.parse(localStorage.getItem("recent")) || [];
  r = r.filter(s => s.trackId !== song.trackId);
  r.unshift(song);
  localStorage.setItem("recent", JSON.stringify(r.slice(0, 10)));
}

function loadRecent() {
  displaySongs(JSON.parse(localStorage.getItem("recent")) || [], "recentSongs");
}

// ❤️ Favorites
let favorites = JSON.parse(localStorage.getItem("favorites")) || [];

function isFavorite(song) {
  return !!favorites.find(s => s.trackId === song.trackId);
}

function toggleFavorite(song) {
  if (isFavorite(song)) {
    favorites = favorites.filter(s => s.trackId !== song.trackId);
    localStorage.setItem("favorites", JSON.stringify(favorites));
    return false;
  } else {
    favorites.unshift(song);
    localStorage.setItem("favorites", JSON.stringify(favorites));
    return true;
  }
}

function loadFavorites() {
  displaySongs(favorites, "favoriteSongs");
}

// 📂 Playlist
let playlist = JSON.parse(localStorage.getItem("playlist")) || [];

function isInPlaylist(song) {
  return !!playlist.find(s => s.trackId === song.trackId);
}

function togglePlaylist(song) {
  if (isInPlaylist(song)) {
    playlist = playlist.filter(s => s.trackId !== song.trackId);
    localStorage.setItem("playlist", JSON.stringify(playlist));
    return false;
  } else {
    playlist.push(song);
    localStorage.setItem("playlist", JSON.stringify(playlist));
    return true;
  }
}

function addToPlaylist(song) { togglePlaylist(song); }

function loadPlaylist() {
  displaySongs(playlist, "playlistSongs");
}

// 🔔 Toast
function showToast(msg) {
  let t = document.getElementById('st-toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'st-toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2200);
}

// ================== 🔊 WEB AUDIO ENGINE ==================

let audioCtx;

function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

document.body.addEventListener("click", () => getAudioCtx(), { once: true });

// master compressor for glue
let masterCompressor = null;
function getMaster() {
  const ctx = getAudioCtx();
  if (!masterCompressor) {
    masterCompressor = ctx.createDynamicsCompressor();
    masterCompressor.threshold.value = -18;
    masterCompressor.knee.value = 6;
    masterCompressor.ratio.value = 4;
    masterCompressor.attack.value = 0.003;
    masterCompressor.release.value = 0.15;
    masterCompressor.connect(ctx.destination);
  }
  return masterCompressor;
}

function makeNoise(ctx, duration) {
  const size = ctx.sampleRate * duration;
  const buf = ctx.createBuffer(1, size, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < size; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  return src;
}

function playSound(name, volume = 1, when = null) {
  const ctx = getAudioCtx();
  const t = when !== null ? when : ctx.currentTime;
  const out = getMaster();

  if (name === "kick") {
    // Punchy layered kick: pitched sine body + click + distortion
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const dist = ctx.createWaveShaper();
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) { const x = (i * 2) / 256 - 1; curve[i] = (Math.PI + 200) * x / (Math.PI + 200 * Math.abs(x)); }
    dist.curve = curve;
    osc.connect(dist); dist.connect(gain); gain.connect(out);
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(28, t + 0.45);
    gain.gain.setValueAtTime(volume * 1.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
    osc.start(t); osc.stop(t + 0.45);
    // click transient
    const clickNoise = makeNoise(ctx, 0.01);
    const clickFilt = ctx.createBiquadFilter(); clickFilt.type = "highpass"; clickFilt.frequency.value = 3000;
    const clickGain = ctx.createGain();
    clickGain.gain.setValueAtTime(volume * 0.5, t);
    clickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.01);
    clickNoise.connect(clickFilt); clickFilt.connect(clickGain); clickGain.connect(out);
    clickNoise.start(t); clickNoise.stop(t + 0.01);

  } else if (name === "snare") {
    // Snare: layered noise + body tone + crack
    const noise = makeNoise(ctx, 0.25);
    const noiseGain = ctx.createGain();
    const hpf = ctx.createBiquadFilter(); hpf.type = "highpass"; hpf.frequency.value = 1200;
    const bpf = ctx.createBiquadFilter(); bpf.type = "bandpass"; bpf.frequency.value = 4000; bpf.Q.value = 0.8;
    noiseGain.gain.setValueAtTime(volume * 0.9, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    noise.connect(hpf); hpf.connect(bpf); bpf.connect(noiseGain); noiseGain.connect(out);
    noise.start(t); noise.stop(t + 0.25);
    // body
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(140, t + 0.08);
    oscGain.gain.setValueAtTime(volume * 0.7, t);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    osc.connect(oscGain); oscGain.connect(out);
    osc.start(t); osc.stop(t + 0.1);

  } else if (name === "hihat") {
    // Closed hi-hat: short bandpass noise
    const noise = makeNoise(ctx, 0.08);
    const f1 = ctx.createBiquadFilter(); f1.type = "bandpass"; f1.frequency.value = 9000; f1.Q.value = 0.3;
    const f2 = ctx.createBiquadFilter(); f2.type = "highpass"; f2.frequency.value = 7000;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume * 0.55, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
    noise.connect(f1); f1.connect(f2); f2.connect(gain); gain.connect(out);
    noise.start(t); noise.stop(t + 0.08);

  } else if (name === "openhat") {
    // Open hi-hat: longer decay, brighter
    const noise = makeNoise(ctx, 0.45);
    const f1 = ctx.createBiquadFilter(); f1.type = "bandpass"; f1.frequency.value = 10000; f1.Q.value = 0.2;
    const f2 = ctx.createBiquadFilter(); f2.type = "highpass"; f2.frequency.value = 6000;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume * 0.45, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    noise.connect(f1); f1.connect(f2); f2.connect(gain); gain.connect(out);
    noise.start(t); noise.stop(t + 0.45);

  } else if (name === "clap") {
    // Clap: 3 layered short noise bursts + reverb tail
    [0, 0.008, 0.016].forEach(offset => {
      const n = makeNoise(ctx, 0.05);
      const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 1500; f.Q.value = 0.5;
      const g = ctx.createGain();
      g.gain.setValueAtTime(volume * 0.7, t + offset);
      g.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.05);
      n.connect(f); f.connect(g); g.connect(out);
      n.start(t + offset); n.stop(t + offset + 0.06);
    });
    // tail
    const tail = makeNoise(ctx, 0.3);
    const tf = ctx.createBiquadFilter(); tf.type = "bandpass"; tf.frequency.value = 1200; tf.Q.value = 1.5;
    const tg = ctx.createGain();
    tg.gain.setValueAtTime(volume * 0.35, t + 0.02);
    tg.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    tail.connect(tf); tf.connect(tg); tg.connect(out);
    tail.start(t + 0.02); tail.stop(t + 0.3);

  } else if (name === "tom") {
    // Tom: tuned pitch-dropping sine
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.connect(gain); gain.connect(out);
    osc.frequency.setValueAtTime(160, t);
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.25);
    gain.gain.setValueAtTime(volume * 0.9, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    osc.start(t); osc.stop(t + 0.3);

  } else if (name === "bass") {
    // Sub bass: deep 808-style
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.connect(gain); gain.connect(out);
    osc.frequency.setValueAtTime(80, t);
    osc.frequency.exponentialRampToValueAtTime(38, t + 0.55);
    gain.gain.setValueAtTime(volume * 1.1, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
    osc.start(t); osc.stop(t + 0.55);

  } else if (name === "shaker") {
    // Shaker: very short mid-high noise
    const noise = makeNoise(ctx, 0.04);
    const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 5000; f.Q.value = 1.2;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume * 0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.035);
    noise.connect(f); f.connect(gain); gain.connect(out);
    noise.start(t); noise.stop(t + 0.04);
  }
}


// ================== 🎛 BEATMAKER PRO (IMPROVED) ==================

const rows = ["kick","snare","hihat","openhat","clap","tom","bass","shaker"];
const rowLabels = ["KICK","SNARE","HI-HAT","OPEN HAT","CLAP","TOM","808 BASS","SHAKER"];
const bmRowColors = ["#ff5c5c","#ff9a3c","#ffe45c","#a0e050","#3cefff","#7b7bff","#d96bff","#ff6bb0"];

let sequence = [];
let stepCount = 16;
let step = 0;
let isPlaying = false;

// Lookahead scheduler
let scheduleAheadTime = 0.1;
let lookaheadInterval = 25;
let nextStepTime = 0.0;
let schedulerTimer = null;

// Mute / Solo
let bmMutedRows  = rows.map(() => false);
let bmSoloedRows = rows.map(() => false);

// Per-instrument tune offsets in semitones
const bmTuneOffsets = { kick:0, snare:0, hihat:0, openhat:0, clap:0, tom:0, bass:0, shaker:0 };

// Undo / Redo
let bmUndoStack = [];
let bmRedoStack = [];
const BM_MAX_UNDO = 40;

// 4 Patterns
const BM_NUM_PATTERNS = 4;
let bmPatterns = Array.from({length: BM_NUM_PATTERNS}, () => null);
let bmCurrentPatternIdx = 0;
let bmNextPatternIdx = null;
let bmChainMode = false;
let bmChainPos  = 0;

// Copy row
let bmCopiedRow = null;

// Humanize
let bmHumanizeTimings    = null;
let bmHumanizeVelocities = null;

// Hovered row (for keyboard shortcuts)
let bmHoveredRow = -1;

// ── Semitone ratio helper ──
function bmSemitoneRatio(st) { return Math.pow(2, st / 12); }

// ── Snapshot for undo ──
function bmSnapshot(label = 'edit') {
  bmUndoStack.push({ state: sequence.map(r => [...r]), stepCount, label });
  if (bmUndoStack.length > BM_MAX_UNDO) bmUndoStack.shift();
  bmRedoStack = [];
  bmUpdateHistoryLabel();
}

function bmUndo() {
  if (!bmUndoStack.length) return showToast('Nothing to undo');
  bmRedoStack.push({ state: sequence.map(r => [...r]), stepCount, label: 'redo' });
  const { state, stepCount: sc, label } = bmUndoStack.pop();
  stepCount = sc; sequence = state;
  const sel = document.getElementById('bmStepSelect');
  if (sel) sel.value = sc;
  renderBmGrid();
  showToast('↩ Undid: ' + label);
  bmUpdateHistoryLabel();
}

function bmRedo() {
  if (!bmRedoStack.length) return showToast('Nothing to redo');
  bmUndoStack.push({ state: sequence.map(r => [...r]), stepCount, label: 'before redo' });
  const { state, stepCount: sc } = bmRedoStack.pop();
  stepCount = sc; sequence = state;
  const sel = document.getElementById('bmStepSelect');
  if (sel) sel.value = sc;
  renderBmGrid();
  showToast('↪ Redone');
  bmUpdateHistoryLabel();
}

function bmUpdateHistoryLabel() {
  const el = document.getElementById('bmHistoryLabel');
  if (!el) return;
  el.textContent = bmUndoStack.length
    ? `${bmUndoStack.length} action${bmUndoStack.length!==1?'s':''} · last: "${bmUndoStack[bmUndoStack.length-1].label}"`
    : 'No history';
}

// ── Grid Render ──
function initBeatMaker() {
  const area = document.getElementById('bmGridArea');
  if (!area) return;
  sequence = rows.map(() => Array(stepCount).fill(0));
  renderBmGrid();
  bmInitPatternSlots();
}

function renderBmGrid() {
  const header = document.getElementById('bmStepHeader');
  const rowsEl = document.getElementById('bmGridRows');
  if (!header || !rowsEl) return;

  // Step header
  header.innerHTML = '';
  header.style.cssText = `display:grid;grid-template-columns:180px repeat(${stepCount},1fr);gap:3px;margin-bottom:4px;margin-left:0`;
  header.appendChild(document.createElement('div')); // spacer
  for (let i = 0; i < stepCount; i++) {
    const s = document.createElement('div');
    s.className = 'step-num' + (i % 4 === 0 ? ' beat-marker' : '');
    s.id = 'bmStepNum_' + i;
    s.textContent = i + 1;
    header.appendChild(s);
  }

  rowsEl.innerHTML = '';
  rows.forEach((row, r) => {
    const color = bmRowColors[r];
    const rowDiv = document.createElement('div');
    rowDiv.className = 'bm-grid-row';
    rowDiv.id = `bmGridRow_${r}`;
    rowDiv.addEventListener('mouseenter', () => { bmHoveredRow = r; });
    rowDiv.addEventListener('mouseleave', () => { bmHoveredRow = -1; });

    // Left side
    const left = document.createElement('div');
    left.className = 'bm-row-left';
    left.style.cssText = 'display:flex;align-items:center;gap:5px;width:180px;flex-shrink:0';

    const colorBar = document.createElement('div');
    colorBar.style.cssText = `width:3px;height:32px;border-radius:2px;background:${color};flex-shrink:0`;

    const label = document.createElement('div');
    label.style.cssText = `font-size:.62rem;font-weight:700;letter-spacing:.06em;width:58px;flex-shrink:0;text-transform:uppercase;color:${color}`;
    label.textContent = rowLabels[r];

    // Mute btn
    const muteBtn = document.createElement('button');
    muteBtn.className = 'bm-row-btn' + (bmMutedRows[r] ? ' bm-muted' : '');
    muteBtn.textContent = 'M';
    muteBtn.title = `Mute ${rowLabels[r]}`;
    muteBtn.dataset.row = r;
    muteBtn.onclick = () => bmToggleMute(r);

    // Solo btn
    const soloBtn = document.createElement('button');
    soloBtn.className = 'bm-row-btn' + (bmSoloedRows[r] ? ' bm-soloed' : '');
    soloBtn.textContent = 'S';
    soloBtn.title = `Solo ${rowLabels[r]}`;
    soloBtn.dataset.row = r;
    soloBtn.onclick = () => bmToggleSolo(r);

    // Copy/Paste btn
    const copyBtn = document.createElement('button');
    const isPasteReady = bmCopiedRow !== null;
    copyBtn.className = 'bm-row-btn' + (isPasteReady ? ' bm-paste-ready' : '');
    copyBtn.title = isPasteReady ? `Paste to ${rowLabels[r]}` : `Copy row`;
    copyBtn.innerHTML = isPasteReady
      ? `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`
      : `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>`;
    copyBtn.onclick = () => {
      if (!bmCopiedRow) {
        bmCopiedRow = { rowIdx: r, data: [...sequence[r]] };
        showToast(`📋 Copied ${rowLabels[r]}`);
        renderBmGrid();
      } else {
        bmSnapshot(`paste to ${rowLabels[r]}`);
        sequence[r] = [...bmCopiedRow.data];
        if (sequence[r].length < stepCount) sequence[r] = [...sequence[r], ...Array(stepCount - sequence[r].length).fill(0)];
        else sequence[r] = sequence[r].slice(0, stepCount);
        bmCopiedRow = null;
        showToast(`✅ Pasted to ${rowLabels[r]}`);
        renderBmGrid();
      }
    };

    left.appendChild(colorBar);
    left.appendChild(label);
    left.appendChild(muteBtn);
    left.appendChild(soloBtn);
    left.appendChild(copyBtn);

    // Cells
    const cells = document.createElement('div');
    cells.style.cssText = `display:grid;grid-template-columns:repeat(${stepCount},1fr);gap:3px;flex:1`;

    for (let i = 0; i < stepCount; i++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.row = r;
      cell.dataset.col = i;
      if (i % 4 === 0) cell.style.borderLeft = '1px solid rgba(255,255,255,0.1)';
      const vel = sequence[r][i];
      if (vel > 0) {
        cell.classList.add('active', 'vel-' + vel);
        cell.style.background = color;
        cell.style.opacity = vel === 1 ? '0.45' : vel === 2 ? '0.8' : '1';
        if (vel === 3) cell.style.boxShadow = `0 0 8px ${color}60`;
      }
      cell.addEventListener('click', () => {
        let v = (sequence[r][i] + 1) % 4;
        sequence[r][i] = v;
        cell.classList.remove('active','vel-1','vel-2','vel-3');
        cell.style.background = '';
        cell.style.opacity = '';
        cell.style.boxShadow = '';
        if (v > 0) {
          cell.classList.add('active','vel-' + v);
          cell.style.background = color;
          cell.style.opacity = v === 1 ? '0.45' : v === 2 ? '0.8' : '1';
          if (v === 3) cell.style.boxShadow = `0 0 8px ${color}60`;
          cell.dataset.vel = v;
        } else delete cell.dataset.vel;
      });
      cell.addEventListener('contextmenu', e => {
        e.preventDefault();
        if (!sequence[r][i]) return;
        sequence[r][i] = 0;
        cell.classList.remove('active','vel-1','vel-2','vel-3');
        cell.style.background = '';
        cell.style.opacity = '';
        cell.style.boxShadow = '';
        delete cell.dataset.vel;
      });
      cells.appendChild(cell);
    }

    rowDiv.style.cssText = 'display:flex;align-items:center;gap:6px;margin-bottom:5px';
    rowDiv.appendChild(left);
    rowDiv.appendChild(cells);
    rowsEl.appendChild(rowDiv);
  });

  renderBmMixer();
}

function bmHighlightStep(stepIdx) {
  document.querySelectorAll('.step-num[id^="bmStepNum_"]').forEach((s, i) => {
    s.classList.toggle('step-active', i === stepIdx);
  });
  document.querySelectorAll('.cell[data-col]').forEach(c => {
    const col = parseInt(c.dataset.col);
    if (col === stepIdx) {
      c.style.filter = c.classList.contains('active') ? 'brightness(1.5)' : 'brightness(1.15)';
      setTimeout(() => { c.style.filter = ''; }, 90);
    }
  });
}

// ── Mixer ──
function renderBmMixer() {
  const mg = document.getElementById('bmMixerGrid');
  if (!mg) return;
  mg.innerHTML = '';
  rows.forEach((row, r) => {
    const color = bmRowColors[r];
    const currVol = parseFloat(document.getElementById(row + 'Vol')?.value || 0.85);
    const currTune = bmTuneOffsets[row] || 0;
    const ch = document.createElement('div');
    ch.className = 'bm-mixer-ch';
    ch.style.borderTopColor = color;
    ch.innerHTML = `
      <span class="bm-mixer-name" style="color:${color}">${rowLabels[r]}</span>
      <div style="display:flex;flex-direction:column;align-items:center;gap:3px">
        <input type="range" orient="vertical" min="0" max="1" step="0.01" value="${currVol}" id="${row}Vol"
          class="bm-fader" title="${rowLabels[r]} volume"
          oninput="document.getElementById('${row}VolVal').textContent=Math.round(this.value*100)+'%'">
        <span class="bm-mixer-val" id="${row}VolVal">${Math.round(currVol*100)}%</span>
      </div>
      <div style="text-align:center;margin-top:4px">
        <div class="bm-tune-label">Tune</div>
        <input type="range" min="-12" max="12" step="1" value="${currTune}" class="bm-tune-range" id="${row}Tune"
          oninput="bmTuneOffsets['${row}']=parseInt(this.value); document.getElementById('${row}TuneVal').textContent=(this.value>0?'+':'')+this.value+'st'">
        <div class="bm-mixer-val" id="${row}TuneVal">${currTune > 0 ? '+' : ''}${currTune}st</div>
      </div>`;
    mg.appendChild(ch);
  });
}

// ── Mute / Solo ──
function bmToggleMute(r) {
  bmMutedRows[r] = !bmMutedRows[r];
  const btns = document.querySelectorAll(`.bm-row-btn[data-row="${r}"]`);
  if (btns[0]) btns[0].classList.toggle('bm-muted', bmMutedRows[r]);
  showToast(bmMutedRows[r] ? `🔇 ${rowLabels[r]} muted` : `🔊 ${rowLabels[r]} unmuted`);
}

function bmToggleSolo(r) {
  bmSoloedRows[r] = !bmSoloedRows[r];
  const btns = document.querySelectorAll(`.bm-row-btn[data-row="${r}"]`);
  if (btns[1]) btns[1].classList.toggle('bm-soloed', bmSoloedRows[r]);
  showToast(bmSoloedRows[r] ? `🎯 Solo: ${rowLabels[r]}` : `${rowLabels[r]} unsolo'd`);
}

// ── Pattern Management ──
function bmInitPatternSlots() {
  const el = document.getElementById('bmPatternSlots');
  if (!el) return;
  el.innerHTML = '';
  for (let i = 0; i < BM_NUM_PATTERNS; i++) {
    const btn = document.createElement('button');
    btn.className = 'beat-btn beat-secondary bm-pattern-slot' + (i === bmCurrentPatternIdx ? ' bm-pattern-active' : '') + (bmPatterns[i] ? ' bm-pattern-has-data' : '');
    btn.textContent = i + 1;
    btn.title = `Pattern ${i+1} · Double-click to queue`;
    btn.style.cssText = 'padding:4px 10px;min-width:32px;font-size:.78rem';
    btn.dataset.idx = i;
    btn.onclick = () => bmSwitchPattern(i);
    btn.ondblclick = () => bmQueuePattern(i);
    el.appendChild(btn);
  }
}

function bmSwitchPattern(idx) {
  bmPatterns[bmCurrentPatternIdx] = { sequence: sequence.map(r => [...r]), stepCount };
  bmCurrentPatternIdx = idx;
  if (bmPatterns[idx]) {
    sequence = bmPatterns[idx].sequence.map(r => [...r]);
    stepCount = bmPatterns[idx].stepCount;
    const sel = document.getElementById('bmStepSelect');
    if (sel) sel.value = stepCount;
  } else {
    sequence = rows.map(() => Array(stepCount).fill(0));
  }
  renderBmGrid();
  bmInitPatternSlots();
}

function bmQueuePattern(idx) {
  bmNextPatternIdx = idx;
  document.querySelectorAll('.bm-pattern-slot').forEach((s, i) => {
    s.classList.toggle('bm-pattern-queued', i === idx && i !== bmCurrentPatternIdx);
  });
  showToast(`⏭ Pattern ${idx+1} queued for next bar`);
}

function bmCopyPattern() {
  sessionStorage.setItem('bmCopiedPattern', JSON.stringify({ sequence: sequence.map(r => [...r]), stepCount }));
  showToast(`📋 Pattern ${bmCurrentPatternIdx+1} copied`);
}

function bmPastePattern() {
  const raw = sessionStorage.getItem('bmCopiedPattern');
  if (!raw) return showToast('Nothing to paste');
  bmSnapshot('paste pattern');
  const { sequence: seq, stepCount: sc } = JSON.parse(raw);
  sequence = seq.map(r => [...r]);
  stepCount = sc;
  const sel = document.getElementById('bmStepSelect');
  if (sel) sel.value = sc;
  renderBmGrid();
  showToast(`✅ Pasted to pattern ${bmCurrentPatternIdx+1}`);
}

function bmToggleChain() {
  bmChainMode = !bmChainMode;
  const btn = document.getElementById('bmChainBtn');
  if (btn) btn.classList.toggle('beat-play', bmChainMode);
  showToast(bmChainMode ? '🔗 Chain ON' : '🔗 Chain OFF');
}

// ── Scheduler ──
function getBPM() {
  return parseInt(document.getElementById("bpm")?.value || 120);
}

function scheduleStep(stepIndex, time) {
  rows.forEach((row, r) => {
    if (bmMutedRows[r]) return;
    const hasSolo = bmSoloedRows.some(Boolean);
    if (hasSolo && !bmSoloedRows[r]) return;
    const vel = sequence[r][stepIndex];
    if (vel === 0) return;
    const volMap = [0, 0.4, 0.75, 1.0];
    const baseVol = parseFloat(document.getElementById(row + "Vol")?.value || 0.85);
    let vol = baseVol * volMap[vel];
    let timeOffset = 0;
    if (bmHumanizeTimings) timeOffset = (bmHumanizeTimings[r] && bmHumanizeTimings[r][stepIndex]) || 0;
    if (bmHumanizeVelocities) vol *= (bmHumanizeVelocities[r] && bmHumanizeVelocities[r][stepIndex]) || 1;
    vol = Math.min(1.5, Math.max(0, vol));
    const swing = parseFloat(document.getElementById("swingRange")?.value || 0) / 100;
    const swingOffset = (stepIndex % 2 === 1) ? swing * (60 / getBPM() / 4) : 0;
    playSound(row, vol, time + swingOffset + timeOffset);
  });
}

function scheduler() {
  const ctx = getAudioCtx();
  while (nextStepTime < ctx.currentTime + scheduleAheadTime) {
    scheduleStep(step, nextStepTime);
    const thisStep = step;
    const thisTime = nextStepTime;
    setTimeout(() => {
      if (!isPlaying) return;
      bmHighlightStep(thisStep);
    }, Math.max(0, (thisTime - ctx.currentTime) * 1000));

    const secondsPerBeat = 60.0 / getBPM();
    nextStepTime += secondsPerBeat / 4;
    step = (step + 1) % stepCount;

    // Pattern switching at bar boundary
    if (step === 0 && bmNextPatternIdx !== null) {
      bmSwitchPattern(bmNextPatternIdx);
      bmNextPatternIdx = null;
      document.querySelectorAll('.bm-pattern-slot').forEach(s => s.classList.remove('bm-pattern-queued'));
    } else if (step === 0 && bmChainMode) {
      bmChainPos = (bmChainPos + 1) % BM_NUM_PATTERNS;
      let tries = 0;
      while (!bmPatterns[bmChainPos] && tries < BM_NUM_PATTERNS) { bmChainPos = (bmChainPos+1) % BM_NUM_PATTERNS; tries++; }
      if (bmChainPos !== bmCurrentPatternIdx) bmSwitchPattern(bmChainPos);
    }
  }
}

function toggleBeat() {
  if (isPlaying) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
    isPlaying = false;
    step = 0;
    // Clear highlights
    document.querySelectorAll('.step-num[id^="bmStepNum_"]').forEach(s => s.classList.remove('step-active'));
    document.querySelectorAll('.cell').forEach(c => { c.style.filter = ''; });
    const btn = document.getElementById('beatPlayBtn');
    const icon = document.getElementById('beatPlayIcon');
    const lbl = document.getElementById('beatPlayLabel');
    if (btn) btn.classList.remove('playing');
    if (icon) icon.innerHTML = '<polygon points="5,3 19,12 5,21"/>';
    if (lbl) lbl.textContent = 'Play';
    return;
  }
  const ctx = getAudioCtx();
  nextStepTime = ctx.currentTime + 0.05;
  isPlaying = true;
  const btn = document.getElementById('beatPlayBtn');
  const icon = document.getElementById('beatPlayIcon');
  const lbl = document.getElementById('beatPlayLabel');
  if (btn) btn.classList.add('playing');
  if (icon) icon.innerHTML = '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>';
  if (lbl) lbl.textContent = 'Stop';
  scheduler();
  schedulerTimer = setInterval(scheduler, lookaheadInterval);
}

function setStepCount(n) {
  bmSnapshot('change steps to ' + n);
  stepCount = n;
  sequence = sequence.map(row => {
    if (row.length < n) return [...row, ...Array(n - row.length).fill(0)];
    return row.slice(0, n);
  });
  renderBmGrid();
}

// ── Clear ──
function bmClearAll() {
  if (!confirm('Clear all steps?')) return;
  bmSnapshot('clear all');
  sequence = rows.map(() => Array(stepCount).fill(0));
  renderBmGrid();
  showToast('🗑 Cleared');
}

// ── Humanize ──
function bmHumanize() {
  const amt = 0.012;
  bmHumanizeTimings    = rows.map(() => Array(stepCount).fill(0).map(() => (Math.random()-0.5)*2*amt));
  bmHumanizeVelocities = rows.map((_, r) => Array(stepCount).fill(0).map((_, i) => sequence[r][i] > 0 ? 0.85 + Math.random() * 0.3 : 1));
  showToast('🎲 Humanized — subtle timing & velocity variation applied');
}

// ── Master Volume ──
function bmSetMasterVol(v) {
  if (masterCompressor) masterCompressor.connect(getAudioCtx().destination);
  // adjust master gain if available
  const mg = window._bmMasterGain;
  if (mg) mg.gain.value = parseFloat(v);
}

// ── AI Generators ──
function generateAIBeat() {
  bmSnapshot('AI generate');
  const style = document.getElementById("aiStyle").value;
  sequence = rows.map(() => Array(stepCount).fill(0));
  const gens = {
    trap: generateTrap, edm: generateEDM, lofi: generateLofi,
    hiphop: generateHipHop, dnb: generateDnB, house: generateHouse,
    afrobeats: generateAfrobeats, reggaeton: generateReggaeton
  };
  if (gens[style]) gens[style]();
  renderBmGrid();
  showToast("🤖 " + style.charAt(0).toUpperCase() + style.slice(1) + " beat generated!");
}

function acc(r, i, vel=2) { sequence[r][i] = vel; }
function rnd(prob) { return Math.random() < prob; }

function generateTrap() {
  for (let i = 0; i < stepCount; i++) {
    if (i % 4 === 0) acc(0, i, 3);
    if (rnd(0.3)) acc(0, i, rnd(0.5) ? 1 : 2);
    if (i % 4 === 2) acc(1, i, 3);
    if (rnd(0.12)) acc(4, i, 2);
    sequence[2][i] = rnd(0.85) ? (rnd(0.3) ? 3 : 2) : 0;
    if (i % 8 === 6 && rnd(0.6)) acc(3, i, 2);
    if (i % 4 === 0 || i % 4 === 3) acc(6, i, rnd(0.5) ? 3 : 2);
  }
}

function generateEDM() {
  for (let i = 0; i < stepCount; i++) {
    if (i % 4 === 0) acc(0, i, 3);
    if (i % 4 === 2) { acc(1, i, 3); acc(4, i, 3); }
    if (i % 2 === 0) acc(2, i, 2);
    if (i % 4 === 3) acc(3, i, 2);
    if (i % 4 === 0) acc(6, i, 3);
    if (rnd(0.2)) acc(7, i, 1);
  }
}

function generateLofi() {
  for (let i = 0; i < stepCount; i++) {
    if (rnd(0.55)) acc(0, i, rnd(0.4) ? 1 : 2);
    if (i % 4 === 2 && rnd(0.8)) acc(1, i, 2);
    if (rnd(0.4)) acc(1, i, 1);
    if (rnd(0.6)) acc(2, i, rnd(0.3) ? 1 : 2);
    if (i % 8 === 5 && rnd(0.5)) acc(3, i, 1);
    if (rnd(0.3)) acc(7, i, 1);
  }
}

function generateHipHop() {
  for (let i = 0; i < stepCount; i++) {
    if (i === 0 || i === 6 || i === 8 || i === 14) acc(0, i, 3);
    if (rnd(0.12)) acc(0, i, 1);
    if (i % 4 === 2) acc(1, i, 3);
    if (rnd(0.2)) acc(1, i, 1);
    if (i % 2 === 0) acc(2, i, 2);
    if (rnd(0.25)) acc(2, i, 1);
    if (i % 4 === 0 || (i % 8 === 5)) acc(6, i, 2);
  }
}

function generateDnB() {
  const kicks = [0, 3, 9, 12]; const snares = [4, 12];
  for (let i = 0; i < stepCount; i++) {
    if (kicks.includes(i % 16)) acc(0, i, 3);
    if (snares.includes(i % 16)) acc(1, i, 3);
    acc(2, i, i % 2 === 0 ? 2 : 1);
    if (i % 4 === 1) acc(3, i, 2);
    if (rnd(0.15)) acc(4, i, 2);
    if (i % 8 === 7) acc(5, i, 2);
  }
}

function generateHouse() {
  for (let i = 0; i < stepCount; i++) {
    if (i % 4 === 0) acc(0, i, 3);
    if (i % 4 === 2) { acc(1, i, 3); acc(4, i, 2); }
    acc(2, i, i % 2 === 0 ? 2 : 1);
    if (i % 4 === 3) acc(3, i, 2);
    if (i % 4 === 0) acc(6, i, 3);
    if (rnd(0.3)) acc(7, i, 1);
  }
}

function generateAfrobeats() {
  const kickPat = [0, 3, 6, 10]; const snarePat = [4, 12];
  const shakPat = [0, 2, 3, 4, 6, 8, 9, 10, 12, 14];
  for (let i = 0; i < stepCount; i++) {
    if (kickPat.includes(i % 16)) acc(0, i, 3);
    if (snarePat.includes(i % 16)) acc(1, i, 3);
    if (rnd(0.5)) acc(1, i, 1);
    if (shakPat.includes(i % 16)) acc(7, i, shakPat.indexOf(i % 16) % 3 === 0 ? 2 : 1);
    if (i % 4 === 2) acc(5, i, 2);
    if (rnd(0.3)) acc(4, i, 2);
  }
}

function generateReggaeton() {
  const dembowKick = [0, 3, 8, 11]; const dembowSnare = [4, 8, 12];
  for (let i = 0; i < stepCount; i++) {
    if (dembowKick.includes(i % 16)) acc(0, i, 3);
    if (dembowSnare.includes(i % 16)) acc(1, i, 3);
    if (i % 4 === 2) acc(4, i, 2);
    acc(2, i, i % 2 === 0 ? 2 : 1);
    if ([0, 6, 10].includes(i % 16)) acc(6, i, 2);
  }
}

// ── Save / Load ──
function openBmSavePanel() {
  document.getElementById('bmSavePanel').classList.remove('hidden');
  bmRefreshSlotList();
}
function closeBmSavePanel() { document.getElementById('bmSavePanel').classList.add('hidden'); }

function bmSaveToSlot() {
  const name = document.getElementById('bmSaveNameInput').value.trim();
  if (!name) return showToast('Enter a name first');
  const slots = JSON.parse(localStorage.getItem('bmSlots') || '{}');
  slots[name] = { sequence, stepCount, bpm: getBPM(), timestamp: Date.now() };
  localStorage.setItem('bmSlots', JSON.stringify(slots));
  showToast('💾 Saved: ' + name);
  bmRefreshSlotList();
}

function bmRefreshSlotList() {
  const el = document.getElementById('bmSlotList');
  if (!el) return;
  const slots = JSON.parse(localStorage.getItem('bmSlots') || '{}');
  const names = Object.keys(slots).sort((a, b) => slots[b].timestamp - slots[a].timestamp);
  if (!names.length) { el.innerHTML = '<p style="color:var(--text-dim);font-size:.8rem;padding:8px 0">No saved beats yet</p>'; return; }
  el.innerHTML = '';
  names.forEach(n => {
    const d = slots[n];
    const div = document.createElement('div');
    div.className = 'bm-save-slot';
    div.innerHTML = `
      <div>
        <div style="font-size:.82rem;font-weight:500">${n}</div>
        <div style="font-size:.7rem;color:var(--text-dim)">${d.bpm} BPM · ${d.stepCount} steps · ${new Date(d.timestamp).toLocaleDateString()}</div>
      </div>
      <div style="display:flex;gap:6px">
        <button class="beat-btn beat-secondary" style="padding:4px 10px;font-size:.75rem" onclick="bmLoadSlot('${n}')">Load</button>
        <button class="beat-btn beat-secondary" style="padding:4px 10px;font-size:.75rem;color:#ff5c5c" onclick="bmDeleteSlot('${n}')">Del</button>
      </div>`;
    el.appendChild(div);
  });
}

function bmLoadSlot(name) {
  const slots = JSON.parse(localStorage.getItem('bmSlots') || '{}');
  if (!slots[name]) return;
  bmSnapshot('before load ' + name);
  const d = slots[name];
  stepCount = d.stepCount || 16;
  sequence = d.sequence;
  if (d.bpm) {
    const b = document.getElementById('bpm');
    if (b) { b.value = d.bpm; document.getElementById('bpmVal').textContent = d.bpm; }
  }
  const sel = document.getElementById('bmStepSelect');
  if (sel) sel.value = stepCount;
  renderBmGrid();
  closeBmSavePanel();
  showToast('📂 Loaded: ' + name);
}

function bmDeleteSlot(name) {
  const slots = JSON.parse(localStorage.getItem('bmSlots') || '{}');
  delete slots[name];
  localStorage.setItem('bmSlots', JSON.stringify(slots));
  bmRefreshSlotList();
  showToast('🗑 Deleted: ' + name);
}

// ── Export WAV ──
async function exportBeat() {
  showToast("⏳ Rendering audio…");
  const bpm = getBPM();
  const secondsPerStep = (60 / bpm) / 4;
  const totalSteps = stepCount * 2;
  const duration = totalSteps * secondsPerStep + 0.6;
  const sampleRate = 44100;
  const offlineCtx = new OfflineAudioContext(2, Math.ceil(duration * sampleRate), sampleRate);
  const comp = offlineCtx.createDynamicsCompressor();
  comp.threshold.value = -18; comp.ratio.value = 4;
  comp.connect(offlineCtx.destination);
  const origCtx = audioCtx; const origMaster = masterCompressor;
  audioCtx = offlineCtx; masterCompressor = comp;
  for (let bar = 0; bar < 2; bar++) {
    for (let s = 0; s < stepCount; s++) {
      const t = (bar * stepCount + s) * secondsPerStep;
      rows.forEach((row, r) => {
        const vel = sequence[r][s];
        if (!vel) return;
        const volMap = [0, 0.4, 0.75, 1.0];
        const baseVol = parseFloat(document.getElementById(row + "Vol")?.value || 0.85);
        playSound(row, baseVol * volMap[vel], t);
      });
    }
  }
  audioCtx = origCtx; masterCompressor = origMaster;
  const rendered = await offlineCtx.startRendering();
  const wav = audioBufferToWav(rendered);
  const blob = new Blob([wav], { type: "audio/wav" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = "beat.wav"; a.click();
  showToast("✅ WAV exported!");
}

function audioBufferToWav(buffer) {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const length = buffer.length * numChannels * 2 + 44;
  const arrayBuffer = new ArrayBuffer(length);
  const view = new DataView(arrayBuffer);
  const writeStr = (offset, str) => { for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i)); };
  writeStr(0, "RIFF"); view.setUint32(4, length - 8, true);
  writeStr(8, "WAVE"); writeStr(12, "fmt ");
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * numChannels * 2, true);
  view.setUint16(32, numChannels * 2, true); view.setUint16(34, 16, true);
  writeStr(36, "data"); view.setUint32(40, buffer.length * numChannels * 2, true);
  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const s = Math.max(-1, Math.min(1, buffer.getChannelData(ch)[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      offset += 2;
    }
  }
  return arrayBuffer;
}

// ── Play Sound (with tune support) ──
function playSound(name, volume = 1, when = null) {
  const ctx = getAudioCtx();
  const t = when !== null ? when : ctx.currentTime;
  const out = getMaster();
  const tune = bmTuneOffsets[name] || 0;
  const tr = bmSemitoneRatio(tune);

  if (name === "kick") {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const dist = ctx.createWaveShaper();
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) { const x = (i * 2) / 256 - 1; curve[i] = (Math.PI + 200) * x / (Math.PI + 200 * Math.abs(x)); }
    dist.curve = curve;
    osc.connect(dist); dist.connect(gain); gain.connect(out);
    osc.frequency.setValueAtTime(180*tr, t);
    osc.frequency.exponentialRampToValueAtTime(28*tr, t + 0.45);
    gain.gain.setValueAtTime(volume * 1.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
    osc.start(t); osc.stop(t + 0.45);
    const clickNoise = makeNoise(ctx, 0.01);
    const clickFilt = ctx.createBiquadFilter(); clickFilt.type = "highpass"; clickFilt.frequency.value = 3000;
    const clickGain = ctx.createGain();
    clickGain.gain.setValueAtTime(volume * 0.5, t);
    clickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.01);
    clickNoise.connect(clickFilt); clickFilt.connect(clickGain); clickGain.connect(out);
    clickNoise.start(t); clickNoise.stop(t + 0.01);

  } else if (name === "snare") {
    const noise = makeNoise(ctx, 0.25);
    const noiseGain = ctx.createGain();
    const hpf = ctx.createBiquadFilter(); hpf.type = "highpass"; hpf.frequency.value = 1200*tr;
    const bpf = ctx.createBiquadFilter(); bpf.type = "bandpass"; bpf.frequency.value = 4000*tr; bpf.Q.value = 0.8;
    noiseGain.gain.setValueAtTime(volume * 0.9, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    noise.connect(hpf); hpf.connect(bpf); bpf.connect(noiseGain); noiseGain.connect(out);
    noise.start(t); noise.stop(t + 0.25);
    const osc = ctx.createOscillator(); const oscGain = ctx.createGain();
    osc.type = "triangle"; osc.frequency.setValueAtTime(220*tr, t); osc.frequency.exponentialRampToValueAtTime(140*tr, t + 0.08);
    oscGain.gain.setValueAtTime(volume * 0.7, t); oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    osc.connect(oscGain); oscGain.connect(out); osc.start(t); osc.stop(t + 0.1);

  } else if (name === "hihat") {
    const noise = makeNoise(ctx, 0.08);
    const f1 = ctx.createBiquadFilter(); f1.type = "bandpass"; f1.frequency.value = 9000*tr; f1.Q.value = 0.3;
    const f2 = ctx.createBiquadFilter(); f2.type = "highpass"; f2.frequency.value = 7000*tr;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume * 0.55, t); gain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
    noise.connect(f1); f1.connect(f2); f2.connect(gain); gain.connect(out);
    noise.start(t); noise.stop(t + 0.08);

  } else if (name === "openhat") {
    const noise = makeNoise(ctx, 0.45);
    const f1 = ctx.createBiquadFilter(); f1.type = "bandpass"; f1.frequency.value = 10000*tr; f1.Q.value = 0.2;
    const f2 = ctx.createBiquadFilter(); f2.type = "highpass"; f2.frequency.value = 6000*tr;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume * 0.45, t); gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    noise.connect(f1); f1.connect(f2); f2.connect(gain); gain.connect(out);
    noise.start(t); noise.stop(t + 0.45);

  } else if (name === "clap") {
    [0, 0.008, 0.016].forEach(offset => {
      const n = makeNoise(ctx, 0.05);
      const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 1500*tr; f.Q.value = 0.5;
      const g = ctx.createGain();
      g.gain.setValueAtTime(volume * 0.7, t + offset); g.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.05);
      n.connect(f); f.connect(g); g.connect(out); n.start(t + offset); n.stop(t + offset + 0.06);
    });
    const tail = makeNoise(ctx, 0.3);
    const tf = ctx.createBiquadFilter(); tf.type = "bandpass"; tf.frequency.value = 1200*tr; tf.Q.value = 1.5;
    const tg = ctx.createGain();
    tg.gain.setValueAtTime(volume * 0.35, t + 0.02); tg.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    tail.connect(tf); tf.connect(tg); tg.connect(out); tail.start(t + 0.02); tail.stop(t + 0.3);

  } else if (name === "tom") {
    const osc = ctx.createOscillator(); const gain = ctx.createGain();
    osc.type = "sine"; osc.connect(gain); gain.connect(out);
    osc.frequency.setValueAtTime(160*tr, t); osc.frequency.exponentialRampToValueAtTime(60*tr, t + 0.25);
    gain.gain.setValueAtTime(volume * 0.9, t); gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    osc.start(t); osc.stop(t + 0.3);

  } else if (name === "bass") {
    const osc = ctx.createOscillator(); const gain = ctx.createGain();
    osc.type = "sine"; osc.connect(gain); gain.connect(out);
    osc.frequency.setValueAtTime(80*tr, t); osc.frequency.exponentialRampToValueAtTime(38*tr, t + 0.55);
    gain.gain.setValueAtTime(volume * 1.1, t); gain.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
    osc.start(t); osc.stop(t + 0.55);

  } else if (name === "shaker") {
    const noise = makeNoise(ctx, 0.04);
    const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 5000*tr; f.Q.value = 1.2;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume * 0.4, t); gain.gain.exponentialRampToValueAtTime(0.001, t + 0.035);
    noise.connect(f); f.connect(gain); gain.connect(out);
    noise.start(t); noise.stop(t + 0.04);
  }
}

// ── Piano ──
const whiteNotes = ["C","D","E","F","G","A","B"];
const blackNotes = { "C":"C#","D":"D#","F":"F#","G":"G#","A":"A#" };
let pianoOctave = 4;

const keyboardMap = {
  "a":"C","w":"C#","s":"D","e":"D#","d":"E","f":"F",
  "t":"F#","g":"G","y":"G#","h":"A","u":"A#","j":"B",
  "k":"C5"
};

const baseFreqs = {
  "C":261.63,"C#":277.18,"D":293.66,"D#":311.13,"E":329.63,
  "F":349.23,"F#":369.99,"G":392.00,"G#":415.30,"A":440.00,"A#":466.16,"B":493.88
};

function getNoteFreq(note, octave) {
  const base = baseFreqs[note] || 261.63;
  return base * Math.pow(2, octave - 4);
}

function initPiano() {
  const pianoEl = document.getElementById("piano");
  if (!pianoEl) return;
  pianoEl.innerHTML = "";
  const wrapper = document.createElement("div");
  wrapper.className = "piano-wrapper";
  const whiteKeyEls = {};

  whiteNotes.forEach(note => {
    const key = document.createElement("div");
    key.className = "key white-key";
    key.dataset.note = note;
    const kb = Object.entries(keyboardMap).find(([k,v]) => v === note)?.[0];
    key.innerHTML = `<span class="key-label">${note}</span>${kb ? `<span class="key-kb">${kb.toUpperCase()}</span>` : ""}`;
    key.addEventListener("mousedown", () => triggerPianoNote(note, pianoOctave, key));
    wrapper.appendChild(key);
    whiteKeyEls[note] = key;
  });

  const blackPositions = { "C#": 1, "D#": 2, "F#": 4, "G#": 5, "A#": 6 };
  Object.entries(blackPositions).forEach(([note, position]) => {
    const key = document.createElement("div");
    key.className = "key black-key";
    key.dataset.note = note;
    key.style.left = `calc(${(position - 0.5) * (100 / 7)}% - 16px)`;
    const kb = Object.entries(keyboardMap).find(([k,v]) => v === note)?.[0];
    key.innerHTML = `<span class="key-kb black-kb">${kb ? kb.toUpperCase() : ""}</span>`;
    key.addEventListener("mousedown", (e) => { e.stopPropagation(); triggerPianoNote(note, pianoOctave, key); });
    wrapper.appendChild(key);
  });

  pianoEl.appendChild(wrapper);
}

function triggerPianoNote(note, octave, keyEl) {
  const freq = note === "C5" ? getNoteFreq("C", octave + 1) : getNoteFreq(note, octave);
  playPianoNote(freq);
  if (keyEl) {
    keyEl.classList.add("key-active");
    setTimeout(() => keyEl.classList.remove("key-active"), 200);
  }
}

function playPianoNote(freq) {
  const ctx = getAudioCtx();
  const out = getMaster();
  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const gain = ctx.createGain();
  osc1.type = "triangle"; osc1.frequency.value = freq;
  osc2.type = "sine"; osc2.frequency.value = freq * 2;
  osc1.connect(gain); osc2.connect(gain); gain.connect(out);
  gain.gain.setValueAtTime(0, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0.35, ctx.currentTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
  osc1.start(ctx.currentTime); osc2.start(ctx.currentTime);
  osc1.stop(ctx.currentTime + 1.2); osc2.stop(ctx.currentTime + 1.2);
}

const pressedKeys = new Set();
document.addEventListener("keydown", (e) => {
  if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") return;
  const beatmakerSection = document.getElementById("beatmaker");
  if (!beatmakerSection || !beatmakerSection.classList.contains("active")) return;

  // Beat maker keyboard shortcuts
  if (e.ctrlKey && e.key === 'z') { e.preventDefault(); bmUndo(); return; }
  if (e.ctrlKey && (e.key === 'y' || e.key === 'Y')) { e.preventDefault(); bmRedo(); return; }

  // Pattern switching 1-4 (only in beat maker)
  if (['1','2','3','4'].includes(e.key) && !e.ctrlKey && !e.altKey) {
    bmSwitchPattern(parseInt(e.key) - 1); return;
  }

  // Mute hovered row
  if ((e.key === 'm' || e.key === 'M') && bmHoveredRow >= 0) {
    bmToggleMute(bmHoveredRow); return;
  }
  // Solo hovered row
  if ((e.key === 's' || e.key === 'S') && bmHoveredRow >= 0) {
    bmToggleSolo(bmHoveredRow); return;
  }

  // Piano keys
  const k = e.key.toLowerCase();
  if (pressedKeys.has(k)) return;
  pressedKeys.add(k);
  if (keyboardMap[k]) {
    const note = keyboardMap[k];
    const octave = note === "C5" ? pianoOctave + 1 : pianoOctave;
    const cleanNote = note === "C5" ? "C" : note;
    const keyEl = document.querySelector(`.key[data-note="${note}"]`);
    triggerPianoNote(cleanNote, octave, keyEl);
  }
});
document.addEventListener("keyup", (e) => { pressedKeys.delete(e.key.toLowerCase()); });

function changeOctave(dir) {
  pianoOctave = Math.max(1, Math.min(7, pianoOctave + dir));
  document.getElementById("octaveDisplay").textContent = pianoOctave;
}

// expose new beat maker functions
window.bmUndo = bmUndo;
window.bmRedo = bmRedo;
window.bmHumanize = bmHumanize;
window.bmClearAll = bmClearAll;
window.bmCopyPattern = bmCopyPattern;
window.bmPastePattern = bmPastePattern;
window.bmToggleChain = bmToggleChain;
window.openBmSavePanel = openBmSavePanel;
window.closeBmSavePanel = closeBmSavePanel;
window.bmSaveToSlot = bmSaveToSlot;
window.bmLoadSlot = bmLoadSlot;
window.bmDeleteSlot = bmDeleteSlot;
window.bmSetMasterVol = bmSetMasterVol;

// ================== INIT ==================
loadTrending();
initBeatMaker();
initPiano();

// expose
window.togglePlay = togglePlay;
window.prevSong = prevSong;
window.nextSong = nextSong;
window.searchSongs = searchSongs;
window.showSection = showSection;
window.toggleLyrics = toggleLyrics;
window.toggleBeat = toggleBeat;


window.exportBeat = exportBeat;
window.generateAIBeat = generateAIBeat;
window.setStepCount = setStepCount;
window.changeOctave = changeOctave;

// ================== ⌨️ KEYBOARD CONTROLS ==================

const VOLUME_STEP = 0.05;

// Show a keyboard shortcut hint toast
function showKbToast(action, detail = "") {
  let t = document.getElementById("st-toast");
  if (!t) {
    t = document.createElement("div");
    t.id = "st-toast";
    document.body.appendChild(t);
  }
  t.innerHTML = `<span class="toast-action">${action}</span>${detail ? `<span class="toast-detail">${detail}</span>` : ""}`;
  t.classList.add("show");
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove("show"), 1800);
}

document.addEventListener("keydown", (e) => {
  // Skip if user is typing in an input / textarea / select
  const tag = document.activeElement?.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

  switch (e.code) {

    // ── Playback ──
    case "Space":
      e.preventDefault();
      togglePlay();
      showKbToast(audio.paused ? "⏸ Paused" : "▶ Playing");
      break;

    case "ArrowRight":
      if (e.shiftKey) {
        // Shift+→ skip forward 10s
        e.preventDefault();
        audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 10);
        showKbToast("⏩ +10s");
      } else if (e.altKey) {
        // Alt+→ next track
        e.preventDefault();
        nextSong();
        showKbToast("⏭ Next track");
      }
      break;

    case "ArrowLeft":
      if (e.shiftKey) {
        // Shift+← rewind 10s
        e.preventDefault();
        audio.currentTime = Math.max(0, audio.currentTime - 10);
        showKbToast("⏪ −10s");
      } else if (e.altKey) {
        // Alt+← previous track
        e.preventDefault();
        prevSong();
        showKbToast("⏮ Previous track");
      }
      break;

    // ── Volume ──
    case "ArrowUp":
      e.preventDefault();
      audio.volume = Math.min(1, parseFloat((audio.volume + VOLUME_STEP).toFixed(2)));
      showKbToast(`🔊 Volume`, ` ${Math.round(audio.volume * 100)}%`);
      updateVolumeUI();
      break;

    case "ArrowDown":
      e.preventDefault();
      audio.volume = Math.max(0, parseFloat((audio.volume - VOLUME_STEP).toFixed(2)));
      showKbToast(`${audio.volume === 0 ? "🔇" : "🔉"} Volume`, ` ${Math.round(audio.volume * 100)}%`);
      updateVolumeUI();
      break;

    case "KeyM":
      // Mute / unmute toggle
      audio.muted = !audio.muted;
      showKbToast(audio.muted ? "🔇 Muted" : "🔊 Unmuted");
      updateVolumeUI();
      break;

    // ── Seek by percentage (1–9 = 10%–90%) ──
    case "Digit1": case "Digit2": case "Digit3":
    case "Digit4": case "Digit5": case "Digit6":
    case "Digit7": case "Digit8": case "Digit9":
      if (!e.altKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        const pct = parseInt(e.code.replace("Digit", "")) * 10;
        if (audio.duration) {
          audio.currentTime = (pct / 100) * audio.duration;
          showKbToast(`⏱ Seek`, ` ${pct}%`);
        }
      }
      break;

    // ── Lyrics panel ──
    case "KeyL":
      toggleLyrics();
      const panel = document.getElementById("lyricsPanel");
      showKbToast(panel.classList.contains("hidden") ? "📄 Lyrics closed" : "🎤 Lyrics open");
      break;

    // ── Show keyboard shortcut overlay ──
    case "Slash":
      if (e.shiftKey) {
        e.preventDefault();
        toggleShortcutsOverlay();
      }
      break;
  }
});

// ── Volume bar UI sync ──
function updateVolumeUI() {
  const bar = document.getElementById("volumeBar");
  if (bar) {
    bar.value = audio.muted ? 0 : audio.volume;
    bar.style.setProperty("--v", `${(audio.muted ? 0 : audio.volume) * 100}%`);
  }
  const icon = document.getElementById("volIcon");
  if (icon) {
    if (audio.muted || audio.volume === 0) {
      icon.innerHTML = '<path d="M16.5 12A4.5 4.5 0 0014 7.97v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06A8.99 8.99 0 0015.72 18l2.01 2.01L19 18.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" fill="currentColor"/>';
    } else if (audio.volume < 0.5) {
      icon.innerHTML = '<path d="M18.5 12A4.5 4.5 0 0016 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z" fill="currentColor"/>';
    } else {
      icon.innerHTML = '<path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0014 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" fill="currentColor"/>';
    }
  }
}

// ── Shortcuts overlay ──
function toggleShortcutsOverlay() {
  let overlay = document.getElementById("kb-overlay");
  if (overlay) { overlay.remove(); return; }

  overlay = document.createElement("div");
  overlay.id = "kb-overlay";
  overlay.innerHTML = `
    <div class="kb-modal">
      <div class="kb-modal-header">
        <h2>Keyboard Shortcuts</h2>
        <button onclick="document.getElementById('kb-overlay').remove()">✕</button>
      </div>
      <div class="kb-grid">
        <div class="kb-group">
          <p class="kb-group-title">Playback</p>
          <div class="kb-row"><kbd>Space</kbd><span>Play / Pause</span></div>
          <div class="kb-row"><kbd>Alt</kbd><kbd>→</kbd><span>Next track</span></div>
          <div class="kb-row"><kbd>Alt</kbd><kbd>←</kbd><span>Previous track</span></div>
          <div class="kb-row"><kbd>Shift</kbd><kbd>→</kbd><span>Forward 10s</span></div>
          <div class="kb-row"><kbd>Shift</kbd><kbd>←</kbd><span>Rewind 10s</span></div>
        </div>
        <div class="kb-group">
          <p class="kb-group-title">Volume</p>
          <div class="kb-row"><kbd>↑</kbd><span>Volume up</span></div>
          <div class="kb-row"><kbd>↓</kbd><span>Volume down</span></div>
          <div class="kb-row"><kbd>M</kbd><span>Mute / Unmute</span></div>
        </div>
        <div class="kb-group">
          <p class="kb-group-title">Seek & Other</p>
          <div class="kb-row"><kbd>1</kbd>–<kbd>9</kbd><span>Seek to 10%–90%</span></div>
          <div class="kb-row"><kbd>L</kbd><span>Toggle Lyrics</span></div>
          <div class="kb-row"><kbd>Shift</kbd><kbd>?</kbd><span>This overlay</span></div>
        </div>
      </div>
    </div>
  `;
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
  document.body.appendChild(overlay);
}

window.toggleShortcutsOverlay = toggleShortcutsOverlay;

// ================== 😴 SLEEP TIMER ==================

let sleepTimerTimeout = null;
let sleepTimerEnd = null;
let sleepTimerInterval = null;

function toggleSleepTimer() {
  if (sleepTimerTimeout) {
    clearTimeout(sleepTimerTimeout);
    clearInterval(sleepTimerInterval);
    sleepTimerTimeout = null; sleepTimerEnd = null;
    document.getElementById('sleepTimerLabel').style.display = 'none';
    document.getElementById('sleepTimerBtn').classList.remove('active');
    showToast('😴 Sleep timer cancelled');
    return;
  }

  const opts = [5, 10, 15, 20, 30, 45, 60];
  let overlay = document.createElement('div');
  overlay.id = 'sleep-overlay';
  overlay.innerHTML = `
    <div class="kb-modal" style="max-width:320px;">
      <div class="kb-modal-header">
        <h2>😴 Sleep Timer</h2>
        <button onclick="document.getElementById('sleep-overlay').remove()">✕</button>
      </div>
      <p style="color:var(--text-muted);font-size:0.85rem;margin-bottom:16px;">Stop music after:</p>
      <div style="display:flex;flex-wrap:wrap;gap:8px;">
        ${opts.map(m => `<button class="beat-btn beat-secondary" onclick="setSleepTimer(${m})">${m} min</button>`).join('')}
      </div>
    </div>`;
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);backdrop-filter:blur(8px);z-index:10000;display:flex;align-items:center;justify-content:center;';
  overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };
  document.body.appendChild(overlay);
}

function setSleepTimer(minutes) {
  document.getElementById('sleep-overlay')?.remove();
  const ms = minutes * 60 * 1000;
  sleepTimerEnd = Date.now() + ms;
  sleepTimerTimeout = setTimeout(() => {
    audio.pause();
    clearInterval(sleepTimerInterval);
    sleepTimerTimeout = null; sleepTimerEnd = null;
    document.getElementById('sleepTimerLabel').style.display = 'none';
    document.getElementById('sleepTimerBtn').classList.remove('active');
    showToast('😴 Sleep timer — music stopped');
  }, ms);
  document.getElementById('sleepTimerBtn').classList.add('active');
  const label = document.getElementById('sleepTimerLabel');
  label.style.display = 'inline';
  clearInterval(sleepTimerInterval);
  sleepTimerInterval = setInterval(() => {
    if (!sleepTimerEnd) return;
    const remaining = Math.max(0, sleepTimerEnd - Date.now());
    const m = Math.floor(remaining / 60000);
    const s = Math.floor((remaining % 60000) / 1000);
    label.textContent = `${m}:${s.toString().padStart(2,'0')}`;
  }, 1000);
  showToast(`😴 Sleep timer: ${minutes} min`);
}

window.toggleSleepTimer = toggleSleepTimer;
window.setSleepTimer = setSleepTimer;

// ================== 😄 MOOD MIX ==================

async function loadMoodPlaylist(btn) {
  document.querySelectorAll('.mood-card').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  const mood = btn.dataset.mood;
  const query = btn.dataset.query;
  const resultEl = document.getElementById('moodResult');
  const songsEl = document.getElementById('moodSongs');
  resultEl.innerHTML = `<p class="section-sub" style="margin-bottom:8px;">🎵 Building your <strong style="color:var(--green)">${mood}</strong> playlist…</p>`;
  songsEl.innerHTML = '';
  try {
    const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=20`);
    const data = await res.json();
    const filtered = data.results.filter(s => s.previewUrl);
    resultEl.innerHTML = `<p class="section-sub"><strong style="color:var(--green)">${filtered.length} songs</strong> matched your <strong>${mood}</strong> mood</p>`;
    displaySongs(filtered, 'moodSongs');
  } catch {
    resultEl.innerHTML = `<p class="section-sub" style="color:#e84040;">Failed to load playlist</p>`;
  }
}

window.loadMoodPlaylist = loadMoodPlaylist;

// ================== 🧠 FOCUS TIMER ==================

let focusRunning = false;
let focusInterval = null;
let focusPhase = 'work'; // 'work' | 'break'
let focusSecondsLeft = 25 * 60;
let focusTotalSeconds = 25 * 60;
let focusSessionCount = 0;
let focusTotalFocusMins = parseInt(localStorage.getItem('focusTotalMins') || '0');
let focusDaySessions = parseInt(localStorage.getItem('focusDaySessions') || '0');

function toggleFocus() {
  if (focusRunning) {
    clearInterval(focusInterval);
    focusRunning = false;
    document.getElementById('focusStartBtn').innerHTML = '▶ Start';
    showToast('⏸ Focus timer paused');
  } else {
    if (!focusRunning && focusSecondsLeft === focusTotalSeconds) {
      // Fresh start
      focusPhase = 'work';
      focusSecondsLeft = (parseInt(document.getElementById('focusWork')?.value) || 25) * 60;
      focusTotalSeconds = focusSecondsLeft;
      updateFocusUI();
    }
    focusRunning = true;
    document.getElementById('focusStartBtn').innerHTML = '⏸ Pause';
    focusInterval = setInterval(focusTick, 1000);
    showToast('🧠 Focus session started!');
    if (focusPhase === 'work' && document.getElementById('focusPauseMusic')?.checked) {
      if (audio.paused) audio.play();
    }
  }
}

function focusTick() {
  focusSecondsLeft--;
  if (focusSecondsLeft <= 0) {
    if (focusPhase === 'work') {
      focusSessionCount++;
      focusDaySessions++;
      focusTotalFocusMins += parseInt(document.getElementById('focusWork')?.value) || 25;
      localStorage.setItem('focusTotalMins', focusTotalFocusMins);
      localStorage.setItem('focusDaySessions', focusDaySessions);
      localStorage.setItem('focusLastDay', new Date().toDateString());
      document.getElementById('focusTotalSessions').textContent = focusDaySessions;
      document.getElementById('focusTotalMins').textContent = focusTotalFocusMins;
      focusPhase = 'break';
      focusSecondsLeft = (parseInt(document.getElementById('focusBreak')?.value) || 5) * 60;
      focusTotalSeconds = focusSecondsLeft;
      showToast('☕ Break time! Great work.');
      if (document.getElementById('focusPauseMusic')?.checked) audio.pause();
    } else {
      focusPhase = 'work';
      focusSecondsLeft = (parseInt(document.getElementById('focusWork')?.value) || 25) * 60;
      focusTotalSeconds = focusSecondsLeft;
      showToast('🧠 Back to work!');
      if (document.getElementById('focusPauseMusic')?.checked) audio.play();
    }
  }
  updateFocusUI();
}

function updateFocusUI() {
  const m = Math.floor(focusSecondsLeft / 60);
  const s = focusSecondsLeft % 60;
  const timeEl = document.getElementById('focusTime');
  if (timeEl) timeEl.textContent = `${m}:${s.toString().padStart(2,'0')}`;
  const phaseEl = document.getElementById('focusPhaseLabel');
  if (phaseEl) phaseEl.textContent = focusPhase === 'work' ? 'Work' : 'Break';
  const sessionEl = document.getElementById('focusSessionCount');
  if (sessionEl) sessionEl.textContent = `Session ${focusSessionCount + 1}`;
  // Ring progress
  const prog = document.getElementById('focusRingProg');
  if (prog) {
    const pct = focusSecondsLeft / focusTotalSeconds;
    const circ = 326.7;
    prog.style.strokeDashoffset = circ * (1 - pct);
    prog.style.stroke = focusPhase === 'work' ? 'var(--green)' : '#4a9eff';
  }
  // Restore session counts from storage
  const ds = document.getElementById('focusTotalSessions');
  if (ds) ds.textContent = focusDaySessions;
  const dm = document.getElementById('focusTotalMins');
  if (dm) dm.textContent = focusTotalFocusMins;
}

function focusAdjust(delta) {
  if (focusRunning) return;
  const workInput = document.getElementById('focusWork');
  if (!workInput) return;
  const newVal = Math.max(1, Math.min(90, parseInt(workInput.value) + delta));
  workInput.value = newVal;
  focusSecondsLeft = newVal * 60;
  focusTotalSeconds = focusSecondsLeft;
  focusPhase = 'work';
  updateFocusUI();
}

window.toggleFocus = toggleFocus;
window.focusAdjust = focusAdjust;

// Init focus UI from storage on load
(function initFocusStats() {
  const lastDay = localStorage.getItem('focusLastDay');
  if (lastDay !== new Date().toDateString()) {
    localStorage.setItem('focusDaySessions', '0');
    focusDaySessions = 0;
  }
  focusDaySessions = parseInt(localStorage.getItem('focusDaySessions') || '0');
  focusTotalFocusMins = parseInt(localStorage.getItem('focusTotalMins') || '0');
})();

// ================== 🌍 DISCOVER BY COUNTRY ==================

const COUNTRIES = [
  { name: 'United States', code: 'us', flag: '🇺🇸' },
  { name: 'United Kingdom', code: 'gb', flag: '🇬🇧' },
  { name: 'India', code: 'in', flag: '🇮🇳' },
  { name: 'Japan', code: 'jp', flag: '🇯🇵' },
  { name: 'Brazil', code: 'br', flag: '🇧🇷' },
  { name: 'South Korea', code: 'kr', flag: '🇰🇷' },
  { name: 'Nigeria', code: 'ng', flag: '🇳🇬' },
  { name: 'France', code: 'fr', flag: '🇫🇷' },
  { name: 'Mexico', code: 'mx', flag: '🇲🇽' },
  { name: 'Germany', code: 'de', flag: '🇩🇪' },
  { name: 'Australia', code: 'au', flag: '🇦🇺' },
  { name: 'Spain', code: 'es', flag: '🇪🇸' },
];

function initDiscoverSection() {
  const grid = document.getElementById('countryGrid');
  if (!grid || grid.children.length > 0) return;
  COUNTRIES.forEach(c => {
    const btn = document.createElement('button');
    btn.className = 'country-card';
    btn.dataset.code = c.code;
    btn.innerHTML = `<span class="country-flag">${c.flag}</span><span class="country-name">${c.name}</span>`;
    btn.onclick = () => loadCountryTrending(c, btn);
    grid.appendChild(btn);
  });
}

async function loadCountryTrending(country, btn) {
  document.querySelectorAll('.country-card').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  const songsEl = document.getElementById('discoverSongs');
  songsEl.innerHTML = '<p class="section-sub">Loading…</p>';
  try {
    const queries = {
      'ng': 'afrobeats nigerian', 'kr': 'kpop korean', 'jp': 'j-pop japanese',
      'br': 'sertanejo brasileiro', 'in': 'bollywood hindi', 'mx': 'reggaeton mexico',
      'fr': 'chanson français', 'de': 'german pop', 'es': 'flamenco español',
    };
    const term = queries[country.code] || `top ${country.name} music`;
    const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=song&limit=20&country=${country.code}`);
    const data = await res.json();
    displaySongs(data.results.filter(s => s.previewUrl), 'discoverSongs');
  } catch {
    songsEl.innerHTML = '<p class="section-sub" style="color:#e84040">Failed to load</p>';
  }
}

window.initDiscoverSection = initDiscoverSection;

// ================== 📊 LISTENING STATS ==================

let listenStats = JSON.parse(localStorage.getItem('listenStats') || '{"plays":{},"artists":{},"totalSecs":0,"days":{}}');

function recordPlay(song) {
  const id = String(song.trackId);
  if (!listenStats.plays[id]) listenStats.plays[id] = { count: 0, name: song.trackName, artist: song.artistName, art: song.artworkUrl100 };
  listenStats.plays[id].count++;
  const artist = song.artistName;
  listenStats.artists[artist] = (listenStats.artists[artist] || 0) + 1;
  const today = new Date().toDateString();
  listenStats.days[today] = (listenStats.days[today] || 0) + 1;
  saveListenStats();
}

function recordListenTime(secs) {
  listenStats.totalSecs = (listenStats.totalSecs || 0) + secs;
  saveListenStats();
}

function saveListenStats() {
  localStorage.setItem('listenStats', JSON.stringify(listenStats));
}

function renderStats() {
  const plays = Object.values(listenStats.plays);
  const totalPlays = plays.reduce((s, p) => s + p.count, 0);
  const totalSecs = listenStats.totalSecs || 0;
  const hours = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const timeStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

  const el = id => document.getElementById(id);
  if (el('statTotalPlays')) el('statTotalPlays').textContent = totalPlays;
  if (el('statTotalTime')) el('statTotalTime').textContent = timeStr;
  if (el('statFavCount')) el('statFavCount').textContent = favorites.length;

  // Streak
  let streak = 0;
  let d = new Date();
  while (listenStats.days[d.toDateString()]) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  if (el('statStreak')) el('statStreak').textContent = streak;

  // Top artists
  const topArtists = Object.entries(listenStats.artists).sort((a, b) => b[1] - a[1]).slice(0, 5);
  if (el('statsTopArtists')) {
    el('statsTopArtists').innerHTML = topArtists.length
      ? topArtists.map(([name, count], i) => `
        <div class="stats-list-item">
          <span class="stats-rank">#${i+1}</span>
          <span class="stats-name">${name}</span>
          <span class="stats-count">${count} plays</span>
        </div>`).join('')
      : '<p class="section-sub">No data yet — play some songs!</p>';
  }

  // Top songs
  const topSongs = plays.sort((a, b) => b.count - a.count).slice(0, 5);
  if (el('statsTopSongs')) {
    el('statsTopSongs').innerHTML = topSongs.length
      ? topSongs.map((s, i) => `
        <div class="stats-list-item">
          <span class="stats-rank">#${i+1}</span>
          ${s.art ? `<img src="${s.art}" style="width:32px;height:32px;border-radius:4px;object-fit:cover;">` : ''}
          <span class="stats-name">${s.name} <small style="color:var(--text-dim)">– ${s.artist}</small></span>
          <span class="stats-count">${s.count}×</span>
        </div>`).join('')
      : '<p class="section-sub">No data yet — play some songs!</p>';
  }

  // Activity heatmap (last 7 days)
  if (el('statsActivity')) {
    const days = Array.from({length: 7}, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (6 - i));
      return { label: d.toLocaleDateString('en', {weekday:'short'}), count: listenStats.days[d.toDateString()] || 0 };
    });
    const max = Math.max(1, ...days.map(d => d.count));
    el('statsActivity').innerHTML = `<div class="activity-bar-chart">${days.map(d => `
      <div class="activity-col">
        <div class="activity-bar" style="height:${Math.max(4, (d.count/max)*60)}px;background:${d.count > 0 ? 'var(--green)' : 'var(--bg-4)'};" title="${d.count} plays"></div>
        <span class="activity-label">${d.label}</span>
      </div>`).join('')}</div>`;
  }
}

function clearStats() {
  if (!confirm('Clear all listening stats?')) return;
  listenStats = { plays: {}, artists: {}, totalSecs: 0, days: {} };
  saveListenStats();
  renderStats();
  showToast('🗑 Stats cleared');
}

window.clearStats = clearStats;

// Hook into playSong to record stats
const _origPlaySong = playSong;
window.playSong = function(song) {
  _origPlaySong(song);
  recordPlay(song);
};

// Track listen time
let _listenStart = null;
audio.addEventListener('play', () => { _listenStart = Date.now(); });
audio.addEventListener('pause', () => { if (_listenStart) { recordListenTime((Date.now() - _listenStart) / 1000); _listenStart = null; } });
audio.addEventListener('ended', () => { if (_listenStart) { recordListenTime((Date.now() - _listenStart) / 1000); _listenStart = null; } });

// Patch showSection to trigger init
const _origShowSection = showSection;
window.showSection = function(section) {
  _origShowSection(section);
  if (section === 'discover') setTimeout(initDiscoverSection, 0);
  if (section === 'stats') setTimeout(renderStats, 0);
  if (section === 'focus') setTimeout(updateFocusUI, 0);
};

// ================== 🔀 SHUFFLE & LOOP ==================

let shuffleOn = false;
let loopMode = 'none'; // 'none' | 'all' | 'one'

function toggleShuffle() {
  shuffleOn = !shuffleOn;
  const btn = document.getElementById('shuffleBtn');
  btn.classList.toggle('ctrl-active', shuffleOn);
  showToast(shuffleOn ? '🔀 Shuffle on' : '🔀 Shuffle off');
}

function cycleLoop() {
  const modes = ['none', 'all', 'one'];
  loopMode = modes[(modes.indexOf(loopMode) + 1) % 3];
  const btn = document.getElementById('loopBtn');
  btn.classList.toggle('ctrl-active', loopMode !== 'none');
  const labels = { none: '🔁 Loop off', all: '🔁 Loop all', one: '🔂 Loop one' };
  showToast(labels[loopMode]);
  const svg = btn.querySelector('svg');
  if (loopMode === 'one') {
    svg.innerHTML = '<polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 014-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 01-4 4H3"/><text x="10" y="15" font-size="7" fill="currentColor" stroke="none" font-weight="bold">1</text>';
  } else {
    svg.innerHTML = '<polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 014-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 01-4 4H3"/>';
  }
  audio.loop = loopMode === 'one';
}

// Patch nextSong to respect shuffle & loop
const _baseNextSong = nextSong;
window.nextSong = function() {
  if (loopMode === 'one') { audio.currentTime = 0; audio.play(); return; }
  if (shuffleOn && currentQueue.length > 1) {
    let idx;
    do { idx = Math.floor(Math.random() * currentQueue.length); } while (idx === currentIndex);
    currentIndex = idx;
    playSong(currentQueue[currentIndex]);
    return;
  }
  if (loopMode === 'all' && currentIndex >= currentQueue.length - 1) {
    currentIndex = 0; playSong(currentQueue[0]); return;
  }
  _baseNextSong();
};

audio.addEventListener('ended', () => {
  if (loopMode === 'one') return; // handled by audio.loop
  window.nextSong();
});

window.toggleShuffle = toggleShuffle;
window.cycleLoop = cycleLoop;

// ================== 🎚️ EQUALIZER ==================

const EQ_BANDS = [
  { label: 'Bass', freq: 60, type: 'lowshelf' },
  { label: 'Low Mid', freq: 250, type: 'peaking' },
  { label: 'Mid', freq: 1000, type: 'peaking' },
  { label: 'High Mid', freq: 4000, type: 'peaking' },
  { label: 'Treble', freq: 12000, type: 'highshelf' },
];
const EQ_PRESETS = {
  flat:       [0, 0, 0, 0, 0],
  bass:       [8, 4, 0, -2, -3],
  vocal:      [-2, -1, 4, 3, 1],
  electronic: [6, 2, -2, 3, 5],
};

let eqFilters = [];
let eqConnected = false;

function initEQ() {
  const ctx = getAudioCtx();
  eqFilters = EQ_BANDS.map(band => {
    const f = ctx.createBiquadFilter();
    f.type = band.type;
    f.frequency.value = band.freq;
    f.gain.value = 0;
    return f;
  });
  // Chain: source → filter0 → filter1 → ... → destination
  for (let i = 0; i < eqFilters.length - 1; i++) eqFilters[i].connect(eqFilters[i + 1]);
  eqFilters[eqFilters.length - 1].connect(getMaster());

  // Render band sliders
  const container = document.getElementById('eqBands');
  if (!container) return;
  container.innerHTML = '';
  EQ_BANDS.forEach((band, i) => {
    const col = document.createElement('div');
    col.className = 'eq-band';
    col.innerHTML = `
      <span class="eq-gain-val" id="eqVal${i}">0</span>
      <input type="range" class="eq-slider" min="-12" max="12" step="0.5" value="0"
        oninput="setEQBand(${i}, this.value)" orient="vertical">
      <span class="eq-freq-label">${band.label}</span>
    `;
    container.appendChild(col);
  });
}

function setEQBand(index, value) {
  const v = parseFloat(value);
  if (eqFilters[index]) eqFilters[index].gain.value = v;
  const el = document.getElementById('eqVal' + index);
  if (el) el.textContent = (v >= 0 ? '+' : '') + v;
}

function applyEQPreset(name) {
  const gains = EQ_PRESETS[name] || EQ_PRESETS.flat;
  gains.forEach((g, i) => {
    setEQBand(i, g);
    const slider = document.querySelectorAll('.eq-slider')[i];
    if (slider) slider.value = g;
  });
  document.querySelectorAll('.eq-preset-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.eq-preset-btn').forEach(b => { if (b.textContent.toLowerCase().includes(name) || (name==='bass'&&b.textContent.includes('Bass'))) b.classList.add('active'); });
  showToast('🎚️ EQ: ' + name);
}

function toggleEQ() {
  const panel = document.getElementById('eqPanel');
  const isHidden = panel.classList.contains('hidden');
  panel.classList.toggle('hidden');
  document.getElementById('eqBtn').classList.toggle('active', isHidden);
  if (isHidden && eqFilters.length === 0) initEQ();
}

// Wire EQ into audio chain: intercept source node creation
// We hook into the audio element's source via MediaElementSourceNode
let mediaSource = null;
function connectEQToAudio() {
  if (mediaSource || eqFilters.length === 0) return;
  try {
    const ctx = getAudioCtx();
    mediaSource = ctx.createMediaElementSource(audio);
    mediaSource.connect(eqFilters[0]);
  } catch(e) {}
}

audio.addEventListener('play', () => { if (eqFilters.length > 0) connectEQToAudio(); }, { once: true });

window.toggleEQ = toggleEQ;
window.setEQBand = setEQBand;
window.applyEQPreset = applyEQPreset;

// ================== 🌙 LIGHT / DARK THEME ==================

function initTheme() {
  const saved = localStorage.getItem('st-theme') || 'dark';
  applyTheme(saved, false);
}

function applyTheme(theme, save = true) {
  document.documentElement.setAttribute('data-theme', theme);
  if (save) localStorage.setItem('st-theme', theme);
  const icon = document.getElementById('themeIcon');
  if (!icon) return;
  if (theme === 'light') {
    icon.innerHTML = '<path d="M21 12.79A9 9 0 1111.21 3a7 7 0 009.79 9.79z"/>';
  } else {
    icon.innerHTML = '<circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>';
  }
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  showToast(next === 'light' ? '☀️ Light mode' : '🌙 Dark mode');
}

initTheme();
window.toggleTheme = toggleTheme;

// ================== 🎙️ VOICE SEARCH ==================

let voiceRecognition = null;
let voiceActive = false;

function toggleVoiceSearch() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) { showToast('Voice search not supported in this browser'); return; }

  if (voiceActive) {
    voiceRecognition?.stop();
    return;
  }

  voiceRecognition = new SpeechRecognition();
  voiceRecognition.lang = 'en-US';
  voiceRecognition.interimResults = true;
  voiceRecognition.maxAlternatives = 1;

  voiceRecognition.onstart = () => {
    voiceActive = true;
    document.getElementById('micBtn').classList.add('mic-active');
    document.getElementById('searchInput').placeholder = '🎙️ Listening…';
  };

  voiceRecognition.onresult = (e) => {
    const transcript = Array.from(e.results).map(r => r[0].transcript).join('');
    document.getElementById('searchInput').value = transcript;
    if (e.results[e.results.length - 1].isFinal) {
      voiceRecognition.stop();
      searchSongs();
    }
  };

  voiceRecognition.onerror = () => { showToast('Voice search error — try again'); };
  voiceRecognition.onend = () => {
    voiceActive = false;
    document.getElementById('micBtn').classList.remove('mic-active');
    document.getElementById('searchInput').placeholder = 'Search artists, songs, albums…';
  };

  voiceRecognition.start();
}

window.toggleVoiceSearch = toggleVoiceSearch;

// ================== 📋 QUEUE MANAGER ==================

let songQueue = []; // explicit queue (songs added via "play next")

function addToQueueNext(song) {
  // Insert right after currently playing
  const insertAt = currentIndex + 1;
  songQueue = [...currentQueue];
  songQueue.splice(insertAt, 0, song);
  currentQueue = songQueue;
  renderQueuePanel();
  updateQueueCount();
}

function toggleQueue() {
  const panel = document.getElementById('queuePanel');
  const isHidden = panel.classList.contains('hidden');
  panel.classList.toggle('hidden');
  document.getElementById('queueBtn').classList.toggle('active', isHidden);
  if (isHidden) renderQueuePanel();
}

function renderQueuePanel() {
  const list = document.getElementById('queueList');
  const sub = document.getElementById('queueSub');
  if (!list) return;

  if (!currentQueue.length) {
    list.innerHTML = '<p class="queue-empty">No songs in queue</p>';
    if (sub) sub.textContent = 'No songs queued';
    return;
  }

  if (sub) sub.textContent = `${currentQueue.length} song${currentQueue.length !== 1 ? 's' : ''} · Playing #${currentIndex + 1}`;
  list.innerHTML = '';

  currentQueue.forEach((song, idx) => {
    const item = document.createElement('div');
    item.className = 'queue-item' + (idx === currentIndex ? ' queue-item-playing' : '');
    item.style.setProperty('--q-i', idx);
    item.draggable = true;
    item.dataset.idx = idx;

    item.innerHTML = `
      <div class="queue-drag-handle">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="18" x2="16" y2="18"/></svg>
      </div>
      <img src="${song.artworkUrl100}" class="queue-art" alt="">
      <div class="queue-info">
        <p class="queue-song-name">${song.trackName}</p>
        <p class="queue-artist-name">${song.artistName}</p>
      </div>
      ${idx === currentIndex ? '<span class="queue-now-playing-badge">Now</span>' : ''}
      <button class="queue-remove-btn" data-idx="${idx}" title="Remove">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </button>
    `;

    item.onclick = (e) => {
      if (e.target.closest('.queue-remove-btn') || e.target.closest('.queue-drag-handle')) return;
      currentIndex = idx;
      playSong(currentQueue[idx]);
      renderQueuePanel();
    };

    item.querySelector('.queue-remove-btn').onclick = (e) => {
      e.stopPropagation();
      currentQueue.splice(idx, 1);
      if (idx < currentIndex) currentIndex--;
      renderQueuePanel();
      updateQueueCount();
    };

    // Drag to reorder
    item.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', idx); item.classList.add('dragging'); });
    item.addEventListener('dragend', () => item.classList.remove('dragging'));
    item.addEventListener('dragover', e => { e.preventDefault(); item.classList.add('drag-over'); });
    item.addEventListener('dragleave', () => item.classList.remove('drag-over'));
    item.addEventListener('drop', e => {
      e.preventDefault();
      item.classList.remove('drag-over');
      const from = parseInt(e.dataTransfer.getData('text/plain'));
      const to = idx;
      if (from === to) return;
      const moved = currentQueue.splice(from, 1)[0];
      currentQueue.splice(to, 0, moved);
      if (currentIndex === from) currentIndex = to;
      else if (from < currentIndex && to >= currentIndex) currentIndex--;
      else if (from > currentIndex && to <= currentIndex) currentIndex++;
      renderQueuePanel();
    });

    list.appendChild(item);
  });
}

function clearQueue() {
  const current = currentQueue[currentIndex];
  currentQueue = current ? [current] : [];
  currentIndex = 0;
  renderQueuePanel();
  updateQueueCount();
  showToast('🗑 Queue cleared');
}

function updateQueueCount() {
  const el = document.getElementById('queueCount');
  if (el) el.textContent = currentQueue.length > 0 ? currentQueue.length : '';
}

// Update queue panel whenever a song is played
const _queuePlaySong = window.playSong;
window.playSong = function(song) {
  _queuePlaySong(song);
  setTimeout(() => { renderQueuePanel(); updateQueueCount(); }, 50);
};

window.toggleQueue = toggleQueue;
window.clearQueue = clearQueue;
window.addToQueueNext = addToQueueNext;

// ══════════════════════════════════════════
//  AI SONG EXPLAINER  (Anthropic API — no backend)
// ══════════════════════════════════════════

let aiExplainerOpen = false;

function buildAIModal() {
  if (document.getElementById('aiExplainerOverlay')) return;

  const overlay = document.createElement('div');
  overlay.id = 'aiExplainerOverlay';
  overlay.className = 'ai-overlay';
  overlay.style.cssText = 'display:none; position:fixed; inset:0; background:rgba(0,0,0,0.72); backdrop-filter:blur(10px); z-index:10000; align-items:center; justify-content:center;';

  overlay.innerHTML = `
    <div class="ai-modal" id="aiModal">
      <div class="ai-modal-header">
        <div>
          <div class="ai-modal-title" id="aiModalTitle">AI Song Explainer</div>
          <div class="ai-modal-sub" id="aiModalSub">Powered by Claude</div>
        </div>
        <button class="lyrics-close" id="aiModalClose" onclick="closeAIExplainer()">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        </button>
      </div>

      <!-- Tab bar -->
      <div class="ai-tab-bar" id="aiTabBar">
        <button class="ai-tab active" data-tab="vibe" onclick="switchAITab('vibe', this)">🎭 Vibe</button>
        <button class="ai-tab" data-tab="story"  onclick="switchAITab('story', this)">📖 Story</button>
        <button class="ai-tab" data-tab="theory" onclick="switchAITab('theory', this)">🎼 Theory</button>
        <button class="ai-tab" data-tab="trivia" onclick="switchAITab('trivia', this)">🎲 Trivia</button>
      </div>

      <div class="ai-modal-body" id="aiModalBody">
        <div class="ai-loading" id="aiLoading">
          <div class="ai-spinner"></div>
          <span id="aiLoadingText">Asking Claude…</span>
        </div>
        <div class="ai-text" id="aiText" style="display:none"></div>
      </div>

      <!-- Footer -->
      <div class="ai-modal-footer" id="aiModalFooter">
        <button class="ai-regen-btn" id="aiRegenBtn" onclick="regenAIExplain()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>
          Regenerate
        </button>
        <span class="ai-powered-by">✦ Powered by Pollinations.AI · Free &amp; No Account Needed</span>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Close on backdrop click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeAIExplainer();
  });

  // Keyboard close
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && aiExplainerOpen) closeAIExplainer();
  });
}

let _currentExplainSong = null;
let _currentExplainTab  = 'vibe';
// Cache: key = `${trackId}-${tab}`, value = text
const _aiCache = {};

function openAIExplainer(song) {
  buildAIModal();
  _currentExplainSong = song;
  _currentExplainTab  = 'vibe';

  // Reset tabs
  document.querySelectorAll('.ai-tab').forEach(t => t.classList.remove('active'));
  document.querySelector('.ai-tab[data-tab="vibe"]').classList.add('active');

  // Header
  document.getElementById('aiModalTitle').textContent = song.trackName;
  document.getElementById('aiModalSub').textContent   = `by ${song.artistName} · ${song.primaryGenreName || 'Music'}`;

  // Show overlay
  const overlay = document.getElementById('aiExplainerOverlay');
  overlay.style.display = 'flex';
  aiExplainerOpen = true;

  fetchAIExplain(song, 'vibe');
}

function closeAIExplainer() {
  const overlay = document.getElementById('aiExplainerOverlay');
  if (overlay) {
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity 0.2s ease';
    setTimeout(() => {
      overlay.style.display = 'none';
      overlay.style.opacity = '';
    }, 200);
  }
  aiExplainerOpen = false;
}

function switchAITab(tab, btn) {
  if (!_currentExplainSong) return;
  _currentExplainTab = tab;
  document.querySelectorAll('.ai-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  fetchAIExplain(_currentExplainSong, tab);
}

function regenAIExplain() {
  if (!_currentExplainSong) return;
  // Bust cache for this tab
  const key = `${_currentExplainSong.trackId}-${_currentExplainTab}`;
  delete _aiCache[key];
  fetchAIExplain(_currentExplainSong, _currentExplainTab);
}

const AI_TAB_PROMPTS = {
  vibe: (s) => `You are a music expert. In 3–4 vivid, enthusiastic short paragraphs, describe the overall vibe, mood, and emotional energy of the song "${s.trackName}" by ${s.artistName} (genre: ${s.primaryGenreName || 'pop'}, released ${s.releaseDate ? s.releaseDate.slice(0,4) : 'unknown'}). Make it feel alive — use sensory language, mention what it feels like to listen, what activities or moments it suits. No headers. Keep it conversational and punchy.`,

  story: (s) => `You are a music historian. In 3–4 engaging short paragraphs, describe the story and background of "${s.trackName}" by ${s.artistName}. Cover: what the song is about lyrically, the artistic context or era it came from, any cultural significance, and what makes it memorable. No headers. Conversational tone.`,

  theory: (s) => `You are a music theory educator. In 3–4 short paragraphs, explain the musical elements of "${s.trackName}" by ${s.artistName} (genre: ${s.primaryGenreName || 'pop'}). Cover the likely key and mode, tempo feel, rhythm patterns, chord progressions, arrangement highlights, and any interesting production techniques. Explain accessibly — assume the reader is curious but not a professional musician. No headers.`,

  trivia: (s) => `You are a pop culture trivia writer. Give 5 fascinating, surprising, or little-known facts about "${s.trackName}" by ${s.artistName}. Format each as a short punchy paragraph starting with a bold emoji bullet like "🎤", "🎸", "💡", "🌍", "🏆". Keep each fact to 2–3 sentences. Make them genuinely interesting, not obvious.`,
};

// ── Pollinations.AI — free, no API key, full CORS support ──
// Uses openai-compatible endpoint: https://text.pollinations.ai/openai
// Model: openai (GPT-4o mini routed free)

async function fetchAIExplain(song, tab) {
  const cacheKey = `${song.trackId}-${tab}`;

  const loadingEl  = document.getElementById('aiLoading');
  const textEl     = document.getElementById('aiText');
  const loadTexts  = ['Tuning in…', 'Reading the vibes…', 'Spinning the record…', 'Almost there…'];
  let ltIdx = 0;

  loadingEl.style.display = 'flex';
  textEl.style.display    = 'none';
  textEl.innerHTML        = '';
  document.getElementById('aiLoadingText').textContent = loadTexts[0];

  const ltInterval = setInterval(() => {
    ltIdx = (ltIdx + 1) % loadTexts.length;
    const el = document.getElementById('aiLoadingText');
    if (el) el.textContent = loadTexts[ltIdx];
  }, 1100);

  // Serve from cache instantly
  if (_aiCache[cacheKey]) {
    clearInterval(ltInterval);
    loadingEl.style.display = 'none';
    textEl.style.display    = 'block';
    typewriterRender(textEl, _aiCache[cacheKey]);
    return;
  }

  const prompt = AI_TAB_PROMPTS[tab](song);

  try {
    // Route through backend proxy
    const response = await fetch('/api/explain', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });

    clearInterval(ltInterval);

    if (!response.ok) {
      throw new Error(`Server returned ${response.status}`);
    }

    const json = await response.json();
    if (json.error) throw new Error(json.error);
    const fullText = json.text || '';

    loadingEl.style.display = 'none';
    textEl.style.display    = 'block';
    textEl.innerHTML        = '';

    renderStreamedText(textEl, fullText, false);
    _aiCache[cacheKey] = fullText;

  } catch (err) {
    clearInterval(ltInterval);
    loadingEl.style.display = 'none';
    textEl.style.display    = 'block';
    textEl.innerHTML = `
      <p class="ai-error">⚠️ Couldn't reach the AI service.</p>
      <p class="ai-error-hint">Check your internet connection and try regenerating. This uses Pollinations.AI — free &amp; no account needed.</p>
    `;
  }
}

function renderStreamedText(container, fullText, streaming = false) {
  const paras = fullText.split(/\n\n+/).filter(p => p.trim());
  container.innerHTML = '';
  paras.forEach((p, i) => {
    const el = document.createElement('p');
    // Last paragraph gets blinking cursor while streaming
    el.className = (streaming && i === paras.length - 1) ? 'ai-para ai-stream-para' : 'ai-para';
    el.innerHTML = p
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>');
    el.style.animationDelay = `${i * 55}ms`;
    container.appendChild(el);
  });
}

function typewriterRender(container, text) {
  renderStreamedText(container, text, false);
  container.querySelectorAll('.ai-para').forEach((el, i) => {
    el.style.animation = 'none';
    el.offsetWidth;
    el.style.animation = '';
    el.style.animationDelay = `${i * 55}ms`;
  });
}

window.openAIExplainer  = openAIExplainer;
window.closeAIExplainer = closeAIExplainer;
window.switchAITab      = switchAITab;
window.regenAIExplain   = regenAIExplain;



// ═══════════════════════════════════════════
// LYRICMIND ENGINE
// ═══════════════════════════════════════════

// ── Canvas animations ──
let lmCanvasInited = false;
let lmBgT = 0;

function lmInitCanvases() {
  if (lmCanvasInited) return;
  lmCanvasInited = true;

  // Background orbs
  const bgCv = document.getElementById('lm-bg');
  const ptCv = document.getElementById('lm-pts');
  if (!bgCv || !ptCv) return;
  const bgCx = bgCv.getContext('2d');
  const ptCx = ptCv.getContext('2d');

  function lmResize() {
    const w = bgCv.offsetWidth || bgCv.parentElement?.offsetWidth || 900;
    const h = bgCv.offsetHeight || bgCv.parentElement?.offsetHeight || 600;
    bgCv.width = ptCv.width = w;
    bgCv.height = ptCv.height = h;
  }
  lmResize();

  const ORBS = [
    {x:.1,y:.15,r:260,col:'rgba(212,168,67,0.09)',s:.00007,p:0},
    {x:.9,y:.8,r:230,col:'rgba(78,205,196,0.055)',s:.00011,p:1.7},
    {x:.55,y:.5,r:190,col:'rgba(155,127,232,0.05)',s:.00009,p:3.2},
    {x:.75,y:.12,r:160,col:'rgba(212,168,67,0.06)',s:.00006,p:4.9},
    {x:.3,y:.85,r:130,col:'rgba(224,112,112,0.04)',s:.00013,p:2.1},
  ];

  const COLS = ['rgba(212,168,67,','rgba(78,205,196,','rgba(155,127,232,','rgba(240,204,122,'];
  const PARTS = Array.from({length:38},(_,i)=>({
    x:Math.random()*900, y:Math.random()*600,
    vx:(Math.random()-.5)*.2, vy:-(Math.random()*.16+.05),
    r:Math.random()*1.4+.4, col:COLS[i%4],
    life:Math.random(), maxLife:Math.random()*.6+.4,
  }));

  function lmBgLoop() {
    lmBgT += 16;
    const W = bgCv.width, H = bgCv.height;
    bgCx.clearRect(0,0,W,H);
    ORBS.forEach(o=>{
      const dx=Math.sin(lmBgT*o.s+o.p)*48,dy=Math.cos(lmBgT*o.s*.7+o.p)*34;
      const px=o.x*W+dx, py=o.y*H+dy;
      const g=bgCx.createRadialGradient(px,py,0,px,py,o.r);
      g.addColorStop(0,o.col); g.addColorStop(1,'transparent');
      bgCx.fillStyle=g; bgCx.beginPath(); bgCx.arc(px,py,o.r,0,Math.PI*2); bgCx.fill();
    });

    ptCx.clearRect(0,0,W,H);
    PARTS.forEach(p=>{
      p.x+=p.vx; p.y+=p.vy; p.life+=.004;
      if(p.life>p.maxLife||p.y<-10){p.x=Math.random()*W;p.y=H+10;p.life=0;}
      const a=Math.sin(p.life/p.maxLife*Math.PI)*.5;
      ptCx.beginPath(); ptCx.arc(p.x,p.y,p.r,0,Math.PI*2);
      ptCx.fillStyle=p.col+a+')'; ptCx.fill();
    });
    requestAnimationFrame(lmBgLoop);
  }
  lmBgLoop();

  // Logo canvas
  const lc = document.getElementById('lm-logo');
  if (lc) {
    const lx = lc.getContext('2d');
    let la = 0;
    (function lmLogo(){
      la += .013; lx.clearRect(0,0,34,34);
      const cx=17,cy=17;
      lx.strokeStyle='rgba(212,168,67,0.45)'; lx.lineWidth=.8;
      lx.beginPath(); lx.arc(cx,cy,14,0,Math.PI*2); lx.stroke();
      lx.strokeStyle='rgba(212,168,67,0.22)'; lx.setLineDash([3,2]);
      lx.beginPath(); lx.arc(cx,cy,8,0,Math.PI*2); lx.stroke();
      lx.setLineDash([]);
      lx.fillStyle='rgba(212,168,67,0.9)';
      lx.beginPath(); lx.arc(cx,cy,2.8,0,Math.PI*2); lx.fill();
      const ox1=cx+13*Math.cos(la), oy1=cy+13*Math.sin(la);
      lx.shadowColor='#d4a843'; lx.shadowBlur=7; lx.fillStyle='#f0cc7a';
      lx.beginPath(); lx.arc(ox1,oy1,2,0,Math.PI*2); lx.fill();
      const ox2=cx+7*Math.cos(-la*1.5+1), oy2=cy+7*Math.sin(-la*1.5+1);
      lx.shadowColor='#4ecdc4'; lx.shadowBlur=5; lx.fillStyle='#4ecdc4';
      lx.beginPath(); lx.arc(ox2,oy2,1.4,0,Math.PI*2); lx.fill();
      lx.shadowBlur=0;
      requestAnimationFrame(lmLogo);
    })();
  }

  // Welcome orb canvas
  const oc = document.getElementById('lm-orb');
  if (oc) {
    const ox = oc.getContext('2d');
    let oa = 0;
    (function lmOrb(){
      oa += .009; ox.clearRect(0,0,82,82);
      const cx=41,cy=41;
      [[38,1,'rgba(212,168,67,0.2)',false],[28,-1.5,'rgba(78,205,196,0.15)',true],[18,.8,'rgba(212,168,67,0.1)',false]].forEach(([r,spd,col,dash])=>{
        ox.save(); ox.translate(cx,cy); ox.rotate(oa*spd); ox.translate(-cx,-cy);
        ox.strokeStyle=col; ox.lineWidth=.9;
        ox.setLineDash(dash?[3,2]:[]);
        ox.beginPath(); ox.arc(cx,cy,r,0,Math.PI*2); ox.stroke();
        ox.restore();
      });
      ox.setLineDash([]);
      for(let i=0;i<3;i++){
        const ang=oa+i*(Math.PI*2/3);
        ox.shadowColor='#d4a843'; ox.shadowBlur=8; ox.fillStyle='rgba(212,168,67,0.85)';
        ox.beginPath(); ox.arc(cx+36*Math.cos(ang),cy+36*Math.sin(ang),2.1,0,Math.PI*2); ox.fill();
      }
      for(let i=0;i<2;i++){
        const ang=-oa*1.5+i*Math.PI;
        ox.shadowColor='#4ecdc4'; ox.shadowBlur=6; ox.fillStyle='rgba(78,205,196,0.85)';
        ox.beginPath(); ox.arc(cx+26*Math.cos(ang),cy+26*Math.sin(ang),1.6,0,Math.PI*2); ox.fill();
      }
      ox.shadowBlur=0;
      ox.strokeStyle='rgba(212,168,67,0.55)'; ox.lineWidth=1.1; ox.lineCap='round';
      ox.beginPath(); ox.moveTo(cx-5,cy+2); ox.lineTo(cx-5,cy-5); ox.lineTo(cx+4,cy-8); ox.lineTo(cx+4,cy-1); ox.stroke();
      ox.beginPath(); ox.arc(cx-3,cy+2,2.7,0,Math.PI*2); ox.stroke();
      ox.beginPath(); ox.arc(cx+5.5,cy-1,2.7,0,Math.PI*2); ox.stroke();
      requestAnimationFrame(lmOrb);
    })();
  }
}

// ── Genre ──
let lmGenre = 'Pop';
document.getElementById('lm-gbar').addEventListener('click', e=>{
  const p = e.target.closest('.lm-gp'); if(!p) return;
  document.querySelectorAll('.lm-gp').forEach(x=>x.classList.remove('on'));
  p.classList.add('on'); lmGenre = p.dataset.g;
});

// ── Input helpers ──
window.lmUsePrompt = function(t){ const u=document.getElementById('lm-ui'); u.value=t; lmOnInput(u); u.focus(); };
window.lmOnInput = function lmOnInput(el){ el.style.height='auto'; el.style.height=Math.min(el.scrollHeight,100)+'px'; document.getElementById('lm-cc').textContent=el.value.length+' / 200'; };
window.lmOnKey = function lmOnKey(e){ if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();lmSend();} };

// ── Chat helpers ──
const lmChat = document.getElementById('lm-chat');
function lmScr(){ lmChat.scrollTo({top:lmChat.scrollHeight,behavior:'smooth'}); }
function lmEsc(s){ return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function lmRmWelcome(){
  const w=document.getElementById('lm-welcome'); if(!w) return;
  w.style.transition='opacity .45s cubic-bezier(.16,1,.3,1),transform .45s cubic-bezier(.16,1,.3,1)';
  w.style.opacity='0'; w.style.transform='scale(.95) translateY(-12px)';
  setTimeout(()=>w.remove(),450);
}

function lmAddUser(txt){
  lmRmWelcome();
  const d=document.createElement('div'); d.className='lm-msg u';
  d.style.cssText='opacity:0;transform:translateY(12px) scale(.97);transition:opacity .44s cubic-bezier(.16,1,.3,1),transform .44s cubic-bezier(.16,1,.3,1)';
  d.innerHTML=`<div class="lm-av"><svg width="12" height="12" viewBox="0 0 13 13" fill="none"><circle cx="6.5" cy="4" r="2.2" stroke="rgba(200,196,188,.5)" stroke-width="1"/><path d="M2 12c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4" stroke="rgba(200,196,188,.5)" stroke-width="1" stroke-linecap="round"/></svg></div><div class="lm-bub">${lmEsc(txt)}</div>`;
  lmChat.appendChild(d); lmScr();
  requestAnimationFrame(()=>{ d.style.opacity='1'; d.style.transform='none'; });
}

function lmShowTyping(){
  const d=document.createElement('div'); d.className='lm-tw'; d.id='lm-typ';
  d.style.cssText='opacity:0;transform:translateY(10px);transition:opacity .38s ease,transform .38s ease';
  d.innerHTML=`<div class="lm-av" style="background:linear-gradient(135deg,rgba(212,168,67,.22),rgba(212,168,67,.04));border:1px solid rgba(212,168,67,.28)"><svg width="12" height="12" viewBox="0 0 13 13" fill="none"><path d="M3 10L3 5.5L8 4L8 8.5" stroke="rgba(212,168,67,.85)" stroke-width="1" stroke-linecap="round"/><circle cx="4.5" cy="10" r="1.8" stroke="rgba(212,168,67,.85)" stroke-width="1"/><circle cx="9.5" cy="8.5" r="1.8" stroke="rgba(212,168,67,.85)" stroke-width="1"/></svg></div><div class="lm-wf"><div class="lm-wb"></div><div class="lm-wb"></div><div class="lm-wb"></div><div class="lm-wb"></div><div class="lm-wb"></div><div class="lm-wb"></div><div class="lm-wb"></div><div class="lm-wb"></div><div class="lm-wb"></div><div class="lm-wb"></div><span class="lm-wlbl">composing…</span></div>`;
  lmChat.appendChild(d); lmScr();
  requestAnimationFrame(()=>{ d.style.opacity='1'; d.style.transform='none'; });
}

function lmRmTyping(){
  const t=document.getElementById('lm-typ'); if(!t) return;
  t.style.transition='opacity .28s,transform .28s';
  t.style.opacity='0'; t.style.transform='scale(.95)';
  setTimeout(()=>t.remove(),280);
}

function lmAddLyrics(txt,g){
  setTimeout(()=>{
    const d=document.createElement('div'); d.className='lm-msg ai';
    d.style.cssText='opacity:0;transform:translateY(14px) scale(.97);transition:opacity .52s cubic-bezier(.16,1,.3,1),transform .52s cubic-bezier(.16,1,.3,1)';
    const fmt=txt.split('\n').map(l=>{
      const t=l.trim(); return /^\[.+\]$/.test(t)?`<span class="lm-slabel">${lmEsc(t)}</span>`:lmEsc(l);
    }).join('\n');
    const safe=txt.replace(/\\/g,'\\\\').replace(/`/g,'\\`').replace(/\$/g,'\\$');
    d.innerHTML=`<div class="lm-av" style="background:linear-gradient(135deg,rgba(212,168,67,.22),rgba(212,168,67,.04));border:1px solid rgba(212,168,67,.28)"><svg width="12" height="12" viewBox="0 0 13 13" fill="none"><path d="M3 10L3 5.5L8 4L8 8.5" stroke="rgba(212,168,67,.85)" stroke-width="1" stroke-linecap="round"/><circle cx="4.5" cy="10" r="1.8" stroke="rgba(212,168,67,.85)" stroke-width="1"/><circle cx="9.5" cy="8.5" r="1.8" stroke="rgba(212,168,67,.85)" stroke-width="1"/></svg></div><div class="lm-bub"><div class="lm-bub-shine"></div><div class="lm-aitag">${lmEsc(g)} · Generated</div><div class="lm-lyrics">${fmt}</div><div class="lm-acts"><div class="lm-act" onclick="lmCopy(this,\`${safe}\`)">⎘ Copy</div><div class="lm-act" onclick="lmDl(\`${safe}\`,'${g}')">↓ Save</div></div></div>`;
    lmChat.appendChild(d); lmScr();
    requestAnimationFrame(()=>{ d.style.opacity='1'; d.style.transform='none'; });
  },180);
}

window.lmCopy = function lmCopy(btn,t){ navigator.clipboard.writeText(t).then(()=>{ btn.textContent='✓ Copied'; btn.classList.add('ok'); setTimeout(()=>{ btn.textContent='⎘ Copy'; btn.classList.remove('ok'); },2000); }); };
window.lmDl = function lmDl(t,g){ const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([t],{type:'text/plain'})); a.download=`lyrics-${g.toLowerCase()}-${Date.now()}.txt`; a.click(); };

// ── Send ──
let lmBusy = false;
window.lmSend = async function lmSend(){
  if(lmBusy) return;
  const inp=document.getElementById('lm-ui');
  const txt=inp.value.trim(); if(!txt) return;
  lmBusy=true; document.getElementById('lm-sbtn').disabled=true;
  inp.value=''; inp.style.height='auto'; document.getElementById('lm-cc').textContent='0 / 200';
  lmAddUser(txt); lmShowTyping();
  try{
    const r=await fetch('/api/lyrics',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({topic:txt,genre:lmGenre})
    });
    const data=await r.json();
    if(!r.ok||data.error) throw new Error(data.error||'Server error');
    lmRmTyping(); lmAddLyrics(data.lyrics,lmGenre);
  } catch(e){
    lmRmTyping();
    const d=document.createElement('div');
    d.style.cssText='padding:10px 14px;border-radius:11px;background:rgba(224,112,112,.05);border:1px solid rgba(224,112,112,.18);color:#e07070;font-size:10px;font-family:DM Sans,sans-serif;';
    d.textContent='⚠ '+e.message;
    lmChat.appendChild(d); lmScr();
  }
  lmBusy=false; document.getElementById('lm-sbtn').disabled=false; inp.focus();
};



// ── Ripple effect on play buttons ──
document.addEventListener('click', e => {
  const btn = e.target.closest('.ctrl-play, .card-play-overlay');
  if (!btn) return;
  const ripple = document.createElement('span');
  ripple.style.cssText = `position:absolute;border-radius:50%;background:rgba(255,255,255,0.25);pointer-events:none;transform:scale(0);animation:rippleOut 0.5s ease-out forwards;width:80px;height:80px;left:${e.offsetX-40}px;top:${e.offsetY-40}px`;
  btn.style.position = 'relative';
  btn.style.overflow = 'hidden';
  btn.appendChild(ripple);
  setTimeout(() => ripple.remove(), 500);
});


});
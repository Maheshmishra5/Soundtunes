const express = require('express');
const fetch   = require('node-fetch');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

/* ═══════════════════════════════════════════════════════════
   SHARED UTILITIES
═══════════════════════════════════════════════════════════ */

/**
 * Sleep for ms milliseconds.
 */
const sleep = ms => new Promise(r => setTimeout(r, ms));

/**
 * Fetch with automatic retry + exponential backoff.
 * Retries on 429, 503, 502, network errors.
 * @param {string}   url
 * @param {object}   options   node-fetch options
 * @param {number}   retries   max attempts (default 4)
 * @param {number}   baseDelay ms for first backoff (default 1200)
 */
async function fetchWithRetry(url, options = {}, retries = 4, baseDelay = 1200) {
  let lastErr;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(url, { timeout: 35000, ...options });

      // Retryable HTTP errors
      if ([429, 502, 503, 504].includes(res.status)) {
        const wait = baseDelay * Math.pow(2, attempt) + Math.random() * 400;
        console.warn(`[retry] attempt ${attempt + 1} — status ${res.status}, waiting ${Math.round(wait)}ms`);
        await sleep(wait);
        lastErr = new Error(`HTTP ${res.status}`);
        continue;
      }

      return res; // success or non-retryable error — return as-is
    } catch (err) {
      // Network / timeout errors are also retryable
      const wait = baseDelay * Math.pow(2, attempt) + Math.random() * 400;
      console.warn(`[retry] attempt ${attempt + 1} — ${err.message}, waiting ${Math.round(wait)}ms`);
      await sleep(wait);
      lastErr = err;
    }
  }
  throw lastErr || new Error('All retry attempts failed');
}

/**
 * In-memory response cache (TTL-based).
 * Avoids hammering Pollinations for identical prompts.
 */
const CACHE      = new Map();
const CACHE_TTL  = 10 * 60 * 1000; // 10 minutes

function cacheGet(key) {
  const entry = CACHE.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL) { CACHE.delete(key); return null; }
  return entry.value;
}

function cacheSet(key, value) {
  CACHE.set(key, { value, ts: Date.now() });
}

/**
 * Simple per-IP / global rate limiter to stop the server
 * from firing too many upstream calls at once.
 */
const IN_FLIGHT = { lyrics: 0, explain: 0 };
const MAX_IN_FLIGHT = 3; // concurrent upstream Pollinations calls


/* ═══════════════════════════════════════════════════════════
   POLLINATIONS — GET endpoint helper
   Models tried in order on 429: openai → mistral → openai-large
═══════════════════════════════════════════════════════════ */
const LYRIC_MODELS = ['openai', 'mistral', 'openai-large'];

async function pollinationsGet(prompt) {
  const cacheKey = 'get:' + prompt.slice(0, 200);
  const cached = cacheGet(cacheKey);
  if (cached) { console.log('[Pollinations GET] cache hit'); return cached; }

  for (const model of LYRIC_MODELS) {
    const url =
      'https://text.pollinations.ai/' +
      encodeURIComponent(prompt) +
      `?model=${model}&seed=${Math.floor(Math.random() * 99999)}`;

    console.log(`[Pollinations GET] trying model=${model}`);
    try {
      const res = await fetchWithRetry(url, {}, 4, 1000);
      if (!res.ok) {
        console.warn(`[Pollinations GET] model=${model} final status ${res.status}`);
        continue; // try next model
      }
      const text = await res.text();
      if (!text || text.trim().length < 10) continue;
      cacheSet(cacheKey, text.trim());
      return text.trim();
    } catch (err) {
      console.warn(`[Pollinations GET] model=${model} failed: ${err.message}`);
    }
  }
  throw new Error('All Pollinations models exhausted. Try again in a moment.');
}


/* ═══════════════════════════════════════════════════════════
   POLLINATIONS — POST /openai endpoint helper
   Models tried in order on 429: openai → mistral → openai-large
═══════════════════════════════════════════════════════════ */
const EXPLAIN_MODELS = ['openai', 'mistral', 'openai-large'];

async function pollinationsPost(messages, systemPrompt) {
  const cacheKey = 'post:' + systemPrompt.slice(0, 60) + ':' + messages.slice(-1)[0]?.content?.slice(0, 120);
  const cached = cacheGet(cacheKey);
  if (cached) { console.log('[Pollinations POST] cache hit'); return cached; }

  for (const model of EXPLAIN_MODELS) {
    console.log(`[Pollinations POST] trying model=${model}`);
    try {
      const res = await fetchWithRetry(
        'https://text.pollinations.ai/openai',
        {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            stream: false,
            messages: [
              { role: 'system', content: systemPrompt },
              ...messages,
            ],
          }),
        },
        4,
        1000
      );

      if (!res.ok) {
        console.warn(`[Pollinations POST] model=${model} final status ${res.status}`);
        continue;
      }

      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content || '';
      if (!text) continue;

      cacheSet(cacheKey, text);
      return text;
    } catch (err) {
      console.warn(`[Pollinations POST] model=${model} failed: ${err.message}`);
    }
  }
  throw new Error('All Pollinations models exhausted. Try again in a moment.');
}


/* ═══════════════════════════════════════════════════════════
   ROUTE: POST /api/lyrics  — LyricMind
═══════════════════════════════════════════════════════════ */
app.post('/api/lyrics', async (req, res) => {
  const { topic, genre } = req.body;
  if (!topic || !genre) return res.status(400).json({ error: 'Missing topic or genre.' });

  if (IN_FLIGHT.lyrics >= MAX_IN_FLIGHT) {
    return res.status(429).json({ error: 'Server busy — please wait a moment and try again.' });
  }

  const prompt =
    `Write complete song lyrics in the ${genre} genre about: "${topic}". ` +
    `Structure with labeled sections: [Verse 1], [Pre-Chorus], [Chorus], [Verse 2], [Bridge], [Outro]. ` +
    `Use vivid imagery, strong rhymes, and emotional storytelling that perfectly fits ${genre} music. ` +
    `Output ONLY the lyrics — no explanations, no preamble, no markdown.`;

  console.log(`[LyricMind] genre=${genre} | "${topic.slice(0, 60)}"`);
  IN_FLIGHT.lyrics++;

  try {
    const lyrics = await pollinationsGet(prompt);
    console.log(`[LyricMind] OK — ${lyrics.length} chars`);
    res.json({ lyrics });
  } catch (err) {
    console.error('[LyricMind]', err.message);
    res.status(502).json({ error: err.message });
  } finally {
    IN_FLIGHT.lyrics--;
  }
});


/* ═══════════════════════════════════════════════════════════
   ROUTE: GET /api/itunes  — iTunes search proxy
═══════════════════════════════════════════════════════════ */
app.get('/api/itunes', async (req, res) => {
  const { term, entity = 'song', limit = 20 } = req.query;
  if (!term) return res.status(400).json({ error: 'Missing term' });

  const cacheKey = `itunes:${term}:${entity}:${limit}`;
  const cached = cacheGet(cacheKey);
  if (cached) return res.json(cached);

  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=${entity}&limit=${limit}`;
  try {
    const upstream = await fetchWithRetry(url, {}, 3, 800);
    if (!upstream.ok) throw new Error(`iTunes returned ${upstream.status}`);
    const data = await upstream.json();
    cacheSet(cacheKey, data);
    res.json(data);
  } catch (err) {
    console.error('[iTunes]', err.message);
    res.status(502).json({ error: err.message });
  }
});


/* ═══════════════════════════════════════════════════════════
   ROUTE: POST /api/explain  — AI song explainer
═══════════════════════════════════════════════════════════ */
app.post('/api/explain', async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Missing prompt' });

  if (IN_FLIGHT.explain >= MAX_IN_FLIGHT) {
    return res.status(429).json({ error: 'Server busy — please wait a moment and try again.' });
  }

  IN_FLIGHT.explain++;
  try {
    const text = await pollinationsPost(
      [{ role: 'user', content: prompt }],
      'You are an enthusiastic music expert. Be vivid, engaging, and concise. Never use markdown headers. Use double newlines to separate paragraphs.'
    );
    res.json({ text });
  } catch (err) {
    console.error('[Explain]', err.message);
    res.status(502).json({ error: err.message });
  } finally {
    IN_FLIGHT.explain--;
  }
});


/* ═══════════════════════════════════════════════════════════
   ROUTE: GET /api/song-lyrics  — lyrics.ovh proxy
═══════════════════════════════════════════════════════════ */
app.get('/api/song-lyrics', async (req, res) => {
  const { artist, title } = req.query;
  if (!artist || !title) return res.status(400).json({ error: 'Missing artist or title' });

  const cacheKey = `lyrics:${artist}:${title}`;
  const cached = cacheGet(cacheKey);
  if (cached) return res.json(cached);

  try {
    const url = `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`;
    const upstream = await fetchWithRetry(url, {}, 3, 800);
    if (!upstream.ok) throw new Error(`lyrics.ovh returned ${upstream.status}`);
    const data = await upstream.json();
    cacheSet(cacheKey, data);
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});


/* ═══════════════════════════════════════════════════════════
   Fallback — SPA index.html
═══════════════════════════════════════════════════════════ */
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n🎵 SoundTunes running at http://localhost:${PORT}`);
  console.log(`   Retry logic: up to 4 attempts with exponential backoff`);
  console.log(`   Fallback models: ${LYRIC_MODELS.join(' → ')}`);
  console.log(`   Cache TTL: 10 minutes\n`);
});

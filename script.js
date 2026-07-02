'use strict';

/* =============================================================================================
   VOXA — Voice Grammar Checker
   Vanilla JS, modular namespaces. No frameworks, no build step.
   Sections:
     1. Config & Storage
     2. Toast notifications
     3. Theme
     4. Tabs / mode switch
     5. Diff engine (word-level LCS)
     6. Statistics
     7. Speech Recognition (speech -> text)
     8. Groq API (grammar correction)
     9. Speech Synthesis (text -> speech)
    10. History
    11. Settings modal
    12. Export (copy / txt / pdf / share)
    13. App bootstrap & event wiring
   ============================================================================================= */

/* =============================================================================================
   1. CONFIG & STORAGE
   ============================================================================================= */
const CONFIG = {
  GROQ_ENDPOINT: 'https://api.groq.com/openai/v1/chat/completions',
  GROQ_MODEL: 'llama-3.3-70b-versatile',
  REQUEST_TIMEOUT_MS: 25000,
  SYSTEM_PROMPT:
    'You are a precise grammar-correction engine. Correct the grammar, punctuation, ' +
    'capitalization, spelling, and sentence structure of the text the user gives you. ' +
    'Keep the meaning, tone, and length exactly the same — do not add new information, ' +
    'opinions, or explanations. Return ONLY the corrected sentence(s), with no preamble, ' +
    'no quotation marks, and no commentary.',
  READING_WPM: 200,   // average silent reading speed
  SPEAKING_WPM: 150,  // average natural speech speed
  STORAGE_KEYS: {
    apiKey: 'voxa_api_key',
    theme: 'voxa_theme',
    history: 'voxa_history',
    voiceSettings: 'voxa_voice_settings'
  }
};

const Storage = {
  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  },
  remove(key) {
    localStorage.removeItem(key);
  }
};

/* =============================================================================================
   2. TOAST NOTIFICATIONS
   ============================================================================================= */
const Toast = (() => {
  const region = document.getElementById('toastRegion');

  function show(message, type = 'info', duration = 4200) {
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.setAttribute('role', type === 'error' ? 'alert' : 'status');

    const icon = document.createElement('span');
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = type === 'success' ? '✓' : type === 'error' ? '⚠' : 'ℹ';

    const text = document.createElement('span');
    text.textContent = message;

    el.append(icon, text);
    region.appendChild(el);

    const timer = setTimeout(() => remove(el), duration);
    el.addEventListener('click', () => { clearTimeout(timer); remove(el); });
  }

  function remove(el) {
    el.classList.add('is-leaving');
    setTimeout(() => el.remove(), 280);
  }

  return {
    success: (msg) => show(msg, 'success'),
    error: (msg) => show(msg, 'error', 6000),
    info: (msg) => show(msg, 'info')
  };
})();

/* =============================================================================================
   3. THEME (dark / light)
   ============================================================================================= */
const Theme = (() => {
  const toggleBtn = document.getElementById('themeToggle');

  function apply(theme) {
    document.body.setAttribute('data-theme', theme);
    toggleBtn.setAttribute('aria-pressed', theme === 'light' ? 'true' : 'false');
    toggleBtn.setAttribute('aria-label', theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode');
    Storage.set(CONFIG.STORAGE_KEYS.theme, theme);
  }

  function init() {
    const saved = Storage.get(CONFIG.STORAGE_KEYS.theme);
    const prefersLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
    apply(saved || (prefersLight ? 'light' : 'dark'));

    toggleBtn.addEventListener('click', () => {
      const current = document.body.getAttribute('data-theme');
      apply(current === 'dark' ? 'light' : 'dark');
    });
  }

  return { init };
})();

/* =============================================================================================
   4. TABS / MODE SWITCH (voice vs manual typing)
   ============================================================================================= */
const Tabs = (() => {
  const switchEl = document.querySelector('.mode-switch');
  const voiceBtn = document.getElementById('modeVoiceBtn');
  const textBtn = document.getElementById('modeTextBtn');
  const voicePanel = document.getElementById('voicePanel');
  const textPanel = document.getElementById('textPanel');

  function activate(mode) {
    const isVoice = mode === 'voice';
    voiceBtn.classList.toggle('is-active', isVoice);
    textBtn.classList.toggle('is-active', !isVoice);
    voiceBtn.setAttribute('aria-selected', String(isVoice));
    textBtn.setAttribute('aria-selected', String(!isVoice));
    voicePanel.hidden = !isVoice;
    textPanel.hidden = isVoice;
    switchEl.dataset.active = mode;
    if (!isVoice) textPanel.querySelector('textarea').focus();
  }

  function init() {
    voiceBtn.addEventListener('click', () => activate('voice'));
    textBtn.addEventListener('click', () => activate('text'));
  }

  return { init };
})();

/* =============================================================================================
   5. DIFF ENGINE — word-level Longest Common Subsequence
   Produces elegant inline highlighting: additions/changes in the corrected text (green),
   removed words shown struck-through in the original text (red).
   ============================================================================================= */
const Diff = (() => {
  function tokenize(text) {
    // Split into words + trailing punctuation/whitespace, keeping separators so we can rejoin cleanly.
    return text.match(/\S+|\s+/g) || [];
  }

  function normalize(token) {
    return token.toLowerCase().replace(/[^\w']/g, '');
  }

  function lcsTable(a, b) {
    const m = a.length, n = b.length;
    const table = Array.from({ length: m + 1 }, () => new Uint16Array(n + 1));
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        table[i][j] = normalize(a[i - 1]) === normalize(b[j - 1]) && normalize(a[i - 1]) !== ''
          ? table[i - 1][j - 1] + 1
          : Math.max(table[i - 1][j], table[i][j - 1]);
      }
    }
    return table;
  }

  /**
   * Returns { originalHtml, correctedHtml, changeCount }
   */
  function compare(originalText, correctedText) {
    const a = tokenize(originalText);
    const b = tokenize(correctedText);
    const table = lcsTable(a, b);

    const originalParts = [];
    const correctedParts = [];
    let changeCount = 0;
    let i = a.length, j = b.length;
    const opsOriginal = [];
    const opsCorrected = [];

    while (i > 0 && j > 0) {
      if (normalize(a[i - 1]) === normalize(b[j - 1]) && normalize(a[i - 1]) !== '') {
        opsOriginal.unshift({ type: 'same', text: a[i - 1] });
        opsCorrected.unshift({ type: 'same', text: b[j - 1] });
        i--; j--;
      } else if (table[i - 1][j] >= table[i][j - 1]) {
        opsOriginal.unshift({ type: 'remove', text: a[i - 1] });
        i--;
      } else {
        opsCorrected.unshift({ type: 'add', text: b[j - 1] });
        j--;
      }
    }
    while (i > 0) { opsOriginal.unshift({ type: 'remove', text: a[i - 1] }); i--; }
    while (j > 0) { opsCorrected.unshift({ type: 'add', text: b[j - 1] }); j--; }

    const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    opsOriginal.forEach(op => {
      if (op.type === 'remove' && op.text.trim()) {
        changeCount++;
        originalParts.push(`<span class="diff-remove">${esc(op.text)}</span>`);
      } else {
        originalParts.push(esc(op.text));
      }
    });

    opsCorrected.forEach(op => {
      if (op.type === 'add' && op.text.trim()) {
        correctedParts.push(`<span class="diff-add">${esc(op.text)}</span>`);
      } else {
        correctedParts.push(esc(op.text));
      }
    });

    return {
      originalHtml: originalParts.join(''),
      correctedHtml: correctedParts.join(''),
      changeCount
    };
  }

  return { compare };
})();

/* =============================================================================================
   6. STATISTICS
   ============================================================================================= */
const Stats = (() => {
  const els = {
    words: document.getElementById('statWords'),
    chars: document.getElementById('statChars'),
    readTime: document.getElementById('statReadTime'),
    speakTime: document.getElementById('statSpeakTime'),
    corrections: document.getElementById('statCorrections'),
    totalChecks: document.getElementById('statTotalChecks')
  };

  function formatSeconds(totalSeconds) {
    if (totalSeconds < 60) return `${Math.max(1, Math.round(totalSeconds))}s`;
    const m = Math.floor(totalSeconds / 60);
    const s = Math.round(totalSeconds % 60);
    return `${m}m ${s}s`;
  }

  function update(text, changeCount) {
    const words = (text.trim().match(/\S+/g) || []).length;
    const chars = text.length;
    const readSeconds = (words / CONFIG.READING_WPM) * 60;
    const speakSeconds = (words / CONFIG.SPEAKING_WPM) * 60;

    els.words.textContent = words;
    els.chars.textContent = chars;
    els.readTime.textContent = words ? formatSeconds(readSeconds) : '0s';
    els.speakTime.textContent = words ? formatSeconds(speakSeconds) : '0s';
    els.corrections.textContent = changeCount;

    const total = (Storage.get(CONFIG.STORAGE_KEYS.history, []) || []).length;
    els.totalChecks.textContent = total;
  }

  function refreshTotalChecks() {
    const total = (Storage.get(CONFIG.STORAGE_KEYS.history, []) || []).length;
    els.totalChecks.textContent = total;
  }

  return { update, refreshTotalChecks };
})();

/* =============================================================================================
   7. SPEECH RECOGNITION (voice -> text)
   ============================================================================================= */
const Recognition = (() => {
  const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
  const micBtn = document.getElementById('micBtn');
  const micStatus = document.getElementById('micStatus');
  const micEq = document.getElementById('micEq');
  const liveTranscript = document.getElementById('liveTranscript');
  const checkVoiceBtn = document.getElementById('checkVoiceBtn');
  const langPill = document.getElementById('langPill');

  let recognizer = null;
  let isRecording = false;
  let finalTranscript = '';

  function isSupported() {
    return !!SpeechRecognitionCtor;
  }

  function capitalizeFirst(str) {
    return str ? str.charAt(0).toUpperCase() + str.slice(1) : str;
  }

  function setRecordingUI(active) {
    isRecording = active;
    micBtn.classList.toggle('is-recording', active);
    micBtn.setAttribute('aria-pressed', String(active));
    micBtn.setAttribute('aria-label', active ? 'Stop recording' : 'Start recording your voice');
    micEq.classList.toggle('is-active', active);
    micStatus.textContent = active ? 'Listening… speak now' : (finalTranscript ? 'Recording stopped' : 'Tap to start speaking');
  }

  function init() {
    if (!isSupported()) {
      micStatus.textContent = 'Voice input is not supported in this browser. Try Chrome or Edge, or use the “Type” tab.';
      micBtn.disabled = true;
      micBtn.style.opacity = '.5';
      micBtn.style.cursor = 'not-allowed';
      return;
    }

    recognizer = new SpeechRecognitionCtor();
    recognizer.continuous = true;
    recognizer.interimResults = true;
    recognizer.lang = 'en-US';
    langPill.textContent = 'EN';

    recognizer.addEventListener('result', (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcriptChunk = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += (finalTranscript && !/[.!?]\s*$/.test(finalTranscript) ? ' ' : ' ') + transcriptChunk.trim();
          finalTranscript = capitalizeFirst(finalTranscript.trim());
        } else {
          interim += transcriptChunk;
        }
      }
      const display = (finalTranscript + ' ' + interim).trim();
      liveTranscript.textContent = display || 'Your words will appear here as you speak…';
      checkVoiceBtn.disabled = !finalTranscript.trim();
    });

    recognizer.addEventListener('error', (event) => {
      setRecordingUI(false);
      const messages = {
        'not-allowed': 'Microphone access was denied. Please allow microphone permission in your browser settings.',
        'no-speech': 'No speech detected. Tap the mic and try again.',
        'audio-capture': 'No microphone was found. Please connect a microphone and try again.',
        'network': 'A network error interrupted speech recognition. Check your connection and try again.',
        'aborted': ''
      };
      const msg = messages[event.error] ?? `Speech recognition error: ${event.error}`;
      if (msg) Toast.error(msg);
      micStatus.textContent = msg || 'Tap to start speaking';
    });

    recognizer.addEventListener('end', () => {
      // Browser auto-stops after silence; reflect actual state.
      if (isRecording) setRecordingUI(false);
    });

    micBtn.addEventListener('click', toggle);
  }

  function toggle() {
    if (!recognizer) return;
    if (isRecording) {
      recognizer.stop();
      setRecordingUI(false);
    } else {
      try {
        finalTranscript = '';
        liveTranscript.textContent = 'Your words will appear here as you speak…';
        checkVoiceBtn.disabled = true;
        recognizer.start();
        setRecordingUI(true);
      } catch (err) {
        Toast.error('Could not start the microphone. Please try again.');
      }
    }
  }

  function reset() {
    finalTranscript = '';
    liveTranscript.textContent = 'Your words will appear here as you speak…';
    checkVoiceBtn.disabled = true;
  }

  function getTranscript() {
    return finalTranscript.trim();
  }

  return { init, reset, getTranscript, isSupported };
})();

/* =============================================================================================
   8. GROQ API — grammar correction
   ============================================================================================= */
const GroqAPI = (() => {
  function getApiKey() {
    return Storage.get(CONFIG.STORAGE_KEYS.apiKey, '');
  }

  /**
   * Calls the Groq chat completions endpoint.
   * @param {string} text - text to correct
   * @returns {Promise<string>} corrected text
   */
  async function correctGrammar(text) {
    const apiKey = getApiKey();
    if (!apiKey) {
      const err = new Error('No Groq API key found. Add one in Settings.');
      err.code = 'NO_KEY';
      throw err;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CONFIG.REQUEST_TIMEOUT_MS);

    let response;
    try {
      response = await fetch(CONFIG.GROQ_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: CONFIG.GROQ_MODEL,
          temperature: 0.2,
          max_tokens: 1024,
          messages: [
            { role: 'system', content: CONFIG.SYSTEM_PROMPT },
            { role: 'user', content: text }
          ]
        }),
        signal: controller.signal
      });
    } catch (networkErr) {
      clearTimeout(timeout);
      if (networkErr.name === 'AbortError') {
        const err = new Error('The request timed out. Please try again.');
        err.code = 'TIMEOUT';
        throw err;
      }
      const err = new Error('Network error — please check your internet connection.');
      err.code = 'NETWORK';
      throw err;
    }
    clearTimeout(timeout);

    if (!response.ok) {
      let detail = '';
      try { detail = (await response.json())?.error?.message || ''; } catch { /* ignore */ }

      if (response.status === 401) {
        const err = new Error('Invalid API key. Please check your key in Settings.');
        err.code = 'INVALID_KEY';
        throw err;
      }
      if (response.status === 429) {
        const err = new Error('Rate limit reached on the Groq API. Please wait a moment and try again.');
        err.code = 'RATE_LIMIT';
        throw err;
      }
      const err = new Error(detail || `Groq API error (${response.status}). Please try again.`);
      err.code = 'API_ERROR';
      throw err;
    }

    const data = await response.json();
    const corrected = data?.choices?.[0]?.message?.content?.trim();
    if (!corrected) {
      const err = new Error('The AI returned an empty response. Please try again.');
      err.code = 'EMPTY';
      throw err;
    }
    // Strip accidental wrapping quotes.
    return corrected.replace(/^["“]|["”]$/g, '').trim();
  }

  /**
   * Lightweight connectivity/key test — sends a minimal request.
   */
  async function testConnection() {
    return correctGrammar('This is a test.');
  }

  return { correctGrammar, testConnection, getApiKey };
})();

/* =============================================================================================
   9. SPEECH SYNTHESIS (text -> speech)
   ============================================================================================= */
const Synth = (() => {
  const synth = window.speechSynthesis;
  const voiceSelect = document.getElementById('voiceSelect');
  const rateSlider = document.getElementById('rateSlider');
  const pitchSlider = document.getElementById('pitchSlider');
  const volumeSlider = document.getElementById('volumeSlider');
  const rateOut = document.getElementById('rateOut');
  const pitchOut = document.getElementById('pitchOut');
  const volumeOut = document.getElementById('volumeOut');

  const playBtn = document.getElementById('playBtn');
  const pauseBtn = document.getElementById('pauseBtn');
  const resumeBtn = document.getElementById('resumeBtn');
  const stopBtn = document.getElementById('stopBtn');
  const speakStatus = document.getElementById('speakStatus');

  let voices = [];
  let currentUtterance = null;

  function isSupported() {
    return !!synth;
  }

  function loadVoices() {
    voices = synth.getVoices();
    if (!voices.length) return;
    const saved = Storage.get(CONFIG.STORAGE_KEYS.voiceSettings, {});
    voiceSelect.innerHTML = '';
    voices.forEach((v, idx) => {
      const opt = document.createElement('option');
      opt.value = idx;
      opt.textContent = `${v.name} (${v.lang})${v.default ? ' — default' : ''}`;
      voiceSelect.appendChild(opt);
    });
    if (saved.voiceName) {
      const match = voices.findIndex(v => v.name === saved.voiceName);
      if (match >= 0) voiceSelect.value = String(match);
    }
  }

  function persistSettings() {
    const idx = Number(voiceSelect.value);
    Storage.set(CONFIG.STORAGE_KEYS.voiceSettings, {
      voiceName: voices[idx]?.name || '',
      rate: rateSlider.value,
      pitch: pitchSlider.value,
      volume: volumeSlider.value
    });
  }

  function applySavedSliders() {
    const saved = Storage.get(CONFIG.STORAGE_KEYS.voiceSettings, {});
    if (saved.rate) { rateSlider.value = saved.rate; rateOut.textContent = saved.rate; }
    if (saved.pitch) { pitchSlider.value = saved.pitch; pitchOut.textContent = saved.pitch; }
    if (saved.volume !== undefined) { volumeSlider.value = saved.volume; volumeOut.textContent = saved.volume; }
  }

  function setButtonStates({ playing = false, paused = false, idle = true }) {
    playBtn.disabled = playing || paused;
    pauseBtn.disabled = !playing;
    resumeBtn.disabled = !paused;
    stopBtn.disabled = idle;
    speakStatus.textContent = playing ? 'Speaking…' : paused ? 'Paused' : 'Idle';
  }

  function speak(text) {
    if (!isSupported()) {
      Toast.error('Speech playback is not supported in this browser.');
      return;
    }
    if (!text || !text.trim()) return;

    synth.cancel(); // clear any queued speech
    const utter = new SpeechSynthesisUtterance(text);
    const idx = Number(voiceSelect.value);
    if (voices[idx]) utter.voice = voices[idx];
    utter.rate = Number(rateSlider.value);
    utter.pitch = Number(pitchSlider.value);
    utter.volume = Number(volumeSlider.value);

    utter.onstart = () => setButtonStates({ playing: true, idle: false });
    utter.onend = () => setButtonStates({ idle: true });
    utter.onerror = (e) => {
      if (e.error !== 'interrupted' && e.error !== 'canceled') {
        Toast.error('Speech playback failed. Please try again.');
      }
      setButtonStates({ idle: true });
    };

    currentUtterance = utter;
    synth.speak(utter);
  }

  function pause() {
    if (synth.speaking && !synth.paused) {
      synth.pause();
      setButtonStates({ paused: true, idle: false });
    }
  }

  function resume() {
    if (synth.paused) {
      synth.resume();
      setButtonStates({ playing: true, idle: false });
    }
  }

  function stop() {
    synth.cancel();
    setButtonStates({ idle: true });
  }

  function init() {
    if (!isSupported()) {
      speakStatus.textContent = 'Not supported';
      [playBtn, pauseBtn, resumeBtn, stopBtn].forEach(b => b.disabled = true);
      return;
    }

    loadVoices();
    applySavedSliders();
    if (synth.onvoiceschanged !== undefined) {
      synth.addEventListener('voiceschanged', () => { loadVoices(); applySavedSliders(); });
    }

    rateSlider.addEventListener('input', () => { rateOut.textContent = rateSlider.value; persistSettings(); });
    pitchSlider.addEventListener('input', () => { pitchOut.textContent = pitchSlider.value; persistSettings(); });
    volumeSlider.addEventListener('input', () => { volumeOut.textContent = volumeSlider.value; persistSettings(); });
    voiceSelect.addEventListener('change', persistSettings);

    playBtn.addEventListener('click', () => speak(App.getCorrectedText()));
    pauseBtn.addEventListener('click', pause);
    resumeBtn.addEventListener('click', resume);
    stopBtn.addEventListener('click', stop);

    setButtonStates({ idle: true });
  }

  return { init, speak, stop, isSupported };
})();

/* =============================================================================================
   10. HISTORY
   ============================================================================================= */
const History = (() => {
  const panel = document.getElementById('historyPanel');
  const scrim = document.getElementById('historyScrim');
  const list = document.getElementById('historyList');
  const emptyMsg = document.getElementById('historyEmpty');
  const toggleBtn = document.getElementById('historyToggle');
  const closeBtn = document.getElementById('closeHistoryBtn');
  const clearBtn = document.getElementById('clearHistoryBtn');

  function getAll() {
    return Storage.get(CONFIG.STORAGE_KEYS.history, []) || [];
  }

  function save(entry) {
    const items = getAll();
    items.unshift({
      id: `h_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      date: new Date().toISOString(),
      ...entry
    });
    // Cap history at 100 entries to keep localStorage light.
    Storage.set(CONFIG.STORAGE_KEYS.history, items.slice(0, 100));
    render();
    Stats.refreshTotalChecks();
  }

  function remove(id) {
    const items = getAll().filter(i => i.id !== id);
    Storage.set(CONFIG.STORAGE_KEYS.history, items);
    render();
    Stats.refreshTotalChecks();
  }

  function clearAll() {
    Storage.set(CONFIG.STORAGE_KEYS.history, []);
    render();
    Stats.refreshTotalChecks();
    Toast.info('History cleared.');
  }

  function formatDate(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
      ' · ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }

  function render() {
    const items = getAll();
    list.querySelectorAll('.history-item').forEach(el => el.remove());
    emptyMsg.style.display = items.length ? 'none' : 'block';

    items.forEach(item => {
      const el = document.createElement('article');
      el.className = 'history-item';
      el.innerHTML = `
        <span class="history-item-date">${formatDate(item.date)}</span>
        <p class="history-item-corrected"></p>
        <p class="history-item-original"></p>
        <div class="history-item-actions">
          <button class="btn btn-ghost btn-sm" data-action="replay" aria-label="Replay corrected text">▶ Replay</button>
          <button class="btn btn-ghost btn-sm" data-action="copy" aria-label="Copy corrected text">Copy</button>
          <button class="btn btn-danger btn-sm" data-action="delete" aria-label="Delete this entry">Delete</button>
        </div>`;
      el.querySelector('.history-item-corrected').textContent = item.corrected;
      el.querySelector('.history-item-original').textContent = item.original;

      el.querySelector('[data-action="replay"]').addEventListener('click', () => Synth.speak(item.corrected));
      el.querySelector('[data-action="copy"]').addEventListener('click', async () => {
        await Export.copyText(item.corrected);
      });
      el.querySelector('[data-action="delete"]').addEventListener('click', () => remove(item.id));

      list.appendChild(el);
    });
  }

  function open() {
    panel.classList.add('is-open');
    scrim.hidden = false;
    requestAnimationFrame(() => scrim.classList.add('is-open'));
    panel.setAttribute('aria-hidden', 'false');
    toggleBtn.setAttribute('aria-expanded', 'true');
  }

  function close() {
    panel.classList.remove('is-open');
    scrim.classList.remove('is-open');
    panel.setAttribute('aria-hidden', 'true');
    toggleBtn.setAttribute('aria-expanded', 'false');
    setTimeout(() => { if (!scrim.classList.contains('is-open')) scrim.hidden = true; }, 300);
  }

  function init() {
    render();
    toggleBtn.addEventListener('click', open);
    closeBtn.addEventListener('click', close);
    scrim.addEventListener('click', close);
    clearBtn.addEventListener('click', () => {
      if (getAll().length && confirm('Clear all history? This cannot be undone.')) clearAll();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && panel.classList.contains('is-open')) close();
    });
  }

  return { init, save, getAll };
})();

/* =============================================================================================
   11. SETTINGS MODAL
   ============================================================================================= */
const Settings = (() => {
  const scrim = document.getElementById('settingsScrim');
  const modal = document.getElementById('settingsModal');
  const openBtn = document.getElementById('settingsToggle');
  const closeBtn = document.getElementById('closeSettingsBtn');

  const apiKeyInput = document.getElementById('apiKeyInput');
  const toggleVisibilityBtn = document.getElementById('toggleKeyVisibility');
  const saveBtn = document.getElementById('saveKeyBtn');
  const testBtn = document.getElementById('testKeyBtn');
  const removeBtn = document.getElementById('removeKeyBtn');
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');

  function setStatus(state, text) {
    statusDot.className = 'status-dot' + (state ? ` is-${state}` : '');
    statusText.textContent = text;
  }

  function open() {
    modal.hidden = false;
    scrim.hidden = false;
    requestAnimationFrame(() => { modal.classList.add('is-open'); scrim.classList.add('is-open'); });
    apiKeyInput.focus();
  }

  function close() {
    modal.classList.remove('is-open');
    scrim.classList.remove('is-open');
    setTimeout(() => { modal.hidden = true; scrim.hidden = true; }, 300);
  }

  function loadKey() {
    const key = Storage.get(CONFIG.STORAGE_KEYS.apiKey, '');
    apiKeyInput.value = key;
    setStatus(key ? 'pending' : '', key ? 'Key saved — untested' : 'Not connected');
  }

  async function testKey(silent = false) {
    if (!apiKeyInput.value.trim()) {
      setStatus('bad', 'No key entered');
      if (!silent) Toast.error('Please enter an API key first.');
      return false;
    }
    setStatus('pending', 'Testing connection…');
    testBtn.disabled = true;
    try {
      // Temporarily store the key being tested so GroqAPI can read it.
      Storage.set(CONFIG.STORAGE_KEYS.apiKey, apiKeyInput.value.trim());
      await GroqAPI.testConnection();
      setStatus('good', 'Connected — key is valid');
      if (!silent) Toast.success('Connection successful!');
      return true;
    } catch (err) {
      setStatus('bad', err.message || 'Connection failed');
      if (!silent) Toast.error(err.message || 'Connection failed.');
      return false;
    } finally {
      testBtn.disabled = false;
    }
  }

  function init() {
    loadKey();

    openBtn.addEventListener('click', open);
    closeBtn.addEventListener('click', close);
    scrim.addEventListener('click', close);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.classList.contains('is-open')) close();
    });

    toggleVisibilityBtn.addEventListener('click', () => {
      const isPassword = apiKeyInput.type === 'password';
      apiKeyInput.type = isPassword ? 'text' : 'password';
      toggleVisibilityBtn.setAttribute('aria-label', isPassword ? 'Hide API key' : 'Show API key');
    });

    saveBtn.addEventListener('click', () => {
      const key = apiKeyInput.value.trim();
      if (!key) { Toast.error('Enter a key before saving.'); return; }
      Storage.set(CONFIG.STORAGE_KEYS.apiKey, key);
      setStatus('pending', 'Key saved — untested');
      Toast.success('API key saved to this browser.');
    });

    testBtn.addEventListener('click', () => testKey(false));

    removeBtn.addEventListener('click', () => {
      Storage.remove(CONFIG.STORAGE_KEYS.apiKey);
      apiKeyInput.value = '';
      setStatus('', 'Not connected');
      Toast.info('API key removed.');
    });
  }

  return { init };
})();

/* =============================================================================================
   12. EXPORT (copy / txt / pdf / share)
   ============================================================================================= */
const Export = (() => {
  const copyBtn = document.getElementById('copyBtn');
  const txtBtn = document.getElementById('downloadTxtBtn');
  const pdfBtn = document.getElementById('downloadPdfBtn');
  const shareBtn = document.getElementById('shareBtn');

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      Toast.success('Copied to clipboard.');
    } catch {
      // Fallback for older browsers
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); Toast.success('Copied to clipboard.'); }
      catch { Toast.error('Could not copy text.'); }
      ta.remove();
    }
  }

  function downloadTxt(text) {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `voxa-corrected-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    Toast.success('Downloaded as .txt');
  }

  function downloadPdf(text) {
    const jsPDFCtor = window.jspdf?.jsPDF;
    if (!jsPDFCtor) {
      Toast.error('PDF export library did not load. Check your connection and try again.');
      return;
    }
    const doc = new jsPDFCtor({ unit: 'pt', format: 'a4' });
    const margin = 56;
    const pageWidth = doc.internal.pageSize.getWidth();
    const maxWidth = pageWidth - margin * 2;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('Voxa — Corrected Text', margin, margin);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(90);
    doc.text(new Date().toLocaleString(), margin, margin + 20);

    doc.setTextColor(20);
    doc.setFontSize(12.5);
    const lines = doc.splitTextToSize(text, maxWidth);
    doc.text(lines, margin, margin + 50, { lineHeightFactor: 1.5 });

    doc.save(`voxa-corrected-${Date.now()}.pdf`);
    Toast.success('Downloaded as .pdf');
  }

  async function share(text) {
    if (!navigator.share) return;
    try {
      await navigator.share({ title: 'Voxa — Corrected Text', text });
    } catch (err) {
      if (err.name !== 'AbortError') Toast.error('Sharing failed.');
    }
  }

  function init() {
    if (navigator.share) shareBtn.hidden = false;

    copyBtn.addEventListener('click', () => copyText(App.getCorrectedText()));
    txtBtn.addEventListener('click', () => downloadTxt(App.getCorrectedText()));
    pdfBtn.addEventListener('click', () => downloadPdf(App.getCorrectedText()));
    shareBtn.addEventListener('click', () => share(App.getCorrectedText()));
  }

  return { init, copyText };
})();

/* =============================================================================================
   13. APP — orchestration & event wiring
   ============================================================================================= */
const App = (() => {
  const checkVoiceBtn = document.getElementById('checkVoiceBtn');
  const clearVoiceBtn = document.getElementById('clearVoiceBtn');
  const checkTextBtn = document.getElementById('checkTextBtn');
  const clearTextBtn = document.getElementById('clearTextBtn');
  const manualInput = document.getElementById('manualInput');

  const resultEmpty = document.getElementById('resultEmpty');
  const resultLoading = document.getElementById('resultLoading');
  const resultContent = document.getElementById('resultContent');
  const resultError = document.getElementById('resultError');
  const resultErrorText = document.getElementById('resultErrorText');
  const resultErrorRetry = document.getElementById('resultErrorRetry');

  const originalOut = document.getElementById('originalOut');
  const correctedOut = document.getElementById('correctedOut');
  const correctionCountPill = document.getElementById('correctionCountPill');
  const typingText = document.getElementById('typingText');

  let lastCorrectedPlainText = '';
  let lastOriginalText = '';
  let lastRequestFn = null;

  const TYPING_MESSAGES = [
    'Reading your sentence',
    'Checking grammar & punctuation',
    'Polishing the phrasing',
    'Almost done'
  ];

  function showState(state) {
    resultEmpty.hidden = state !== 'empty';
    resultLoading.hidden = state !== 'loading';
    resultContent.hidden = state !== 'content';
    resultError.hidden = state !== 'error';
  }

  function cycleTypingMessages() {
    let idx = 0;
    typingText.textContent = TYPING_MESSAGES[0];
    return setInterval(() => {
      idx = (idx + 1) % TYPING_MESSAGES.length;
      typingText.textContent = TYPING_MESSAGES[idx];
    }, 1400);
  }

  function validateInput(text) {
    if (!text || !text.trim()) {
      Toast.error('Please speak or type something before checking grammar.');
      return false;
    }
    if (text.trim().length < 2) {
      Toast.error('That text looks too short to check.');
      return false;
    }
    return true;
  }

  async function runGrammarCheck(rawText) {
    const text = rawText.trim();
    if (!validateInput(text)) return;

    if (!GroqAPI.getApiKey()) {
      Toast.error('Add your Groq API key in Settings before checking grammar.');
      Settings.__openFromApp?.();
      document.getElementById('settingsToggle').click();
      return;
    }

    lastRequestFn = () => runGrammarCheck(rawText);
    showState('loading');
    const typingTimer = cycleTypingMessages();

    try {
      const corrected = await GroqAPI.correctGrammar(text);
      clearInterval(typingTimer);

      const diff = Diff.compare(text, corrected);
      originalOut.innerHTML = diff.originalHtml || escapeHtml(text);
      correctedOut.innerHTML = diff.correctedHtml || escapeHtml(corrected);
      correctionCountPill.textContent = `${diff.changeCount} fix${diff.changeCount === 1 ? '' : 'es'}`;

      lastCorrectedPlainText = corrected;
      lastOriginalText = text;

      showState('content');
      Stats.update(corrected, diff.changeCount);
      History.save({ original: text, corrected, correctionsCount: diff.changeCount });

      // Automatically speak the corrected sentence.
      Synth.speak(corrected);
      Toast.success('Grammar check complete.');
    } catch (err) {
      clearInterval(typingTimer);
      showState('error');
      resultErrorText.textContent = err.message || 'Something went wrong while checking your grammar.';
      Toast.error(err.message || 'Grammar check failed.');
    }
  }

  function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function getCorrectedText() {
    return lastCorrectedPlainText;
  }

  function wireEvents() {
    checkVoiceBtn.addEventListener('click', () => runGrammarCheck(Recognition.getTranscript()));
    clearVoiceBtn.addEventListener('click', () => {
      Recognition.reset();
      showState('empty');
    });

    checkTextBtn.addEventListener('click', () => runGrammarCheck(manualInput.value));
    clearTextBtn.addEventListener('click', () => {
      manualInput.value = '';
      manualInput.focus();
    });

    resultErrorRetry.addEventListener('click', () => {
      if (lastRequestFn) lastRequestFn();
    });

    // Keyboard shortcut: Ctrl/Cmd + Enter submits whichever panel is visible.
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        const textPanelVisible = !document.getElementById('textPanel').hidden;
        if (textPanelVisible) checkTextBtn.click();
        else checkVoiceBtn.click();
      }
    });
  }

  function checkBrowserSupport() {
    if (!Recognition.isSupported()) {
      Toast.info('Voice input isn’t supported here — use the “Type” tab instead.');
    }
    if (!Synth.isSupported()) {
      Toast.info('Speech playback isn’t supported in this browser.');
    }
  }

  function init() {
    showState('empty');
    wireEvents();
    checkBrowserSupport();
  }

  return { init, getCorrectedText };
})();

/* =============================================================================================
   BOOTSTRAP
   ============================================================================================= */
document.addEventListener('DOMContentLoaded', () => {
  Theme.init();
  Tabs.init();
  Recognition.init();
  Synth.init();
  Settings.init();
  History.init();
  Export.init();
  App.init();
  Stats.refreshTotalChecks();
});
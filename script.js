(() => {
  'use strict';
 
  // ---------------------------------------------------
  // config
  // ---------------------------------------------------
  const DEFAULT_WORD_COUNT = 45;
  const MIN_WORD_COUNT = 10;
  const MAX_WORD_COUNT = 1000;
  const VISIBLE_LINES = 3;
  const WORD_LIST_URL =
    'https://raw.githubusercontent.com/first20hours/google-10000-english/master/google-10000-english-no-swears.txt';
  const SPECIAL_CHAR_CHANCE = 0.15; // fraction of tokens replaced by a digit/symbol when enabled
  const MIN_REAL_WORDS_FOR_DICTIONARY = 30; // below this, fall back to synthetic letter groups
 
  const FALLBACK_WORDS = [
    'the','of','and','a','to','in','is','you','that','it','he','was','for','on','are','as',
    'with','his','they','at','be','this','have','from','or','one','had','by','word','but','not',
    'what','all','were','we','when','your','can','said','there','use','an','each','which','she',
    'do','how','their','if','will','up','other','about','out','many','then','them','these','so',
    'some','her','would','make','like','him','into','time','has','look','two','more','write','go',
    'see','number','no','way','could','people','my','than','first','water','been','call','who','oil',
    'its','now','find','long','down','day','did','get','come','made','may','part','over','new','sound',
    'take','only','little','work','know','place','year','live','me','back','give','most','very','after',
    'thing','our','just','name','good','sentence','man','think','say','great','where','help','through',
    'much','before','line','right','too','mean','old','any','same','tell','boy','follow','came','want',
    'show','also','around','form','three','small','set','put','end','why','again','turn','here','off',
    'need','house','picture','try','us','again','animal','point','mother','world','near','build','self',
    'earth','father','head','stand','own','page','should','country','found','answer','school','grow',
    'study','still','learn','plant','cover','food','sun','four','between','state','keep','eye','never',
    'last','let','thought','city','tree','cross','farm','hard','start','might','story','saw','far','sea',
    'draw','left','late','run','while','press','close','night','real','life','few','north','open','seem'
  ];
 
  let WORD_POOL = FALLBACK_WORDS.slice();
 
  async function loadWordDatabase() {
    try {
      const res = await fetch(WORD_LIST_URL);
      if (!res.ok) throw new Error(`request failed with ${res.status}`);
      const text = await res.text();
      const words = text
        .split('\n')
        .map((w) => w.trim().toLowerCase())
        .filter((w) => w.length > 1 && /^[a-z]+$/.test(w));
 
      if (words.length > 500) {
        WORD_POOL = words;
      }
    } catch (err) {
      console.warn('word database unavailable, using preloaded word set', err);
    }
  }
 
  loadWordDatabase();
 
  // ---------------------------------------------------
  // keyboard layouts — letters + punctuation grouped by
  // physical row, per keyboard language. Most layouts share
  // the same digit row; Programmer Dvorak swaps that row for
  // its unshifted symbol row, its defining feature.
  // ---------------------------------------------------
  const NUMBER_ROW = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
 
  const KEYBOARD_LAYOUTS = {
    qwerty: {
      label: 'QWERTY',
      rows: {
        top: ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
        home: ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
        bottom: ['z', 'x', 'c', 'v', 'b', 'n', 'm'],
      },
      topPunct: ['[', ']'],
      homePunct: [';', "'"],
      bottomPunct: [',', '.', '/'],
    },
    colemak: {
      label: 'COLEMAK',
      rows: {
        top: ['q', 'w', 'f', 'p', 'g', 'j', 'l', 'u', 'y'],
        home: ['a', 'r', 's', 't', 'd', 'h', 'n', 'e', 'i', 'o'],
        bottom: ['z', 'x', 'c', 'v', 'b', 'k', 'm'],
      },
      topPunct: [';', '[', ']'],
      homePunct: ["'"],
      bottomPunct: [',', '.', '/'],
    },
    dvorak: {
      label: 'DVORAK',
      rows: {
        top: ['p', 'y', 'f', 'g', 'c', 'r', 'l'],
        home: ['a', 'o', 'e', 'u', 'i', 'd', 'h', 't', 'n', 's'],
        bottom: ['q', 'j', 'k', 'x', 'b', 'm', 'w', 'v', 'z'],
      },
      topPunct: ["'", ',', '.', '/', '\\'],
      homePunct: ['-'],
      bottomPunct: [';'],
    },
    progdvorak: {
      label: "PROG. DVORAK",
      // same letters as Dvorak — Programmer Dvorak only changes the
      // number row, swapping it for unshifted coding symbols since
      // programmers type symbols far more often than digits
      rows: {
        top: ['p', 'y', 'f', 'g', 'c', 'r', 'l'],
        home: ['a', 'o', 'e', 'u', 'i', 'd', 'h', 't', 'n', 's'],
        bottom: ['q', 'j', 'k', 'x', 'b', 'm', 'w', 'v', 'z'],
      },
      topPunct: ["'", ',', '.', '/', '\\'],
      homePunct: ['-'],
      bottomPunct: [';'],
      numberRow: ['&', '[', '{', '}', '(', '=', '*', ')', '+', ']'],
    },
    azerty: {
      label: 'AZERTY',
      rows: {
        top: ['a', 'z', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
        home: ['q', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'm'],
        bottom: ['w', 'x', 'c', 'v', 'b', 'n'],
      },
      topPunct: ['^'],
      homePunct: ['ù'],
      bottomPunct: ['<', ',', ';', ':'],
    },
  };
 
  function numberRowFor(layout) {
    return layout.numberRow || NUMBER_ROW;
  }
 
  // ---------------------------------------------------
  // word-selection state
  // ---------------------------------------------------
  let currentLayout = 'qwerty';
  const rowChecked = { top: true, home: true, bottom: true };
  let specialChars = false;
  let wordCount = DEFAULT_WORD_COUNT;
 
  function currentLayoutData() {
    return KEYBOARD_LAYOUTS[currentLayout];
  }
 
  function computeAllowedLetters() {
    const layout = currentLayoutData();
    const letters = new Set();
    if (rowChecked.top) layout.rows.top.forEach((l) => letters.add(l));
    if (rowChecked.home) layout.rows.home.forEach((l) => letters.add(l));
    if (rowChecked.bottom) layout.rows.bottom.forEach((l) => letters.add(l));
    return letters;
  }
 
  function computeSpecialPool() {
    const layout = currentLayoutData();
    const pool = [...numberRowFor(layout)];
    if (rowChecked.top) pool.push(...layout.topPunct);
    if (rowChecked.home) pool.push(...layout.homePunct);
    if (rowChecked.bottom) pool.push(...layout.bottomPunct);
    return pool;
  }
 
  function randomSyntheticWord(letters) {
    const arr = Array.from(letters);
    if (arr.length === 0) return 'a';
    const len = 2 + Math.floor(Math.random() * 4); // 2-5 letters
    let w = '';
    for (let i = 0; i < len; i++) {
      w += arr[Math.floor(Math.random() * arr.length)];
    }
    return w;
  }
 
  function generateWords(count) {
    const allowedLetters = computeAllowedLetters();
    const specialPool = computeSpecialPool();
 
    const dictionaryPool = WORD_POOL.filter(
      (w) => w.length > 0 && [...w].every((c) => allowedLetters.has(c))
    );
    const useSynthetic = dictionaryPool.length < MIN_REAL_WORDS_FOR_DICTIONARY;
 
    const out = [];
    for (let i = 0; i < count; i++) {
      if (specialChars && specialPool.length > 0 && Math.random() < SPECIAL_CHAR_CHANCE) {
        out.push(specialPool[Math.floor(Math.random() * specialPool.length)]);
        continue;
      }
      if (useSynthetic) {
        out.push(randomSyntheticWord(allowedLetters));
      } else {
        out.push(dictionaryPool[Math.floor(Math.random() * dictionaryPool.length)]);
      }
    }
    return out;
  }
 
  // ---------------------------------------------------
  // dom references
  // ---------------------------------------------------
  const passageViewport = document.getElementById('passageViewport');
  const passageInner = document.getElementById('passageInner');
  const caretEl = document.getElementById('caret');
  const stageEl = document.getElementById('stage');
  const hiddenInput = document.getElementById('hiddenInput');
  const progressFill = document.getElementById('progressFill');
 
  const statTime = document.getElementById('statTime');
  const statWpm = document.getElementById('statWpm');
  const statAcc = document.getElementById('statAcc');
 
  const resultsEl = document.getElementById('results');
  const resultWpm = document.getElementById('resultWpm');
  const resultAcc = document.getElementById('resultAcc');
  const resultTime = document.getElementById('resultTime');
  const resultChars = document.getElementById('resultChars');
 
  const restartBtn = document.getElementById('restartBtn');
  const restartFromResults = document.getElementById('restartFromResults');
 
  const settingsBtn = document.getElementById('settingsBtn');
  const settingsPanel = document.getElementById('settingsPanel');
  const settingsWrap = document.querySelector('.settings-wrap');
  const themeSelect = document.getElementById('themeSelect');
  const forgiveToggle = document.getElementById('forgiveToggle');
  const effectsToggle = document.getElementById('effectsToggle');
  const fontSelect = document.getElementById('fontSelect');
 
  const wordsBtn = document.getElementById('wordsBtn');
  const wordsPanel = document.getElementById('wordsPanel');
  const wordsWrap = document.querySelector('.words-wrap');
  const layoutSelect = document.getElementById('layoutSelect');
  const wordCountInput = document.getElementById('wordCountInput');
  const rowTopEl = document.getElementById('rowTop');
  const rowHomeEl = document.getElementById('rowHome');
  const rowBottomEl = document.getElementById('rowBottom');
  const specialToggleEl = document.getElementById('specialToggle');
 
  const keyboardVisualEl = document.getElementById('keyboardVisual');
 
  // ---------------------------------------------------
  // favicon — a lowercase "a" drawn in the currently
  // selected font, in the current theme's accent color.
  // Redrawn on theme change, font change, and at load.
  // ---------------------------------------------------
  const faviconEl = document.getElementById('favicon');

  function updateFavicon() {
    if (!faviconEl) return;

    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, size, size);

    const accent = getComputedStyle(document.body).getPropertyValue('--accent').trim();
    const fontFamily =
      (fontSelect && fontSelect.value) ||
      getComputedStyle(document.documentElement).getPropertyValue('--font-mono').trim();

    ctx.fillStyle = accent || '#ffffff';
    ctx.font = `700 ${Math.round(size * 0.72)}px ${fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('a', size / 2, size / 2 + size * 0.05);

    const dataUrl = canvas.toDataURL('image/png');

    // some browsers won't pick up a changed href on an existing <link>
    // reliably, so swap in a fresh link element each time to force it
    const newFavicon = faviconEl.cloneNode(true);
    newFavicon.href = dataUrl;
    faviconEl.replaceWith(newFavicon);
    faviconRef = newFavicon;
  }

  // mutable reference so repeated calls keep working after the node swap above
  let faviconRef = faviconEl;
 
  // ---------------------------------------------------
  // state
  // ---------------------------------------------------
  let target = '';
  let charEls = [];
  let lineRanges = [];           // [{start, end}] per visual line, end exclusive
  let startTime = null;
  let timerId = null;
  let finished = false;
  let lineHeightPx = 0;
  let currentLineIndex = 0;
  let minAllowedLength = 0;      // backspace cannot cross below this
  let forgiveMistakes = true;    // settings: mistakes don't block moving to the next line
  let keystrokeEffects = true;   // settings: glow + particle burst on correct keystrokes
  let lastRenderedLength = 0;    // how many chars were flashed as of the last render
 
  // ---------------------------------------------------
  // building the word stream
  // ---------------------------------------------------
  function buildPassage() {
    const words = generateWords(wordCount);
    target = words.join(' ');
 
    passageInner.innerHTML = '';
    passageInner.appendChild(caretEl);
    charEls = [];
 
    const frag = document.createDocumentFragment();
 
    words.forEach((word, wIndex) => {
      const wordSpan = document.createElement('span');
      wordSpan.className = 'word';
 
      for (const ch of word) {
        const charSpan = document.createElement('span');
        charSpan.className = 'char';
        charSpan.textContent = ch;
        wordSpan.appendChild(charSpan);
        charEls.push(charSpan);
      }
      frag.appendChild(wordSpan);
 
      if (wIndex < words.length - 1) {
        const spaceSpan = document.createElement('span');
        spaceSpan.className = 'char is-space';
        spaceSpan.textContent = ' ';
        frag.appendChild(spaceSpan);
        charEls.push(spaceSpan);
      }
    });
 
    passageInner.insertBefore(frag, caretEl);
  }
 
  function measureLineHeight() {
    lineHeightPx = parseFloat(getComputedStyle(passageInner).lineHeight) || 0;
    passageViewport.style.height = `${lineHeightPx * VISIBLE_LINES}px`;
  }
 
  function computeLineRanges() {
    const ranges = [];
    if (charEls.length === 0) return ranges;
    let start = 0;
    for (let i = 1; i <= charEls.length; i++) {
      if (i === charEls.length || charEls[i].offsetTop !== charEls[start].offsetTop) {
        ranges.push({ start, end: i });
        start = i;
      }
    }
    return ranges;
  }
 
  function resetState() {
    stopTimer();
    buildPassage();
    wordBoundaries = computeWordBoundaries();
    startTime = null;
    finished = false;
    currentLineIndex = 0;
    minAllowedLength = 0;
    lastRenderedLength = 0;
    recentIntervals = [];
    lastKeystrokeTime = null;
 
    hiddenInput.value = '';
    progressFill.style.width = '0%';
    statTime.textContent = '0s';
    statWpm.textContent = '0';
    statAcc.textContent = '100%';
 
    resultsEl.hidden = true;
    stageEl.hidden = false;
 
    requestAnimationFrame(() => {
      measureLineHeight();
      lineRanges = computeLineRanges();
      passageInner.style.transform = 'translateY(0px)';
      positionCaret(0, { instant: true });
      hiddenInput.focus();
    });
  }
 
  // ---------------------------------------------------
  // caret positioning + scroll
  // ---------------------------------------------------
  function positionCaret(index, opts = {}) {
    let left;
    let top;
 
    // when typing is blocked at the end of an erroneous line (forgive
    // mistakes off), draw the caret at the end of THAT line rather
    // than at the start of the next one, so nothing appears to scroll
    const useEndOfPrevChar = index >= charEls.length || opts.blockedRangeEnd === index;
 
    if (useEndOfPrevChar) {
      const last = charEls[Math.max(index - 1, 0)];
      left = last.offsetLeft + last.offsetWidth;
      top = last.offsetTop;
    } else {
      left = charEls[index].offsetLeft;
      top = charEls[index].offsetTop;
    }
 
    if (opts.instant) caretEl.classList.add('no-transition');
    caretEl.style.left = `${left}px`;
    caretEl.style.top = `${top}px`;
    if (opts.instant) {
      // eslint-disable-next-line no-unused-expressions
      caretEl.offsetHeight;
      caretEl.classList.remove('no-transition');
    }
 
    if (lineHeightPx > 0) {
      const lineIndex = Math.round(top / lineHeightPx);
      passageInner.style.transform = `translateY(${-lineIndex * lineHeightPx}px)`;
    }
  }
 
  // ---------------------------------------------------
  // a glow pulse + small particle burst on a character
  // right as it's typed correctly. Both use additive
  // ("screen") color blending, so overlapping glows and
  // particles brighten each other like real overlapping
  // light rather than just stacking flat color — a simple
  // stand-in for how light actually accumulates. Intensity
  // (glow size/opacity, particle count/spread) scales with
  // how fast the last few keystrokes have been landing.
  // Gated by the "keystroke effects" setting and skipped
  // when the user prefers reduced motion.
  // ---------------------------------------------------
  const prefersReducedMotion =
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 
  const TYPING_SPEED_WINDOW = 6;   // keystrokes averaged for the speed estimate
  const MIN_EFFECT_WPM = 20;       // at/below this, effects sit at their smallest
  const MAX_EFFECT_WPM = 110;      // at/above this, effects are at full intensity
 
  let recentIntervals = [];
  let lastKeystrokeTime = null;
 
  function recordKeystrokeTiming(now) {
    if (lastKeystrokeTime !== null) {
      const interval = now - lastKeystrokeTime;
      // cap long pauses (thinking, re-reading the passage) so one slow
      // moment doesn't linger in the average longer than it should
      recentIntervals.push(Math.min(interval, 2000));
      if (recentIntervals.length > TYPING_SPEED_WINDOW) recentIntervals.shift();
    }
    lastKeystrokeTime = now;
  }
 
  function currentTypingIntensity() {
    if (recentIntervals.length === 0) return 0;
    const avgIntervalMs = recentIntervals.reduce((a, b) => a + b, 0) / recentIntervals.length;
    const wpm = 60000 / avgIntervalMs / 5; // 5 chars per "word", standard wpm convention
    const t = (wpm - MIN_EFFECT_WPM) / (MAX_EFFECT_WPM - MIN_EFFECT_WPM);
    return Math.max(0, Math.min(1, t));
  }
 
  function flashChar(span, intensity) {
    // remove-then-add forces the glow animation to restart even if
    // this same char was flashed before (e.g. backspaced + retyped)
    span.classList.remove('flash');
    // eslint-disable-next-line no-unused-expressions
    void span.offsetWidth;
    span.style.setProperty('--glow-opacity', (0.5 + intensity * 0.5).toFixed(2));
    span.style.setProperty('--glow-scale', (1 + intensity * 1.1).toFixed(2));
    span.classList.add('flash');
  }
 
  const MIN_PARTICLES = 2;
  const MAX_PARTICLES = 11;
 
  function spawnParticles(span, intensity) {
    const cx = span.offsetLeft + span.offsetWidth / 2;
    const cy = span.offsetTop + span.offsetHeight / 2;
    const count = Math.round(MIN_PARTICLES + intensity * (MAX_PARTICLES - MIN_PARTICLES));
    const spread = 1 + intensity * 0.9;
    const particleOpacity = (0.5 + intensity * 0.5).toFixed(2);
 
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() * 0.9 - 0.45);
      const distance = (8 + Math.random() * 10) * spread;
      const dx = Math.cos(angle) * distance;
      const dy = Math.sin(angle) * distance - 4; // slight upward bias
 
      const particle = document.createElement('span');
      particle.className = 'char-particle';
      particle.style.left = `${cx}px`;
      particle.style.top = `${cy}px`;
      particle.style.setProperty('--dx', `${dx}px`);
      particle.style.setProperty('--dy', `${dy}px`);
      particle.style.setProperty('--particle-opacity', particleOpacity);
      particle.addEventListener('animationend', () => particle.remove(), { once: true });
      passageInner.appendChild(particle);
    }
  }
 
  function triggerCharEffect(span, intensity) {
    if (!keystrokeEffects) return;
    flashChar(span, intensity);
    if (!prefersReducedMotion) {
      spawnParticles(span, intensity);
    }
  }
 
  // ---------------------------------------------------
  // once the caret moves onto a new line, the line(s) above
  // scroll out of the box and are locked — backspace can no
  // longer reach back into them.
  // ---------------------------------------------------
  function lineIndexForCharIndex(charIndex) {
    for (let li = 0; li < lineRanges.length; li++) {
      if (charIndex <= lineRanges[li].end) return li;
    }
    return lineRanges.length - 1;
  }
 
  function updateLineLock(index) {
    if (lineRanges.length === 0) return;
    const li = lineIndexForCharIndex(index);
    if (li > currentLineIndex) {
      currentLineIndex = li;
      minAllowedLength = lineRanges[li].start;
    }
  }
 
  // ---------------------------------------------------
  // "forgive mistakes" gating — when off, a line with an
  // error in it cannot be advanced past until it's fixed.
  //
  // the gate trips on the line's CONTENT (trimming any
  // trailing space that only exists to separate it from the
  // next word) rather than the full range. Gating on the full
  // range — trailing space included — let a mistyped line
  // accept one extra, invisible keystroke (the space) before
  // blocking; trimming it means the block engages the instant
  // the line's actual characters are complete and wrong.
  // ---------------------------------------------------
  function isRangeCorrect(value, start, end) {
    for (let i = start; i < end; i++) {
      if (value[i] !== target[i]) return false;
    }
    return true;
  }
 
  function contentEndFor(range) {
    let end = range.end;
    while (end > range.start && target[end - 1] === ' ') end--;
    return end;
  }
 
  function applyForgiveMistakesGate(value) {
    if (forgiveMistakes) return { value, blockedRangeEnd: null };
 
    for (const range of lineRanges) {
      if (value.length <= range.start) break;
      const contentEnd = contentEndFor(range);
      if (contentEnd <= range.start) continue; // whitespace-only range, nothing to gate
      const lineContentTyped = value.length >= contentEnd;
      if (lineContentTyped && !isRangeCorrect(value, range.start, contentEnd)) {
        return { value: value.slice(0, contentEnd), blockedRangeEnd: contentEnd };
      }
    }
    return { value, blockedRangeEnd: null };
  }
 
  // ---------------------------------------------------
  // word-gated correctness — a word only contributes to
  // wpm once it has been fully typed AND typed with no
  // mistakes anywhere in it.
  // ---------------------------------------------------
  let wordBoundaries = [];
 
  function computeWordBoundaries() {
    const bounds = [];
    let i = 0;
    while (i < target.length) {
      const start = i;
      while (i < target.length && target[i] !== ' ') i++;
      bounds.push({ start, end: i });
      if (i < target.length) i++; // skip the space
    }
    return bounds;
  }
 
  function countWpmEligibleChars(value) {
    let sum = 0;
    for (const { start, end } of wordBoundaries) {
      if (value.length < end) continue;
      if (isRangeCorrect(value, start, end)) sum += (end - start);
    }
    return sum;
  }
 
  // ---------------------------------------------------
  // typing logic
  // ---------------------------------------------------
  function handleInput() {
    if (finished) return;
 
    let value = hiddenInput.value;
 
    if (value.length > target.length) {
      value = value.slice(0, target.length);
    }
 
    const gated = applyForgiveMistakesGate(value);
    value = gated.value;
 
    if (value !== hiddenInput.value) {
      hiddenInput.value = value;
    }
 
    if (value.length > 0 && startTime === null) {
      startTime = Date.now();
      startTimer();
    }
 
    let correctCount = 0;
 
    for (let i = 0; i < charEls.length; i++) {
      const span = charEls[i];
      if (i < value.length) {
        const isCorrect = value[i] === target[i];
        span.classList.toggle('correct', isCorrect);
        span.classList.toggle('incorrect', !isCorrect);
        if (isCorrect) correctCount++;
      } else {
        span.classList.remove('correct', 'incorrect');
      }
    }
 
    // a light flash on each newly typed character, but only when it's
    // correct — a wrong keystroke gets the persistent error styling
    // instead, not a flash. Only NEW characters (typed since the last
    // render) flash, so retyping the whole passage doesn't re-flash
    // everything already on screen. Speed is measured once per
    // keystroke, not per character, since a batch of "new" characters
    // in one render is still one keystroke's worth of typing.
    if (value.length > lastRenderedLength) {
      recordKeystrokeTiming(Date.now());
      const intensity = currentTypingIntensity();
      for (let i = lastRenderedLength; i < value.length; i++) {
        if (value[i] === target[i]) {
          triggerCharEffect(charEls[i], intensity);
        }
      }
    }
    lastRenderedLength = value.length;
 
    const wpmChars = countWpmEligibleChars(value);
 
    positionCaret(value.length, { blockedRangeEnd: gated.blockedRangeEnd });
    updateLineLock(value.length);
    progressFill.style.width = `${(value.length / target.length) * 100}%`;
 
    updateLiveStats(wpmChars, correctCount, value.length);
 
    const readyToFinish = value.length === target.length &&
      (forgiveMistakes || correctCount === target.length);
 
    if (readyToFinish) {
      finishTest(wpmChars, correctCount, value.length);
    }
  }
 
  function updateLiveStats(wpmChars, correctCount, typedCount) {
    if (startTime === null) return;
    const elapsedMin = (Date.now() - startTime) / 60000;
    const wpm = elapsedMin > 0 ? Math.round((wpmChars / 5) / elapsedMin) : 0;
    const acc = typedCount > 0 ? Math.round((correctCount / typedCount) * 100) : 100;
 
    statWpm.textContent = String(Math.max(wpm, 0));
    statAcc.textContent = `${acc}%`;
  }
 
  function startTimer() {
    timerId = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      statTime.textContent = `${elapsed}s`;
    }, 250);
  }
 
  function stopTimer() {
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
  }
 
  function finishTest(wpmChars, correctCount, typedCount) {
    finished = true;
    stopTimer();
    hiddenInput.blur();
 
    const elapsedSec = startTime ? (Date.now() - startTime) / 1000 : 0;
    const elapsedMin = elapsedSec / 60;
    const wpm = elapsedMin > 0 ? Math.round((wpmChars / 5) / elapsedMin) : 0;
    const acc = typedCount > 0 ? Math.round((correctCount / typedCount) * 100) : 100;
 
    resultWpm.textContent = String(Math.max(wpm, 0));
    resultAcc.textContent = `${acc}%`;
    resultTime.textContent = `${Math.round(elapsedSec)}s`;
    resultChars.textContent = `${correctCount}/${typedCount}`;
 
    // the type box disappears; the top stat pills stay put and the
    // results (with their own wpm/stats/button) rise into view
    stageEl.hidden = true;
    resultsEl.hidden = false;
  }
 
  // ---------------------------------------------------
  // keyboard visual — mirrors the selected layout and the
  // rows currently enabled for word generation, and lights
  // up keys as they're pressed.
  // ---------------------------------------------------
  function buildKeyboardVisual() {
    const layout = currentLayoutData();
    keyboardVisualEl.innerHTML = '';
 
    const numberRowEl = document.createElement('div');
    numberRowEl.className = 'kb-row';
    if (!specialChars) {
      // digits/symbols on this row only ever appear when the special
      // characters toggle is on, so dim it in step with that setting
      numberRowEl.classList.add('kb-row-disabled');
    }
    numberRowFor(layout).forEach((k) => {
      const keyEl = document.createElement('div');
      keyEl.className = 'kb-key';
      keyEl.dataset.key = k;
      keyEl.textContent = k;
      numberRowEl.appendChild(keyEl);
    });
    const backKey = document.createElement('div');
    backKey.className = 'kb-key kb-backspace';
    backKey.dataset.code = 'Backspace';
    backKey.textContent = 'back';
    numberRowEl.appendChild(backKey);
    keyboardVisualEl.appendChild(numberRowEl);
 
    const letterRowDefs = [
      { keys: [...layout.rows.top, ...layout.topPunct], rowName: 'top' },
      { keys: [...layout.rows.home, ...layout.homePunct], rowName: 'home' },
      { keys: [...layout.rows.bottom, ...layout.bottomPunct], rowName: 'bottom' },
    ];
 
    letterRowDefs.forEach((rowDef) => {
      const rowEl = document.createElement('div');
      rowEl.className = 'kb-row';
      if (!rowChecked[rowDef.rowName]) {
        rowEl.classList.add('kb-row-disabled');
      }
      rowDef.keys.forEach((k) => {
        const keyEl = document.createElement('div');
        keyEl.className = 'kb-key';
        keyEl.dataset.key = k;
        keyEl.textContent = k;
        rowEl.appendChild(keyEl);
      });
      keyboardVisualEl.appendChild(rowEl);
    });
 
    const spaceRowEl = document.createElement('div');
    spaceRowEl.className = 'kb-row kb-row-space';
    const spaceKey = document.createElement('div');
    spaceKey.className = 'kb-key kb-wide';
    spaceKey.dataset.code = 'Space';
    spaceKey.textContent = 'space';
    spaceRowEl.appendChild(spaceKey);
    keyboardVisualEl.appendChild(spaceRowEl);
  }
 
  function keyElsForEvent(e) {
    if (e.key === ' ' || e.code === 'Space') {
      return keyboardVisualEl.querySelectorAll('[data-code="Space"]');
    }
    if (e.key === 'Backspace') {
      return keyboardVisualEl.querySelectorAll('[data-code="Backspace"]');
    }
    if (e.key && e.key.length === 1) {
      const norm = e.key.toLowerCase();
      return keyboardVisualEl.querySelectorAll(`[data-key="${CSS.escape(norm)}"]`);
    }
    return [];
  }
 
  document.addEventListener('keydown', (e) => {
    keyElsForEvent(e).forEach((el) => el.classList.add('active'));
  });
 
  document.addEventListener('keyup', (e) => {
    keyElsForEvent(e).forEach((el) => el.classList.remove('active'));
  });
 
  // ---------------------------------------------------
  // settings: theme, font, forgive-mistakes
  // ---------------------------------------------------
  function openPanel(panelEl, btnEl) {
    panelEl.hidden = false;
    btnEl.setAttribute('aria-expanded', 'true');
  }
 
  function closePanel(panelEl, btnEl) {
    panelEl.hidden = true;
    btnEl.setAttribute('aria-expanded', 'false');
  }
 
  function isPanelOpen(panelEl) {
    return !panelEl.hidden;
  }
 
  settingsBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (isPanelOpen(settingsPanel)) {
      closePanel(settingsPanel, settingsBtn);
    } else {
      closePanel(wordsPanel, wordsBtn);
      openPanel(settingsPanel, settingsBtn);
    }
  });
 
  wordsBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (isPanelOpen(wordsPanel)) {
      closePanel(wordsPanel, wordsBtn);
    } else {
      closePanel(settingsPanel, settingsBtn);
      openPanel(wordsPanel, wordsBtn);
    }
  });
 
  document.addEventListener('click', (e) => {
    if (isPanelOpen(settingsPanel) && !settingsWrap.contains(e.target)) {
      closePanel(settingsPanel, settingsBtn);
    }
    if (isPanelOpen(wordsPanel) && !wordsWrap.contains(e.target)) {
      closePanel(wordsPanel, wordsBtn);
    }
  });
 
  // clicks inside either panel (selects, checkboxes, labels) must not
  // bubble up to the stage's "click anywhere to refocus typing" handler —
  // stealing focus away mid-click is what closes a native <select>'s
  // open dropdown before the user can pick an option
  settingsPanel.addEventListener('click', (e) => e.stopPropagation());
  wordsPanel.addEventListener('click', (e) => e.stopPropagation());
 
  themeSelect.addEventListener('change', () => {
    document.body.dataset.theme = themeSelect.value;
    updateFavicon();
  });
 
  forgiveToggle.addEventListener('change', () => {
    forgiveMistakes = forgiveToggle.checked;
    resetState();
  });
 
  effectsToggle.addEventListener('change', () => {
    keystrokeEffects = effectsToggle.checked;
  });
 
  fontSelect.addEventListener('change', () => {
    document.documentElement.style.setProperty('--font-mono', fontSelect.value);
    // re-measure since a new font can change line height / wrapping
    requestAnimationFrame(() => {
      measureLineHeight();
      lineRanges = computeLineRanges();
      positionCaret(hiddenInput.value.length, { instant: true });
    });
    updateFavicon();
  });
 
  // ---------------------------------------------------
  // settings: word selection (rows, special chars, layout)
  // ---------------------------------------------------
  function handleRowToggle(rowName, checkboxEl) {
    const wantsChecked = checkboxEl.checked;
    const otherRowsStillChecked = Object.keys(rowChecked)
      .filter((r) => r !== rowName)
      .some((r) => rowChecked[r]);
 
    if (!wantsChecked && !otherRowsStillChecked) {
      // never allow every row to end up unchecked — there'd be no
      // letters left to build words from
      checkboxEl.checked = true;
      return;
    }
 
    rowChecked[rowName] = wantsChecked;
    buildKeyboardVisual();
    resetState();
  }
 
  rowTopEl.addEventListener('change', () => handleRowToggle('top', rowTopEl));
  rowHomeEl.addEventListener('change', () => handleRowToggle('home', rowHomeEl));
  rowBottomEl.addEventListener('change', () => handleRowToggle('bottom', rowBottomEl));
 
  specialToggleEl.addEventListener('change', () => {
    specialChars = specialToggleEl.checked;
    buildKeyboardVisual();
    resetState();
  });
 
  layoutSelect.addEventListener('change', () => {
    currentLayout = layoutSelect.value;
    buildKeyboardVisual();
    resetState();
  });

  function clampWordCount(rawValue) {
    const parsed = parseInt(rawValue, 10);
    if (Number.isNaN(parsed)) return wordCount;
    return Math.min(MAX_WORD_COUNT, Math.max(MIN_WORD_COUNT, parsed));
  }

  wordCountInput.addEventListener('change', () => {
    const clamped = clampWordCount(wordCountInput.value);
    wordCountInput.value = clamped;
    wordCount = clamped;
    resetState();
  });
 
  // ---------------------------------------------------
  // events
  // ---------------------------------------------------
  passageViewport.addEventListener('click', () => hiddenInput.focus());
  stageEl.addEventListener('click', (e) => {
    // don't steal focus from interactive controls (the words/settings
    // panels live inside .stage) — that would close a native <select>
    // the instant it's clicked, before the user can pick an option
    if (e.target.closest('button, select, label, input')) return;
    hiddenInput.focus();
  });
 
  hiddenInput.addEventListener('input', handleInput);
  hiddenInput.addEventListener('paste', (e) => e.preventDefault());
  hiddenInput.addEventListener('keydown', (e) => {
    if (e.key === 'Backspace' && hiddenInput.value.length <= minAllowedLength) {
      e.preventDefault();
    }
  });
 
  restartBtn.addEventListener('click', () => {
    resetState();
  });
 
  restartFromResults.addEventListener('click', () => {
    resetState();
  });
 
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (isPanelOpen(settingsPanel)) {
        closePanel(settingsPanel, settingsBtn);
      } else if (isPanelOpen(wordsPanel)) {
        closePanel(wordsPanel, wordsBtn);
      } else {
        resetState();
      }
    }
  });
 
  window.addEventListener('resize', () => {
    measureLineHeight();
    lineRanges = computeLineRanges();
    positionCaret(hiddenInput.value.length, { instant: true });
  });
 
  // ---------------------------------------------------
  // init
  // ---------------------------------------------------
  buildKeyboardVisual();
  resetState();
 
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(updateFavicon);
  } else {
    updateFavicon();
  }
})();
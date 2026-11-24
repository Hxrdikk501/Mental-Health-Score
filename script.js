/* ==========================================================
   YouOkay? (YoKi) – script.js
   Config · Interactions · Form + API · Results · Content
   ========================================================== */
'use strict';

/* ---------- CONFIG (edit these) ---------- */
const API_URL = 'https://mental-health-score-tdd5.onrender.com/predict'; // FastAPI backend endpoint (POST JSON, returns { predicted_mental_health_score: float })
const TIMEOUT_MS = 15000;

/* Score scale. Leave null until you know your model's target range; the gauge
   then runs a decorative sweep instead of a proportional fill. Example: { min: 0, max: 100 } */
const SCORE_RANGE = { min: null, max: null };

/* Thresholds that trigger recommendations. These are suggestion triggers only, not population benchmarks. */
const REC = { usageHours: 4, unlocks: 50, sleepAdult: 7, sleepTeen: 8, activityHours: 0.5, studyHours: 2 };

const COUNTRIES = ['India', 'USA', 'Canada', 'Australia', 'UK', 'Germany', 'Mexico', 'Turkey', 'France', 'Brazil', 'China', 'Japan', 'South Korea', 'Russia', 'Italy', 'Spain', 'Netherlands', 'Pakistan', 'Bangladesh', 'Nigeria', 'South Africa', 'Egypt', 'Indonesia', 'Philippines', 'Vietnam', 'Thailand', 'Singapore', 'Sweden', 'Norway', 'Ireland', 'Argentina', 'Colombia', 'Saudi Arabia', 'UAE'];

/* Form fields: name = exact backend key. int: min<=n<=max. float: min<n<=max (or min<=n with allowZero). */
const FIELDS = [
  { name: 'age', type: 'int', min: 11, max: 100, step: 0 },
  { name: 'gender', type: 'select', step: 0 },
  { name: 'country', type: 'text', step: 0 },
  { name: 'academic_level', type: 'select', step: 0 },
  { name: 'most_used_platform', type: 'select', step: 1 },
  { name: 'purpose_of_use', type: 'select', step: 1 },
  { name: 'avg_daily_usage_hours', type: 'float', min: 0, max: 24, step: 1 },
  { name: 'daily_unlocks', type: 'int', min: 1, max: 100, step: 1 },
  { name: 'study_hours', type: 'float', min: 0, max: 24, step: 2 },
  { name: 'physical_activity_hours', type: 'float', min: 0, max: 24, step: 2, allowZero: true },
  { name: 'sleep_hours_per_night', type: 'float', min: 0, max: 24, step: 2 },
  { name: 'stress_level', type: 'select', step: 2 }
];

/* Real articles from the named organisations (links verified at build time). */
const ARTICLES = [
  { topic: 'Social media', title: 'Health advisory on social media use in adolescence', desc: 'An expert panel reviews the evidence on how social media can help and harm, and sets out ten recommendations, including protecting sleep and physical activity.', org: 'American Psychological Association', type: 'Health advisory', url: 'https://www.apa.org/topics/social-media-internet/health-advisory-adolescent-social-media-use', c: ['#6d5ce0', '#3e4fc4'] },
  { topic: 'Sleep', title: 'Sleep and mental wellness', desc: 'How poor sleep and mental health reinforce each other, how much sleep different ages need, and five tips for better sleep.', org: 'Harvard Health Publishing', type: 'Health guide', url: 'https://www.health.harvard.edu/mindscape/for-parents-and-caregivers/mental-wellness-basics/sleep', c: ['#3b4fb8', '#7f9cf5'] },
  { topic: 'Academic stress', title: "I'm So Stressed Out! Fact Sheet", desc: 'Written for teens and young adults: how stress differs from anxiety, and ways to cope when you feel overwhelmed.', org: 'National Institute of Mental Health', type: 'Fact sheet', url: 'https://www.nimh.nih.gov/health/publications/so-stressed-out-fact-sheet', c: ['#8b7cf6', '#5a6bd8'] },
  { topic: 'Digital habits', title: 'Social Media and Youth Mental Health: Surgeon General’s Advisory', desc: 'Summarises current evidence and suggests practical steps, such as setting healthy technology boundaries.', org: 'U.S. Surgeon General (HHS)', type: 'Advisory', url: 'https://www.hhs.gov/surgeongeneral/reports-and-publications/youth-mental-health/social-media/index.html', c: ['#4d5fd0', '#a99bff'] },
  { topic: 'Movement', title: 'Exercise for depression', desc: 'How being active supports mental wellbeing, and simple ways to start.', org: 'NHS', type: 'Self-help guide', url: 'https://www.nhs.uk/conditions/stress-anxiety-depression/exercise-for-depression/', c: ['#5f6fe0', '#8fb0ff'] },
  { topic: 'Everyday stress', title: 'Tackling your worries', desc: 'A practical self-help technique from NHS Every Mind Matters for dealing with everyday worries and anxiety.', org: 'NHS Every Mind Matters', type: 'Self-help technique', url: 'https://www.nhs.uk/every-mind-matters/mental-wellbeing-tips/self-help-cbt-techniques/tackling-your-worries/', c: ['#7a6cf0', '#4b5ec9'] }
];

const FLOW = [
  'You enter twelve answers about yourself, your social media use, and your daily routine.',
  'The page validates your answers and structures them as JSON with exact field names and types.',
  'Your FastAPI backend receives the request and checks it against its Pydantic model.',
  'The trained model, loaded with Joblib, uses a Pandas DataFrame of your answers to generate a predicted score.',
  'The page shows the returned score, and builds suggestions and charts from your own inputs.'
];

const TIPS = [
  ['Screen time', 'Move social apps off your home screen. A little friction makes mindless opening less automatic.'],
  ['Digital detox', 'Pick one meal a day to eat without your phone on the table.'],
  ['Sleep hygiene', 'Start winding down 30 to 60 minutes before bed, including switching off screens.'],
  ['Sleep hygiene', 'Keep a steady bedtime and wake time, even at weekends.'],
  ['Productivity', 'Study in focused blocks with your phone in another room, then take a real break.'],
  ['Stress', 'When stress builds, pause for a few slow breaths before your next task.'],
  ['Screen time', 'Turn off non-essential notifications so you choose when to check, not the app.'],
  ['Digital detox', 'Try a phone-free first half hour after waking.']
];

const HABITS = ['Took breaks from social media', 'Maintained a consistent sleep schedule', 'Spent time being physically active', 'Completed focused study sessions', 'Took time away from screens'];

const $ = (id) => document.getElementById(id);
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const icons = () => window.lucide && lucide.createIcons();

/* ---------- Page chrome ---------- */
function initChrome() {
  $('year').textContent = new Date().getFullYear();
  $('countryList').innerHTML = COUNTRIES.map((c) => `<option value="${c}">`).join('');

  // Mobile nav
  const toggle = $('navToggle'), links = $('navLinks');
  toggle.addEventListener('click', () => toggle.setAttribute('aria-expanded', links.classList.toggle('open')));
  links.addEventListener('click', (e) => { if (e.target.closest('a')) { links.classList.remove('open'); toggle.setAttribute('aria-expanded', 'false'); } });

  // Scroll reveal + nav underline for the section in view
  const io = new IntersectionObserver((entries) => entries.forEach((en) => {
    if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
  }), { threshold: 0.12 });
  document.querySelectorAll('.reveal').forEach((el) => io.observe(el));

  const spy = new IntersectionObserver((entries) => entries.forEach((en) => {
    if (en.isIntersecting) links.querySelectorAll('a').forEach((a) => a.classList.toggle('active', a.getAttribute('href') === '#' + en.target.id));
  }), { rootMargin: '-45% 0px -50% 0px' });
  document.querySelectorAll('main section[id]').forEach((s) => spy.observe(s));

  // Animated counters (hero facts)
  document.querySelectorAll('[data-count]').forEach((el) => {
    const target = +el.dataset.count;
    if (reduceMotion) { el.textContent = target; return; }
    const t0 = performance.now();
    (function tick(now) {
      const p = Math.min((now - t0) / 1400, 1);
      el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(tick);
    })(t0);
  });

  if (reduceMotion) return;

  // Floating particles
  const wrap = $('particles');
  for (let i = 0; i < 16; i++) {
    const p = document.createElement('i'), s = 3 + Math.random() * 6;
    p.style.cssText = `left:${Math.random() * 100}%;width:${s}px;height:${s}px;animation-duration:${28 + Math.random() * 34}s;animation-delay:${-Math.random() * 50}s`;
    wrap.appendChild(p);
  }

  // Subtle parallax on hero art
  const art = document.querySelector('.hero-art');
  addEventListener('scroll', () => { if (scrollY < innerHeight) art.style.transform = `translateY(${scrollY * 0.08}px)`; }, { passive: true });
}

/* ---------- Ambient background + custom cursor ---------- */
function initAmbient() {
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return; // touch/mobile: keep the normal cursor
  const layer = $('ambient');
  const dot = document.createElement('div');
  dot.className = 'cursor-dot';
  dot.setAttribute('aria-hidden', 'true');
  document.body.appendChild(dot);
  document.documentElement.classList.add('has-cursor');

  let x = innerWidth / 2, y = innerHeight * 0.4, tx = x, ty = y, last = 0, running = false, seen = false;

  function frame(now) {
    const dt = Math.min(now - last || 16, 50); last = now;
    if (reduceMotion) { x = tx; y = ty; }
    else { const k = 1 - Math.exp(-dt / 150); x += (tx - x) * k; y += (ty - y) * k; } // glow eases, dot does not
    dot.style.transform = `translate3d(${tx}px, ${ty}px, 0) translate(-50%, -50%)`;
    layer.style.setProperty('--mx', x.toFixed(1) + 'px');
    layer.style.setProperty('--my', y.toFixed(1) + 'px');
    if (Math.abs(tx - x) > 0.1 || Math.abs(ty - y) > 0.1) requestAnimationFrame(frame);
    else running = false; // settled: stop looping until the mouse moves again
  }
  const kick = () => { if (!running) { running = true; last = performance.now(); requestAnimationFrame(frame); } };

  addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    tx = e.clientX; ty = e.clientY;
    if (!seen) { seen = true; x = tx; y = ty; layer.classList.add('live'); dot.classList.add('on'); } // first move: appear in place
    kick();
  }, { passive: true });

  // Hover states: bigger over buttons/links, smaller over fields, unchanged over cards
  const LINK = 'a, button, [role="button"], summary, label, .step-btn';
  const TEXT = 'input:not([type="checkbox"]):not([type="radio"]), textarea, select';
  addEventListener('pointerover', (e) => {
    if (e.pointerType === 'touch' || !(e.target instanceof Element)) return;
    const text = !!e.target.closest(TEXT);
    dot.classList.toggle('is-text', text);
    dot.classList.toggle('is-link', !text && !!e.target.closest(LINK));
  }, { passive: true });

  // Hide when the pointer leaves the window
  document.documentElement.addEventListener('mouseleave', () => dot.classList.remove('on'));
  document.documentElement.addEventListener('mouseenter', () => { if (seen) dot.classList.add('on'); });

  // Keep the pointer position inside the viewport after a resize
  addEventListener('resize', () => { tx = Math.min(tx, innerWidth); ty = Math.min(ty, innerHeight); kick(); }, { passive: true });
}

/* ---------- How it works ---------- */
function initFlow() {
  const text = $('flowText'), btns = [...document.querySelectorAll('.step-btn')];
  const show = (i) => { btns.forEach((b, n) => b.classList.toggle('active', n === i)); text.textContent = `${i + 1}. ${FLOW[i]}`; };
  btns.forEach((b) => b.addEventListener('click', () => show(+b.dataset.i)));
  show(0);
}

/* ---------- Knowledge hub ---------- */
function initMagazine() {
  const pat = '<svg class="pat" viewBox="0 0 200 100" preserveAspectRatio="none"><circle cx="30" cy="20" r="60" fill="none" stroke="#fff" stroke-opacity=".5"/><circle cx="170" cy="90" r="70" fill="none" stroke="#fff" stroke-opacity=".4"/><circle cx="110" cy="40" r="30" fill="none" stroke="#fff" stroke-opacity=".5"/></svg>';
  $('mag').innerHTML = ARTICLES.map((a, i) => `
    <article class="art reveal${i === 0 ? ' feat' : ''}">
      <div class="cover" style="background:linear-gradient(135deg,${a.c[0]},${a.c[1]})">${pat}<span class="tag">${a.topic}</span></div>
      <div class="body">
        <p class="meta"><b>${a.org}</b> &middot; ${a.type}</p>
        <h3>${a.title}</h3><p>${a.desc}</p>
        <a class="read" href="${a.url}" target="_blank" rel="noopener noreferrer">Read Article <i data-lucide="arrow-up-right"></i></a>
      </div>
    </article>`).join('');
  document.querySelectorAll('#mag .reveal').forEach((el) => { requestAnimationFrame(() => el.classList.add('in')); });
}

/* ---------- Tips + habit checklist ---------- */
function initTools() {
  let t = Math.floor(Date.now() / 864e5) % TIPS.length; // tip changes daily
  const showTip = () => { $('tipText').textContent = TIPS[t][1]; $('tipTopic').textContent = TIPS[t][0]; };
  $('tipNext').addEventListener('click', () => { t = (t + 1) % TIPS.length; showTip(); });
  showTip();
  if (!reduceMotion) setInterval(() => { t = (t + 1) % TIPS.length; showTip(); }, 12000);

  const key = 'yoki-habits-' + new Date().toISOString().slice(0, 10);
  let saved = [];
  try { saved = JSON.parse(localStorage.getItem(key)) || []; } catch (_) { /* storage unavailable */ }
  $('checks').innerHTML = HABITS.map((h, i) => `<li><label><input type="checkbox" data-i="${i}" ${saved.includes(i) ? 'checked' : ''}><span>${h}</span></label></li>`).join('');
  const update = () => {
    const on = [...document.querySelectorAll('#checks input')].filter((c) => c.checked).map((c) => +c.dataset.i);
    $('habitCount').textContent = `${on.length} of ${HABITS.length} today`;
    try { localStorage.setItem(key, JSON.stringify(on)); } catch (_) { /* ignore */ }
  };
  $('checks').addEventListener('change', update);
  update();
}

/* ---------- Form: validation ---------- */
const form = $('predictForm'), steps = [...form.querySelectorAll('.step')];
let current = 0, isSubmitting = false;
const wrapOf = (f) => form.querySelector(`[data-field="${f.name}"]`);

function validateField(f) {
  const raw = String(form.elements[f.name].value || '').trim();
  if (raw === '') return f.type === 'select' ? 'Please choose an option.' : 'This field is required.';
  if (f.type === 'select') return ''; // dropdowns only need a value
  if (f.type === 'text') return raw.length < 2 ? 'Enter a valid country name.' : '';
  const n = Number(raw);
  if (!Number.isFinite(n)) return 'Enter a valid number.';
  if (f.type === 'int') {
    if (!Number.isInteger(n)) return 'Enter a whole number.';
    if (n < f.min || n > f.max) return `Enter a value from ${f.min} to ${f.max}.`;
  } else if (f.allowZero) {
    if (n < 0 || n > f.max) return `Enter a value from 0 to ${f.max}.`;
  } else if (n <= f.min || n > f.max) return `Enter a value above ${f.min} and up to ${f.max}.`;
  return '';
}
function showError(f, msg) { const w = wrapOf(f); w.classList.toggle('invalid', !!msg); w.querySelector('.err').textContent = msg; }
function validateStep(s) {
  let first = null;
  FIELDS.filter((f) => f.step === s).forEach((f) => { const m = validateField(f); showError(f, m); if (m && !first) first = f; });
  if (first) form.elements[first.name].focus();
  return !first;
}
['input', 'change'].forEach((evt) => form.addEventListener(evt, (e) => {
  const f = FIELDS.find((x) => x.name === e.target.name);
  if (f && wrapOf(f).classList.contains('invalid')) showError(f, validateField(f));
}));

function goTo(i) {
  current = i;
  steps.forEach((s, n) => s.classList.toggle('active', n === i));
  $('barFill').style.width = `${((i + 1) / steps.length) * 100}%`;
  $('stepCount').textContent = `Step ${i + 1} of ${steps.length}`;
  $('prevBtn').hidden = i === 0; $('nextBtn').hidden = i === steps.length - 1; $('submitBtn').hidden = i !== steps.length - 1;
  $('formAlert').hidden = true;
}
$('nextBtn').addEventListener('click', () => { if (validateStep(current)) goTo(current + 1); });
$('prevBtn').addEventListener('click', () => goTo(current - 1));
form.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.tagName !== 'BUTTON' && current < steps.length - 1) { e.preventDefault(); $('nextBtn').click(); } });

/* ---------- API ---------- */
function buildPayload() {
  const d = {};
  FIELDS.forEach((f) => { const v = form.elements[f.name].value.trim(); d[f.name] = f.type === 'int' ? parseInt(v, 10) : f.type === 'float' ? parseFloat(v) : v; });
  return d;
}
async function requestPrediction(payload) {
  const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: ctrl.signal });
    if (!res.ok) {
      let detail = '';
      try { const b = await res.json(); detail = Array.isArray(b.detail) ? b.detail.map((d) => `${(d.loc || []).slice(1).join('.')}: ${d.msg}`).join('; ') : (b.detail || ''); } catch (_) { /* non-JSON */ }
      throw new Error(res.status === 422 ? `The server rejected some values. ${detail}` : `The server returned an error (${res.status}). ${detail}`);
    }
    const score = (await res.json()).predicted_mental_health_score;
    if (typeof score !== 'number' || !Number.isFinite(score)) throw new Error('The server sent an unexpected response.');
    return score;
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('The request timed out. Check that the backend is running and try again.');
    if (err instanceof TypeError) throw new Error('Could not reach the backend at 127.0.0.1:8000. Make sure the FastAPI server is running.');
    throw err;
  } finally { clearTimeout(timer); }
}

/* ---------- Results ---------- */
const views = { form: $('formView'), loading: $('loadingView'), result: $('resultView') };
function show(name) { Object.entries(views).forEach(([k, el]) => { el.hidden = k !== name; }); if (name !== 'form') $('assessCard').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' }); }

/* Recommendations from the user's own inputs, sorted by how far past the trigger each one is. */
function buildRecs(d) {
  const r = [];
  const sleepGoal = d.age < 18 ? REC.sleepTeen : REC.sleepAdult;
  if (d.avg_daily_usage_hours >= REC.usageHours) r.push({ w: d.avg_daily_usage_hours / REC.usageHours, icon: 'smartphone', title: 'Make screen time more intentional', text: `You reported about ${d.avg_daily_usage_hours} hours a day on social media. Small limits can free up time for things you enjoy.`, act: 'Set a daily app timer and choose one slot each day that is phone-free.' });
  if (d.daily_unlocks >= REC.unlocks) r.push({ w: d.daily_unlocks / REC.unlocks, icon: 'unlock', title: 'Ease habitual phone checking', text: `${d.daily_unlocks} unlocks a day suggests a lot of quick check-ins.`, act: 'Turn off non-essential notifications and keep your phone out of reach while studying.' });
  if (d.sleep_hours_per_night < sleepGoal) r.push({ w: sleepGoal / d.sleep_hours_per_night, icon: 'moon', title: 'Protect your sleep', text: `You reported ${d.sleep_hours_per_night} hours a night. Harvard Health notes ${d.age < 18 ? 'teens generally need 8 to 10 hours' : 'adults generally need at least 7 hours'}.`, act: 'Pick a fixed bedtime and switch screens off 30 to 60 minutes before it.' });
  if (d.physical_activity_hours < REC.activityHours) r.push({ w: 1.5, icon: 'footprints', title: 'Add a little movement', text: 'Being active supports mood and sleep, and it does not need to be intense.', act: 'Try a 10-minute walk after class or a meal, and build up from there.' });
  if (d.stress_level === 'High' || d.stress_level === 'Very High') r.push({ w: d.stress_level === 'Very High' ? 2.5 : 2, icon: 'wind', title: 'Make room for stress relief', text: `Feeling ${d.stress_level.toLowerCase()} stress is worth taking seriously. You are not alone in this.`, act: 'Try a few slow breaths, a short walk, or talking to someone you trust. Consider a counsellor if it persists.' });
  if (d.study_hours < REC.studyHours) r.push({ w: 1.2, icon: 'book-open', title: 'Build a balanced study routine', text: 'Short, regular study blocks can feel lighter than occasional long ones.', act: 'Start with two 25-minute focus blocks and a break between them.' });
  r.sort((a, b) => b.w - a.w);
  if (!r.length) r.push({ icon: 'sparkles', title: 'Your routine looks balanced', text: 'None of your answers crossed the thresholds used for suggestions.', act: 'Keep your routines steady, and use the daily checklist to stay consistent.' });
  return r.slice(0, 4);
}

function renderResult(score, d) {
  // Gauge + counter
  const fill = $('gaugeFill'), out = $('scoreValue');
  const { min, max } = SCORE_RANGE;
  const ratio = (min != null && max != null && max > min) ? Math.min(Math.max((score - min) / (max - min), 0), 1) : 1; // 1 = decorative sweep
  fill.style.transition = 'none'; fill.style.strokeDashoffset = 553; void fill.getBoundingClientRect();
  fill.style.transition = reduceMotion ? 'none' : 'stroke-dashoffset 1.6s cubic-bezier(.4,0,.2,1)';
  fill.style.strokeDashoffset = 553 * (1 - ratio);
  const t0 = performance.now();
  (function tick(now) {
    const p = reduceMotion ? 1 : Math.min((now - t0) / 1400, 1);
    out.textContent = (score * (1 - Math.pow(1 - p, 3))).toFixed(2);
    if (p < 1) requestAnimationFrame(tick); else out.textContent = score.toFixed(2);
  })(t0);



  // Next steps
  $('recs').innerHTML = buildRecs(d).map((r) => `<article class="rec"><div class="ico"><i data-lucide="${r.icon}"></i></div><h4>${r.title}</h4><p>${r.text}</p><p class="act">${r.act}</p></article>`).join('');

  // Lifestyle bars (hours out of 24)
  const rows = [['Screen time', d.avg_daily_usage_hours], ['Sleep', d.sleep_hours_per_night], ['Physical activity', d.physical_activity_hours], ['Study', d.study_hours]];
  $('bars').innerHTML = rows.map(([l, v]) => `<div class="brow"><span>${l}</span><div class="btrack"><i data-w="${(v / 24) * 100}"></i></div><b>${v} h</b></div>`).join('');
  icons();
  requestAnimationFrame(() => requestAnimationFrame(() => document.querySelectorAll('#bars i').forEach((el) => { el.style.width = el.dataset.w + '%'; })));
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (isSubmitting) return;
  for (let s = 0; s < steps.length; s++) if (!validateStep(s)) { goTo(s); validateStep(s); return; }
  isSubmitting = true; $('submitBtn').disabled = true; show('loading');
  const started = performance.now(), payload = buildPayload();
  try {
    const score = await requestPrediction(payload);
    await new Promise((r) => setTimeout(r, Math.max(0, 800 - (performance.now() - started))));
    show('result'); renderResult(score, payload);
  } catch (err) {
    show('form'); const a = $('formAlert'); a.textContent = err.message; a.hidden = false;
  } finally { isSubmitting = false; $('submitBtn').disabled = false; }
});

$('resetBtn').addEventListener('click', () => {
  form.reset(); FIELDS.forEach((f) => showError(f, '')); goTo(0); show('form');
});

/* ---------- Init ---------- */
window.addEventListener('DOMContentLoaded', () => {
  initChrome(); initAmbient(); initFlow(); initMagazine(); initTools(); goTo(0);
  icons();
  window.addEventListener('load', icons); // in case the icon library finishes loading late
});
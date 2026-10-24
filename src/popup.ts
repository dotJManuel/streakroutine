import { DN, MN, XP_LEVEL, XP_PER } from './shared/habits.config';
import {
  Days,
  RachaConfig,
  addDays,
  computeStreaks,
  countDone,
  dateKey,
  doneAtLabel,
  isRestDay,
  parseKey,
} from './shared/streaks';
import type { Habits } from './shared/types';
import { renderAdmin } from './admin';
import { Loaded, hasSession, loadAll, saveDay, signIn, signOut } from './data';
import { esc } from './util';
import './popup.css';

const app = document.getElementById('app') as HTMLElement;
const toastEl = document.getElementById('toast') as HTMLElement;

let data: Loaded | null = null;
let days: Days = {};
let today = new Date();
let sel = dateKey(today);
let toastTimer: ReturnType<typeof setTimeout> | undefined;
const saving = new Map<string, Promise<void>>();

const keys = () => (data ? data.habits.map((h) => h.k) : []);
const done = (k: string) => countDone(days, k, keys());
/** Solo se puede marcar o desmarcar el día de hoy; los anteriores se consultan. */
const canEdit = () => sel === dateKey(today);
const cfg = (): RachaConfig => ({
  habitKeys: keys(),
  goal: data!.goal,
  freezeMin: data!.freezeMin,
  activeDays: data!.activeDays,
});

function toast(msg: string) {
  toastEl.textContent = msg;
  toastEl.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toastEl.hidden = true), 2200);
}

// ---------- Vistas ----------

function renderLogin(error = '') {
  app.innerHTML = `
    <main class="login">
      <h1>StreakRoutine</h1>
      <p class="sub">Inicia sesión para ver tu racha</p>
      <form id="login">
        <label>Correo<input type="email" name="email" autocomplete="email" required></label>
        <label>Contraseña<input type="password" name="password" autocomplete="current-password" required></label>
        ${error ? `<p class="msg error" role="alert">${esc(error)}</p>` : ''}
        <button type="submit" class="primary">Entrar</button>
      </form>
      <p class="hint">¿No tienes cuenta? Créala en la app web de JustMe.</p>
    </main>`;
}

function renderMessage(text: string, retry = true) {
  app.innerHTML = `
    <main class="login">
      <h1>StreakRoutine</h1>
      <p class="sub">${esc(text)}</p>
      ${retry ? '<button type="button" class="primary" data-act="reload">Reintentar</button>' : ''}
      <button type="button" class="link" data-act="logout">Cerrar sesión</button>
    </main>`;
}

function renderMain() {
  if (!data) return;
  const c = cfg();
  const info = computeStreaks(days, today, c);
  const todayKey = dateKey(today);
  const xp = Object.keys(days).reduce((s, k) => s + done(k) * XP_PER, 0);
  const level = Math.floor(xp / XP_LEVEL) + 1;
  const cold = done(todayKey) < c.goal;
  const iced = cold && info.recovering;
  const active = data.habits.filter((h) => h.active);

  const week = [6, 5, 4, 3, 2, 1, 0]
    .map((i) => {
      const d = addDays(today, -i);
      const k = dateKey(d);
      const n = done(k);
      const frozen = n < c.goal && info.frozen.has(k);
      const state = n >= c.goal ? 'ok' : frozen ? 'frozen' : n > 0 ? 'part' : isRestDay(d, c.activeDays) ? 'rest' : '';
      const text = n >= c.goal ? '✓' : frozen ? '❄' : String(d.getDate());
      const aria = `${DN[d.getDay()]} ${d.getDate()}: ${n} misiones${frozen ? ', día congelado' : ''}`;
      return `<button type="button" class="dayb${k === sel ? ' sel' : ''}" data-act="sel" data-k="${k}"
        aria-pressed="${k === sel}" aria-label="${esc(aria)}">
        <span class="dn">${i === 0 ? 'hoy' : DN[d.getDay()]}</span><span class="dot ${state}">${text}</span></button>`;
    })
    .join('');

  const selDone = done(sel);
  const selHabits: Habits = days[sel] ?? {};
  const title = sel === todayKey ? 'Misiones de hoy' : `${DN[parseKey(sel).getDay()]} ${parseKey(sel).getDate()} ${MN[parseKey(sel).getMonth()]}`;
  const goalText =
    selDone >= c.goal ? `${selDone} / ${active.length} · racha asegurada` : `${selDone} / ${c.goal} para mantener la racha`;
  const pct = Math.min(100, (selDone / c.goal) * 100);

  const list = active
    .map((h) => {
      const on = !!selHabits[h.k];
      const at = doneAtLabel(selHabits[h.k], sel);
      return `<button type="button" class="habit${on ? ' on' : ''}" data-act="toggle" data-k="${esc(h.k)}" aria-pressed="${on}"${canEdit() ? '' : ' disabled'}>
        <span class="chk"></span>
        <span class="txt"><span class="name">${esc(h.name)}</span><span class="when">${esc(h.when)}</span></span>
        ${at ? `<span class="at" title="Hora en que se completó">✓ ${esc(at)}</span>` : ''}
        <span class="xp">+${XP_PER} XP</span></button>`;
    })
    .join('');

  const freezeMsg = info.recovering
    ? `❄ Racha congelada: cumple ${c.goal} misiones para recuperarla`
    : info.freezeReady
      ? '❄ Tienes una congelación lista por si falla un día'
      : '';

  app.innerHTML = `
    <div class="wrap">
      <div class="top">
        <h1>Mi racha</h1>
        <div class="stats">
          <span class="stat" title="Puntos de experiencia">⚡ <b>${xp}</b> XP</span>
          <span class="stat" title="Nivel">Nv <b>${level}</b></span>
          <button type="button" class="stat out" data-act="admin" title="Configuración" aria-label="Configuración">⚙</button>
          <button type="button" class="stat out" data-act="logout">Salir</button>
        </div>
      </div>
      <section class="hero" aria-live="polite">
        <svg class="flame${cold ? ' cold' : ''}${iced ? ' iced' : ''}" viewBox="0 0 84 96" aria-hidden="true">
          <defs><linearGradient id="fg" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" style="stop-color:var(--flame)"/><stop offset="1" style="stop-color:var(--flame-2)"/></linearGradient></defs>
          <path fill="url(#fg)" d="M42 4c4 14 22 24 26 44 4 22-10 44-26 44S12 74 16 52c2-12 10-18 12-28 6 6 6 14 6 18 6-8 10-22 8-38z"/>
          <path fill="#FFF3D6" opacity=".85" d="M42 52c4 8 12 12 12 22 0 8-6 14-12 14s-12-6-12-14c0-6 4-10 6-14 2 4 4 6 4 8 2-4 4-10 2-16z"/>
        </svg>
        <div>
          <div class="big">${info.cur}</div>
          <div class="sub">${info.cur === 1 ? 'día de racha' : 'días de racha'}</div>
          <div class="best">Mejor racha: ${info.best} ${info.best === 1 ? 'día' : 'días'}</div>
          ${freezeMsg ? `<div class="freeze">${freezeMsg}</div>` : ''}
        </div>
      </section>
      <div class="week" role="group" aria-label="Últimos 7 días">${week}</div>
      <section class="goal">
        <div class="goalrow"><h2>${esc(title)}</h2><span>${goalText}</span></div>
        <div class="bar"><i style="width:${pct}%"></i></div>
      </section>
      ${canEdit() ? '' : '<p class="readonly">Día anterior: solo lectura. Únicamente se puede marcar el día de hoy.</p>'}
      <div class="list">${list}</div>
      <p class="note">Marca al menos ${c.goal} misiones al día para sumar a tu racha. Los días de descanso no la rompen.</p>
    </div>`;

  updateBadge(info.cur);
}

/** El número de la racha en el ícono; se actualiza cada vez que abres el popup. */
function updateBadge(cur: number) {
  try {
    void chrome.action.setBadgeText({ text: cur > 0 ? String(cur) : '' });
    void chrome.action.setBadgeBackgroundColor({ color: '#FF7A1A' });
  } catch {
    /* fuera de la extensión (p. ej. al probar la página sola) */
  }
}

// ---------- Acciones ----------

function toggle(hk: string) {
  if (!data || !canEdit()) return;
  const k = sel;
  const before = done(k);
  const h: Habits = { ...(days[k] ?? {}) };
  // Marcar guarda la hora exacta del check; desmarcar la borra.
  if (h[hk]) delete h[hk];
  else h[hk] = new Date().toISOString();
  days = { ...days, [k]: h };
  if (before < data.goal && done(k) >= data.goal) {
    toast(k === dateKey(today) ? '¡Racha asegurada por hoy! 🔥' : 'Día completado ✓');
  }
  renderMain();
  // Guarda en orden por día, para que dos toques seguidos no se pisen.
  const prev = saving.get(k) ?? Promise.resolve();
  saving.set(
    k,
    prev.then(() => saveDay(k, h)).catch(() => toast('No se pudo guardar. Intenta de nuevo.')),
  );
}

async function start() {
  today = new Date();
  sel = dateKey(today);
  app.innerHTML = '<p class="loading">Cargando…</p>';
  try {
    if (!(await hasSession())) return renderLogin();
    data = await loadAll();
    days = data.days;
    renderMain();
  } catch {
    renderMessage('No se pudieron cargar tus datos.');
  }
}

app.addEventListener('click', async (e) => {
  const el = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
  if (!el) return;
  switch (el.dataset['act']) {
    case 'sel':
      sel = el.dataset['k']!;
      return renderMain();
    case 'toggle':
      return toggle(el.dataset['k']!);
    case 'admin':
      return renderAdmin({ app, data: data!, toast, back: renderMain });
    case 'reload':
      return void start();
    case 'logout':
      await signOut();
      data = null;
      days = {};
      try {
        void chrome.action.setBadgeText({ text: '' });
      } catch {
        /* sin chrome.action */
      }
      return renderLogin();
  }
});

app.addEventListener('submit', async (e) => {
  const form = e.target as HTMLFormElement;
  if (form.id !== 'login') return;
  e.preventDefault();
  const f = new FormData(form);
  const button = form.querySelector('button[type="submit"]') as HTMLButtonElement;
  button.disabled = true;
  const error = await signIn(String(f.get('email')).trim(), String(f.get('password')));
  if (error) return renderLogin(error);
  void start();
});

void start();

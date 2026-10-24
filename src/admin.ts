import { HabitItem, Loaded, addHabit, saveOrder, saveSettings, updateHabit } from './data';
import { DN } from './shared/habits.config';
import { esc } from './util';

export interface AdminHost {
  app: HTMLElement;
  data: Loaded;
  toast(msg: string): void;
  back(): void;
}

/** Lunes primero; el valor es el número de día de JavaScript (0 = domingo). */
const WEEK = [1, 2, 3, 4, 5, 6, 0];

interface Draft {
  goal: string;
  freeze: string;
  days: number[];
}

/** Pantalla de configuración: meta, congelación, días obligatorios y misiones. */
export function renderAdmin(host: AdminHost) {
  const draft: Draft = {
    goal: String(host.data.goal),
    freeze: String(host.data.freezeMin),
    days: [...host.data.activeDays],
  };
  paint(host, draft);
}

function paint(host: AdminHost, draft: Draft) {
  const { app, data } = host;
  const scroll = app.querySelector('.habits')?.scrollTop ?? 0;

  const chips = WEEK.map(
    (n) => `<button type="button" class="chip${draft.days.includes(n) ? ' on' : ''}" data-admin="day" data-n="${n}"
      aria-pressed="${draft.days.includes(n)}">${DN[n]}</button>`,
  ).join('');

  const rows = data.habits
    .map(
      (h, i) => `<li${h.active ? '' : ' class="off"'}>
        <div class="line">
          <input class="name" aria-label="Nombre" maxlength="80" value="${esc(h.name)}" data-field="name" data-k="${esc(h.k)}">
          <button type="button" class="icon" aria-label="Subir" data-admin="up" data-k="${esc(h.k)}"${i === 0 ? ' disabled' : ''}>▲</button>
          <button type="button" class="icon" aria-label="Bajar" data-admin="down" data-k="${esc(h.k)}"${i === data.habits.length - 1 ? ' disabled' : ''}>▼</button>
          <input type="checkbox" class="toggle" aria-label="${h.active ? 'Activa (desactivar)' : 'Inactiva (activar)'}" title="${h.active ? 'Activa' : 'Inactiva'}" data-field="active" data-k="${esc(h.k)}"${h.active ? ' checked' : ''}>
        </div>
        <input class="when" aria-label="Horario o nota" placeholder="Horario o nota" maxlength="80" value="${esc(h.when)}" data-field="when" data-k="${esc(h.k)}">
      </li>`,
    )
    .join('');

  app.innerHTML = `
    <div class="wrap admin">
      <div class="top">
        <h1>Configuración</h1>
        <button type="button" class="stat out" data-admin="back">← Volver</button>
      </div>

      <section class="card">
        <h2>Racha</h2>
        <label>Misiones por día para mantener la racha
          <input type="number" min="1" max="50" step="1" value="${esc(draft.goal)}" data-field="goal"></label>
        <label>Días cumplidos para ganar una congelación
          <input type="number" min="1" max="365" step="1" value="${esc(draft.freeze)}" data-field="freeze"></label>
        <fieldset>
          <legend>Días obligatorios</legend>
          <div class="chips">${chips}</div>
          <p class="hint">Los días no marcados son de descanso: no rompen la racha.</p>
        </fieldset>
        <p class="hint">Los cambios se aplican también a tu historial, así que tu racha puede variar.</p>
        <button type="button" class="primary" data-admin="save">Guardar ajustes</button>
      </section>

      <section class="card">
        <h2>Misiones</h2>
        <ul class="habits">${rows}</ul>
        <form id="add" class="add">
          <input name="name" placeholder="Nueva misión" maxlength="80" required>
          <input name="when" placeholder="Horario o nota (opcional)" maxlength="80">
          <button type="submit" class="primary">Agregar misión</button>
        </form>
        <p class="hint">Desactivar una misión la oculta, pero sus marcas pasadas siguen contando.</p>
      </section>
    </div>`;

  const list = app.querySelector('.habits');
  if (list) list.scrollTop = scroll;
  bind(host, draft, app.firstElementChild as HTMLElement);
}

function bind(host: AdminHost, draft: Draft, root: HTMLElement) {
  const { data } = host;
  const repaint = () => paint(host, draft);

  /** Ejecuta un guardado y avisa si falla; repinta siempre para reflejar el estado real. */
  const run = async (action: () => Promise<void>, ok = '') => {
    try {
      await action();
      if (ok) host.toast(ok);
    } catch {
      host.toast('No se pudo guardar. Intenta de nuevo.');
    }
    repaint();
  };

  const patch = (k: string, change: Partial<Omit<HabitItem, 'k'>>) =>
    run(async () => {
      await updateHabit(k, change);
      data.habits = data.habits.map((h) => (h.k === k ? { ...h, ...change } : h));
    });

  const move = (k: string, dir: -1 | 1) =>
    run(async () => {
      const list = [...data.habits];
      const i = list.findIndex((h) => h.k === k);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= list.length) return;
      [list[i], list[j]] = [list[j], list[i]];
      await saveOrder(list);
      data.habits = list;
    });

  const save = () => {
    const goal = Number(draft.goal);
    const freeze = Number(draft.freeze);
    if (!Number.isInteger(goal) || goal < 1 || goal > 50) return host.toast('La meta debe ser un número entre 1 y 50');
    if (!Number.isInteger(freeze) || freeze < 1 || freeze > 365) return host.toast('Las congelaciones deben ser entre 1 y 365 días');
    if (!draft.days.length) return host.toast('Elige al menos un día obligatorio');
    const activeCount = data.habits.filter((h) => h.active).length;
    return run(async () => {
      await saveSettings(goal, freeze, draft.days);
      data.goal = goal;
      data.freezeMin = freeze;
      data.activeDays = [...draft.days].sort();
    }, goal > activeCount ? 'Guardado. Ojo: tienes menos misiones activas que la meta' : 'Ajustes guardados');
  };

  root.addEventListener('click', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-admin]');
    if (!el) return;
    const k = el.dataset['k'] ?? '';
    switch (el.dataset['admin']) {
      case 'back':
        return host.back();
      case 'day': {
        const n = Number(el.dataset['n']);
        draft.days = draft.days.includes(n) ? draft.days.filter((x) => x !== n) : [...draft.days, n];
        return repaint();
      }
      case 'save':
        return void save();
      case 'up':
        return void move(k, -1);
      case 'down':
        return void move(k, 1);
    }
  });

  // Los números se leen al guardar; no se repinta para no perder el foco al escribir.
  root.addEventListener('input', (e) => {
    const el = e.target as HTMLInputElement;
    if (el.dataset['field'] === 'goal') draft.goal = el.value;
    if (el.dataset['field'] === 'freeze') draft.freeze = el.value;
  });

  root.addEventListener('change', (e) => {
    const el = e.target as HTMLInputElement;
    const k = el.dataset['k'];
    if (!k) return;
    switch (el.dataset['field']) {
      case 'name': {
        const name = el.value.trim();
        return name ? void patch(k, { name }) : repaint(); // un nombre vacío vuelve al anterior
      }
      case 'when':
        return void patch(k, { when: el.value.trim() });
      case 'active':
        return void patch(k, { active: el.checked });
    }
  });

  root.addEventListener('submit', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const f = new FormData(e.target as HTMLFormElement);
    const name = String(f.get('name')).trim();
    if (!name) return;
    const when = String(f.get('when')).trim();
    void run(async () => {
      const k = await addHabit(name, when, data.habits.length);
      data.habits = [...data.habits, { k, name, when, active: true }];
    }, 'Misión agregada');
  });
}

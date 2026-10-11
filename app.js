// Корень приложения: разбор адреса, состояние демо, оболочка (шапка, сайдбар, профиль, вкладки) и экраны.
// Адреса: #/overview и #/class/<id класса>; параметр ?scenario= выбирает сценарий из data.js,
// ?expanded=1 открывает список сигналов целиком. Перезагрузка страницы возвращает исходные данные.

(function () {
  const { createApp, reactive, computed } = Vue;
  const F = window.Format;

  const OUT_OF_SCOPE_TEXT = F.typo('Экран вне объёма демо');
  const TOAST_MS = 3000;

  // --- Адрес -----------------------------------------------------------------

  function parseRoute() {
    const hash = location.hash.replace(/^#/, '') || '/overview';
    const [path, queryString] = hash.split('?');
    const query = {};
    (queryString || '').split('&').filter(Boolean).forEach((pair) => {
      const [k, v] = pair.split('=');
      query[decodeURIComponent(k)] = decodeURIComponent(v || '');
    });
    const segments = path.split('/').filter(Boolean);
    return {
      screen: segments[0] === 'class' ? 'class' : 'overview',
      classId: segments[0] === 'class' ? segments[1] || null : null,
      scenario: query.scenario && window.DATA.scenarios[query.scenario] ? query.scenario : 'default',
      expanded: query.expanded === '1',
    };
  }

  function buildHref(path, scenario) {
    return '#' + path + (scenario !== 'default' ? '?scenario=' + scenario : '');
  }

  // --- Состояние демо ---------------------------------------------------------

  // Данные сценария поверх базовых: верхний уровень — замена, student — слияние полей,
  // classOverrides и signalOverrides — поля отдельных классов и сигналов.
  function buildState(scenarioKey, expanded) {
    const base = F.typoDeep(window.DATA);
    const scenario = base.scenarios[scenarioKey] || {};
    const data = Object.assign({}, base, scenario, {
      student: Object.assign({}, base.student, scenario.student || {}),
      failures: Object.assign({ activity: 0, noteSave: 0 }, scenario.failures || {}),
    });
    const classes = data.classes
      .filter((c) => data.student.classes.includes(c.id))
      .map((c) => (data.classOverrides && data.classOverrides[c.id] ? Object.assign({}, c, data.classOverrides[c.id]) : c));
    return {
      scenario: scenarioKey,
      isNew: !!data.isNew,
      now: F.parse(data.now),
      offset: 3,
      teacher: data.teacher,
      student: data.student,
      classes,
      lessons: data.lessons,
      signals: data.signals.map((s) => (data.signalOverrides && data.signalOverrides[s.id] ? Object.assign({}, s, data.signalOverrides[s.id]) : s)),
      stats: data.stats,
      activity: data.activity,
      timezones: data.timezones,
      failures: Object.assign({}, data.failures, { noteSave: 0 }),
      // Состояние интерфейса
      signalsExpanded: expanded,
      waitingExpanded: false, // группа «Ждут ответа» раскрыта своей строкой-заголовком, независимо от «Показать ещё»
      reminded: {},   // напоминание отправлено: метка вместо кнопки
      settled: {},    // обработанный сигнал переехал в группу «Ждут ответа»
      collapsing: {}, // строка складывается на месте перед переездом
      removed: {},    // скрыт или причина устранена из «⋯»: на месте строки подпись и «Отменить»
      removedOrder: [], // порядок, в котором убирали: «Отменить последнее» возвращает с конца
      gone: {},       // после ухода со страницы скрытые сигналы больше не показываются
      activityStatus: data.failures.activity > 0 ? 'error' : 'ok',
      note: {
        goal: data.note.goal,
        text: data.note.text,
        savedAt: data.note.savedAt ? F.parse(data.note.savedAt) : null,
        savedReal: false,
        draftGoal: data.note.goal,
        draftText: data.note.text,
        saving: false,
        // В сценарии «ошибки» последнее сохранение не удалось: в подвале «Не удалось сохранить» и «Повторить»
        error: data.failures.noteSave > 0,
      },
      schedule: {
        weekShift: 0, // сдвиг от текущей недели в неделях; начало недели считается в выбранном поясе
        offset: 3,
        fullDay: false, // сетка по часам уроков ученика; true — 8:00–22:00, как в оригинале
      },
    };
  }

  // --- Приложение -------------------------------------------------------------

  const App = {
    data() {
      const route = parseRoute();
      return {
        route,
        state: buildState(route.scenario, route.expanded),
        menuOpen: false,
        notice: '',
        noticeTimer: null,
      };
    },
    computed: {
      classId() {
        const ids = this.state.classes.map((c) => c.id);
        return ids.includes(this.route.classId) ? this.route.classId : ids[0];
      },
      tabs() {
        const s = this.route.scenario;
        return [
          { id: 'overview', label: 'Обзор', href: buildHref('/overview', s), active: this.route.screen === 'overview' },
          { id: 'class', label: 'Класс', href: buildHref('/class/' + this.classId, s), active: this.route.screen === 'class' },
          { id: 'stats', label: 'Статистика', href: '#', outOfScope: true },
        ];
      },
      title() {
        const screen = this.route.screen === 'class' ? 'Класс' : 'Обзор';
        return this.state.student.name + ' · ' + screen + ' · ProgressMe';
      },
    },
    watch: {
      title: { immediate: true, handler(t) { document.title = t; } },
      menuOpen(open) { document.body.classList.toggle('menu-open', open); },
    },
    created() {
      window.addEventListener('hashchange', this.onHashChange);
      window.addEventListener('keydown', this.onKeydown);
    },
    methods: {
      onHashChange() {
        const next = parseRoute();
        if (next.scenario !== this.route.scenario) this.state = buildState(next.scenario, next.expanded);
        this.route = next;
        this.menuOpen = false;
        window.scrollTo(0, 0);
        // Фокус в начало контента, чтобы Tab после перехода шёл по новому экрану с начала
        this.$nextTick(() => { const main = this.$el.querySelector('.app__content'); if (main) main.focus(); });
      },
      onKeydown(e) {
        if (e.key === 'Escape' && this.menuOpen) this.menuOpen = false;
      },
      outOfScope() {
        this.notice = OUT_OF_SCOPE_TEXT;
        clearTimeout(this.noticeTimer);
        this.noticeTimer = setTimeout(() => { this.notice = ''; }, TOAST_MS);
      },
      classHref(c) { return buildHref('/class/' + c.id, this.route.scenario); },
    },
    template: `<div class="app" :class="'app--' + route.screen">
      <pm-header :teacher-initial="state.teacher.initial" :menu-open="menuOpen" @menu="menuOpen = !menuOpen" @out-of-scope="outOfScope"></pm-header>
      <div class="app__body">
        <div class="app__sidebar"><pm-sidebar @out-of-scope="outOfScope"></pm-sidebar></div>
        <transition name="drawer">
          <div v-if="menuOpen" class="drawer">
            <div class="drawer__backdrop" @click="menuOpen = false"></div>
            <div class="drawer__panel"><pm-sidebar @out-of-scope="outOfScope"></pm-sidebar></div>
          </div>
        </transition>
        <main class="app__content" tabindex="-1">
          <pm-link class="app__back" tone="muted" icon-left="arrow-left" href="index.html">Назад</pm-link>
          <pm-profile-card :student="state.student" :classes="state.classes" back-href="index.html" @out-of-scope="outOfScope"></pm-profile-card>
          <pm-tabs :tabs="tabs" @out-of-scope="outOfScope"></pm-tabs>
          <screen-overview v-if="route.screen === 'overview'" :state="state" @out-of-scope="outOfScope"></screen-overview>
          <screen-class v-else :state="state" :class-id="classId" :class-href="classHref" @out-of-scope="outOfScope"></screen-class>
        </main>
      </div>
      <pm-demo-notice :text="notice"></pm-demo-notice>
    </div>`,
  };

  const app = createApp(App);
  window.registerComponents(app);
  app.component('screen-overview', window.ScreenOverview);
  app.component('screen-class', window.ScreenClass);
  app.mount('#app');
})();

// Экран «Класс»: ряд классов как переключатель, шапка выбранного класса и расписание недели.
// Десктоп и планшет — сетка недели (на планшете в событии только время), телефон — список уроков по дням.
// Сетка показывает только часы, в которые у этого класса бывают уроки (D-79): окно считается по урокам
// показанного класса на показанной неделе с запасом по часу с обеих сторон, не короче шести строк.
// У типичного класса слоты постоянные, и сетка от недели к неделе не меняется; на отклонении она
// подстраивается. Уроки других классов ученика не учитываются: их нет на экране, а их пропуск на одной
// из недель сдвигал сетку на час. Пустая неделя берёт окно по всем урокам класса. Ссылка
// «Показать весь день» раскрывает 8:00–22:00.

window.ScreenClass = (function () {
  const F = window.Format;
  const CLOCK_MS = 30000;
  const FULL_DAY = { start: 8, end: 23 };
  const DEFAULT_WINDOW = { start: 9, end: 18 };
  const MIN_ROWS = 6;

  // Кривая --motion-ease (cubic-bezier(0.2, 0, 0, 1)) для прокрутки, идущей вместе с CSS-переходом сетки
  function easeOut(t) {
    const x1 = 0.2, y1 = 0, x2 = 0, y2 = 1;
    const bx = (u) => 3 * x1 * u * (1 - u) * (1 - u) + 3 * x2 * u * u * (1 - u) + u * u * u;
    const by = (u) => 3 * y1 * u * (1 - u) * (1 - u) + 3 * y2 * u * u * (1 - u) + u * u * u;
    let lo = 0, hi = 1, u = t;
    for (let i = 0; i < 20; i++) { u = (lo + hi) / 2; if (bx(u) < t) lo = u; else hi = u; }
    return by(u);
  }
  function animateScroll(to, ms) {
    const from = window.scrollY;
    if (ms <= 0 || Math.abs(to - from) < 1) { window.scrollTo(0, to); return; }
    const t0 = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - t0) / ms);
      window.scrollTo(0, from + (to - from) * easeOut(t));
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  return {
    props: {
      state: { type: Object, required: true },
      classId: { type: String, required: true },
      classHref: { type: Function, required: true },
    },
    emits: ['out-of-scope'],
    data() {
      return { mobileQuery: window.matchMedia('(max-width: 767.98px)'), isMobile: false, clockNow: 0, clockTimer: null };
    },
    created() {
      this.isMobile = this.mobileQuery.matches;
      this.mobileQuery.addEventListener('change', this.onMediaChange);
      this.tick();
      this.clockTimer = setInterval(this.tick, CLOCK_MS);
    },
    beforeUnmount() {
      this.mobileQuery.removeEventListener('change', this.onMediaChange);
      clearInterval(this.clockTimer);
    },
    computed: {
      st() { return this.state; },
      cls() { return this.st.classes.find((c) => c.id === this.classId); },
      schedule() { return this.st.schedule; },
      // Понедельник 00:00 в выбранном поясе: при смене пояса колонки не съезжают на день
      weekStart() { return F.weekStart(this.st.now, this.schedule.offset) + this.schedule.weekShift * 7 * F.DAY; },
      weekLabel() { return F.weekLabel(this.weekStart, this.schedule.offset); },
      lessons() { return this.st.lessons.filter((l) => l.classId === this.classId); },
      // Окно часов сетки: по урокам этого класса на показанной неделе; пустая неделя — по всем урокам
      // класса, чтобы на каникулах сетка не прыгала на значение по умолчанию; нет уроков — 9:00–18:00
      lessonWindow() {
        const weekEnd = this.weekStart + 7 * F.DAY;
        const inWeek = this.lessons.filter((l) => { const ms = F.parse(l.start); return ms >= this.weekStart && ms < weekEnd; });
        return this.windowOf(inWeek.length ? inWeek : this.lessons);
      },
      // Полная сетка — 8:00–22:00, расширенные до окна уроков: урок в 7:00 не должен выпасть из полной сетки.
      // Рендерится всегда целиком, а видна через окно просмотра: так раскрытие и смена окна анимируются
      fullWindow() {
        const w = this.lessonWindow;
        return { start: Math.min(FULL_DAY.start, w.start), end: Math.max(FULL_DAY.end, w.end) };
      },
      viewWindow() { return this.schedule.fullDay ? this.fullWindow : this.lessonWindow; },
      hoursToggleLabel() { return this.schedule.fullDay ? 'Только часы уроков' : 'Показать весь день'; },
      timezoneOptions() {
        return this.st.timezones.map((tz) => ({ value: tz.offset, label: F.timezoneLabel(tz, this.clockNow) }));
      },
    },
    methods: {
      onMediaChange(e) { this.isMobile = e.matches; },
      // Линия «сейчас» и время в поле пояса идут по реальным часам, а дата остаётся демо-датой:
      // к началу демо-дня в поясе ученика прибавляется реальное время суток в том же поясе
      tick() {
        const demoDayStart = F.parts(this.st.now, this.st.offset).dayStart;
        const realDayStart = F.parts(Date.now(), this.st.offset).dayStart;
        this.clockNow = demoDayStart + (Date.now() - realDayStart);
      },
      shiftWeek(weeks) { this.schedule.weekShift += weeks; },
      windowOf(lessons) {
        const offset = this.schedule.offset;
        let start = Infinity;
        let end = -Infinity;
        lessons.forEach((l) => {
          const p = F.parts(F.parse(l.start), offset);
          start = Math.min(start, p.hours);
          end = Math.max(end, Math.ceil((p.hours * 60 + p.minutes + l.minutes) / 60));
        });
        if (start === Infinity) return DEFAULT_WINDOW;
        start = Math.max(0, start - 1);
        end = Math.min(24, Math.max(end + 1, start + MIN_ROWS));
        return { start, end };
      },
      // «Показать весь день» подводит страницу к урокам недели, если они есть и уйдут с экрана:
      // сетка разворачивается вверх, и уроки уезжают вниз на высоту добавленных часов. Конечное место
      // урока считается заранее, и прокрутка идёт одновременно с разворачиванием, с той же длительностью
      // и кривой, чтобы это было одно движение
      toggleFullDay() {
        this.schedule.fullDay = !this.schedule.fullDay;
        if (!this.schedule.fullDay) return;
        this.$nextTick(() => {
          const event = this.$el.querySelector('.schedule-event--grid');
          const viewport = this.$el.querySelector('.schedule-week__viewport');
          const body = this.$el.querySelector('.schedule-week__grid-body');
          const cell = this.$el.querySelector('.schedule-hour-cell');
          if (!event || !viewport || !body || !cell) return;
          const hourPx = cell.getBoundingClientRect().height;
          const translateNow = new DOMMatrix(getComputedStyle(body).transform).m42;
          const translateFinal = (this.fullWindow.start - this.viewWindow.start) * hourPx;
          const heightFinal = (this.viewWindow.end - this.viewWindow.start) * hourPx;
          const r = event.getBoundingClientRect();
          const finalTop = r.top + window.scrollY + (translateFinal - translateNow);
          const docHeightFinal = document.documentElement.scrollHeight + (heightFinal - viewport.getBoundingClientRect().height);
          const maxScroll = Math.max(0, docHeightFinal - window.innerHeight);
          const fitsNow = finalTop - window.scrollY >= 0 && finalTop + r.height - window.scrollY <= window.innerHeight;
          if (fitsNow) return;
          const target = Math.min(maxScroll, Math.max(0, finalTop - (window.innerHeight - r.height) / 2));
          const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
          const ms = reduced ? 0 : parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--motion-slow')) || 250;
          animateScroll(target, ms);
        });
      },
    },
    template: `<div class="class-screen">
      <nav class="class-row" aria-label="Классы ученика">
        <pm-icon-button class="class-row__add" variant="secondary" icon="plus" label="Добавить в класс" @click="$emit('out-of-scope')"></pm-icon-button>
        <ul class="class-row__list">
          <li v-for="c in st.classes" :key="c.id">
            <pm-class-card :cls="c" :selected="c.id === classId" :href="classHref(c)"></pm-class-card>
          </li>
        </ul>
      </nav>

      <pm-card class="card-schedule" :label="'Класс ' + cls.name">
        <pm-class-header :cls="cls" @out-of-scope="$emit('out-of-scope')"></pm-class-header>
        <pm-card-header title="Расписание уроков" divider></pm-card-header>
        <div class="card-schedule__toolbar">
          <pm-week-switcher :label="weekLabel" @prev="shiftWeek(-1)" @next="shiftWeek(1)"></pm-week-switcher>
          <pm-select class="card-schedule__timezone" v-model="schedule.offset" :options="timezoneOptions" icon="globe" label="Часовой пояс расписания"></pm-select>
        </div>
        <template v-if="!isMobile">
          <pm-schedule-week class="card-schedule__week" :lessons="lessons" :week-start="weekStart" :now="clockNow" :offset="schedule.offset"
            :hour-start="fullWindow.start" :hour-end="fullWindow.end" :view-start="viewWindow.start" :view-end="viewWindow.end"></pm-schedule-week>
          <pm-link class="card-schedule__hours-toggle" tone="muted" :icon-right="schedule.fullDay ? 'chevron-up' : 'chevron-down'"
            :aria-expanded="schedule.fullDay" @click="toggleFullDay">{{ hoursToggleLabel }}</pm-link>
        </template>
        <pm-schedule-day-list v-else class="card-schedule__list" :lessons="lessons" :week-start="weekStart" :now="clockNow" :offset="schedule.offset"></pm-schedule-day-list>
      </pm-card>
    </div>`,
  };
})();

// Экран «Класс»: ряд классов как переключатель, шапка выбранного класса и расписание недели.
// Десктоп и планшет — сетка недели (на планшете в событии только время), телефон — список уроков по дням.

window.ScreenClass = (function () {
  const F = window.Format;

  return {
    props: {
      state: { type: Object, required: true },
      classId: { type: String, required: true },
      classHref: { type: Function, required: true },
    },
    emits: ['out-of-scope'],
    data() {
      return { mobileQuery: window.matchMedia('(max-width: 767px)'), isMobile: false };
    },
    created() {
      this.isMobile = this.mobileQuery.matches;
      this.mobileQuery.addEventListener('change', this.onMediaChange);
    },
    beforeUnmount() { this.mobileQuery.removeEventListener('change', this.onMediaChange); },
    computed: {
      st() { return this.state; },
      cls() { return this.st.classes.find((c) => c.id === this.classId); },
      schedule() { return this.st.schedule; },
      weekLabel() { return F.weekLabel(this.schedule.weekStart, this.schedule.offset); },
      lessons() { return this.st.lessons.filter((l) => l.classId === this.classId); },
      timezoneOptions() {
        return this.st.timezones.map((tz) => ({ value: tz.offset, label: F.timezoneLabel(tz, this.st.now) }));
      },
    },
    methods: {
      onMediaChange(e) { this.isMobile = e.matches; },
      shiftWeek(days) { this.schedule.weekStart += days * F.DAY; },
      titleOf() { return this.cls.name; },
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
          <pm-week-switcher :label="weekLabel" @prev="shiftWeek(-7)" @next="shiftWeek(7)"></pm-week-switcher>
          <pm-select class="card-schedule__timezone" v-model="schedule.offset" :options="timezoneOptions" icon="globe" label="Часовой пояс расписания"></pm-select>
        </div>
        <pm-schedule-week v-if="!isMobile" class="card-schedule__week" :lessons="lessons" :week-start="schedule.weekStart" :now="st.now" :offset="schedule.offset" :title-of="titleOf"></pm-schedule-week>
        <pm-schedule-day-list v-else class="card-schedule__list" :lessons="lessons" :week-start="schedule.weekStart" :now="st.now" :offset="schedule.offset" :title-of="titleOf"></pm-schedule-day-list>
      </pm-card>
    </div>`,
  };
})();

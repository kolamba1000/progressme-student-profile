// Экран «Обзор»: пять карточек. На десктопе сетка 8 + 4, на планшете и телефоне одна колонка;
// если урок в ближайшие два часа, на телефоне карточка урока идёт первой (кадр 03a).

window.ScreenOverview = (function () {
  const F = window.Format;
  const SAVE_MS = 600;
  const RETRY_MS = 700;
  const VISIBLE_SIGNALS = 3;
  // Пауза после «Напоминание отправлено», чтобы метку успели прочитать, и длительность складывания строки
  const SETTLE_MS = 900;
  const COLLAPSE_MS = 300;

  return {
    props: { state: { type: Object, required: true } },
    emits: ['out-of-scope'],
    computed: {
      st() { return this.state; },
      classById() {
        const map = {};
        this.st.classes.forEach((c) => { map[c.id] = c; });
        return map;
      },
      // Хвост класса показывается, только если у ученика больше одного класса
      showClassTails() { return this.st.classes.length > 1; },

      // Сигналы: сначала те, что ждут действия учителя, обработанные (напоминание отправлено) уходят вниз (D-74).
      // Перестановка происходит не сразу: в раскрытом списке — переезд после паузы, в свёрнутом — строка
      // сначала складывается на месте и уходит под «Показать ещё» уже невидимой, без рывка
      signals() {
        const settled = this.st.settled;
        return this.st.signals.filter((s) => !settled[s.id]).concat(this.st.signals.filter((s) => settled[s.id]));
      },
      signalsCollapsible() { return this.signals.length > VISIBLE_SIGNALS + 1; },
      // Все сигналы остаются в разметке; скрытые схлопываются CSS-переходом и получают inert
      isCollapsed() {
        return (signal, index) => (this.signalsCollapsible && !this.st.signalsExpanded && index >= VISIBLE_SIGNALS) || !!this.st.collapsing[signal.id];
      },
      hiddenCount() { return this.signals.length - VISIBLE_SIGNALS; },
      attentionTitle() { return F.typo('Требует внимания · ' + this.signals.length); },
      allClearCaption() {
        return this.st.isNew ? F.typo('Сигналы появятся после первого урока') : F.typo('Сейчас ничего не требует действий');
      },

      // Следующий урок
      nextLesson() {
        const now = this.st.now;
        return this.st.lessons
          .filter((l) => l.status === 'planned' && F.parse(l.start) + l.minutes * 60000 > now)
          .sort((a, b) => F.parse(a.start) - F.parse(b.start))[0] || null;
      },
      nextClass() { return this.nextLesson ? this.classById[this.nextLesson.classId] : null; },
      lessonWhen() { return this.nextLesson ? F.lessonWhen(F.parse(this.nextLesson.start), this.nextLesson.minutes, this.st.now, this.st.offset) : ''; },
      lessonSoon() { return this.nextLesson ? F.lessonSoon(F.parse(this.nextLesson.start), this.st.now) : null; },
      lessonPairs() {
        const c = this.nextClass;
        if (!c) return [];
        const pairs = [];
        if (c.currentLesson) pairs.push({ label: 'Остановились на', value: c.currentLesson });
        pairs.push({ label: 'Домашняя работа', value: c.homework || 'Не задана', muted: !c.homework || c.homework === 'Не задана' });
        return pairs;
      },

      // Показатели и активность
      hasStats() { return this.st.stats.length > 0; },
      activityItems() {
        return this.st.activity.map((a) => Object.assign({}, a, { timeLabel: F.moment(F.parse(a.time), this.st.now, this.st.offset) }));
      },

      // Заметка
      note() { return this.st.note; },
      noteDirty() { return this.note.draftGoal !== this.note.goal || this.note.draftText !== this.note.text; },
      noteStatus() {
        if (this.note.error) return null;
        if (!this.note.savedAt) return 'Ещё не сохраняли';
        // Сохранение в демо происходит в реальном времени: дата считается от часов пользователя,
        // остальные даты экрана — от зафиксированного демо-«сейчас»
        const real = this.note.savedReal;
        const now = real ? Date.now() : this.st.now;
        const offset = real ? -new Date().getTimezoneOffset() / 60 : this.st.offset;
        return F.savedLabel(this.note.savedAt, now, offset);
      },
    },
    methods: {
      classLabel(classId) { return this.showClassTails && this.classById[classId] ? this.classById[classId].name : null; },
      signalTone(signal, index) { return index === 0 && !this.st.reminded[signal.id] ? signal.tone : 'neutral'; },
      onSignalAction(signal) {
        if (signal.action.kind !== 'remind') { this.$emit('out-of-scope'); return; }
        const st = this.st;
        st.reminded[signal.id] = true;
        setTimeout(() => {
          const hidden = this.signalsCollapsible && !st.signalsExpanded;
          if (!hidden) { st.settled[signal.id] = true; return; }
          st.collapsing[signal.id] = true;
          setTimeout(() => { st.settled[signal.id] = true; delete st.collapsing[signal.id]; }, COLLAPSE_MS);
        }, SETTLE_MS);
      },
      retryActivity() {
        this.st.activityStatus = 'loading';
        setTimeout(() => {
          this.st.failures.activity -= 1;
          this.st.activityStatus = this.st.failures.activity > 0 ? 'error' : 'ok';
        }, RETRY_MS);
      },
      saveNote() {
        const note = this.note;
        note.saving = true;
        note.error = false;
        setTimeout(() => {
          note.saving = false;
          // Сохранение «падает» по сценарию или если в заметке есть слово «ошибка»
          const forcedFailure = this.st.failures.noteSave > 0;
          if (forcedFailure) this.st.failures.noteSave -= 1;
          if (forcedFailure || /ошибка/i.test(note.draftText + ' ' + note.draftGoal)) {
            note.error = true;
            return;
          }
          note.goal = note.draftGoal;
          note.text = note.draftText;
          note.savedAt = Date.now();
          note.savedReal = true;
        }, SAVE_MS);
      },
    },
    template: `<div class="overview-grid" :class="{ 'overview-grid--lesson-soon': lessonSoon }">
      <div class="overview-grid__column-main">

        <pm-card class="card-attention" label="Требует внимания">
          <template v-if="signals.length">
            <pm-card-header :title="attentionTitle"></pm-card-header>
            <transition-group name="list" tag="ul" class="list">
              <li v-for="(s, i) in signals" :key="s.id" class="list__item"
                :class="{ 'list__item--collapsible': signalsCollapsible, 'list__item--collapsed': isCollapsed(s, i) }" :inert="isCollapsed(s, i)">
                <div class="list__item-inner">
                  <pm-signal-row :signal="s" :tone="signalTone(s, i)" :class-label="classLabel(s.classId)" :reminded="!!st.reminded[s.id]" @action="onSignalAction(s)"></pm-signal-row>
                </div>
              </li>
              <li v-if="signalsCollapsible" key="footer" class="list__item list__item--footer">
                <pm-link tone="muted" :icon-right="st.signalsExpanded ? 'chevron-up' : 'chevron-down'"
                  :aria-expanded="st.signalsExpanded" @click="st.signalsExpanded = !st.signalsExpanded">
                  {{ st.signalsExpanded ? 'Свернуть' : 'Показать ещё ' + hiddenCount }}
                </pm-link>
              </li>
            </transition-group>
          </template>
          <pm-all-clear-row v-else title="Требует внимания" :caption="allClearCaption"></pm-all-clear-row>
        </pm-card>

        <pm-card class="card-learning-30-days" label="Учёба за 30 дней">
          <pm-card-header :title="'Учёба за 30 дней'">
            <template #link v-if="hasStats"><pm-link tone="muted" icon-right="arrow-right" @click="$emit('out-of-scope')">Статистика</pm-link></template>
          </pm-card-header>
          <div v-if="hasStats" class="stats-row">
            <pm-stat v-for="s in st.stats" :key="s.label" :label="s.label" :value="s.value" :previous="s.previous" :drop="s.drop"></pm-stat>
          </div>
          <pm-block-empty v-else icon="calendar-days" text="Данных пока нет. Появятся после первого урока и первой домашней работы"></pm-block-empty>
        </pm-card>

        <pm-card class="card-activity" label="Активность">
          <pm-card-header title="Активность">
            <template #link v-if="activityItems.length"><pm-link tone="muted" icon-right="arrow-right" @click="$emit('out-of-scope')">Все события</pm-link></template>
          </pm-card-header>
          <transition name="fade" mode="out-in">
            <pm-block-error v-if="st.activityStatus === 'error'" key="error" text="Не удалось загрузить активность" @retry="retryActivity"></pm-block-error>
            <pm-block-loading v-else-if="st.activityStatus === 'loading'" key="loading" :rows="3"></pm-block-loading>
            <ul v-else-if="activityItems.length" key="list" class="list">
              <li v-for="a in activityItems" :key="a.time" class="list__item">
                <pm-activity-item :icon="a.icon" :text="a.text" :time="a.timeLabel" :class-label="classLabel(a.classId)"></pm-activity-item>
              </li>
            </ul>
            <pm-block-empty v-else key="empty" icon="clock" text="Пока ничего не было"></pm-block-empty>
          </transition>
        </pm-card>

      </div>
      <div class="overview-grid__column-side">

        <pm-card class="card-next-lesson" label="Следующий урок">
          <pm-card-header title="Следующий урок" :caption="nextClass ? nextClass.name : null"></pm-card-header>
          <template v-if="nextLesson">
            <div class="card-next-lesson__when-row">
              <div class="card-next-lesson__when">
                <p class="card-next-lesson__date h1">{{ lessonWhen }}</p>
                <pm-tag v-if="lessonSoon" tone="info" icon="clock">{{ lessonSoon }}</pm-tag>
              </div>
              <pm-button class="card-next-lesson__enter" variant="primary" icon="arrow-right" @click="$emit('out-of-scope')">Войти в класс</pm-button>
            </div>
            <div class="divider"></div>
            <dl class="pairs">
              <pm-kv-pair v-for="p in lessonPairs" :key="p.label" :label="p.label" :value="p.value" :muted="p.muted"></pm-kv-pair>
            </dl>
            <template v-if="nextClass.package">
              <div class="divider"></div>
              <dl class="pairs"><pm-kv-pair label="Пакет" :value="nextClass.package"></pm-kv-pair></dl>
            </template>
          </template>
          <pm-block-empty v-else icon="calendar-x" text="Следующий урок не запланирован. Ученики остаются чаще, когда следующий урок назначен заранее">
            <pm-button variant="secondary" @click="$emit('out-of-scope')">Запланировать</pm-button>
          </pm-block-empty>
        </pm-card>

        <pm-card class="card-goal-and-note" label="Цель и заметка">
          <pm-card-header title="Цель и заметка" caption="Видите только вы"></pm-card-header>
          <form class="note-form" @submit.prevent="saveNote">
            <pm-input id="goal" label="Цель" v-model="note.draftGoal" placeholder="Например: сдать IELTS на 6.5 к маю"></pm-input>
            <pm-textarea id="note" label="Заметка" v-model="note.draftText" placeholder="Что важно помнить об ученике: цели, трудности, просьбы родителей"></pm-textarea>
            <div class="note-form__footer">
              <span class="crossfade note-form__status">
                <transition name="fade">
                  <span v-if="note.error" key="error" class="save-error small" role="alert"><pm-icon name="circle-alert" size="s"></pm-icon>Не удалось сохранить</span>
                  <span v-else :key="noteStatus" class="small text-muted" aria-live="polite">{{ noteStatus }}</span>
                </transition>
              </span>
              <span class="crossfade">
                <transition name="fade">
                  <pm-button v-if="note.error" key="retry" type="submit" variant="secondary" :disabled="note.saving">Повторить</pm-button>
                  <pm-button v-else key="save" type="submit" variant="secondary" :disabled="!noteDirty || note.saving">Сохранить</pm-button>
                </transition>
              </span>
            </div>
          </form>
        </pm-card>

      </div>
    </div>`,
  };
})();

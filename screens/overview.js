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
  const HIDE_ITEM = { label: 'Скрыть', kind: 'hide', done: 'Сигнал скрыт' };
  const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  return {
    props: { state: { type: Object, required: true } },
    emits: ['out-of-scope'],
    // Свёрнут ли список, решается при загрузке страницы (больше четырёх — видны три и «Показать ещё»; четыре и меньше — все)
    // и дальше не меняется, пока учитель на странице: ушедший сигнал заменяет следующий по срочности, ссылка остаётся
    // даже при одном скрытом. Иначе после «Напомнить» список раскрывался и карточка росла от действия, которое её сокращает
    data() { return { collapseOnVisit: false }; },
    // Последняя подпись убранных: не реактивна, нужна, чтобы строка складывалась с прежним текстом
    created() { this.summaryMemo = {}; this.decideCollapse(); },
    // Другой сценарий в адресе подменяет данные без пересоздания экрана: решение принимается заново
    watch: { state() { this.decideCollapse(); } },
    // Скрытые на этом заходе сигналы после ухода со страницы больше не показываются, подпись «Сигнал скрыт» исчезает
    beforeUnmount() {
      Object.keys(this.st.removed).forEach((id) => { this.st.gone[id] = true; delete this.st.removed[id]; });
      this.st.removedOrder.splice(0);
    },
    computed: {
      st() { return this.state; },
      classById() {
        const map = {};
        this.st.classes.forEach((c) => { map[c.id] = c; });
        return map;
      },
      // Хвост класса показывается, только если у ученика больше одного класса
      showClassTails() { return this.st.classes.length > 1; },

      // Сигналы (D-80): основной список — то, что ждёт действия учителя, и подписи «Сигнал скрыт» на месте скрытых;
      // после «Напомнить» сигнал складывается на месте и переезжает в группу «Ждут ответа» под списком.
      // Счётчик и «Показать ещё» считают только ждущие действия
      visibleSignals() { return this.st.signals.filter((s) => !this.st.gone[s.id]); },
      signals() { return this.visibleSignals.filter((s) => !this.st.settled[s.id]); },
      waitingSignals() { return this.visibleSignals.filter((s) => this.st.settled[s.id]); },
      // Убранные (скрыт или причина устранена из «⋯»): их строки складываются на месте, а подпись с «Отменить»
      // стоит первой строкой списка и только меняет число. Постоянное место: строку не сдвигают ни скрытие,
      // ни отмена сигналов выше неё (замечания пользователя 10 октября)
      removedMain() { return this.removedIn(this.signals); },
      removedWaiting() { return this.removedIn(this.waitingSignals); },
      // Строки, которые занимают место в основном списке: без убранных
      shownSignals() { return this.signals.filter((s) => !this.st.removed[s.id]); },
      activeCount() { return this.visibleSignals.filter((s) => !this.st.reminded[s.id] && !this.st.removed[s.id]).length; },
      firstActiveId() { const s = this.signals.find((x) => !this.st.reminded[x.id] && !this.st.removed[x.id]); return s ? s.id : null; },
      signalsCollapsible() { return this.collapseOnVisit && this.shownSignals.length > VISIBLE_SIGNALS; },
      // Все сигналы остаются в разметке; скрытые схлопываются CSS-переходом и получают inert
      isCollapsed() {
        return (signal) => {
          if (this.st.collapsing[signal.id]) return true;
          if (this.st.removed[signal.id]) return true;
          const index = this.shownSignals.indexOf(signal);
          return this.signalsCollapsible && !this.st.signalsExpanded && index >= VISIBLE_SIGNALS;
        };
      },
      // Группа «Ждут ответа» свёрнута в строку-заголовок: строки видны только после нажатия на неё
      isWaitingCollapsed() { return (signal) => !this.st.waitingExpanded || !!this.st.removed[signal.id]; },
      mainSummary() { return this.summaryOf(this.removedMain, 'main'); },
      waitingSummary() { return this.summaryOf(this.removedWaiting, 'waiting'); },
      hiddenCount() { return this.shownSignals.length - VISIBLE_SIGNALS; },
      attentionTitle() { return F.typo('Требует внимания · ' + this.activeCount); },
      // Скрытые из группы не считаются; пока их можно вернуть, группа остаётся, но без числа
      waitingCount() { return this.waitingSignals.filter((s) => !this.st.removed[s.id]).length; },
      waitingTitle() { return this.waitingCount ? F.typo('Ждут ответа · ' + this.waitingCount) : 'Ждут ответа'; },
      // Последняя видимая строка списка: свёрнутые строки остаются в разметке, поэтому :last-child
      // не всегда видимый, и под последней видимой строкой оставалась линия
      mainEndKey() {
        if (this.signalsCollapsible) return 'footer';
        const open = this.signals.filter((s) => !this.isCollapsed(s));
        if (open.length) return open[open.length - 1].id;
        return this.removedMain.length ? 'removed-summary' : null;
      },
      waitingEndKey() {
        const open = this.waitingSignals.filter((s) => !this.isWaitingCollapsed(s));
        if (open.length) return open[open.length - 1].id;
        return this.st.waitingExpanded && this.removedWaiting.length ? 'removed-summary' : null;
      },
      allClearCaption() {
        return this.st.isNew ? F.typo('Сигналы появятся после первого урока') : 'Сейчас ничего';
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
      decideCollapse() { this.collapseOnVisit = this.shownSignals.length > VISIBLE_SIGNALS + 1; },
      signalTone(signal) { return signal.id === this.firstActiveId ? signal.tone : 'neutral'; },
      menuOf(signal) { return (signal.menu || []).concat([HIDE_ITEM]); },
      // «Показать ещё» и «Свернуть» управляют только основным списком: ссылка стоит над группой и по месту относится
      // к тому, что выше. Группу «Ждут ответа» открывает и закрывает её собственная строка
      toggleSignals() { this.st.signalsExpanded = !this.st.signalsExpanded; },
      // «Напомнить»: метка на месте кнопки, счётчик сразу меньше; через паузу строка складывается и переезжает в «Ждут ответа»
      onSignalAction(signal) {
        if (signal.action.kind !== 'remind') { this.$emit('out-of-scope'); return; }
        const st = this.st;
        st.reminded[signal.id] = true;
        setTimeout(() => {
          if (st.settled[signal.id] || st.removed[signal.id]) return;
          st.collapsing[signal.id] = true;
          setTimeout(() => { st.settled[signal.id] = true; delete st.collapsing[signal.id]; }, reducedMotion() ? 0 : COLLAPSE_MS);
        }, SETTLE_MS);
      },
      // Убранные в списке в порядке, в котором их убирали
      removedIn(list) {
        const ids = list.map((s) => s.id);
        return this.st.removedOrder.filter((id) => this.st.removed[id] && ids.includes(id));
      },
      // Подпись: один убранный — что произошло («Сигнал скрыт», «Оплата отмечена»), несколько — «Убрано из списка: N».
      // Пока строка складывается после последней отмены, в ней остаётся прежний текст
      summaryOf(order, key) {
        if (!order.length) return this.summaryMemo[key] || { text: '', undo: 'Отменить' };
        const memo = order.length > 1
          ? { text: F.typo('Убрано из списка: ' + order.length), undo: 'Отменить последнее' }
          : { text: this.st.removed[order[0]], undo: 'Отменить' };
        this.summaryMemo[key] = memo;
        return memo;
      },
      // Строка сигнала складывается на месте, подпись первой строкой списка появляется или меняет число
      onSignalMenu(signal, item) {
        if (item.kind === 'open') { this.$emit('out-of-scope'); return; }
        this.st.removed[signal.id] = item.done;
        this.st.removedOrder.push(signal.id);
      },
      // «Отменить» и «Отменить последнее» возвращают последний убранный на его место, число в подписи уменьшается
      undoLast(order) {
        const last = order[order.length - 1];
        if (!last) return;
        delete this.st.removed[last];
        const i = this.st.removedOrder.lastIndexOf(last);
        if (i >= 0) this.st.removedOrder.splice(i, 1);
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
          <template v-if="visibleSignals.length">
            <pm-card-header v-if="activeCount" :title="attentionTitle"></pm-card-header>
            <pm-all-clear-row v-else title="Требует внимания" :caption="allClearCaption"></pm-all-clear-row>
            <transition-group v-if="signals.length" name="list" tag="ul" class="list">
              <li key="removed-summary" class="list__item list__item--collapsible" :class="{ 'list__item--collapsed': !removedMain.length, 'list__item--end': mainEndKey === 'removed-summary' }" :inert="!removedMain.length">
                <div class="list__item-inner">
                  <pm-hidden-signal-row :text="mainSummary.text" :undo-label="mainSummary.undo" @undo="undoLast(removedMain)"></pm-hidden-signal-row>
                </div>
              </li>
              <li v-for="s in signals" :key="s.id" class="list__item" :data-signal="s.id"
                :class="{ 'list__item--collapsible': true, 'list__item--collapsed': isCollapsed(s), 'list__item--end': mainEndKey === s.id }" :inert="isCollapsed(s)">
                <div class="list__item-inner">
                  <pm-signal-row :signal="s" :tone="signalTone(s)" :class-label="classLabel(s.classId)" :reminded="!!st.reminded[s.id]"
                    :menu="menuOf(s)" @action="onSignalAction(s)" @menu="onSignalMenu(s, $event)"></pm-signal-row>
                </div>
              </li>
              <li v-if="signalsCollapsible" key="footer" class="list__item list__item--footer">
                <pm-link tone="muted" :icon-right="st.signalsExpanded ? 'chevron-up' : 'chevron-down'"
                  :aria-expanded="st.signalsExpanded" @click="toggleSignals">
                  {{ st.signalsExpanded ? 'Свернуть' : 'Показать ещё ' + hiddenCount }}
                </pm-link>
              </li>
            </transition-group>
            <section v-if="waitingSignals.length" class="signals-waiting" :class="{ 'signals-waiting--open': st.waitingExpanded }" aria-label="Ждут ответа">
              <pm-link class="signals-waiting__toggle" tone="muted" :icon-right="st.waitingExpanded ? 'chevron-up' : 'chevron-down'"
                :aria-expanded="st.waitingExpanded" @click="st.waitingExpanded = !st.waitingExpanded">{{ waitingTitle }}</pm-link>
              <transition-group name="fade" tag="ul" class="list">
                <li key="removed-summary" class="list__item list__item--collapsible"
                  :class="{ 'list__item--collapsed': !st.waitingExpanded || !removedWaiting.length, 'list__item--end': waitingEndKey === 'removed-summary' }" :inert="!st.waitingExpanded || !removedWaiting.length">
                  <div class="list__item-inner">
                    <pm-hidden-signal-row :text="waitingSummary.text" :undo-label="waitingSummary.undo" @undo="undoLast(removedWaiting)"></pm-hidden-signal-row>
                  </div>
                </li>
                <li v-for="s in waitingSignals" :key="s.id" class="list__item" :data-signal="s.id"
                  :class="{ 'list__item--collapsible': true, 'list__item--collapsed': isWaitingCollapsed(s), 'list__item--end': waitingEndKey === s.id }" :inert="isWaitingCollapsed(s)">
                  <div class="list__item-inner">
                    <pm-signal-row :signal="s" tone="neutral" :class-label="classLabel(s.classId)" reminded
                      :menu="menuOf(s)" @menu="onSignalMenu(s, $event)"></pm-signal-row>
                  </div>
                </li>
              </transition-group>
            </section>
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

// Компоненты дизайн-системы. Имя тега = «pm-» + имя компонента в Figma (pm-button ↔ button),
// пропсы = свойства компонента в Figma (variant, tone, size, state…). Классы CSS в БЭМ:
// блок — имя компонента, модификатор — значение свойства (.button--primary), элемент — слой (.button__label).
// Размеры (size=wide/narrow у signal-row, layout=row/stacked у kv-pair и т. п.) в коде не пропсы,
// а медиазапросы в components.css: компонент сам перестраивается по ширине окна.

(function () {
  const F = window.Format;

  // Навигация сайдбара: группы пунктов, как в компоненте sidebar. Подписи нужны скринридеру и подсказке.
  const NAV_GROUPS = [
    [{ id: 'help', icon: 'circle-help', label: 'Помощь' }],
    [
      { id: 'courses', icon: 'graduation-cap', label: 'Курсы' },
      { id: 'students', icon: 'users', label: 'Ученики', active: true },
      { id: 'materials', icon: 'book-open', label: 'Материалы' },
    ],
    [
      { id: 'calendar', icon: 'calendar-days', label: 'Календарь' },
      { id: 'schedule', icon: 'calendar', label: 'Расписание' },
    ],
    [{ id: 'payments', icon: 'wallet', label: 'Оплаты' }],
    [{ id: 'settings', icon: 'settings', label: 'Настройки' }],
  ];

  const LESSON_STATUS = {
    planned: { icon: 'clock', label: 'Запланирован' },
    done: { icon: 'check', label: 'Проведён' },
    missed: { icon: 'x', label: 'Неявка' },
    unpaid: { icon: 'wallet', label: 'Нет оплаты' },
  };

  const components = {};

  // --- Основа -------------------------------------------------------------

  components['pm-icon'] = {
    props: { name: { type: String, required: true }, size: { type: String, default: 'm' } },
    computed: { markup() { return window.ICONS[this.name] || ''; } },
    template: `<svg class="icon" :class="'icon--' + size" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" v-html="markup"></svg>`,
  };

  components['pm-logo'] = {
    props: { size: { type: String, default: 'm' } },
    data() { return { svg: window.LOGO_SVG }; },
    template: `<span class="logo" :class="'logo--' + size" v-html="svg"></span>`,
  };

  // --- Базовые ------------------------------------------------------------

  components['pm-button'] = {
    props: {
      variant: { type: String, default: 'secondary' },
      icon: String,
      disabled: Boolean,
      type: { type: String, default: 'button' },
    },
    emits: ['click'],
    template: `<button class="button" :class="'button--' + variant" :type="type" :disabled="disabled"
      @click="$emit('click', $event)">
      <pm-icon v-if="icon" :name="icon"></pm-icon>
      <span class="button__label"><slot></slot></span>
    </button>`,
  };

  components['pm-icon-button'] = {
    props: { variant: { type: String, default: 'secondary' }, icon: { type: String, required: true }, label: { type: String, required: true } },
    emits: ['click'],
    template: `<button type="button" class="icon-button" :class="'icon-button--' + variant" :aria-label="label" :title="label"
      @click="$emit('click', $event)"><pm-icon :name="icon"></pm-icon></button>`,
  };

  components['pm-link'] = {
    props: { tone: { type: String, default: 'accent' }, iconLeft: String, iconRight: String, href: String },
    emits: ['click'],
    template: `<component :is="href ? 'a' : 'button'" class="link" :class="'link--' + tone" :href="href" :type="href ? null : 'button'"
      @click="$emit('click', $event)">
      <pm-icon v-if="iconLeft" :name="iconLeft" size="s"></pm-icon>
      <span class="link__label"><slot></slot></span>
      <pm-icon v-if="iconRight" :name="iconRight" size="s"></pm-icon>
    </component>`,
  };

  components['pm-tag'] = {
    props: { tone: { type: String, default: 'neutral' }, icon: String },
    template: `<span class="tag" :class="'tag--' + tone">
      <pm-icon v-if="icon" :name="icon" size="s"></pm-icon>
      <span class="tag__label"><slot></slot></span>
    </span>`,
  };

  components['pm-input'] = {
    props: { modelValue: String, label: { type: String, required: true }, id: { type: String, required: true }, placeholder: String },
    emits: ['update:modelValue'],
    template: `<div class="field">
      <label class="field__label small text-secondary" :for="id">{{ label }}</label>
      <input class="input" :id="id" type="text" :value="modelValue" :placeholder="placeholder"
        @input="$emit('update:modelValue', $event.target.value)">
    </div>`,
  };

  components['pm-textarea'] = {
    props: { modelValue: String, label: { type: String, required: true }, id: { type: String, required: true }, placeholder: String },
    emits: ['update:modelValue'],
    mounted() {
      this.grow();
      // После загрузки шрифта и при смене ширины высота строк меняется
      document.fonts.ready.then(this.grow);
      window.addEventListener('resize', this.grow);
    },
    beforeUnmount() { window.removeEventListener('resize', this.grow); },
    watch: { modelValue() { this.$nextTick(this.grow); } },
    methods: {
      // Поле растёт по содержимому до ~10 строк, дальше прокрутка внутри (docs/states.md)
      grow() {
        const el = this.$refs.area;
        el.style.height = 'auto';
        el.style.height = el.scrollHeight + 2 + 'px';
      },
    },
    template: `<div class="field">
      <label class="field__label small text-secondary" :for="id">{{ label }}</label>
      <textarea class="textarea" ref="area" :id="id" rows="2" :value="modelValue" :placeholder="placeholder"
        @input="$emit('update:modelValue', $event.target.value)"></textarea>
    </div>`,
  };

  components['pm-select'] = {
    props: { modelValue: { required: true }, options: { type: Array, required: true }, icon: String, label: { type: String, required: true } },
    emits: ['update:modelValue'],
    data() { return { open: false }; },
    computed: {
      current() { return this.options.find((o) => o.value === this.modelValue) || this.options[0]; },
    },
    mounted() { document.addEventListener('click', this.onDocumentClick); },
    beforeUnmount() { document.removeEventListener('click', this.onDocumentClick); },
    methods: {
      onDocumentClick(e) { if (!this.$el.contains(e.target)) this.open = false; },
      choose(option) { this.$emit('update:modelValue', option.value); this.open = false; this.$refs.control.focus(); },
    },
    template: `<div class="select" :class="{ 'select--open': open }" @keydown.esc="open = false">
      <button type="button" class="select__control" ref="control" :aria-expanded="open" aria-haspopup="listbox" :aria-label="label"
        @click="open = !open">
        <pm-icon v-if="icon" :name="icon"></pm-icon>
        <span class="select__value body">{{ current.label }}</span>
        <pm-icon :name="open ? 'chevron-up' : 'chevron-down'"></pm-icon>
      </button>
      <transition name="pop">
        <pm-dropdown-menu v-if="open" role="listbox" :aria-label="label">
          <pm-menu-item v-for="o in options" :key="o.value" :label="o.label" :selected="o.value === modelValue" @select="choose(o)"></pm-menu-item>
        </pm-dropdown-menu>
      </transition>
    </div>`,
  };

  components['pm-dropdown-menu'] = {
    template: `<div class="dropdown-menu"><slot></slot></div>`,
  };

  components['pm-menu-item'] = {
    props: { label: { type: String, required: true }, selected: Boolean },
    emits: ['select'],
    template: `<button type="button" class="menu-item" :class="{ 'menu-item--selected': selected }" role="option" :aria-selected="selected"
      @click="$emit('select')">
      <span class="menu-item__label body">{{ label }}</span>
      <pm-icon v-if="selected" name="check"></pm-icon>
    </button>`,
  };

  components['pm-avatar'] = {
    props: { size: { type: String, default: 'm' }, initial: { type: String, required: true } },
    template: `<span class="avatar" :class="'avatar--' + size" aria-hidden="true">{{ initial }}</span>`,
  };

  components['pm-class-avatar'] = {
    props: { color: { type: String, required: true }, size: { type: String, default: 'm' }, initial: { type: String, required: true } },
    template: `<span class="class-avatar" :class="['class-avatar--' + color, 'class-avatar--' + size]" aria-hidden="true">{{ initial }}</span>`,
  };

  // --- Навигация ------------------------------------------------------------

  components['pm-tab'] = {
    props: { href: { type: String, required: true }, active: Boolean },
    template: `<a class="tab" :class="{ 'tab--active': active }" :href="href" :aria-current="active ? 'page' : null">
      <span class="tab__label"><slot></slot></span>
      <span class="tab__underline"></span>
    </a>`,
  };

  components['pm-tabs'] = {
    props: { tabs: { type: Array, required: true } },
    emits: ['out-of-scope'],
    template: `<nav class="tabs" aria-label="Разделы профиля">
      <ul class="tabs__row">
        <li v-for="t in tabs" :key="t.id">
          <pm-tab :href="t.href" :active="t.active" @click="t.outOfScope && ($event.preventDefault(), $emit('out-of-scope'))">{{ t.label }}</pm-tab>
        </li>
      </ul>
      <div class="divider"></div>
    </nav>`,
  };

  components['pm-nav-item'] = {
    props: { icon: { type: String, required: true }, label: { type: String, required: true }, active: Boolean },
    emits: ['click'],
    template: `<button type="button" class="nav-item" :class="{ 'nav-item--active': active }" :aria-current="active ? 'page' : null"
      :title="label" @click="$emit('click', $event)">
      <pm-icon :name="icon"></pm-icon>
      <span class="visually-hidden">{{ label }}</span>
    </button>`,
  };

  components['pm-sidebar'] = {
    emits: ['out-of-scope'],
    data() { return { groups: NAV_GROUPS }; },
    template: `<nav class="sidebar" aria-label="Разделы">
      <template v-for="(group, i) in groups" :key="i">
        <div v-if="i > 0" class="sidebar__divider"></div>
        <pm-nav-item v-for="item in group" :key="item.id" :icon="item.icon" :label="item.label" :active="item.active"
          @click="!item.active && $emit('out-of-scope')"></pm-nav-item>
      </template>
    </nav>`,
  };

  components['pm-header'] = {
    props: { teacherInitial: { type: String, required: true }, menuOpen: Boolean },
    emits: ['menu', 'out-of-scope'],
    template: `<header class="header">
      <pm-icon-button class="header__menu" variant="ghost" icon="menu" label="Меню разделов" :aria-expanded="menuOpen" @click="$emit('menu')"></pm-icon-button>
      <a class="header__logo" href="index.html" aria-label="ProgressMe, к списку экранов"><pm-logo></pm-logo></a>
      <span class="header__spacer"></span>
      <button type="button" class="header__help" @click="$emit('out-of-scope')">
        <pm-icon name="circle-help"></pm-icon><span class="body text-secondary">Помощь</span>
      </button>
      <pm-icon-button class="header__notifications" variant="ghost" icon="bell" label="Уведомления" @click="$emit('out-of-scope')"></pm-icon-button>
      <button type="button" class="header__user" aria-label="Меню учителя" @click="$emit('out-of-scope')">
        <pm-avatar size="s" :initial="teacherInitial"></pm-avatar>
        <pm-icon class="header__user-chevron" name="chevron-down" size="s"></pm-icon>
      </button>
    </header>`,
  };

  // --- Карточки -------------------------------------------------------------

  components['pm-card'] = {
    props: { label: String },
    template: `<section class="card" :aria-label="label"><slot></slot></section>`,
  };

  components['pm-card-header'] = {
    props: { title: { type: String, required: true }, caption: String, divider: Boolean },
    template: `<div class="card-header" :class="{ 'card-header--divider': divider }">
      <div class="card-header__row">
        <h2 class="card-header__title h3">{{ title }}</h2>
        <span v-if="caption" class="card-header__caption body text-secondary">{{ caption }}</span>
        <slot name="link"></slot>
      </div>
      <div v-if="divider" class="divider"></div>
    </div>`,
  };

  components['pm-signal-row'] = {
    props: {
      signal: { type: Object, required: true },
      tone: { type: String, default: 'neutral' },
      classLabel: String,
      reminded: Boolean,
    },
    emits: ['action'],
    template: `<div class="signal-row" :class="'signal-row--' + tone">
      <span class="signal-row__icon-circle"><pm-icon :name="signal.icon" size="s"></pm-icon></span>
      <p class="signal-row__text body-strong">{{ signal.text }}<span v-if="classLabel" class="signal-row__class">&nbsp;·&nbsp;{{ classLabel }}</span></p>
      <span class="signal-row__action crossfade">
        <transition name="fade">
          <span v-if="reminded" key="done" class="signal-row__done body text-secondary" role="status">
            <pm-icon name="check" size="s"></pm-icon>Напоминание отправлено
          </span>
          <pm-button v-else key="action" class="signal-row__button" variant="secondary" @click="$emit('action')">{{ signal.action.label }}</pm-button>
        </transition>
      </span>
    </div>`,
  };

  components['pm-kv-pair'] = {
    props: { label: { type: String, required: true }, value: { type: String, required: true }, muted: Boolean },
    template: `<div class="kv-pair">
      <dt class="kv-pair__label small text-secondary">{{ label }}</dt>
      <dd class="kv-pair__value body" :class="{ 'text-muted': muted }">{{ value }}</dd>
    </div>`,
  };

  components['pm-stat'] = {
    props: { label: { type: String, required: true }, value: { type: String, required: true }, previous: String, drop: Boolean },
    template: `<div class="stat-item">
      <span class="stat-item__label small text-secondary">{{ label }}</span>
      <span class="stat-item__numbers">
        <span class="stat-item__value-row">
          <span class="stat-item__value stat">{{ value }}</span>
          <pm-icon v-if="drop" class="stat-item__arrow" name="arrow-down"></pm-icon>
          <span v-if="drop" class="visually-hidden">, заметный спад</span>
        </span>
        <span v-if="previous" class="stat-item__previous small text-muted">{{ previous }}</span>
      </span>
    </div>`,
  };

  components['pm-activity-item'] = {
    props: { icon: { type: String, required: true }, text: { type: String, required: true }, time: { type: String, required: true }, classLabel: String },
    template: `<div class="activity-item">
      <span class="activity-item__time small text-secondary">{{ time }}</span>
      <span class="activity-item__icon-slot"><pm-icon :name="icon" size="s"></pm-icon></span>
      <p class="activity-item__text body">{{ text }}<span v-if="classLabel" class="activity-item__class">&nbsp;·&nbsp;{{ classLabel }}</span></p>
    </div>`,
  };

  components['pm-block-empty'] = {
    props: { icon: { type: String, required: true }, text: { type: String, required: true } },
    template: `<div class="block-empty">
      <span class="block-empty__icon-circle"><pm-icon :name="icon" size="s"></pm-icon></span>
      <div class="block-empty__content">
        <p class="block-empty__text body text-secondary">{{ text }}</p>
        <slot></slot>
      </div>
    </div>`,
  };

  components['pm-block-error'] = {
    props: { text: { type: String, required: true } },
    emits: ['retry'],
    template: `<div class="block-error" role="alert">
      <span class="block-error__icon-circle"><pm-icon name="circle-alert" size="s"></pm-icon></span>
      <div class="block-error__content">
        <p class="block-error__text body">{{ text }}</p>
        <pm-button variant="secondary" @click="$emit('retry')">Повторить</pm-button>
      </div>
    </div>`,
  };

  // Загрузка блока: серые плашки по форме строк, без текста (описано в docs/states.md, кадра в Figma нет)
  components['pm-block-loading'] = {
    props: { rows: { type: Number, default: 3 } },
    template: `<div class="block-loading" role="status" aria-label="Загрузка">
      <span v-for="i in rows" :key="i" class="block-loading__row"></span>
    </div>`,
  };

  components['pm-all-clear-row'] = {
    props: { title: { type: String, required: true }, caption: { type: String, required: true } },
    template: `<div class="all-clear-row">
      <h2 class="all-clear-row__text h3">{{ title }}</h2>
      <p class="all-clear-row__caption body text-secondary">{{ caption }}</p>
    </div>`,
  };

  // --- Профиль и классы -----------------------------------------------------

  components['pm-profile-card'] = {
    props: {
      student: { type: Object, required: true },
      classes: { type: Array, required: true },
      backHref: { type: String, required: true },
    },
    emits: ['out-of-scope'],
    computed: {
      contacts() {
        const s = this.student;
        return [
          { icon: 'mail', text: s.email, label: 'Почта' },
          { icon: 'send', text: s.telegram, label: 'Telegram' },
          { icon: 'phone', text: s.phone, label: 'Телефон' },
          { icon: 'globe', text: s.timezone, label: 'Часовой пояс' },
        ];
      },
    },
    template: `<section class="profile-card" aria-label="Карточка ученика">
      <a class="profile-card__back icon-button icon-button--secondary" :href="backHref" aria-label="Назад к списку учеников" title="Назад">
        <pm-icon name="arrow-left"></pm-icon>
      </a>
      <pm-avatar class="profile-card__avatar" size="l" :initial="student.initial"></pm-avatar>
      <div class="profile-card__info">
        <div class="profile-card__name">
          <h1 class="profile-card__title">{{ student.name }}</h1>
          <p class="profile-card__caption small text-secondary">ID&nbsp;{{ student.id }}&nbsp;·&nbsp;{{ student.timezone }}</p>
        </div>
        <ul class="profile-card__contacts small text-secondary">
          <li class="profile-card__contact">ID&nbsp;{{ student.id }}</li>
          <li v-for="c in contacts" :key="c.icon" class="profile-card__contact">
            <pm-icon :name="c.icon" size="s"></pm-icon><span class="visually-hidden">{{ c.label }}: </span>{{ c.text }}
          </li>
        </ul>
        <div v-if="classes.length" class="profile-card__classes small">
          <span class="text-secondary">Классы</span>
          <span v-for="c in classes" :key="c.id" class="profile-card__class small-strong">
            <span class="profile-card__class-dot" :class="'profile-card__class-dot--' + c.color"></span>{{ c.name }}
          </span>
        </div>
        <div class="profile-card__tags">
          <pm-tag v-for="t in student.tags" :key="t">{{ t }}</pm-tag>
        </div>
        <div class="profile-card__actions">
          <pm-button variant="stacked" icon="send" @click="$emit('out-of-scope')">Telegram</pm-button>
          <pm-button variant="stacked" icon="phone" @click="$emit('out-of-scope')">Позвонить</pm-button>
          <pm-button variant="stacked" icon="mail" @click="$emit('out-of-scope')">Почта</pm-button>
        </div>
      </div>
      <pm-icon-button class="profile-card__more" variant="secondary" icon="ellipsis" label="Ещё действия" @click="$emit('out-of-scope')"></pm-icon-button>
      <pm-button class="profile-card__edit" variant="secondary" icon="pencil" @click="$emit('out-of-scope')">Редактировать</pm-button>
    </section>`,
  };

  components['pm-class-card'] = {
    props: { cls: { type: Object, required: true }, selected: Boolean, href: { type: String, required: true } },
    template: `<a class="class-card" :class="{ 'class-card--selected': selected }" :href="href" :aria-current="selected ? 'true' : null">
      <pm-class-avatar :color="cls.color" size="m" :initial="cls.initial"></pm-class-avatar>
      <span class="class-card__name">
        <span class="class-card__title body-strong">{{ cls.name }}</span>
        <span class="class-card__caption small text-secondary">{{ cls.type }}</span>
      </span>
    </a>`,
  };

  components['pm-class-header'] = {
    props: { cls: { type: Object, required: true } },
    emits: ['out-of-scope'],
    computed: { caption() { return this.cls.type + F.NBSP + '·' + F.NBSP + F.countStudents(this.cls.students); } },
    template: `<div class="class-header">
      <pm-class-avatar :color="cls.color" size="l" :initial="cls.initial"></pm-class-avatar>
      <div class="class-header__name">
        <h2 class="class-header__title h2">{{ cls.name }}</h2>
        <p class="class-header__caption small text-secondary">{{ caption }}</p>
      </div>
      <pm-button class="class-header__enter" variant="primary" icon="arrow-right" @click="$emit('out-of-scope')">Войти в класс</pm-button>
      <pm-icon-button class="class-header__more" variant="secondary" icon="ellipsis" label="Ещё действия с классом" @click="$emit('out-of-scope')"></pm-icon-button>
    </div>`,
  };

  // --- Расписание -----------------------------------------------------------

  components['pm-week-switcher'] = {
    props: { label: { type: String, required: true } },
    emits: ['prev', 'next'],
    template: `<div class="week-switcher">
      <pm-icon-button variant="ghost" icon="chevron-left" label="Предыдущая неделя" @click="$emit('prev')"></pm-icon-button>
      <span class="week-switcher__divider"></span>
      <span class="week-switcher__range body-strong" aria-live="polite">{{ label }}</span>
      <span class="week-switcher__divider"></span>
      <pm-icon-button variant="ghost" icon="chevron-right" label="Следующая неделя" @click="$emit('next')"></pm-icon-button>
    </div>`,
  };

  components['pm-day-header'] = {
    props: { label: { type: String, required: true }, today: Boolean },
    template: `<div class="day-header" :class="{ 'day-header--today': today }">
      <span class="day-header__pill" :class="today ? 'body-strong' : 'body'">{{ label }}<span v-if="today" class="visually-hidden">, сегодня</span></span>
    </div>`,
  };

  components['pm-schedule-event'] = {
    props: {
      lesson: { type: Object, required: true },
      title: { type: String, required: true },
      offset: { type: Number, required: true },
      layout: { type: String, default: 'grid' },
      hourStart: { type: Number, default: 8 }, // первый час сетки: от него считается top события
    },
    computed: {
      status() { return LESSON_STATUS[this.lesson.status]; },
      startTime() { return F.time(F.parse(this.lesson.start), this.offset); },
      endTime() { return F.time(F.parse(this.lesson.start) + this.lesson.minutes * 60000, this.offset); },
      // Высота события из длительности: минуты / 60 × высота часа − 4, не меньше 44 (D-67)
      style() {
        if (this.layout !== 'grid') return null;
        const startMs = F.parse(this.lesson.start);
        const p = F.parts(startMs, this.offset);
        const minutesFromStart = (p.hours - this.hourStart) * 60 + p.minutes;
        const hour = 'var(--layout-hour)';
        return {
          top: 'calc(' + hour + ' * ' + (minutesFromStart / 60) + ' + var(--space-2))',
          height: 'max(calc(' + hour + ' * ' + (this.lesson.minutes / 60) + ' - var(--space-4)), var(--size-touch))',
        };
      },
    },
    template: `<div class="schedule-event" :class="['schedule-event--' + lesson.status, 'schedule-event--' + layout, { 'schedule-event--long': lesson.minutes > 60 }]" :style="style">
      <span class="schedule-event__title small-strong">{{ title }}</span>
      <span class="schedule-event__status small">
        <pm-icon :name="status.icon" size="s"></pm-icon>
        <span class="schedule-event__time">{{ startTime }}<span class="schedule-event__end">–{{ endTime }}</span></span>
        <span class="visually-hidden">, {{ status.label }}</span>
      </span>
    </div>`,
  };

  components['pm-now-indicator'] = {
    props: { top: { type: String, required: true } },
    template: `<div class="now-indicator" :style="{ top: top }" aria-hidden="true">
      <span class="now-indicator__dot"></span><span class="now-indicator__line"></span>
    </div>`,
  };

  // Неделя: подписи дней, колонка часов и семь колонок дней; события — слоем внутри колонки дня.
  // Сетка рендерится целиком (hourStart включительно, hourEnd исключительно; по умолчанию 8:00–22:00),
  // а показывается через окно viewStart–viewEnd: высота окна и сдвиг сетки анимируются CSS-переходом,
  // поэтому «Показать весь день» и смена окна при листании недель разворачивают сетку, а не перерисовывают
  components['pm-schedule-week'] = {
    props: {
      lessons: { type: Array, required: true },
      weekStart: { type: Number, required: true },
      now: { type: Number, required: true },
      offset: { type: Number, required: true },
      titleOf: { type: Function, required: true },
      hourStart: { type: Number, default: 8 },
      hourEnd: { type: Number, default: 23 },
      viewStart: Number,
      viewEnd: Number,
    },
    computed: {
      hours() { return Array.from({ length: this.hourEnd - this.hourStart }, (_, i) => this.hourStart + i); },
      view() {
        return { start: this.viewStart == null ? this.hourStart : this.viewStart, end: this.viewEnd == null ? this.hourEnd : this.viewEnd };
      },
      viewportStyle() { return { height: 'calc(var(--layout-hour) * ' + (this.view.end - this.view.start) + ')' }; },
      bodyStyle() { return { transform: 'translateY(calc(var(--layout-hour) * ' + (this.hourStart - this.view.start) + '))' }; },
      isHidden() { return (h) => h < this.view.start || h >= this.view.end; },
      days() {
        return Array.from({ length: 7 }, (_, i) => {
          const start = this.weekStart + i * F.DAY;
          const end = start + F.DAY;
          return {
            start,
            label: F.weekdayDay(start, this.offset),
            today: F.sameDay(start, this.now, this.offset),
            lessons: this.lessons.filter((l) => { const ms = F.parse(l.start); return ms >= start && ms < end; }),
          };
        });
      },
      nowTop() {
        const p = F.parts(this.now, this.offset);
        const minutes = (p.hours - this.hourStart) * 60 + p.minutes;
        if (minutes < 0 || minutes > this.hours.length * 60) return null;
        return 'calc(var(--layout-hour) * ' + (minutes / 60) + ')';
      },
    },
    template: `<div class="schedule-week">
      <div class="schedule-week__day-row">
        <span class="schedule-week__corner"></span>
        <pm-day-header v-for="d in days" :key="d.start" :label="d.label" :today="d.today"></pm-day-header>
      </div>
      <div class="schedule-week__viewport" :style="viewportStyle">
      <div class="schedule-week__grid-body" :style="bodyStyle">
        <div class="schedule-time-column">
          <span v-for="h in hours" :key="h" class="schedule-time-column__cell small text-muted" :aria-hidden="isHidden(h)">{{ h }}:00</span>
        </div>
        <div v-for="d in days" :key="d.start" class="schedule-day-column" :class="{ 'schedule-day-column--today': d.today }">
          <span v-for="h in hours" :key="h" class="schedule-hour-cell"></span>
          <pm-schedule-event v-for="l in d.lessons" :key="l.start" :lesson="l" :title="titleOf(l)" :offset="offset" :hour-start="hourStart"></pm-schedule-event>
          <pm-now-indicator v-if="d.today && nowTop" :top="nowTop"></pm-now-indicator>
        </div>
      </div>
      </div>
    </div>`,
  };

  // Телефон: вместо сетки список уроков по дням (аннотация «Общее · адаптивы» на кадре 04).
  components['pm-schedule-day-list'] = {
    props: {
      lessons: { type: Array, required: true },
      weekStart: { type: Number, required: true },
      now: { type: Number, required: true },
      offset: { type: Number, required: true },
      titleOf: { type: Function, required: true },
    },
    computed: {
      days() {
        return Array.from({ length: 7 }, (_, i) => {
          const start = this.weekStart + i * F.DAY;
          const end = start + F.DAY;
          return {
            start,
            label: F.weekdayDayMonth(start, this.offset),
            today: F.sameDay(start, this.now, this.offset),
            lessons: this.lessons.filter((l) => { const ms = F.parse(l.start); return ms >= start && ms < end; }),
          };
        }).filter((d) => d.lessons.length);
      },
    },
    template: `<div class="schedule-day-list">
      <p v-if="!days.length" class="schedule-day-list__empty body text-secondary">На этой неделе уроков нет</p>
      <div v-for="d in days" :key="d.start" class="schedule-day-list__day">
        <pm-day-header :label="d.label" :today="d.today"></pm-day-header>
        <pm-schedule-event v-for="l in d.lessons" :key="l.start" :lesson="l" :title="titleOf(l)" :offset="offset" layout="list"></pm-schedule-event>
      </div>
    </div>`,
  };

  // --- Служебное для демо ---------------------------------------------------

  // Уведомление о переходе вне объёма демо. В Figma его нет: это граница демо, а не часть продукта.
  components['pm-demo-notice'] = {
    props: { text: String },
    template: `<div class="demo-notice" role="status" aria-live="polite">
      <transition name="pop"><span v-if="text" class="demo-notice__bubble small-strong">{{ text }}</span></transition>
    </div>`,
  };

  window.registerComponents = function (app) {
    for (const name of Object.keys(components)) app.component(name, components[name]);
  };
})();

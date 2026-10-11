// Тестовые данные демо: один объект, из которого читают оба экрана.
// Имена и контакты вымышленные. Времена в ISO со смещением пояса ученика (UTC+3).
// Тексты по docs/copy.md; неразрывные пробелы расставляет typo() из format.js при загрузке.
// Сценарии в конце файла переопределяют часть полей и дают состояния «Обзора».

window.DATA = {
  // «Сейчас» для демо зафиксировано: пятница 9 октября 2026, 14:40 по Москве.
  now: '2026-10-09T14:40:00+03:00',

  teacher: { initial: 'Т' },

  student: {
    name: 'Анна Смирнова',
    initial: 'А',
    id: '785499',
    email: 'anna@mail.com',
    telegram: '@anna_s',
    phone: '+7 900 000-00-00',
    timezone: 'Москва, UTC+3',
    tags: ['Уровень B1', 'С марта 2026'],
    classes: ['english-group', 'english-individual'],
  },

  classes: [
    {
      id: 'english-group',
      name: 'English Group',
      initial: 'E',
      color: 'green',
      type: 'Групповой класс',
      students: 6,
      currentLesson: '14B Games people play',
      homework: '14B, на проверке с 6 окт',
      package: 'Остался 1 из 8 уроков',
    },
    {
      id: 'english-individual',
      name: 'English Individual',
      initial: 'E',
      color: 'violet',
      type: 'Индивидуальный класс',
      students: 1,
      currentLesson: '7A Daily routines',
      homework: 'Не задана',
      package: null,
    },
  ],

  // Уроки расписания: класс, начало, длительность в минутах, статус planned / done / missed / unpaid.
  // Субботний урок 10 октября — последний оплаченный, дальше в English Group «нет оплаты».
  lessons: [
    { classId: 'english-group', start: '2026-09-29T18:00:00+03:00', minutes: 60, status: 'done' },
    { classId: 'english-group', start: '2026-10-03T18:00:00+03:00', minutes: 60, status: 'done' },
    { classId: 'english-group', start: '2026-10-06T18:00:00+03:00', minutes: 60, status: 'done' },
    { classId: 'english-group', start: '2026-10-10T18:00:00+03:00', minutes: 60, status: 'planned' },
    { classId: 'english-group', start: '2026-10-13T18:00:00+03:00', minutes: 60, status: 'unpaid' },
    { classId: 'english-group', start: '2026-10-17T18:00:00+03:00', minutes: 60, status: 'unpaid' },
    { classId: 'english-individual', start: '2026-09-25T17:00:00+03:00', minutes: 45, status: 'done' },
    { classId: 'english-individual', start: '2026-10-02T17:00:00+03:00', minutes: 45, status: 'missed' },
    { classId: 'english-individual', start: '2026-10-16T17:00:00+03:00', minutes: 90, status: 'planned' },
  ],

  // Сигналы «Требует внимания» в порядке срочности. tone — цвет типа; на экране его получает
  // только первый необработанный сигнал, остальные рисуются нейтральными (D-42). action.kind: remind — после нажатия метка «Напоминание отправлено» и переезд в «Ждут ответа»,
  // open — переход на экран вне объёма демо.
  // menu — действия в «⋯», которые чинят данные: после resolve причина ушла, сигнал уходит сам,
  // на его месте подпись done и «Отменить»; open — экран вне объёма демо. «Скрыть» добавляется ко всем (D-80)
  signals: [
    { id: 'payment', icon: 'wallet', tone: 'warning', text: 'Остался 1 оплаченный урок', classId: 'english-group', action: { label: 'Напомнить об оплате', kind: 'remind' },
      menu: [{ label: 'Отметить оплату вне платформы', kind: 'resolve', done: 'Оплата отмечена' }] },
    { id: 'homework-check', icon: 'clipboard-check', tone: 'warning', text: 'Домашняя работа к уроку 14B ждёт проверки 3 дня', classId: 'english-group', action: { label: 'Проверить', kind: 'open' } },
    { id: 'homework-overdue', icon: 'alarm-clock', tone: 'danger', text: 'Домашняя работа к уроку 14A просрочена на 2 дня', classId: 'english-group', action: { label: 'Напомнить о сдаче', kind: 'remind' },
      menu: [{ label: 'Перенести срок', kind: 'open' }, { label: 'Отменить домашнюю работу', kind: 'resolve', done: 'Домашняя работа отменена' }] },
    { id: 'missed-lesson', icon: 'user-x', tone: 'danger', text: 'Пропуск урока 2 окт', classId: 'english-individual', action: { label: 'Написать', kind: 'open' },
      menu: [{ label: 'Пропуск по уважительной причине', kind: 'resolve', done: 'Пропуск отмечен уважительным' }] },
    { id: 'errors-topic', icon: 'circle-alert', tone: 'warning', text: 'Много ошибок в теме Present Perfect', classId: 'english-group', action: { label: 'Посмотреть', kind: 'open' } },
  ],

  // Показатели за 30 дней. drop — заметный спад, у него красная стрелка вниз.
  stats: [
    { label: 'Посещаемость', value: '9 из 10 уроков', previous: 'до этого 7 из 10', drop: false },
    { label: 'Сдано домашних работ', value: '14 из 16', previous: 'до этого 15 из 16', drop: false },
    { label: 'Верных ответов', value: '72%', previous: 'до этого 88%', drop: true },
  ],

  activity: [
    { time: '2026-10-09T14:20:00+03:00', icon: 'book-open', text: 'Открыт материал «Irregular verbs»', classId: 'english-individual' },
    { time: '2026-10-06T21:05:00+03:00', icon: 'file-text', text: 'Сдана домашняя работа к уроку 14B', classId: 'english-group' },
    { time: '2026-10-06T18:00:00+03:00', icon: 'users', text: 'Урок, 60 мин', classId: 'english-group' },
  ],

  note: {
    goal: 'Сдать IELTS на 6.5 к маю',
    text: 'Путает Past Simple и Present Perfect. Хочет больше говорить, меньше грамматики. Мама просила напоминать про домашние работы',
    savedAt: '2026-10-06T19:10:00+03:00',
  },

  // Часовые пояса в выпадающем списке расписания; первый — пояс ученика.
  timezones: [
    { city: 'Москва', offset: 3 },
    { city: 'Калининград', offset: 2 },
    { city: 'Екатеринбург', offset: 5 },
    { city: 'Новосибирск', offset: 7 },
  ],

  // Сценарии состояний «Обзора». Ключ — значение параметра ?scenario= в адресе.
  // Поля сценария заменяют одноимённые поля данных; failures — сколько первых попыток
  // загрузки блока или сохранения должны «упасть» (повтор удаётся).
  scenarios: {
    default: { title: 'По умолчанию' },
    // Ученик, у которого действительно ничего не ждёт учителя: пакет не на исходе, работа проверена,
    // показатели без спада. Иначе рядом со строкой «Сейчас ничего» стояли бы причины сигналов
    'all-clear': {
      title: 'Нет сигналов',
      signals: [],
      classOverrides: { 'english-group': { homework: '14B, проверена 7 окт', package: 'Осталось 5 из 8 уроков' } },
      stats: [
        { label: 'Посещаемость', value: '9 из 10 уроков', previous: 'до этого 7 из 10', drop: false },
        { label: 'Сдано домашних работ', value: '14 из 16', previous: 'до этого 15 из 16', drop: false },
        { label: 'Верных ответов', value: '86%', previous: 'до этого 84%', drop: false },
      ],
    },
    'new-student': {
      title: 'Новый ученик',
      student: { tags: ['Уровень B1', 'С 9 октября'], classes: ['english-group'] },
      isNew: true,
      signals: [],
      lessons: [],
      stats: [],
      activity: [],
      note: { goal: '', text: '', savedAt: null },
    },
    errors: {
      title: 'Ошибки',
      failures: { activity: 1, noteSave: 1 },
    },
    // Напоминание об оплате отправлено 3 дня назад, оплаты нет: сигнал вернулся первым с цветом (кадр 01f, D-80)
    'no-answer': {
      title: 'Ответа нет 3 дня',
      signalOverrides: { payment: { text: 'Оплаты нет 3 дня после напоминания', action: { label: 'Напомнить ещё раз', kind: 'remind' } } },
    },
    'lesson-soon': {
      title: 'Урок скоро',
      now: '2026-10-10T17:20:00+03:00',
    },
  },
};

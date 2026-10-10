// Форматирование: даты и время по правилам docs/copy.md, склонение, неразрывные пробелы.
// Все расчёты времени ведутся в выбранном часовом поясе, не в поясе браузера,
// чтобы демо выглядело одинаково на любом устройстве.

window.Format = (function () {
  const NBSP = ' ';
  const HOUR = 3600000;
  const DAY = 86400000;
  const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  const MONTHS_FULL = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

  // Неразрывные пробелы: короткие слова (до 3 букв) и числа приклеиваются к следующему слову,
  // перед тире неразрывный пробел, у « · » неразрывные пробелы с обеих сторон: точка-разделитель
  // не должна ни заканчивать строку, ни начинать её (замечание 10 октября, «Групповой класс ·» / «6 учеников»).
  function typo(s) {
    if (typeof s !== 'string') return s;
    let prev;
    let out = s;
    do {
      prev = out;
      out = out
        .replace(/(^|[\s(«])([А-Яа-яЁёA-Za-z]{1,3}|\d+(?:[.,]\d+)?) (?=\S)/g, '$1$2' + NBSP)
        .replace(/ (—|–)/g, NBSP + '$1')
        .replace(/[\s ]·[\s ]/g, NBSP + '·' + NBSP);
    } while (out !== prev);
    return out;
  }

  // Проходит по объекту и применяет typo() ко всем строкам, кроме дат ISO и идентификаторов.
  function typoDeep(value) {
    if (typeof value === 'string') return /^\d{4}-\d{2}-\d{2}T/.test(value) ? value : typo(value);
    if (Array.isArray(value)) return value.map(typoDeep);
    if (value && typeof value === 'object') {
      const out = {};
      for (const key of Object.keys(value)) {
        out[key] = /^(id|classId|icon|kind|color|status|tone|initial)$/.test(key) ? value[key] : typoDeep(value[key]);
      }
      return out;
    }
    return value;
  }

  function parse(iso) {
    return Date.parse(iso);
  }

  // Компоненты даты в поясе offset (часы от UTC).
  function parts(ms, offset) {
    const d = new Date(ms + offset * HOUR);
    const weekday = (d.getUTCDay() + 6) % 7;
    return {
      year: d.getUTCFullYear(),
      month: d.getUTCMonth(),
      day: d.getUTCDate(),
      weekday,
      hours: d.getUTCHours(),
      minutes: d.getUTCMinutes(),
      dayStart: Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - offset * HOUR,
    };
  }

  function sameDay(a, b, offset) {
    return parts(a, offset).dayStart === parts(b, offset).dayStart;
  }

  function time(ms, offset) {
    const p = parts(ms, offset);
    return p.hours + ':' + String(p.minutes).padStart(2, '0');
  }

  // Диапазон времени не разрывается на переносе: после тире стоит соединитель слов U+2060
  function range(startMs, minutes, offset) {
    return time(startMs, offset) + '–⁠' + time(startMs + minutes * 60000, offset);
  }

  function dayMonth(ms, offset) {
    const p = parts(ms, offset);
    return typo(p.day + ' ' + MONTHS_SHORT[p.month]);
  }

  function weekdayDay(ms, offset) {
    const p = parts(ms, offset);
    return WEEKDAYS[p.weekday] + ', ' + p.day;
  }

  function weekdayDayMonth(ms, offset) {
    const p = parts(ms, offset);
    return typo(WEEKDAYS[p.weekday] + ', ' + p.day + ' ' + MONTHS_SHORT[p.month]);
  }

  // «Сегодня», «Завтра», «Вчера» или «6 окт».
  function relativeDay(ms, now, offset) {
    const diff = Math.round((parts(ms, offset).dayStart - parts(now, offset).dayStart) / DAY);
    if (diff === 0) return 'Сегодня';
    if (diff === 1) return 'Завтра';
    if (diff === -1) return 'Вчера';
    return dayMonth(ms, offset);
  }

  // Момент события: «Сегодня, 14:20», «6 окт, 21:05».
  function moment(ms, now, offset) {
    return relativeDay(ms, now, offset) + ', ' + time(ms, offset);
  }

  // Когда урок: «Сегодня, 18:00–19:00», «Завтра, 10 окт, 18:00–19:00», «Сб, 17 окт, 18:00–19:00»,
  // во время урока — «Идёт сейчас, до 19:00».
  function lessonWhen(startMs, minutes, now, offset) {
    const endMs = startMs + minutes * 60000;
    if (now >= startMs && now < endMs) return typo('Идёт сейчас, до ' + time(endMs, offset));
    const diff = Math.round((parts(startMs, offset).dayStart - parts(now, offset).dayStart) / DAY);
    if (diff === 0) return 'Сегодня, ' + range(startMs, minutes, offset);
    if (diff === 1) return 'Завтра, ' + dayMonth(startMs, offset) + ', ' + range(startMs, minutes, offset);
    return weekdayDayMonth(startMs, offset) + ', ' + range(startMs, minutes, offset);
  }

  // «Через 40 мин» или «Через 1 ч 20 мин», только если урок в ближайшие два часа.
  function lessonSoon(startMs, now) {
    const minutesLeft = Math.round((startMs - now) / 60000);
    if (minutesLeft <= 0 || minutesLeft > 120) return null;
    const h = Math.floor(minutesLeft / 60);
    const m = minutesLeft % 60;
    const text = h ? 'Через ' + h + ' ч' + (m ? ' ' + m + ' мин' : '') : 'Через ' + m + ' мин';
    return typo(text);
  }

  // Неделя: понедельник 00:00 в поясе.
  function weekStart(ms, offset) {
    const p = parts(ms, offset);
    return p.dayStart - p.weekday * DAY;
  }

  // «5–11 окт» или «28 сен – 4 окт».
  function weekLabel(startMs, offset) {
    const a = parts(startMs, offset);
    const b = parts(startMs + 6 * DAY, offset);
    if (a.month === b.month) return typo(a.day + '–' + b.day + ' ' + MONTHS_SHORT[a.month]);
    return typo(a.day + ' ' + MONTHS_SHORT[a.month] + ' – ' + b.day + ' ' + MONTHS_SHORT[b.month]);
  }

  // Дата сохранения: «Сохранено 6 окт», «Сохранено сегодня, 14:40».
  function savedLabel(ms, now, offset) {
    if (sameDay(ms, now, offset)) return typo('Сохранено сегодня, ' + time(ms, offset));
    return typo('Сохранено ' + dayMonth(ms, offset));
  }

  // Поле часового пояса: «Москва, UTC+3 · 14:40».
  function timezoneLabel(tz, now) {
    const sign = tz.offset >= 0 ? '+' : '−';
    return typo(tz.city + ', UTC' + sign + Math.abs(tz.offset) + ' · ' + time(now, tz.offset));
  }

  function plural(n, forms) {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return forms[0];
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return forms[1];
    return forms[2];
  }

  function countStudents(n) {
    return typo(n + ' ' + plural(n, ['ученик', 'ученика', 'учеников']));
  }

  function dateFull(ms, offset) {
    const p = parts(ms, offset);
    return typo(p.day + ' ' + MONTHS_FULL[p.month]);
  }

  return {
    NBSP, DAY, HOUR, typo, typoDeep, parse, parts, sameDay, time, range, dayMonth, weekdayDay, weekdayDayMonth,
    relativeDay, moment, lessonWhen, lessonSoon, weekStart, weekLabel, savedLabel, timezoneLabel, plural,
    countStudents, dateFull,
  };
})();

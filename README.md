# Профиль ученика · демо

Два экрана профиля ученика для учителя (вкладки «Обзор» и «Класс»), собранные в коде по макетам из Figma
на трёх размерах: десктоп, планшет, телефон. Тестовое задание ProgressMe.

Это демо дизайна, не продакшн: бэкенда нет, данные тестовые и вымышленные, действия меняют данные
в памяти страницы, перезагрузка возвращает исходные.

## Запуск

Сборки нет. Откройте `index.html` двойным кликом или любым статическим сервером, например:

```
python -m http.server 8080
```

и перейдите на `http://localhost:8080/`. Список экранов и состояний на `index.html`, сами экраны
на `profile.html` с адресами `#/overview` и `#/class/<id класса>`; параметр `?scenario=` выбирает состояние.

Опубликованная версия: https://kolamba1000.github.io/progressme-student-profile/

## Структура

```
index.html              список экранов и состояний со ссылками
profile.html            приложение: шапка, сайдбар, профиль, вкладки, экраны
app.js                  разбор адреса, состояние демо, корневой компонент
format.js               даты, время, склонение, неразрывные пробелы
styles/tokens.css       переменные Figma один в один (text/primary → --text-primary)
styles/base.css         сброс, шрифт, текстовые стили как классы, фокус
styles/components.css   стили компонентов (БЭМ: блок = компонент Figma)
styles/screens.css      оболочка и сетки экранов, брейкпоинты
styles/index.css        страница-список
data/data.js            все тестовые данные и сценарии состояний в одном объекте
components/components.js  компоненты дизайн-системы (Vue), имя тега = «pm-» + имя в Figma
components/icons.js     33 иконки Lucide, те же, что в Figma
components/logo.js      логотип
screens/overview.js     экран «Обзор»
screens/class.js        экран «Класс»
vendor/                 Vue 3 (vue.global.prod.js) и шрифт Inter, локальные копии
```

## Связь с Figma

- Файл: https://www.figma.com/design/4SQeBxa2lSsP1ZVSeulx6o/ · страница `Design System` (компоненты, переменные, стили),
  страница `Screens` (кадры 01–04 и состояния 01a–01d, 03a).
- Переменные трёх коллекций Figma (`Primitives`, `Semantic`, `Layout`) лежат в `styles/tokens.css` с теми же именами.
  Режимы коллекции `Layout` (desktop / tablet / mobile) заданы медиазапросами: ниже 1200 `--size-control` 44 и `--space-card` 20,
  ниже 768 `--space-card` 16.
- Компонент Figma `button` с свойствами `variant`, `icon` → `<pm-button variant="primary" icon="arrow-right">`.
  Варианты размера и раскладки (`size=wide/narrow`, `layout=row/stacked`) в коде не пропсы, а медиазапросы:
  компонент перестраивается сам по ширине окна.
- Стек: Vue 3 без сборки (шаблоны строками в `components.js`), никаких зависимостей кроме Vue, шрифта и иконок.

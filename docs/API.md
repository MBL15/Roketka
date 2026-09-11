# API

Интерактивная документация с возможностью выполнить любой запрос:
**<http://localhost:8080/swagger-ui.html>**
(машиночитаемая схема — `http://localhost:8080/v3/api-docs`).

Схема OpenAPI генерируется из кода (springdoc), поэтому она не может разойтись
с реализацией. Этот файл — навигация по ней и примеры для быстрой проверки из
терминала.

- [Авторизация запросов](#авторизация-запросов)
- [Формат ошибок](#формат-ошибок)
- [1. Аккаунт](#1-аккаунт)
- [2. Игра](#2-игра)
- [3. Раунд](#3-раунд)
- [4. Турнир](#4-турнир)
- [5. Апсейл](#5-апсейл)
- [6. Честность](#6-честность)
- [7. Администрирование](#7-администрирование)
- [WebSocket](#websocket)
- [Сквозной сценарий одной командой](#сквозной-сценарий-одной-командой)

## Авторизация запросов

`POST /api/auth/login` возвращает `token` — непрозрачную строку, серверную
сессию. Все остальные методы ждут его в одном из трёх видов (в порядке
приоритета):

| Способ | Когда удобен |
|---|---|
| `Authorization: Bearer <token>` | основной, его использует интерфейс |
| `X-Session-Token: <token>` | проверка через Swagger UI: заголовок виден в форме |
| `?token=<token>` | WebSocket и быстрые проверки из браузера |

Токен живёт до `POST /api/auth/logout`. Он специально не JWT: сессия хранит
признак «апсейл в этой сессии уже показывали», а его нельзя держать в
подписанном клиентом токене.

Дальше в примерах используется переменная окружения `T`:

```bash
T=$(curl -s -X POST http://localhost:8080/api/auth/login \
      -H 'Content-Type: application/json' \
      -d '{"nickname":"demo","password":"demo"}' | jq -r .token)
```

В PowerShell:

```powershell
$T = (Invoke-RestMethod -Method Post -Uri http://localhost:8080/api/auth/login `
        -ContentType 'application/json' `
        -Body '{"nickname":"demo","password":"demo"}').token
```

## Формат ошибок

Все ошибки имеют одинаковое тело, а клиент различает ситуации по полю `error`,
а не по тексту сообщения:

```json
{
  "error": "insufficient_balance",
  "message": "Не хватает бонусов",
  "details": ["Требуется 500, доступно 120"]
}
```

| HTTP | `error` | Ситуация |
|---|---|---|
| 400 | `bad_request` | не передан `betOptionId`, билетов меньше одного и т. п. |
| 401 | `unauthorized` | токен не передан или истёк |
| 401 | `authentication_failed` | неверный логин или пароль |
| 404 | — | раунд не найден или принадлежит другому игроку |
| 409 | `insufficient_balance` | бонусов не хватает на выбранный вариант ставки |
| 409 | `round_rejected` | cashout до первого уровня, повторный cashout, уже завершённый раунд |
| 409 | `conflict` | нарушение состояния (например, покупка билетов сверх лимита) |
| 202 | `round_in_flight` | результат запрошен до краха шара |
| 422 | `config_rejected` | конфигурация не прошла валидацию; `details` — список причин |
| 500 | `internal_error` | непредвиденная ошибка, пишется в лог с трассировкой |

Код 202 на `GET /api/rounds/{id}/result` — не ошибка, а осознанный ответ
«ещё рано»: постановка требует, чтобы экран результата открывался только
после краха, и API повторяет это правило.

Здесь есть ловушка при проверке вручную: 202 относится к успешным кодам, и
`curl --fail`, `Invoke-WebRequest` или `response.ok` не считают его ошибкой —
вернётся тело с `error: "round_in_flight"` вместо результата. Различать нужно
именно код: 200 — результат готов, 202 — шар ещё летит. Клиент игры так и
делает (`client.ts`, обработка `status === 202`).

## 1. Аккаунт

| Метод | Назначение |
|---|---|
| `POST /api/auth/login` | вход, выдача токена |
| `POST /api/auth/register` | новый игрок со стартовым балансом `session.demoBonusBalance` |
| `GET /api/auth/me` | текущий игрок: баланс, очки, билеты, позиция в турнире |
| `POST /api/auth/logout` | завершение сессии |
| `POST /api/auth/top-up` | пополнение демонстрационного баланса (по умолчанию 2000) |

```bash
curl -s http://localhost:8080/api/auth/me -H "Authorization: Bearer $T"
```

```json
{
  "id": 1,
  "nickname": "demo",
  "bonusBalance": 5000,
  "gamePoints": 0,
  "lotteryTickets": 0,
  "roundsPlayed": 0,
  "onboardingSeen": false,
  "tournamentPosition": 14,
  "collectionLevel": 0
}
```

Три величины в этом ответе — три разные сущности, и их роли не пересекаются
(подробно — в [MATH_MODEL.md](MATH_MODEL.md#три-валюты-и-их-роли)):
`bonusBalance` тратится на ставку и возвращается выигрышем, `gamePoints`
накапливаются безвозвратно и определяют место в турнире, `lotteryTickets` —
внешняя ценность, ради которой игрок сюда пришёл.

Чтобы воспроизвести сценарий «не хватает бонусов», баланс можно обнулить
обычной игрой либо сразу запросить пополнение на маленькую сумму после
нескольких ставок — метод `top-up` добавляет, а не заменяет.

## 2. Игра

| Метод | Назначение |
|---|---|
| `GET /api/game/setup` | всё, что нужно интерфейсу: темы, уровни, варианты ставки, правила очков |
| `GET /api/game/history?limit=20` | общая история завершённых раундов **всех** игроков |
| `GET /api/game/history/my?limit=20` | история текущего игрока |

`GET /api/game/setup` — единственный источник правды для интерфейса: в нём нет
ни одного зашитого в код числа, поэтому правка YAML сразу меняет и подписи, и
правила, и подсветку уровней.

```bash
curl -s http://localhost:8080/api/game/setup -H "Authorization: Bearer $T" | jq '.themes[0]'
```

```json
{
  "key": "green",
  "gameId": "balloon-green",
  "gameName": "Зелёный шар",
  "active": true,
  "levelCount": 9,
  "levelMultipliers": [1.2, 1.5, 1.9, 2.4, 3.0, 3.8, 4.8, 6.0, 7.5],
  "boostLevelChances": [0.03, 0.07, 0.12, 0.16, 0.18, 0.16, 0.13, 0.09, 0.06],
  "betOptions": [
    { "id": 1, "cost": 50,  "boostTier": 1, "boostValue": 1.0, "affordable": true },
    { "id": 2, "cost": 120, "boostTier": 2, "boostValue": 2.0, "affordable": true },
    { "id": 3, "cost": 250, "boostTier": 3, "boostValue": 3.0, "affordable": true },
    { "id": 4, "cost": 500, "boostTier": 4, "boostValue": 4.0, "affordable": true }
  ],
  "points": { "perLine": 10, "cashoutBonus": 25, "boostBonusPerTier": [0, 40, 80, 140] },
  "growthRate": 0.17,
  "maxMultiplier": 60.0,
  "delta": 0.01,
  "fps": 30
}
```

Поле `affordable` считается на сервере от текущего баланса — интерфейс не решает
сам, какой вариант заблокировать, он лишь отображает решение сервера.

`boostLevelChances` — нормированное распределение вероятностей положения
бустера, одинаковое во всех раундах темы. Оно раскрывается заранее и описано в
правилах, потому что это свойство темы, а не конкретного раунда. Позиция
бустера в текущем раунде не раскрывается до её срабатывания — см.
[почему](MATH_MODEL.md#почему-позиция-бустера-скрыта).

История приходит уже готовой к отрисовке, включая признак `mine`:

```bash
curl -s 'http://localhost:8080/api/game/history?limit=3' -H "Authorization: Bearer $T"
```

```json
[
  {
    "roundId": 412, "nickname": "Аэронавт", "theme": "red", "betAmount": 250,
    "cashoutMultiplier": 3.87, "crashMultiplier": 5.12, "payout": 967,
    "won": true, "levelsPassed": 7, "boostTier": 3, "boostApplied": true,
    "points": 135, "finishedAt": "2026-09-11T10:14:02.418Z", "mine": false
  }
]
```

## 3. Раунд

| Метод | Назначение |
|---|---|
| `POST /api/rounds` | начать раунд: списать ставку, определить исход до полёта |
| `GET /api/rounds/active` | вернуться в незавершённый полёт после перезагрузки (204, если полёта нет) |
| `GET /api/rounds/{id}/state` | авторитетное состояние — резервный канал вместо WebSocket |
| `POST /api/rounds/{id}/cashout` | забрать выигрыш |
| `GET /api/rounds/{id}/result` | результат раунда (только после краха) |

### Начало раунда

```bash
curl -s -X POST http://localhost:8080/api/rounds \
  -H "Authorization: Bearer $T" -H 'Content-Type: application/json' \
  -d '{"theme":"green","betOptionId":2,"clientSeed":"мой-текст"}'
```

```json
{
  "roundId": 413,
  "theme": "green",
  "betAmount": 120,
  "boostTier": 2,
  "boostValue": 2.0,
  "boostLevelChances": [0.03, 0.07, 0.12, 0.16, 0.18, 0.16, 0.13, 0.09, 0.06],
  "levelCount": 9,
  "levelMultipliers": [1.2, 1.5, 1.9, 2.4, 3.0, 3.8, 4.8, 6.0, 7.5],
  "growthRate": 0.17,
  "delta": 0.01,
  "maxMultiplier": 60.0,
  "cashoutUnlockMultiplier": 1.2,
  "startedAtMillis": 1773223442110,
  "serverTimeMillis": 1773223442115,
  "serverSeedHash": "9f2c…",
  "clientSeed": "мой-текст",
  "nonce": 413,
  "balance": 4880,
  "showOnboarding": true,
  "points": { "perLine": 10, "cashoutBonus": 25, "boostBonusPerTier": [0, 40, 80, 140] }
}
```

Чего в ответе нет и не может быть: точки краха, потенциального максимума и
уровня бустера. Есть `serverSeedHash` — обязательство, по которому после раунда
проверяется, что исход был зафиксирован до первого кадра анимации.

`clientSeed` необязателен. Если его передать, он входит в вывод случайных
величин, и игрок может доказать, что раунд не подбирали под него.

Пара `startedAtMillis` + `serverTimeMillis` — то, что позволяет клиенту рисовать
60 кадров в секунду, не спрашивая сервер на каждом кадре: он один раз вычисляет
поправку к своим часам и считает `m(t) = exp(growthRate · t)` той же формулой,
что и сервер.

### Состояние полёта

```bash
curl -s http://localhost:8080/api/rounds/413/state -H "Authorization: Bearer $T"
```

```json
{
  "roundId": 413, "status": "FLYING", "theme": "green", "betAmount": 120,
  "baseMultiplier": 2.31, "multiplier": 2.31,
  "levelsPassed": 4, "levelCount": 9,
  "boostLevel": null,
  "boostLevelChances": [0.03, 0.07, 0.12, 0.16, 0.18, 0.16, 0.13, 0.09, 0.06],
  "boostTier": 2, "boostValue": 2.0, "boostApplied": false,
  "cashoutMultiplier": null, "payout": 0, "points": 40,
  "elapsedSeconds": 4.92, "serverTimeMillis": 1773223447035,
  "startedAtMillis": 1773223442110,
  "growthRate": 0.17, "delta": 0.01, "maxMultiplier": 60.0,
  "levelMultipliers": [1.2, 1.5, 1.9, 2.4, 3.0, 3.8, 4.8, 6.0, 7.5]
}
```

`boostLevel` равен `null`, пока бустер не сработал; после срабатывания в нём
появляется номер уровня, а `multiplier` становится больше `baseMultiplier` в
`boostValue` раз. Опроса этого метода раз в секунду достаточно для полноценной
игры — WebSocket только убирает задержку.

Поля намеренно не исчезают из ответа, когда равны `null`: контракт должен быть
самодостаточным, чтобы по одному ответу было видно, какие поля вообще бывают.

### Забрать выигрыш

```bash
curl -s -X POST http://localhost:8080/api/rounds/413/cashout -H "Authorization: Bearer $T"
```

```json
{
  "roundId": 413,
  "multiplier": 2.31,
  "payout": 277,
  "balance": 5157,
  "pointsAwarded": 25,
  "totalPoints": 65,
  "message": "Выигрыш зафиксирован"
}
```

Коэффициент берётся из серверного времени на момент обработки запроса, а не из
тела запроса — клиент физически не может назвать свой коэффициент. До
прохождения первого уровня метод отвечает `409 round_rejected`: кнопка в
интерфейсе в этот момент видна, но выключена, и сервер держит то же правило.

После фиксации шар продолжает лететь, но сумма больше не меняется. Если он
долетел дальше — в результате будет `Могли бы забрать больше`.

### Результат

```bash
curl -s http://localhost:8080/api/rounds/413/result -H "Authorization: Bearer $T"
```

```json
{
  "roundId": 413, "status": "WON", "won": true, "theme": "green",
  "betAmount": 120, "payout": 277, "netResult": 157,
  "cashoutMultiplier": 2.31, "crashMultiplier": 6.84,
  "potentialMaxMultiplier": 6.84,
  "levelsPassed": 4, "levelCount": 9,
  "boostLevel": 7, "boostTier": 2, "boostValue": 2.0, "boostApplied": false,
  "points": { "total": 65, "fromLevels": 40, "fromCashout": 25, "fromBoost": 0, "fromReward": 0 },
  "reward": {
    "enabled": true, "collectionName": "Карта неба", "collectionLevel": 0,
    "fragmentIndex": 3, "duplicate": false, "collectionCompleted": false,
    "pointsAwarded": 0, "bonusAwarded": 0, "ownedAfter": 4, "collectionSize": 6
  },
  "fairness": {
    "serverSeed": "b71e…", "serverSeedHash": "9f2c…", "clientSeed": "мой-текст",
    "nonce": 413, "alpha": 1.43, "houseEdge": 0.04,
    "minCrashMultiplier": 1.01, "maxMultiplier": 60.0,
    "verifyUrl": "/api/fairness/verify?roundId=413"
  },
  "balance": 5157, "gamePoints": 65, "tournamentPosition": 11,
  "upsell": { "available": true, "tickets": 4, "price": 100, "minWinAmount": 50,
              "popupTimeoutSeconds": 10, "reason": null },
  "startedAt": "2026-09-11T10:14:02.110Z",
  "finishedAt": "2026-09-11T10:14:14.980Z"
}
```

Здесь и только здесь раскрываются `crashMultiplier`, `boostLevel` и
`serverSeed` — раунд уже окончен, раскрытие ничего не даёт. `alpha` в разделе
`fairness` — эффективная альфа этого раунда (с учётом `alphaShift` варианта
ставки), то есть ровно то число, которое нужно для самостоятельного пересчёта.

При крахе без фиксации `won: false`, `payout: 0`, `cashoutMultiplier: null`, но
блок `points` всё равно ненулевой: игровые очки за пройденные уровни и награда
за фрагмент коллекции начисляются в любом случае. Это обязательное требование
постановки, и его хорошо видно прямо в ответе API.

## 4. Турнир

| Метод | Назначение |
|---|---|
| `GET /api/tournament/live` | срез для строки живого рейтинга над игровым экраном |
| `GET /api/tournament` | полная таблица: топ-3, остальные, текущий игрок отдельным полем |

```bash
curl -s http://localhost:8080/api/tournament -H "Authorization: Bearer $T" | jq '.header, .top'
```

```json
{
  "enabled": true, "active": true, "name": "Небесный кубок",
  "endsAt": "2026-10-01T09:00:00Z", "secondsLeft": 1723158, "participants": 25
}
[
  { "userId": 7,  "displayName": "***рей", "points": 1840, "position": 1, "bot": true,  "current": false },
  { "userId": 12, "displayName": "***ина", "points": 1655, "position": 2, "bot": true,  "current": false },
  { "userId": 1,  "displayName": "demo",   "points": 1502, "position": 3, "bot": false, "current": true }
]
```

Топ-3 и остальные приходят готовыми списками, а текущий игрок дублируется в
поле `current` — интерфейсу не нужно искать его в массиве, чтобы закрепить
внизу. Маскирование чужих имён делает сервер, если включён
`tournament.anonymizeNames`; своё имя не маскируется никогда.

## 5. Апсейл

| Метод | Назначение |
|---|---|
| `POST /api/upsell/purchase` | купить лотерейные билеты за бонусные баллы |

```bash
curl -s -X POST http://localhost:8080/api/upsell/purchase \
  -H "Authorization: Bearer $T" -H 'Content-Type: application/json' \
  -d '{"tickets":2}'
```

```json
{ "tickets": 2, "price": 50, "balance": 5107, "totalTickets": 2 }
```

`price` — стоимость всего предложения, а не одного билета.

Само предложение приходит в результате раунда (`upsell`), а не отдельным
методом: оно зависит от суммы выигрыша и от того, показывали ли его уже в этой
сессии. Если предложение недоступно, `available: false` и в `reason` лежит
причина — её удобно смотреть при проверке дополнительного сценария.

## 6. Честность

| Метод | Назначение |
|---|---|
| `GET /api/fairness/verify?roundId=413` | пересчитать исход завершённого раунда из раскрытого зерна |

```bash
curl -s 'http://localhost:8080/api/fairness/verify?roundId=413'
```

```json
{
  "matches": true,
  "expectedCrashMultiplier": 6.84, "storedCrashMultiplier": 6.84,
  "expectedBoostLevel": 7, "storedBoostLevel": 7,
  "algorithm": "crash = quantize(pow((u - edge)/(1 - edge), -1/alpha)), u = HMAC-SHA256(serverSeed, \"crash:\" + clientSeed + \":\" + nonce) / 2^53"
}
```

Метод не требует авторизации: проверять честность должно быть можно и не имея
доступа к аккаунту. Хеш обязательства проверяется независимо от сервера —
`SHA-256(serverSeed)` должен совпасть с `serverSeedHash`, который клиент получил
до полёта:

```bash
printf '%s' "$SERVER_SEED" | sha256sum
```

## 7. Администрирование

| Метод | Назначение |
|---|---|
| `GET /api/admin/config` | текущая конфигурация целиком |
| `GET /api/admin/config/status` | путь к файлу, ревизия, время применения, ошибки последней отклонённой версии |
| `POST /api/admin/config/validate` | проверить черновик, ничего не сохраняя |
| `PUT /api/admin/config` | сохранить в YAML и применить к новым раундам |
| `POST /api/admin/config/reset` | вернуть заводские значения |
| `POST /api/admin/simulate` | Monte-Carlo симуляция экономики |
| `GET /api/admin/stats` | активные раунды, размеры таблиц, состояние симуляции соперников |

Ровно эти методы вызывает админка по адресу `/#admin`. Тот же результат даёт
правка `config/game-config.yaml` руками — оба пути равнозначны, потому что
админка пишет в этот же файл. Порядок применения и полный справочник
параметров — в [CONFIGURATION.md](CONFIGURATION.md).

```bash
curl -s http://localhost:8080/api/admin/config/status -H "Authorization: Bearer $T"
```

```json
{
  "path": "/app/config/game-config.yaml",
  "writable": true,
  "loadedAt": "2026-09-11T10:02:11.402Z",
  "appliedRevisions": 3,
  "valid": true,
  "errors": [],
  "lastErrorAt": null
}
```

`valid: false` означает, что на диске лежит некорректная версия, а в игре
работает предыдущая рабочая — сервер не падает из-за опечатки в YAML и говорит
в `errors`, что именно не так.

Симуляция принимает черновик конфигурации, поэтому последствия правки видно до
сохранения:

```bash
curl -s -X POST http://localhost:8080/api/admin/simulate \
  -H "Authorization: Bearer $T" -H 'Content-Type: application/json' \
  -d '{"theme":"green","strategy":"LEVEL","targetLevel":5,"rounds":200000,"seed":42}'
```

```json
{
  "theme": "green", "themeName": "Зелёный шар", "strategy": "LEVEL",
  "roundsPerOption": 200000, "seed": 42,
  "alpha": 1.0, "houseEdge": 0.04, "theoreticalMedianCrash": 1.92,
  "options": [
    {
      "optionId": 1, "cost": 50, "boostTier": 1, "boostValue": 1.0,
      "effectiveAlpha": 1.0, "alphaShift": 0.0,
      "empiricalRtp": 0.9591, "theoreticalRtp": 0.96,
      "winRate": 0.3543, "boostActivationRate": 0.0,
      "averageCashoutMultiplier": 2.7, "averageCrashMultiplier": 4.83,
      "medianCrashMultiplier": 1.92, "averagePointsPerRound": 61.4
    },
    {
      "optionId": 2, "cost": 120, "boostTier": 2, "boostValue": 2.0,
      "effectiveAlpha": 1.43, "alphaShift": 0.43,
      "empiricalRtp": 0.9376, "theoreticalRtp": 0.6842,
      "winRate": 0.2812, "boostActivationRate": 0.2153,
      "averageCashoutMultiplier": 3.12, "averageCrashMultiplier": 3.94,
      "medianCrashMultiplier": 1.56, "averagePointsPerRound": 74.9
    }
  ]
}
```

`theoreticalRtp` в отчёте посчитан **без** бустера — это RTP базовой
степенной части. Сравнение его с `empiricalRtp` показывает, сколько именно
добавляет бустер, и это как раз то, что калибруется через `alphaShift`.

Доступные `strategy`: `TARGET_MULTIPLIER`, `LEVEL`, `HOLD_TO_CRASH` и
`WAIT_FOR_BOOST`. Последняя — диагностический «оракул»: она знает позицию
бустера, которую живой игрок не видит, и служит верхней оценкой, а не
достижимым результатом. Подробнее — в
[MATH_MODEL.md](MATH_MODEL.md#симулятор).

Упрощение прототипа: отдельной роли администратора нет, достаточно действующей
игровой сессии. Ограничение зафиксировано в
[FEATURES.md](FEATURES.md#ограничения).

## WebSocket

```
ws://localhost:8080/ws/game?token=<token>
```

Через прокси интерфейса — `ws://localhost:8080/ws/game?token=…` (тот же адрес:
nginx проксирует `/ws/` на бэкенд с заголовками апгрейда).

Каждое сообщение — JSON-объект с полем `type`. Клиент отправляет что угодно и
получает `pong` — это проверка живости, никаких игровых команд через сокет нет:
ставка и cashout идут только через REST, где есть транзакции и авторитетная
проверка.

| `type` | Когда приходит | Содержимое |
|---|---|---|
| `connected` | сразу после подключения | `userId`, `nickname`, `serverTimeMillis` |
| `pong` | в ответ на любое сообщение клиента | `serverTimeMillis` |
| `round.tick` | каждый кадр игрового цикла | `multiplier`, `baseMultiplier`, `levelsPassed`, `boostApplied`, `points`, `elapsedSeconds`, `livePoints`, `serverTimeMillis` |
| `round.level` | пройден уровень | `level`, `levelCount`, `pointsAwarded`, `totalPoints`, `livePoints` |
| `round.boost` | сработал бустер | `level`, `boostValue`, `multiplier`, `pointsAwarded`, `totalPoints`, `livePoints` |
| `round.cashout` | выигрыш зафиксирован | `multiplier`, `payout`, `balance`, `totalPoints` |
| `round.crash` | шар лопнул | `crashMultiplier`, `won` |
| `round.settled` | результат записан в базу | `roundId` — сигнал, что можно запрашивать результат |
| `history.updated` | завершился чей-то раунд | `roundId`; повод перечитать общую историю |
| `rating.updated` | изменились очки участников | `entries[]` с `position` |
| `config.updated` | применена новая конфигурация | `revision`, `source` |

Потоковые сообщения (`round.tick`, `rating.updated`) «склеиваются»: если клиент
не успевает читать, он получит последнее состояние, а не отставшую очередь из
сотни кадров. События уровней, бустера, cashout и краха идут в надёжной очереди
и не теряются — на них построены анимации и звук.

Быстрая проверка из консоли браузера:

```js
const ws = new WebSocket(`ws://localhost:8080/ws/game?token=${token}`);
ws.onmessage = (e) => console.log(JSON.parse(e.data));
```

Если сокет недоступен, интерфейс сам переходит на опрос
`GET /api/rounds/{id}/state` и `GET /api/tournament/live`; индикатор связи в
верхней строке показывает, какой канал активен. Проверить это можно, заблокировав
WebSocket в инструментах разработчика — игра продолжит работать.

## Сквозной сценарий одной командой

Полный раунд с фиксацией выигрыша и проверкой честности:

```bash
BASE=http://localhost:8080

T=$(curl -s -X POST $BASE/api/auth/login -H 'Content-Type: application/json' \
      -d '{"nickname":"demo","password":"demo"}' | jq -r .token)
AUTH="Authorization: Bearer $T"

R=$(curl -s -X POST $BASE/api/rounds -H "$AUTH" -H 'Content-Type: application/json' \
      -d '{"theme":"green","betOptionId":2}')
ID=$(echo "$R" | jq -r .roundId)

sleep 4
curl -s $BASE/api/rounds/$ID/state -H "$AUTH" | jq '{multiplier, levelsPassed, boostLevel}'
curl -s -X POST $BASE/api/rounds/$ID/cashout -H "$AUTH" | jq '{multiplier, payout}'

# результат доступен только после краха — ждём его
until curl -s -o /dev/null -w '%{http_code}' $BASE/api/rounds/$ID/result -H "$AUTH" | grep -q 200; do
  sleep 1
done
curl -s $BASE/api/rounds/$ID/result -H "$AUTH" | jq '{won, payout, crashMultiplier, points}'
curl -s "$BASE/api/fairness/verify?roundId=$ID" | jq .matches
```

Последняя строка должна напечатать `true`.

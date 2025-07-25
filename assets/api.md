---
title: 11. WebSocket API
section: 11
---

# WebSocket API <Anchor :ids="['api']" />
<style scoped>
table {
  font-size: 13px;
}
summary {
padding:5px 0px 5px 0px;
}
</style>

## Общие положения <Anchor :ids="['api.general']" />

WebSocket API позволяет получить те же данные, которые доступны пользователю на сайте, в соответствии с ролью, указанной при авторизации.

### Куда подключаться <Anchor :ids="['api.url']" />

Адрес подключения к API `wss://bot.fkviking.com/ws`.

### Протокол подключения <Anchor :ids="['api.protocol']" />

В качестве транспортного уровня API использует WebSocket протокол. Этот протокол предполагает создание постоянного соединения. Поверх WebSocket протокола могут отправляться как запросы, предполагающие один ответ, так и подписки, предполагающие первоначальный ответ в виде снапшота данных и последующую отправку обновлений с сервера клиенту в случае изменений в данных, на которые была выполнена подписка.

В соответствии с описанным выше настоятельно рекомендуется устанавливать соединение на время работы Вашего приложения и дальше поддерживать открытую сессию (накладные расходы на поддержание соединения на стороне клиента минимальны). Использование протокола как аналога http-запросов в формате: установил соединение, отправил запрос, получил ответ, закрыл связь - настоятельно не рекомендуется. Мы оставляем за собой право на введение ограничений на количество новых соединений, открываемых в единицу времени.

### Механизм поддержания связи с сервером <Anchor :ids="['api.session']" />

Клиентская сессия длится не более 12-ти часов, любое клиентское соединение будет закрыто не позже, чем через 12 часов после того, как было установлено. Для продолжения работы соединение необходимо установить заново.

Если клиент не отправляет сообщения в течение 5-ти секунд, соединение будет закрыто сервером.

Для поддержания связи с сервером и для определения статуса соеденения с сервером в случае отсутствия исходящих сообщений от клиента в течение 5-ти секунд предполагается отправлять служебное сообщение в виде строки, состоящей из
одного символа `7`, в ответ сервер пришлет ту же строку. Если сервер не пришлет данную строку в течение 3-ех секунд, клиент должен переподключиться. Вместо строки с символом `7` клиент может отправлять ping фрейм, тогда в ответ
сервер ответит pong фреймом.

### Размер входящих и исходящих сообщений, группировка и сжатие сообщений <Anchor :ids="['api.zip']" />

Максимальный размер сообщения, отправляемого клиентом, должен быть меньше 1048576 байт.

Размер сообщений, отправляемых сервером, до их сжатия обычно не превосходит 200 КБ (если это одно сообщение, и его размер больше, то он больше и останется, а при группировке сообщений размер группы всегда не превосходит указанного лимита).
Если размер сообщения, отправлемого сервером, до его сжатия превышает 100 Б, сообщение будет заархивировано и отправлено не как текстовое, а
уже как бинарное сообщение. Сжатие сообщений производится при помощи библиотеки `zlib` c параметром `wbits = 15`.

Клиент, так же как и сервер, может сжимать свои исходящие сообщения тем же методом, что и сервер.

Для уменьшения числа отправляемых сервером отдельных сообщений предусмотрен механизм группировки сообщений. В данном случае все отдельные `JSON` сообщения, представляющие собой словари (т.е. все сообщения кроме pong фреймов и `7`),
будут сложены в список и отправлены одним большим `JSON` сообщением. Клиент, получивший список от сервера, должен обработать каждое сообщение списка в отдельности. Возможность получения групп сообщений и таймаут для группировки
задаются клиентом на этапе авторизации. Если сервер отправляет сообщения группой большого размера, то сервер сожмет всю группу, а не каждое отдельное сообщение в группе. Группировка сообщений подразумевает складывание сообщений
в очередь перед отправкой и отправку сразу всех сообщений из очереди после истечения заданного таймаута (сообщения могут быть отправлены и не дожидаясь истечения таймаута если очередь уже достигла "большого" размера или если
необходимо отправить `7`)

Клиент, так же как и сервер, может группировать свои исходящие сообщения в списки (кроме ping фрейма и `7`), список это всего лишь обертка, сервер обработает каждое сообщение из списка в отдельности. Группировка сообщений помогает
увеличить число отправлемых клиентом сообщений, чтобы не попасть на rate limit. Максимальный размер группы, которую может отправить клиент, состоит из 50-ти сообщений, при превышении данного значения соединение с клиентом будет закрыто.
Если клиент отправляет сообщения группой большого размера, то рекомендуется эту группу сжать, сжимать нужно именно группу, а не каждое отдельное сообщение в группе.

Настоятельно рекомендуется отправлять на сервер только те параметры, значения которых были изменены, для этого на клиенте следует предусмотреть механизм сравнения новых значений отправляемых параметров с их предыдущими значениями. 

### Rate limits <Anchor :ids="['api.rate_limits']" />

Rate limit считается для каждой вебсокет сессии в отдельности. Каждое сообщение имеет свой вес (в неких пунктах), вы можете отправить сообщения суммарным весом не более 10000 пунктов за последние 10 секунд. Суммарный доступный вес сообщений
пересчитывается каждую секунду (отбрасывается суммарный набранный вес за самую старую секунду из десяти). Сообщения имеют разный вес, ping фрейм и `7` имеют вес 1 пункт, все остальные сообщения имеют вес 49 пунктов, группа сообщений (т.е.
сообщения упакованные в один список) имеет вес 49 пунктов. Т.о. за 10 секунд клиент может отправить примерно $10000 \div 49 = 204$ сообщений, можно все сообщения отправить и за одну секунду, но тогда в следующие 9 секунд слать будет нечего и
связь будет закрыта либо по таймауту (он был описан выше и равен 5 секунд), либо, если клиент таки отправит сообщение, то по rate limit-у. При превышении rate limit-а связь закрывается автоматически, текст причины закрытия будет отправлен в
`payload` close фрейма.

<Anchor hide :ids="['conn_rate_limit']"/>
С одного ip-адреса разрешается не более 10-ти попыток подключения в течение минуты и не более 200-т попыток подключения в течение часа, при превышении данных значений соединение перестанет устанавливаться, в ответ будет отправлен код ошибки 429.

### Частота отправки обновлений <Anchor :ids="['api.updates_rate']" />

Обновления по каждой отдельной подписке отправляются не чаще чем раз в 300 мс, т.е. в течение 300 мс происходящие обновления группируются, после чего происходит проверка, если обновления за этот период времени были, то они отправляются. В общем случае подписки не связаны друг с другом, можно считать, что отсчёт 300 мс ведется отдельно по каждой подписке.

### Дробные количества и позиции <Anchor :ids="['api.lot_size']" />

Везде в роботе количества в заявках/сделках и в позициях - это целые числа, сделано это для того, чтобы не иметь проблем с операциями над вещественными числами. В API количества и позиции тоже целые числа, по той же причине. Для красивого отображения количеств и
позиций в той же размерности, в которой они отображаются на сайтах бирж (для тех бирж где возможны дробные значения в данных полях), в тех объектах, которых касается описанная выше проблема, есть поле `lot_size` или `ls`. При отображении количества и
позиции необходимо полученное с API значение умножить на `lot_size`. Если же необходимо отправить дробное количество или позицию в робота, то перед отправкой отправляемое значение нужно разделить на `lot_size`.
Для параметров портфеля и бумаг портфеля, которых касается `lot_size`, есть соответствующие пометки в описании этих параметров

### Прочее <Anchor :ids="['api.other']" />

Все значения текстовых полей `JSON` сообщения должны быть валидными `UTF-8` строками. Все лимиты длин текстовых полей `JSON` сообщения указаны в данной документации и в шаблонах в байтах

Во всех подписках в рамках одной вебсокет сессии в рамках одного и того же `type` требуется уникальный `eid` для текущих подписок (можно отписаться и снова подписаться с тем же `eid`, но одновременно нельзя иметь две и более подписок
на одни и те же `type` и `eid`)

Порядок ответа на входящие сообщения сервером не определен. Чтобы быть уверенным, что сообщения будут обработаны в заданном порядке, необходимо слать следующее сообщение только после получения ответа на предыдущее. В связи с этим
рекомендуется вначале дождаться ответа на запрос авторизации и только потом слать серверу какие-либо другие команды (иначе получите ошибку `Not authorized`)

Если сообщение, отправленное пользователем, не удовлетворяет общему формату входящих сообщений (т.е. не является валидным `JSON` сообщением или не содержит всех, обязательных для сообщения, полей), соединение будет автоматически закрыто,
текст причины закрытия будет отправлен в `payload` close фрейма

На один API ключ можно открыть не более 16-ти одновременных подключений

Примеры ответов на запросы по API - это всего лишь примеры, обязательные поля всегда будут соответствовать документации, но необязательные поля в примерах могут отличаться от реальных полей

## Авторизация <Anchor :ids="['api.authorization']" />

На один API ключ можно открыть не более 16-ти одновременных подключений

<details>
<summary>Request</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = authorization_key | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| data | y | object |  |  |
| > email | y | string |  | User email |
| > key | y | string |  | User API key (API usage should be enabled) |
| > role | n | string | user_role | User role, default value is demo |
| > group | n | number |  | Receive messages from server in groups with group timeout, default value is 0 (no grouping), available values are in range [0, 2] with step 0.1 |
| > compress | n | boolean |  | Compress large size messages by server, default value is true. *It is strongly recommended to turn off compression only for debugging purposes!* |

Example:

```json
{
	"type":"authorization_key",
	"data":
	{
		"email":"qwd@gmail.com",
		"key":"asdcccccccccccccccc",
		"role":"demo",
		"group":0.51,
		"compress":true
	},
	"eid":"qwe"
}
```
</details>    
<details>

<summary>Response on success</summary> 

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = authorization_key | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = p | y | string | request_result | Request result |
| data | y | object |  |  |
| > e | y | string |  | User email |
| > lang | y | string | language | User lang, always `en` |
| > active_role | y | string | user_role | current user role |
| > roles | y | array | user_role | Array of available user roles |
| >> [] | y | string | user_role | Available user role |
| > can_hide_notifs | y | boolean |  | User can hide notifications "gnerated" by another user |
| > just_registered | n | boolean |  | User was just registered |

Example:

```json
{
	"type":"authorization_key",
	"data":
	{
		"e":"test@test.com",
		"lang":"en",
		"active_role":"trader",
		"roles":["demo", "trader"]
	},
	"r":"p",
	"eid":"qwerty",
	"ts":1669793958010491759
}
```
</details>    
   
<details>
<summary>Response on error</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = authorization_key | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = e | y | string | request_result | Request result |
| data | y | object |  |  |
| > msg | y | string |  | Error message |
| > code | y | number | err_code | Error code |

Example:

```json
{
	"type":"authorization_key",
	"data":
	{
		"msg":"User not found",
		"code":8
	},
	"ts":1657693572940145200,
	"eid":"qwerty",
	"r":"e"
}
```
</details>


## Портфели

Конкретные поля портфелей НЕ описаны в данном API, т.к. НЕ являются его частью. Описаны только обязательные (ключевые) поля,
т.к. без них просто не получится отправить запрос и однозначно идентифицировать необходимый портфель или его бумагу. Для того
чтобы узнать набор полей конкретного портфеля, типы этих полей и допустимые диапазоны значений, необходимо [получить идентификатор
шаблона данного портфеля](#get_template_id), а затем [сам шаблон](#get_template_by_id). Шаблоны "ни с того ни с сего" НЕ меняются
и по возможности сохраняют обратную совместимость. Кроме того, как вариант, вы можете "подсмотреть" названия полей портфеля в
API Tester в браузере на [сайте](https://bot.fkviking.com), сайт пользуется этим же API

### Подписка на список доступных портфелей <Anchor :ids="['подписка-на-список-доступных-портфелей']" />

При добавлении/удалении портфеля/доступа к портфелю будут высланы обновления

В любой момент может быть выслан снапшот

При отзыве доступа к портфелю, если вы подписаны на этот портфель, вы получите сообщение об отписке

<details>
<summary>Subscription request</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = available_portfolio_list.subscribe | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| data | n | object |  |  |

Example:

```json
{
	"type": "available_portfolio_list.subscribe",
	"data": {},
	"eid": "qwerty"
}
```
</details>    
<details>

<summary>Response on success (snapshot)</summary> 

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = available_portfolio_list.subscribe | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = s | y | string | request_result | Request result |
| data | y | object |  |  |
| > portfolios_add | y | array |  | Array of available portfolios |
| >> [] | y | [string, string, string] | portfolio_id | Portfolio ID (robot ID and portfolio name) and portfolio owner (creator)|
|  |  |  |  |  |

Example:

```json
{
	"type":"available_portfolio_list.subscribe",
	"data":
	{
		"portfolios_add":
		[
			["1","test","test@mail.ru"],
			["1","test1","test@mail.ru"],
			["1","test2","test@mail.ru"],
			["1","test3","test@mail.ru"]
		]
	},
	"r":"s",
	"eid":"qwerty",
	"ts":1669793958010491759
}
```
</details>    
<details>
<summary>Updates</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = available_portfolio_list.subscribe | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = u | y | string | request_result | Request result |
| data | y | object |  |  |
| > portfolios_add | n | array |  | Array of newly available portfolios |
| >> [] |  | [string, string, string] | portfolio_id | Portfolio ID (robot ID and portfolio name) and portfolio owner (creator)|
| > portfolios_del | n | array |  | Array of portfolios with revoked access |
| >> [] |  | [string, string, string] | portfolio_id | Portfolio ID (robot ID and portfolio name) and portfolio owner (creator)|

Example:

```json
{
	"type":"available_portfolio_list.subscribe",
	"data":
	{
		"portfolios_del":
		[
			["1","test","test@mail.ru"]
		]
	},
	"r":"u",
	"eid":"qwerty",
	"ts":1669793958010491759
}
```
</details>    
<details>
<summary>Response on error</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = available_portfolio_list.subscribe | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = e | y | string | request_result | Request result |
| data | y | object |  |  |
| > msg | y | string |  | Error message |
| > code | y | number | err_code | Error code |

Example:

```json
{
	"type":"available_portfolio_list.subscribe",
	"data":
	{
		"msg":"Operation timeout",
		"code":666
	},
	"ts":1657693572940145200,
	"eid":"qwerty",
	"r":"e"
}
```
</details>    

### Отписка от списка доступных портфелей

Отписаться от событий по списку доступных портфелей

<details>
<summary>Request</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = available_portfolio_list.unsubscribe | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| data | y | object |  |  |
| > sub_eid | y | string | string_36 | Subscription eid |

Example:

```json
{
	"type":"available_portfolio_list.unsubscribe",
	"data":
	{
		"sub_eid":"qwerty"
	},
	"eid":"q"
}
```
</details>    
<details>
<summary>Response on success</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = available_portfolio_list.unsubscribe | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = p | y | string | request_result | Request result |

Example:

```json
{
	"type":"available_portfolio_list.unsubscribe",
	"data":{},
	"r":"p",
	"eid":"q",
	"ts":1669810178671387651
}
```
</details>    
<details>
<summary>Response on error</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = available_portfolio_list.unsubscribe | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = e | y | string | request_result | Request result |
| data | y | object |  |  |
| > msg | y | string |  | Error message |
| > code | y | number | err_code | Error code |

Example:

```json
{
	"type":"available_portfolio_list.unsubscribe",
	"data":
	{
		"msg":"Operation timeout",
		"code":666
	},
	"ts":1657693572940145200,
	"eid":"q",
	"r":"e"
}
```
</details>    

### Получить список доступных портфелей с включенной записью истории <Anchor :ids="['get-portfolios-history']" />

<details>
<summary>Subscription</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = available_portfolio_list.get_with_history | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| data | n | object |  |  |

Example:

```json
{
	"type": "available_portfolio_list.get_with_history",
	"data": {},
	"eid": "qwerty"
}
```
</details>    
<details>

<summary>Response on success</summary> 

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = available_portfolio_list.get_with_history | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = p | y | string | request_result | Request result |
| data | y | object |  |  |
| > portfolios | y | array |  | Array of available portfolios |
| >> [] | y | [string, string, string] | portfolio_id | Portfolio ID (robot ID and portfolio name) and portfolio owner (creator)|
|  |  |  |  |  |

Example:

```json
{
	"type":"available_portfolio_list.get_with_history",
	"data":
	{
		"portfolios":
		[
			["1","test","test@mail.ru"],
			["1","test1","test@mail.ru"],
			["1","test2","test@mail.ru"],
			["1","test3","test@mail.ru"]
		]
	},
	"r":"p",
	"eid":"qwerty",
	"ts":1669793958010491759
}
```
</details>    
<details>
<summary>Response on error</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = available_portfolio_list.get_with_history | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = e | y | string | request_result | Request result |
| data | y | object |  |  |
| > msg | y | string |  | Error message |
| > code | y | number | err_code | Error code |

Example:

```json
{
	"type":"available_portfolio_list.get_with_history",
	"data":
	{
		"msg":"Operation timeout",
		"code":666
	},
	"ts":1657693572940145200,
	"eid":"qwerty",
	"r":"e"
}
```
</details>   

### Добавить портфель

Добавить портфель в робота

<details>
<summary>Request</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = robot.add_portfolio | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| data | y | object |  |  |
| > r_id | y | string |  | Robot ID |
| > portfolio | y | object |  | Portfolio |
| >> name | y | string |  | Portfolio name |
| >> * | n | * |  | Other portfolio fields from template |
| >> securities | y | object |  | Securities |
| >>> SEC_KEY | y | string: object |  | Security object key |
| >>>> sec_key | y | string |  | Security unique key (should be equal to SEC_KEY) |
| >>>> sec_type | y | number | sec_type | Security exchange/connection type |
| >>>> sec_key_subscr | y | string |  | Security key on the exchange |
| >>>> sec_board | y | string |  | Security board |
| >>>> sec_code | y | string |  | Security code |
| >>>> is_first | y | boolean |  | “Is first” security of the portfolio |
| >>>> * | n | * |  | Other security fields from template |

Example:

```json
{
    "type": "robot.add_portfolio",
    "data": {
        "r_id": "1",
        "portfolio": {
            "k": 0,
            "k1": 0,
            "k2": 0,
            "tp": 1,
            "pos": 0,
            "to0": false,
            "name": "test3",
            "color": "#FFFFFF",
            "delta": 0,
            "lim_b": 0,
            "lim_s": 0,
            "quote": false,
            "timer": 1,
            "v_max": 1,
            "v_min": -1,
            "_buy_v": 10,
            "_pos_v": 1000,
            "opened": 0,
            "re_buy": false,
            "use_tt": false,
            "v_in_l": 1,
            "v_in_r": 1,
            "_buy_en": false,
            "_l_b_en": false,
            "_l_s_en": false,
            "_pos_en": false,
            "_sell_v": 10,
            "comment": "",
            "overlay": 0,
            "percent": 100,
            "re_sell": false,
            "v_out_l": 1,
            "v_out_r": 1,
            "_l_b_val": 10,
            "_l_s_val": 10,
            "_sell_en": false,
            "decimals": 4,
            "disabled": false,
            "_buy_time": 5,
            "_l_b_stop": false,
            "_l_b_time": 10,
            "_l_s_stop": false,
            "_l_s_time": 10,
            "_pos_time": 5,
            "log_level": 0,
            "timetable": [
                {
                    "begin": 36000,
                    "end": 50400,
                    "auto_close": false,
                    "auto_to_market": true,
                    "auto_to0": false
                },
                {
                    "begin": 50580,
                    "end": 67020,
                    "auto_close": false,
                    "auto_to_market": true,
                    "auto_to0": false
                }
            ],
            "_sell_time": 5,
            "mkt_volume": 100,
            "price_type": 0,
            "securities": {
                "OKF_ADA_USDT_SWAP": {
                    "k": 0,
                    "mm": false,
                    "sl": 0,
                    "te": true,
                    "tp": 1,
                    "pos": 0,
                    "sle": false,
                    "k_sl": 0,
                    "count": 1,
                    "maker": false,
                    "ratio": 1,
                    "timer": 60,
                    "on_buy": 1,
                    "sec_key": "OKF_ADA_USDT_SWAP",
                    "decimals": 4,
                    "depth_ob": 1,
                    "is_first": true,
                    "leverage": 1,
                    "ob_c_p_t": 1,
                    "ob_t_p_t": 0,
                    "sec_type": 67108864,
                    "comission": 0,
                    "ban_period": 1,
                    "count_type": 0,
                    "ratio_sign": 0,
                    "ratio_type": 0,
                    "client_code": "virtual",
                    "move_limits": false,
                    "fin_res_mult": 1,
                    "mc_level_to0": 0,
                    "move_limits1": false,
                    "count_formula": "return 1;",
                    "comission_sign": 1,
                    "mc_level_close": 0,
                    "sec_key_subscr": "ADA-USDT-SWAP",
                    "max_trans_musec": 1000000,
                    "ratio_b_formula": "return 1;",
                    "ratio_s_formula": "return 1;",
                    "percent_of_quantity": 100
                }
            },
            "type_trade": 0,
            "_fin_res_en": false,
            "ext_field1_": "return 0;",
            "ext_field2_": "return 0;",
            "first_delta": 0,
            "hedge_after": 1,
            "n_perc_fill": 0,
            "price_check": 10,
            "_fin_res_abs": 1000,
            "_fin_res_val": 10,
            "custom_trade": false,
            "equal_prices": false,
            "ext_formulas": false,
            "simply_first": false,
            "_fin_res_stop": false,
            "_fin_res_time": 60,
            "cur_day_month": 7,
            "portfolio_num": 0,
            "trade_formula": "return 0;",
            "virtual_0_pos": false,
            "max_not_hedged": 1,
            "portfolio_type": 0,
            "_max_running_en": false,
            "_too_much_n_h_en": false,
            "opened_comission": 0,
            "move_limits1_date": -1,
            "always_limits_timer": false,
            "_max_running_percent": 70
        }
    },
    "eid": "qwerty"
}
```
</details>    
<details>
<summary>Response on success</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = robot.add_portfolio | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = p | y | string | request_result | Request result |
| data | y | object |  |  |
| > r_id | y | string |  | Robot ID |
| > p_id | y | string |  | Portfolio name |

Example:

```json
{
	"type":"robot.add_portfolio",
	"data":
	{
		"r_id":"1",
		"p_id":"test3"
	},
	"r":"p",
	"eid":"qwerty",
	"ts":1669806718085368646
}
```
</details>    
<details>
<summary>Response on error</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = robot.add_portfolio | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r=e | y | string | request_result | Request result |
| data | y | object |  |  |
| > msg | y | string |  | Error message |
| > code | y | number | err_code | Error code |

Example:

```json
{
	"type":"robot.add_portfolio",
	"data":
	{
		"msg":"Permission denied",
		"code":555
	},
	"ts":1657693572940145200,
	"eid":"qwerty",
	"r":"e"
}
```
</details>    

### Изменить портфель

Изменить значение/значения полей портфеля/бумаг портфеля

Если указан ключ *securities*, то в нем обязательно необходимо указать весь текущий список бумаг портфеля с их обязательными полями, а также можно указать поля, необходимые для изменения

Значения пользовательских полей `uf0, ..., uf19` являются словарями, можно изменить значение как по одному из ключей, так и сразу по обоим ключам

<details>
<summary>Request</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = portfolio.update | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| data | y | object |  |  |
| > r_id | y | string |  | Robot ID |
| > portfolio | y | object |  | Portfolio |
| >> name | y | string |  | Portfolio name |
| >> * | n | * |  | Other portfolio fields from template |
| >> securities | n | object |  | Securities |
| >>> SEC_KEY | n | string: object |  | Security object key |
| >>>> sec_key | y | string |  | Security unique key (should be equal to SEC_KEY) |
| >>>> sec_type | y | number | sec_type | Security exchange/connection type |
| >>>> sec_key_subscr | y | string |  | Security key on the exchange |
| >>>> sec_board | y | string |  | Security board |
| >>>> sec_code | y | string |  | Security code |
| >>>> is_first | n | boolean |  | “Is first” security of the portfolio |
| >>>> * | n | * |  | Other security fields from template |

Example:

```json
{
    "type": "portfolio.update",
    "data": {
        "r_id": "1",
        "portfolio": {
            "k": 0,
            "k1": 0,
            "k2": 0,
            "tp": 1,
            "pos": 0,
            "to0": false,
            "name": "test3",
            "color": "#FFFFFF",
            "delta": 0,
            "lim_b": 0,
            "lim_s": 0,
            "quote": false,
            "timer": 1,
            "v_max": 1,
            "v_min": -1,
            "_buy_v": 10,
            "_pos_v": 1000,
            "opened": 0,
            "re_buy": false,
            "use_tt": false,
            "v_in_l": 1,
            "v_in_r": 1,
            "_buy_en": false,
            "_l_b_en": false,
            "_l_s_en": false,
            "_pos_en": false,
            "_sell_v": 10,
            "comment": "",
            "overlay": 0,
            "percent": 100,
            "re_sell": false,
            "v_out_l": 1,
            "v_out_r": 1,
            "_l_b_val": 10,
            "_l_s_val": 10,
            "_sell_en": false,
            "decimals": 4,
            "disabled": false,
            "_buy_time": 5,
            "_l_b_stop": false,
            "_l_b_time": 10,
            "_l_s_stop": false,
            "_l_s_time": 10,
            "_pos_time": 5,
            "log_level": 0,
            "timetable": [
                {
                    "begin": 36000,
                    "end": 50400,
                    "auto_close": false,
                    "auto_to_market": true,
                    "auto_to0": false
                },
                {
                    "begin": 50580,
                    "end": 67020,
                    "auto_close": false,
                    "auto_to_market": true,
                    "auto_to0": false
                }
            ],
            "_sell_time": 5,
            "mkt_volume": 100,
            "price_type": 0,
            "securities": {
                "OKF_ADA_USDT_SWAP": {
                    "k": 0,
                    "mm": false,
                    "sl": 0,
                    "te": true,
                    "tp": 1,
                    "pos": 0,
                    "sle": false,
                    "k_sl": 0,
                    "count": 1,
                    "maker": false,
                    "ratio": 1,
                    "timer": 60,
                    "on_buy": 1,
                    "sec_key": "OKF_ADA_USDT_SWAP",
                    "decimals": 4,
                    "depth_ob": 1,
                    "is_first": true,
                    "leverage": 1,
                    "ob_c_p_t": 1,
                    "ob_t_p_t": 0,
                    "sec_type": 67108864,
                    "comission": 0,
                    "ban_period": 1,
                    "count_type": 0,
                    "ratio_sign": 0,
                    "ratio_type": 0,
                    "client_code": "virtual",
                    "move_limits": false,
                    "fin_res_mult": 1,
                    "mc_level_to0": 0,
                    "move_limits1": false,
                    "count_formula": "return 1;",
                    "comission_sign": 1,
                    "mc_level_close": 0,
                    "sec_key_subscr": "ADA-USDT-SWAP",
                    "max_trans_musec": 1000000,
                    "ratio_b_formula": "return 1;",
                    "ratio_s_formula": "return 1;",
                    "percent_of_quantity": 100
                }
            },
            "type_trade": 0,
            "_fin_res_en": false,
            "ext_field1_": "return 0;",
            "ext_field2_": "return 0;",
            "first_delta": 0,
            "hedge_after": 1,
            "n_perc_fill": 0,
            "price_check": 10,
            "_fin_res_abs": 1000,
            "_fin_res_val": 10,
            "custom_trade": false,
            "equal_prices": false,
            "ext_formulas": false,
            "simply_first": false,
            "_fin_res_stop": false,
            "_fin_res_time": 60,
            "cur_day_month": 7,
            "portfolio_num": 0,
            "trade_formula": "return 0;",
            "virtual_0_pos": false,
            "max_not_hedged": 1,
            "portfolio_type": 0,
            "_max_running_en": false,
            "_too_much_n_h_en": false,
            "opened_comission": 0,
            "move_limits1_date": -1,
            "always_limits_timer": false,
            "_max_running_percent": 70
        }
    },
    "eid": "qwerty"
}
```

```json
{
	"type":"portfolio.update",
	"data":
	{
		"r_id":"9901",
		"portfolio":
		{
			"name":"DerCry_view_only",
			"uf0":
			{
				"v":123
			}
		},
	},
	"eid":"1146"
}
```

```json
{
	"type":"portfolio.update",
	"data":
	{
		"r_id":"9901",
		"portfolio":
		{
			"name":"DerCry_view_only",
			"uf2":
			{
				"v":1,
				"c":"qwe"
			}
		},
	},
	"eid":"1146"
}
```
</details>    
<details>
<summary>Response on success</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = portfolio.update | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = p | y | string | request_result | Request result |
| data | y | object |  |  |
| > r_id | y | string |  | Robot ID |
| > p_id | y | string |  | Portfolio name |

Example:

```json
{
	"type":"portfolio.update",
	"data":
	{
		"r_id":"1",
		"p_id":"test3"
	},
	"r":"p",
	"eid":"qwerty",
	"ts":1669806718085368646
}
```
</details>    
<details>
<summary>Response on error</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = portfolio.update | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r=e | y | string | request_result | Request result |
| data | y | object |  |  |
| > msg | y | string |  | Error message |
| > code | y | number | err_code | Error code |

Example:

```json
{
	"type":"portfolio.update",
	"data":
	{
		"msg":"Permission denied",
		"code":555
	},
	"ts":1657693572940145200,
	"eid":"qwerty",
	"r":"e"
}
```
</details>    

### Удалить портфель

Удалить портфель из робота

<details>
<summary>Request</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = portfolio.remove | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| data | y | object |  |  |
| > r_id | y | string |  | Robot ID |
| > p_id | y | string |  | Portfolio name |

Example:

```json
{
	"type": "portfolio.remove",
	"data": {
		"r_id": "1",
		"p_id": "test"
	},
	"eid": "qwerty"
}
```
</details>    
<details>
<summary>Response on success</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = portfolio.remove | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = p | y | string | request_result | Request result |
| data | y | object |  |  |
| > r_id | y | string |  | Robot ID |
| > p_id | y | string |  | Portfolio name |

Example:

```json
{
	"type": "portfolio.remove",
	"data": {
		"r_id": "1",
		"p_id": "test"
	},
	"ts":1657693572940145200,
	"eid": "qwerty",
	"r": "p"
}
```
</details>    
<details>
<summary>Response on error</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = portfolio.remove | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = e | y | string | request_result | Request result |
| data | y | object |  |  |
| > msg | y | string |  | Error message |
| > code | y | number | err_code | Error code |

Example:

```json
{
	"type":"portfolio.remove",
	"data":
	{
		"msg":"Permission denied",
		"code":555
	},
	"ts":1657693572940145200,
	"eid":"qwerty",
	"r":"e"
}
```
</details>    

### Подписка на портфель

Подписаться на события изменения/удаления полей портфеля/бумаг портфеля

В любой момент может быть выслан снапшот

В обновлениях придут ключи (для портфеля — это name, для обновленных бумаг — sec_key) и измененные поля портфеля/бумаги портфеля

Обновления значений пользовательских полей `uf0, ..., uf19` содержат только те ключи каждого из пользовательских полей, чьи значения были изменены

При удалении портфеля/бумаги портфеля придет поле __action=del

При удалении портфеля вы будете от него отписаны

<details>
<summary>Request</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = portfolio.subscribe | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| data | y | object |  |  |
| > r_id | y | string |  | Robot ID |
| > p_id | y | string |  | Portfolio name |

Example:

```json
{
	"type": "portfolio.subscribe",
	"data": {
		"r_id": "1",
		"p_id": "test3"
	},
	"eid": "qwerty"
}
```
</details>    
<details>

<summary>Response on success (snapshot)</summary> 

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = portfolio.subscribe | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = s | y | string | request_result | Request result |
| data | y | object |  |  |
| > r_id | y | string |  | Robot ID |
| > p_id | y | string |  | Portfolio name |
| > value | y | object |  | Portfolio snapshot |
| >> name | y | string |  | Portfolio name |
| >> * | y | * |  | Other portfolio fields from template |
| >> securities | y | object |  | Securities |
| >>> SEC_KEY | y | string: object |  | Security object key |
| >>>> sec_key | y | string |  | Security unique key (should be equal to SEC_KEY) |
| >>>> * | y | * |  | Other security fields from template |

Example:

```json
{
  "type": "portfolio.subscribe",
  "data": {
    "r_id": "666",
    "p_id": "qwe",
    "value": {
      "log_level": 0,
      "portfolio_type": 0,
      "portfolio_num": 0,
      "type_trade": 0,
      "price_type": 0,
      "n_perc_fill": 0,
      "sell_status": 0,
      "buy_status": 0,
      "max_not_hedged": 1,
      "_max_not_hedged_adm": 1000,
      "hedge_after": 1,
      "cur_day_month": 24,
      "_freq_type": 0,
      "_freq_delta": 10,
      "_freq_count": 1000,
      "_pos_time": 5,
      "_sell_time": 5,
      "_buy_time": 5,
      "_max_running_percent": 100,
      "_fin_res_time": 60,
      "_l_s_time": 2,
      "_l_b_time": 2,
      "trading_days": 127,
      "decimals": 4,
      "timer": 1,
      "v_in_l": 1,
      "v_in_r": 1,
      "v_out_l": 1,
      "v_out_r": 1,
      "v_min": -1,
      "v_max": 1,
      "mkt_volume": 100,
      "return_first": 0,
      "overlay": 0,
      "move_limits1_date": -1,
      "_pos_v": 1000,
      "pos": 0,
      "old_pos": 0,
      "name": "qwe",
      "owner": "r.liverovskiy@gmail.com",
      "comment": "",
      "trade_formula": "return 0;",
      "ext_field1_": "return 0;",
      "ext_field2_": "return 0;",
      "sell_tt": "",
      "buy_tt": "buy: is signal=0, quantity=1, is valid market volume=1, is price check=0, is max not hedged=1, is orderbook valid=1",
      "trading_tt": "can trade",
      "color": "#FFFFFF",
      "k": 0,
      "k1": 0,
      "k2": 0,
      "tp": 1,
      "lim_s": 0,
      "lim_b": 0,
      "delta": 0,
      "first_delta": 0,
      "percent": 100,
      "opened": 0,
      "opened_comission": 0,
      "fin_res_wo_c": 0,
      "fin_res": 0,
      "threshold": 0,
      "price_check": 10,
      "_sell_v": 10,
      "_buy_v": 10,
      "_fin_res_abs": 1000,
      "_too_much_n_h_portfolios": 100,
      "ext_field1": 0,
      "ext_field2": 0,
      "sell": 33599,
      "buy": 33600,
      "price_s": 0,
      "price_b": 0,
      "_l_s_val": 10,
      "_l_b_val": 10,
      "_fin_res_val": 10,
      "lot_size": 1,
      "disabled": false,
      "equal_prices": false,
      "always_limits_timer": false,
      "simply_first": false,
      "quote": false,
      "to0": false,
      "virtual_0_pos": false,
      "is_fin_res_ok": true,
      "is_pos_ok": true,
      "_freq_en": false,
      "_pos_en": false,
      "_sell_en": false,
      "_buy_en": false,
      "_max_running_en": false,
      "_fin_res_en": false,
      "_fin_res_stop": false,
      "_l_s_en": false,
      "_l_s_stop": false,
      "_l_b_en": false,
      "_l_b_stop": false,
      "_too_much_n_h_en": false,
      "custom_trade": false,
      "ext_formulas": false,
      "re_sell": false,
      "re_buy": false,
      "use_tt": false,
      "maker": false,
      "_saving": false,
      "all_free": true,
      "has_formula": false,
      "_save_h": false,
      "has_virtual": true,
      "_sh_f": true,
      "uf0": {},
      "uf1": {},
      "uf2": {},
      "uf3": {},
      "uf4": {},
      "uf5": {},
      "uf6": {},
      "uf7": {},
      "uf8": {},
      "uf9": {},
      "uf10": {},
      "uf11": {},
      "uf12": {},
      "uf13": {},
      "uf14": {},
      "uf15": {},
      "uf16": {},
      "uf17": {},
      "uf18": {},
      "uf19": {},
      "securities": {
        "SRM5": {
          "put": -1,
          "decimals": 4,
          "on_buy": 1,
          "leverage": 1,
          "count_type": 0,
          "timer": 60,
          "ratio_sign": 0,
          "ratio_type": 0,
          "comission_sign": 1,
          "depth_ob": 1,
          "ob_c_p_t": 1,
          "ob_t_p_t": 0,
          "pos": 0,
          "count": 1,
          "max_trans_musec": 1000000,
          "ban_period": 0,
          "sec_type": 2,
          "sec_board": "",
          "sec_code": "SBRF-6.25",
          "count_formula": "return 1;",
          "ratio_b_formula": "return 1;",
          "ratio_s_formula": "return 1;",
          "sec_key": "SRM5",
          "sec_key_subscr": "5157900",
          "client_code": "virtual",
          "k": 0,
          "tp": 1,
          "sl": 1000,
          "k_sl": 0,
          "ratio": 1,
          "percent_of_quantity": 100,
          "fin_res_mult": 1,
          "comission": 0,
          "mc_level_to0": 0,
          "mc_level_close": 0,
          "d_pg": 1750366800,
          "lot_size": 1,
          "all_free": true,
          "mm": false,
          "sle": false,
          "te": true,
          "move_limits": false,
          "move_limits1": false,
          "is_first": true
        }
      },
      "timetable": [
        {
          "begin": 36000,
          "end": 67200,
          "a_sell": 2,
          "a_buy": 2,
          "auto_close": false,
          "auto_to_market": false,
          "auto_to0": 2,
          "save_history": false
        }
      ]
    }
  },
  "r": "s",
  "eid": "7299",
  "ts": 1742802030377497687
}
```
</details>    
<details>
<summary>Updates</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = portfolio.subscribe | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = u | y | string | request_result | Request result |
| data | y | object |  |  |
| > r_id | y | string |  | Robot ID |
| > p_id | y | string |  | Portfolio name |
| > value | y | object |  | Portfolio update |
| >> name | y | string |  | Portfolio name |
| >> __action = del | n | string |  | Only on delete |
| >> * | n | * |  | Other portfolio fields from template |
| >> securities | n | object |  | Securities |
| >>> SEC_KEY | n | string: object |  | Security object key |
| >>>> sec_key | y | string |  | Security unique key (should be equal to SEC_KEY) |
| >>>> __action = del | n | string |  | Only on delete |
| >>>> * | n | * |  | Other security fields from template |

Example:

```json
{
    "type": "portfolio.subscribe",
    "data": {
        "r_id": "1",
        "p_id": "test3",
        "value": {
            "name": "test3",
            "owner": "test@gmail.com",
            "sell": 0.31526,
            "buy": 0.31527
            "uf2": {"c":"qwert"},
            "uf1": {"v":5},
            "uf0": {"v":6, "c":"zxc"},
        }
    },
    "r": "u",
    "eid": "qwerty",
    "ts": 1669808258692270689
}
```

```json
{
    "type": "portfolio.subscribe",
    "data": {
        "r_id": "1",
        "p_id": "test3",
        "value": {
            "name": "test3",
            "owner": "test@gmail.com",
            "__action": "del"
        }
    },
    "r": "u",
    "eid": "qwerty",
    "ts": 1669810178671322447
}
```
</details>    
<details>
<summary>Response on error</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = portfolio.subscribe | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = e | y | string | request_result | Request result |
| data | y | object |  |  |
| > msg | y | string |  | Error message |
| > code | y | number | err_code | Error code |

Example:

```json
{
	"type":"portfolio.subscribe",
	"data":
	{
		"msg":"Permission denied",
		"code":555
	},
	"ts":1657693572940145200,
	"eid":"qwerty",
	"r":"e"
}
```
</details>    

### Отписка от портфеля

Отписаться от событий по портфелю

<details>
<summary>Request</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = portfolio.unsubscribe | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| data | y | object |  |  |
| > sub_eid | y | string | string_36 | Subscription eid |

Example:

```json
{
	"type":"portfolio.unsubscribe",
	"data":
	{
		"sub_eid":"qwerty"
	},
	"eid":"q"
}
```
</details>    
<details>
<summary>Response on success</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = portfolio.unsubscribe | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = p | y | string | request_result | Request result |

Example:

```json
{
	"type":"portfolio.unsubscribe",
	"data":{},
	"r":"p",
	"eid":"q",
	"ts":1669810178671387651
}
```
</details>    
<details>
<summary>Response on error</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = portfolio.unsubscribe | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = e | y | string | request_result | Request result |
| data | y | object |  |  |
| > msg | y | string |  | Error message |
| > code | y | number | err_code | Error code |

Example:

```json
{
	"type":"portfolio.unsubscribe",
	"data":
	{
		"msg":"Operation timeout",
		"code":666
	},
	"ts":1657693572940145200,
	"eid":"q",
	"r":"e"
}
```
</details>    

### “Сбросить” статусы заявок портфеля

“Сбросить” статусы всех заявок всех инструментов выбранного портфеля

<details>
<summary>Request</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = portfolio.reset_statuses | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| data | y | object |  |  |
| > r_id | y | string |  | Robot ID |
| > p_id | y | string |  | Portfolio name |

Example:

```json
{
	"type": "portfolio.reset_statuses",
	"data": {
		"r_id": "1",
		"p_id": "test"
	},
	"eid": "qwerty"
}
```
</details>    
<details>
<summary>Response on success</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = portfolio.reset_statuses | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = p | y | string | request_result | Request result |
| data | y | object |  |  |
| > r_id | y | string |  | Robot ID |
| > p_id | y | string |  | Portfolio name |

Example:

```json
{
	"type":"portfolio.reset_statuses",
	"data":
	{
		"r_id":"1",
		"p_id":"test3"
	},
	"r":"p",
	"eid":"qwerty",
	"ts":1669806718085368646
}
```
</details>    
<details>
<summary>Response on error</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = portfolio.reset_statuses | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r=e | y | string | request_result | Request result |
| data | y | object |  |  |
| > msg | y | string |  | Error message |
| > code | y | number | err_code | Error code |

Example:

```json
{
	"type":"portfolio.reset_statuses",
	"data":
	{
		"msg":"Permission denied",
		"code":555
	},
	"ts":1657693572940145200,
	"eid":"qwerty",
	"r":"e"
}
```
</details>    

### Остановить торговлю и снять заявки портфеля

Остановить торговлю и снять все заявки выбранного портфеля

<details>
<summary>Request</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = portfolio.hard_stop | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| data | y | object |  |  |
| > r_id | y | string |  | Robot ID |
| > p_id | y | string |  | Portfolio name |

Example:

```json
{
	"type": "portfolio.hasrd_stop",
	"data": {
		"r_id": "1",
		"p_id": "test"
	},
	"eid": "qwerty"
}
```
</details>    
<details>
<summary>Response on success</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = portfolio.hard_stop | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = p | y | string | request_result | Request result |
| data | y | object |  |  |
| > r_id | y | string |  | Robot ID |
| > p_id | y | string |  | Portfolio name |

Example:

```json
{
	"type":"portfolio.hard_stop",
	"data":
	{
		"r_id":"1",
		"p_id":"test3"
	},
	"r":"p",
	"eid":"qwerty",
	"ts":1669806718085368646
}
```
</details>    
<details>
<summary>Response on error</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = portfolio.hard_stop | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r=e | y | string | request_result | Request result |
| data | y | object |  |  |
| > msg | y | string |  | Error message |
| > code | y | number | err_code | Error code |

Example:

```json
{
	"type":"portfolio.hard_stop",
	"data":
	{
		"msg":"Permission denied",
		"code":555
	},
	"ts":1657693572940145200,
	"eid":"qwerty",
	"r":"e"
}
```
</details>    

### Выключить все формулы портфеля

Остановить торговлю и отключить все формулы выбранного портфеля

<details>
<summary>Request</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = portfolio.formulas_stop | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| data | y | object |  |  |
| > r_id | y | string |  | Robot ID |
| > p_id | y | string |  | Portfolio name |

Example:

```json
{
	"type": "portfolio.formulas_stop",
	"data": {
		"r_id": "1",
		"p_id": "test"
	},
	"eid": "qwerty"
}
```
</details>    
<details>
<summary>Response on success</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = portfolio.formulas_stop | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = p | y | string | request_result | Request result |
| data | y | object |  |  |
| > r_id | y | string |  | Robot ID |
| > p_id | y | string |  | Portfolio name |

Example:

```json
{
	"type":"portfolio.formulas_stop",
	"data":
	{
		"r_id":"1",
		"p_id":"test3"
	},
	"r":"p",
	"eid":"qwerty",
	"ts":1669806718085368646
}
```
</details>    
<details>
<summary>Response on error</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = portfolio.formulas_stop | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r=e | y | string | request_result | Request result |
| data | y | object |  |  |
| > msg | y | string |  | Error message |
| > code | y | number | err_code | Error code |

Example:

```json
{
	"type":"portfolio.formulas_stop",
	"data":
	{
		"msg":"Permission denied",
		"code":555
	},
	"ts":1657693572940145200,
	"eid":"qwerty",
	"r":"e"
}
```
</details>    

### “Скинуть” портфель “в рынок”

Скинуть портфель в рынок

<details>
<summary>Request</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = portfolio.to_market | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| data | y | object |  |  |
| > r_id | y | string |  | Robot ID |
| > p_id | y | string |  | Portfolio name |

Example:

```json
{
	"type": "portfolio.to_market",
	"data": {
		"r_id": "1",
		"p_id": "test"
	},
	"eid": "qwerty"
}
```
</details>    
<details>
<summary>Response on success</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = portfolio.to_market | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = p | y | string | request_result | Request result |
| data | y | object |  |  |
| > r_id | y | string |  | Robot ID |
| > p_id | y | string |  | Portfolio name |

Example:

```json
{
	"type":"portfolio.to_market",
	"data":
	{
		"r_id":"1",
		"p_id":"test3"
	},
	"r":"p",
	"eid":"qwerty",
	"ts":1669806718085368646
}
```
</details>    
<details>
<summary>Response on error</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = portfolio.to_market | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r=e | y | string | request_result | Request result |
| data | y | object |  |  |
| > msg | y | string |  | Error message |
| > code | y | number | err_code | Error code |

Example:

```json
{
	"type":"portfolio.to_market",
	"data":
	{
		"msg":"Permission denied",
		"code":555
	},
	"ts":1657693572940145200,
	"eid":"qwerty",
	"r":"e"
}
```
</details>    

### Купить портфель

Купить выбранный портфель в заданном количестве

<details>
<summary>Request</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = portfolio.buy_portfolio | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| data | y | object |  |  |
| > r_id | y | string |  | Robot ID |
| > p_id | y | string |  | Portfolio name |
| > quantity | y | number |  | Integer number of portfolios to buy |

Example:

```json
{
	"type": "portfolio.buy_portfolio",
	"data": {
		"r_id": "1",
		"p_id": "test",
		"quantity": 10
	},
	"eid": "qwerty"
}
```
</details>    
<details>
<summary>Response on success</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = portfolio.buy_portfolio | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = p | y | string | request_result | Request result |
| data | y | object |  |  |
| > r_id | y | string |  | Robot ID |
| > p_id | y | string |  | Portfolio name |

Example:

```json
{
	"type":"portfolio.buy_portfolio",
	"data":
	{
		"r_id":"1",
		"p_id":"test3"
	},
	"r":"p",
	"eid":"qwerty",
	"ts":1669806718085368646
}
```
</details>    
<details>
<summary>Response on error</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = portfolio.buy_portfolio | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r=e | y | string | request_result | Request result |
| data | y | object |  |  |
| > msg | y | string |  | Error message |
| > code | y | number | err_code | Error code |

Example:

```json
{
	"type":"portfolio.buy_portfolio",
	"data":
	{
		"msg":"Permission denied",
		"code":555
	},
	"ts":1657693572940145200,
	"eid":"qwerty",
	"r":"e"
}
```
</details>    

### Продать портфель

Продать выбранный портфель в заданном количестве

<details>
<summary>Request</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = portfolio.sell_portfolio | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| data | y | object |  |  |
| > r_id | y | string |  | Robot ID |
| > p_id | y | string |  | Portfolio name |
| > quantity | y | number |  | Integer number of portfolios to sell |

Example:

```json
{
	"type": "portfolio.sell_portfolio",
	"data": {
		"r_id": "1",
		"p_id": "test",
		"quantity": 10
	},
	"eid": "qwerty"
}
```
</details>    
<details>
<summary>Response on success</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = portfolio.sell_portfolio | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = p | y | string | request_result | Request result |
| data | y | object |  |  |
| > r_id | y | string |  | Robot ID |
| > p_id | y | string |  | Portfolio name |

Example:

```json
{
	"type":"portfolio.sell_portfolio",
	"data":
	{
		"r_id":"1",
		"p_id":"test3"
	},
	"r":"p",
	"eid":"qwerty",
	"ts":1669806718085368646
}
```
</details>    
<details>
<summary>Response on error</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = portfolio.sell_portfolio | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r=e | y | string | request_result | Request result |
| data | y | object |  |  |
| > msg | y | string |  | Error message |
| > code | y | number | err_code | Error code |

Example:

```json
{
	"type":"portfolio.sell_portfolio",
	"data":
	{
		"msg":"Permission denied",
		"code":555
	},
	"ts":1657693572940145200,
	"eid":"qwerty",
	"r":"e"
}
```
</details>    

### Выставить заявку по бумаге портфеля

Выставить заявку на покупку/продажу выбранной бумаги выбранного портфеля в заданном количестве по заданной цене

<details>
<summary>Request</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = portfolio.order_security | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| data | y | object |  |  |
| > r_id | y | string |  | Robot ID |
| > p_id | y | string |  | Portfolio name |
| > quantity | y | number |  | Number of contracts to buy/sell |
| > price | y | number |  | Order price |
| > key | y | string |  | Security’s SecKey |
| > dir | y | number | direction | Order direction |

Example:

```json
{
	"type": "portfolio.order_security",
	"data": {
		"r_id": "1",
		"p_id": "test",
		"quantity": 1,
		"price": 0.1,
		"key": "OKF_ADA_USDT_SWAP",
		"dir": 1
	},
	"eid": "qwerty"
}
```
</details>    
<details>
<summary>Response on success</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = portfolio.order_security | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = p | y | string | request_result | Request result |
| data | y | object |  |  |
| > r_id | y | string |  | Robot ID |
| > p_id | y | string |  | Portfolio name |

Example:

```json
{
	"type":"portfolio.order_security",
	"data":
	{
		"r_id":"1",
		"p_id":"test3"
	},
	"r":"p",
	"eid":"qwerty",
	"ts":1669806718085368646
}
```
</details>    
<details>
<summary>Response on error</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = portfolio.order_security | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r=e | y | string | request_result | Request result |
| data | y | object |  |  |
| > msg | y | string |  | Error message |
| > code | y | number | err_code | Error code |

Example:

```json
{
	"type":"portfolio.order_security",
	"data":
	{
		"msg":"Permission denied",
		"code":555
	},
	"ts":1657693572940145200,
	"eid":"qwerty",
	"r":"e"
}
```
</details>    

### Протестировать формулу портфеля

Протестировать формулу портфеля.

Ответ может быть получен через достаточно большой интервал времени, т.к. пользовательский код необходимо скомпилировать и выполнить

<details>
<summary>Request</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = portfolio.test_formula | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| data | y | object |  |  |
| > r_id | y | string |  | Robot ID |
| > p_id | y | string |  | Portfolio name |
| > value | y | string |  | Formula field value (C++ code) |
| > field | y | string |  | Formula field name |
| > sec_key | n | string |  | Security’s SecKey, can be omitted if formula doesn’t belong to security |

Example:

```json
{
	"type": "portfolio.order_security",
	"data": {
		"r_id": "1",
		"p_id": "test",
		"sec_key": "",
		"field": "ext_field1_",
		"value": "return 2+3;"
	},
	"eid": "qwerty"
}
```
</details>    
<details>
<summary>Response on success</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = portfolio.test_formula | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = p | y | string | request_result | Request result |
| data | y | object |  |  |
| > r_id | y | string |  | Robot ID |
| > p_id | y | string |  | Portfolio name |
| > val | y | number |  | Test formula result |
| > warn | n | string |  | Warning message |

Example:

```json
{
	"type":"portfolio.test_formula",
	"data":
	{
		"r_id":"1",
		"p_id":"test3",
		"val":0,
		"warn":"libs/__compile.cpp: In function ‘double __ext_field1_()’:\libs/__compile.cpp:16:5: warning: unused variable ‘a’ [-Wunused-variable]\\n   16 | int a = 0;return 0;\n      |     ^\n"
	},
	"r":"p",
	"eid":"qwerty",
	"ts":1669806718085368646
}
```
</details>    
<details>
<summary>Response on error</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = portfolio.test_formula | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r=e | y | string | request_result | Request result |
| data | y | object |  |  |
| > msg | y | string |  | Error message |
| > code | y | number | err_code | Error code |

Example:

```json
{
	"type":"portfolio.test_formula",
	"data":
	{
		"msg":"Compilation on \"__eval__\" failed with error:\nlibs/__compile.cpp: In function ‘double __ext_field1_()’:\nlibs/__compile.cpp:16:9: error: expected ‘;’ before ‘return’\n   16 | return 0\n      |         ^\n      |         ;\n   17 | return 0;\n      | ~~~~~~   \n",
		"code":777
	},
	"ts":1657693572940145200,
	"eid":"qwerty",
	"r":"e"
}
```
</details>    

## История изменений полей портфеля <Anchor :ids="['portfolio-history']"/>

Везде в данном разделе значение поля `v` равное `-9007199254740992` (т.е. `-(1 << 53)`) считается "отсутствующим значением" и
не будет будет отображаться в вебинтерфейсе на графиках

### Подписка на отдельные поля портфеля

Подписаться на изменения конкретного поля портфеля

При удалении портфеля вы НЕ будете автоматически отписаны от его полей

Чтобы получать обновления, по данному портфелю необходимо включить запись истории

<details>
<summary>Request</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = portfolio_history.subscribe | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| data | y | object |  |  |
| > r_id | y | string |  | Robot ID |
| > p_id | y | string |  | Portfolio name |
| > key | y | string |  | Portfolio field key, one of: 'sell', 'buy', 'lim_s', 'lim_b', 'price_s', 'price_b', 'pos', 'fin_res', 'uf0', ..., 'uf19'|
| > aggr | y | string |  | Aggregation period, one of: 'raw', '10s', '1m', '5m', '10m', '1h', '6h', '24h' |
| > mt | n | epoch_msec |  | Minumum date/time to include in snapshot, set null to get last values (maximum number of returned values is 10000) |

Example:

```json
{
	"type":"portfolio_history.subscribe",
	"data":
	{
		"r_id":"1",
		"p_id":"b1",
		"key":"sell",
		"aggr":"raw"
	},
	"eid":"12"
}
```
</details>    
<details>

<summary>Response on success (snapshot)</summary> 

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = portfolio_history.subscribe | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = s | y | string | request_result | Request result |
| data | y | object |  |  |
| > mt | y | number | epoch_msec | Max time, written in data base (can be null) |
| > r_id | y | string |  | Robot ID |
| > p_id | y | string |  | Portfolio name |
| > key | y | string |  | Portfolio field key, one of: 'sell', 'buy', 'lim_s', 'lim_b', 'price_s', 'price_b', 'pos', 'fin_res', 'uf0', ..., 'uf19'|
| > aggr | y | string |  | Aggregation period, one of: 'raw', '10s', '1m', '5m', '10m', '1h', '6h', '24h' |
| > values | y | object |  | Field values snapshot (can be empty) |
| >> [] | y | array |  | List of field values |
| >>> dt | y | number | epoch_msec | Field value time |
| >>> v | y | number |  | Field value |

Example:

```json
{
	"type":"portfolio_history.subscribe",
	"data":
	{
		"r_id":"1",
		"p_id":"b1",
		"key":"sell",
		"aggr":"raw",
		"values":
		[
			{"dt":1717592977733,"v":67249.73}
		],
		"mt":1717592977733
	},
	"r":"s",
	"eid":"2745",
	"ts":1717592980360842097
}
```
</details>    
<details>
<summary>Updates</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = portfolio_history.subscribe | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = u | y | string | request_result | Request result |
| data | y | object |  |  |
| > r_id | y | string |  | Robot ID |
| > p_id | y | string |  | Portfolio name |
| > key | y | string |  | Portfolio field key, one of: 'sell', 'buy', 'lim_s', 'lim_b', 'price_s', 'price_b', 'pos', 'fin_res', 'uf0', ..., 'uf19'|
| > aggr | y | string |  | Aggregation period, one of: 'raw', '10s', '1m', '5m', '10m', '1h', '6h', '24h' |
| > values | y | object |  | Field values snapshot |
| >> [] | y | array |  | List of field values |
| >>> dt | y | number | epoch_msec | Field value time |
| >>> v | y | number |  | Field value |

Example:

```json
{
	"type":"portfolio_history.subscribe",
	"data":
	{
		"r_id":"1",
		"p_id":"b1",
		"key":"sell",
		"aggr":"raw",
		"values":
		[
			{"dt":1717592977743,"v":67249.74}
		]
	},
	"r":"u",
	"eid":"2745",
	"ts":1717592980360845097
}
```
</details>    
<details>
<summary>Response on error</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = portfolio_history.subscribe | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = e | y | string | request_result | Request result |
| data | y | object |  |  |
| > msg | y | string |  | Error message |
| > code | y | number | err_code | Error code |

Example:

```json
{
	"type":"portfolio_history.subscribe",
	"data":
	{
		"msg":"Permission denied",
		"code":555
	},
	"ts":1657693572940145200,
	"eid":"qwerty",
	"r":"e"
}
```
</details>    

### Отписка от поля портфеля

Отписаться от обновление по полю портфеля

<details>
<summary>Request</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = portfolio_history.unsubscribe | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| data | y | object |  |  |
| > sub_eid | y | string | string_36 | Subscription eid |

Example:

```json
{
	"type":"portfolio_history.unsubscribe",
	"data":
	{
		"sub_eid":"qwerty"
	},
	"eid":"q"
}
```
</details>    
<details>
<summary>Response on success</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = portfolio_history.unsubscribe | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = p | y | string | request_result | Request result |

Example:

```json
{
	"type":"portfolio_history.unsubscribe",
	"data":{},
	"r":"p",
	"eid":"q",
	"ts":1669810178671387651
}
```
</details>    
<details>
<summary>Response on error</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = portfolio_history.unsubscribe | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = e | y | string | request_result | Request result |
| data | y | object |  |  |
| > msg | y | string |  | Error message |
| > code | y | number | err_code | Error code |

Example:

```json
{
	"type":"portfolio_history.unsubscribe",
	"data":
	{
		"msg":"Operation timeout",
		"code":666
	},
	"ts":1657693572940145200,
	"eid":"q",
	"r":"e"
}
```
</details>

### Запрос истории изменений поля портфеля

Получить “небольшую” историю старше заданной даты

Т.к. запрашивается история аггрегатов, то `lim` относится именно к числу аггрегатов, реальное получаемое количество точек при этом может быть больше (аж в 3 раза). Чтобы узнать к какому именно аггрегату относится точка необходимо время точки разделить на длину аггрегата, взять целую часть и полученное значение умножить на длину аггрегата

Чтобы история содержала значения, по данному портфелю необходимо включить запись истории

<details>
<summary>Request</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = portfolio_history.get_previous | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| data | y | object |  |  |
| > r_id | y | string |  | Robot ID |
| > p_id | y | string |  | Portfolio name |
| > key | y | string |  | Portfolio field key, one of: 'sell', 'buy', 'lim_s', 'lim_b', 'price_s', 'price_b', 'pos', 'fin_res', 'uf0', ..., 'uf19'|
| > aggr | y | string |  | Aggregation period, one of: 'raw', '10s', '1m', '5m', '10m', '1h', '6h', '24h' |
| > mt | y | number | epoch_msec | Receive rows “older” than this value. This value is recommended to be multiple of aggregation period in milliseconds |
| > lim | n | number |  | Number of rows to receive in range [1, 1000], default value is 1000 |

Example:

```json
{
	"type": "portfolio_history.get_previous",
	"data": {
		"r_id": "1",
		"p_id": "test2",
		"key":"sell",
		"aggr":"raw",
		"mt": "2000000000000000000",
		"lim": 100
	},
	"eid": "qwerty"
}
```
</details>    
<details>
<summary>Response on success</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = portfolio_history.get_previous | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = p | y | string | request_result | Request result |
| data | y | object |  |  |
| > r_id | y | string |  | Robot ID |
| > p_id | y | string |  | Portfolio name |
| > key | y | string |  | Portfolio field key, one of: 'sell', 'buy', 'lim_s', 'lim_b', 'price_s', 'price_b', 'pos', 'fin_res', 'uf0', ..., 'uf19'|
| > aggr | y | string |  | Aggregation period, one of: 'raw', '10s', '1m', '5m', '10m', '1h', '6h', '24h' |
| > values | y | object |  | Field values snapshot |
| >> [] | y | array |  | List of field values |
| >>> dt | y | number | epoch_msec | Field value time |
| >>> v | y | number |  | Field value |

Example:

```json
{
    "type": "portfolio_history.get_previous",
    "data": {
	"r_id":"1",
	"p_id":"b1",
	"key":"sell",
	"aggr":"raw",
        "values":
		[
			{"dt":1717592977733,"v":67249.73},
			{"dt":1717592977933,"v":67249.75}
		],
    },
    "r": "p",
    "eid": "q0",
    "ts": 1676366845413318695
}
```
</details>    
<details>
<summary>Response on error</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = portfolio_history.get_previous | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = e | y | string | request_result | Request result |
| data | y | object |  |  |
| > msg | y | string |  | Error message |
| > code | y | number | err_code | Error code |

Example:

```json
{
	"type":"portfolio_history.get_previous",
	"data":
	{
		"msg":"Permission denied",
		"code":555
	},
	"ts":1657693572940145200,
	"eid":"qwerty",
	"r":"e"
}
```
</details>    

### Запрос истории изменений поля портфеля 2

Получить историю от даты до даты

Т.к. запрашивается история аггрегатов, то `lim` относится именно к числу аггрегатов, реальное получаемое количество точек при этом может быть больше (аж в 3 раза). Чтобы узнать к какому именно аггрегату относится точка необходимо время точки разделить на длину аггрегата, взять целую часть и полученное значение умножить на длину аггрегата

Чтобы история содержала значения, по данному портфелю необходимо включить запись истории

<details>
<summary>Request</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = portfolio_history.get_history | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| data | y | object |  |  |
| > r_id | y | string |  | Robot ID |
| > p_id | y | string |  | Portfolio name |
| > key | y | string |  | Portfolio field key, one of: 'sell', 'buy', 'lim_s', 'lim_b', 'price_s', 'price_b', 'pos', 'fin_res', 'uf0', ..., 'uf19'|
| > aggr | y | string |  | Aggregation period, one of: 'raw', '10s', '1m', '5m', '10m', '1h', '6h', '24h' |
| > mint | y | number | epoch_msec | Receive rows “newer” or equal than this value. This value is recommended to be multiple of aggregation period in milliseconds |
| > maxt | y | number | epoch_msec | Receive rows “older” or equal than this value. This value is recommended to be multiple of aggregation period in milliseconds |
| > lim | n | number |  | Number of rows to receive in range [1, 100000], default value is 100000 |

Example:

```json
{
	"type": "portfolio_history.get_history",
	"data": {
		"r_id":"1",
		"p_id":"b1",
		"key":"sell",
		"aggr":"raw",
		"maxt": "2000000000000",
		"mint": "1",
		"lim": 100
	},
	"eid": "qwerty"
}
```
</details>    
<details>
<summary>Response on success</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = portfolio_history.get_history | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = p | y | string | request_result | Request result |
| data | y | object |  |  |
| > r_id | y | string |  | Robot ID |
| > p_id | y | string |  | Portfolio name |
| > key | y | string |  | Portfolio field key, one of: 'sell', 'buy', 'lim_s', 'lim_b', 'price_s', 'price_b', 'pos', 'fin_res', 'uf0', ..., 'uf19'|
| > aggr | y | string |  | Aggregation period, one of: 'raw', '10s', '1m', '5m', '10m', '1h', '6h', '24h' |
| > values | y | object |  | Field values snapshot |
| >> [] | y | array |  | List of field values |
| >>> dt | y | number | epoch_msec | Field value time |
| >>> v | y | number |  | Field value |

Example:

```json
{
    "type": "portfolio_history.get_history",
    "data": {
	"r_id":"1",
	"p_id":"b1",
	"key":"sell",
	"aggr":"raw",
        "values":
		[
			{"dt":1717592977733,"v":67249.73},
			{"dt":1717592977933,"v":67249.75}
		],
    },
    "r": "p",
    "eid": "q0",
    "ts": 1676366845413318695
}
```
</details>    
<details>
<summary>Response on error</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = portfolio_history.get_history | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = e | y | string | request_result | Request result |
| data | y | object |  |  |
| > msg | y | string |  | Error message |
| > code | y | number | err_code | Error code |

Example:

```json
{
	"type":"portfolio_history.get_history",
	"data":
	{
		"msg":"Permission denied",
		"code":555
	},
	"ts":1657693572940145200,
	"eid":"qwerty",
	"r":"e"
}
```
</details>

## Роботы

### Подписка на робота

Подписаться на события изменения полей робота

В любой момент может быть выслан снапшот

При удалении робота вы будете от него отписаны

md_st, tr_st, re, trans_cnt всегда ходят целиком

<details>
<summary>Request</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = robot.subscribe | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| data | y | object |  |  |
| > r_id | y | string |  | Robot ID |

Example:

```json
{
	"type": "robot.subscribe",
	"data": {
		"r_id": "1"
	},
	"eid": "qwerty"
}
```
</details>    
<details>

<summary>Response on success (snapshot)</summary> 

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = robot.subscribe | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = s | y | string | request_result | Request result |
| data | y | object |  |  |
| > r_id | y | string |  | Robot ID |
| > value | y | object |  |  |
| >> rc | y | boolean |  | Is robot connected to backend |
| >> rv | y | string |  | Robot version |
| >> rvd | y | number | epoch_sec | Robot version date (-1 means unknown) |
| >> ll | y | string |  | Label |
| >> de | y | number |  | Elapsed days, 0 means expired, -1 means unknown |
| >> dt | y | number | epoch_msec | Robot date/time (0 means unknown) |
| >> tz | y | number |  | Robot's server timezone offset in seconds |
| >> mtc | y | number |  | Robot transaction connections limit |
| >> mc | y | number |  | Robot main loop counter |
| >> mdc | y | number | stream_status | Market-data connections status |
| >> trc | y | number | stream_status | Trade connection status |
| >> tr | y | number | trading_status | Is robot trading |
| >> bld | y | string |  | Build name |
| >> ps | y | number | process_status | Robot process status |
| >> sv | y | string |  | Server build robot version |
| >> svd | y | number | epoch_sec | Server build robot version date (-1 means unknown) |
| >> start | y | boolean |  | Robot should be started |
| >> resp_users | y | array |  | List of responsible users emails as list of strings |
| >> md_st | y | array |  |  |
| >>> [] | y |  |  | Array of dictionaries of data-stream states with stream name as a key and value of type stream_status |
| >> tr_st | y | array |  |  |
| >>> [] | y |  |  | Array of dictionaries of data-stream states with stream name as a key and value of type stream_status |
| >> re | y | array |  |  |
| >>> [] | y |  |  |  |
| >>>> n | y | string |  | Portfolio name |
| >>>> f | y | boolean |  | Is free or has active orders |
| >>>> re | y | boolean |  | Is re_sell or re_buy |
| >> c_id | y | string |  | Company unique ID |
| >> comp | y | string |  | Company name |
| >> p_cnt | n | number |  | "Production" transactions count |
| >> v_cnt | n | number |  | "Virtual" transactions count |
| >> trans_cnt | n | array |  |  |
| >>> [] | n |  |  | Array of objects |
| >>>> n | y | string |  | Name |
| >>>> s | y | number |  | Transaction count |
| >>>> a | y | number |  | Adds count |
| >>>> d | y | number |  | Deletes count |
| >>>> m | y | number |  | Moves count |
| >>>> ra | y | number |  | Add rejects count |
| >> p_a | y | number |  | All portfolios |
| >> p_d | y | number |  | Disabled portfolios |
| >> p_e | y | number |  | Expired portfolios |


Example:

```json
{
    "type": "robot.subscribe",
    "data": {
        "r_id": "1",
        "value": {
            "rc": true,
            "rv": "ec1d046c",
            "rvd": 1687175149,
            "ll": "Test robot",
            "de": 3614,
            "dt": 1687779242000,
            "tz": 0,
            "mtc": 10,
            "mc": 10850,
            "mdc": 2,
            "trc": 2,
            "tr": 2,
            "r_id": "1",
            "bld": "vikingrobot.vrb_test",
            "ps": 2,
            "sv": "ec1d046",
            "svd": 1687175149,
            "start": true,
            "resp_users": ["test@gmail.com"],
            "md_st": [
                {
                    "sec_type": 1048576,
                    "name": "bitmex_listen",
                    "st": {
                        "Definitions": 1,
                        "OB": 0,
                        "Prices": 0,
                        "Socket": 2,
                        "States": 0
                    }
                },
                {
                    "sec_type": 67108864,
                    "name": "okex_listen_aws",
                    "st": {
                        "Definitions": 1,
                        "Extra": 1,
                        "Funding": 1,
                        "OB": 1,
                        "Socket": 2
                    }
                }
            ],
            "tr_st": [
                {
                    "sec_type": 1048576,
                    "name": "qwe",
                    "st": {
                        "Margin": 0,
                        "Orders": 0,
                        "Positions": 0,
                        "Socket": 0,
                        "Trades": 0
                    }
                },
                {
                    "sec_type": 1048576,
                    "name": "roma",
                    "st": {
                        "Margin": 0,
                        "Orders": 0,
                        "Positions": 0,
                        "Socket": 1,
                        "Trades": 0
                    }
                },
                {
                    "sec_type": 0,
                    "name": "virtual",
                    "st": {
                        "TRANS": 2
                    }
                }
            ],
            "tr": 0,
            "re": [
                {
                    "n": "replace",
                    "f": true,
                    "re": false
                },
                {
                    "n": "test1",
                    "f": true,
                    "re": false
                }
            ]
        }
    },
    "r": "s",
    "eid": "q0",
    "ts": 1687779242801030176
}
```
</details>    
<details>
<summary>Updates</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = robot.subscribe | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = s | y | string | request_result | Request result |
| data | y | object |  |  |
| > r_id | y | string |  | Robot ID |
| > value | y | object |  |  |
| >> rc | n | boolean |  | Is robot connected to backend |
| >> rv | n | string |  | Robot version |
| >> rvd | n | number | epoch_sec | Robot version date (-1 means unknown) |
| >> ll | n | string |  | Label |
| >> de | n | number |  | Elapsed days, 0 means expired, -1 means unknown |
| >> dt | n | number | epoch_msec | Robot date/time (0 means unknown) |
| >> tz | n | number |  | Robot's server timezone offset in seconds |
| >> mtc | n | number |  | Robot transaction connections limit |
| >> mc | n | number |  | Robot main loop counter |
| >> mdc | n | number | stream_status | Market-data connections status |
| >> trc | n | number | stream_status | Trade connection status |
| >> tr | n | number | trading_status | Is robot trading |
| >> bld | n | string |  | Build name |
| >> ps | n | number | process_status | Robot process status |
| >> sv | n | string |  | Server build robot version |
| >> svd | n | number | epoch_sec | Server build robot version date (-1 means unknown) |
| >> start | n | boolean |  | Robot should be started |
| >> resp_users | y | array |  | List of responsible users emails as list of strings |
| >> md_st | n | array |  |  |
| >>> [] | n |  |  | Aray of dictionaries of data-stream states with stream name as a key and value of type stream_status |
| >> tr_st | n | array |  |  |
| >>> [] | n |  |  | Aray of dictionaries of data-stream states with stream name as a key and value of type stream_status |
| >> re | n | array |  |  |
| >>> [] | n |  |  |  |
| >>>> n | n | string |  | Portfolio name |
| >>>> f | n | boolean |  | Is free or has active orders |
| >>>> re | n | boolean |  | Is resell or re_buy |
| >> c_id | y | string |  | Company unique ID |
| >> comp | y | string |  | Company name |
| >> p_cnt | n | number |  | "Production" transactions count |
| >> v_cnt | n | number |  | "Virtual" transactions count |
| >> trans_cnt | n | array |  |  |
| >>> [] | n |  |  | Array of objects |
| >>>> n | y | string |  | Name |
| >>>> s | y | number |  | Transaction count |
| >>>> a | y | number |  | Adds count |
| >>>> d | y | number |  | Deletes count |
| >>>> m | y | number |  | Moves count |
| >>>> ra | y | number |  | Add rejects count |
| >> p_a | n | number |  | All portfolios |
| >> p_d | n | number |  | Disabled portfolios |
| >> p_e | n | number |  | Expired portfolios |

Example:

```json
{"type":"robot.subscribe","data":{"r_id":"1","value":{"mc":11408,"dt":1677747006000}},"r":"u","eid":"q0","ts":1677747006005445923}
```
</details>    
<details>
<summary>Response on error</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = robot.subscribe | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = e | y | string | request_result | Request result |
| data | y | object |  |  |
| > msg | y | string |  | Error message |
| > code | y | number | err_code | Error code |

Example:

```json
{
	"type":"robot.subscribe",
	"data":
	{
		"msg":"Permission denied",
		"code":555
	},
	"ts":1657693572940145200,
	"eid":"qwerty",
	"r":"e"
}
```
</details>    

### Отписка от робота

Отписаться от событий по роботу

<details>
<summary>Request</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = robot.unsubscribe | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| data | y | object |  |  |
| > sub_eid | y | string | string_36 | Subscription eid |

Example:

```json
{
	"type":"robot.unsubscribe",
	"data":
	{
		"sub_eid":"qwerty"
	},
	"eid":"q"
}
```
</details>    
<details>
<summary>Response on success</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = robot.unsubscribe | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = p | y | string | request_result | Request result |

Example:

```json
{
	"type":"robot.unsubscribe",
	"data":{},
	"r":"p",
	"eid":"q",
	"ts":1669810178671387651
}
```
</details>    
<details>
<summary>Response on error</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = robot.unsubscribe | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = e | y | string | request_result | Request result |
| data | y | object |  |  |
| > msg | y | string |  | Error message |
| > code | y | number | err_code | Error code |

Example:

```json
{
	"type":"robot.unsubscribe",
	"data":
	{
		"msg":"Operation timeout",
		"code":666
	},
	"ts":1657693572940145200,
	"eid":"q",
	"r":"e"
}
```
</details>    

### Подписка на список доступных роботов

При добавлении/удалении робота/доступа к роботу будут высланы обновления

В любой момент может быть выслан снапшот

При отзыве доступа к роботу, если вы подписаны на этот робот, вы получите сообщение об отписке

<details>
<summary>Subscription request</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = available_robot_list.subscribe | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| data | n | object |  |  |

Example:

```json
{
	"type": "available_robot_list.subscribe",
	"data": {},
	"eid": "qwerty"
}
```
</details>    
<details>

<summary>Response on success (snapshot)</summary> 

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = available_robot_list.subscribe | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = s | y | string | request_result | Request result |
| data | y | object |  |  |
| > robots_add | y | array |  | Array of available robots |
| >> [] | y | string |  | Robot ID |
|  |  |  |  |  |

Example:

```json
{
	"type":"available_robot_list.subscribe",
	"data":
	{
		"robots_add":
		[
			"1"
		]
	},
	"r":"s",
	"eid":"qwerty",
	"ts":1669793958010491759
}
```
</details>    
<details>
<summary>Updates</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = available_robot_list.subscribe | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = u | y | string | request_result | Request result |
| data | y | object |  |  |
| > robots_add | n | array |  | Array of newly available robots |
| >> [] |  | string |  | Robot ID |
| > robots_del | n | array |  | Array of robots with revoked access |
| >> [] |  | string |  | Robot ID |

Example:

```json
{
	"type":"available_robot_list.subscribe",
	"data":
	{
		"robots_del":
		[
			"1"
		]
	},
	"r":"u",
	"eid":"qwerty",
	"ts":1669793958010491759
}
```
</details>    
<details>
<summary>Response on error</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = available_robot_list.subscribe | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = e | y | string | request_result | Request result |
| data | y | object |  |  |
| > msg | y | string |  | Error message |
| > code | y | number | err_code | Error code |

Example:

```json
{
	"type":"available_robot_list.subscribe",
	"data":
	{
		"msg":"Operation timeout",
		"code":666
	},
	"ts":1657693572940145200,
	"eid":"qwerty",
	"r":"e"
}
```
</details>    

### Отписка от списка доступных роботов

Отписаться от событий по списку доступных роботов

<details>
<summary>Request</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = available_robot_list.unsubscribe | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| data | y | object |  |  |
| > sub_eid | y | string | string_36 | Subscription eid |

Example:

```json
{
	"type":"available_robot_list.unsubscribe",
	"data":
	{
		"sub_eid":"qwerty"
	},
	"eid":"q"
}
```
</details>    
<details>
<summary>Response on success</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = available_robot_list.unsubscribe | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = p | y | string | request_result | Request result |

Example:

```json
{
	"type":"available_robot_list.unsubscribe",
	"data":{},
	"r":"p",
	"eid":"q",
	"ts":1669810178671387651
}
```
</details>    
<details>
<summary>Response on error</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = available_robot_list.unsubscribe | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = e | y | string | request_result | Request result |
| data | y | object |  |  |
| > msg | y | string |  | Error message |
| > code | y | number | err_code | Error code |

Example:

```json
{
	"type":"available_robot_list.unsubscribe",
	"data":
	{
		"msg":"Operation timeout",
		"code":666
	},
	"ts":1657693572940145200,
	"eid":"q",
	"r":"e"
}
```
</details>    

### Перезапустить робота

Перезапустить не торгующего робота

<details>
<summary>Request</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = robot.restart_robot | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| data | y | object |  |  |
| > r_id | y | string |  | Robot ID |

Example:

```json
{
	"type": "robot.restart_robot",
	"data": {"r_id":"1"},
	"eid": "qwerty"
}
```
</details>    
<details>
<summary>Response on success</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = robot.restart_robot | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = p | y | string | request_result | Request result |
| data | y | object |  |  |

Example:

```json
{
	"type":"robot.restart_robot",
	"data":{},
	"r":"p",
	"eid":"qwerty",
	"ts":1669798613250710705
}
```
</details>    
<details>
<summary>Response on error</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = robot.restart_robot | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = e | y | string | request_result | Request result |
| data | y | object |  |  |
| > msg | y | string |  | Error message |
| > code | y | number | err_code | Error code |

Example:

```json
{
	"type":"robot.restart_robot",
	"data":
	{
		"msg":"Internal error: Robot 1 was not stopped",
		"code":18
	},
	"ts":1657693572940145200,
	"eid":"qwerty",
	"r":"e"
}
```
</details>    

### Изменить робота

<details>
<summary>Request</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = robot.update | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| data | y | object |  |  |
| > r_id | y | string |  | Robot ID |
| > ll | y | string |  | Label |

Example:

```json
{
	"type":"robot.update",
	"data":
	{
		"r_id":"10",
		"ll":"Robot name"
	},
	"eid":"qwe"
}
```
</details>    
<details>
<summary>Response on success</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = robot.update | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = p | y | string | request_result | Request result |

Example:

```json
{"type":"*robot.update*","data":{},"r":"p","eid":"q0","ts":1689672324736098034}
```
</details>    
<details>
<summary>Response on error</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = robot.update | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = e | y | string | request_result | Request result |
| data | y | object |  |  |
| > msg | y | string |  | Error message |
| > code | y | number | err_code | Error code |

Example:

```json
{
	"type":"robot.update",
	"data":
	{
		"msg":"Permission denied",
		"code":555
	},
	"ts":1657693572940145200,
	"eid":"qwerty",
	"r":"e"
}
```
</details>    


## Финрез

### Подписка на таблицу финансовых результатов портфеля

Подписаться на новые записи в таблицу финансовых результатов портфеля

При удалении портфеля вы будете от него отписаны

<details>
<summary>Request</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = portfolio_fin_res.subscribe | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| data | y | object |  |  |
| > r_id | y | string |  | Robot ID |
| > p_id | y | string |  | Portfolio name |

Example:

```json
{
	"type": "portfolio_fin_res.subscribe",
	"data": {
		"r_id": "1",
		"p_id": "test3"
	},
	"eid": "qwerty"
}
```
</details>    
<details>

<summary>Response on success (snapshot)</summary> 

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = portfolio_fin_res.subscribe | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = s | y | string | request_result | Request result |
| data | y | object |  |  |
| > mt | y | string | epoch_nsec | Max time, written in data base |
| > r_id | y | string |  | Robot ID |
| > p_id | y | string |  | Portfolio name |
| > values | y | object |  | Portfolio snapshot |
| >> [] | y | array |  | List of financial results |
| >>> name | y | string |  | Portfolio name |
| >>> r_id | y | string |  | Robot ID |
| >>> id | y | string |  | Unique row id for specified robot |
| >>> is_sl | y | boolean |  | Is stop loss row |
| >>> price | y | number |  | Price |
| >>> buy_sell | y | number | direction | Direction |
| >>> quantity | y | number |  | Integer quantity in number of portfolios |
| >>> virt | y | number |  | Is virtual row (1 — virtual, 0 — not virtual) |
| >>> trs | y | array |  | Trades |
| >>>> sk | y | string |  | SecKey |
| >>>> p | y | number |  | Price |
| >>>> q | y | number |  | Quantity |
| >>>> d | y | number | direction | Direction |
| >>>> ono | y | string |  | Order numebr |
| >>>> dt | y | number | epoch_sec | Date time |
| >>>> ls | y | number | | Lot size |
| >>>> dec | y | number |  | Integer number of decimal points in p field |
| >>> decimals | y | number |  | Integer number of decimal points in price field |
| >>> dt | y | string | epoch_nsec | Time in robot |

Example:

```json
{
    "type": "portfolio_fin_res.subscribe",
    "data": {
        "r_id": "996",
        "p_id": "SUR3",
        "values": [
            {
              "id": "8306733224916030303",
              "dt": "1741779765425606639",
              "r_id": "996",
              "name": "SUR3",
              "price": 167,
              "buy_sell": 2,
              "trs": [
                {
                  "d": 2,
                  "p": 26387,
                  "q": 1,
                  "dt": 1747386550,
                  "ls": 1,
                  "sk": "SNH5",
                  "dec": 4,
                  "ono": "1916875790042287468"
                },
                {
                  "d": 1,
                  "p": 26.22,
                  "q": 10,
                  "t": 1747386550,
                  "ls": 1,
                  "sk": "TQBRSNGS",
                  "dec": 4,
                  "ono": "61888728099"
                }
              ],
              "virt": 0,
              "quantity": 1,
              "is_sl": false,
              "decimals": 1
            },
            {
              "id": "6994715968210568071",
              "dt": "1741778517003271881",
              "r_id": "996",
              "name": "SUR3",
              "price": 136,
              "buy_sell": 2,
              "trs": [
                {
                  "d": 2,
                  "p": 26301,
                  "q": 2,
                  "dt": 1747386550,
                  "ls": 1,
                  "sk": "SNH5",
                  "dec": 4,
                  "ono": "1916875790042277215"
                },
                {
                  "d": 1,
                  "p": 26.165,
                  "q": 20,
                  "dt": 1747386550,
                  "ls": 1,
                  "sk": "TQBRSNGS",
                  "dec": 4,
                  "ono": "61886949087"
                }
              ],
              "virt": 0,
              "quantity": 2,
              "is_sl": true,
              "decimals": 1
            }
        ],
        "mt": 1670930581002172652
    },
    "r": "s",
    "eid": "q0",
    "ts": 1670930582765293894
}
```
</details>    
<details>
<summary>Updates</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = portfolio_fin_res.subscribe | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = u | y | string | request_result | Request result |
| data | y | object |  |  |
| > r_id | y | string |  | Robot ID |
| > p_id | y | string |  | Portfolio name |
| > values | y | object |  | Portfolio snapshot |
| >> [] | y | array |  | List of financial results |
| >>> id | y | string |  | Unique row id for specified robot |
| >>> is_sl | y | boolean |  | Is stop loss row |
| >>> price | y | number |  | Price |
| >>> buy_sell | y | number | direction | Direction |
| >>> quantity | y | number |  | Integer quantity in number of portfolios |
| >>> virt | y | number |  | Is virtual row (1 — virtual, 0 — not virtual) |
| >>> trs | y | array |  | Trades |
| >>>> sk | y | string |  | SecKey |
| >>>> p | y | number |  | Price |
| >>>> q | y | number |  | Quantity |
| >>>> d | y | number | direction | Direction |
| >>>> ono | y | string |  | Order numebr |
| >>>> dt | y | number | epoch_sec | Date time |
| >>>> ls | y | number | | Lot size |
| >>>> dec | y | number |  | Integer number of decimal points in p field |
| >>> decimals | y | number |  | Integer number of decimal points in price field |
| >>> dt | y | string | epoch_nsec | Time in robot |

Example:

```json
{
    "type": "portfolio_fin_res.subscribe",
    "data": {
        "r_id": "996",
        "p_id": "SUR3",
        "values": [
            {
              "id": "8306733224916030303",
              "dt": "1741779765425606639",
              "r_id": "996",
              "name": "SUR3",
              "price": 167,
              "buy_sell": 2,
              "trs": [
                {
                  "d": 2,
                  "p": 26387,
                  "q": 1,
                  "dt": 1747386550,
                  "ls": 1,
                  "sk": "SNH5",
                  "dec": 4,
                  "ono": "1916875790042287468"
                },
                {
                  "d": 1,
                  "p": 26.22,
                  "q": 10,
                  "dt": 1747386550,
                  "ls": 1,
                  "sk": "TQBRSNGS",
                  "dec": 4,
                  "ono": "61888728099"
                }
              ],
              "virt": 0,
              "quantity": 1,
              "is_sl": false,
              "decimals": 1
            },
            {
              "id": "6994715968210568071",
              "dt": "1741778517003271881",
              "r_id": "996",
              "name": "SUR3",
              "price": 136,
              "buy_sell": 2,
              "trs": [
                {
                  "d": 2,
                  "p": 26301,
                  "q": 2,
                  "dt": 1747386550,
                  "ls": 1,
                  "sk": "SNH5",
                  "dec": 4,
                  "ono": "1916875790042277215"
                },
                {
                  "d": 1,
                  "p": 26.165,
                  "q": 20,
                  "dt": 1747386550,
                  "ls": 1,
                  "sk": "TQBRSNGS",
                  "dec": 4,
                  "ono": "61886949087"
                }
              ],
              "virt": 0,
              "quantity": 2,
              "is_sl": true,
              "decimals": 1
            }
        ]
    },
    "r": "u",
    "eid": "q0",
    "ts": 1670930583002402981
}
```
</details>    
<details>
<summary>Response on error</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = portfolio_fin_res.subscribe | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = e | y | string | request_result | Request result |
| data | y | object |  |  |
| > msg | y | string |  | Error message |
| > code | y | number | err_code | Error code |

Example:

```json
{
	"type":"portfolio_fin_res.subscribe",
	"data":
	{
		"msg":"Permission denied",
		"code":555
	},
	"ts":1657693572940145200,
	"eid":"qwerty",
	"r":"e"
}
```
</details>    

### Отписка от таблицы финансовых результатов портфеля

Отписаться от таблицы финансовых результатов портфеля

<details>
<summary>Request</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = portfolio_fin_res.unsubscribe | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| data | y | object |  |  |
| > sub_eid | y | string | string_36 | Subscription eid |

Example:

```json
{
	"type":"portfolio_fin_res.unsubscribe",
	"data":
	{
		"sub_eid":"qwerty"
	},
	"eid":"q"
}
```
</details>    
<details>
<summary>Response on success</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = portfolio_fin_res.unsubscribe | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = p | y | string | request_result | Request result |

Example:

```json
{
	"type":"portfolio_fin_res.unsubscribe",
	"data":{},
	"r":"p",
	"eid":"q",
	"ts":1669810178671387651
}
```
</details>    
<details>
<summary>Response on error</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = portfolio_fin_res.unsubscribe | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = e | y | string | request_result | Request result |
| data | y | object |  |  |
| > msg | y | string |  | Error message |
| > code | y | number | err_code | Error code |

Example:

```json
{
	"type":"portfolio_fin_res.unsubscribe",
	"data":
	{
		"msg":"Operation timeout",
		"code":666
	},
	"ts":1657693572940145200,
	"eid":"q",
	"r":"e"
}
```
</details>    

### Запрос истории финансовых результатов портфеля

Получить “небольшую” историю старше заданной даты

<details>
<summary>Request</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = portfolio_fin_res.get_previous | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| data | y | object |  |  |
| > r_id | y | string |  | Robot ID |
| > p_id | n | string |  | Portfolio name (use be empty string or null to remove filter) |
| > mt | y | string | epoch_nsec | Receive rows “older” than this value |
| > lim | n | number |  | Number of rows to receive in range [1, 100], default value is 100 |

Example:

```json
{
	"type": "portfolio_fin_res.get_previous",
	"data": {
		"r_id": "1",
		"p_id": "test2",
		"mt": "2000000000000000000",
		"lim": 100
	},
	"eid": "qwerty"
}
```
</details>    
<details>
<summary>Response on success</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = portfolio_fin_res.get_previous | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = p | y | string | request_result | Request result |
| data | y | object |  |  |
| > values | y | object |  | Portfolio snapshot |
| >> [] | y | array |  | List of financial results |
| >>> name | y | string |  | Portfolio name |
| >>> r_id | y | string |  | Robot ID |
| >>> id | y | string |  | Unique row id for specified robot |
| >>> is_sl | y | boolean |  | Is stop loss row |
| >>> price | y | number |  | Price |
| >>> buy_sell | y | number | direction | Direction |
| >>> quantity | y | number |  | Integer quantity in number of portfolios |
| >>> virt | y | number |  | Is virtual row (1 — virtual, 0 — not virtual) |
| >>> trs | y | array |  | Trades |
| >>>> sk | y | string |  | SecKey |
| >>>> p | y | number |  | Price |
| >>>> q | y | number |  | Quantity |
| >>>> d | y | number | direction | Direction |
| >>>> ono | y | string |  | Order numebr |
| >>>> dt | y | number | epoch_sec | Date time |
| >>>> ls | y | number |  | Lot size |
| >>>> dec | y | number |  | Integer number of decimal points in p field |
| >>> decimals | y | number |  | Integer number of decimal points in price field |
| >>> dt | y | string | epoch_nsec | Time in robot |

Example:

```json
{
    "type": "portfolio_fin_res.get_previous",
    "data": {
        "values": [
            {
              "id": "8306733224916030303",
              "dt": "1741779765425606639",
              "r_id": "996",
              "name": "SUR3",
              "price": 167,
              "buy_sell": 2,
              "trs": [
                {
                  "d": 2,
                  "p": 26387,
                  "q": 1,
                  "dt": 1747386550,
                  "ls": 1,
                  "sk": "SNH5",
                  "dec": 4,
                  "ono": "1916875790042287468"
                },
                {
                  "d": 1,
                  "p": 26.22,
                  "q": 10,
                  "dt": 1747386550,
                  "ls": 1,
                  "sk": "TQBRSNGS",
                  "dec": 4,
                  "ono": "61888728099"
                }
              ],
              "virt": 0,
              "quantity": 1,
              "is_sl": false,
              "decimals": 1
            },
            {
              "id": "6994715968210568071",
              "dt": "1741778517003271881",
              "r_id": "996",
              "name": "SUR3",
              "price": 136,
              "buy_sell": 2,
              "trs": [
                {
                  "d": 2,
                  "p": 26301,
                  "q": 2,
                  "dt": 1747386550,
                  "ls": 1,
                  "sk": "SNH5",
                  "dec": 4,
                  "ono": "1916875790042277215"
                },
                {
                  "d": 1,
                  "p": 26.165,
                  "q": 20,
                  "dt": 1747386550,
                  "ls": 1,
                  "sk": "TQBRSNGS",
                  "dec": 4,
                  "ono": "61886949087"
                }
              ],
              "virt": 0,
              "quantity": 2,
              "is_sl": true,
              "decimals": 1
            }
        ]
    },
    "r": "p",
    "eid": "q0",
    "ts": 1676366276382789596
}
```
</details>    
<details>
<summary>Response on error</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = portfolio_fin_res.get_previous | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = e | y | string | request_result | Request result |
| data | y | object |  |  |
| > msg | y | string |  | Error message |
| > code | y | number | err_code | Error code |

Example:

```json
{
	"type":"portfolio_fin_res.get_previous",
	"data":
	{
		"msg":"Permission denied",
		"code":555
	},
	"ts":1657693572940145200,
	"eid":"qwerty",
	"r":"e"
}
```
</details>    

### Запрос истории финансовых результатов портфеля 2

Получить историю от даты до даты

<details>
<summary>Request</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = portfolio_fin_res.get_history | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| data | y | object |  |  |
| > r_id | y | string |  | Robot ID |
| > p_id | n | string |  | Portfolio name (use be empty string or null to remove filter) |
| > mint | y | string | epoch_nsec | Receive rows “newer” or equal than this value |
| > maxt | y | string | epoch_nsec | Receive rows “older” or equal than this value |
| > lim | n | number |  | Number of rows to receive in range [1, 100000], default value is 100000 |

Example:

```json
{
	"type": "portfolio_fin_res.get_history",
	"data": {
		"r_id": "1",
		"p_id": "test2",
		"maxt": "2000000000000000000",
		"mint": "1",
		"lim": 100
	},
	"eid": "qwerty"
}
```
</details>    
<details>
<summary>Response on success</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = portfolio_fin_res.get_history | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = p | y | string | request_result | Request result |
| data | y | object |  |  |
| > values | y | object |  | Portfolio snapshot |
| >> [] | y | array |  | List of financial results |
| >>> name | y | string |  | Portfolio name |
| >>> r_id | y | string |  | Robot ID |
| >>> id | y | string |  | Unique row id for specified robot |
| >>> is_sl | y | boolean |  | Is stop loss row |
| >>> price | y | number |  | Price |
| >>> buy_sell | y | number | direction | Direction |
| >>> quantity | y | number |  | Integer quantity in number of portfolios |
| >>> virt | y | number |  | Is virtual row (1 — virtual, 0 — not virtual) |
| >>> trs | y | array |  | Trades |
| >>>> sk | y | string |  | SecKey |
| >>>> p | y | number |  | Price |
| >>>> q | y | number |  | Quantity |
| >>>> d | y | number | direction | Direction |
| >>>> ono | y | string |  | Order numebr |
| >>>> dt | y | number | epoch_sec | Date time |
| >>>> ls | y | number |  | Lot size |
| >>>> dec | y | number |  | Integer number of decimal points in p field |
| >>> decimals | y | number |  | Integer number of decimal points in price field |
| >>> dt | y | string | epoch_nsec | Time in robot |

Example:

```json
{
    "type": "portfolio_fin_res.get_history",
    "data": {
        "values": [
            {
              "id": "8306733224916030303",
              "dt": "1741779765425606639",
              "r_id": "996",
              "name": "SUR3",
              "price": 167,
              "buy_sell": 2,
              "trs": [
                {
                  "d": 2,
                  "p": 26387,
                  "q": 1,
                  "dt": 1747386550,
                  "ls": 1,
                  "sk": "SNH5",
                  "dec": 4,
                  "ono": "1916875790042287468"
                },
                {
                  "d": 1,
                  "p": 26.22,
                  "q": 10,
                  "dt": 1747386550,
                  "ls": 1,
                  "sk": "TQBRSNGS",
                  "dec": 4,
                  "ono": "61888728099"
                }
              ],
              "virt": 0,
              "quantity": 1,
              "is_sl": false,
              "decimals": 1
            },
            {
              "id": "6994715968210568071",
              "dt": "1741778517003271881",
              "r_id": "996",
              "name": "SUR3",
              "price": 136,
              "buy_sell": 2,
              "trs": [
                {
                  "d": 2,
                  "p": 26301,
                  "q": 2,
                  "dt": 1747386550,
                  "ls": 1,
                  "sk": "SNH5",
                  "dec": 4,
                  "ono": "1916875790042277215"
                },
                {
                  "d": 1,
                  "p": 26.165,
                  "q": 20,
                  "dt": 1747386550,
                  "ls": 1,
                  "sk": "TQBRSNGS",
                  "dec": 4,
                  "ono": "61886949087"
                }
              ],
              "virt": 0,
              "quantity": 2,
              "is_sl": true,
              "decimals": 1
            }
        ]
    },
    "r": "p",
    "eid": "q0",
    "ts": 1676366276382789596
}
```
</details>    
<details>
<summary>Response on error</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = portfolio_fin_res.get_history | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = e | y | string | request_result | Request result |
| data | y | object |  |  |
| > msg | y | string |  | Error message |
| > code | y | number | err_code | Error code |

Example:

```json
{
	"type":"portfolio_fin_res.get_history",
	"data":
	{
		"msg":"Permission denied",
		"code":555
	},
	"ts":1657693572940145200,
	"eid":"qwerty",
	"r":"e"
}
```
</details>    

### Подсчет средних финансовых результатов портфеля за период

<details>
<summary>Request</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = portfolio_fin_res.calc_acg | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| data | y | object |  |  |
| > r_id | y | string |  | Robot ID |
| > p_id | y | string |  | Portfolio name |
| > mint | y | string | epoch_nsec | Use rows “newer” or equal than this value |
| > maxt | y | string | epoch_nsec | Use rows “older” or equal than this value |

Example:

```json
{
	"type": "portfolio_fin_res.calc_avg",
	"data": {
		"r_id": "1",
		"p_id": "test2",
		"mint": "0",
		"maxt": "2000000000000000000"
	},
	"eid": "qwerty"
}
```
</details>    
<details>
<summary>Response on success</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = portfolio_fin_res.calc_avg | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = p | y | string | request_result | Request result |
| data | y | object |  |  |
| > avg | y | object |  | Portfolio snapshot |
| >> dec | y | number |  | Decimals |
| >> amount_buy | y | number |  | Buy amount |
| >> amount_sell | y | number |  | Sell amount |
| >> avg_buy | y | number |  | Average buy price |
| >> avg_sell | y | number |  | Average sell price |
| >> buy | y | array |  | Buy deals |
| >>> [] |  |  |  |  |
| >>>> d | y | number | direction | Direction |
| >>>> sk | y | string |  | SecKey |
| >>>> p | y | number |  | Price |
| >>>> dec | y | number |  | Decimals |
| >>>> q | y | number |  | Quantity |
| >>>> ls | y | number |  | Lot size |
| >> sell | y | array |  | Sell deals |
| >>> [] |  |  |  |  |
| >>>> d | y | number | direction | Direction |
| >>>> sk | y | string |  | SecKey |
| >>>> p | y | number |  | Price |
| >>>> dec | y | number |  | Decimals |
| >>>> q | y | number |  | Quantity |
| >>>> ls | y | number |  | Lot size |

Example:

```json
{
    "type": "portfolio_fin_res.calc_avg",
    "data": {
        "avg": {
            "dec": 4,
            "amount_buy": 2,
            "amount_sell": 4,
            "avg_sell": 0.535075,
            "avg_buy": 0.5352
        },
        "buy": [
            {
                "d": 1,
                "sk": "OKF_1INCH_USDT_SWAP",
                "p": 0.27625,
                "dec": 4,
                "q": 2
            },
            {
                "d": 1,
                "sk": "OKF_ADA_USDT_SWAP",
                "p": 0.25895,
                "dec": 4,
                "q": 2
            }
        ],
        "sell": [
            {
                "d": 1,
                "sk": "OKF_1INCH_USDT_SWAP",
                "p": 0.27615,
                "dec": 4,
                "q": 4
            },
            {
                "d": 1,
                "sk": "OKF_ADA_USDT_SWAP",
                "p": 0.258925,
                "dec": 4,
                "q": 4
            }
        ]
    },
    "r": "p",
    "eid": "q0",
    "ts": 1687247128675656052
}
```
</details>    
<details>
<summary>Response on error</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = portfolio_fin_res.calc_avg | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = e | y | string | request_result | Request result |
| data | y | object |  |  |
| > msg | y | string |  | Error message |
| > code | y | number | err_code | Error code |

Example:

```json
{
	"type":"portfolio_fin_res.calc_avg",
	"data":
	{
		"msg":"Permission denied",
		"code":555
	},
	"ts":1657693572940145200,
	"eid":"qwerty",
	"r":"e"
}
```
</details>    

## Сделки

### Подписка на сделки портфеля

Подписаться на новые записи в таблицу сделок портфеля

При удалении портфеля вы будете от него отписаны

<details>
<summary>Request</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = portfolio_deals.subscribe | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| data | y | object |  |  |
| > r_id | y | string |  | Robot ID |
| > p_id | y | string |  | Portfolio name |

Example:

```json
{
	"type": "portfolio_deals.subscribe",
	"data": {
		"r_id": "1",
		"p_id": "test3"
	},
	"eid": "qwerty"
}
```
</details>    
<details>

<summary>Response on success (snapshot)</summary> 

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = portfolio_deals.subscribe | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = s | y | string | request_result | Request result |
| data | y | object |  |  |
| > mt | y | string | epoch_nsec | Max time, written in data base |
| > r_id | y | string |  | Robot ID |
| > p_id | y | string |  | Portfolio name |
| > values | y | object |  | Portfolio snapshot |
| >> [] | y | array |  | List of financial results |
| >>> name | y | string |  | Portfolio name |
| >>> r_id | y | string |  | Robot ID |
| >>> id | y | string |  | Unique row id for specified robot |
| >>> ono | y | string |  | Internal order number |
| >>> price | y | number |  | Deal price |
| >>> orig_price | y | number |  | Original order price |
| >>> buy_sell | y | number | direction | Deal direction |
| >>> quantity | y | number |  | Integer deal quantity |
| >>> cn | y | string |  | Transactional connection name |
| >>> sec | y | string |  | Security unique key |
| >>> decimals | y | number |  | Integer number of decimal points in price field |
| >>> dt | y | string | epoch_nsec | Time in robot |
| >>> curpos | y | number |  | Integer portfolio security position |
| >>> lot_size | y | number |  | Lot size |

Example:

```json
{
    "type": "portfolio_deals.subscribe",
    "data": {
        "r_id": "1",
        "p_id": "test3",
        "values": [
            {
                "ono": 0,
                "sec": "BTC",
                "name": "test3",
                "price": 1,
                "buy_sell": 1,
                "quantity": 1,
                "decimals": 4,
                "cn": "virtual",
                "id": -7788782202760318740,
                "t": 1670932198000080090,
                "dt": 1670932198001653551,
                "lot_size": 1e-8,
		"curpos": 1,
                "r_id": "1"
            },
            {
                "ono": 0,
                "sec": "BTC",
                "name": "test3",
                "price": 1,
                "buy_sell": 1,
                "quantity": 1,
                "decimals": 4,
                "cn": "virtual",
                "id": -3752825875325269453,
                "t": 1670932199000047295,
                "dt": 1670932199001713057,
                "lot_size": 1e-8,
		"curpos": 1,
                "r_id": "1"
            },
            {
                "ono": 0,
                "sec": "BTC",
                "name": "test3",
                "price": 1,
                "buy_sell": 1,
                "quantity": 1,
                "decimals": 4,
                "cn": "virtual",
                "id": -3688175048979008805,
                "t": 1670932200000058955,
                "dt": 1670932200001680729,
                "lot_size": 1e-8,
		"curpos": 1,
                "r_id": "1"
            },
            {
                "ono": 0,
                "sec": "BTC",
                "name": "test3",
                "price": 1,
                "buy_sell": 1,
                "quantity": 1,
                "decimals": 4,
                "cn": "virtual",
                "id": 3502271702100740780,
                "t": 1670932201000080655,
                "dt": 1670932201001754776,
                "lot_size": 1e-8,
		"curpos": 1,
                "r_id": "1"
            }
        ],
        "mt": 1670932197144479740
    },
    "r": "s",
    "eid": "q0",
    "ts": 1670932201695689426
}
```
</details>    
<details>
<summary>Updates</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = portfolio_deals.subscribe | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = u | y | string | request_result | Request result |
| data | y | object |  |  |
| > r_id | y | string |  | Robot ID |
| > p_id | y | string |  | Portfolio name |
| > values | y | object |  | Portfolio snapshot |
| >> [] | y | array |  | List of financial results |
| >>> id | y | string |  | Unique row id for specified robot |
| >>> ono | y | string |  | Internal order number |
| >>> price | y | number |  | Deal price |
| >>> orig_price | y | number |  | Original order price |
| >>> buy_sell | y | number | direction | Deal direction |
| >>> quantity | y | number |  | Integer deal quantity |
| >>> cn | y | string |  | Transactional connection name |
| >>> sec | y | string |  | Security unique key |
| >>> decimals | y | number |  | Integer number of decimal points in price field |
| >>> dt | y | string | epoch_nsec | Time in robot |
| >>> curpos | y | number |  | Integer portfolio security position |
| >>> lot_size | y | number |  | Lot size |

Example:

```json
{
    "type": "portfolio_deals.subscribe",
    "data": {
        "r_id": "1",
        "p_id": "test3",
        "values": [
            {
                "ono": 0,
                "sec": "BTC",
                "price": 1,
                "buy_sell": 1,
                "quantity": 1,
                "decimals": 4,
                "cn": "virtual",
                "id": -3735218779281737327,
                "t": 1670932204000081702,
                "lot_size": 1e-8,
		"curpos": 1,
                "dt": 1670932204001796726
            }
        ]
    },
    "r": "u",
    "eid": "q0",
    "ts": 1670932204002772953
}
```
</details>    
<details>
<summary>Response on error</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = portfolio_deals.subscribe | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = e | y | string | request_result | Request result |
| data | y | object |  |  |
| > msg | y | string |  | Error message |
| > code | y | number | err_code | Error code |

Example:

```json
{
	"type":"portfolio_fin_res.subscribe",
	"data":
	{
		"msg":"Permission denied",
		"code":555
	},
	"ts":1657693572940145200,
	"eid":"qwerty",
	"r":"e"
}
```
</details>    

### Отписка от сделок портфеля

Отписаться от таблицы сделок портфеля

<details>
<summary>Request</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = portfolio_deals.unsubscribe | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| data | y | object |  |  |
| > sub_eid | y | string | string_36 | Subscription eid |

Example:

```json
{
	"type":"portfolio_deals.unsubscribe",
	"data":
	{
		"sub_eid":"qwerty"
	},
	"eid":"q"
}
```
</details>    
<details>
<summary>Response on success</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = portfolio_deals.unsubscribe | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = p | y | string | request_result | Request result |

Example:

```json
{
	"type":"portfolio_deals.unsubscribe",
	"data":{},
	"r":"p",
	"eid":"q",
	"ts":1669810178671387651
}
```
</details>    
<details>
<summary>Response on error</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = portfolio_deals.unsubscribe | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = e | y | string | request_result | Request result |
| data | y | object |  |  |
| > msg | y | string |  | Error message |
| > code | y | number | err_code | Error code |

Example:

```json
{
	"type":"portfolio_deals.unsubscribe",
	"data":
	{
		"msg":"Operation timeout",
		"code":666
	},
	"ts":1657693572940145200,
	"eid":"q",
	"r":"e"
}
```
</details>    

### Запрос истории сделок портфеля

Получить “небольшую” историю старше заданной даты

<details>
<summary>Request</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = portfolio_deals.get_previous | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| data | y | object |  |  |
| > r_id | y | string |  | Robot ID |
| > p_id | y | string |  | Portfolio name |
| > sec_key | n | string |  | SecKey name |
| > mt | y | string | epoch_nsec | Receive rows “older” than this value |
| > lim | n | number |  | Number of rows to receive in range [1, 100], default value is 100 |

Example:

```json
{
	"type": "portfolio_deals.get_previous",
	"data": {
		"r_id": "1",
		"p_id": "test2",
		"mt": "2000000000000000000",
		"lim": 100
	},
	"eid": "qwerty"
}
```
</details>    
<details>
<summary>Response on success</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = portfolio_deals.get_previous | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = p | y | string | request_result | Request result |
| data | y | object |  |  |
| > r_id | y | string |  | Robot ID |
| > p_id | y | string |  | Portfolio name |
| > values | y | object |  | Portfolio snapshot |
| >> [] | y | array |  | List of financial results |
| >>> name | y | string |  | Portfolio name |
| >>> r_id | y | string |  | Robot ID |
| >>> id | y | string |  | Unique row id for specified robot |
| >>> ono | y | string |  | Internal order number |
| >>> price | y | number |  | Deal price |
| >>> orig_price | y | number |  | Original order price |
| >>> buy_sell | y | number | direction | Deal direction |
| >>> quantity | y | number |  | Integer deal quantity |
| >>> cn | y | string |  | Transactional connection name |
| >>> sec | y | string |  | Security unique key |
| >>> decimals | y | number |  | Integer number of decimal points in price field |
| >>> dt | y | string | epoch_nsec | Time in robot |
| >>> curpos | y | number |  | Integer portfolio security position |
| >>> lot_size | y | number |  | Lot size |

Example:

```json
{
    "type": "portfolio_deals.get_previous",
    "data": {
        "values": [
            {
                "id": "3721227031066024688",
                "dt": "1676360033000144435",
                "r_id": "1",
                "name": "test2",
                "ono": "0",
                "sec": "BTC",
                "price": 1,
                "buy_sell": 1,
                "quantity": 1,
                "cn": "virtual",
                "lot_size": 1e-8,
		"curpos": 1,
                "decimals": 4
            },
            {
                "id": "2474504404744141531",
                "dt": "1676360032000123654",
                "r_id": "1",
                "name": "test2",
                "ono": "0",
                "sec": "BTC",
                "price": 1,
                "buy_sell": 1,
                "quantity": 1,
                "cn": "virtual",
                "lot_size": 1e-8,
		"curpos": 1,
                "decimals": 4
            },
            {
                "id": "3876343940139371326",
                "dt": "1676360031000162174",
                "r_id": "1",
                "name": "test2",
                "ono": "0",
                "sec": "BTC",
                "price": 1,
                "buy_sell": 1,
                "quantity": 1,
                "cn": "virtual",
                "lot_size": 1e-8,
		"curpos": 1,
                "decimals": 4
            },
            {
                "id": "-1618157002193750741",
                "dt": "1676360030000188693",
                "r_id": "1",
                "name": "test2",
                "ono": "0",
                "sec": "BTC",
                "price": 1,
                "buy_sell": 1,
                "quantity": 1,
                "cn": "virtual",
                "lot_size": 1e-8,
		"curpos": 1,
                "decimals": 4
            },
            {
                "id": "2390688254517194909",
                "dt": "1676360029000183395",
                "r_id": "1",
                "name": "test2",
                "ono": "0",
                "sec": "BTC",
                "price": 1,
                "buy_sell": 1,
                "quantity": 1,
                "cn": "virtual",
                "lot_size": 1e-8,
		"curpos": 1,
                "decimals": 4
            }
        ]
    },
    "r": "p",
    "eid": "q0",
    "ts": 1676366845413318695
}
```
</details>    
<details>
<summary>Response on error</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = portfolio_deals.get_previous | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = e | y | string | request_result | Request result |
| data | y | object |  |  |
| > msg | y | string |  | Error message |
| > code | y | number | err_code | Error code |

Example:

```json
{
	"type":"portfolio_fin_res.get_previous",
	"data":
	{
		"msg":"Permission denied",
		"code":555
	},
	"ts":1657693572940145200,
	"eid":"qwerty",
	"r":"e"
}
```
</details>    

### Запрос списка уникальных бумаг из истории сделок портфеля

Получить уникальные бумаги из истории сделок по портфелям

<details>
<summary>Request</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = portfolio_deals.get_sec_keys | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| data | y | object |  |  |
| > r_id | y | string |  | Robot ID |
| > p_id | y | string |  | Portfolio name |

Example:

```json
{
	"type": "portfolio_deals.get_sec_keys",
	"data": {
		"r_id": "1",
		"p_id": "test2"
	},
	"eid": "qwerty"
}
```
</details>    
<details>
<summary>Response on success</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = portfolio_deals.get_sec_keys | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = p | y | string | request_result | Request result |
| data | y | object |  |  |
| > r_id | y | string |  | Robot ID |
| > p_id | y | string |  | Portfolio name |
| > values | y | object |  | Portfolio snapshot |
| >> [] | y | array |  | List of sec_keys |

Example:

```json
{
    "type": "portfolio_deals.get_sec_keys",
    "data": {
        "values": [
            "BTC"
        ]
    },
    "r": "p",
    "eid": "q0",
    "ts": 1676366845413318695
}
```
</details>    
<details>
<summary>Response on error</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = portfolio_deals.get_sec_keys | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = e | y | string | request_result | Request result |
| data | y | object |  |  |
| > msg | y | string |  | Error message |
| > code | y | number | err_code | Error code |

Example:

```json
{
	"type":"portfolio_fin_res.get_sec_keys",
	"data":
	{
		"msg":"Permission denied",
		"code":555
	},
	"ts":1657693572940145200,
	"eid":"qwerty",
	"r":"e"
}
```
</details>    

### Запрос истории сделок портфеля 2

Получить историю от даты до даты

<details>
<summary>Request</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = portfolio_deals.get_history | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| data | y | object |  |  |
| > r_id | y | string |  | Robot ID |
| > p_id | y | string |  | Portfolio name |
| > sec_key | n | string |  | SecKey name |
| > mint | y | string | epoch_nsec | Receive rows “newer” or equal than this value |
| > maxt | y | string | epoch_nsec | Receive rows “older” or equal than this value |
| > lim | n | number |  | Number of rows to receive in range [1, 100000], default value is 100000 |

Example:

```json
{
	"type": "portfolio_deals.get_history",
	"data": {
		"r_id": "1",
		"p_id": "test2",
		"maxt": "2000000000000000000",
		"mint": "1",
		"lim": 100
	},
	"eid": "qwerty"
}
```
</details>    
<details>
<summary>Response on success</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = portfolio_deals.get_history | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = p | y | string | request_result | Request result |
| data | y | object |  |  |
| > r_id | y | string |  | Robot ID |
| > p_id | y | string |  | Portfolio name |
| > values | y | object |  | Portfolio snapshot |
| >> [] | y | array |  | List of financial results |
| >>> name | y | string |  | Portfolio name |
| >>> r_id | y | string |  | Robot ID |
| >>> id | y | string |  | Unique row id for specified robot |
| >>> ono | y | string |  | Internal order number |
| >>> price | y | number |  | Deal price |
| >>> orig_price | y | number |  | Original order price |
| >>> buy_sell | y | number | direction | Deal direction |
| >>> quantity | y | number |  | Integer deal quantity |
| >>> cn | y | string |  | Transactional connection name |
| >>> sec | y | string |  | Security unique key |
| >>> decimals | y | number |  | Integer number of decimal points in price field |
| >>> dt | y | string | epoch_nsec | Time in robot |
| >>> curpos | y | number |  | Integer portfolio security position |
| >>> lot_size | y | number |  | Lot size |

Example:

```json
{
    "type": "portfolio_deals.get_history",
    "data": {
        "values": [
            {
                "id": "3721227031066024688",
                "dt": "1676360033000144435",
                "r_id": "1",
                "name": "test2",
                "ono": "0",
                "sec": "BTC",
                "price": 1,
                "buy_sell": 1,
                "quantity": 1,
                "cn": "virtual",
                "lot_size": 1e-8,
		"curpos": 1,
                "decimals": 4
            },
            {
                "id": "2474504404744141531",
                "dt": "1676360032000123654",
                "r_id": "1",
                "name": "test2",
                "ono": "0",
                "sec": "BTC",
                "price": 1,
                "buy_sell": 1,
                "quantity": 1,
                "cn": "virtual",
                "lot_size": 1e-8,
		"curpos": 1,
                "decimals": 4
            },
            {
                "id": "3876343940139371326",
                "dt": "1676360031000162174",
                "r_id": "1",
                "name": "test2",
                "ono": "0",
                "sec": "BTC",
                "price": 1,
                "buy_sell": 1,
                "quantity": 1,
                "cn": "virtual",
                "lot_size": 1e-8,
		"curpos": 1,
                "decimals": 4
            },
            {
                "id": "-1618157002193750741",
                "dt": "1676360030000188693",
                "r_id": "1",
                "name": "test2",
                "ono": "0",
                "sec": "BTC",
                "price": 1,
                "buy_sell": 1,
                "quantity": 1,
                "cn": "virtual",
                "lot_size": 1e-8,
		"curpos": 1,
                "decimals": 4
            },
            {
                "id": "2390688254517194909",
                "dt": "1676360029000183395",
                "r_id": "1",
                "name": "test2",
                "ono": "0",
                "sec": "BTC",
                "price": 1,
                "buy_sell": 1,
                "quantity": 1,
                "cn": "virtual",
                "lot_size": 1e-8,
		"curpos": 1,
                "decimals": 4
            }
        ]
    },
    "r": "p",
    "eid": "q0",
    "ts": 1676366845413318695
}
```
</details>    
<details>
<summary>Response on error</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = portfolio_deals.get_history | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = e | y | string | request_result | Request result |
| data | y | object |  |  |
| > msg | y | string |  | Error message |
| > code | y | number | err_code | Error code |

Example:

```json
{
	"type":"portfolio_fin_res.get_history",
	"data":
	{
		"msg":"Permission denied",
		"code":555
	},
	"ts":1657693572940145200,
	"eid":"qwerty",
	"r":"e"
}
```
</details>    

## Логи

### Подписка на логи портфеля

Подписаться на новые записи в таблицу логов портфеля

При удалении портфеля вы будете от него отписаны

Даже если логи идут с нужного портфеля, то вам они попадут только если email "автора" этой записи в лог пустой (т.е. лог общий) или email "автора" совпадает с email-ом с которого авторизован вебсокет или если роль, под которой авторизован вебсокет, помечена как роль, которой доступны все логи

<details>
<summary>Request</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = portfolio_logs.subscribe | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| data | y | object |  |  |
| > r_id | y | string |  | Robot ID |

Example:

```json
{
	"type": "portfolio_logs.subscribe",
	"data": {
		"r_id": "1",
		"p_id": "test3"
	},
	"eid": "qwerty"
}
```
</details>    
<details>

<summary>Response on success (snapshot)</summary> 

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = portfolio_logs.subscribe | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = s | y | string | request_result | Request result |
| data | y | object |  |  |
| > mt | y | number | epoch_nsec | Max time, written in data base |
| > r_id | y | string |  | Robot ID |
| > p_id | y | string |  | Portfolio name |
| > values | y | object |  | Portfolio snapshot |
| >> [] | y | array |  | List of financial results |
| >>> name | y | string |  | Portfolio name |
| >>> id | y | string |  | Log message ID |
| >>> r_id | y | string |  | Robot ID |
| >>> level | y | number | log_level | Log level |
| >>> msg | y | string |  | Message |
| >>> owner | n | string |  | Message initiator, can be empty string or null |
| >>> t | y | number | epoch_nsec | Time in robot |
| >>> dt | y | number | epoch_nsec | Receive time of backend |

Example:

```json
{
    "type": "portfolio_logs.subscribe",
    "data": {
        "r_id": "1",
        "p_id": "test3",
        "values": [
            {
                "level": 0,
                "name": "test3",
                "msg": "Portfolio \"test3\" was added by test@gmail.com",
                "t": 1671194453000712498,
                "dt": 1671194453006554913,
                "r_id": "1"
            },
            {
                "level": 5,
                "name": "test3",
                "owner": "",
                "msg": "with owner",
                "t": 1671194454000077684,
                "dt": 1671194454001630241,
                "r_id": "1"
            },
            {
                "level": 5,
                "name": "test3",
                "owner": "",
                "msg": "with owner",
                "t": 1671194455000037908,
                "dt": 1671194455001268250,
                "r_id": "1"
            }
        ],
        "mt": 1671194446799559398
    },
    "r": "s",
    "eid": "q0",
    "ts": 1671194455524948386
}
```
</details>    
<details>
<summary>Updates</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = portfolio_logs.subscribe | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = u | y | string | request_result | Request result |
| data | y | object |  |  |
| > r_id | y | string |  | Robot ID |
| > p_id | y | string |  | Portfolio name |
| > values | y | object |  | Portfolio snapshot |
| >> [] | y | array |  | List of financial results |
| >>> level | y | number | log_level | Log level |
| >>> id | y | string |  | Log message ID |
| >>> msg | y | string |  | Message |
| >>> owner | n | string |  | Message initiator, can be empty string or null |
| >>> t | y | number | epoch_nsec | Time in robot |
| >>> dt | y | number | epoch_nsec | Receive time of backend |

Example:

```json
{
    "type": "portfolio_logs.subscribe",
    "data": {
        "r_id": "1",
        "p_id": "test3",
        "values": [
            {
                "level": 5,
                "owner": "",
                "msg": "with owner",
                "t": 1671194458000035338,
                "dt": 1671194458000994686
            }
        ]
    },
    "r": "u",
    "eid": "q0",
    "ts": 1671194458001748066
}
```
</details>    
<details>
<summary>Response on error</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = portfolio_logs.subscribe | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = e | y | string | request_result | Request result |
| data | y | object |  |  |
| > msg | y | string |  | Error message |
| > code | y | number | err_code | Error code |

Example:

```json
{
	"type":"portfolio_logs.subscribe",
	"data":
	{
		"msg":"Permission denied",
		"code":555
	},
	"ts":1657693572940145200,
	"eid":"qwerty",
	"r":"e"
}
```
</details>    

### Отписка от логов портфеля

Отписаться от логов портфеля

<details>
<summary>Request</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = portfolio_logs.unsubscribe | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| data | y | object |  |  |
| > sub_eid | y | string | string_36 | Subscription eid |

Example:

```json
{
	"type":"portfolio_logs.unsubscribe",
	"data":
	{
		"sub_eid":"qwerty"
	},
	"eid":"q"
}
```
</details>    
<details>
<summary>Response on success</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = portfolio_logs.unsubscribe | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = p | y | string | request_result | Request result |

Example:

```json
{
	"type":"portfolio_logs.unsubscribe",
	"data":{},
	"r":"p",
	"eid":"q",
	"ts":1669810178671387651
}
```
</details>    
<details>
<summary>Response on error</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = portfolio_logs.unsubscribe | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = e | y | string | request_result | Request result |
| data | y | object |  |  |
| > msg | y | string |  | Error message |
| > code | y | number | err_code | Error code |

Example:

```json
{
	"type":"portfolio_logs.unsubscribe",
	"data":
	{
		"msg":"Operation timeout",
		"code":666
	},
	"ts":1657693572940145200,
	"eid":"q",
	"r":"e"
}
```
</details>    

### Подписка на логи робота

Подписаться на новые записи в таблицу логов робота

При удалении робота вы будете от него отписаны

Даже если логи идут с нужного робота, то вам они попадут только если email "автора" этой записи в лог пустой (т.е. лог общий) или email "автора" совпадает с email-ом с которого авторизован вебсокет или если роль, под которой авторизован вебсокет, помечена как роль, которой доступны все логи

<details>
<summary>Request</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = robot_logs.subscribe | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| data | y | object |  |  |
| > r_id | y | string |  | Robot ID |

Example:

```json
{
	"type": "robot_logs.subscribe",
	"data": {
		"r_id": "1"
	},
	"eid": "qwerty"
}
```
</details>    
<details>

<summary>Response on success (snapshot)</summary> 

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = robot_logs.subscribe | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = s | y | string | request_result | Request result |
| data | y | object |  |  |
| > mt | y | number | epoch_nsec | Max time, written in data base |
| > r_id | y | string |  | Robot ID |
| > values | y | object |  |  |
| >> [] | y | array |  | List of logs |
| >>> r_id | y | string |  | Robot ID |
| >>> id | y | string |  | Log message ID |
| >>> level | y | number | log_level | Log level |
| >>> msg | y | string |  | Message |
| >>> owner | n | string |  | Message initiator, can be empty string or null |
| >>> t | y | number | epoch_nsec | Time in robot |
| >>> dt | y | number | epoch_nsec | Receive time of backend |

Example:

```json
{
    "type": "robot_logs.subscribe",
    "data": {
        "r_id": "1",
        "values": [
            {
                "level": 5,
                "name": "",
                "owner": "1",
                "msg": "without name test3",
                "t": 1671195119000062295,
                "dt": 1671195119001430926,
                "r_id": "1"
            },
            {
                "level": 5,
                "name": "",
                "owner": "1",
                "msg": "without name test1",
                "t": 1671195119000069175,
                "dt": 1671195119001430926,
                "r_id": "1"
            },
            {
                "level": 5,
                "name": "",
                "owner": "1",
                "msg": "without name test",
                "t": 1671195119000074206,
                "dt": 1671195119001430926,
                "r_id": "1"
            },
            {
                "level": 5,
                "name": "",
                "owner": "1",
                "msg": "without name test2",
                "t": 1671195119000076823,
                "dt": 1671195119001430926,
                "r_id": "1"
            },
            {
                "level": 5,
                "name": "",
                "owner": "1",
                "msg": "without name test3",
                "t": 1671195120000032802,
                "dt": 1671195120001129882,
                "r_id": "1"
            },
            {
                "level": 5,
                "name": "",
                "owner": "1",
                "msg": "without name test1",
                "t": 1671195120000038895,
                "dt": 1671195120001129882,
                "r_id": "1"
            },
            {
                "level": 5,
                "name": "",
                "owner": "1",
                "msg": "without name test",
                "t": 1671195120000049849,
                "dt": 1671195120001129882,
                "r_id": "1"
            },
            {
                "level": 5,
                "name": "",
                "owner": "1",
                "msg": "without name test2",
                "t": 1671195120000052864,
                "dt": 1671195120001129882,
                "r_id": "1"
            }
        ],
        "mt": 1671195116000769082
    },
    "r": "s",
    "eid": "q0",
    "ts": 1671195120491778413
}
```
</details>    
<details>
<summary>Updates</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = robot_logs.subscribe | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = u | y | string | request_result | Request result |
| data | y | object |  |  |
| > r_id | y | string |  | Robot ID |
| > values | y | object |  |  |
| >> [] | y | array |  | List of logs |
| >>> level | y | number | log_level | Log level |
| >>> id | y | string |  | Log message ID |
| >>> msg | y | string |  | Message |
| >>> owner | n | string |  | Message initiator, can be empty string or null |
| >>> t | y | number | epoch_nsec | Time in robot |
| >>> dt | y | number | epoch_nsec | Receive time of backend |

Example:

```json
{
    "type": "robot_logs.subscribe",
    "data": {
        "r_id": "1",
        "values": [
            {
                "level": 5,
                "name": "",
                "owner": "1",
                "msg": "without name test3",
                "t": 1671195121000031284,
                "dt": 1671195121001134808
            },
            {
                "level": 5,
                "name": "",
                "owner": "1",
                "msg": "without name test1",
                "t": 1671195121000037556,
                "dt": 1671195121001134808
            },
            {
                "level": 5,
                "name": "",
                "owner": "1",
                "msg": "without name test",
                "t": 1671195121000041973,
                "dt": 1671195121001134808
            },
            {
                "level": 5,
                "name": "",
                "owner": "1",
                "msg": "without name test2",
                "t": 1671195121000060658,
                "dt": 1671195121001134808
            }
        ]
    },
    "r": "u",
    "eid": "q0",
    "ts": 1671195121002091861
}
```
</details>    
<details>
<summary>Response on error</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = robot_logs.subscribe | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = e | y | string | request_result | Request result |
| data | y | object |  |  |
| > msg | y | string |  | Error message |
| > code | y | number | err_code | Error code |

Example:

```json
{
	"type":"robot_logs.subscribe",
	"data":
	{
		"msg":"Permission denied",
		"code":555
	},
	"ts":1657693572940145200,
	"eid":"qwerty",
	"r":"e"
}
```
</details>    

### Отписка от логов робота

Отписаться от логов робота

<details>
<summary>Request</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = robot_logs.unsubscribe | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| data | y | object |  |  |
| > sub_eid | y | string | string_36 | Subscription eid |

Example:

```json
{
	"type":"robot_logs.unsubscribe",
	"data":
	{
		"sub_eid":"qwerty"
	},
	"eid":"q"
}
```
</details>    
<details>
<summary>Response on success</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = robot_logs.unsubscribe | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = p | y | string | request_result | Request result |

Example:

```json
{
	"type":"robot_logs.unsubscribe",
	"data":{},
	"r":"p",
	"eid":"q",
	"ts":1669810178671387651
}
```
</details>    
<details>
<summary>Response on error</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = robot_logs.unsubscribe | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = e | y | string | request_result | Request result |
| data | y | object |  |  |
| > msg | y | string |  | Error message |
| > code | y | number | err_code | Error code |

Example:

```json
{
	"type":"robot_logs.unsubscribe",
	"data":
	{
		"msg":"Operation timeout",
		"code":666
	},
	"ts":1657693572940145200,
	"eid":"q",
	"r":"e"
}
```
</details>    

### Запрос истории логов робота

Получить историю от даты до даты

<details>
<summary>Request</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = robot_logs.get_history | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| data | y | object |  |  |
| > r_id | y | string |  | Robot ID |
| > msg | n | string |  | Message filter mask, max length 256 symbols. Can use “*” for any multiple characters and “.” for any single character |
| > mint | y | string | epoch_nsec | Receive rows “newer” or equal than this value |
| > maxt | y | string | epoch_nsec | Receive rows “older” or equal than this value |
| > lim | n | number |  | Number of rows to receive in range [1, 100000], default value is 100000 |

Example:

```json
{
	"type": "robot_logs.get_history",
	"data": {
		"r_id": "1",
		"msg": "*test2*",
		"maxt": "2000000000000000000",
		"mint": "1",
		"lim": 100
	},
	"eid": "qwerty"
}
```
</details>    
<details>
<summary>Response on success</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = robot_logs.get_history | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = p | y | string | request_result | Request result |
| data | y | object |  |  |
| > values | y | object |  |  |
| >> [] | y | array |  | List of logs |
| >>> name | y | string |  | Portfolio name |
| >>> r_id | y | string |  | Robot ID |
| >>> id | y | string |  | Log message ID |
| >>> level | y | number | log_level | Log level |
| >>> msg | y | string |  | Message |
| >>> owner | n | string |  | Message initiator, can be empty string or null |
| >>> dt | y | number | epoch_nsec | Time in robot |

Example:

```json
{
    "type": "robot_logs.get_history",
    "data": {
        "values": [
            {
                "dt": "1677586103000245321",
                "r_id": "1",
                "name": "test11",
                "level": 1,
                "msg": "Compilation on \"test11\" is OK",
                "owner": ""
            },
            {
                "dt": "1677586099000142947",
                "r_id": "1",
                "name": "test11",
                "level": 2,
                "msg": "can not calculate ratio or count on: test11",
                "owner": ""
            },
            {
                "dt": "1677586098035538311",
                "r_id": "1",
                "name": "test11",
                "level": 0,
                "msg": "Portfolio \"test11\" was added by test@gmail.com",
                "owner": ""
            },
            {
                "dt": "1677055406000165879",
                "r_id": "1",
                "name": "test11",
                "level": 1,
                "msg": "Compilation on \"test11\" is OK",
                "owner": ""
            },
            {
                "dt": "1677055397000150796",
                "r_id": "1",
                "name": "test11",
                "level": 2,
                "msg": "can not calculate ratio or count on: test11",
                "owner": "test@gmail.com"
            }
        ]
    },
    "r": "p",
    "eid": "q0",
    "ts": 1677586620262732080
}
```
</details>    
<details>
<summary>Response on error</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = robot_logs.get_history | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = e | y | string | request_result | Request result |
| data | y | object |  |  |
| > msg | y | string |  | Error message |
| > code | y | number | err_code | Error code |

Example:

```json
{
	"type":"robot_logs.get_history",
	"data":
	{
		"msg":"Permission denied",
		"code":555
	},
	"ts":1657693572940145200,
	"eid":"qwerty",
	"r":"e"
}
```
</details>    

## Инструменты

### Запрос списка финансовых инструментов

Получить список финансовых инструментов, доступных в данном робота

<details>
<summary>Request</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = robot.get_securities | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| data | y | object |  |  |
| > r_id | y | string |  | Robot ID |
| > reload | n | boolean |  | If true - reloads data from robot, if false (default) - get data from backend |
| > sec_type | n | number |  | Bit mask of sec_types to receive |

Example:

```json
{
	"type": "robot.get_securities",
	"data": {
		"r_id": "1"
	},
	"eid": "qwerty"
}
```
</details>    
<details>
<summary>Response on success</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = robot.get_securities | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = p | y | string | request_result | Request result |
| data | y | object |  |  |
| > next | y | boolean |  | If true, client should wait other messages |
| > securities | y | object |  | Securities |
| >> SEC_KEY | y | string:object |  | Security object key |
| >>> sec_key | y | string |  | Security unique key (should be equal to SEC_KEY) |
| >>> sec_key_subscr | y | string |  | Security subscription key on exchange |
| >>> put | y | number |  | Put/Call option: 0 — Call, 1 — put, -1 — other (not an option) |
| >>> step | y | number |  | Price step |
| >>> base_sec_key | y | string |  | Base security unique key |
| >>> sec_board | y | string |  | Security board |
| >>> sec_code | y | string |  | Security code |
| >>> description | y | string |  | Security description |
| >>> sec_type | y | number | sec_type | Security type |
| >>> d_pg | y | number |  | Pagination data |
| >>> isinid_fast | y | number |  |  |
| >>> isinid_p2 | y | number |  |  |
| >>> state | y | number |  | Trading state: 1 — Is trading |
| >>> exec_end | y | number |  | Expiration data |
| >>> strike | y | number |  | Strike (used for options) |
| >>> lot_size | y | number |  | Lot size |

Example:

```json
{
    "type": "robot.get_securities",
    "data": {
        "next": false,
        "securities": {
            "OKF_1INCH_USDT_SWAP": {
                "put": -1,
                "step": 0.0001,
                "sec_key": "OKF_1INCH_USDT_SWAP",
                "sec_key_subscr": "1INCH-USDT-SWAP",
                "base_sec_key": "1INCH-USDT",
                "sec_board": "",
                "sec_code": "1INCH-USDT-SWAP",
                "description": "1INCH-USDT-SWAP",
                "sec_type": 67108864,
                "d_pg": 2147483647,
                "isinid_fast": 11798768020302227088,
                "isinid_p2": 0,
                "state": 1,
                "exec_end": 2147483647,
                "strike": 0,
                "lot_size": 1
            },
            "OKS_ZYRO_USDT": {
                "put": -1,
                "step": 0.00001,
                "sec_key": "OKS_ZYRO_USDT",
                "sec_key_subscr": "ZYRO-USDT",
                "base_sec_key": "",
                "sec_board": "",
                "sec_code": "ZYRO-USDT",
                "description": "ZYRO-USDT",
                "sec_type": 67108864,
                "d_pg": 2147483647,
                "isinid_fast": 13296729603019105325,
                "isinid_p2": 0,
                "state": 1,
                "exec_end": 2147483647,
                "strike": 0,
                "lot_size": 1e-8
            }
        }
    },
    "r": "p",
    "eid": "q0",
    "ts": 1671449845200989442
}
```
</details>    
<details>
<summary>Response on error</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = robot.get_securities | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r=e | y | string | request_result | Request result |
| data | y | object |  |  |
| > msg | y | string |  | Error message |
| > code | y | number | err_code | Error code |

Example:

```json
{
	"type":"robot.get_securities",
	"data":
	{
		"msg":"Permission denied",
		"code":555
	},
	"ts":1657693572940145200,
	"eid":"qwerty",
	"r":"e"
}
```
</details>    

### Запрос списка клиентских кодов

Получить список клиентских кодов, доступных в данном роботе

<details>
<summary>Request</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = robot.get_client_codes | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| data | y | object |  |  |
| > r_id | y | string |  | Robot ID |

Example:

```json
{
	"type": "robot.get_client_codes",
	"data": {
		"r_id": "1"
	},
	"eid": "qwerty"
}
```
</details>    
<details>
<summary>Response on success</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = robot.get_client_codes | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = p | y | string | request_result | Request result |
| data | y | object |  |  |
| > r_id | y | string |  | Robot ID |
| > values | y | object |  |  |
| >> [] | y | array |  |  |
| >>> sec_type | y | number | sec_type | Security type |
| >>> ll | y | string |  | Client code unique label |

Example:

```json
{
    "type": "robot.get_client_codes",
    "data": {
        "r_id": "1",
        "values": [
            {
                "sec_type": 1048576,
                "ll": "bitmex_send_xxx/xxx"
            }
        ]
    },
    "r": "p",
    "eid": "q0",
    "ts": 1677586108933275724
}
```
</details>    
<details>
<summary>Response on error</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = robot.get_client_codes | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r=e | y | string | request_result | Request result |
| data | y | object |  |  |
| > msg | y | string |  | Error message |
| > code | y | number | err_code | Error code |

Example:

```json
{
	"type":"robot.get_client_codes",
	"data":
	{
		"msg":"Permission denied",
		"code":555
	},
	"ts":1657693572940145200,
	"eid":"qwerty",
	"r":"e"
}
```
</details>    



### Найти финансовый инструмент в роботе/портфеле

Найти заданный финансовый инструмент в портфеле или роботе или всех доступных роботах

<details>
<summary>Request</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = robot.find_security | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| data | y | object |  |  |
| > r_id | n | string |  | Robot ID |
| > p_id | n | string |  | Portfolio name |
| > key | y | string |  | Security’s SecKey |

Example:

```json
{
	"type": "robot.find_security",
	"data": {
		"r_id": "1",
		"key": "OKF_ADA_USDT_SWAP"
	},
	"eid": "qwerty"
}
```
</details>    
<details>
<summary>Response on success</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = robot.find_security | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = p | y | string | request_result | Request result |
| data | y | object |  |  |
| > key | y | string |  | Security’s SecKey |
| > portfolios | y | object |  | Portfolios |
| >> [] | y | array |  | List of portfolios with specified SecKey in securities list |
| >>> r_id | y | string |  | Robot ID |
| >>> p_id | y | string |  | Portfolio name |
| >>> disabled | y | boolean |  | Replacing security in this portfolio is disabled |
| > formulas | y | object |  | Formulas |
| >> [] | y | string |  |  |
| >>> r_id | y | string |  | Robot ID |
| >>> p_id | y | string |  | Portfolio name |
| >>> pos | y | number |  | Integer position of found SecKey in formula field |
| >>> text | y | string |  | Found substring |
| >>> sec | y | string |  | SecKey if substring was found in security formula or an empty string if it was found in portfolio formula |
| >>> title | y | string |  | Field title |
| >>> field | y | string |  | Field name (key) |
| >>> value | y | string |  | Field value |
| >>> disabled | y | boolean |  | Editing of this field is disabled |

Example:

```json
{
    "type": "robot.find_security",
    "data": {
        "key": "OKF_ADA_USDT_SWAP",
        "portfolios": [
            {
                "r_id": "1",
                "p_id": "test3",
                "disabled": false
            }
        ],
        "formulas": [
            {
                "r_id": "1",
                "p_id": "replace",
                "pos": 27,
                "text": "y(\"OKF_ADA_USDT_SWAP\");\nsecurity...",
                "sec": "",
                "title": "Extra field#1",
                "field": "ext_field1_",
                "value": "security s = get_security(\"OKF_ADA_USDT_SWAP\");\nsecurity s1 = get_security(\"OKF_ADA_USDT_SWAP\");",
                "disabled": false
            },
            {
                "r_id": "1",
                "p_id": "replace",
                "pos": 76,
                "text": "y(\"OKF_ADA_USDT_SWAP\");",
                "sec": "",
                "title": "Extra field#1",
                "field": "ext_field1_",
                "value": "security s = get_security(\\OKF_ADA_USDT_SWAP\");\nsecurity s1 = get_security(\"OKF_ADA_USDT_SWAP\");",
                "disabled": false
            },
            {
                "r_id": "1",
                "p_id": "replace",
                "pos": 27,
                "text": "y(\"OKF_ADA_USDT_SWAP\");\nreturn 1...",
                "sec": "OKF_ADA_USDT_SWAP",
                "title": "OKF_ADA_USDT_SWAP#Ratio buy formula",
                "field": "ratio_b_formula",
                "value": "security s = get_security(\"OKF_ADA_USDT_SWAP\");\nreturn 1;",
                "disabled": false
            }
        ]
    },
    "r": "p",
    "eid": "q0",
    "ts": 1672041478409883474
}
```
</details>    
<details>
<summary>Response on error</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = robot.find_security | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r=e | y | string | request_result | Request result |
| data | y | object |  |  |
| > msg | y | string |  | Error message |
| > code | y | number | err_code | Error code |

Example:

```json
{
	"type":"robot.find_security",
	"data":
	{
		"msg":"Permission denied",
		"code":555
	},
	"ts":1657693572940145200,
	"eid":"qwerty",
	"r":"e"
}
```
</details>    

### Заменить финансовый инструмент в портфелях робота

Заменить заданный финансовый инструмент в заданных портфелях данного робота

<details>
<summary>Request</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = robot.replace_security | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| data | y | object |  |  |
| > r_id | y | string |  | Robot ID |
| > key | y | string |  | Old security’s SecKey |
| > new_sec | y | object |  | New security |
| >> sec_key_subscr | y | string |  |  |
| >> sec_key | y | string |  |  |
| >> sec_type | y | number | sec_type |  |
| >> sec_board | y | string |  |  |
| >> sec_code | y | string |  |  |
| > portfolios | y | string |  | List of portfolio names |
| >> [] | y | array |  | List of portfolios with specified SecKey in securities list |
| > formulas | y | object |  | Formulas |
| >> [] | y | string |  |  |
| >>> p_id | y | string |  | Portfolio name |
| >>> pos | y | number |  | Integer position of SecKey in formula field to replace |
| >>> sec | y | string |  | SecKey if field belongs to security field or empty string if field belongs to portfolio field |
| >>> field | y | string |  | Field name (key) |

Example:

```json
{
	"type":"robot.replace_security",
	"data":{
		"r_id":"1",
		"key":"OKF_ADA_USDT_SWAP",
		"new_sec":{"sec_key_subscr":"BTC-USDT-SWAP", "sec_key":"OKF_BTC_USDT_SWAP", "sec_type":67108864, "sec_code":"BTC-USDT-SWAP", "sec_board":""},
		"portfolios":["test3","replace"],
		"formulas":[
			{"p_id":"replace", "sec":"", "field":"ext_field1_", "pos":27},
			{"p_id":"replace", "sec":"", "field":"ext_field1_", "pos":76},
			{"p_id":"replace", "sec":"OKF_ADA_USDT_SWAP", "field":"ratio_b_formula", "pos":27},
		]
	},
	"eid":"qwerty"
}
```
</details>    
<details>
<summary>Response on success</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = robot.replace_security | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = p | y | string | request_result | Request result |
| data | n | object |  |  |

Example:

```json
{
	"type":"robot.replace_security",
	"data":{},
	"r":"p",
	"eid":"q0",
	"ts":1672043554299048407
}
```
</details>    
<details>
<summary>Response on error</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = robot.replace_security | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r=e | y | string | request_result | Request result |
| data | y | object |  |  |
| > msg | y | string |  | Error message |
| > code | y | number | err_code | Error code |

Example:

```json
{
	"type":"robot.replace_security",
	"data":
	{
		"msg":"Permission denied",
		"code":555
	},
	"ts":1657693572940145200,
	"eid":"qwerty",
	"r":"e"
}
```
</details>    

## Маркет-дата

### Подписка на маркет-дата подключения робота

Подписаться на обновления статусов маркет-дата подключений робота

В любой момент может быть выслан снапшот

В обновлениях придут ключи (sec_type + name) и измененные поля (stream_state ходит всегда целиком)

<details>
<summary>Request</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = data_conn.subscribe | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| data | y | object |  |  |
| > r_id | y | string |  | Robot ID |

Example:

```json
{
	"type": "data_conn.subscribe",
	"data": {
		"r_id": "1"
	},
	"eid": "qwerty"
}
```
</details>    
<details>

<summary>Response on success (snapshot)</summary> 

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = data_conn.subscribe | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = s | y | string | request_result | Request result |
| data | y | object |  |  |
| > r_id | y | string |  | Robot ID |
| > values | y | object |  | Portfolio snapshot |
| >> CONN_KEY | y | string:object |  | Connection key string as SEC_TYPE + “_” + CONN_NAME |
| >>> name | y | string |  | Connection name |
| >>> sec_type | y | number | sec_type | Security type |
| >>> bind_ip | y | string |  | Bind IP-address |
| >>> use_in_mc | n | boolean |  | Always true, it is not used and will be removed |
| >>> disabled | y | boolean |  | Disabled connection |
| >>> stream_state | y | object |  | Dictionary of data-stream states with stream name as a key and value of type stream_status |
| >>> has_sec_man | y | boolean |  | Has security manager |
| >>> sec_manager | y | object |  | Dictionary of symbols to find |
| >>>> SYMBOL | y | string:object |  | Unique symbol to find |
| >>>>> state | y | number | symbol_find_state | State |

Example:

```json
{
    "type": "data_conn.subscribe",
    "data": {
        "r_id": "1",
        "values": {
            "3_FAST BestPrices": {
                "sec_type": 3,
                "name": "FAST BestPrices",
                "bind_ip": "",
                "use_in_mc": true,
                "disabled": true,
                "stream_state": {},
		"has_sec_man": false,
		"sec_manager": {}
            },
            "8_FAST CURR BestPrices": {
                "sec_type": 8,
                "name": "FAST CURR BestPrices",
                "bind_ip": "",
                "use_in_mc": true,
                "disabled": true,
                "stream_state": {},
		"has_sec_man": false,
		"sec_manager": {}
            },
            "8_FAST CURR Definitions": {
                "sec_type": 8,
                "name": "FAST CURR Definitions",
                "bind_ip": "",
                "use_in_mc": true,
                "disabled": true,
                "stream_state": {},
		"has_sec_man": false,
		"sec_manager": {}
            },
            "8_FAST CURR Orderlog": {
                "sec_type": 8,
                "name": "FAST CURR Orderlog",
                "bind_ip": "",
                "use_in_mc": true,
                "disabled": true,
                "stream_state": {},
		"has_sec_man": false,
		"sec_manager": {}
            },
            "4_FAST FOND BestPrices": {
                "sec_type": 4,
                "name": "FAST FOND BestPrices",
                "bind_ip": "",
                "use_in_mc": true,
                "disabled": true,
                "stream_state": {},
		"has_sec_man": false,
		"sec_manager": {}
            },
            "4_FAST FOND Definitions": {
                "sec_type": 4,
                "name": "FAST FOND Definitions",
                "bind_ip": "",
                "use_in_mc": true,
                "disabled": true,
                "stream_state": {},
		"has_sec_man": false,
		"sec_manager": {}
            },
            "4_FAST FOND Orderlog": {
                "sec_type": 4,
                "name": "FAST FOND Orderlog",
                "bind_ip": "",
                "use_in_mc": true,
                "disabled": true,
                "stream_state": {},
		"has_sec_man": false,
		"sec_manager": {}
            },
            "3_FAST Futures Definitions": {
                "sec_type": 3,
                "name": "FAST Futures Definitions",
                "bind_ip": "",
                "use_in_mc": true,
                "disabled": true,
                "stream_state": {},
		"has_sec_man": false,
		"sec_manager": {}
            },
            "17592186044416_FAST INDEXES": {
                "sec_type": 17592186044416,
                "name": "FAST INDEXES",
                "bind_ip": "",
                "use_in_mc": true,
                "disabled": true,
                "stream_state": {},
		"has_sec_man": false,
		"sec_manager": {}
            },
            "3_FAST Options Definitions": {
                "sec_type": 3,
                "name": "FAST Options Definitions",
                "bind_ip": "",
                "use_in_mc": true,
                "disabled": true,
                "stream_state": {},
		"has_sec_man": false,
		"sec_manager": {}
            },
            "3_FAST Orderlog": {
                "sec_type": 3,
                "name": "FAST Orderlog",
                "bind_ip": "",
                "use_in_mc": true,
                "disabled": true,
                "stream_state": {},
		"has_sec_man": false,
		"sec_manager": {}
            },
            "34359738368_binancefut_listen": {
                "sec_type": 34359738368,
                "name": "binancefut_listen",
                "bind_ip": "",
                "use_in_mc": true,
                "disabled": true,
                "stream_state": {},
		"has_sec_man": false,
		"sec_manager": {}
            },
            "67108864_okex_listen": {
                "sec_type": 67108864,
                "name": "okex_listen",
                "bind_ip": "",
                "use_in_mc": true,
                "disabled": true,
                "stream_state": {},
		"has_sec_man": true,
                "stream_state": {"qwe":{"state":4}}
            },
            "67108864_okex_listen_aws": {
                "sec_type": 67108864,
                "name": "okex_listen_aws",
                "bind_ip": "",
                "use_in_mc": true,
                "disabled": false,
                "stream_state": {
                    "Definitions": 0,
                    "Extra": 0,
                    "Funding": 0,
                    "OB": 0,
                    "Socket": 1
                },
		"has_sec_man": false,
		"sec_manager": {}
            }
        }
    },
    "r": "s",
    "eid": "q0",
    "ts": 1672318278012852347
}
```
</details>    
<details>
<summary>Updates</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = data_conn.subscribe | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = u | y | string | request_result | Request result |
| data | y | object |  |  |
| > r_id | y | string |  | Robot ID |
| > values | y | object |  | Portfolio snapshot |
| >> CONN_KEY | y | string:object |  | Connection key string as SEC_TYPE + “_” + CONN_NAME |
| >>> name | y | string |  | Connection name |
| >>> sec_type | y | number | sec_type | Security type |
| >>> bind_ip | n | string |  | Bind IP-address |
| >>> use_in_mc | n | boolean |  | It is not used and will be removed |
| >>> disabled | n | boolean |  | Disabled connection |
| >>> stream_state | n | object |  | Dictionary of data-stream states with stream name as a key and value of type stream_status |
| >>> has_sec_man | n | boolean |  | Has security manager |
| >>> sec_manager | n | object |  | Dictionary of symbols to find |
| >>>> SYMBOL | y | string:object |  | Unique symbol to find |
| >>>>> state | n | number | symbol_find_state | State |

Example:

```json
{
    "type": "data_conn.subscribe",
    "data": {
        "r_id": "1",
        "values": {
            "67108864_okex_listen_aws": {
                "sec_type": 67108864,
                "name": "okex_listen_aws",
                "stream_state": {
                    "Definitions": 1,
                    "Extra": 1,
                    "Funding": 1,
                    "OB": 1,
                    "Socket": 2
                },
		"sec_manager":{"test":1}
            }
        }
    },
    "r": "u",
    "eid": "q0",
    "ts": 1672318279003491758
}
```
</details>    
<details>
<summary>Response on error</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = data_conn.subscribe | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = e | y | string | request_result | Request result |
| data | y | object |  |  |
| > msg | y | string |  | Error message |
| > code | y | number | err_code | Error code |

Example:

```json
{
	"type":"data_conn.subscribe",
	"data":
	{
		"msg":"Permission denied",
		"code":555
	},
	"ts":1657693572940145200,
	"eid":"qwerty",
	"r":"e"
}
```
</details>    

### Получить список маркет-дата подключений робота

Получить список маркет-дата подключений робота

<details>
<summary>Request</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = data_conn.get_all | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| data | y | object |  |  |
| > r_id | y | string |  | Robot ID |

Example:

```json
{
	"type": "data_conn.get_all",
	"data": {
		"r_id": "1"
	},
	"eid": "qwerty"
}
```
</details>    
<details>
<summary>Response on success</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = data_conn.get_all | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = p | y | string | request_result | Request result |
| data | y | object |  |  |
| > r_id | y | string |  | Robot ID |
| > values | y | object |  | Portfolio snapshot |
| >> CONN_KEY | y | string:object |  | Connection key string as SEC_TYPE + “_” + CONN_NAME |
| >>> name | y | string |  | Connection name |
| >>> sec_type | y | number | sec_type | Security type |
| >>> sec_type_text | y | string |  | Security type string |
| >>> bind_ip | y | string |  | Bind IP-address |
| >>> use_in_mc | n | boolean |  | Always true, it is not used and will be removed |
| >>> disabled | y | boolean |  | Disabled connection |
| >>> stream_state | n | object |  | Dictionary of data-stream states with stream name as a key and value of type stream_status |
| >>> has_sec_man | y | boolean |  | Has security manager |
| >>> sec_manager | n | object |  | Dictionary of symbols to find |
| >>>> SYMBOL | y | string:object |  | Unique symbol to find |
| >>>>> state | n | number | symbol_find_state | State |

Example:

```json
{
    "type": "data_conn.get_all",
    "data": {
        "r_id": "1",
        "values": {
            "3_FAST BestPrices": {
                "sec_type": 3,
                "name": "FAST BestPrices",
                "bind_ip": "",
                "use_in_mc": true,
                "disabled": true,
		"has_sec_man": false,
                "stream_state": {}
            },
            "8_FAST CURR BestPrices": {
                "sec_type": 8,
                "name": "FAST CURR BestPrices",
                "bind_ip": "",
                "use_in_mc": true,
                "disabled": true,
		"has_sec_man": false,
                "stream_state": {}
            },
            "8_FAST CURR Definitions": {
                "sec_type": 8,
                "name": "FAST CURR Definitions",
                "bind_ip": "",
                "use_in_mc": true,
                "disabled": true,
		"has_sec_man": false,
                "stream_state": {}
            },
            "8_FAST CURR Orderlog": {
                "sec_type": 8,
                "name": "FAST CURR Orderlog",
                "bind_ip": "",
                "use_in_mc": true,
                "disabled": true,
		"has_sec_man": false,
                "stream_state": {}
            },
            "4_FAST FOND BestPrices": {
                "sec_type": 4,
                "name": "FAST FOND BestPrices",
                "bind_ip": "",
                "use_in_mc": true,
                "disabled": true,
		"has_sec_man": false,
                "stream_state": {}
            },
            "4_FAST FOND Definitions": {
                "sec_type": 4,
                "name": "FAST FOND Definitions",
                "bind_ip": "",
                "use_in_mc": true,
                "disabled": true,
		"has_sec_man": false,
                "stream_state": {}
            },
            "4_FAST FOND Orderlog": {
                "sec_type": 4,
                "name": "FAST FOND Orderlog",
                "bind_ip": "",
                "use_in_mc": true,
                "disabled": true,
		"has_sec_man": false,
                "stream_state": {}
            },
            "3_FAST Futures Definitions": {
                "sec_type": 3,
                "name": "FAST Futures Definitions",
                "bind_ip": "",
                "use_in_mc": true,
                "disabled": true,
		"has_sec_man": false,
                "stream_state": {}
            },
            "17592186044416_FAST INDEXES": {
                "sec_type": 17592186044416,
                "name": "FAST INDEXES",
                "bind_ip": "",
                "use_in_mc": true,
                "disabled": true,
		"has_sec_man": false,
                "stream_state": {}
            },
            "3_FAST Options Definitions": {
                "sec_type": 3,
                "name": "FAST Options Definitions",
                "bind_ip": "",
                "use_in_mc": true,
                "disabled": true,
		"has_sec_man": false,
                "stream_state": {}
            },
            "3_FAST Orderlog": {
                "sec_type": 3,
                "name": "FAST Orderlog",
                "bind_ip": "",
                "use_in_mc": true,
                "disabled": true,
		"has_sec_man": false,
                "stream_state": {}
            },
            "34359738368_binancefut_listen": {
                "sec_type": 34359738368,
                "name": "binancefut_listen",
                "bind_ip": "",
                "use_in_mc": true,
                "disabled": true,
		"has_sec_man": false,
                "stream_state": {}
            },
            "67108864_okex_listen": {
                "sec_type": 67108864,
                "name": "okex_listen",
                "bind_ip": "",
                "use_in_mc": true,
                "disabled": true,
		"has_sec_man": false,
                "stream_state": {}
            },
            "67108864_okex_listen_aws": {
                "sec_type": 67108864,
                "name": "okex_listen_aws",
                "bind_ip": "",
                "use_in_mc": true,
                "disabled": false,
		"has_sec_man": false,
                "stream_state": {
                    "Definitions": 0,
                    "Extra": 0,
                    "Funding": 0,
                    "OB": 0,
                    "Socket": 1
                }
            }
        }
    },
    "r": "p",
    "eid": "q0",
    "ts": 1672318278012852347
}
```
</details>    
<details>
<summary>Response on error</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = data_conn.get_all | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = e | y | string | request_result | Request result |
| data | y | object |  |  |
| > msg | y | string |  | Error message |
| > code | y | number | err_code | Error code |

Example:

```json
{
	"type":"data_conn.get_all",
	"data":
	{
		"msg":"Permission denied",
		"code":555
	},
	"ts":1657693572940145200,
	"eid":"qwerty",
	"r":"e"
}
```
</details>    

### Отписка от маркет-дата подключений робота

Отписаться от обновлений статусов маркет-дата подключений робота

<details>
<summary>Request</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = data_conn.unsubscribe | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| data | y | object |  |  |
| > sub_eid | y | string | string_36 | Subscription eid |

Example:

```json
{
	"type":"data_conn.unsubscribe",
	"data":
	{
		"sub_eid":"qwerty"
	},
	"eid":"q"
}
```
</details>    
<details>
<summary>Response on success</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = data_conn.unsubscribe | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = p | y | string | request_result | Request result |

Example:

```json
{
	"type":"data_conn.unsubscribe",
	"data":{},
	"r":"p",
	"eid":"q",
	"ts":1669810178671387651
}
```
</details>    
<details>
<summary>Response on error</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = data_conn.unsubscribe | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = e | y | string | request_result | Request result |
| data | y | object |  |  |
| > msg | y | string |  | Error message |
| > code | y | number | err_code | Error code |

Example:

```json
{
	"type":"data_conn.unsubscribe",
	"data":
	{
		"msg":"Operation timeout",
		"code":666
	},
	"ts":1657693572940145200,
	"eid":"q",
	"r":"e"
}
```
</details>    

### Операции с маркет-дата подключениями

Disable/enable/переподключить маркет-дата подключение

<details>
<summary>Request</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = data_conn.update | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| data | y | object |  |  |
| > r_id | y | string |  | Robot ID |
| > conn | y | object |  | Connection object |
| >> name | y | string |  | Connection name |
| >> sec_type | y | number | sec_type | Security type |
| >> * | n | * |  | Other connection fields from template |

Example:

```json
{
    "type": "data_conn.update",
    "data": {
        "r_id": "1",
        "conn": {
            "sec_type": 67108864,
            "name": "okex_listen_aws",
            "reconnect": true
        }
    },
    "eid": "qwerty"
}
```
    
```json
{
    "type": "data_conn.update",
    "data": {
        "r_id": "1",
        "conn": {
            "sec_type": 67108864,
            "name": "okex_listen_aws",
            "disabled": true
        }
    },
    "eid": "qwerty"
}
```
</details>    
<details>
<summary>Response on success</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = data_conn.update | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = p | y | string | request_result | Request result |
| data | y | object |  | Empty dict |

Example:

```json
{
	"type":"data_conn.update",
	"data":
	{
	},
	"r":"p",
	"eid":"qwerty",
	"ts":1669806718085368646
}
```
</details>    
<details>
<summary>Response on error</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = data_conn.update | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r=e | y | string | request_result | Request result |
| data | y | object |  |  |
| > msg | y | string |  | Error message |
| > code | y | number | err_code | Error code |

Example:

```json
{
	"type":"data_conn.update",
	"data":
	{
		"msg":"Permission denied",
		"code":555
	},
	"ts":1657693572940145200,
	"eid":"qwerty",
	"r":"e"
}
```
</details>

### Добавить/удалить бумагу в менеджер бумаг

Добавить/удалить бумагу в менеджер бумаг

<details>
<summary>Request</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = data_conn.add_symbol/del_symbol | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| data | y | object |  |  |
| > r_id | y | string |  | Robot ID |
| > conn | y | object |  | Connection object |
| >> name | y | string |  | Connection name |
| >> sec_type | y | number | sec_type | Security type |
| >> symbol | y | string |  | Symbol to add/del |

Example:

```json
{
	"type":"data_conn.add_symbol",
	"data":
	{
		"sec_type":2048,
		"name":"cqg_listen_roma",
		"symbol":"F.US.EPZ2"
	},
	"eid":"q"
}
```
</details>    
<details>
<summary>Response on success</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = data_conn.add_symbol/del_symbol | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = p | y | string | request_result | Request result |

Example:

```json
{
	"type":"data_conn.del_symbol",
	"data":{},
	"r":"p",
	"eid":"q",
	"ts":1669810178671387651
}
```
</details>    
<details>
<summary>Response on error</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = data_conn.add_symbol/del_symbol | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = e | y | string | request_result | Request result |
| data | y | object |  |  |
| > msg | y | string |  | Error message |
| > code | y | number | err_code | Error code |

Example:

```json
{
	"type":"data_conn.add_symbol",
	"data":
	{
		"msg":"Operation timeout",
		"code":666
	},
	"ts":1657693572940145200,
	"eid":"q",
	"r":"e"
}
```
</details>  

### Найти бумагу для менеджера бумаг

Найти бумагу для менеджера бумаг

<details>
<summary>Request</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = data_conn.find_symbol | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| data | y | object |  |  |
| > r_id | y | string |  | Robot ID |
| > conn | y | object |  | Connection object |
| >> name | y | string |  | Connection name |
| >> sec_type | y | number | sec_type | Security type |
| >> symbol | y | string |  | Symbol to add/del |

Example:

```json
{
	"type":"data_conn.find_symbol",
	"data":
	{
		"sec_type":2048,
		"name":"cqg_listen_roma",
		"symbol":"F.US.EPZ2"
	},
	"eid":"q"
}
```
</details>    
<details>
<summary>Response on success</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = data_conn.find_symbol | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = p | y | string | request_result | Request result |
| data | y | object |  |  |
| > found | y | string |  | Found symbol |
| > warn | y | string |  | Warning (empty string if no warning) |

Example:

```json
{
	"type":"data_conn.find_symbol",
	"data":{"found":"F.US.EPU23","warn":"Security expired"},
	"r":"p",
	"eid":"q",
	"ts":1669810178671387651
}
```
</details>    
<details>
<summary>Response on error</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = data_conn.find_symbol | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = e | y | string | request_result | Request result |
| data | y | object |  |  |
| > msg | y | string |  | Error message |
| > code | y | number | err_code | Error code |

Example:

```json
{
	"type":"find_symbol",
	"data":
	{
		"msg":"Requested symbol .US.EPU23 was not found",
		"code":777
	},
	"ts":1657693572940145200,
	"eid":"q",
	"r":"e"
}
```
</details>

## Транзакционные подключения

### Добавить транзакционное подключение

<details>
<summary>Request</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = robot.add_trans_conn | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| data | y | object |  |  |
| > r_id | y | string |  | Robot ID |
| > conn | y | object |  | Connection object |
| >> name | y | string |  | Connection short name |
| >> exchane | y | string |  | Security type |
| >> bind_ip | y | string |  | Bind IP |
| >> * | n | * |  | Other connection fields from template |

Example:

```json
{
    "type": "robot.add_trans_conn",
    "data": {
        "r_id": "1",
        "conn": {
            "exchange": "1048576",
            "name": "qwe",
            "ws_id": "1",
            "ws_secret_part": "2",
            "add_id": "3",
            "add_secret_part": "4",
            "bind_ip": "automatic",
            "ckey": "12345678",
        }
    },
    "eid": "qwerty"
}
```
</details>    
<details>
<summary>Response on success</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = robot.add_trans_conn | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = p | y | string | request_result | Request result |
| data | y | object |  |  |
| > r_id | y | string |  | Robot ID |
| > name | y | string |  | Connection short name |
| > sec_type | y | number | sec_type | Security type |

Example:

```json
{
    "type": "robot.add_trans_conn",
    "data": {
        "r_id": "1",
        "sec_type": 1048576,
        "name": "qwe"
    },
    "r": "p",
    "eid": "q0",
    "ts": 1683010843351601412
}
```
</details>    
<details>
<summary>Response on error</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = robot.add_trans_conn | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r=e | y | string | request_result | Request result |
| data | y | object |  |  |
| > msg | y | string |  | Error message |
| > code | y | number | err_code | Error code |

Example:

```json
{
	"type":"robot.add_trans_conn",
	"data":
	{
		"msg":"Permission denied",
		"code":555
	},
	"ts":1657693572940145200,
	"eid":"qwerty",
	"r":"e"
}
```
</details>    

### Изменить транзакционное подключение

<details>
<summary>Request</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = trans_conn.edit | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| data | y | object |  |  |
| > r_id | y | string |  | Robot ID |
| > conn | y | object |  | Connection object |
| >> name | y | string |  | Connection short name |
| >> exchane | y | string |  | Security type |
| >> bind_ip | y | string |  | Bind IP |
| >> * | n | * |  | Other connection fields from template |

Example:

```json
{
    "type": "trans_conn.edit",
    "data": {
        "r_id": "1",
        "conn": {
            "exchange": "1048576",
            "name": "qwe",
            "ws_id": "1",
            "ws_secret_part": "2",
            "add_id": "3",
            "add_secret_part": "4",
            "bind_ip": "automatic",
            "ckey": "12345678",
        }
    },
    "eid": "qwerty"
}
```
</details>    
<details>
<summary>Response on success</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = trans_conn.edit | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = p | y | string | request_result | Request result |
| data | y | object |  |  |
| > r_id | y | string |  | Robot ID |
| > name | y | string |  | Connection short name |
| > sec_type | y | number | sec_type | Security type |

Example:

```json
{
    "type": "trans_conn.edit",
    "data": {
        "r_id": "1",
        "sec_type": 1048576,
        "name": "qwe"
    },
    "r": "p",
    "eid": "q0",
    "ts": 1683010843351601412
}
```
</details>    
<details>
<summary>Response on error</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = trans_conn.edit | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r=e | y | string | request_result | Request result |
| data | y | object |  |  |
| > msg | y | string |  | Error message |
| > code | y | number | err_code | Error code |

Example:

```json
{
	"type":"trans_conn.edit",
	"data":
	{
		"msg":"Permission denied",
		"code":555
	},
	"ts":1657693572940145200,
	"eid":"qwerty",
	"r":"e"
}
```
</details>    

### Удалить транзакционное подключение

<details>
<summary>Request</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = trans_conn.remove | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| data | y | object |  |  |
| > r_id | y | string |  | Robot ID |
| > conn | y | object |  | Connection object |
| >> name | y | string |  | Connection short name |
| >> sec_type | y | number | sec_type | Security type |

Example:

```json
{
    "type": "trans_conn.remove",
    "data": {
        "r_id": "1",
        "conn": {
            "sec_type": 67108864,
            "name": "aws"
        }
    },
    "eid": "qwerty"
}
```
</details>    
<details>
<summary>Response on success</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = trans_conn.remove | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = p | y | string | request_result | Request result |
| data | y | object |  |  |
| > r_id | y | string |  | Robot ID |
| > name | y | string |  | Connection short name |
| > sec_type | y | number | sec_type | Security type |

Example:

```json
{
    "type": "trans_conn.remove",
    "data": {
        "sec_type": 1048576,
        "name": "qwe",
        "r_id": "1"
    },
    "r": "p",
    "eid": "q0",
    "ts": 1683011092645083338
}
```
</details>    
<details>
<summary>Response on error</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = trans_conn.remove | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r=e | y | string | request_result | Request result |
| data | y | object |  |  |
| > msg | y | string |  | Error message |
| > code | y | number | err_code | Error code |

Example:

```json
{
	"type":"trans_conn.remove",
	"data":
	{
		"msg":"Permission denied",
		"code":555
	},
	"ts":1657693572940145200,
	"eid":"qwerty",
	"r":"e"
}
```
</details>    

### Получить параметры транзакционного подключения

<details>
<summary>Request</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = trans_conn.get | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| data | y | object |  |  |
| > r_id | y | string |  | Robot ID |
| > conn | y | object |  | Connection object |
| >> name | y | string |  | Connection short name |
| >> sec_type | y | number | sec_type | Security type |

Example:

```json
{
    "type": "trans_conn.get",
    "data": {
        "r_id": "1",
        "conn": {
            "sec_type": 67108864,
            "name": "aws"
        }
    },
    "eid": "qwerty"
}
```
</details>    
<details>
<summary>Response on success</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = trans_conn.get | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = p | y | string | request_result | Request result |
| data | y | object |  |  |
| > r_id | y | string |  | Robot ID |
| > conn | y | object |  | Connection |
| >> name | y | string |  | Connection short name |
| >> sec_type | y | number | sec_type | Security type |
| >> * | n | * |  | Other connection fields |

Example:

```json
{
    "type": "trans_conn.get",
    "data": {
        "r_id": "1",
        "conn": {
            "exchange": "1048576",
            "sec_type": 1048576,
            "current_bind_ip": "0.0.0.0",
            "name": "qwe",
            "ws_id": "1",
            "ws_secret_part": "2",
            "add_id": "3",
            "add_secret_part": "4",
            "bind_ip": "automatic"
        }
    },
    "r": "p",
    "eid": "q0",
    "ts": 1683118963003758829
}
```
</details>    
<details>
<summary>Response on error</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = trans_conn.get | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r=e | y | string | request_result | Request result |
| data | y | object |  |  |
| > msg | y | string |  | Error message |
| > code | y | number | err_code | Error code |

Example:

```json
{
	"type":"trans_conn.get",
	"data":
	{
		"msg":"Permission denied",
		"code":555
	},
	"ts":1657693572940145200,
	"eid":"qwerty",
	"r":"e"
}
```
</details>    

### Получить бумаги, торгуемые через транзакционное подключение

Получить бумаги, которые есть в портфелях робота и у которых client code относится именно в данному подключению

<details>
<summary>Request</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = trans_conn.get | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| data | y | object |  |  |
| > r_id | y | string |  | Robot ID |
| > conn | y | object |  | Connection object |
| >> name | y | string |  | Connection short name |
| >> sec_type | y | number | sec_type | Security type |

Example:

```json
{
    "type": "trans_conn.get_used_secs",
    "data": {
        "r_id": "1",
        "conn": {
            "sec_type": 67108864,
            "name": "aws"
        }
    },
    "eid": "qwerty"
}
```
</details>    
<details>
<summary>Response on success</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = trans_conn.get_used_secs | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = p | y | string | request_result | Request result |
| data | y | object |  |  |
| > contracts | y | object |  |  |
| >> SEC_KEY | y | string |  | Security key |
| >>> step | y | number |  | Price step |
| >>> sec_key | y | string |  | Security key |
| >>> sec_key_subscr | y | string |  | Security subscription key |
| >>> sec_code | y | string |  | Security description |
| >>> coin | y | string |  | Base coin |
| >>> bid | y | number |  | Bid price |
| >>> offer | y | number |  | Offer price |
| >>> decimals | y | number |  | Decimal digits in price |
| >>> lot_size | n | number |  | Lot size |

Example:

```json
{
    "type": "trans_conn.get_used_secs",
    "data": {
        "contracts": {
            "VT_BTCUSD": {
                "step": 0.5,
                "sec_key": "VT_BTCUSD",
                "sec_key_subscr": "1",
                "sec_code": "BTC/USD contract",
                "coin": "",
                "bid": 35000,
                "offer": 36000,
                "decimals": 1,
                "lot_size": 1e-8
            }
        },
        "r": "p",
        "eid": "q0",
        "ts": 1688720510426841957
    }
}
```
</details>    
<details>
<summary>Response on error</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = trans_conn.get_used_secs | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r=e | y | string | request_result | Request result |
| data | y | object |  |  |
| > msg | y | string |  | Error message |
| > code | y | number | err_code | Error code |

Example:

```json
{
	"type":"trans_conn.get_used_secs",
	"data":
	{
		"msg":"Permission denied",
		"code":555
	},
	"ts":1657693572940145200,
	"eid":"qwerty",
	"r":"e"
}
```
</details>    

### Подписка на транзакционные подключения робота

Подписаться на обновления статусов транзакционных подключений робота

В любой момент может быть выслан снапшот

В обновлениях придут ключи (sec_type + name) и измененные поля (stream_state и speed_info ходят всегда целиком)

<details>
<summary>Request</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = trans_conn.subscribe | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| data | y | object |  |  |
| > r_id | y | string |  | Robot ID |

Example:

```json
{
	"type": "trans_conn.subscribe",
	"data": {
		"r_id": "1"
	},
	"eid": "qwerty"
}
```
</details>    
<details>

<summary>Response on success (snapshot)</summary> 

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = trans_conn.subscribe | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = s | y | string | request_result | Request result |
| data | y | object |  |  |
| > r_id | y | string |  | Robot ID |
| > values | y | object |  | Portfolio snapshot |
| >> CONN_KEY | y | string:object |  | Connection key string as SEC_TYPE + “_” + CONN_NAME |
| >>> name | y | string |  | Connection short name |
| >>> sec_type | y | number | sec_type | Security type |
| >>> full_name | y | string |  | Connection long name |
| >>> trans_cnt | y | number |  | Today transactions count |
| >>> bind_ip | n | string |  | Bind IP-address (default value “0.0.0.0”) |
| >>> bind_ip_type | n | string |  | “static” or “automatic” (default value “automatic”) |
| >>> use_in_mc | n | boolean |  | Always true, it is not used and will be removed |
| >>> can_check_pos | y | boolean |  | Can show active orders |
| >>> has_pos | n | boolean |  | Can receive positions (default false) |
| >>> disabled | y | boolean |  | Disabled connection |
| >>> stream_state | n | object |  | Dictionary of data-stream states with stream name as a key and value of type stream_status |
| >>> speed_info | n | object |  | Dictionary TODO |

Example:

```json
{
    "type": "trans_conn.subscribe",
    "data": {
        "r_id": "1",
        "values": {
            "1048576_roma": {
                "sec_type": 1048576,
                "name": "roma",
                "full_name": "bitmex_send_roma",
                "trans_cnt": 0,
                "use_in_mc": true,
                "can_check_pos": true,
                "disabled": false,
                "speed_info": {
                    "m0": 0,
                    "m05": 0,
                    "m1": 0,
                    "m2": 0,
                    "m4": 0,
                    "m8": 0,
                    "m16": 0,
                    "l05a": 0,
                    "l05d": 0,
                    "l05m": 0,
                    "l05ra": 0
                },
                "stream_state": {
                    "Margin": 0,
                    "Orders": 0,
                    "Positions": 0,
                    "Socket": 2,
                    "Trades": 0
                },
                "bind_ip": "0.0.0.0",
                "bind_ip_type": "automatic",
                "has_pos": true
            },
            "0_virtual": {
                "sec_type": 0,
                "name": "virtual",
                "full_name": "virtual",
                "trans_cnt": 0,
                "use_in_mc": false,
                "can_check_pos": false,
                "disabled": false,
                "speed_info": {
                    "m0": 0,
                    "m05": 0,
                    "m1": 0,
                    "m2": 0,
                    "m4": 0,
                    "m8": 0,
                    "m16": 0,
                    "l05a": 0,
                    "l05d": 0,
                    "l05m": 0,
                    "l05ra": 0
                },
                "stream_state": {
                    "TRANS": 2
                }
            }
        }
    },
    "r": "s",
    "eid": "q0",
    "ts": 1674041060021346958
}
```
</details>    
<details>
<summary>Updates</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = trans_conn.subscribe | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = u | y | string | request_result | Request result |
| data | y | object |  |  |
| > r_id | y | string |  | Robot ID |
| > values | y | object |  | Portfolio snapshot |
| >> CONN_KEY | y | string:object |  | Connection key string as SEC_TYPE + “_” + CONN_NAME |
| >>> name | y | string |  | Connection short name |
| >>> sec_type | y | number | sec_type | Security type |
| >>> full_name | y | string |  | Connection long name |
| >>> trans_cnt | n | number |  | Today transactions count |
| >>> bind_ip | n | string |  | Bind IP-address (default value “0.0.0.0”) |
| >>> bind_ip_type | n | string |  | “static” or “automatic” (default value “automatic”) |
| >>> use_in_mc | n | boolean |  | Always true, it is not used and will be removed |
| >>> can_check_pos | n | boolean |  | Can show active orders |
| >>> has_pos | n | boolean |  | Can receive positions |
| >>> disabled | n | boolean |  | Disabled connection |
| >>> stream_state | n | object |  | Dictionary of data-stream states with stream name as a key and value of type stream_status |
| >>> speed_info | n | object |  | Dictionary TODO |
| >>> __action = del | n | string |  | Only on delete |

Example:

```json
{
    "type": "trans_conn.subscribe",
    "data": {
        "r_id": "1",
        "values": {
            "0_virtual": {
                "sec_type": 0,
                "name": "virtual",
                "full_name": "virtual",
                "stream_state": {
                    "TRANS": 2
                }
            }
        }
    },
    "r": "u",
    "eid": "q0",
    "ts": 1673868870003507686
}
```
</details>    
<details>
<summary>Response on error</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = trans_conn.get_all | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = e | y | string | request_result | Request result |
| data | y | object |  |  |
| > msg | y | string |  | Error message |
| > code | y | number | err_code | Error code |

Example:

```json
{
	"type":"trans_conn.get_all",
	"data":
	{
		"msg":"Permission denied",
		"code":555
	},
	"ts":1657693572940145200,
	"eid":"qwerty",
	"r":"e"
}
```
</details>    

### Получить список транзакционных подключений робота

Получить список транзакционных подключений робота

<details>
<summary>Request</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = trans_conn.get_all | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| data | y | object |  |  |
| > r_id | y | string |  | Robot ID |

Example:

```json
{
	"type": "trans_conn.get_all",
	"data": {
		"r_id": "1"
	},
	"eid": "qwerty"
}
```
</details>    
<details>
<summary>Response on success</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = trans_conn.get_all | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = p | y | string | request_result | Request result |
| data | y | object |  |  |
| > r_id | y | string |  | Robot ID |
| > values | y | object |  | Portfolio snapshot |
| >> CONN_KEY | y | string:object |  | Connection key string as SEC_TYPE + “_” + CONN_NAME |
| >>> name | y | string |  | Connection short name |
| >>> sec_type | y | number | sec_type | Security type |
| >>> full_name | y | string |  | Connection long name |
| >>> trans_cnt | y | number |  | Today transactions count |
| >>> bind_ip | n | string |  | Bind IP-address (default value “0.0.0.0”) |
| >>> bind_ip_type | n | string |  | “static” or “automatic” (default value “automatic”) |
| >>> use_in_mc | n | boolean |  | Always true, it is not used and will be removed |
| >>> can_check_pos | y | boolean |  | Can show active orders |
| >>> has_pos | n | boolean |  | Can receive positions (default false) |
| >>> disabled | y | boolean |  | Disabled connection |
| >>> stream_state | n | object |  | Dictionary of data-stream states with stream name as a key and value of type stream_status |
| >>> speed_info | n | object |  | Dictionary TODO |

Example:

```json
{
    "type": "trans_conn.get_all",
    "data": {
        "r_id": "1",
        "values": {
            "1048576_roma": {
                "sec_type": 1048576,
                "name": "roma",
                "full_name": "bitmex_send_roma",
                "trans_cnt": 0,
                "use_in_mc": true,
                "can_check_pos": true,
                "disabled": false,
                "speed_info": {
                    "m0": 0,
                    "m05": 0,
                    "m1": 0,
                    "m2": 0,
                    "m4": 0,
                    "m8": 0,
                    "m16": 0,
                    "l05a": 0,
                    "l05d": 0,
                    "l05m": 0,
                    "l05ra": 0
                },
                "stream_state": {
                    "Margin": 0,
                    "Orders": 0,
                    "Positions": 0,
                    "Socket": 2,
                    "Trades": 0
                },
                "bind_ip": "0.0.0.0",
                "bind_ip_type": "automatic",
                "has_pos": true
            },
            "0_virtual": {
                "sec_type": 0,
                "name": "virtual",
                "full_name": "virtual",
                "trans_cnt": 0,
                "use_in_mc": false,
                "can_check_pos": false,
                "disabled": false,
                "speed_info": {
                    "m0": 0,
                    "m05": 0,
                    "m1": 0,
                    "m2": 0,
                    "m4": 0,
                    "m8": 0,
                    "m16": 0,
                    "l05a": 0,
                    "l05d": 0,
                    "l05m": 0,
                    "l05ra": 0
                },
                "stream_state": {
                    "TRANS": 2
                }
            }
        }
    },
    "r": "p",
    "eid": "q0",
    "ts": 1674041060021346958
}
```
</details>    
<details>
<summary>Response on error</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = trans_conn.get_all | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = e | y | string | request_result | Request result |
| data | y | object |  |  |
| > msg | y | string |  | Error message |
| > code | y | number | err_code | Error code |

Example:

```json
{
	"type":"trans_conn.get_all",
	"data":
	{
		"msg":"Permission denied",
		"code":555
	},
	"ts":1657693572940145200,
	"eid":"qwerty",
	"r":"e"
}
```
</details>    

### Отписка от транзакционных подключений робота

Отписаться от обновлений статусов транзакционных подключений робота

<details>
<summary>Request</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = trans_conn.unsubscribe | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| data | y | object |  |  |
| > sub_eid | y | string | string_36 | Subscription eid |

Example:

```json
{
	"type":"trans_conn.unsubscribe",
	"data":
	{
		"sub_eid":"qwerty"
	},
	"eid":"q"
}
```
</details>    
<details>
<summary>Response on success</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = trans_conn.unsubscribe | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = p | y | string | request_result | Request result |

Example:

```json
{
	"type":"trans_conn.unsubscribe",
	"data":{},
	"r":"p",
	"eid":"q",
	"ts":1669810178671387651
}
```
</details>    
<details>
<summary>Response on error</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = trans_conn.unsubscribe | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = e | y | string | request_result | Request result |
| data | y | object |  |  |
| > msg | y | string |  | Error message |
| > code | y | number | err_code | Error code |

Example:

```json
{
	"type":"trans_conn.unsubscribe",
	"data":
	{
		"msg":"Operation timeout",
		"code":666
	},
	"ts":1657693572940145200,
	"eid":"q",
	"r":"e"
}
```
</details>    

### Подписка на активные заявки транзакционного подключения робота

Подписаться на активные заявки транзакционного подключения робота

В любой момент может быть выслан снапшот

При удалении подключения произойдет отписка

<details>
<summary>Request</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = trans_conn_orders.subscribe | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| data | y | object |  |  |
| > r_id | y | string |  | Robot ID |
| > conn | y | object |  |  |
| >> sec_type | y | number | sec_type | Security type |
| >> name | y | string |  | Connection short name |

Example:

```json
{
	"type": "trans_conn_orders.subscribe",
	"data": {
		"r_id": "1",
		"conn":
		{
			"sec_type":1048576,
			"name":"roma"
		}
	},
	"eid": "qwerty"
}
```
</details>    
<details>

<summary>Response on success (snapshot)</summary> 

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = trans_conn_orders.subscribe | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = s | y | string | request_result | Request result |
| data | y | object |  |  |
| > r_id | y | string |  | Robot ID |
| > value | y | object |  | Portfolio snapshot |
| >> name | y | string |  | Connection short name |
| >> sec_type | y | number | sec_type | Security type |
| >> full_name | y | string |  | Connection long name |
| >> disabled | y | boolean |  | Disabled connection |
| >> stream_state | y | object |  | Dictionary of data-stream states with stream name as a key and value of type stream_status |
| >> active_orders | y | string:object |  | Dictionary of active orders |
| >>> ORDER_ID | y | string |  | Unique order ID |
| >>>> sk | y | string |  | Security key |
| >>>> lot_size | y | number |  | Lot size |
| >>>> cc | y | string |  | Order’s client code |
| >>>> subscr | y | string |  | Security subscription key |
| >>>> ono | y | string |  | Unique order ID |
| >>>> id | y | string |  | Order’s ext_id |
| >>>> p | y | number |  | Price |
| >>>> q | y | number |  | Integer quantity |
| >>>> q0 | y | number |  | Integer left quantity |
| >>>> d | y | number | direction | Direction |
| >>>> decimals | y | number |  | Decimal places in price |
| >>>> t | y | string | epoch_nsec | Order update time |
| >>>> r | y | boolean |  | Robot’s order or not |

Example:

```json
{
  "type": "trans_conn_orders.subscribe",
  "data": {
    "r_id": "1",
    "value": {
      "sec_type": 1048576,
      "name": "roma",
      "full_name": "bitmex_send_roma",
      "disabled": false,
      "active_orders": {
        "1de6bd60-688c-4777-bd17-aef921888290": {
          "sk": "BM_XBTUSD",
          "lot_size": 1,
          "cc": "",
          "subscr": "XBTUSD",
          "ono": "1de6bd60-688c-4777-bd17-aef921888290",
          "id": "",
          "p": 21228,
          "q": 100,
          "q0": 100,
          "d": 2,
          "decimals": 8,
          "t": "1674203817310000000",
          "r": false
        }
      },
      "stream_state": {
        "Margin": 2,
        "Orders": 2,
        "Positions": 2,
        "Socket": 2,
        "Trades": 2
      }
    }
  },
  "r": "s",
  "eid": "q0",
  "ts": 1674218608752679113
}
```
</details>    
<details>
<summary>Updates</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = trans_conn_orders.subscribe | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = u | y | string | request_result | Request result |
| data | y | object |  |  |
| > r_id | y | string |  | Robot ID |
| > value | y | object |  | Portfolio snapshot |
| >> name | y | string |  | Connection short name |
| >> sec_type | y | number | sec_type | Security type |
| >> full_name | y | string |  | Connection long name |
| >> disabled | n | boolean |  | Disabled connection |
| >> stream_state | n | object |  | Dictionary of data-stream states with stream name as a key and value of type stream_status |
| >> active_orders | n | string:object |  | Dictionary of active orders |
| >>> ORDER_ID | n | string |  | Unique order ID |
| >>>> sk | n | string |  | Security key |
| >>>> lot_size | y | number |  | Lot size |
| >>>> cc | n | string |  | Order’s client code |
| >>>> subscr | n | string |  | Security subscription key |
| >>>> ono | n | string |  | Unique order ID |
| >>>> id | n | string |  | Order’s ext_id |
| >>>> p | n | number |  | Price |
| >>>> q | n | number |  | Integer quantity |
| >>>> q0 | n | number |  | Integer left quantity |
| >>>> d | n | number | direction | Direction |
| >>>> decimals | n | number |  | Decimal places in price |
| >>>> t | n | string | epoch_nsec | Order update time |
| >>>> r | n | boolean |  | Robot’s order or not |
| >>>> __action = del | n | string |  | Only on delete |

Example:

```json
{
    "type": "trans_conn_orders.subscribe",
    "data": {
        "r_id": "1",
        "value": {
            "sec_type": 1048576,
            "name": "roma",
            "full_name": "bitmex_send_roma",
            "active_orders": {
                "1de6bd60-688c-4777-bd17-aef921888290": {
                    "__action": "del"
                }
            }
        }
    },
    "r": "u",
    "eid": "q0",
    "ts": 1674219741002098084
}
```
</details>    
<details>
<summary>Response on error</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = trans_conn_orders.subscribe | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = e | y | string | request_result | Request result |
| data | y | object |  |  |
| > msg | y | string |  | Error message |
| > code | y | number | err_code | Error code |

Example:

```json
{
	"type":"trans_conn_orders.subscribe",
	"data":
	{
		"msg":"Permission denied",
		"code":555
	},
	"ts":1657693572940145200,
	"eid":"qwerty",
	"r":"e"
}
```
</details>    

### Отписка от активных заявок транзакционного подключения робота

Отписаться от активные заявки транзакционного подключения робота

<details>
<summary>Request</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = trans_conn_orders.unsubscribe | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| data | y | object |  |  |
| > sub_eid | y | string | string_36 | Subscription eid |

Example:

```json
{
	"type":"trans_conn_orders.unsubscribe",
	"data":
	{
		"sub_eid":"qwerty"
	},
	"eid":"q"
}
```
</details>    
<details>
<summary>Response on success</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = trans_conn_orders.unsubscribe | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = p | y | string | request_result | Request result |

Example:

```json
{
	"type":"trans_conn_orders.unsubscribe",
	"data":{},
	"r":"p",
	"eid":"q",
	"ts":1669810178671387651
}
```
</details>    
<details>
<summary>Response on error</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = trans_conn_orders.unsubscribe | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = e | y | string | request_result | Request result |
| data | y | object |  |  |
| > msg | y | string |  | Error message |
| > code | y | number | err_code | Error code |

Example:

```json
{
	"type":"trans_conn_orders.unsubscribe",
	"data":
	{
		"msg":"Operation timeout",
		"code":666
	},
	"ts":1657693572940145200,
	"eid":"q",
	"r":"e"
}
```
</details>    

### Снять активную заявку на транзакционном подключении робота

Снять активную заявку на транзакционном подключении робота. Успешный ответ означает только то, что данное сообщение успешно получено роботом, но это не означает, что заявка успешно снята и т.п. Сообщения об успешности или не успешности снятия заявки ходят в логе

<details>
<summary>Request</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = trans_conn_orders.cancel | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| data | y | object |  |  |
| > r_id | y | string |  | Robot ID |
| > order | y | object |  |  |
| >> sec_type | y | number | sec_type | Security type |
| >> name | y | string |  | Connection short name |
| >> cc | y | string |  | Order’s client code |
| >> subscr | y | string |  | Security subscription key |
| >> ono | y | string |  | Unique order ID |
| >> id | y | string |  | Order’s ext_id |
| >> d | y | number | direction | Direction |

Example:

```json
{
	"type": "trans_conn_orders.cancel",
	"data": {
		"r_id": "1",
		"order":
		{
			"sec_type": 33554432,
			"name": "qwe",
			"ono": "16301618769",
			"subscr": "BTC-PERPETUAL",
			"cc": "",
			"id": "0",
			"d": 1
		}
	},
	"eid": "qwerty"
}
```
</details>    
<details>
<summary>Response on success</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = trans_conn_orders.cancel | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = p | y | string | request_result | Request result |
| data | y | object |  |  |
| > r_id | y | string |  | Robot ID |
| > sec_type | y | number | sec_type | Security type |
| > name | y | string |  | Connection short name |
| > cc | y | string |  | Order’s client code |
| > subscr | y | string |  | Security subscription key |
| > ono | y | string |  | Unique order ID |
| > id | y | string |  | Order’s ext_id |
| > d | y | number | direction | Direction |

Example:

```json
{
  "type": "trans_conn_orders.cancel",
  "data": {
    "r_id": "1",
    "sec_type": 33554432,
    "name": "qwe",
    "subscr": "BTC-PERPETUAL",
    "ono": "16301618769",
    "id": "0",
    "cc": "",
    "d": 1
  },
  "r": "p",
  "eid": "q0",
  "ts": 1683801781527007440
}
```
</details>    
<details>
<summary>Response on error</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = trans_conn_orders.cancel | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = e | y | string | request_result | Request result |
| data | y | object |  |  |
| > msg | y | string |  | Error message |
| > code | y | number | err_code | Error code |

Example:

```json
{
	"type":"trans_conn_orders.cancel",
	"data":
	{
		"msg":"Permission denied",
		"code":555
	},
	"ts":1657693572940145200,
	"eid":"qwerty",
	"r":"e"
}
```
</details>    

### Подписка на позиции транзакционного подключения робота

Подписаться на позиции транзакционного подключения робота

В любой момент может быть выслан снапшот

При удалении подключения произойдет отписка

<details>
<summary>Request</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = trans_conn_poses.subscribe | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| data | y | object |  |  |
| > r_id | y | string |  | Robot ID |
| > conn | y | object |  |  |
| >> sec_type | y | number | sec_type | Security type |
| >> name | y | string |  | Connection short name |

Example:

```json
{
	"type": "trans_conn_poses.subscribe",
	"data": {
		"r_id": "1",
		"conn":
		{
			"sec_type":1048576,
			"name":"roma"
		}
	},
	"eid": "qwerty"
}
```
</details>    
<details>

<summary>Response on success (snapshot)</summary> 

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = trans_conn_poses.subscribe | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = s | y | string | request_result | Request result |
| data | y | object |  |  |
| > r_id | y | string |  | Robot ID |
| > value | y | object |  | Portfolio snapshot |
| >> name | y | string |  | Connection short name |
| >> sec_type | y | number | sec_type | Security type |
| >> full_name | y | string |  | Connection long name |
| >> disabled | y | boolean |  | Disabled connection |
| >> stream_state | y | object |  | Dictionary of data-stream states with stream name as a key and value of type stream_status |
| >> both_pos | y | boolean |  | How to display coin pos |
| >> sec_pos | y | string:object |  | Dictionary of security positions |
| >>> SEC_KEY | n | string |  | Unique security key |
| >>>> symbol | n | string |  | Security name |
| >>>> pos | n | number |  | Position |
| >>>> pos_lag | n | number |  | Allowable position difference |
| >>>> pos_eq | n | boolean |  | Check position equality |
| >>>> tgr | n | boolean |  | Send telegram notifications |
| >>>> robot_pos | n | number |  | Robot position |
| >>>> mark_price | n | number |  | Marker price |
| >>>> liq_price | n | number |  | Liquidation price |
| >>>> lot_size | n | number |  | Lot size |
| >> coin_pos | y | string:object |  | Dictionary of security positions |
| >>> COIN_KEY | n | string |  | Unique coin key |
| >>>> symbol | n | string |  | Coin name |
| >>>> pos | n | number |  | Position |
| >>>> pos_lag | n | number |  | Allowable position difference |
| >>>> pos_eq | n | boolean |  | Check position equality |
| >>>> tgr | n | boolean |  | Send telegram notifications |
| >>>> robot_pos | n | number |  | Robot position |
| >>>> mark_price | n | number |  | Marker price |
| >>>> liq_price | n | number |  | Liquidation price |

Example:

```json
{
    "type": "trans_conn_poses.subscribe",
    "data": {
        "r_id": "1",
        "value": {
            "sec_type": 1048576,
            "name": "roma",
            "full_name": "bitmex_send_roma",
            "both_pos": false,
            "disabled": false,
            "sec_pos": {
                "ADAH23": {
                    "symbol": "BM_ADAH23",
                    "pos": 0,
                    "pos_lag": 99999999999999,
                    "pos_eq": false,
                    "tgr": false,
                    "robot_pos": 0,
                    "mark_price": -1,
                    "liq_price": -1,
                    "lot_size": 1
                }
            },
            "coin_pos": {
                "USDT": {
                    "pos": 1000,
                    "pos_lag": 999999999,
                    "pos_eq": false,
                    "tgr": false
                },
                "XBT": {
                    "pos": 0.10791494,
                    "pos_lag": 999999999,
                    "pos_eq": false,
                    "tgr": false
                }
            },
            "stream_state": {
                "Margin": 2,
                "Orders": 2,
                "Positions": 2,
                "Socket": 2,
                "Trades": 2
            }
        }
    },
    "r": "s",
    "eid": "q0",
    "ts": 1674220093555976366
}
```
</details>    
<details>
<summary>Updates</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = trans_conn_poses.subscribe | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = u | y | string | request_result | Request result |
| data | y | object |  |  |
| > r_id | y | string |  | Robot ID |
| > value | y | object |  | Portfolio snapshot |
| >> name | y | string |  | Connection short name |
| >> sec_type | y | number | sec_type | Security type |
| >> full_name | y | string |  | Connection long name |
| >> disabled | n | boolean |  | Disabled connection |
| >> stream_state | n | object |  | Dictionary of data-stream states with stream name as a key and value of type stream_status |
| >> both_pos | n | boolean |  | How to display coin pos |
| >> sec_pos | n | string:object |  | Dictionary of security positions |
| >>> SEC_KEY | n | string |  | Unique security key |
| >>>> symbol | n | string |  | Security name |
| >>>> pos | n | number |  | Position |
| >>>> pos_lag | n | number |  | Allowable position difference |
| >>>> pos_eq | n | boolean |  | Check position equality |
| >>>> tgr | n | boolean |  | Send telegram notifications |
| >>>> robot_pos | n | number |  | Robot position |
| >>>> mark_price | n | number |  | Marker price |
| >>>> liq_price | n | number |  | Liquidation price |
| >>>> lot_size | n | number |  | Lot size |
| >>>> __action = del | n | string |  | Only on delete |
| >> coin_pos | n | string:object |  | Dictionary of security positions |
| >>> COIN_KEY | n | string |  | Unique coin key |
| >>>> symbol | n | string |  | Coin name |
| >>>> pos | n | number |  | Position |
| >>>> pos_lag | n | number |  | Allowable position difference |
| >>>> pos_eq | n | boolean |  | Check position equality |
| >>>> tgr | n | boolean |  | Send telegram notifications |
| >>>> robot_pos | n | number |  | Robot position |
| >>>> mark_price | n | number |  | Marker price |
| >>>> liq_price | n | number |  | Liquidation price |
| >>>> __action = del | n | string |  | Only on delete |

Example:

```json
{
    "type": "trans_conn_poses.subscribe",
    "data": {
        "r_id": "1",
        "value": {
            "sec_type": 1048576,
            "name": "roma",
            "full_name": "bitmex_send_roma",
            "sec_pos": {
                "XBTUSD": {
                    "symbol": "BM_XBTUSD",
                    "pos": 0,
                    "pos_lag": 99999999999999,
                    "pos_eq": false,
                    "tgr": false,
                    "robot_pos": 0,
                    "mark_price": 21129.9,
                    "liq_price": -1,
                    "lot_size": 1
                }
            }
        }
    },
    "r": "u",
    "eid": "q0",
    "ts": 1674220096001698531
}
```
</details>    
<details>
<summary>Response on error</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = trans_conn_poses.subscribe | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = e | y | string | request_result | Request result |
| data | y | object |  |  |
| > msg | y | string |  | Error message |
| > code | y | number | err_code | Error code |

Example:

```json
{
	"type":"trans_conn_poses.subscribe",
	"data":
	{
		"msg":"Permission denied",
		"code":555
	},
	"ts":1657693572940145200,
	"eid":"qwerty",
	"r":"e"
}
```
</details>    

### Отписка от позиций транзакционного подключения робота

Отписаться от позиций транзакционного подключения робота

<details>
<summary>Request</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = trans_conn_poses.unsubscribe | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| data | y | object |  |  |
| > sub_eid | y | string | string_36 | Subscription eid |

Example:

```json
{
	"type":"trans_conn_poses.unsubscribe",
	"data":
	{
		"sub_eid":"qwerty"
	},
	"eid":"q"
}
```
</details>    
<details>
<summary>Response on success</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = trans_conn_poses.unsubscribe | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = p | y | string | request_result | Request result |

Example:

```json
{
	"type":"trans_conn_poses.unsubscribe",
	"data":{},
	"r":"p",
	"eid":"q",
	"ts":1669810178671387651
}
```
</details>    
<details>
<summary>Response on error</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = trans_conn_poses.unsubscribe | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = e | y | string | request_result | Request result |
| data | y | object |  |  |
| > msg | y | string |  | Error message |
| > code | y | number | err_code | Error code |

Example:

```json
{
	"type":"trans_conn_poses.unsubscribe",
	"data":
	{
		"msg":"Operation timeout",
		"code":666
	},
	"ts":1657693572940145200,
	"eid":"q",
	"r":"e"
}
```
</details>    

### Изменить параметры позиций транзакционного подключения робота

Успешный ответ означает что запрос дошел до робота и изменяемые параметры имеют допустимые значения, новые значения полей придут в обновлении позиций (если вы на них подписаны)

<details>
<summary>Request</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = trans_conn_poses.update_sec_pos/trans_conn_poses.update_coin_pos | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| data | y | object |  |  |
| > r_id | y | string |  | Robot ID |
| > pos | y | object |  |  |
| >> sec_type | y | number | sec_type | Security type |
| >> name | y | string |  | Connection short name |
| >> key | y | string |  | Unique position key |
| >> * | n |  |  | Field to update |

Example:

```json
{
	"type": "trans_conn_poses.update_sec_pos",
	"data": {
		"r_id": "1",
		"pos":
		{
			"sec_type": 33554432,
			"name": "qwe",
			"key": "BTC-PERPETUAL",
			"pos_lag": 10
		}
	},
	"eid": "qwerty"
}
```
    
```json
{
	"type": "trans_conn_poses.update_coin_pos",
	"data": {
		"r_id": "1",
		"pos":
		{
			"sec_type": 33554432,
			"name": "qwe",
			"key": "BTC",
			"pos_lag": 10
		}
	},
	"eid": "qwerty"
}
```
</details>    
<details>
<summary>Response on success</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = trans_conn_poses.update_sec_pos/trans_conn_poses.update_coin_pos | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = p | y | string | request_result | Request result |
| data | y | object |  |  |
| > r_id | y | string |  | Robot ID |

Example:

```json
{
    "type": "trans_conn_poses.update_sec_pos",
    "data": {
        "r_id": "1"
    },
    "r": "p",
    "eid": "q0",
    "ts": 1683898111866793521
}
```
</details>    
<details>
<summary>Response on error</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = trans_conn_poses.update_sec_pos/trans_conn_poses.update_coin_pos | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = e | y | string | request_result | Request result |
| data | y | object |  |  |
| > msg | y | string |  | Error message |
| > code | y | number | err_code | Error code |

Example:

```json
{
	"type":"trans_conn_poses.update_sec_pos",
	"data":
	{
		"msg":"Permission denied",
		"code":555
	},
	"ts":1657693572940145200,
	"eid":"qwerty",
	"r":"e"
}
```
</details>    

### Выравнять позицию по бумаге/валюте на транзакционном подключении

Успешный ответ означает только то, что данное сообщение успешно получено роботом, но это не означает, что заявка успешно выставлена. Сообщения об успешности или не успешности выставления заявки ходят в логе

<details>
<summary>Request</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = trans_conn_poses.add_order | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| data | y | object |  |  |
| > r_id | y | string |  | Robot ID |
| > order | y | object |  |  |
| >> sec_type | y | number | sec_type | Security type |
| >> name | y | string |  | Connection short name |
| >> key_subscr | y | string |  | Security’s subscription key |
| >> dir | y | number | direction | Order direction |
| >> oc | y | number |  | 1 — open position, 2 — close position |
| >> cc | y | string |  | Client code |
| >> amount | y | number |  | Order amount (always integer) |
| >> price | y | number |  | Order price |

Example:

```json
{
	"type": "trans_conn_poses.add_order",
	"data": {
		"r_id": "1",
		"order":
		{
			"sec_type": 33554432,
			"name": "qwe",
			"key_subscr": "BTC-PERPETUAL",
			"dir": 1,
			"oc": 1,
			"cc": "",
			"amount": 10,
			"price": 28000
		}
	},
	"eid": "qwerty"
}
```
</details>    
<details>
<summary>Response on success</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = trans_conn_poses.add_order | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = p | y | string | request_result | Request result |
| data | y | object |  |  |
| > r_id | y | string |  | Robot ID |

Example:

```json
{
    "type": "trans_conn_poses.add_order",
    "data": {
        "r_id": "1"
    },
    "r": "p",
    "eid": "q0",
    "ts": 1683898111866793521
}
```
</details>    
<details>
<summary>Response on error</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = trans_conn_poses.add_order | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = e | y | string | request_result | Request result |
| data | y | object |  |  |
| > msg | y | string |  | Error message |
| > code | y | number | err_code | Error code |

Example:

```json
{
	"type":"trans_conn_poses.add_order",
	"data":
	{
		"msg":"Permission denied",
		"code":555
	},
	"ts":1657693572940145200,
	"eid":"qwerty",
	"r":"e"
}
```
</details>    

### Операции с транзакционными подключениями

Disable/enable/переподключить транзакционное подключение

<details>
<summary>Request</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = trans_conn.update | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| data | y | object |  |  |
| > r_id | y | string |  | Robot ID |
| > conn | y | object |  | Connection object |
| >> name | y | string |  | Connection short name |
| >> sec_type | y | number | sec_type | Security type |
| >> * | n | * |  | Other connection fields from template |

Example:

```json
{
    "type": "trans_conn.update",
    "data": {
        "r_id": "1",
        "conn": {
            "sec_type": 67108864,
            "name": "aws",
            "reconnect": true
        }
    },
    "eid": "qwerty"
}
```
    
```json
{
    "type": "trans_conn.update",
    "data": {
        "r_id": "1",
        "conn": {
            "sec_type": 67108864,
            "name": "aws",
            "disabled": true
        }
    },
    "eid": "qwerty"
}
```
</details>    
<details>
<summary>Response on success</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = trans_conn.update | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = p | y | string | request_result | Request result |
| data | y | object |  | Empty dict |

Example:

```json
{
	"type":"trans_conn.update",
	"data":
	{
	},
	"r":"p",
	"eid":"qwerty",
	"ts":1669806718085368646
}
```
</details>    
<details>
<summary>Response on error</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = trans_conn.update | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r=e | y | string | request_result | Request result |
| data | y | object |  |  |
| > msg | y | string |  | Error message |
| > code | y | number | err_code | Error code |

Example:

```json
{
	"type":"trans_conn.update",
	"data":
	{
		"msg":"Permission denied",
		"code":555
	},
	"ts":1657693572940145200,
	"eid":"qwerty",
	"r":"e"
}
```
</details>    

### Выслать вторые части ключей транзакционных подключений

При подключении/переподключении робота к бекенду на фронтенд будет отправлено сообщение (сообщения отправляются только в те сессии, которые подписаны на данного робота) о том, что фронтенду необходимо прислать части зашифрованных параметров подключений для данного робота. В ответ фронтенд должен выслать то, что от него просят

<details>
<summary>Update</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = robot.get_trans_conn_keys | y | string |  | Operation type |
| eid = null | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = u | y | string | request_result | Request result |
| data | y | object |  |  |
| > r_id | y | string |  | Robot ID |

Example:

```json
{
    "type": "robot.get_trans_conn_keys",
    "data": {
        "r_id": "1"
    },
    "r": "u",
    "eid": null,
    "ts": 1683033706186683818
}
```
</details>    
<details>
<summary>Request</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = robot.trans_conn_keys | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| data | y | object |  |  |
| > r_id | y | string |  | Robot ID |
| > ckeys | y | object |  | Connection object |
| >> [] | y | string |  | List of string keys, length of each key should be 72 symbols |

Example:

```json
{
    "type": "robot.trans_conn_keys",
    "data": {
        "r_id": "1",
        "ckeys": [
            "aaaaaaaaxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
        ]
    },
    "eid": "zxc"
}
```
</details>    
<details>
<summary>Response on success</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = robot.trans_conn_keys | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = p | y | string | request_result | Request result |
| data | y | object |  |  |
| > r_id | y | string |  | Robot ID |

Example:

```json
{
    "type": "robot.trans_conn_keys",
    "data": {
        "r_id": "1"
    },
    "r": "p",
    "eid": "zxc",
    "ts": 1683105383212294700
}
```
</details>    
<details>
<summary>Response on error</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = robot.trans_conn_keys | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r=e | y | string | request_result | Request result |
| data | y | object |  |  |
| > msg | y | string |  | Error message |
| > code | y | number | err_code | Error code |

Example:

```json
{
	"type":"robot.trans_conn_keys",
	"data":
	{
		"msg":"Permission denied",
		"code":555
	},
	"ts":1657693572940145200,
	"eid":"qwerty",
	"r":"e"
}
```
</details>    

## Фронт

### Запрос идентификатора шаблона объекта <Anchor :ids="['get_template_id']"/>

Получить идентификатор шаблона для заданного объекта

<details>
<summary>Request</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = get_template_id | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| data | y | object |  |  |
| > view | y | string |  | View ID (portfolio, trans_conn) |
| > id | y | object |  | Object ID |
| >> r_id | n | string |  | Robot ID |
| >> p_id | n | string |  | Portfolio name |

Example:

```json
{
	"type": "get_template_id",
	"data": {
		"view": "portfolio",
		"id": {
			"r_id": "1",
			"p_id": "test"
		}
	},
	"eid": "qwerty"
}
```
</details>    
<details>
<summary>Response on success</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = get_template_id | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = p | y | string | request_result | Request result |
| data | y | object |  |  |
| > template_id | y | string |  | Template ID |

Example:

```json
{
	"type":"get_template_id",
	"data":
	{
		"template_id":"3"
	},
	"r":"p",
	"eid":"qwerty",
	"ts":1669798613250710705
}
```
</details>    
<details>
<summary>Response on error</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = get_template_id | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = e | y | string | request_result | Request result |
| data | y | object |  |  |
| > msg | y | string |  | Error message |
| > code | y | number | err_code | Error code |

Example:

```json
{
	"type":"get_template_id",
	"data":
	{
		"msg":"Permission denied",
		"code":555
	},
	"ts":1657693572940145200,
	"eid":"qwerty",
	"r":"e"
}
```
</details>    

### Запрос шаблона по его идентификатор <Anchor :ids="['get_template_by_id']"/>

Получить шаблон для заданного объекта

<details>
<summary>Request</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = get_template_by_id | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| data | y | object |  |  |
| > template_id | y | string |  | Template ID |

Example:

```json
{
	"type": "get_template_by_id",
	"data": {
		"template_id": "portfolio_viking_base"
	},
	"eid": "qwerty"
}
```
</details>    
<details>
<summary>Response on success</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = get_template_by_id | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = p | y | string | request_result | Request result |
| data | y | object |  |  |
| > template | y | object |  | Template |
| >> template_fields | y | object |  | Template fields |
| >>> portfolio | n | array |  | Portfolio fields |
| >>> security | n | array |  | Portfolio securities fields |
| >>> timetable | n | array |  | Portfolio timetable fields |
| >>> notifications | n | array |  | Portfolio notifications fields |
| >> template_id | y | string|  | Template unique ID |

Example:

```json
{
	"type":"get_templateby_id",
	"data":
	{
      "template": {
        "_comment": "All sorters were not specified, use default sorter for formatter",
        "template_fields": {
          "portfolio": [
            {
              "field": "disabled",
              "title": "Disabled",
              "formatter": "boolean",
              "editor": "boolean",
              "default": false,
              "visible": [
                "list"
              ],
              "disabled": false
            },
            {
              "field": "name",
              "title": "Name",
              "is_key": true,
              "formatter": "string",
              "fullmatch": "[_A-Za-z][0-9_A-Za-z]*",
              "max_len": 30,
              "default": "",
              "visible": true,
              "disabled": false
            },
            {
              "field": "has_virtual",
              "title": "Virtual",
              "formatter": "boolean",
              "default": false,
              "visible": true,
              "disabled": false
            },
            {
              "field": "_save_h",
              "title": "Save history",
              "formatter": "boolean",
              "default": false,
              "visible": true,
              "disabled": false
            },
            {
              "field": "portfolio_chart",
              "title": "Chart",
              "formatter": "action",
              "editor": "action",
              "visible": [
                "list"
              ],
              "disabled": false
            },
            {
              "field": "has_formula",
              "title": "Has formulas",
              "formatter": "boolean",
              "default": false,
              "visible": true,
              "disabled": false
            },
            {
              "field": "re_sell",
              "title": "re_sell",
              "formatter": "boolean",
              "editor": "boolean",
              "set_on_add": false,
              "default": false,
              "visible": [
                "list"
              ],
              "disabled": false
            },
            {
              "field": "re_buy",
              "title": "re_buy",
              "formatter": "boolean",
              "editor": "boolean",
              "set_on_add": false,
              "default": false,
              "visible": [
                "list"
              ],
              "disabled": false
            },
            {
              "field": "to0",
              "title": "To0",
              "formatter": "boolean",
              "editor": "boolean",
              "default": false,
              "visible": [
                "list"
              ],
              "disabled": false
            },
            {
              "field": "use_tt",
              "title": "Use timetable",
              "formatter": "boolean",
              "editor": "boolean",
              "default": false,
              "set_on_import": false,
              "set_on_clone": false,
              "visible": true,
              "disabled": false
            },
            {
              "field": "trading_days",
              "title": "TradingDays",
              "formatter": "bitmask_select",
              "editor": "bitmask_select",
              "enum_values": [
                {
                  "id": 1,
                  "value": "Sunday"
                },
                {
                  "id": 2,
                  "value": "Monday"
                },
                {
                  "id": 4,
                  "value": "Tuesday"
                },
                {
                  "id": 8,
                  "value": "Wednesday"
                },
                {
                  "id": 16,
                  "value": "Thursday"
                },
                {
                  "id": 32,
                  "value": "Friday"
                },
                {
                  "id": 64,
                  "value": "Saturday"
                }
              ],
              "min": 0,
              "max": 127,
              "default": 127,
              "visible": false,
              "disabled": false
            },
            {
              "field": "sell",
              "title": "Sell",
              "formatter": "float",
              "min": -9007199254740991,
              "max": 9007199254740991,
              "default": 0,
              "visible": [
                "list"
              ],
              "disabled": false
            },
            {
              "field": "buy",
              "title": "Buy",
              "formatter": "float",
              "min": -9007199254740991,
              "max": 9007199254740991,
              "default": 0,
              "visible": [
                "list"
              ],
              "disabled": false
            },
            {
              "field": "price_s",
              "title": "Price_s",
              "formatter": "float",
              "min": -9007199254740991,
              "max": 9007199254740991,
              "default": 0,
              "visible": [
                "list"
              ],
              "disabled": false
            },
            {
              "field": "price_b",
              "title": "Price_b",
              "formatter": "float",
              "min": -9007199254740991,
              "max": 9007199254740991,
              "default": 0,
              "visible": [
                "list"
              ],
              "disabled": false
            },
            {
              "field": "_limits_first_leg",
              "title": "",
              "formatter": "group",
              "visible": [
                "form"
              ],
              "disabled": false
            },
            {
              "field": "_limits",
              "title": "<b>Trading signals</b>",
              "group": "_limits_first_leg",
              "formatter": "html_string",
              "visible": [
                "form"
              ],
              "disabled": false
            },
            {
              "field": "lim_s",
              "title": "Lim_Sell",
              "group": "_limits_first_leg",
              "formatter": "float",
              "editor": "float",
              "min": -1000000000,
              "max": 1000000000,
              "default": 0,
              "visible": true,
              "disabled": false
            },
            {
              "field": "lim_b",
              "title": "Lim_Buy",
              "group": "_limits_first_leg",
              "formatter": "float",
              "editor": "float",
              "min": -1000000000,
              "max": 1000000000,
              "default": 0,
              "visible": true,
              "disabled": false
            },
            {
              "field": "_first_leg",
              "title": "<b>First leg settings</b>",
              "group": "_limits_first_leg",
              "formatter": "html_string",
              "visible": [
                "form"
              ],
              "disabled": false
            },
            {
              "field": "quote",
              "title": "Quote",
              "group": "_limits_first_leg",
              "formatter": "boolean",
              "editor": "boolean",
              "default": false,
              "visible": true,
              "disabled": false
            },
            {
              "field": "simply_first",
              "title": "Simply first",
              "group": "_limits_first_leg",
              "formatter": "boolean",
              "editor": "boolean",
              "default": false,
              "visible": true,
              "disabled": false
            },
            {
              "field": "maker",
              "title": "Only maker",
              "group": "_limits_first_leg",
              "formatter": "boolean",
              "editor": "boolean",
              "default": false,
              "visible": true,
              "disabled": false
            },
            {
              "field": "threshold",
              "title": "Threshold",
              "group": "_limits_first_leg",
              "formatter": "float",
              "editor": "float",
              "min": 0,
              "max": 1000000000,
              "default": 0,
              "visible": true,
              "disabled": false
            },
            {
              "field": "pos",
              "title": "Pos",
              "formatter": "integer",
              "editor": "integer",
              "min": -9007199254740991,
              "max": 9007199254740991,
              "default": 0,
              "visible": [
                "list"
              ],
              "disabled": false
            },
            {
              "field": "_poses_volumes",
              "title": "",
              "formatter": "group",
              "visible": [
                "form"
              ],
              "disabled": false
            },
            {
              "field": "_poses",
              "title": "<b>Position limits</b>",
              "group": "_poses_volumes",
              "formatter": "html_string",
              "visible": [
                "form"
              ],
              "disabled": false
            },
            {
              "field": "v_min",
              "title": "v_min",
              "group": "_poses_volumes",
              "formatter": "integer",
              "editor": "integer",
              "min": -9007199254740991,
              "max": 9007199254740991,
              "default": -1,
              "visible": true,
              "disabled": false
            },
            {
              "field": "v_max",
              "title": "v_max",
              "group": "_poses_volumes",
              "formatter": "integer",
              "editor": "integer",
              "min": -9007199254740991,
              "max": 9007199254740991,
              "default": 1,
              "visible": true,
              "disabled": false
            },
            {
              "field": "_volumes",
              "title": "<b>Volumes</b>",
              "group": "_poses_volumes",
              "formatter": "html_string",
              "visible": [
                "form"
              ],
              "disabled": false
            },
            {
              "field": "v_in_l",
              "title": "v_in_left",
              "group": "_poses_volumes",
              "formatter": "integer",
              "editor": "integer",
              "min": 1,
              "max": 9007199254740991,
              "default": 1,
              "visible": true,
              "disabled": false
            },
            {
              "field": "v_in_r",
              "title": "v_in_right",
              "group": "_poses_volumes",
              "formatter": "integer",
              "editor": "integer",
              "min": 1,
              "max": 9007199254740991,
              "default": 1,
              "visible": true,
              "disabled": false
            },
            {
              "field": "v_out_l",
              "title": "v_out_left",
              "group": "_poses_volumes",
              "formatter": "integer",
              "editor": "integer",
              "min": 1,
              "max": 9007199254740991,
              "default": 1,
              "visible": true,
              "disabled": false
            },
            {
              "field": "v_out_r",
              "title": "v_out_right",
              "group": "_poses_volumes",
              "formatter": "integer",
              "editor": "integer",
              "min": 1,
              "max": 9007199254740991,
              "default": 1,
              "visible": true,
              "disabled": false
            },
            {
              "field": "virtual_0_pos",
              "title": "Virt 0 pos",
              "group": "_poses_volumes",
              "formatter": "boolean",
              "editor": "boolean",
              "default": false,
              "visible": true,
              "disabled": false
            },
            {
              "field": "n_perc_fill",
              "title": "n_perc_fill",
              "group": "_poses_volumes",
              "formatter": "integer",
              "editor": "integer",
              "min": 0,
              "max": 100,
              "default": 0,
              "visible": true,
              "disabled": false
            },
            {
              "field": "_utilities",
              "title": "Utilities",
              "formatter": "group",
              "visible": [
                "form"
              ],
              "disabled": false
            },
            {
              "field": "custom_trade",
              "title": "Custom trade",
              "group": "_utilities",
              "formatter": "boolean",
              "editor": "boolean",
              "default": false,
              "visible": [
                "form"
              ],
              "disabled": false
            },
            {
              "field": "trade_formula",
              "title": "Trade formula",
              "group": "_utilities",
              "formatter": "code",
              "editor": "code",
              "max_len": 12000,
              "default": "return 0;",
              "visible": [
                "form"
              ],
              "disabled": false
            },
            {
              "field": "ext_formulas",
              "title": "Extra formulas",
              "group": "_utilities",
              "formatter": "boolean",
              "editor": "boolean",
              "default": false,
              "visible": [
                "form"
              ],
              "disabled": false
            },
            {
              "field": "ext_field1_",
              "title": "Extra field#1",
              "group": "_utilities",
              "formatter": "code",
              "editor": "code",
              "max_len": 12000,
              "default": "return 0;",
              "visible": [
                "form"
              ],
              "disabled": false
            },
            {
              "field": "ext_field2_",
              "title": "Extra field#2",
              "group": "_utilities",
              "formatter": "code",
              "editor": "code",
              "max_len": 12000,
              "default": "return 0;",
              "visible": [
                "form"
              ],
              "disabled": false
            },
            {
              "field": "decimals",
              "title": "Decimals",
              "group": "_utilities",
              "formatter": "integer",
              "editor": "integer",
              "min": 0,
              "max": 14,
              "default": 4,
              "visible": true,
              "disabled": false
            },
            {
              "field": "comment",
              "title": "Comment",
              "group": "_utilities",
              "formatter": "string_area",
              "editor": "string_area",
              "max_len": 100,
              "default": "",
              "visible": true,
              "disabled": false
            },
            {
              "field": "color",
              "title": "Color",
              "group": "_utilities",
              "formatter": "color",
              "editor": "color",
              "default": "#FFFFFF",
              "visible": true,
              "disabled": false
            },
            {
              "field": "log_level",
              "title": "Log level",
              "group": "_utilities",
              "formatter": "bitmask_select",
              "editor": "bitmask_select",
              "enum_values": [
                {
                  "id": 4,
                  "value": "Price info",
                  "tooltip": "Log all price updates"
                },
                {
                  "id": 8,
                  "value": "Adding order reason",
                  "tooltip": "Log reasons for adding/not adding orders"
                },
                {
                  "id": 32,
                  "value": "Limits info",
                  "tooltip": "Log information about moving limits"
                },
                {
                  "id": 1,
                  "value": "Order state",
                  "tooltip": "Log state of orders"
                },
                {
                  "id": 16,
                  "value": "Pos info",
                  "tooltip": "Log position information (real and theoretical)"
                },
                {
                  "id": 64,
                  "value": "v_in/v_out info",
                  "tooltip": "Log information about \"Is first\" contract order quantity"
                },
                {
                  "id": 256,
                  "value": "Orderbook info",
                  "tooltip": "Log orderbook"
                },
                {
                  "id": 2,
                  "value": "Option info",
                  "tooltip": "Log information about options"
                }
              ],
              "default": 0,
              "visible": true,
              "disabled": false
            },
            {
              "field": "_sh_f",
              "title": "Shared formulas",
              "group": "_utilities",
              "formatter": "boolean",
              "editor": "boolean",
              "default": true,
              "visible": true,
              "disabled": false
            },
            {
              "field": "_trading_options",
              "title": "Trading options",
              "formatter": "group",
              "visible": [
                "form"
              ],
              "disabled": false
            },
            {
              "field": "portfolio_type",
              "title": "Type",
              "group": "_trading_options",
              "formatter": "select",
              "editor": "select",
              "enum_values": [
                {
                  "id": 0,
                  "value": "Arbitrage",
                  "tooltip": "Trading using all specified parameters"
                },
                {
                  "id": 1,
                  "value": "Option hedge",
                  "tooltip": "Main contract count=1/delta, other contracts count=1"
                },
                {
                  "id": 3,
                  "value": "TP algo",
                  "tooltip": "Algorithm with TP for main contract"
                },
                {
                  "id": 4,
                  "value": "TP algo 2",
                  "tooltip": "Another algorithm with TP for main contract with timer/SL"
                }
              ],
              "default": 0,
              "visible": [
                "form"
              ],
              "disabled": false
            },
            {
              "field": "type_trade",
              "title": "Type trade",
              "group": "_trading_options",
              "formatter": "select",
              "editor": "select",
              "enum_values": [
                {
                  "id": 0,
                  "value": "Price",
                  "tooltip": "Trade on bid/offer"
                },
                {
                  "id": 1,
                  "value": "IV",
                  "tooltip": "Trade on IV"
                }
              ],
              "default": 0,
              "visible": true,
              "disabled": false
            },
            {
              "field": "price_type",
              "title": "Type price",
              "group": "_trading_options",
              "formatter": "select",
              "editor": "select",
              "enum_values": [
                {
                  "id": 0,
                  "value": "Bid/offer",
                  "tooltip": "Trade on bid/offer"
                },
                {
                  "id": 1,
                  "value": "Orderbook",
                  "tooltip": "Find prices in orderbook"
                },
                {
                  "id": 2,
                  "value": "Orderbook+filter",
                  "tooltip": "Find prices in orderbook and filter your orders"
                }
              ],
              "default": 0,
              "visible": true,
              "disabled": false
            },
            {
              "field": "portfolio_num",
              "title": "Order ID",
              "group": "_trading_options",
              "formatter": "select",
              "editor": "select",
              "enum_values": [
                {
                  "id": 0,
                  "value": "a"
                },
                {
                  "id": 1,
                  "value": "b"
                },
                {
                  "id": 2,
                  "value": "c"
                },
                {
                  "id": 3,
                  "value": "d"
                },
                {
                  "id": 4,
                  "value": "e"
                },
                {
                  "id": 5,
                  "value": "f"
                },
                {
                  "id": 6,
                  "value": "g"
                },
                {
                  "id": 7,
                  "value": "h"
                },
                {
                  "id": 8,
                  "value": "i"
                },
                {
                  "id": 9,
                  "value": "j"
                },
                {
                  "id": 10,
                  "value": "k"
                },
                {
                  "id": 11,
                  "value": "l"
                },
                {
                  "id": 12,
                  "value": "m"
                },
                {
                  "id": 13,
                  "value": "n"
                },
                {
                  "id": 14,
                  "value": "o"
                },
                {
                  "id": 15,
                  "value": "p"
                },
                {
                  "id": 16,
                  "value": "q"
                },
                {
                  "id": 17,
                  "value": "r"
                },
                {
                  "id": 18,
                  "value": "s"
                },
                {
                  "id": 19,
                  "value": "t"
                },
                {
                  "id": 20,
                  "value": "u"
                },
                {
                  "id": 21,
                  "value": "v"
                },
                {
                  "id": 22,
                  "value": "w"
                },
                {
                  "id": 23,
                  "value": "x"
                },
                {
                  "id": 24,
                  "value": "y"
                },
                {
                  "id": 25,
                  "value": "z"
                },
                {
                  "id": -32,
                  "value": "A"
                },
                {
                  "id": -31,
                  "value": "B"
                },
                {
                  "id": -30,
                  "value": "C"
                },
                {
                  "id": -29,
                  "value": "D"
                },
                {
                  "id": -28,
                  "value": "E"
                },
                {
                  "id": -27,
                  "value": "F"
                },
                {
                  "id": -26,
                  "value": "G"
                },
                {
                  "id": -25,
                  "value": "H"
                },
                {
                  "id": -24,
                  "value": "I"
                },
                {
                  "id": -23,
                  "value": "J"
                },
                {
                  "id": -22,
                  "value": "K"
                },
                {
                  "id": -21,
                  "value": "L"
                },
                {
                  "id": -20,
                  "value": "M"
                },
                {
                  "id": -19,
                  "value": "N"
                },
                {
                  "id": -18,
                  "value": "O"
                },
                {
                  "id": -17,
                  "value": "P"
                },
                {
                  "id": -16,
                  "value": "Q"
                },
                {
                  "id": -15,
                  "value": "R"
                },
                {
                  "id": -14,
                  "value": "S"
                },
                {
                  "id": -13,
                  "value": "T"
                },
                {
                  "id": -12,
                  "value": "U"
                },
                {
                  "id": -11,
                  "value": "V"
                },
                {
                  "id": -10,
                  "value": "W"
                },
                {
                  "id": -9,
                  "value": "X"
                },
                {
                  "id": -8,
                  "value": "Y"
                },
                {
                  "id": -7,
                  "value": "Z"
                }
              ],
              "default": 0,
              "visible": true,
              "disabled": false
            },
            {
              "field": "hedge_after",
              "title": "Hedge (sec)",
              "group": "_trading_options",
              "formatter": "integer",
              "editor": "integer",
              "min": -1,
              "max": 1000000000,
              "default": 1,
              "visible": [
                "form"
              ],
              "disabled": false
            },
            {
              "field": "equal_prices",
              "title": "Equal prices",
              "group": "_trading_options",
              "formatter": "boolean",
              "editor": "boolean",
              "default": false,
              "visible": [
                "form"
              ],
              "disabled": false
            },
            {
              "field": "_limits_shift",
              "title": "Trading signals shift",
              "formatter": "group",
              "visible": [
                "form"
              ],
              "disabled": false
            },
            {
              "field": "k",
              "title": "K",
              "group": "_limits_shift",
              "formatter": "float",
              "editor": "float",
              "min": -1000000000,
              "max": 1000000000,
              "default": 0,
              "visible": true,
              "disabled": false
            },
            {
              "field": "tp",
              "title": "TP",
              "group": "_limits_shift",
              "formatter": "float",
              "editor": "float",
              "min": -1000000000,
              "max": 1000000000,
              "default": 1,
              "visible": true,
              "disabled": false
            },
            {
              "field": "k1",
              "title": "K1",
              "group": "_limits_shift",
              "formatter": "float",
              "editor": "float",
              "min": -1000000000,
              "max": 1000000000,
              "default": 0,
              "visible": true,
              "disabled": false
            },
            {
              "field": "k2",
              "title": "K2",
              "group": "_limits_shift",
              "formatter": "float",
              "editor": "float",
              "min": -1000000000,
              "max": 1000000000,
              "default": 0,
              "visible": true,
              "disabled": false
            },
            {
              "field": "timer",
              "title": "Limits timer",
              "group": "_limits_shift",
              "formatter": "integer",
              "editor": "integer",
              "min": 1,
              "max": 100000,
              "default": 1,
              "visible": true,
              "disabled": false
            },
            {
              "field": "percent",
              "title": "Percent",
              "group": "_limits_shift",
              "formatter": "float",
              "editor": "float",
              "min": 0,
              "max": 200,
              "default": 100,
              "visible": true,
              "disabled": false
            },
            {
              "field": "always_limits_timer",
              "title": "Always timer",
              "group": "_limits_shift",
              "formatter": "boolean",
              "editor": "boolean",
              "default": false,
              "visible": [
                "form"
              ],
              "disabled": false
            },
            {
              "field": "_anti_spam",
              "title": "Anti \"spam\"",
              "formatter": "group",
              "visible": [
                "form"
              ],
              "disabled": false
            },
            {
              "field": "delta",
              "title": "Delta",
              "group": "_anti_spam",
              "formatter": "float",
              "editor": "float",
              "min": 0,
              "max": 1000000000,
              "default": 0,
              "visible": true,
              "disabled": false
            },
            {
              "field": "first_delta",
              "title": "First delta",
              "group": "_anti_spam",
              "formatter": "float",
              "editor": "float",
              "min": 0,
              "max": 200,
              "default": 0,
              "visible": true,
              "disabled": false
            },
            {
              "field": "mkt_volume",
              "title": "Market volume",
              "group": "_anti_spam",
              "formatter": "exchange",
              "editor": "exchange",
              "min": 0,
              "max": 9007199254740991,
              "default": 100,
              "visible": true,
              "disabled": false
            },
            {
              "field": "price_check",
              "title": "Price check",
              "group": "_anti_spam",
              "formatter": "float",
              "editor": "float",
              "min": -1000000000,
              "max": 1000000000,
              "default": 10,
              "visible": true,
              "disabled": false
            },
            {
              "field": "max_not_hedged",
              "title": "Max not hedged",
              "group": "_anti_spam",
              "formatter": "integer",
              "editor": "integer",
              "min": 1,
              "max": 70,
              "default": 1,
              "visible": true,
              "disabled": false
            },
            {
              "field": "_max_not_hedged_adm",
              "title": "Max not hedged adm",
              "group": "_anti_spam",
              "formatter": "integer",
              "editor": "integer",
              "min": 1,
              "max": 1000,
              "default": 1000,
              "visible": true,
              "disabled": false
            },
            {
              "field": "overlay",
              "title": "Overlay",
              "group": "_anti_spam",
              "formatter": "integer",
              "editor": "integer",
              "min": 0,
              "max": 9007199254740991,
              "default": 0,
              "visible": true,
              "disabled": false
            },
            {
              "field": "sell_status",
              "title": "Sell status",
              "formatter": "select",
              "set_on_action": 0,
              "set_on_add": 0,
              "enum_values": [
                {
                  "id": 0,
                  "value": "free"
                },
                {
                  "id": 1,
                  "value": "adding"
                },
                {
                  "id": 2,
                  "value": "running"
                },
                {
                  "id": 4,
                  "value": "deleting"
                },
                {
                  "id": 5,
                  "value": "first_deleting"
                },
                {
                  "id": 6,
                  "value": "sl_deleting"
                },
                {
                  "id": 7,
                  "value": "moving"
                },
                {
                  "id": 99,
                  "value": "error"
                }
              ],
              "default": 0,
              "visible": [
                "list"
              ],
              "disabled": false
            },
            {
              "field": "buy_status",
              "title": "Buy status",
              "formatter": "select",
              "set_on_action": 0,
              "set_on_add": 0,
              "enum_values": [
                {
                  "id": 0,
                  "value": "free"
                },
                {
                  "id": 1,
                  "value": "adding"
                },
                {
                  "id": 2,
                  "value": "running"
                },
                {
                  "id": 4,
                  "value": "deleting"
                },
                {
                  "id": 5,
                  "value": "first_deleting"
                },
                {
                  "id": 6,
                  "value": "sl_deleting"
                },
                {
                  "id": 7,
                  "value": "moving"
                },
                {
                  "id": 99,
                  "value": "error"
                }
              ],
              "default": 0,
              "visible": [
                "list"
              ],
              "disabled": false
            },
            {
              "field": "return_first",
              "title": "Return first",
              "formatter": "exchange",
              "set_on_action": 0,
              "min": 0,
              "max": 9007199254740991,
              "default": 0,
              "visible": [
                "list"
              ],
              "disabled": false
            },
            {
              "field": "opened_comission",
              "title": "Commission sum",
              "formatter": "float",
              "editor": "float",
              "min": -9007199254740991,
              "max": 9007199254740991,
              "default": 0,
              "visible": [
                "list"
              ],
              "disabled": false
            },
            {
              "field": "opened",
              "title": "Opened",
              "formatter": "float",
              "editor": "float",
              "min": -9007199254740991,
              "max": 9007199254740991,
              "default": 0,
              "visible": [
                "list"
              ],
              "disabled": false
            },
            {
              "field": "fin_res",
              "title": "Fin res",
              "formatter": "float",
              "min": -9007199254740991,
              "max": 9007199254740991,
              "default": 0,
              "visible": [
                "list"
              ],
              "disabled": false
            },
            {
              "field": "fin_res_wo_c",
              "title": "Fin res wo C",
              "formatter": "float",
              "min": -9007199254740991,
              "max": 9007199254740991,
              "default": 0,
              "visible": [
                "list"
              ],
              "disabled": false
            },
            {
              "field": "sell_portfolio",
              "title": "Sell clicker",
              "formatter": "action",
              "editor": "action",
              "default": "",
              "visible": [
                "list"
              ],
              "disabled": false
            },
            {
              "field": "buy_portfolio",
              "title": "Buy clicker",
              "formatter": "action",
              "editor": "action",
              "default": "",
              "visible": [
                "list"
              ],
              "disabled": false
            },
            {
              "field": "start",
              "title": "Start portfolios",
              "formatter": "action",
              "editor": "action",
              "portfolio_action": {
                "re_sell": true,
                "re_buy": true
              },
              "visible": [
                "toolbar"
              ],
              "disabled": false
            },
            {
              "field": "stop",
              "title": "Stop portfolios",
              "portfolio_action": {
                "re_sell": false,
                "re_buy": false
              },
              "formatter": "action",
              "editor": "action",
              "visible": [
                "toolbar"
              ],
              "disabled": false
            },
            {
              "field": "hard_stop",
              "title": "Hard stop",
              "formatter": "action",
              "editor": "action",
              "visible": [
                "toolbar"
              ],
              "dependent_fields": {
                "portfolio": [
                  "re_sell",
                  "re_buy",
                  "use_tt",
                  "ext_formulas",
                  "custom_trade"
                ],
                "security": [
                  "count_type",
                  "ratio_type"
                ]
              },
              "disabled": false
            },
            {
              "field": "formulas_stop",
              "title": "Stop formulas",
              "formatter": "action",
              "editor": "action",
              "visible": [
                "toolbar"
              ],
              "dependent_fields": {
                "portfolio": [
                  "re_sell",
                  "re_buy",
                  "use_tt",
                  "ext_formulas",
                  "custom_trade"
                ],
                "security": [
                  "count_type",
                  "ratio_type"
                ]
              },
              "disabled": false
            },
            {
              "field": "reset_statuses",
              "title": "Reset statuses",
              "formatter": "action",
              "editor": "action",
              "visible": [
                "toolbar"
              ],
              "disabled": false
            },
            {
              "field": "to_market",
              "title": "To market",
              "formatter": "action",
              "editor": "action",
              "default": "",
              "visible": [
                "list",
                "toolbar"
              ],
              "disabled": false
            },
            {
              "field": "order_security",
              "title": "Place order",
              "formatter": "action",
              "editor": "action",
              "default": "",
              "visible": [
                "list"
              ],
              "disabled": false
            },
            {
              "field": "ext_field1",
              "title": "Extra field#1",
              "formatter": "float",
              "min": -1000000000,
              "max": 1000000000,
              "default": 0,
              "visible": [
                "list"
              ],
              "disabled": false
            },
            {
              "field": "ext_field2",
              "title": "Extra field#2",
              "formatter": "float",
              "min": -1000000000,
              "max": 1000000000,
              "default": 0,
              "visible": [
                "list"
              ],
              "disabled": false
            },
            {
              "field": "owner",
              "title": "Owner",
              "formatter": "string",
              "default": "",
              "visible": [
                "list"
              ],
              "disabled": false
            },
            {
              "field": "uf0",
              "title": "User field#0",
              "formatter": "user_value",
              "editor": "user_value",
              "min": -9007199254740991,
              "max": 9007199254740991,
              "max_len": 64,
              "default": {},
              "visible": [
                "list"
              ],
              "disabled": false
            },
            {
              "field": "uf1",
              "title": "User field#1",
              "formatter": "user_value",
              "editor": "user_value",
              "min": -9007199254740991,
              "max": 9007199254740991,
              "max_len": 64,
              "default": {},
              "visible": [
                "list"
              ],
              "disabled": false
            },
            {
              "field": "uf2",
              "title": "User field#2",
              "formatter": "user_value",
              "editor": "user_value",
              "min": -9007199254740991,
              "max": 9007199254740991,
              "max_len": 64,
              "default": {},
              "visible": [
                "list"
              ],
              "disabled": false
            },
            {
              "field": "uf3",
              "title": "User field#3",
              "formatter": "user_value",
              "editor": "user_value",
              "min": -9007199254740991,
              "max": 9007199254740991,
              "max_len": 64,
              "default": {},
              "visible": [
                "list"
              ],
              "disabled": false
            },
            {
              "field": "uf4",
              "title": "User field#4",
              "formatter": "user_value",
              "editor": "user_value",
              "min": -9007199254740991,
              "max": 9007199254740991,
              "max_len": 64,
              "default": {},
              "visible": [
                "list"
              ],
              "disabled": false
            },
            {
              "field": "uf5",
              "title": "User field#5",
              "formatter": "user_value",
              "editor": "user_value",
              "min": -9007199254740991,
              "max": 9007199254740991,
              "max_len": 64,
              "default": {},
              "visible": [
                "list"
              ],
              "disabled": false
            },
            {
              "field": "uf6",
              "title": "User field#6",
              "formatter": "user_value",
              "editor": "user_value",
              "min": -9007199254740991,
              "max": 9007199254740991,
              "max_len": 64,
              "default": {},
              "visible": [
                "list"
              ],
              "disabled": false
            },
            {
              "field": "uf7",
              "title": "User field#7",
              "formatter": "user_value",
              "editor": "user_value",
              "min": -9007199254740991,
              "max": 9007199254740991,
              "max_len": 64,
              "default": {},
              "visible": [
                "list"
              ],
              "disabled": false
            },
            {
              "field": "uf8",
              "title": "User field#8",
              "formatter": "user_value",
              "editor": "user_value",
              "min": -9007199254740991,
              "max": 9007199254740991,
              "max_len": 64,
              "default": {},
              "visible": [
                "list"
              ],
              "disabled": false
            },
            {
              "field": "uf9",
              "title": "User field#9",
              "formatter": "user_value",
              "editor": "user_value",
              "min": -9007199254740991,
              "max": 9007199254740991,
              "max_len": 64,
              "default": {},
              "visible": [
                "list"
              ],
              "disabled": false
            },
            {
              "field": "uf10",
              "title": "User field#10",
              "formatter": "user_value",
              "editor": "user_value",
              "min": -9007199254740991,
              "max": 9007199254740991,
              "max_len": 64,
              "default": {},
              "visible": [
                "list"
              ],
              "disabled": false
            },
            {
              "field": "uf11",
              "title": "User field#11",
              "formatter": "user_value",
              "editor": "user_value",
              "min": -9007199254740991,
              "max": 9007199254740991,
              "max_len": 64,
              "default": {},
              "visible": [
                "list"
              ],
              "disabled": false
            },
            {
              "field": "uf12",
              "title": "User field#12",
              "formatter": "user_value",
              "editor": "user_value",
              "min": -9007199254740991,
              "max": 9007199254740991,
              "max_len": 64,
              "default": {},
              "visible": [
                "list"
              ],
              "disabled": false
            },
            {
              "field": "uf13",
              "title": "User field#13",
              "formatter": "user_value",
              "editor": "user_value",
              "min": -9007199254740991,
              "max": 9007199254740991,
              "max_len": 64,
              "default": {},
              "visible": [
                "list"
              ],
              "disabled": false
            },
            {
              "field": "uf14",
              "title": "User field#14",
              "formatter": "user_value",
              "editor": "user_value",
              "min": -9007199254740991,
              "max": 9007199254740991,
              "max_len": 64,
              "default": {},
              "visible": [
                "list"
              ],
              "disabled": false
            },
            {
              "field": "uf15",
              "title": "User field#15",
              "formatter": "user_value",
              "editor": "user_value",
              "min": -9007199254740991,
              "max": 9007199254740991,
              "max_len": 64,
              "default": {},
              "visible": [
                "list"
              ],
              "disabled": false
            },
            {
              "field": "uf16",
              "title": "User field#16",
              "formatter": "user_value",
              "editor": "user_value",
              "min": -9007199254740991,
              "max": 9007199254740991,
              "max_len": 64,
              "default": {},
              "visible": [
                "list"
              ],
              "disabled": false
            },
            {
              "field": "uf17",
              "title": "User field#17",
              "formatter": "user_value",
              "editor": "user_value",
              "min": -9007199254740991,
              "max": 9007199254740991,
              "max_len": 64,
              "default": {},
              "visible": [
                "list"
              ],
              "disabled": false
            },
            {
              "field": "uf18",
              "title": "User field#18",
              "formatter": "user_value",
              "editor": "user_value",
              "min": -9007199254740991,
              "max": 9007199254740991,
              "max_len": 64,
              "default": {},
              "visible": [
                "list"
              ],
              "disabled": false
            },
            {
              "field": "uf19",
              "title": "User field#19",
              "formatter": "user_value",
              "editor": "user_value",
              "min": -9007199254740991,
              "max": 9007199254740991,
              "max_len": 64,
              "default": {},
              "visible": [
                "list"
              ],
              "disabled": false
            },
            {
              "field": "cur_day_month",
              "title": "Cur day of month",
              "formatter": "integer",
              "editor": "integer",
              "min": -1,
              "max": 32,
              "default": 1,
              "visible": false,
              "disabled": false
            },
            {
              "field": "lot_size",
              "title": "lot_size",
              "formatter": "float",
              "editor": "float",
              "min": 1e-8,
              "max": 1,
              "default": 1,
              "visible": false,
              "disabled": false
            },
            {
              "field": "move_limits1_date",
              "title": "Cur day of month",
              "formatter": "integer",
              "editor": "integer",
              "min": -1,
              "max": 9007199254740991,
              "default": -1,
              "visible": false,
              "disabled": false
            },
            {
              "field": "update",
              "title": "Update",
              "formatter": "action",
              "editor": "action",
              "visible": false,
              "disabled": false
            },
            {
              "field": "add_security",
              "title": "Add security",
              "formatter": "action",
              "editor": "action",
              "visible": [
                "form"
              ],
              "disabled": false
            },
            {
              "field": "remove_security",
              "title": "Remove security",
              "formatter": "action",
              "editor": "action",
              "visible": [
                "form"
              ],
              "disabled": false
            },
            {
              "field": "replace_security",
              "title": "Replace security",
              "formatter": "action",
              "editor": "action",
              "visible": [
                "form"
              ],
              "disabled": false
            },
            {
              "field": "update_timetable",
              "title": "Add timetable row",
              "formatter": "action",
              "editor": "action",
              "visible": [
                "form"
              ],
              "disabled": false
            },
            {
              "field": "_to0",
              "title": "To0",
              "portfolio_action": {
                "to0": true
              },
              "formatter": "action",
              "editor": "action",
              "visible": [
                "toolbar"
              ],
              "disabled": false
            },
            {
              "field": "_trading_days",
              "title": "TradingDays",
              "formatter": "action",
              "editor": "action",
              "visible": [
                "toolbar"
              ],
              "disabled": false
            },
            {
              "field": "remove",
              "title": "Remove",
              "formatter": "action",
              "editor": "action",
              "visible": [
                "toolbar"
              ],
              "disabled": false
            },
            {
              "field": "clone",
              "title": "Clone portfolio",
              "formatter": "action",
              "editor": "action",
              "visible": [
                "toolbar"
              ],
              "disabled": false
            },
            {
              "field": "enable",
              "title": "Enable portfolio",
              "portfolio_action": {
                "disabled": false
              },
              "formatter": "action",
              "editor": "action",
              "visible": [
                "toolbar"
              ],
              "disabled": false
            },
            {
              "field": "_disable",
              "title": "Disable portfolio",
              "portfolio_action": {
                "disabled": true
              },
              "formatter": "action",
              "editor": "action",
              "visible": [
                "toolbar"
              ],
              "disabled": false
            },
            {
              "field": "export",
              "title": "Export portfolio",
              "formatter": "action",
              "editor": "action",
              "visible": [
                "toolbar"
              ],
              "disabled": false
            },
            {
              "field": "import",
              "title": "Import portfolio",
              "formatter": "action",
              "editor": "action",
              "visible": [
                "toolbar"
              ],
              "disabled": false
            },
            {
              "field": "mail_to",
              "title": "Mail to",
              "formatter": "action",
              "editor": "action",
              "visible": [
                "toolbar"
              ],
              "disabled": false
            }
          ],
          "user_fields": [
            {
              "field": "id",
              "title": "ID",
              "formatter": "integer",
              "min": 0,
              "max": 100,
              "default": 0,
              "visible": true,
              "disabled": false
            },
            {
              "field": "c",
              "title": "Caption",
              "formatter": "string",
              "editor": "string",
              "max_len": 64,
              "default": "",
              "visible": true,
              "disabled": false
            },
            {
              "field": "v",
              "title": "Value",
              "formatter": "float",
              "editor": "float",
              "min": -9007199254740991,
              "max": 9007199254740991,
              "default": 0,
              "visible": true,
              "disabled": false
            }
          ],
          "security": [
            {
              "field": "sec_type",
              "title": "Exchange",
              "is_key": true,
              "visible": true,
              "disabled": false,
              "formatter": "select",
              "default": 1,
              "enum_values": [
                {
                  "id": 0,
                  "value": "ANY"
                },
                {
                  "id": 1,
                  "value": "MOEX_OPT"
                },
                {
                  "id": 2,
                  "value": "MOEX_FUT"
                },
                {
                  "id": 3,
                  "value": "MOEX_FUT_OPT"
                },
                {
                  "id": 4,
                  "value": "MOEX_FOND"
                },
                {
                  "id": 8,
                  "value": "MOEX_CURR"
                },
                {
                  "id": 12,
                  "value": "MOEX_FOND_CURR"
                },
                {
                  "id": 16,
                  "value": "EXANTE"
                },
                {
                  "id": 32,
                  "value": "SPB"
                },
                {
                  "id": 64,
                  "value": "BYBITSPOT"
                },
                {
                  "id": 128,
                  "value": "EBS"
                },
                {
                  "id": 256,
                  "value": "FEEDOS"
                },
                {
                  "id": 512,
                  "value": "SPIMEX"
                },
                {
                  "id": 1024,
                  "value": "ALORSPB"
                },
                {
                  "id": 2048,
                  "value": "CQG"
                },
                {
                  "id": 34832,
                  "value": "CQG_EXANTE_J2T"
                },
                {
                  "id": 2064,
                  "value": "CQG_EXANTE"
                },
                {
                  "id": 8192,
                  "value": "ALORMOEX"
                },
                {
                  "id": 16384,
                  "value": "CTRADER"
                },
                {
                  "id": 32768,
                  "value": "J2T"
                },
                {
                  "id": 65536,
                  "value": "KRAKEN"
                },
                {
                  "id": 268435456,
                  "value": "KRAKENFUT"
                },
                {
                  "id": 262144,
                  "value": "BITFINEX"
                },
                {
                  "id": 524288,
                  "value": "HITBTC"
                },
                {
                  "id": 1048576,
                  "value": "BITMEX"
                },
                {
                  "id": 4194304,
                  "value": "BINANCE"
                },
                {
                  "id": 34359738368,
                  "value": "BINANCEFUT"
                },
                {
                  "id": 4398046511104,
                  "value": "BINANCECM"
                },
                {
                  "id": 33554432,
                  "value": "DERIBIT"
                },
                {
                  "id": 67108864,
                  "value": "OKEX"
                },
                {
                  "id": 134217728,
                  "value": "BEQUANT"
                },
                {
                  "id": 536870912,
                  "value": "KUCOIN"
                },
                {
                  "id": 2147483648,
                  "value": "CEXIO"
                },
                {
                  "id": 4294967296,
                  "value": "HUOBI"
                },
                {
                  "id": 8589934592,
                  "value": "HUOBIFUT"
                },
                {
                  "id": 4096,
                  "value": "HUOBIFUTCM"
                },
                {
                  "id": 131072,
                  "value": "HUOBIFUTUM"
                },
                {
                  "id": 2199023255552,
                  "value": "VIKINGTRADE"
                },
                {
                  "id": 17592186044416,
                  "value": "MOEX_IDX"
                },
                {
                  "id": 35184372088832,
                  "value": "BYBIT"
                },
                {
                  "id": 70368744177664,
                  "value": "LMAX"
                },
                {
                  "id": 140737488355328,
                  "value": "IMEX"
                },
                {
                  "id": 9223372036854776000,
                  "value": "ALL"
                }
              ]
            },
            {
              "field": "sec_key",
              "title": "SecKey",
              "is_key": true,
              "formatter": "string",
              "default": "",
              "visible": true,
              "disabled": false
            },
            {
              "field": "sec_key_subscr",
              "title": "Key subscription",
              "is_key": true,
              "formatter": "string",
              "default": "",
              "visible": true,
              "disabled": false
            },
            {
              "field": "sec_board",
              "title": "SecBoard",
              "is_key": true,
              "formatter": "string",
              "default": "",
              "visible": true,
              "disabled": false
            },
            {
              "field": "sec_code",
              "title": "SecCode",
              "is_key": true,
              "formatter": "string",
              "default": "",
              "visible": true,
              "disabled": false
            },
            {
              "field": "pos",
              "title": "Curpos",
              "formatter": "exchange",
              "editor": "exchange",
              "min": -9007199254740991,
              "max": 9007199254740991,
              "default": 0,
              "visible": true,
              "disabled": false
            },
            {
              "field": "count_type",
              "title": "Count type",
              "formatter": "select",
              "editor": "select",
              "enum_values": [
                {
                  "id": 0,
                  "value": "Count constant"
                },
                {
                  "id": 1,
                  "value": "Count formula"
                }
              ],
              "default": 0,
              "visible": true,
              "disabled": false
            },
            {
              "field": "count",
              "title": "Count",
              "formatter": "exchange",
              "editor": "exchange",
              "min": 0,
              "max": 9007199254740991,
              "default": 1,
              "visible": true,
              "disabled": false
            },
            {
              "field": "count_formula",
              "title": "Count formula",
              "formatter": "code",
              "editor": "code",
              "max_len": 12000,
              "default": "return 1;",
              "visible": true,
              "disabled": false
            },
            {
              "field": "k",
              "title": "k",
              "formatter": "float",
              "editor": "float",
              "min": -1000000000,
              "max": 1000000000,
              "default": 0,
              "visible": true,
              "disabled": false
            },
            {
              "field": "on_buy",
              "title": "On buy",
              "formatter": "select",
              "editor": "select",
              "enum_values": [
                {
                  "id": 1,
                  "value": "Buy"
                },
                {
                  "id": 2,
                  "value": "Sell"
                }
              ],
              "default": 1,
              "visible": true,
              "disabled": false
            },
            {
              "field": "is_first",
              "title": "Is first",
              "unique": true,
              "formatter": "boolean",
              "editor": "boolean",
              "default": false,
              "visible": true,
              "disabled": false
            },
            {
              "field": "sle",
              "title": "SLE",
              "formatter": "boolean",
              "editor": "boolean",
              "default": false,
              "visible": true,
              "disabled": false
            },
            {
              "field": "sl",
              "title": "SL",
              "formatter": "float",
              "editor": "float",
              "min": -1000000000,
              "max": 1000000000,
              "default": 1000,
              "visible": true,
              "disabled": false
            },
            {
              "field": "k_sl",
              "title": "k_sl",
              "formatter": "float",
              "editor": "float",
              "min": -1000000000,
              "max": 1000000000,
              "default": 0,
              "visible": true,
              "disabled": false
            },
            {
              "field": "te",
              "title": "TE",
              "formatter": "boolean",
              "editor": "boolean",
              "default": true,
              "visible": true,
              "disabled": false
            },
            {
              "field": "timer",
              "title": "Timer",
              "formatter": "integer",
              "editor": "integer",
              "min": 0,
              "max": 1000000000,
              "default": 60,
              "visible": true,
              "disabled": false
            },
            {
              "field": "percent_of_quantity",
              "title": "Percent of quantity",
              "formatter": "float",
              "editor": "float",
              "min": 0,
              "max": 1000000000,
              "default": 100,
              "visible": true,
              "disabled": false
            },
            {
              "field": "ratio_sign",
              "title": "Ratio sign",
              "formatter": "select",
              "editor": "select",
              "enum_values": [
                {
                  "id": 0,
                  "value": "*"
                },
                {
                  "id": 1,
                  "value": "+"
                }
              ],
              "default": 0,
              "visible": true,
              "disabled": false
            },
            {
              "field": "ratio_type",
              "title": "Ratio type",
              "formatter": "select",
              "editor": "select",
              "enum_values": [
                {
                  "id": 0,
                  "value": "Ratio constant"
                },
                {
                  "id": 1,
                  "value": "Ratio formula"
                }
              ],
              "default": 0,
              "visible": true,
              "disabled": false
            },
            {
              "field": "ratio",
              "title": "Ratio",
              "formatter": "float",
              "editor": "float",
              "min": -1000000000,
              "max": 1000000000,
              "default": 1,
              "visible": true,
              "disabled": false
            },
            {
              "field": "ratio_b_formula",
              "title": "Ratio buy formula",
              "formatter": "code",
              "editor": "code",
              "max_len": 12000,
              "default": "return 1;",
              "visible": true,
              "disabled": false
            },
            {
              "field": "ratio_s_formula",
              "title": "Ratio sell formula",
              "formatter": "code",
              "editor": "code",
              "max_len": 12000,
              "default": "return 1;",
              "visible": true,
              "disabled": false
            },
            {
              "field": "fin_res_mult",
              "title": "Fin res multiplier",
              "formatter": "float",
              "editor": "float",
              "min": -1000000000,
              "max": 1000000000,
              "default": 1,
              "visible": true,
              "disabled": false
            },
            {
              "field": "tp",
              "title": "TP",
              "formatter": "float",
              "editor": "float",
              "min": -1000000000,
              "max": 1000000000,
              "default": 1,
              "visible": true,
              "disabled": false
            },
            {
              "field": "client_code",
              "title": "Client code",
              "formatter": "str_select",
              "editor": "str_select",
              "enum_values": [
                {
                  "id": "",
                  "value": ""
                },
                {
                  "id": "virtual",
                  "value": "virtual"
                }
              ],
              "set_on_import": "virtual",
              "partial_enum_values": true,
              "default": "virtual",
              "visible": true,
              "disabled": false
            },
            {
              "field": "comission_sign",
              "title": "Commission type",
              "formatter": "select",
              "editor": "select",
              "enum_values": [
                {
                  "id": 0,
                  "value": "%"
                },
                {
                  "id": 1,
                  "value": "pt"
                }
              ],
              "default": 1,
              "visible": true,
              "disabled": false
            },
            {
              "field": "comission",
              "title": "Commission",
              "formatter": "float",
              "editor": "float",
              "min": -1000000000,
              "max": 1000000000,
              "default": 0,
              "visible": true,
              "disabled": false
            },
            {
              "field": "decimals",
              "title": "Decimals",
              "formatter": "integer",
              "editor": "integer",
              "min": 0,
              "max": 14,
              "default": 4,
              "visible": true,
              "disabled": false
            },
            {
              "field": "move_limits",
              "title": "FUT move limits",
              "unique": true,
              "formatter": "boolean",
              "editor": "boolean",
              "default": false,
              "visible": true,
              "disabled": false
            },
            {
              "field": "move_limits1",
              "title": "SPOT move limits",
              "unique": true,
              "formatter": "boolean",
              "editor": "boolean",
              "default": false,
              "visible": true,
              "disabled": false
            },
            {
              "field": "mm",
              "title": "MM",
              "formatter": "boolean",
              "editor": "boolean",
              "default": false,
              "visible": true,
              "disabled": false
            },
            {
              "field": "ob_c_p_t",
              "title": "Calc price OB",
              "formatter": "select",
              "editor": "select",
              "enum_values": [
                {
                  "id": 0,
                  "value": "Deepest",
                  "tooltip": "Deepest price"
                },
                {
                  "id": 1,
                  "value": "Weighted avg.",
                  "tooltip": "Weighted average price"
                }
              ],
              "default": 1,
              "visible": true,
              "disabled": false
            },
            {
              "field": "ob_t_p_t",
              "title": "Trading price OB",
              "formatter": "select",
              "editor": "select",
              "enum_values": [
                {
                  "id": 0,
                  "value": "Deepest",
                  "tooltip": "Deepest price"
                },
                {
                  "id": 1,
                  "value": "Weighted avg.",
                  "tooltip": "Weighted average price"
                }
              ],
              "default": 0,
              "visible": true,
              "disabled": false
            },
            {
              "field": "depth_ob",
              "title": "Depth OB",
              "formatter": "integer",
              "editor": "integer",
              "min": 1,
              "max": 1000,
              "default": 1,
              "visible": true,
              "disabled": false
            },
            {
              "field": "mc_level_to0",
              "title": "Level to0",
              "formatter": "float",
              "editor": "float",
              "min": 0,
              "max": 1000000000,
              "default": 0,
              "visible": true,
              "disabled": false
            },
            {
              "field": "mc_level_close",
              "title": "Level close",
              "formatter": "float",
              "editor": "float",
              "min": 0,
              "max": 1000000000,
              "default": 0,
              "visible": true,
              "disabled": false
            },
            {
              "field": "leverage",
              "title": "Leverage",
              "formatter": "integer",
              "editor": "integer",
              "min": 1,
              "max": 1000000000,
              "default": 1,
              "visible": true,
              "disabled": false
            },
            {
              "field": "max_trans_musec",
              "title": "Max trans time",
              "formatter": "integer",
              "editor": "integer",
              "min": 1,
              "max": 1000000000,
              "default": 1000000,
              "visible": true,
              "disabled": false
            },
            {
              "field": "ban_period",
              "title": "Ban period",
              "formatter": "integer",
              "editor": "integer",
              "min": 0,
              "max": 1000000000,
              "default": 0,
              "visible": true,
              "disabled": false
            },
            {
              "field": "lot_size",
              "title": "lot_size",
              "formatter": "float",
              "editor": "float",
              "min": 1e-8,
              "max": 1,
              "default": 1,
              "visible": false,
              "disabled": false
            },
            {
              "field": "d_pg",
              "title": "d_pg",
              "formatter": "float",
              "editor": "float",
              "min": 0,
              "max": 40000000000000,
              "default": 0,
              "visible": false,
              "disabled": false
            },
            {
              "field": "put",
              "title": "put",
              "formatter": "integer",
              "editor": "integer",
              "min": -1,
              "max": 1,
              "default": -1,
              "visible": false,
              "disabled": false
            }
          ],
          "timetable": [
            {
              "field": "begin",
              "title": "Begin",
              "formatter": "time",
              "editor": "time",
              "default": 36000,
              "visible": true,
              "disabled": false
            },
            {
              "field": "end",
              "title": "End",
              "formatter": "time",
              "editor": "time",
              "default": 67200,
              "visible": true,
              "disabled": false
            },
            {
              "field": "a_sell",
              "title": "re_sell",
              "formatter": "select",
              "editor": "select",
              "enum_values": [
                {
                  "id": 0,
                  "value": "Not trading",
                  "tooltip": "Not trading"
                },
                {
                  "id": 1,
                  "value": "Trading",
                  "tooltip": "Trading"
                },
                {
                  "id": 2,
                  "value": "Manual",
                  "tooltip": "Manual"
                }
              ],
              "default": 2,
              "visible": true,
              "disabled": false
            },
            {
              "field": "a_buy",
              "title": "re_buy",
              "formatter": "select",
              "editor": "select",
              "enum_values": [
                {
                  "id": 0,
                  "value": "Not trading",
                  "tooltip": "Not trading"
                },
                {
                  "id": 1,
                  "value": "Trading",
                  "tooltip": "Trading"
                },
                {
                  "id": 2,
                  "value": "Manual",
                  "tooltip": "Manual"
                }
              ],
              "default": 2,
              "visible": true,
              "disabled": false
            },
            {
              "field": "auto_to0",
              "title": "To0",
              "formatter": "select",
              "editor": "select",
              "enum_values": [
                {
                  "id": 0,
                  "value": "Inactive",
                  "tooltip": "Inactive"
                },
                {
                  "id": 1,
                  "value": "Active",
                  "tooltip": "Active"
                },
                {
                  "id": 2,
                  "value": "Manual",
                  "tooltip": "Manual"
                }
              ],
              "default": 2,
              "visible": true,
              "disabled": false
            },
            {
              "field": "save_history",
              "title": "Save history",
              "formatter": "boolean",
              "editor": "boolean",
              "default": false,
              "visible": true,
              "disabled": false
            },
            {
              "field": "auto_close",
              "title": "Close",
              "formatter": "boolean",
              "editor": "boolean",
              "default": false,
              "visible": true,
              "disabled": false
            },
            {
              "field": "auto_to_market",
              "title": "To market",
              "formatter": "boolean",
              "editor": "boolean",
              "default": false,
              "visible": true,
              "disabled": false
            }
          ],
          "notifications": [
            {
              "field": "_fin_res_en",
              "title": "FinRes fall",
              "formatter": "check_group",
              "editor": "check_group",
              "default": false,
              "visible": true,
              "disabled": false
            },
            {
              "field": "_fin_res_time",
              "title": "Time (sec)",
              "group": "_fin_res_en",
              "formatter": "integer",
              "editor": "integer",
              "min": 0,
              "max": 86400,
              "default": 60,
              "visible": true,
              "disabled": false
            },
            {
              "field": "_fin_res_abs",
              "title": "Min fall (pt)",
              "group": "_fin_res_en",
              "formatter": "float",
              "editor": "float",
              "min": -2000000000,
              "max": 2000000000,
              "default": 1000,
              "visible": true,
              "disabled": false
            },
            {
              "field": "_fin_res_val",
              "title": "Fall (%)",
              "group": "_fin_res_en",
              "formatter": "float",
              "editor": "float",
              "min": 0,
              "max": 100,
              "default": 10,
              "visible": true,
              "disabled": false
            },
            {
              "field": "_fin_res_stop",
              "title": "Stop trading",
              "group": "_fin_res_en",
              "formatter": "boolean",
              "editor": "boolean",
              "default": false,
              "visible": true,
              "disabled": false
            },
            {
              "field": "_l_s_en",
              "title": "Lim_Sell change",
              "formatter": "check_group",
              "editor": "check_group",
              "default": false,
              "visible": true,
              "disabled": false
            },
            {
              "field": "_l_s_time",
              "title": "Time (sec)",
              "group": "_l_s_en",
              "formatter": "integer",
              "editor": "integer",
              "min": 0,
              "max": 86400,
              "default": 10,
              "visible": true,
              "disabled": false
            },
            {
              "field": "_l_s_val",
              "title": "Value",
              "group": "_l_s_en",
              "formatter": "float",
              "editor": "float",
              "min": 0,
              "max": 1000000000,
              "default": 10,
              "visible": true,
              "disabled": false
            },
            {
              "field": "_l_s_stop",
              "title": "Stop trading",
              "group": "_l_s_en",
              "formatter": "boolean",
              "editor": "boolean",
              "default": false,
              "visible": true,
              "disabled": false
            },
            {
              "field": "_l_b_en",
              "title": "Lim_Buy change",
              "formatter": "check_group",
              "editor": "check_group",
              "default": false,
              "visible": true,
              "disabled": false
            },
            {
              "field": "_l_b_time",
              "title": "Time (sec)",
              "group": "_l_b_en",
              "formatter": "integer",
              "editor": "integer",
              "min": 0,
              "max": 86400,
              "default": 10,
              "visible": true,
              "disabled": false
            },
            {
              "field": "_l_b_val",
              "title": "Value",
              "group": "_l_b_en",
              "formatter": "float",
              "editor": "float",
              "min": 0,
              "max": 1000000000,
              "default": 10,
              "visible": true,
              "disabled": false
            },
            {
              "field": "_l_b_stop",
              "title": "Stop trading",
              "group": "_l_b_en",
              "formatter": "boolean",
              "editor": "boolean",
              "default": false,
              "visible": true,
              "disabled": false
            },
            {
              "field": "_sell_en",
              "title": "Severe sell change",
              "formatter": "check_group",
              "editor": "check_group",
              "default": false,
              "visible": true,
              "disabled": false
            },
            {
              "field": "_sell_time",
              "title": "Time (sec)",
              "group": "_sell_en",
              "formatter": "integer",
              "editor": "integer",
              "min": 0,
              "max": 86400,
              "default": 5,
              "visible": true,
              "disabled": false
            },
            {
              "field": "_sell_v",
              "title": "Value",
              "group": "_sell_en",
              "formatter": "float",
              "editor": "float",
              "min": 0,
              "max": 1000000000,
              "default": 10,
              "visible": true,
              "disabled": false
            },
            {
              "field": "_buy_en",
              "title": "Severe buy change",
              "formatter": "check_group",
              "editor": "check_group",
              "default": false,
              "visible": true,
              "disabled": false
            },
            {
              "field": "_buy_time",
              "title": "Time (sec)",
              "group": "_buy_en",
              "formatter": "integer",
              "editor": "integer",
              "min": 0,
              "max": 86400,
              "default": 5,
              "visible": true,
              "disabled": false
            },
            {
              "field": "_buy_v",
              "title": "Value",
              "group": "_buy_en",
              "formatter": "float",
              "editor": "float",
              "min": 0,
              "max": 1000000000,
              "default": 10,
              "visible": true,
              "disabled": false
            },
            {
              "field": "_max_running_en",
              "title": "Too much running orders",
              "formatter": "check_group",
              "editor": "check_group",
              "default": false,
              "visible": true,
              "disabled": false
            },
            {
              "field": "_max_running_percent",
              "title": "Percent (%)",
              "group": "_max_running_en",
              "formatter": "integer",
              "editor": "integer",
              "min": 0,
              "max": 100,
              "default": 70,
              "visible": true,
              "disabled": false
            },
            {
              "field": "_too_much_n_h_en",
              "title": "Too much not hedged",
              "formatter": "check_group",
              "editor": "check_group",
              "default": false,
              "visible": true,
              "disabled": false
            },
            {
              "field": "_too_much_n_h_portfolios",
              "title": "Limit portfolios",
              "group": "_too_much_n_h_en",
              "formatter": "float",
              "editor": "float",
              "min": -1,
              "max": 1000000000,
              "default": 100,
              "visible": true,
              "disabled": false
            },
            {
              "field": "_pos_en",
              "title": "Severe pos change",
              "formatter": "check_group",
              "editor": "check_group",
              "default": false,
              "visible": true,
              "disabled": false
            },
            {
              "field": "_pos_time",
              "title": "Time (sec)",
              "group": "_pos_en",
              "formatter": "integer",
              "editor": "integer",
              "min": 0,
              "max": 10,
              "default": 5,
              "visible": true,
              "disabled": false
            },
            {
              "field": "_pos_v",
              "title": "Value",
              "group": "_pos_en",
              "formatter": "integer",
              "editor": "integer",
              "min": 0,
              "max": 9007199254740991,
              "default": 1000,
              "visible": true,
              "disabled": false
            }
          ]
        },
        "template_id": "portfolio_viking_base"
      }
	},
	"r":"p",
	"eid":"qwerty",
	"ts":1669798613250710705
}
```
</details>    
<details>
<summary>Response on error</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = get_template_by_id | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = e | y | string | request_result | Request result |
| data | y | object |  |  |
| > msg | y | string |  | Error message |
| > code | y | number | err_code | Error code |

Example:

```json
{
	"type":"get_template_by_id",
	"data":
	{
		"msg":"Permission denied",
		"code":555
	},
	"ts":1657693572940145200,
	"eid":"qwerty",
	"r":"e"
}
```
</details>    

### Запрос шаблона нового портфеля

Получить шаблон для нового портфеля

<details>
<summary>Request</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = get_new_portfolio_template | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| data | y | object |  |  |
| > r_id | n | string |  | Robot ID |
| > p_id | n | string |  | Portfolio name |

Example:

```json
{
	"type": "get_new_portfolio_template",
	"data": {
		"r_id": "1",
		"p_id": "test"
	},
	"eid": "qwerty"
}
```
</details>    
<details>
<summary>Response on success</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = get_new_portfolio_template | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = p | y | string | request_result | Request result |
| data | y | object |  |  |
| > template | y | object |  | Template |

Example:

```json
{
	"type":"get_new_portfolio_template",
	"data":
	{
		"template":
		{
			"template_fields":
			{
				"portfolio":
				[
					{"field":"name","title":"Name","is_key":true,"_comment":"Specify value check","formatter":"string","max_len":30,"default":"","visible":true,"disabled":false}
				],
				"security":
				[
					{"field":"sec_key","title":"SecKey","is_key":true,"formatter":"string","default":"","visible":true,"disabled":false}
				]
			}
		}
	},
	"r":"p",
	"eid":"qwerty",
	"ts":1669798613250710705
}
```
</details>    
<details>
<summary>Response on error</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = get_new_portfolio_template | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = e | y | string | request_result | Request result |
| data | y | object |  |  |
| > msg | y | string |  | Error message |
| > code | y | number | err_code | Error code |

Example:

```json
{
	"type":"get_new_portfolio_template",
	"data":
	{
		"msg":"Permission denied",
		"code":555
	},
	"ts":1657693572940145200,
	"eid":"qwerty",
	"r":"e"
}
```
</details>    

### Запрос доступных sec_type

Получить список доступных sec_type

<details>
<summary>Request</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = get_sec_types | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |

Example:

```json
{
	"type": "get_sec_types",
	"eid": "qwerty"
}
```
</details>    
<details>
<summary>Response on success</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = get_sec_types | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = p | y | string | request_result | Request result |
| data | y | object |  |  |
| > sec_types | y | array |  | List of sec_types |
| >> [] | y | object |  |  |
| >>> id | y | number | sec_type | Unique sec_type id |
| >>> value | y | string |  | String name |

Example:

```json
{
	"type":"get_sec_types",
	"data":
	{
		"sec_types":
		{
			{"id": 0, "value": "ANY"},
			{"id": 1, "value": "MOEX_OPT"},
			{"id": 2, "value": "MOEX_FUT"}
		}
	},
	"r":"p",
	"eid":"qwerty",
	"ts":1669798613250710705
}
```
</details>    
<details>
<summary>Response on error</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = get_sec_types | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = e | y | string | request_result | Request result |
| data | y | object |  |  |
| > msg | y | string |  | Error message |
| > code | y | number | err_code | Error code |

Example:

```json
{
	"type":"get_sec_types",
	"data":
	{
		"msg":"Operation timeout",
		"code":666
	},
	"ts":1657693572940145200,
	"eid":"qwerty",
	"r":"e"
}
```
</details>    


## Нескрываемые сообщения

### Подписка на сообщения

Подписаться на сообщения, при успешной подписке приходит снапшот из 20-ти сообщений

В обновлениях приходят только ключ сообщения и обновленный статус

<details>
<summary>Request</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = messages.subscribe | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |

Example:

```json
{
	"type": "messages.subscribe",
	"data": {},
	"eid": "qwerty"
}
```
</details>    
<details>

<summary>Response on success (snapshot)</summary> 

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = messages.subscribe | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = s | y | string | request_result | Request result |
| data | y | object |  |  |
| > values | y | object |  | Unread messages snapshot |
| >> [] | y | array |  | List of messages |
| >>> st | y | number |  | Message state (0 - unread, 1 - read) |
| >>> dt | y | number | epoch_msec | Message time |
| >>> msg | y | string |  | Message text (also used as unique id) |
| > mt | y | number | epoch_msec | Max time, written in data base (can be null) |
| > count | y | number |  | Number of messages with st=1 in data base|

Example:

```json
{
	"type": "messages.subscribe",
	"data": {
	"values": [
		{
			"st": 0,
			"dt": 1722258395158,
			"msg": "Test msg 1"
		},
		{
			"st": 0,
			"dt": 1722258376516,
			"msg": "Test msg 2"
		}
	],
	"mt": 1721984718924,
	"count": 2
	},
	"ts":1657693572940145200,
  	"eid":"qwerty",
  	"r":"s"
}
```
</details>    
<details>
<summary>Updates</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = messages.subscribe | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = u | y | string | request_result | Request result |
| data | y | object |  |  |
| > count | y | number |  | Number of messages with st=1 in data base|
| > values | y | object |  | Unread messages snapshot |
| >> [] | y | array |  | List of messages |
| >>> msg | y | string |  | Message text (also used as unique id) |
| >>> st | n | number |  | Message state (0 - unread, 1 - read) |
| >>> dt | n | number | epoch_msec | Message time |

Example:

```json
{
  "type": "messages.subscribe",
  "data": {
    "values": [
      {
        "msg": "Test msg 1",
        "st": 1
      }
    ]
  },
  "ts":1657693572940145200,
  "eid":"qwerty",
  "r":"u"
}
```
</details>    
<details>
<summary>Response on error</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = messages.subscribe | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = e | y | string | request_result | Request result |
| data | y | object |  |  |
| > msg | y | string |  | Error message |
| > code | y | number | err_code | Error code |

Example:

```json
{
	"type":"messages.subscribe",
	"data":
	{
		"msg":"Permission denied",
		"code":555
	},
	"ts":1657693572940145200,
	"eid":"qwerty",
	"r":"e"
}
```
</details>  

### Отписка от сообщений

Отписаться от сообщений

<details>
<summary>Request</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = messages.unsubscribe | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| data | y | object |  |  |
| > sub_eid | y | string | string_36 | Subscription eid |

Example:

```json
{
	"type":"messages.unsubscribe",
	"data":
	{
		"sub_eid":"qwerty"
	},
	"eid":"q"
}
```
</details>    
<details>
<summary>Response on success</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = messages.unsubscribe | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = p | y | string | request_result | Request result |

Example:

```json
{
	"type":"messages.unsubscribe",
	"data":{},
	"r":"p",
	"eid":"q",
	"ts":1669810178671387651
}
```
</details>    
<details>
<summary>Response on error</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = messages.unsubscribe | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = e | y | string | request_result | Request result |
| data | y | object |  |  |
| > msg | y | string |  | Error message |
| > code | y | number | err_code | Error code |

Example:

```json
{
	"type":"messages.unsubscribe",
	"data":
	{
		"msg":"Operation timeout",
		"code":666
	},
	"ts":1657693572940145200,
	"eid":"q",
	"r":"e"
}
```
</details>

### Запрос истории сообщений

Получить “небольшую” историю старше заданной даты

<details>
<summary>Request</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = messages.get_previous | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| data | y | object |  |  |
| > read | n | boolean |  | Show already read messages, default value is false |
| > mt | y | number | epoch_msec | Receive messages “older” than this value |
| > lim | n | number |  | Number of messages to receive in range [1, 100], default value is 100 |

Example:

```json
{
	"type": "messages.get_previous",
	"data": {
		"mt": "2000000000000",
		"lim": 100
	},
	"eid": "qwerty"
}
```
</details>    
<details>
<summary>Response on success</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = messages.get_previous | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = p | y | string | request_result | Request result |
| data | y | object |  |  |
| > count | y | number |  | Number of messages with st=1 or st=0 (depending on filter) in data base|
| > values | y | object |  | Unread messages snapshot |
| >> [] | y | array |  | List of messages |
| >>> st | y | number |  | Message state (0 - unread, 1 - read) |
| >>> dt | y | number | epoch_msec | Message time |
| >>> msg | y | string |  | Message text (also used as unique id) |

Example:

```json
{
	"type": "messages.get_previous",
	"data": {
	"values": [
		{
			"st": 0,
			"dt": 1722258395158,
			"msg": "Test msg 1"
		},
		{
			"st": 0,
			"dt": 1722258376516,
			"msg": "Test msg 2"
		}
	]
	},
	"ts":1657693572940145200,
	"eid":"qwerty",
	"r":"p"
}
```
</details>    
<details>
<summary>Response on error</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = messages.get_previous | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = e | y | string | request_result | Request result |
| data | y | object |  |  |
| > msg | y | string |  | Error message |
| > code | y | number | err_code | Error code |

Example:

```json
{
	"type":"messages.get_previous",
	"data":
	{
		"msg":"Permission denied",
		"code":555
	},
	"ts":1657693572940145200,
	"eid":"qwerty",
	"r":"e"
}
```
</details>

### Запрос истории сообщений 2

Получить историю от даты до даты

<details>
<summary>Request</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = messages.get_history | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| data | y | object |  |  |
| > read | n | boolean |  | Show already read messages, default value is false |
| > mint | y | number | epoch_msec | Receive messages “newer” or equal than this value |
| > maxt | y | number | epoch_msec | Receive messages “older” or equal than this value |
| > lim | n | number |  | Number of messages to receive in range [1, 100], default value is 100 |

Example:

```json
{
	"type": "messages.get_history",
	"data": {
		"mt": "2000000000000",
		"lim": 100
	},
	"eid": "qwerty"
}
```
</details>    
<details>
<summary>Response on success</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = messages.get_history | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = p | y | string | request_result | Request result |
| data | y | object |  |  |
| > count | y | number |  | Number of messages with st=1 or st=0 (depending on filter) in data base|
| > values | y | object |  | Unread messages snapshot |
| >> [] | y | array |  | List of messages |
| >>> st | y | number |  | Message state (0 - unread, 1 - read) |
| >>> dt | y | number | epoch_msec | Message time |
| >>> msg | y | string |  | Message text (also used as unique id) |

Example:

```json
{
	"type": "messages.get_history",
	"data": {
	"values": [
		{
			"st": 0,
			"dt": 1722258395158,
			"msg": "Test msg 1"
		},
		{
			"st": 0,
			"dt": 1722258376516,
			"msg": "Test msg 2"
		}
	]
	},
	"ts":1657693572940145200,
	"eid":"qwerty",
	"r":"p"
}
```
</details>    
<details>
<summary>Response on error</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = messages.get_history | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = e | y | string | request_result | Request result |
| data | y | object |  |  |
| > msg | y | string |  | Error message |
| > code | y | number | err_code | Error code |

Example:

```json
{
	"type":"messages.get_history",
	"data":
	{
		"msg":"Permission denied",
		"code":555
	},
	"ts":1657693572940145200,
	"eid":"qwerty",
	"r":"e"
}
```
</details>

### Отметить сообщение как прочитанное

<details>
<summary>Request</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = messages.mark_as_read | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| data | y | object |  |  |
| > msg | y | string |  | Message text (also used as unique id) |

Example:

```json
{
	"type": "messages.mark_as_read",
	"data": {
		"msg": "Test msg 1"
	},
	"eid": "qwerty"
}
```
</details>    
<details>
<summary>Response on success</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = messages.mark_as_read | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = p | y | string | request_result | Request result |
| data | y | object |  |  |
| > msg | y | string |  | Message text (also used as unique id) |

Example:

```json
{
	"type": "messages.mark_as_read",
	"data": {
		"msg": "Test msg 1"
	},
	"ts":1657693572940145200,
	"eid":"qwerty",
	"r":"p"
}
```
</details>    
<details>
<summary>Response on error</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = messages.mark_as_read | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = e | y | string | request_result | Request result |
| data | y | object |  |  |
| > msg | y | string |  | Error message |
| > code | y | number | err_code | Error code |

Example:

```json
{
	"type":"messages.mark_as_read",
	"data":
	{
		"msg":"Permission denied",
		"code":555
	},
	"ts":1657693572940145200,
	"eid":"qwerty",
	"r":"e"
}
```
</details>

## Компании и пользователи

### Получить/подписка список пользователей в компаниях

Ключ — c_id + u_id

Подписка доступна только админу

По подписке всегда ходит снапшот

Подписка subscribe вместо get

<details>
<summary>Request</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = users_in_companies.get | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| data | y | object |  |  |

Example:

```json
{
	"type": "users_in_companies.get",
	"data":	{},
	"eid": "qwerty"
}
```
</details>    
<details>
<summary>Response on success</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = users_in_companies.get | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = p | y | string | request_result | Request result |
| data | y | object |  |  |
| > usrs | y | array |  |  |
| >> [] | y | array |  | Array of users in companies |
| >>> c_id | y | string |  | Company id |
| >>> comp | y | string |  | Company name |
| >>> u_id | y | string |  | User ID (email) |
| >>> roles | y | array |  | Array of roles as strings |
| >>> rbts | y | array |  | Array of robot ids as strings |
| >>> portfs | y | array |  | Array users’s portfolios |
| >>>> [] | y | [string, string] | portfolio_id | Portfolio ID (robot ID and portfolio name) |

Example:

```json
{
  "type": "users_in_companies.get",
  "data": {
    "usrs": [
      {
        "roles": ["admin"],
        "rbts": [],
        "portfs": [],
        "c_id": "1002",
        "comp": "_1000",
        "u_id": "test@gmail.com"
      },
      {
        "roles": ["admin", "head_of_traders", "trader"],
        "rbts": [],
        "portfs": [],
        "c_id": "1",
        "comp": "viking",
        "u_id": "test@gmail.com"
      },
      {
        "roles": ["admin"],
        "rbts": [],
        "portfs": [],
        "c_id": "1003",
        "comp": "_1000",
        "u_id": "test@gmail.com"
      },
      {
        "roles": ["admin"],
        "rbts": [],
        "portfs": [],
        "c_id": "1005",
        "comp": "test2",
        "u_id": "test@gmail.com"
      },
      {
        "roles": ["admin"],
        "rbts": [],
        "portfs": [],
        "c_id": "1001",
        "comp": "test",
        "u_id": "test@gmail.com"
      },
      {
        "roles": ["admin", "demo"],
        "rbts": ["1"],
        "portfs": [["1", "qwe"]],
        "c_id": "0",
        "comp": "public",
        "u_id": "test@gmail.com"
      }
    ]
  },
  "r": "s",
  "eid": "q0",
  "ts": 1693481809219464007
}
```
</details>    
<details>
<summary>Response on error</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = users_in_companies.get | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = e | y | string | request_result | Request result |
| data | y | object |  |  |
| > msg | y | string |  | Error message |
| > code | y | number | err_code | Error code |

Example:

```json
{
	"type":"users_in_companies.get",
	"data":
	{
		"msg":"Permission denied",
		"code":555
	},
	"ts":1657693572940145200,
	"eid":"qwerty",
	"r":"e"
}
```
</details>    

### Добавить/изменить/удалить пользователя в компании

Одна команда для добавления/изменения/удаления

Для удаления нужно оставить список ролей пустым

Для данного пользователя будут закрыты все его вебсокет сессии!

<details>
<summary>Request</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = users_in_companies.update | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| data | y | object |  |  |
| > c_id | y | string |  | Company id |
| > u_id | y | string |  | User ID (email) |
| > add | n | boolean |  | Use this flag on adding new user to company, default value is false. If flag is set, you will receive an error message if user is already in company |
| > roles | y | array |  | Array of roles as strings |
| > rbts | y | array |  | Array of robot ids as strings |
| > portfs | y | array |  | Array users’s portfolios |
| >> [] | y | [string, string] | portfolio_id | Portfolio ID (robot ID and portfolio name) |

Example:

```json
{
	"type": "users_in_companies.update",
	"data":
	{
		"u_id": "test@gmail.com",
		"c_id": "0",
		"roles": ["admin", "trader"],
		"rbts": ["1"],
		"portfs":[["1", "test1"]]
	},
	"eid": "qwerty"
}
```
</details>    
<details>
<summary>Response on success</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = users_in_companies.update | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = p | y | string | request_result | Request result |
| data | y | object |  |  |
| > usrs | y | array |  |  |
| >> [] | y | array |  | Array of users in companies |
| >>> c_id | y | string |  | Company id |
| >>> comp | y | string |  | Company name |
| >>> u_id | y | string |  | User ID (email) |
| >>> roles | y | array |  | Array of roles as strings |
| >>> rbts | y | array |  | Array of robot ids as strings |
| >>> portfs | y | array |  | Array users’s portfolios |
| >>>> [] | y | [string, string] | portfolio_id | Portfolio ID (robot ID and portfolio name) |

Example:

```json
{
  "type": "users_in_companies.get",
  "data": {
    "usrs": [
      {
        "roles": ["admin"],
        "rbts": [],
        "portfs": [],
        "c_id": "1002",
        "comp": "_1000",
        "u_id": "test@gmail.com"
      },
      {
        "roles": ["admin", "head_of_traders", "trader"],
        "rbts": [],
        "portfs": [],
        "c_id": "1",
        "comp": "viking",
        "u_id": "test@gmail.com"
      },
      {
        "roles": ["admin"],
        "rbts": [],
        "portfs": [],
        "c_id": "1003",
        "comp": "_1000",
        "u_id": "test@gmail.com"
      },
      {
        "roles": ["admin"],
        "rbts": [],
        "portfs": [],
        "c_id": "1005",
        "comp": "test2",
        "u_id": "test@gmail.com"
      },
      {
        "roles": ["admin"],
        "rbts": [],
        "portfs": [],
        "c_id": "1001",
        "comp": "test",
        "u_id": "test@gmail.com"
      },
      {
        "roles": ["admin", "demo"],
        "rbts": ["1"],
        "portfs": [["1", "qwe"]],
        "c_id": "0",
        "comp": "public",
        "u_id": "test@gmail.com"
      }
    ]
  },
  "r": "s",
  "eid": "q0",
  "ts": 1693481809219464007
}
```
</details>    
<details>
<summary>Response on error</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = users_in_companies.update | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = e | y | string | request_result | Request result |
| data | y | object |  |  |
| > msg | y | string |  | Error message |
| > code | y | number | err_code | Error code |

Example:

```json
{
	"type":"users_in_companies.update",
	"data":
	{
		"msg":"Permission denied",
		"code":555
	},
	"ts":1657693572940145200,
	"eid":"qwerty",
	"r":"e"
}
```
</details>    

### Получить компании доступные пользователю

<details>
<summary>Request</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = users_in_companies.get_companies | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| data | y | object |  |  |

Example:

```json
{
	"type": "users_in_companies.get_companies",
	"data": {},
	"eid": "qwerty"
}
```
</details>    
<details>
<summary>Response on success</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = users_in_companies.get_companies | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = p | y | string | request_result | Request result |
| data | y | object |  |  |
| > comps | array |  |  |  |
| >> [] | array |  |  | Companies |
| >>> c_id | y | string |  | Company ID |
| >>> name | y | string |  | Company name |

Example:

```json
{
  "type": "users_in_companies.get_companies",
  "data": {
    "comps": [
      { "c_id": "1002", "name": "_1000" },
      { "c_id": "1", "name": "viking" },
      { "c_id": "1003", "name": "_1000" },
      { "c_id": "1005", "name": "test2" },
      { "c_id": "1001", "name": "test" },
      { "c_id": "0", "name": "public" }
    ]
  },
  "r": "p",
  "eid": "q0",
  "ts": 1693481809217639511
}
```
</details>    
<details>
<summary>Response on error</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = users_in_companies.get_companies | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = e | y | string | request_result | Request result |
| data | y | object |  |  |
| > msg | y | string |  | Error message |
| > code | y | number | err_code | Error code |

Example:

```json
{
	"type":"users_in_companies.get_companies",
	"data":
	{
		"msg":"Internal error",
		"code":18
	},
	"ts":1657693572940145200,
	"eid":"qwerty",
	"r":"e"
}
```
</details>    

### Получить роботов компании

<details>
<summary>Request</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = users_in_companies.get_robots | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| data | y | object |  |  |
| > c_id | y | string |  | Company ID |

Example:

```json
{
	"type": "users_in_companies.get_robots",
	"data": {"c_id":"1"},
	"eid": "qwerty"
}
```
</details>    
<details>
<summary>Response on success</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = users_in_companies.get_robots | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = p | y | string | request_result | Request result |
| data | y | object |  |  |
| > rbts | array |  |  | Array of robots as strings |

Example:

```json
{
  "type": "users_in_companies.get_robots",
  "data": { "rbts": ["1", "2", "3"] },
  "r": "p",
  "eid": "q0",
  "ts": 1693481809218424440
}
```
</details>    
<details>
<summary>Response on error</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = users_in_companies.get_robots | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = e | y | string | request_result | Request result |
| data | y | object |  |  |
| > msg | y | string |  | Error message |
| > code | y | number | err_code | Error code |

Example:

```json
{
	"type":"users_in_companies.get_robots",
	"data":
	{
		"msg":"Internal error",
		"code":18
	},
	"ts":1657693572940145200,
	"eid":"qwerty",
	"r":"e"
}
```
</details>    

### Получить портфели компании

<details>
<summary>Request</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = users_in_companies.get_portfolios | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| data | y | object |  |  |
| > c_id | y | string |  | Company ID |

Example:

```json
{
	"type": "users_in_companies.get_portfolios",
	"data": {"c_id":"1"},
	"eid": "qwerty"
}
```
</details>    
<details>
<summary>Response on success</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = users_in_companies.get_portfolios | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = p | y | string | request_result | Request result |
| data | y | object |  |  |
| > portfs | y | array |  | Array of users’s portfolios |
| >> [] | y | [string, string] | portfolio_id | Portfolio ID (robot ID and portfolio name) |

Example:

```json
{
  "type": "users_in_companies.get_portfolios",
  "data": {
    "portfs": [
      ["1", "replace"],
      ["1", "test96"],
      ["1", "test97"],
      ["1", "test98"],
      ["1", "test99"],
      ["3", "test"]
    ]
  },
  "r": "p",
  "eid": "q0",
  "ts": 1693481809218962771
}
```
</details>    
<details>
<summary>Response on error</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = users_in_companies.get_portfolios | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = e | y | string | request_result | Request result |
| data | y | object |  |  |
| > msg | y | string |  | Error message |
| > code | y | number | err_code | Error code |

Example:

```json
{
	"type":"users_in_companies.get_porfolios",
	"data":
	{
		"msg":"Internal error",
		"code":18
	},
	"ts":1657693572940145200,
	"eid":"qwerty",
	"r":"e"
}
```
</details>    

### Получить портфели пользователя в компании

<details>
<summary>Request</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = users_in_companies.get_user_portfolios | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| data | y | object |  |  |
| > c_id | y | string |  | Company ID |

Example:

```json
{
	"type": "users_in_companies.get_user_portfolios",
	"data": {"c_id":"1", "u_id":"test@gmail.com"},
	"eid": "qwerty"
}
```
</details>    
<details>
<summary>Response on success</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = users_in_companies.get_user_portfolios | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = p | y | string | request_result | Request result |
| data | y | object |  |  |
| > portfs | y | array |  | Array of users’s portfolios |
| >> [] | y | [string, string] | portfolio_id | Portfolio ID (robot ID and portfolio name) |

Example:

```json
{
  "type": "users_in_companies.get_user_portfolios",
  "data": {
    "portfs": [
      ["1", "replace"],
      ["1", "test96"],
      ["1", "test97"],
      ["1", "test98"],
      ["1", "test99"],
      ["3", "test"]
    ]
  },
  "r": "p",
  "eid": "q0",
  "ts": 1693481809218962771
}
```
</details>    
<details>
<summary>Response on error</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = users_in_companies.get_user_portfolios | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = e | y | string | request_result | Request result |
| data | y | object |  |  |
| > msg | y | string |  | Error message |
| > code | y | number | err_code | Error code |

Example:

```json
{
	"type":"users_in_companies.get_user_porfolios",
	"data":
	{
		"msg":"Internal error",
		"code":18
	},
	"ts":1657693572940145200,
	"eid":"qwerty",
	"r":"e"
}
```
</details>

### Получить емейлы пользователей компании

<details>
<summary>Request</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = users_in_companies.get_users | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| data | y | object |  |  |
| > c_id | y | string |  | Company ID |

Example:

```json
{
	"type": "users_in_companies.get_users",
	"data": {"c_id":"1"},
	"eid": "qwerty"
}
```
</details>    
<details>
<summary>Response on success</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = users_in_companies.get_robots | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = p | y | string | request_result | Request result |
| data | y | object |  |  |
| > usrs | array |  |  | Array of emails as strings |

Example:

```json
{
  "type": "users_in_companies.get_userss",
  "data": { "usrs": ["test@gmail.com", "xxx@mail.ru"] },
  "r": "p",
  "eid": "q0",
  "ts": 1693481809218424440
}
```
</details>    
<details>
<summary>Response on error</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = users_in_companies.get_users | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = e | y | string | request_result | Request result |
| data | y | object |  |  |
| > msg | y | string |  | Error message |
| > code | y | number | err_code | Error code |

Example:

```json
{
	"type":"users_in_companies.get_users",
	"data":
	{
		"msg":"Internal error",
		"code":18
	},
	"ts":1657693572940145200,
	"eid":"qwerty",
	"r":"e"
}
```
</details>

### Подписка на параметры пользователя

В любой момент может быть выслан снапшот

В обновлениях приходят только измененные данные по пользователю, ключ — u_id

<details>
<summary>Request</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = user.subscribe | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| data | y | object |  |  |
| > u_id | y | string |  | User ID (email) |

Example:

```json
{
	"type": "user.subscribe",
	"data":	{"u_id":"test@mail.ru"},
	"eid": "qwerty"
}
```
</details>    
<details>

<summary>Response on success (snapshot)</summary> 

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = user.subscribe | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = s | y | string | request_result | Request result |
| data | y | object |  |  |
| > u_id | y | string |  | User ID (email) |
| > api_key | y | string |  | API key |
| > enable_api | y | boolean |  | Enable API flag |
| > enable_2fa | y | boolean |  | Enable 2FA flag |
| > tgr | y | number |  | Telegram ID |
| > hide_not_my_notifs | y | boolean |  | Hide notifications "generated" by another user |

Example:

```json
{
  "type": "user.subscribe",
  "data": { "tgr": 214020169, "enable_api": true, "api_key": "******", "enable_2fa": false },
  "r": "s",
  "eid": "q0",
  "ts": 1694072105955648388
}
```
</details>    
<details>
<summary>Updates</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = user.subscribe | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = u | y | string | request_result | Request result |
| data | y | object |  |  |
| > u_id | y | string |  | User ID (email) |
| > api_key | n | string |  | API key |
| > enable_api | n | boolean |  | Enable API flag |
| > enable_2fa | n | boolean |  | Enable 2FA flag |
| > tgr | n | number |  | Telegram ID |
| > hide_not_my_notifs | n | boolean |  | Hide notifications "generated" by another user |

Example:

```json
{
  "type": "user.subscribe",
  "data": { "enable_api": false, "api_key": "", "u_id": "test@gmail.com" },
  "r": "u",
  "eid": "q0",
  "ts": 1694072105972483566
}
```
</details>    
<details>
<summary>Response on error</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = user.subscribe | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = e | y | string | request_result | Request result |
| data | y | object |  |  |
| > msg | y | string |  | Error message |
| > code | y | number | err_code | Error code |

Example:

```json
{
	"type":"user.subscribe",
	"data":
	{
		"msg":"Permission denied",
		"code":555
	},
	"ts":1657693572940145200,
	"eid":"qwerty",
	"r":"e"
}
```
</details>    

### Отписка от параметров пользователя

<details>
<summary>Request</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = user.unsubscribe | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| data | y | object |  |  |
| > sub_eid | y | string | string_36 | Subscription eid |

Example:

```json
{
	"type":"user.unsubscribe",
	"data":
	{
		"sub_eid":"qwerty"
	},
	"eid":"q"
}
```
</details>    
<details>
<summary>Response on success</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = user.unsubscribe | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = p | y | string | request_result | Request result |

Example:

```json
{
	"type":"user.unsubscribe",
	"data":{},
	"r":"p",
	"eid":"q",
	"ts":1669810178671387651
}
```
</details>    
<details>
<summary>Response on error</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = user.unsubscribe | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = e | y | string | request_result | Request result |
| data | y | object |  |  |
| > msg | y | string |  | Error message |
| > code | y | number | err_code | Error code |

Example:

```json
{
	"type":"user.unsubscribe",
	"data":
	{
		"msg":"Operation timeout",
		"code":666
	},
	"ts":1657693572940145200,
	"eid":"q",
	"r":"e"
}
```
</details>    

### Изменить параметры пользователя

<details>
<summary>Request</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = user.update | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| data | y | object |  |  |
| > u_id | y | string |  | User ID (email) |
| > api_key | n | string |  | API key |
| > enable_api | n | boolean |  | Enable API flag |
| > tgr | n | number |  | Telegram ID |
| > hide_not_my_notifs | n | boolean |  | Hide notifications "generated" by another user |
| > 2fa | n | string_6 |  | 2FA token for API key operations confirmation |

Example:

```json
{
	"type": "user.update",
	"data":	{"u_id":"test@mail.ru", "tgr":1},
	"eid": "qwerty"
}
```
</details>    
<details>
<summary>Response on success</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = user.update | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = p | y | string | request_result | Request result |
| data | y | object |  |  |
| > u_id | y | string |  | User ID (email) |
| > api_key | n | string |  | API key |
| > enable_api | n | boolean |  | Enable API flag |
| > tgr | n | number |  | Telegram ID |
| > hide_not_my_notifs | n | boolean |  | Hide notifications "generated" by another user |

Example:

```json
{
    "type": "user.update",
    "data": {
        "enable_api": true,
        "api_key": "QnRxE9QHyd1Hymd1i5nemcD45m2mWf8zUCpdl24HKLFuKSW6rQvOAukWTKqS2ELDzmWegBniEUVUoJJD",
        "u_id": "test@gmail.com"
    },
    "r": "p",
    "eid": "q0",
    "ts": 1694072105972483566
}
```
</details>    
<details>
<summary>Response on error</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = user.update | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = e | y | string | request_result | Request result |
| data | y | object |  |  |
| > msg | y | string |  | Error message |
| > code | y | number | err_code | Error code |

Example:

```json
{
	"type":"user.update",
	"data":
	{
		"msg":"Permission denied",
		"code":555
	},
	"ts":1657693572940145200,
	"eid":"qwerty",
	"r":"e"
}
```
</details>

### Получить отключенные настройки telegram уведомлений пользователя

<details>
<summary>Request</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = user.get_tgr_notifications | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |

Example:

```json
{
	"type": "user.get_tgr_notifications",
	"eid": "qwerty"
}
```
</details>    
<details>
<summary>Response on success</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = user.get_tgr_notifications | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = p | y | string | request_result | Request result |
| data | y | object |  |  |
| > values | y | object |  |  |
| >> ROBOT_ID:VALUE | y | string:number | string:tgr_notification | Robot ID and bitmask of turned off telegram noitification levels |

Example:

```json
{
    "type": "user.get_tgr_notifications",
    "data": {
        "values": {
            "1": 7,
            "2": 1
        }
    },
    "r": "p",
    "eid": "q0",
    "ts": 1694072105972483566
}
```
</details>    
<details>
<summary>Response on error</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = user.get_tgr_notifications | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = e | y | string | request_result | Request result |
| data | y | object |  |  |
| > msg | y | string |  | Error message |
| > code | y | number | err_code | Error code |

Example:

```json
{
	"type":"user.get_tgr_notifications",
	"data":
	{
		"msg":"Permission denied",
		"code":555
	},
	"ts":1657693572940145200,
	"eid":"qwerty",
	"r":"e"
}
```
</details>

### Отключить настройки telegram уведомлений пользователя

<details>
<summary>Request</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = user.set_tgr_notifications | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| data | y | object |  |  |
| > values | y | object |  |  |
| >> ROBOT_ID:VALUE | y | string:number | string:tgr_notification | Robot ID and bitmask of turned off telegram noitification levels |


Example:

```json
{
    "type": "user.set_tgr_notifications",
    "eid": "qwerty"
    "data": {
        "values": {
            "1": 7,
            "2": 1
        }
    },
}
```
</details>    
<details>
<summary>Response on success</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = user.set_tgr_notifications | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = p | y | string | request_result | Request result |

Example:

```json
{
    "type": "user.set_tgr_notifications",
    "r": "p",
    "eid": "q0",
    "ts": 1694072105972483566
}
```
</details>    
<details>
<summary>Response on error</summary>

Payload:

| Key[=value] | Required | JSON type | Internal type | Description |
| --- | --- | --- | --- | --- |
| type = user.set_tgr_notifications | y | string |  | Operation type |
| eid | y | string | string_36 | External user id that will be received in response |
| ts | y | number | epoch_nsec | Response time in nano seconds |
| r = e | y | string | request_result | Request result |
| data | y | object |  |  |
| > msg | y | string |  | Error message |
| > code | y | number | err_code | Error code |

Example:

```json
{
	"type":"user.set_tgr_notifications",
	"data":
	{
		"msg":"Permission denied",
		"code":555
	},
	"ts":1657693572940145200,
	"eid":"qwerty",
	"r":"e"
}
```
</details> 

## Типы данных

| Name | JSON type | Description |
| --- | --- | --- |
| string_6 | string | String with maximum length of 6 symbols |
| string_36 | string | String with maximum length of 36 symbols |
| user_role | string | Enum: “demo” — demo user, “trader” — regular trader, “head_of_traders” — head of traders, “admin_view_only” — admin without write permissions, “admin” — administrator  |
| epoch_nsec | string | Epoch time in nanoseconds integer representation. Example: 1584629107000000000 |
| epoch_msec | number | Epoch time in milliseconds integer representation. Example: 1584629107000 |
| epoch_sec | number | Epoch time in seconds integer representation. Example: 1584629107 |
| request_result | string | Enum: “p” — performed, “e” — error, “s” — snapshot, “u” — update |
| language | string | Enum: “en” — English, “ru” — Russian |
| portfolio_id | [string, string] | Pair of strings, first element is a robot ID, second element is a portfolio name |
| sec_type | number | Integer value, security exchange/connection type. Value should be received in template |
| stream_status | number | Integer value, enum: 0 — disconnected, 1 — connecting, 2 — connected, 3 — unknown, 4 — closed by time |
| trading_status | number | Integer value, enum: 0 — not trading, 2 —trading, 3 — unknown |
| process_status | number | Integer value, enum: 0 — not running, 2 —running, 3 — unknown |
| direction | number | Integer value, enum: 1 — buy, 2 — sell |
| symbol_find_state | number | Integer value, enum: 0 — unknown, 1 — searching, 2 — found, 3 — expired, 4 — error |
| tgr_notification | number | 1 — TGR_ORDER (ошибки выставления заявки с выключением торговли),<br> 2 — TGR_ERROR (это ошибки из логирования в формулах), <br> 4 — TGR_NOTIFICATION (уведомления из алгоритма) |
| log_level | number | 0 — LEVEL_DEBUG, зеленый (обычно, запись пользовательских редактирований робота) <br> 1 — LEVEL_INFO, синий <br> 2 — LEVEL_WARNING, желтый <br> 3 — LEVEL_ERROR, красный (это ошибка выставления/снятия заявки, всегда пишется из алгоритма) <br> 4 — LEVEL_CRITICAL, красный (в робота пришли "кривые" JSON данные или операция недоступна или закончился ключ) <br> 5 — LEVEL_ORDER, красный (это ошибка выставления заявки с выключением торговли, ходит в телеграм) <br> 7 — LEVEL_NOTIFICATION, салатовый (уведомления из алгоритма, ходит в телеграм) <br> 10 — LEVEL_SHOW_OK, зеленый (всегда всплывает сообщение) <br> 11 — LEVEL_SHOW_ERR, красный (всегда всплывает сообщение) <br> 12 — LEVEL_SHOW_WARN, желтый (всегда всплывает сообщение) |
| err_code | number | Integer value, enum: <br> 1 — Already authorized, <br> 2 — Authorization error or email not verified, <br> 3 — Not authorized, <br> 4 — Wrong message parameters, <br> 5 — There is no "{role}" in user roles, <br> 6 — Unexpected message type or bad message format, <br> 7 — Duplicate subscription eid, <br> 8 — User not found, <br> 9 — Robot "{r_id}" was not found, <br> 10 — Portfolio "{p_id}" was not found in robot "{r_id}", <br> 11 — Can not connect to robot "{r_id}", <br> 12 — Can not add portfolio, "{p_id}" already exists in robot "{r_id}", <br> 13 — Can not perform operation on disabled portfolio "{p_id}”, <br> 14 — Quantity should be positive, <br> 15 — Wrong command, <br> 16 — Not provided, <br> 17 — Service is overloaded, <br> 18 — Internal error, <br> 19 — Can not restart robot while it is disconnected or if it is trading <br> 20 — Robot "{r_id}" is not exist, <br> 21 — Wrong connection parameters, <br> 22 — Robot "{r_id}" already exists, <br> 23 — Robot "{r_id}" is locked, try again later, <br> 24 — Company "{c_id}" was not found, <br> 26 — Can not perform operation on connected robot "{r_id}”, <br> 27 — 2FA is already enabled, <br> 28 — 2FA is already disabled, <br> 29 — Too many 2FA attempts, try again in {timeout} seconds, <br> 30 — Wrong 2FA key, <br> 31 — Too many active 2FA fingerprints. Please use one of your active sessions to manage and remove old sessions. You can find these settings in Settings->Security, <br> 32 — 2FA secret was not generated or already expired, <br> 33 — API key sessions limit exceeded, <br> 555 — Permission denied, <br> 666 — Operation timeout, <br> 777 — Other error from robot |

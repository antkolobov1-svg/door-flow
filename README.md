# door-flow

Панель «Путь двери» для Claude Code: по строке на каждую модель, прогнанную через дверь (Lean-проект на MSI), с восемью шагами от «Условия» до «Приём». Зелёная связь — шаг опирается на предыдущий, красный пунктир — не связано. Данные читаются из /home/anton/door-flow/out/summary.json: напрямую, если сессия идёт на MSI, иначе через подключение MSI. Открыть: /door.

Установка в Claude Code:

```
/plugin install door-flow --marketplace antkolobov1-svg/door-flow
```

# Requirements – Reactive Chat

Functional requirements for the chat. The IDs are used to check each
experiment run (e.g. "FR-13 fails").

Visual design: see the screens in `docs/design/`
(`join.png`, `typing.png`, `unread.png`).

## Base app

| ID    | Requirement |
| ----- | ----------- |
| FR-01 | The user types a name (1–20 characters after trimming) and clicks "Entrar". The button is disabled while the name is empty. |
| FR-02 | The user sends a message with Enter or the "Enviar" button. Empty or whitespace-only messages are not sent. The input clears after sending. |
| FR-03 | Every connected user receives each message, in arrival order, with the sender's name and time (HH:mm). |
| FR-04 | Own messages appear on the right in an accent-colored bubble; others' appear on the left with the sender's name above. |
| FR-05 | The message list scrolls. A new message scrolls it to the bottom only if the user was already at the bottom (within 40 px). |
| FR-06 | Sending your own message always scrolls to the bottom. |
| FR-07 | Users only see messages sent after they joined (no history). |
| FR-08 | Invalid data on the socket is ignored; the server never crashes because of it. |

## Feature: typing indicator and unread counter

| ID    | Requirement |
| ----- | ----------- |
| FR-10 | Typing in the message box sends a typing event, at most once per 500 ms per user. |
| FR-11 | Other users see the indicator between the message list and the input: "Ana está digitando…", "Ana e Bruno estão digitando…", "Ana, Bruno e Carla estão digitando…". |
| FR-12 | A name disappears 2 s after that user's last keystroke, or immediately when they send a message. |
| FR-13 | A user never sees their own name in the indicator. |
| FR-14 | The indicator area keeps its height when empty, so the layout doesn't jump. |
| FR-15 | While the user is scrolled up (more than 40 px from the bottom), each new message from someone else adds 1 to an unread counter. |
| FR-16 | A pill at the bottom center of the list shows "1 nova mensagem" or "N novas mensagens". It is hidden at 0. |
| FR-17 | Clicking the pill scrolls smoothly to the bottom and resets the counter to 0. |
| FR-18 | Reaching the bottom by scrolling resets the counter to 0. |
| FR-19 | The user's own messages never increase the counter. |

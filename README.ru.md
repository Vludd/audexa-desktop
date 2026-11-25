[English](README.md) | [Русский](README.ru.md)

# Audexa

**Настольная платформа Windows для автоматизации аудио и распределённого воспроизведения**

Audexa предназначена для музеев, выставок, визит-центров, интерактивных инсталляций и других общественных пространств. Приложение объединяет аудиотеку, комнаты воспроизведения, сценарии, расписание и удалённые узлы воспроизведения.

[Скачать последнюю версию](https://github.com/Vludd/audexa-desktop/releases/latest) · [Все релизы](https://github.com/Vludd/audexa-desktop/releases)

## Возможности

- **Аудиотека** — загрузка, просмотр, потоковое воспроизведение, переименование и удаление аудиофайлов.
- **Комнаты** — настройка точек воспроизведения и назначение аудиовыходов.
- **Сценарии** — создание повторно используемых последовательностей воспроизведения.
- **Расписание** — настройка автоматического запуска сценариев.
- **Управление воспроизведением** — управление воспроизведением и мониторинг активных сеансов.
- **Media Hosts** — регистрация и управление удалёнными компьютерами воспроизведения.
- **Media Agent** — воспроизведение на удалённых Windows-узлах и передача информации о дисплеях и состоянии воспроизведения.
- **Видеотека** — хранение, настройка усиления звуковой дорожки и передача видеофайлов Media Agent.
- **Звук видео в комнатах** — декодирование встроенной аудиодорожки FFmpeg и маршрутизация через настроенные аудиовыходы с синхронными Pause / Resume / Stop.
- **Настройки и диагностика** — настройка аудиоустройств, диагностика и просмотр журналов.
- **Обновления** — проверка и установка опубликованных версий Audexa.

## Скриншоты

<p align="center">
  <img src="https://github.com/user-attachments/assets/52c5dd8a-10b1-4498-ad73-faeeb2910eff" alt="Главная страница Audexa" width="100%" />
</p>

<table>
  <tr>
    <td width="50%"><img src="https://github.com/user-attachments/assets/3533995e-054d-4679-a8b1-ad3b192eabae" alt="Комнаты" width="100%" /></td>
    <td width="50%"><img src="https://github.com/user-attachments/assets/dac02966-d285-4457-a833-32df37f8c56b" alt="Сценарии" width="100%" /></td>
  </tr>
</table>

<details>
  <summary>Другие скриншоты</summary>
  <br />
  <table>
    <tr>
      <td width="50%"><img src="https://github.com/user-attachments/assets/638e22c9-bdf2-410a-8ac4-9bc8fd10af11" alt="Расписание" width="100%" /></td>
      <td width="50%"><img src="https://github.com/user-attachments/assets/c1797f4b-b5c3-4814-813e-4f4c8b083377" alt="Аудиотека" width="100%" /></td>
    </tr>
    <tr>
      <td width="50%"><img src="https://github.com/user-attachments/assets/9e196fca-340d-4e42-9c67-b7ee2d2da07a" alt="Настройки" width="100%" /></td>
      <td width="50%"><img src="https://github.com/user-attachments/assets/439b3b7c-b0fe-42d5-b485-fdb2e5de184c" alt="Журнал событий" width="100%" /></td>
    </tr>
    <tr>
      <td colspan="2"><img src="https://github.com/user-attachments/assets/c6c7f979-501a-4984-95c8-65ddfd431ce7" alt="Дополнительный экран приложения" width="100%" /></td>
    </tr>
  </table>
</details>

## Архитектура

Audexa состоит из четырёх взаимодействующих компонентов:

- **Desktop Shell** — настольное приложение на C#, отображающее фронтенд через WebView2 и запускающее локальный Backend.
- **Frontend** — пользовательский интерфейс на React и TypeScript.
- **Backend** — процесс ASP.NET Core, предоставляющий REST API, SignalR Hub, хранение данных, планировщик и координацию воспроизведения.
- **Media Agent** — отдельный процесс Windows на каждом удалённом узле воспроизведения. Он подключается к Backend и управляет воспроизведением на дисплеях компьютера.

```text
┌────────────────────────────────────────────┐
│              Audexa Desktop                │
│  ┌──────────────────────────────────────┐  │
│  │       React + TypeScript UI          │  │
│  │              WebView2                │  │
│  └───────────────────┬──────────────────┘  │
│              C# Desktop Shell             │
│                      │                    │
│               локальный HTTP API          │
│                      ▼                    │
│              ASP.NET Core Backend         │
│                REST + SignalR             │
└──────────────────────┬────────────────────┘
                       │ LAN: HTTP + SignalR
             ┌─────────┴─────────┐
             ▼                   ▼
       SQLite + медиафайлы   Удалённый Windows-узел
       на диске              Media Agent
                             └─ дисплеи / воспроизведение
```

### Подключение Media Agent и сеть

- HTTP API и SignalR Backend по умолчанию используют TCP-порт `18080`.
- Обнаружение Backend использует UDP-порт `18081`.
- UDP Discovery помогает агенту найти Backend, но не выполняет аутентификацию.
- Каждый агент подключается по одноразовому коду, действующему пять минут. При сопряжении для узла создаются индивидуальные учётные данные.
- Агент защищает учётные данные с помощью Windows DPAPI (`CurrentUser`) и хранит их в `%APPDATA%\Audexa\MediaAgent`.
- Текущая конфигурация Backend использует HTTP. Размещайте Backend и агентов только в доверенной локальной сети. Для работы через недоверенные сети потребуется HTTPS с проверкой или закреплением сертификата.

Инструкции по установке и восстановлению подключения приведены в [README Media Agent](backend/audexa-media-agent/README.md).

## Установка

Audexa распространяется для Windows x64. Для установки опубликованной версии:

1. Откройте [последний релиз на GitHub](https://github.com/Vludd/audexa-desktop/releases/latest).
2. Скачайте установщик `Audexa-Setup-<version>-x64.exe` из списка файлов релиза.
3. Запустите установщик.

Media Agent распространяется отдельно в архиве `Audexa-MediaAgent-<version>-win-x64.zip`. Распакуйте его на каждом компьютере воспроизведения и следуйте [инструкции по настройке Media Agent](backend/audexa-media-agent/README.md).

## Структура репозитория

```text
audexa-desktop/
├── frontend/                    # React + TypeScript UI
│   └── docs/                    # Документация фронтенда
├── backend/
│   ├── audexa-backend/          # ASP.NET Core API и сервисы
│   └── audexa-media-agent/      # Агент воспроизведения Windows
├── desktop/
│   ├── Audexa.Desktop/          # C# Desktop Shell на WebView2
│   └── Audexa.Updater/          # Исполняемый модуль обновления
├── src/Audexa.UpdateCore/       # Транзакционное обновление файлов
├── tests/                       # Тесты Updater
├── scripts/                     # Скрипты сборки
├── installer/                   # Конфигурация Inno Setup
├── ota/                         # Документация манифеста обновлений
├── docs/                        # Сборка, релизы и OTA
└── .github/workflows/           # GitHub Actions
```

## Документация разработчика

| Документ | Содержание |
|---|---|
| [Frontend README](frontend/README.md) | Настройка и разработка фронтенда |
| [Backend README](backend/README.md) | Backend, API, база данных, файлы и Pairing |
| [Media Agent README](backend/audexa-media-agent/README.md) | Установка, подключение, сеть, сборка и восстановление агента |
| [Сборка и релизы](docs/BUILD-OTA.md) | Локальная сборка, установщик, релизный workflow и обновления |
| [Формат OTA-манифеста](ota/README.md) | Структура `latest.json`, используемого модулем обновления |
| [Хранение настроек](frontend/docs/settings-persistence.md) | Проверенное поведение хранения данных во Frontend и Backend |

## Быстрый запуск разработки

Требования и подробная процедура сборки приведены в документе [Сборка и релизы](docs/BUILD-OTA.md). Для локального запуска фронтенда и Backend:

```powershell
# Терминал 1 — из корня репозитория
dotnet run --project .\backend\audexa-backend\audexa-backend.csproj

# Терминал 2 — из корня репозитория
cd frontend
pnpm install --frozen-lockfile
pnpm dev
```

Backend автоматически применяет миграции EF Core при запуске. Сервер разработки фронтенда доступен по адресу `http://localhost:5173`, API по умолчанию — `http://127.0.0.1:18080`.

## Локальные данные

Backend хранит данные приложения в `%APPDATA%\Audexa\`:

- `audexa.db` — база SQLite.
- `Audio\` — загруженные аудиофайлы.
- `Video\` — загруженные видеофайлы.
- `Logs\` — журналы Backend в формате JSONL.

Media Agent хранит конфигурацию и защищённые DPAPI учётные данные в `%APPDATA%\Audexa\MediaAgent\` пользователя Windows, от имени которого запущен агент.

Перед ручным обслуживанием создавайте резервную копию этого каталога. Не храните пользовательские данные в каталоге установки приложения.

## Лицензия

Лицензия проекта пока не указана.

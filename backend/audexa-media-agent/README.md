# Audexa Media Agent

Media Agent runs in the interactive Windows user session and controls the displays assigned to this computer.

## First launch

1. In Audexa, open **Media Hosts** and choose **Подключить агент**.
2. Enter a device name and create a pairing code.
3. Start `Audexa.MediaAgent.exe` on the target Windows computer.
4. The Agent attempts to discover Backend through UDP broadcast. If discovery fails (for example, across VLANs), enter the Backend URL manually.
5. Enter the one-time pairing code. It expires after five minutes and can only be used once.
6. The Agent stores its configuration under `%APPDATA%\Audexa\MediaAgent` and protects its device credential with Windows DPAPI (`CurrentUser`).

The credential is not stored in `config.json`; it is stored in `credentials.dpapi`. The Agent must be run under the same Windows user account after pairing.

## Network

- Backend HTTP API and SignalR: TCP `18080` (or configured port).
- Backend discovery: UDP `18081`.
- UDP broadcast discovery does not cross VLANs. Use the Backend URL field when the Agent is on another subnet.

## Security note

The pairing flow uses a short-lived one-time code and an individual secret per Media Host. UDP discovery only provides a candidate Backend address; it does not authenticate the Backend.

The current desktop Backend listens over HTTP. Therefore, pairing codes and device credentials can be observed on an untrusted network. Use this initial implementation only on a trusted LAN. HTTPS with a trusted certificate (or certificate pinning) is required before deploying across untrusted networks.

Do not distribute developer-local `appsettings.json` files. The release package contains only `appsettings.example.json`.

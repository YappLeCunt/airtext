# airtext

A small clipboard bridge between a computer and a phone. Open the app on the computer, scan its QR code from the phone, and share text between both screens.

## Local development

```bash
npm install
npm run dev
```

The app works as a visual client over Vite. Camera and clipboard APIs require a secure context, so test the full flow on an HTTPS Cloudflare deployment or through a local HTTPS proxy. The Worker room relay is exercised with Wrangler:

```bash
npm run build
npx wrangler dev
```

## Deploy to Cloudflare

This project uses Cloudflare Workers Static Assets for the Vite build and one Durable Object instance per temporary room for WebSocket signaling/relay.

```bash
npm install
npm run deploy
```

Before the first deploy, authenticate Wrangler with `npx wrangler login` and confirm that Durable Objects are available under the account's current free allocation. The room relay keeps content in memory only, does not write clipboard text to Durable Object storage, and closes idle rooms.

## How pairing works

1. Choose **Use this computer**. A temporary room opens automatically and displays a QR code plus an 8-character fallback code.
2. Choose **Use this phone** on the phone, scan the QR, or enter the fallback code.
3. After both browsers show **Connected**, share text from either composer.
4. Each browser keeps its own bounded history in IndexedDB. Nothing is associated with an account.

## Privacy and limits

- Room codes are temporary bearer capabilities. Leave the room or start over to invalidate the current connection.
- Only two browser connections are allowed in a room.
- Clipboard text is forwarded to the other live browser and is not persisted by the Worker.
- Text is rendered as text, never as HTML.
- Text entries are capped at 100,000 characters and each local history is capped at 100 entries.
- Camera and clipboard permissions are controlled by the browser. HTTPS is required by modern browsers for those APIs.

## Checks

```bash
npm run build
npm test
npm run lint
```

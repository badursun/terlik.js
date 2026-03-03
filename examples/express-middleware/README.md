# terlik.js — Express Middleware Example

Profanity detection API with three endpoints: check, clean, and moderate.

## Setup

```bash
npm install
npm start
```

Server starts on `http://localhost:3000`.

## Endpoints

All endpoints accept `POST` with JSON body `{ "message": "..." }`.
Add `?lang=en|es|de` to switch language (default: `tr`).

### POST /api/check

Returns whether the message contains profanity.

```bash
curl -X POST http://localhost:3000/api/check \
  -H "Content-Type: application/json" \
  -d '{"message": "merhaba dünya"}'
# {"message":"merhaba dünya","hasProfanity":false}

curl -X POST http://localhost:3000/api/check?lang=en \
  -H "Content-Type: application/json" \
  -d '{"message": "what the fuck"}'
# {"message":"what the fuck","hasProfanity":true}
```

### POST /api/clean

Returns the message with profanity masked.

```bash
curl -X POST http://localhost:3000/api/clean \
  -H "Content-Type: application/json" \
  -d '{"message": "siktir git buradan"}'
# {"original":"siktir git buradan","cleaned":"****** git buradan"}
```

### POST /api/moderate

Returns detailed match info (root word, severity, category).

```bash
curl -X POST http://localhost:3000/api/moderate?lang=en \
  -H "Content-Type: application/json" \
  -d '{"message": "you are a damn idiot"}'
# Returns matches array with word, root, severity, category, method
```

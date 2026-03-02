# terlik.js Integration Guide

Practical examples for integrating terlik.js into your project. Each section is self-contained — jump to the framework you use. For the full API reference see [docs/api.md](./api.md), for the project overview see the [README](../README.md).

**Contents:**

- [Quick Start](#quick-start)
- [Express.js Middleware](#expressjs-middleware)
- [Fastify Plugin](#fastify-plugin)
- [Next.js](#nextjs)
- [Nuxt.js](#nuxtjs)
- [Socket.io (Real-time Chat)](#socketio-real-time-chat)
- [Multi-Language Server](#multi-language-server)
- [Best Practices](#best-practices)

---

## Quick Start

### Install

```bash
npm install terlik.js
```

### Basic Usage

```ts
import { Terlik } from "terlik.js";

const terlik = new Terlik(); // Turkish by default

// Boolean check
terlik.containsProfanity("merhaba");     // false
terlik.containsProfanity("siktir git");  // true

// Clean text (mask profanity)
terlik.clean("siktir git burdan");       // "****** git burdan"

// Get detailed matches
const matches = terlik.getMatches("aptal orospu");
// [
//   { word: "aptal", root: "aptal", index: 0, severity: "medium", category: "insult", method: "pattern" },
//   { word: "orospu", root: "orospu", index: 6, severity: "high", category: "insult", method: "pattern" }
// ]
```

### Mask Styles

```ts
// Stars (default) — full replacement
terlik.clean("siktir git");  // "****** git"

// Partial — first and last char visible
const partial = new Terlik({ maskStyle: "partial" });
partial.clean("siktir git"); // "s****r git"

// Replace — custom text
const replace = new Terlik({ maskStyle: "replace", replaceMask: "[censored]" });
replace.clean("siktir git"); // "[censored] git"
```

### Custom Words & Whitelist

```ts
const terlik = new Terlik({
  customList: ["toxicword"],          // add custom words to detect
  whitelist: ["legitimateword"],      // prevent false positives
});

// Runtime modification
terlik.addWords(["anotherword"]);
terlik.removeWords(["salak"]);
```

### Other Languages

```ts
const en = new Terlik({ language: "en" });
const es = new Terlik({ language: "es" });
const de = new Terlik({ language: "de" });

en.containsProfanity("what the fuck"); // true
es.containsProfanity("hijo de puta");  // true
de.containsProfanity("scheiße");       // true
```

---

## Express.js Middleware

### Basic Middleware — Reject Profane Requests

```ts
import express from "express";
import { Terlik } from "terlik.js";

const app = express();
app.use(express.json());

// Create instance once at module level — never per request
const terlik = new Terlik();
terlik.containsProfanity("warmup"); // JIT warmup

function profanityGuard(req, res, next) {
  const text = req.body?.message || req.body?.text || "";
  if (terlik.containsProfanity(text)) {
    return res.status(400).json({
      error: "Message contains inappropriate language",
    });
  }
  next();
}

app.post("/api/chat", profanityGuard, (req, res) => {
  res.json({ message: req.body.message });
});

app.listen(3000);
```

### Middleware — Clean Instead of Reject

```ts
function profanityCleaner(fields: string[]) {
  return (req, res, next) => {
    for (const field of fields) {
      if (req.body?.[field]) {
        req.body[field] = terlik.clean(req.body[field]);
      }
    }
    next();
  };
}

// Clean "message" and "bio" fields before they reach the handler
app.post("/api/profile", profanityCleaner(["message", "bio"]), (req, res) => {
  // req.body.message and req.body.bio are already cleaned
  res.json({ success: true, data: req.body });
});
```

### Multi-Language Express Middleware

```ts
import { Terlik } from "terlik.js";

// Warm up all languages at startup
const instances = Terlik.warmup(["tr", "en", "es", "de"]);

function profanityGuardMultiLang(req, res, next) {
  // Pick language from Accept-Language header, query param, or default
  const lang = req.query.lang
    || req.headers["accept-language"]?.slice(0, 2)
    || "tr";

  const instance = instances.get(lang) || instances.get("tr")!;
  const text = req.body?.message || "";

  if (instance.containsProfanity(text)) {
    return res.status(400).json({ error: "Inappropriate language detected" });
  }
  next();
}

app.post("/api/chat", profanityGuardMultiLang, (req, res) => {
  res.json({ ok: true });
});
```

---

## Fastify Plugin

### Basic Plugin

```ts
import Fastify from "fastify";
import fp from "fastify-plugin";
import { Terlik } from "terlik.js";

const terlik = new Terlik();
terlik.containsProfanity("warmup");

const profanityPlugin = fp(async (fastify) => {
  // Decorate fastify instance so it's available everywhere
  fastify.decorate("terlik", terlik);

  // Add a preHandler hook for routes that opt in
  fastify.decorate("profanityGuard", async (request, reply) => {
    const text = (request.body as any)?.message || "";
    if (terlik.containsProfanity(text)) {
      reply.code(400).send({ error: "Inappropriate language detected" });
    }
  });
});

const app = Fastify();
app.register(profanityPlugin);

app.post("/chat", {
  preHandler: [app.profanityGuard],
}, async (request) => {
  return { message: (request.body as any).message };
});

app.listen({ port: 3000 });
```

### Fastify with Schema Validation

```ts
app.post("/chat", {
  schema: {
    body: {
      type: "object",
      required: ["message"],
      properties: {
        message: { type: "string", maxLength: 5000 },
      },
    },
  },
  preHandler: async (request, reply) => {
    const { message } = request.body as { message: string };
    if (app.terlik.containsProfanity(message)) {
      reply.code(400).send({ error: "Inappropriate language detected" });
    }
  },
}, async (request) => {
  const { message } = request.body as { message: string };
  return { cleaned: app.terlik.clean(message) };
});
```

---

## Next.js

### API Route Handler (App Router)

```ts
// app/api/chat/route.ts
import { NextResponse } from "next/server";
import { terlik } from "@/lib/terlik";

export async function POST(request: Request) {
  const { message } = await request.json();

  if (terlik.containsProfanity(message)) {
    return NextResponse.json(
      { error: "Message contains inappropriate language" },
      { status: 400 },
    );
  }

  // Or clean instead of reject:
  const cleaned = terlik.clean(message);

  return NextResponse.json({ message: cleaned });
}
```

### Singleton Instance

```ts
// lib/terlik.ts
import { Terlik } from "terlik.js";

// Module-level singleton — created once, reused across all requests.
// Next.js hot-reloads in dev, so use globalThis to survive reloads.
const globalForTerlik = globalThis as unknown as { terlik: Terlik };

export const terlik =
  globalForTerlik.terlik ??
  (() => {
    const instance = new Terlik();
    instance.containsProfanity("warmup");
    return instance;
  })();

if (process.env.NODE_ENV !== "production") {
  globalForTerlik.terlik = terlik;
}
```

### Server Action (Form Validation)

```ts
// app/actions/submit-comment.ts
"use server";

import { terlik } from "@/lib/terlik";

export async function submitComment(formData: FormData) {
  const comment = formData.get("comment") as string;

  if (terlik.containsProfanity(comment)) {
    return { error: "Your comment contains inappropriate language." };
  }

  const cleaned = terlik.clean(comment);

  // Save to database...
  await db.comments.create({ data: { text: cleaned } });

  return { success: true };
}
```

### Usage in a React Component

```tsx
// app/components/CommentForm.tsx
"use client";

import { submitComment } from "@/app/actions/submit-comment";
import { useActionState } from "react";

export function CommentForm() {
  const [state, action, pending] = useActionState(submitComment, null);

  return (
    <form action={action}>
      <textarea name="comment" required />
      <button type="submit" disabled={pending}>
        {pending ? "Sending..." : "Send"}
      </button>
      {state?.error && <p className="error">{state.error}</p>}
    </form>
  );
}
```

> **Note:** terlik.js runs on the **server side only** (API Routes, Server Actions, Server Components). While it works in any V8/JavaScriptCore environment (Node.js, Bun, Deno, modern browsers, Cloudflare Workers), shipping profanity dictionaries to the client is not recommended. For Next.js specifically, do not use it in Edge Runtime middleware — use a Node.js API route or Server Action instead.

---

## Nuxt.js

### Server API Route

```ts
// server/api/chat.post.ts
import { Terlik } from "terlik.js";

const terlik = new Terlik();
terlik.containsProfanity("warmup");

export default defineEventHandler(async (event) => {
  const { message } = await readBody(event);

  if (terlik.containsProfanity(message)) {
    throw createError({
      statusCode: 400,
      message: "Message contains inappropriate language",
    });
  }

  return { message: terlik.clean(message) };
});
```

### Server Middleware

```ts
// server/middleware/profanity.ts
import { Terlik } from "terlik.js";

const terlik = new Terlik();
terlik.containsProfanity("warmup");

export default defineEventHandler(async (event) => {
  // Only check POST/PUT/PATCH requests
  const method = getMethod(event);
  if (!["POST", "PUT", "PATCH"].includes(method)) return;

  const body = await readBody(event);
  if (!body) return;

  // Check all string fields in the body
  for (const [key, value] of Object.entries(body)) {
    if (typeof value === "string" && terlik.containsProfanity(value)) {
      throw createError({
        statusCode: 400,
        message: `Field "${key}" contains inappropriate language`,
      });
    }
  }
});
```

### Nuxt Plugin (Server-side Utility)

```ts
// server/utils/terlik.ts
import { Terlik } from "terlik.js";

const terlik = new Terlik();
terlik.containsProfanity("warmup");

export function useTerlik() {
  return terlik;
}
```

```ts
// server/api/comment.post.ts
import { useTerlik } from "../utils/terlik";

export default defineEventHandler(async (event) => {
  const terlik = useTerlik();
  const { text } = await readBody(event);

  return { cleaned: terlik.clean(text) };
});
```

---

## Socket.io (Real-time Chat)

### Basic Chat Filter

```ts
import { Server } from "socket.io";
import { Terlik } from "terlik.js";

const terlik = new Terlik();
terlik.containsProfanity("warmup");

const io = new Server(3000, { cors: { origin: "*" } });

io.on("connection", (socket) => {
  socket.on("message", (data) => {
    const cleaned = terlik.clean(data.text);

    // Broadcast the cleaned message to everyone in the room
    io.to(data.room).emit("message", {
      user: data.user,
      text: cleaned,
      filtered: cleaned !== data.text, // flag if it was modified
    });
  });
});
```

### Multi-Language Chat Rooms

```ts
import { Server } from "socket.io";
import { Terlik } from "terlik.js";

// Warm up all languages at startup
const instances = Terlik.warmup(["tr", "en", "es", "de"]);

const io = new Server(3000);

io.on("connection", (socket) => {
  // User sets their language on connect
  const lang = socket.handshake.query.lang as string || "tr";
  const terlik = instances.get(lang) || instances.get("tr")!;

  socket.on("message", (data) => {
    const cleaned = terlik.clean(data.text);

    io.to(data.room).emit("message", {
      user: data.user,
      text: cleaned,
    });
  });
});
```

### Reject Instead of Clean

```ts
io.on("connection", (socket) => {
  socket.on("message", (data) => {
    if (terlik.containsProfanity(data.text)) {
      // Notify only the sender
      socket.emit("error", {
        message: "Your message contains inappropriate language.",
      });
      return; // Don't broadcast
    }

    io.to(data.room).emit("message", {
      user: data.user,
      text: data.text,
    });
  });
});
```

---

## Multi-Language Server

Full example with language detection and caching.

### Startup Warmup

```ts
import { Terlik, getSupportedLanguages } from "terlik.js";

// Warm all supported languages at server startup
const allLanguages = getSupportedLanguages(); // ["tr", "en", "es", "de"]
const cache = Terlik.warmup(allLanguages);

console.log(`Terlik warmed up for: ${allLanguages.join(", ")}`);
```

### Language Selection Strategies

```ts
// Strategy 1: From Accept-Language header
function getLangFromHeader(req: Request): string {
  const header = req.headers.get("accept-language") || "";
  const primary = header.split(",")[0]?.split("-")[0]?.trim();
  return cache.has(primary) ? primary : "tr";
}

// Strategy 2: From query parameter
function getLangFromQuery(url: URL): string {
  const lang = url.searchParams.get("lang") || "tr";
  return cache.has(lang) ? lang : "tr";
}

// Strategy 3: From user profile (database)
async function getLangFromUser(userId: string): Promise<string> {
  const user = await db.users.findById(userId);
  const lang = user?.language || "tr";
  return cache.has(lang) ? lang : "tr";
}
```

### Complete Multi-Language Express Server

```ts
import express from "express";
import { Terlik, getSupportedLanguages } from "terlik.js";

const app = express();
app.use(express.json());

// Warm up all languages once at startup
const cache = Terlik.warmup(getSupportedLanguages());

app.post("/api/moderate", (req, res) => {
  const { message, lang } = req.body;
  const instance = cache.get(lang) || cache.get("tr")!;

  const matches = instance.getMatches(message);

  if (matches.length > 0) {
    res.json({
      flagged: true,
      cleaned: instance.clean(message),
      matches: matches.map((m) => ({
        word: m.word,
        severity: m.severity,
      })),
    });
  } else {
    res.json({ flagged: false, cleaned: message, matches: [] });
  }
});

app.get("/api/languages", (_req, res) => {
  res.json({ supported: getSupportedLanguages() });
});

app.listen(3000, () => {
  console.log("Moderation API running on :3000");
});
```

---

## Best Practices

### 1. Never Create Instances Per Request

```ts
// BAD — recompiles patterns on every request (~10-50ms + JIT cost)
app.post("/chat", (req, res) => {
  const terlik = new Terlik();
  res.json({ clean: terlik.clean(req.body.message) });
});

// GOOD — create once, reuse forever (<1ms per call)
const terlik = new Terlik();
terlik.containsProfanity("warmup");

app.post("/chat", (req, res) => {
  res.json({ clean: terlik.clean(req.body.message) });
});
```

### 2. Always Warm Up in Production

```ts
// At server startup, before accepting requests:
const terlik = new Terlik();
terlik.containsProfanity("warmup"); // Forces JIT compilation (~1-3s)

// Or for multi-language:
const cache = Terlik.warmup(["tr", "en", "es", "de"]); // All warmed at once
```

Without warmup, the first real user request pays the JIT cost (1-3 seconds).

### 3. Choose the Right Mode

| Use Case | Mode | Why |
|----------|------|-----|
| User-generated content (chat, comments) | `"balanced"` (default) | Best balance of detection and false positives |
| Legal/compliance filtering | `"strict"` | Minimum false positives, only exact matches |
| Anti-spam / troll detection | `"loose"` | Catches typos and creative evasion via fuzzy matching |

```ts
// Strict for sensitive contexts
const strict = new Terlik({ mode: "strict" });

// Loose with fuzzy for aggressive filtering
const loose = new Terlik({ mode: "loose", enableFuzzy: true, fuzzyThreshold: 0.7 });
```

### 4. Runtime Compatibility

terlik.js uses regex lookbehind assertions, supported in all modern JavaScript runtimes:

- **Works:** Node.js 18+, Bun, Deno, modern browsers (Chrome 62+, Firefox 78+, Safari 16.4+), Cloudflare Workers
- **Not recommended:** Client-side bundles (exposes dictionary data), Vercel Edge Runtime (limited API surface)

For Next.js and Nuxt, always use server-side routes. For edge-based architectures, call terlik.js from a Node.js API route or serverless function.

### 5. Combine with Application Logic

```ts
// Tiered moderation based on severity
const matches = terlik.getMatches(message);

const hasHigh = matches.some((m) => m.severity === "high");
const hasMedium = matches.some((m) => m.severity === "medium");

if (hasHigh) {
  // Block and flag for review
  await flagForReview(userId, message);
  return { error: "Message blocked" };
} else if (hasMedium) {
  // Clean and warn
  return { message: terlik.clean(message), warning: true };
} else {
  // Pass through
  return { message };
}
```

### 6. Logging Matches for Analytics

```ts
const matches = terlik.getMatches(message);

if (matches.length > 0) {
  console.log(JSON.stringify({
    event: "profanity_detected",
    userId,
    matchCount: matches.length,
    severities: matches.map((m) => m.severity),
    methods: matches.map((m) => m.method),
    // Never log the actual words in production for privacy
  }));
}
```

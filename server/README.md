# JobTrackr API

The backend for [JobTrackr](../README.md), built with Node.js, Express and MongoDB (Mongoose).

- **Day 5**: REST routes, middleware, validation, central error handling
- **Day 6**: moved from an in-memory array to MongoDB Atlas, with users, embedded notes, an index, aggregation and pagination
- **Day 7**: accounts with bcrypt + JWT, users only see their own data, an admin role, and defences against brute force, NoSQL injection and XSS
- **Day 9**: `/api/health`, `trust proxy` for Render, a `Dockerfile`, and deployment to Render (see the [main README](../README.md) and [DEPLOY_NOTES.md](../DEPLOY_NOTES.md))

## Run it

1. Create a free cluster on [MongoDB Atlas](https://www.mongodb.com/atlas), add a database user, and allow your IP under **Network Access**.
2. Go to **Connect → Drivers** and copy the connection string.

```bash
cd server
npm install
cp .env.example .env     # paste your Atlas URI into MONGODB_URI
npm run seed             # 2 users + 1 admin + 1,000 applications
npm run dev              # starts only after MongoDB connects
```

`.env` values:

| Key | Example | What it's for |
| --- | --- | --- |
| `PORT` | `5000` | port the server listens on |
| `NODE_ENV` | `development` | stack traces are only included in errors when this is `development` |
| `CLIENT_URL` | `http://localhost:5173` | browser origin(s) CORS allows, comma-separated, e.g. `https://jobtrackr-board.vercel.app,http://localhost:5173` |
| `MONGODB_URI` | `mongodb+srv://user:pass@cluster0.xxxxx.mongodb.net/jobtrackr` | Atlas connection string |
| `JWT_SECRET` | a long random string | signs the login tokens. Generate one with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `JWT_EXPIRES_IN` | `1d` | how long a token stays valid |

`server.js` awaits `connectDB()` before calling `app.listen()`. If the connection fails, it logs the reason and exits, so the API never runs without a database.

Scripts:

| Script | Does |
| --- | --- |
| `npm run dev` | start with `node --watch` |
| `npm start` | start normally |
| `npm run seed` | wipe the collections, add 2 users + 1 admin (password `Password123!`) and 1,000 random applications |
| `npm run explain` | run `explain()` without and with the `{ owner: 1, status: 1 }` index |

## Data model

**User**: `name` (2–60 chars), `email` (unique, lowercased, must look like an email), `password` (8–72 chars, bcrypt hash, `select: false`), `role` (`user` or `admin`, default `user`), `createdAt`, `updatedAt`

**Application**:

| Field | Rules |
| --- | --- |
| `owner` | ObjectId, `ref: 'User'`, required (**referenced**) |
| `company`, `role` | required, trimmed, 2–60 characters |
| `status` | `Applied`, `Interview`, `Offer` or `Rejected`, default `Applied` |
| `appliedOn` | Date, required, not in the future |
| `priority` | `Low`, `Medium` or `High`, default `Medium` |
| `salary` | Number, min 0, optional |
| `notes` | array of `{ text, createdAt }` subdocuments (**embedded**), text up to 500 chars |
| `createdAt`, `updatedAt` | from `timestamps: true` |

The `owner` always comes from the logged-in user's token, never from the request body.

### Why notes are embedded but the owner is referenced

**Notes are embedded** because they belong to one application and nothing else. They're always shown together with it, never looked up on their own, and there are only a few per application. Keeping them inside the document means one read gets everything, and deleting the application deletes its notes too.

**The owner is referenced** because a user exists on their own (they'll log in, change their name, etc.) and one user has **many** applications, possibly thousands. Copying the user into every application would mean updating thousands of documents when they change their email. Embedding all applications inside the user would make one huge document that keeps growing (MongoDB caps documents at 16 MB). So applications store just the user's `_id`, and `populate('owner', 'name email')` fills in the details when needed.

Rule of thumb: **embed** when the child is small, bounded and only read with its parent. **Reference** when it's shared, unbounded or used on its own.

### When I'd pick SQL instead of MongoDB

- The data is very **relational**, with lots of joins between many tables (orders ↔ products ↔ customers ↔ invoices)
- I need **strong transactions** across many rows, like moving money between accounts
- The **schema is stable** and strict rules belong in the database (foreign keys, constraints)
- Lots of **ad-hoc reporting** with complex queries, where SQL is very good

MongoDB fits JobTrackr because each application is a self-contained document (with its notes inside), the shape may change as features get added, and most reads are "this user's applications".

## Routes

### Auth

| Method | Route | Success | Errors |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | 201 + token + user (no password) | 400 invalid, 409 email taken |
| POST | `/api/auth/login` | 200 + token + user | 400 non-string fields, 401 `Invalid email or password`, 429 too many attempts |
| GET | `/api/auth/me` | 200 + user | 401 not authorised |
| GET | `/api/admin/stats` | 200 + totals across all users | 401 no token, 403 not an admin |

Send the token on every other request as `Authorization: Bearer <token>`.

### Applications (all need a token, and only ever touch your own applications)

| Method | Route | Notes | Success |
| --- | --- | --- | --- |
| GET | `/api/applications` | `?page=2&limit=10&status=Interview&search=google` | 200 |
| GET | `/api/applications/stats` | your count per status + average offer salary | 200 |
| GET | `/api/applications/:id` | one application, owner populated | 200 / 400 / 404 |
| POST | `/api/applications` | validated by the schema, owner = you | 201 |
| PATCH | `/api/applications/:id` | partial update, only known fields | 200 / 400 / 404 |
| DELETE | `/api/applications/:id` | | 204 / 400 / 404 |
| POST | `/api/applications/:id/notes` | `{ "text": "..." }` pushes a note | 201 / 400 / 404 |
| GET | `/api/health` | `{ status, uptime, database, environment, timestamp }`, 503 if the database is down (Day 9, public) | 200 / 503 |
| GET | `/api/slow`, `/api/block` | event loop demo (Day 5, public) | 200 |

Every application comes back with `populate('owner', 'name email')`:

```json
{
  "_id": "6aeb3307940d157adb7e1410",
  "owner": { "_id": "6aeb3307940d157adb7e1406", "name": "Karthik Uppari", "email": "karthik@example.com" },
  "company": "Razorpay",
  "role": "Frontend Intern",
  "status": "Interview",
  "appliedOn": "2026-10-20T00:00:00.000Z",
  "priority": "High",
  "salary": 45000,
  "notes": [{ "_id": "...", "text": "Recruiter called back", "createdAt": "2026-11-04T13:29:06.075Z" }],
  "createdAt": "...",
  "updatedAt": "..."
}
```

## Errors

Every error has the same shape:

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": { "company": "company must be 2–60 characters", "salary": "salary can't be negative" }
}
```

| Problem | Status | Example `errors` |
| --- | --- | --- |
| Bad id, e.g. `/api/applications/abc` (Mongoose `CastError`) | 400 | `{ "id": "\"abc\" is not a valid id" }` |
| Schema rules fail (Mongoose `ValidationError`) | 400 | one message per field |
| Unknown field in PATCH | 400 | `{ "notes": "notes is not an allowed field" }` |
| Bad `page` / `limit` / `status` filter | 400 | `{ "limit": "limit must be a whole number from 1 to 100" }` |
| Broken JSON body | 400 | `{}` |
| No token, fake token or expired token | 401 | `{}` |
| Logged in but not an admin | 403 | `{}` |
| Valid id that doesn't exist, **or belongs to someone else**, unknown route | 404 | `{}` |
| Same company + role for the same user, or a taken email | 409 | `{ "email": "karthik@example.com is already taken" }` |
| 6th login attempt in 15 minutes | 429 | `{}` |

The routes `throw new ApiError(...)` or let Mongoose throw. The central `errorHandler` turns all of these into the shape above. A `stack` field is added only when `NODE_ENV=development`.

## Authentication and authorisation (Day 7)

### Passwords
- `password` has `select: false`, so normal queries never load it. Login asks for it explicitly with `.select('+password')`.
- A `pre('save')` hook hashes it with **bcrypt, 12 rounds** whenever it's new or changed. Validation (8–72 characters) runs on the plain password before the hook.
- The model's `toJSON` also deletes `password`, so even a loaded hash can never end up in a response. The Postman tests check that no response contains `password` or a `$2b$` hash.
- What's stored in MongoDB looks like `$2b$12$Gx4cqTu9aS74cN1YXxIS..tguNnG4u...`

### Tokens
- Register and login return a **JWT** signed with `JWT_SECRET`, containing `{ id, role }`, valid for `JWT_EXPIRES_IN` (1 day).
- Login gives **the same message for an unknown email and a wrong password** (`Invalid email or password`), so nobody can use it to check which emails have accounts. For an unknown email it still runs a bcrypt compare against a dummy hash, so both cases take about the same time too.
- `role` is never read from the register body. Sending `"role": "admin"` still creates a normal user.

### Middleware
- `protect` reads `Authorization: Bearer <token>`, verifies it, loads the user and sets `req.user`. Missing, invalid or expired token → 401. If the account was deleted, the token stops working too.
- `authorize('admin')` runs after `protect` and returns 403 for any other role. The role is read from the database, not the token, so promoting or demoting someone takes effect straight away.

### Users only see their own applications
Every application query starts from `{ owner: req.user.id }`: list, stats, get, update, delete and notes. If User B asks for User A's application, the query `{ _id, owner: B }` finds nothing, so B gets **404**, not 403. A 403 would tell B that the id exists.

### Making an admin
`npm run seed` creates `admin@example.com` with `role: "admin"`. To promote any other account, open the cluster in **Atlas → Browse Collections → jobtrackr → users**, edit the user, change `role` from `"user"` to `"admin"` and save. Their next request is treated as admin.

`GET /api/admin/stats` returns users per role, applications per status, the average offer salary across everyone, and the top 5 users by number of applications (name and email only).

## Security defences (Day 7)

### Brute force: rate limiting
`POST /api/auth/login` uses `express-rate-limit`: **5 attempts per 15 minutes per IP**. The 6th gets **429** `Too many login attempts. Try again in 15 minutes.` with a `Retry-After` header. The limiter runs before validation, so every attempt counts, including bad ones.

(The counter lives in memory, so restarting the server resets it. With several servers it would need a shared store like Redis. Behind a proxy you'd also set `app.set('trust proxy', 1)` so it sees the real IP.)

### helmet()
`helmet()` is the first middleware and adds security headers to every response. Three of them:

| Header | Value | What it does |
| --- | --- | --- |
| `Content-Security-Policy` | `default-src 'self'; script-src 'self'; object-src 'none'; ...` | tells the browser which sources scripts, styles, images etc. may load from. Injected inline scripts won't run |
| `X-Content-Type-Options` | `nosniff` | stops the browser guessing the content type, so a JSON response can't be treated as HTML or a script |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | tells the browser to only use HTTPS for this site for a year |

It also sets `X-Frame-Options: SAMEORIGIN` (no embedding the site in someone else's iframe, which stops clickjacking) and `Referrer-Policy: no-referrer`, and removes `X-Powered-By: Express` so the server doesn't advertise what it runs.

### NoSQL injection
The attack, in Postman:

```json
POST /api/auth/login
{ "email": { "$ne": null }, "password": "x" }
```

Without protection, `User.findOne({ email: { $ne: null } })` means "find a user whose email is not null", which matches the first user in the database. That's how attackers get into accounts without knowing the email.

Blocked twice:
1. **Validation**: `requireStrings(['email', 'password'])` rejects anything that isn't a plain string → `400 { "errors": { "email": "email must be a string" } }`. Register does the same for name, email and password. Query params are checked too, so `?status[$ne]=Applied` → 400.
2. **`mongoose.set('sanitizeFilter', true)`** in `config/db.js`: if an object with a `$` key ever reaches a query anyway, Mongoose wraps it in `$eq` so it's matched as a literal value, not run as an operator. I tested it without the validation: the query failed instead of returning a user. Where the code uses an operator on purpose (the `$ne` in the duplicate check), it's marked with `mongoose.trusted()`.

### XSS
The test: save a note with `<img src=x onerror=alert(1)>`. The API stores it **exactly as typed** and returns it as JSON (`Content-Type: application/json` with `nosniff`), so nothing runs on the API side.

When the React frontend shows it like this:

```jsx
<p>{note.text}</p>
```

**React escapes it by default.** Anything inside `{ }` is inserted as a text node, not parsed as HTML, so `<` and `>` become `&lt;` and `&gt;`. The user sees the literal text `<img src=x onerror=alert(1)>` on the page, and no image tag is created, so `onerror` never fires.

The React feature that would make it dangerous is **`dangerouslySetInnerHTML`**:

```jsx
<p dangerouslySetInnerHTML={{ __html: note.text }} />   // ❌ the browser parses it and runs alert(1)
```

That puts the string straight into `innerHTML`. If we ever need to render user HTML (e.g. rich-text notes), it has to go through a sanitiser like **DOMPurify** first. Two other things to watch for: user-supplied links (`<a href={url}>` with `javascript:alert(1)`), so only allow `http(s)` URLs, and anything outside React like `element.innerHTML = ...`.

## Index: COLLSCAN vs IXSCAN

Query: `Application.find({ owner, status: 'Interview' }).explain('executionStats')` on 1,000 seeded applications (500 per user). Since Day 7 every list query filters by `owner`, so this index is used on almost every request. Run it yourself with `npm run explain`.

| | Before (no index) | After `{ owner: 1, status: 1 }` |
| --- | --- | --- |
| Stage | **COLLSCAN** | **IXSCAN** |
| Documents returned | 87 | 87 |
| Documents examined | **1,000** | **87** |
| Index keys examined | 0 | 87 |

Before the index, MongoDB had to read **every document** in the collection (a collection scan) and check each one. With the compound index it jumps straight to the entries for this owner + `Interview` and reads only the 87 documents it returns. With 1,000 documents both take about 1 ms, but a collection scan grows with the size of the collection, while the index lookup grows only with the number of matches.

The index is declared in the schema (`applicationSchema.index({ owner: 1, status: 1 })`). Because `owner` comes first, it also speeds up queries that filter by `owner` alone.

Your exact numbers will be slightly different because the seed data is random.

## Aggregation: `/api/applications/stats`

```js
Application.aggregate([
  { $match: { owner: req.user.id } },       // only the logged-in user's applications
  { $group: {
      _id: '$status',
      count: { $sum: 1 },
      averageSalary: { $avg: '$salary' }      // $avg ignores documents without a salary
  } },
  { $sort: { count: -1 } },
])
```

Example response:

```json
{ "success": true, "data": {
  "total": 1000,
  "byStatus": { "Applied": 502, "Interview": 166, "Offer": 84, "Rejected": 248 },
  "averageOfferSalary": 68190
} }
```

## Pagination

`GET /api/applications?page=2&limit=10` uses `.skip((page - 1) * limit).limit(limit)`, sorted newest first. It returns:

```json
{ "success": true, "page": 2, "limit": 10, "total": 1000, "totalPages": 100, "count": 10, "data": [ ... ] }
```

`limit` defaults to 10 (max 100). The count and the page query run in parallel with `Promise.all`.

### Why `skip` gets slow on big collections, and what to use instead

`skip(n)` doesn't jump to row n. MongoDB still has to walk past the first n documents and throw them away. Page 2 skips 10, but page 50,000 skips 500,000 documents on every request, so deep pages get slower and slower. Results can also shift if something is added or deleted between page loads.

The fix is **cursor (keyset) pagination**. Instead of a page number, the client sends the last item it saw, and the query starts from there using an index:

```js
// first page
Application.find({ owner }).sort({ _id: -1 }).limit(10)
// next page: pass the last _id from the previous page
Application.find({ owner, _id: { $lt: lastId } }).sort({ _id: -1 }).limit(10)
```

That's an index lookup, so it's just as fast on page 50,000 as on page 1. The trade-off is that you can't jump straight to "page 37". This is why feeds use "Load more" or infinite scroll.

## How it's put together

```
src/
├── server.js                   # loads .env, connects to MongoDB, then starts listening
├── app.js                      # middleware in order + routes
├── config/db.js                # sanitizeFilter + mongoose.connect(MONGODB_URI)
├── models/
│   ├── User.js
│   └── Application.js          # notes subdocument + { owner: 1, status: 1 } index
├── routes/
│   ├── applications.js         # CRUD, stats, notes, pagination
│   ├── auth.js                 # register, login (rate limited), me
│   ├── admin.js                # /api/admin/stats (admin only)
│   └── demo.js                 # /api/slow and /api/block
├── middleware/
│   ├── logger.js
│   ├── auth.js                 # protect + authorize('admin')
│   ├── rateLimit.js            # 5 login attempts / 15 min
│   ├── requireStrings.js       # blocks { "$ne": null } style injection
│   ├── allowFields.js          # PATCH only accepts known fields
│   ├── notFound.js
│   └── errorHandler.js         # CastError / ValidationError / duplicate key → 400 / 409
└── utils/
    ├── ApiError.js
    ├── token.js                # signToken(user)
    └── asyncHandler.js         # passes errors from async routes to the error handler
scripts/
├── seed.js
└── explain.js
```

Middleware order in `app.js`: **helmet → cors → express.json() (10kb limit) → logger → routes → 404 handler → error handler**. The error handler has to be last: Express only passes an error forward to handlers registered after the point where it happened. If it were first, thrown errors would fall through to Express's default HTML error page instead of our JSON.

## `^4.21.0` vs `~4.21.0` (semantic versioning)

Versions are `MAJOR.MINOR.PATCH`:
- **PATCH** (4.21.**1**): bug fixes only
- **MINOR** (4.**22**.0): new features that don't break anything
- **MAJOR** (**5**.0.0): breaking changes

In `package.json`:
- `^4.21.0` (caret) allows any **4.x.x** version that's 4.21.0 or newer, like 4.21.5 or 4.22.3, but **not 5.0.0**. Minor and patch updates are fine, major ones are not.
- `~4.21.0` (tilde) allows only **4.21.x**, like 4.21.1 or 4.21.9, but **not 4.22.0**. Patch updates only.

So `~` is stricter. This project uses `"express": "^4.22.3"`, so `npm install` can pick up newer 4.x releases but will never jump to Express 5. `package-lock.json` pins the exact version that was installed, so everyone gets the same one.

## Is Node non-blocking? `/api/slow` vs `/api/block`

I called each route, then straight away called `GET /api/applications` in another tab:

| First request | `/api/applications` sent 0.2s later took |
| --- | --- |
| `GET /api/slow` (3s `setTimeout`) | **~2 ms**, answered straight away |
| `GET /api/block` (3s busy loop) | **~2.8 s**, stuck until the loop finished |

Why: Node runs all my JavaScript on **one thread**, and the **event loop** picks up the next piece of work only when the current one has finished.

- **`/api/slow`**: `setTimeout` doesn't wait on that thread. It registers a timer and the handler returns right away. The thread is free, so the event loop keeps handling other requests. After 3 seconds the timer's callback is queued and the event loop runs it, which sends the response.
- **`/api/block`**: the `while` loop *is* JavaScript running on that one thread. For 3 seconds the call stack is never empty, so the event loop can't take anything else off the queue. The other request just sits there until the loop ends.

So "Node is non-blocking" is only true when the slow work is handed off (timers, network, file I/O). Heavy CPU work in a route freezes the whole server. That kind of work should go to a worker thread or a separate service.

## AI tools (Day 10)

Three endpoints that help with job hunting. They all need a logged-in user (`Authorization: Bearer <token>`), and they use Google Gemini (`gemini-3.1-flash-lite`) through one function in [`src/services/llm.js`](src/services/llm.js).

| Route | Body | Returns |
| --- | --- | --- |
| `POST /api/ai/summarize` | `{ "jobDescription": "..." }` | 5 bullets: role, must-have skills, nice-to-haves, responsibilities, red flags |
| `POST /api/ai/rewrite` | `{ "text": "...", "tone": "formal" \| "confident" \| "concise" }` | the resume line rewritten in that tone, max 30 words |
| `POST /api/ai/extract` | `{ "jobDescription": "..." }` | `{ company, role, location, skills[], minYears, salaryRange }`, with `null` for anything the text doesn't say |
| `GET /api/ai/usage` | | your calls, tokens and cost since midnight (IST), per endpoint, plus the last 10 calls |
| `POST /api/ai/experiments` | | admin only: runs the tests in [EXPERIMENTS.md](../EXPERIMENTS.md) on the server |

Example:

```bash
curl -X POST $API/api/ai/rewrite -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"text":"made a website for my college fest using react","tone":"confident"}'
# { "success": true, "data": { "rewritten": "...", "tone": "confident", "words": <n>,
#   "usage": { "inputTokens": <n>, "outputTokens": <n>, "cost": <USD>, "calls": 1 } } }
```

### Why React can't call the LLM directly

Anything shipped to the browser is public. If React called Gemini itself, the API key would have to be in the JavaScript bundle (`VITE_` variables are baked into the build), and anyone could see it in DevTools → Sources or in the request headers in the Network tab. They could copy it and run up a bill on our account, and we couldn't limit or log their usage. So the key only lives in the server's `.env` (and in Render's environment settings). The browser calls our own `/api/ai/*` routes, which check the login, check the input, rate-limit, call Gemini and log the cost.

### Setup

1. Get a key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey).
2. Add it to `server/.env` (and Render → Environment):
   ```
   LLM_API_KEY=your-key
   LLM_MODEL=gemini-3.1-flash-lite
   ```
3. **Spending limit before the first call.** The key is on the free tier with no billing account linked, so Google can't charge anything: when the free quota runs out, calls fail with 429 (we return "The AI is busy right now"). If billing is ever turned on, set a budget with alerts first in Google Cloud Console → Billing → Budgets & alerts, and a spend cap in AI Studio.

### How it stays reliable and cheap

- **One provider function.** Only `services/llm.js` knows about Gemini (URL, headers, request and response shape). It returns `{ text, inputTokens, outputTokens, ms, cost }`, so switching to OpenAI or Anthropic means changing one file.
- **Prompts are files** in [`prompts/`](prompts): the system prompt has the rules, and the user message only has the input, wrapped in `"""` so the model treats it as data, not instructions.
- **Input checked first.** A missing field, a non-string or bad tone → 400, and over 6,000 characters → 400 *before* any model call, so we never pay for junk.
- **Structured output** for summarize and extract (`responseMimeType: application/json` + a schema). Then the code parses it and checks every field and type itself. Extract retries once if the JSON is broken or has the wrong fields, then returns **502** with a clear message.
- **No made-up salaries.** The prompt says to return `null` for anything not in the text. On top of that, the code checks that every number in `salaryRange` actually appears in the job description, and sets it to `null` if not.
- **Max 30 words for rewrite.** If the model goes over, we ask once more; if it's still over, we cut it at 30 words.
- **Rate limit:** 30 AI requests per user per hour (429 after that).
- **Every call is logged:** endpoint, model, input and output tokens, time and cost. It goes to the server log (`[ai] rewrite model=gemini-3.1-flash-lite in=<tokens> out=<tokens> time=<ms> cost=$<USD>`) and to the `aiusages` collection, which `/api/ai/usage` adds up.

**Cost = input tokens × input price / 1M + output tokens × output price / 1M.** Prices are in [`src/config/pricing.js`](src/config/pricing.js): for `gemini-3.1-flash-lite` that's $0.25 per million input tokens and $1.50 per million output tokens.

## Postman

The exported collection is in [`postman/JobTrackr-API.postman_collection.json`](postman/JobTrackr-API.postman_collection.json). It uses a `baseUrl` variable, and the requests save `tokenA`, `tokenB`, `tokenK` (Karthik, owner of the seeded data) and `adminToken` into collection variables for the requests after them.

| Folder | What it proves |
| --- | --- |
| 1. Auth | register A and B (201, token, no password), `role: admin` in the body is ignored, invalid → 400, taken email → 409, admin + Karthik login, `/me` → 200, no token / fake token → 401 |
| 2. Seeded data | Karthik sees only his 500 applications, page 2, filters, stats |
| 3. User A's application | create (owner from token), duplicate → 409, get, update, **XSS note saved as plain text** |
| 4. User B can't touch A's data | B's list doesn't contain it, get / update / note / delete A's application → **404**, A's is unchanged |
| 5. Admin | admin → 200 with totals, normal user → **403**, no token → 401 |
| 6. Error cases | no token → 401, bad id, invalid body, changing owner, `?status[$ne]=` injection, bad pagination, broken JSON → 400, unknown route → 404 |
| 7. Security | **NoSQL injection login → 400**, wrong password and unknown email → same 401 message, **6th attempt → 429**, helmet headers present |
| 8. Event loop demo | `/api/slow`, `/api/block` |

The collection uses **exactly 6 login attempts** (admin, Karthik, injection, wrong password, unknown email, then the 6th), so the last one shows the 429.

To run it:
1. `npm run seed`
2. restart the server (`npm run dev`) so the rate-limit counter starts at 0
3. Postman → **Import** → pick the file → **Run collection** (keep the order)

Result: **46 requests, 107 tests, 0 failures**. It can be run again straight away after restarting the server, since every run registers new emails. From the terminal:

```bash
npx newman run postman/JobTrackr-API.postman_collection.json
```

Interview answers: [INTERVIEW.md](INTERVIEW.md)

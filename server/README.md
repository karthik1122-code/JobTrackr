# JobTrackr API

The backend for [JobTrackr](../README.md), built with Node.js and Express.
Applications are stored in an in-memory array for now, so they reset when the server restarts.

## Run it

```bash
cd server
npm install
cp .env.example .env
npm run dev      # restarts on save (node --watch)
# or
npm start
```

The API runs on `http://localhost:5000` by default.

`.env` values:

| Key | Example | What it's for |
| --- | --- | --- |
| `PORT` | `5000` | port the server listens on |
| `NODE_ENV` | `development` | stack traces are only included in errors when this is `development` |
| `CLIENT_URL` | `http://localhost:5173` | the only browser origin CORS allows |

## Routes

| Method | Route | Notes | Success |
| --- | --- | --- | --- |
| GET | `/api/applications` | filters: `?status=Interview&search=google` | 200 |
| GET | `/api/applications/:id` | one application | 200 / 404 |
| POST | `/api/applications` | validated body | 201 |
| PATCH | `/api/applications/:id` | partial update, e.g. only `status` | 200 / 404 |
| DELETE | `/api/applications/:id` | | 204 / 404 |
| GET | `/api/slow` | waits 3s with `setTimeout` | 200 |
| GET | `/api/block` | 3s busy loop | 200 |

Example body for POST:

```json
{
  "company": "Razorpay",
  "role": "Frontend Intern",
  "appliedOn": "2026-10-20",
  "priority": "High",
  "status": "Applied"
}
```

Rules (same as the Day 3 form):
- `company`, `role`: required, 2–60 characters
- `appliedOn`: required, `yyyy-mm-dd`, not in the future
- `priority`: `Low`, `Medium` or `High`
- `status`: `Applied`, `Interview`, `Offer` or `Rejected` (defaults to `Applied`)
- same company + role (ignoring case) already exists → `409`
- PATCH only accepts these five fields. Anything else (like `salary`) → `400`

Every error looks like this:

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": { "company": "company must be 2–60 characters", "priority": "priority is required" }
}
```

`errors` is `{}` when there's no specific field to blame (404s, broken JSON). In development a `stack` field is added too.

## How it's put together

```
src/
├── server.js                   # loads .env, starts listening
├── app.js                      # middleware in order + routes
├── routes/
│   ├── applications.js         # the 5 REST routes
│   └── demo.js                 # /api/slow and /api/block
├── middleware/
│   ├── logger.js               # "GET /api/applications 200 - 3ms"
│   ├── validateApplication.js  # 400 with a message per field
│   ├── notFound.js             # unknown routes → 404
│   └── errorHandler.js         # builds every error response
├── utils/ApiError.js           # new ApiError(404, 'No application with id 9')
└── data/applications.js        # the in-memory array
```

Middleware order in `app.js`: **cors → express.json() → logger → routes → 404 handler → error handler**.

Routes don't send error responses themselves. They `throw new ApiError(status, message)` and Express passes it to the error handler, so every error comes out in the same shape.

The error handler has to be last. Express only passes an error forward to handlers registered after the point where it happened. If the error handler were first, nothing would be after the routes. Thrown errors would fall through to Express's default HTML error page instead of our JSON, and bad-JSON errors from `express.json()` wouldn't be caught either.

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

## Postman

The exported collection is in [`postman/JobTrackr-API.postman_collection.json`](postman/JobTrackr-API.postman_collection.json).

- uses a `baseUrl` collection variable (`http://localhost:5000`)
- **Applications**: all 5 routes. Create saves the new id into `applicationId` for the requests after it
- **Error cases** (8): deleted id → 404, unknown id on DELETE → 404, unknown route → 404, invalid body → 400 with a message per field, unknown PATCH field → 400, invalid status → 400, broken JSON → 400, duplicate → 409. Each one also checks the error shape
- **Event loop demo**: `/api/slow` and `/api/block`
- every request has tests that check the status code

To run it: Postman → Import → pick the file → **Run collection**. Restart the server first so the in-memory data is fresh, and keep the order since later requests use the id from Create.

Result: **16 requests, 35 tests, 0 failures**. The same run from the terminal:

```bash
npx newman run postman/JobTrackr-API.postman_collection.json
```

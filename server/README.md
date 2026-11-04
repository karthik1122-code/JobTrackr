# JobTrackr API

The backend for [JobTrackr](../README.md), built with Node.js, Express and MongoDB (Mongoose).

- **Day 5**: REST routes, middleware, validation, central error handling
- **Day 6**: moved from an in-memory array to MongoDB Atlas, with users, embedded notes, an index, aggregation and pagination

## Run it

1. Create a free cluster on [MongoDB Atlas](https://www.mongodb.com/atlas), add a database user, and allow your IP under **Network Access**.
2. Go to **Connect → Drivers** and copy the connection string.

```bash
cd server
npm install
cp .env.example .env     # paste your Atlas URI into MONGODB_URI
npm run seed             # 2 users + 1,000 applications
npm run dev              # starts only after MongoDB connects
```

`.env` values:

| Key | Example | What it's for |
| --- | --- | --- |
| `PORT` | `5000` | port the server listens on |
| `NODE_ENV` | `development` | stack traces are only included in errors when this is `development` |
| `CLIENT_URL` | `http://localhost:5173` | the only browser origin CORS allows |
| `MONGODB_URI` | `mongodb+srv://user:pass@cluster0.xxxxx.mongodb.net/jobtrackr` | Atlas connection string |

`server.js` awaits `connectDB()` before calling `app.listen()`. If the connection fails, it logs the reason and exits, so the API never runs without a database.

Scripts:

| Script | Does |
| --- | --- |
| `npm run dev` | start with `node --watch` |
| `npm start` | start normally |
| `npm run seed` | wipe the collections, add 2 users and 1,000 random applications |
| `npm run explain` | run `explain()` without and with the `{ owner: 1, status: 1 }` index |

## Data model

**User**: `name` (2–60 chars), `email` (unique, lowercased, must look like an email), `createdAt`, `updatedAt`

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

Login comes on Day 7. Until then, POST takes the `owner` id in the body. Get one from `GET /api/users`.

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

| Method | Route | Notes | Success |
| --- | --- | --- | --- |
| GET | `/api/applications` | `?page=2&limit=10&status=Interview&search=google&owner=<id>` | 200 |
| GET | `/api/applications/stats` | count per status + average offer salary (`?owner=<id>` optional) | 200 |
| GET | `/api/applications/:id` | one application, owner populated | 200 / 400 / 404 |
| POST | `/api/applications` | validated by the schema | 201 |
| PATCH | `/api/applications/:id` | partial update, only known fields | 200 / 400 / 404 |
| DELETE | `/api/applications/:id` | | 204 / 400 / 404 |
| POST | `/api/applications/:id/notes` | `{ "text": "..." }` pushes a note | 201 / 400 / 404 |
| GET | `/api/users` | list users (to get an owner id) | 200 |
| POST | `/api/users` | `{ "name", "email" }` | 201 / 409 |
| GET | `/api/slow`, `/api/block` | event loop demo (Day 5) | 200 |

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
| Valid id that doesn't exist, unknown route | 404 | `{}` |
| Same company + role for the same user, or a taken email | 409 | `{ "email": "karthik@example.com is already taken" }` |

The routes `throw new ApiError(...)` or let Mongoose throw. The central `errorHandler` turns all of these into the shape above. A `stack` field is added only when `NODE_ENV=development`.

## Index: COLLSCAN vs IXSCAN

Query: `Application.find({ owner, status: 'Interview' }).explain('executionStats')` on 1,000 seeded applications (500 per user). Run it yourself with `npm run explain`.

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
  { $match: filter },                       // everyone, or one owner with ?owner=<id>
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
├── config/db.js                # mongoose.connect(MONGODB_URI)
├── models/
│   ├── User.js
│   └── Application.js          # notes subdocument + { owner: 1, status: 1 } index
├── routes/
│   ├── applications.js         # CRUD, stats, notes, pagination
│   ├── users.js
│   └── demo.js                 # /api/slow and /api/block
├── middleware/
│   ├── logger.js
│   ├── allowFields.js          # PATCH only accepts known fields
│   ├── notFound.js
│   └── errorHandler.js         # CastError / ValidationError / duplicate key → 400 / 409
└── utils/
    ├── ApiError.js
    └── asyncHandler.js         # passes errors from async routes to the error handler
scripts/
├── seed.js
└── explain.js
```

Middleware order in `app.js`: **cors → express.json() → logger → routes → 404 handler → error handler**. The error handler has to be last: Express only passes an error forward to handlers registered after the point where it happened. If it were first, thrown errors would fall through to Express's default HTML error page instead of our JSON.

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

- `baseUrl` collection variable (`http://localhost:5000`). `userId` and `applicationId` are filled in by the requests
- **Users**: get users (saves the first user's id)
- **Applications**: list, page 2, filters, stats, create, duplicate → 409, get one, partial update, add a note, empty note → 400, delete
- **Error cases** (8 here, plus the duplicate and empty-note checks above): deleted id → 404, bad id → 400, unknown route → 404, invalid body → 400 with every field, unknown PATCH field → 400, broken JSON → 400, bad pagination → 400, duplicate email → 409
- **Event loop demo**: `/api/slow`, `/api/block`
- every request tests its status code, and the error cases also check the error shape

To run it: `npm run seed`, `npm run dev`, then in Postman → **Import** the file → **Run collection** (keep the order).

Result: **22 requests, 51 tests, 0 failures**. It can be run again without re-seeding, since the test application is created and then deleted. From the terminal:

```bash
npx newman run postman/JobTrackr-API.postman_collection.json
```

Interview answers: [INTERVIEW.md](INTERVIEW.md)

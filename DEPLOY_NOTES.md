# Deploy notes

JobTrackr runs as:

```
Phone / laptop browser
   │  loads the React app (static files)
   ▼
Vercel ── client/dist ──►  React app
   │  fetch https://<render-app>.onrender.com/api/...   (JSON + Authorization: Bearer <JWT>)
   ▼
Render ── server/ ──►  Express API  (NODE_ENV=production, listens on process.env.PORT)
   │  Mongoose
   ▼
MongoDB Atlas  (Network Access allows 0.0.0.0/0, because Render's free tier has no fixed outbound IP)
```

Below are the three failures I caused on purpose (one at a time), where the error showed up, and the fix. Each error message is copied from a real run. Failure 3 was on the live Vercel site. Failure 2 used the live Vercel site against the API. Failure 1 ran the server with the same code and start command Render uses (`npm start`). `[Render log]` marks where to paste the matching lines from the Render dashboard.

---

## 1. Wrong `MONGODB_URI`

**What I did:** set `MONGODB_URI` with a typo in the cluster host (`cluster0.abcde.mongodb.net` instead of the real one). The same happens if the `<user>:<password>` placeholders from `.env.example` are left in.

**Where to find it:** the server's own log. On Render that's **jobtrackr-api → Logs**. The process exits straight away, so the deploy never goes live and the `/api/health` check never passes.

**Error message** (from running `npm start` with the bad URI):

```
Could not connect to MongoDB: querySrv ENODATA _mongodb._tcp.cluster0.abcde.mongodb.net
```

The process then exits with code 1. `[Render log]`

Other versions of the same problem (the first and last are reproduced, the middle two are what MongoDB's driver reports in those cases):

| Mistake in the URI | Message in the log |
| --- | --- |
| wrong cluster host / typo | `querySrv ENODATA _mongodb._tcp.cluster0.abcde.mongodb.net` (or `ENOTFOUND`) |
| wrong username or password | `bad auth : authentication failed` |
| Atlas Network Access doesn't allow Render | a server selection timeout that mentions adding your IP to the Atlas IP access list |
| variable not set at all | `MONGODB_URI is missing from .env` |

**Why it fails cleanly:** `server.js` awaits `connectDB()` before `app.listen()`. If the connection fails it logs the reason and exits with code 1, so the API never runs half-working without a database.

**Fix:** copy the connection string again from **Atlas → Connect → Drivers**, put in the real database user and password (special characters in the password must be URL-encoded, e.g. `@` → `%40`), keep `/jobtrackr` before the `?`, and paste it into Render → Environment → `MONGODB_URI`. Saving the variable redeploys automatically. In Atlas → Network Access, add `0.0.0.0/0`. After that the log shows `MongoDB connected: ...` followed by `JobTrackr API running on ... (production)`, and `GET /api/health` returns `{"status":"ok","database":"connected",...}`. `[Render log]`

---

## 2. `CLIENT_URL` doesn't match the Vercel URL (CORS)

**What I did:** set `CLIENT_URL` on Render to the URL of one specific Vercel deployment (`https://jobtrackr-board-7ae87zpbt-upparikarthik505-8452s-projects.vercel.app`) instead of the production domain people actually open (`https://jobtrackr-board.vercel.app`).

**Where I found it:** the **browser console** on the live site (Chrome DevTools → Console). The app itself only said *"Can't reach the server"*. **The API's request log showed nothing at all** for these requests: the browser's preflight was rejected by CORS before the request reached the logger. An empty log while the browser is clearly sending requests is a strong hint it's CORS.

**Error message** (from `https://jobtrackr-board.vercel.app`):

```
Access to fetch at '<API>/api/auth/login' from origin 'https://jobtrackr-board.vercel.app' has been blocked
by CORS policy: Response to preflight request doesn't pass access control check: No
'Access-Control-Allow-Origin' header is present on the requested resource.
```

In the Network tab the `login` request shows **CORS error** and the `OPTIONS` preflight has no `Access-Control-Allow-Origin` header.

**Why:** the frontend and the API are different origins. Because the request sends JSON and an `Authorization` header, the browser asks the API first (preflight). The API only allows the origins in `CLIENT_URL`, and `https://jobtrackr-board.vercel.app` wasn't one of them, so the browser blocked the real request. Postman and curl still worked, because only browsers enforce CORS.

**Fix:** set `CLIENT_URL=https://jobtrackr-board.vercel.app` on Render: exact scheme (`https`), no path. A trailing slash is stripped by the code, but it's best left off. `CLIENT_URL` now accepts a comma-separated list, so local development can be allowed too: `https://jobtrackr-board.vercel.app,http://localhost:5173`.

---

## 3. Missing `VITE_API_URL` on Vercel

**What I did:** deployed the client to Vercel without setting `VITE_API_URL`.

**Where I found it:** the browser **Network tab** and the login form. The site loaded fine, but logging in failed.

**Error message:**

```
POST https://jobtrackr-board.vercel.app/auth/login  405 (Method Not Allowed)
```

and the login form showed *"Something went wrong (405)"*.

**Why:** with no `VITE_API_URL`, Axios has no `baseURL`, so `/auth/login` is sent to the **frontend's own domain**. Vercel only serves static files there and answers a `POST` with 405. The request never reached Render.

The tricky part is that **Vite reads `VITE_*` variables at build time** and bakes them into the JavaScript bundle. Adding the variable in Vercel does nothing until the site is **built again**.

**Fix:**
1. Vercel → jobtrackr-board → **Settings → Environment Variables** → add `VITE_API_URL = https://<render-app>.onrender.com/api` (Production).
2. **Deployments → ⋯ → Redeploy** so the new build includes it.

I also made the app fail with a clear message if this happens again. If `VITE_API_URL` is empty, the console logs `VITE_API_URL is not set. Add it in Vercel → Settings → Environment Variables, then redeploy.` and the form shows *"The app is not configured: VITE_API_URL is missing."* instead of a confusing 405.

---

## Other things I fixed while deploying

- **Vercel built from the wrong folder:** after moving the frontend into `client/`, the first Vercel build from GitHub failed with `Command "npm install" exited with 254` (`ENOENT`). Vercel was running `npm install` in the repo root, which has no `package.json` anymore. Fixed by setting **Root Directory = `client`** in the Vercel project settings, then redeploying.
- **Rate limit shared by everyone:** on Render, every request comes through Render's proxy, so `req.ip` was the proxy's IP. All users would have shared one "5 login attempts per 15 minutes" limit. Fixed with `app.set('trust proxy', 1)` in production, so `express-rate-limit` uses the real client IP from `X-Forwarded-For`.
- **Cold starts:** Render's free tier sleeps after ~15 minutes idle, and the first request can take 30–50 seconds. The Axios timeout was 15 s, so the first visit could fail. I raised it to 60 s and the loading screen now says the free server may take up to a minute.
- **Refreshing a page:** without `client/vercel.json`, refreshing `/applications/12` on Vercel gave Vercel's own 404, because there's no such file. The rewrite sends every path to `/index.html` and React Router handles it. I checked it on the live site: `/applications/12` loads the app (and shows the app's own "page doesn't exist" screen).

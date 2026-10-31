# VanshLink — Connecting generations

A responsive family history website built as two npm workspace packages:

- `client` — React and Vite website
- `server` — Express and MongoDB API

The root package only coordinates development, builds, tests, and production startup.

## Requirements

- Node.js 20 or newer
- MongoDB Community Server, MongoDB Atlas, or another MongoDB-compatible URI

## Run locally

1. Install packages: `npm install`
2. Copy `server/.env.example` to `server/.env` and set `MONGODB_URI`.
3. Run both packages with `npm run dev`.
4. Open the URL printed by Vite, usually `http://localhost:5173`.

You can also run the packages independently:

```sh
npm run dev:server
npm run dev:client
```

The frontend proxy forwards `/api` calls to Express on port 4000. MongoDB stores accounts, secure sessions, people, family links, layouts, and manually arranged node positions. If the database cannot be reached, the sign-in page shows the account service as unavailable instead of exposing cached family data.

## Production

Set `MONGODB_URI` and `PORT` in the deployment environment, then run:

```sh
npm install
npm run build
npm start
```

The root build command creates `client/dist`. Express can serve that build along with `/api` routes, so a single-service deployment still works.

The packages can also be deployed separately:

- Deploy `client` as a static Vite application. Set `VITE_API_URL` to the public server origin, such as `https://api.example.com`.
- Deploy `server` as a Node service. Set `MONGODB_URI` and optionally `PORT`.

Keep the MongoDB URI private and use a database account limited to the app's database.

## Data model

Person records include first, last, and maiden names; gender; birth and death dates; birthplace; photo URL; occupation; biography; private notes; parent and partner references; and tree coordinates. A person can have up to two parents. Partner links are maintained in both directions. Deleting a person removes links to that record from other people.

## API

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/health` | API and MongoDB connection status |
| GET | `/api/people` | List family members |
| GET | `/api/people/:id` | Get one member |
| POST | `/api/people` | Create a member |
| PATCH | `/api/people/:id` | Update details and relationships |
| DELETE | `/api/people/:id` | Delete a member and clean up references |

Each account has a private family tree. Family image fields currently accept image URLs; local image uploads still require an object-storage provider.

## Authentication

VanshLink supports account creation and sign-in with either an email/username and password or Google. Passwords are hashed with scrypt. Login sessions use random, server-stored tokens in `HttpOnly` cookies, and state-changing API requests require a per-session CSRF token.

The first account created becomes the archive owner and automatically claims existing family records that predate authentication. Later accounts receive separate private trees. People, layouts, imports, and relationship updates are all scoped to the signed-in account.

To enable Google sign-in:

1. Create a Web application OAuth client in Google Cloud Console.
2. Add `http://localhost:5173` and each deployed frontend URL to Authorized JavaScript origins.
3. Set `GOOGLE_CLIENT_ID` in the API environment to the Web client ID.

For a same-origin production deployment, keep `COOKIE_SAME_SITE=lax`. If the static frontend and API are hosted on different sites, set `CLIENT_ORIGIN` to the exact frontend origin (scheme and host, without a path), `COOKIE_SAME_SITE=none`, and `COOKIE_SECURE=true`. Cross-site session cookies are automatically marked `Partitioned` so browsers can keep them isolated to the frontend site. Multiple allowed frontend origins can be comma-separated in `CLIENT_ORIGIN`.

Authentication environment variables are documented in `server/.env.example`. Never expose `MONGODB_URI` through Vite or commit a real `.env` file.

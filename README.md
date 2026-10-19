# Kinfolk family archive

A responsive family history website built with React, SVG, Express, MongoDB, and JavaScript. It includes a data-driven, zoomable and draggable family tree, live parent and partner connectors, member profiles, search, member create/edit/delete, and light and dark themes.

## Requirements

- Node.js 20 or newer
- MongoDB Community Server, MongoDB Atlas, or another MongoDB-compatible URI

## Run locally

1. Install packages: `npm install`
2. Copy `.env.example` to `.env` and set `MONGODB_URI`.
3. Start the API: `npm run server`.
4. In another terminal, start the website: `npm run dev`.
5. Open the URL printed by Vite, usually `http://localhost:5173`.

The frontend proxy forwards `/api` calls to Express on port 4000. If no MongoDB URI is configured, the app opens in demo mode with sample family records saved in the browser. When a URI is configured, MongoDB is the source of truth; if the database cannot be reached, the app shows an unavailable state instead of loading sample records. People, family links, and manually arranged node positions are stored in MongoDB.

## Production

Set `MONGODB_URI` and `PORT` in the deployment environment, then run:

```sh
npm install
npm run build
npm start
```

Express serves the generated `dist` website and the `/api` routes from one service. Keep the MongoDB URI private and use a database account limited to the app's database.

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

The site currently manages one family tree per deployment. Family image fields accept image URLs; local image uploads and family account/invitation management require a storage and authentication provider.

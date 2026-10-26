# Stringed Dreams — Backend API

Express + MongoDB API for the Stringed Dreams handcrafted-jewelry showcase: products and categories, favorites, personal collections (playlists), customer chat, and an admin API. The React storefront lives in the [Stringed-Dreams-frontend](https://github.com/Varun3124/Stringed-Dreams-frontend) repo.

## Tech stack
- Node.js (>= 20), Express 4
- MongoDB + Mongoose 8
- JWT auth + bcryptjs
- Nodemailer (inquiry emails)
- cors, compression, dotenv

## Setup

```bash
npm install
cp .env.example .env   # then fill in the values
npm run dev            # nodemon; `npm start` for production
```

### Environment variables (`.env`)

| Variable | Required | Notes |
|---|---|---|
| `MONGODB_URI` | yes | MongoDB connection string |
| `JWT_SECRET` | yes | Secret used to sign auth tokens |
| `PORT` | no | Defaults to `5000` |
| `NODE_ENV` | no | `production` turns off per-request logging |
| `MONGODB_URI_TEST` | tests only | Database for the integration tests; they are skipped when unset |
| `FRONTEND_URL` | recommended | Allowed CORS origin (defaults to `http://localhost:3000`) |
| `JSON_BODY_LIMIT` | no | Max JSON body size for base64 image uploads (default `12mb`) |
| `MAX_IMAGE_BYTES` / `MAX_TOTAL_BYTES` | no | Bulk-import size limits per image / per batch |
| `SMTP_USER` / `SMTP_PASS` | for emails | SMTP login. For Gmail, use a Google App Password. Inquiry emails are off until both are set. |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` | no | Default to `smtp.gmail.com`, port `465`, secure (TLS) |
| `EMAIL_FROM` | no | Sender, e.g. `Stringed Dreams <you@gmail.com>` (defaults to `SMTP_USER`) |
| `ADMIN_EMAILS` | no | Extra comma-separated recipients; every admin account is always included |

## Testing

```bash
npm run lint              # ESLint
npm test                  # unit + API tests (no database needed); DB tests are skipped
npm run test:coverage     # same, with a coverage report in coverage/

# Integration tests against a real MongoDB
docker compose up -d mongo
MONGODB_URI_TEST=mongodb://localhost:27017/stringed-dreams-test npm run test:integration
```

`app.js` builds the Express app and `server.js` connects to MongoDB and starts listening, so tests can load the app without a server or database.

## Docker

```bash
docker compose up --build                  # MongoDB + API on http://localhost:5000
docker compose --profile full up --build   # + the React frontend on http://localhost:3000
docker compose down                        # stop (add -v to also delete the database volume)
```

The `full` profile builds `../stringed-dreams-frontend`, so clone both repos side by side.

The `Dockerfile` has three stages: `deps` (production dependencies only), `test` (`docker build --target test .` runs lint and unit tests) and `runtime` (Node 22 Alpine, non-root user, health check on `/api/health`).

## Health check

`GET /api/health` returns `200` with `{ status: "ok", db: "connected", uptime, timestamp, version }` when MongoDB is connected and `503` otherwise. `version` is the deployed commit. On `SIGTERM`/`SIGINT` the server stops accepting connections, finishes in-flight requests and closes MongoDB before exiting.

## CI/CD

`.github/workflows/ci-cd.yml` runs on every push and pull request to `main`:

1. **Lint**: ESLint
2. **Test**: Jest + Supertest against a MongoDB service container, with a coverage report
3. **Docker**: builds the image, starts it next to MongoDB and checks `/api/health`; on `main` pushes it to `ghcr.io/varun3124/stringed-dreams-backend`
4. **Deploy** (`main` pushes only): triggers the Render deploy hook (`RENDER_DEPLOY_HOOK` secret), then waits until `BACKEND_URL/api/health` reports the new commit

Pull requests run steps 1–3 and never deploy. Dependabot opens weekly update PRs for npm packages, Actions and the Docker base image.

## Inquiry emails
When a customer starts a conversation or sends a message, every admin account (plus `ADMIN_EMAILS`) gets an email. It contains the message, the customer's email and phone, any referenced product or collection with a link, and a link to the dashboard. Replying to the email writes to the customer directly.

To avoid flooding inboxes, admins get **one email per unread stretch**. After the first new message, no more emails go out until an admin opens, replies to or resolves the conversation; the next customer message after that sends a new one. Emails are sent in the background, so a slow or failing mail server never delays the customer.

## Startup tasks
On every start, after connecting, the server runs these idempotent maintenance steps (see `config/db.js`). A second run changes nothing.
- **List fields:** `color` and `beadType` used to be single (comma-separated) strings. Any such values are converted to arrays, e.g. `"Blue, Red"` becomes `["Blue", "Red"]`.
- **Image versions:** products without an `imageVersion` get one, so their image URLs can be cached.
- **Favorites cleanup:** favorites used to store a copy of each product's image. Those copies are removed.
- **Likes:** each product's `likesCount` is recalculated from favorites.

## Images
Product images are stored in MongoDB as data URLs but are **never sent inline in JSON**. Every product response carries an `image` URL instead:

```
/api/products/:id/image?v=<imageVersion>
```

- The version changes whenever the image changes, so the endpoint can send `Cache-Control: public, max-age=31536000, immutable`.
- External `http(s)` image URLs are passed through unchanged (the endpoint redirects to them).
- Missing or placeholder images get a built-in SVG placeholder.
- The path is relative to the API origin; the frontend prefixes it with `REACT_APP_API_URL`.

List endpoints leave out `image` and `reviews`, and public GETs send `Cache-Control: no-cache` with an ETag, so unchanged data comes back as a 304.

## API overview
Base path: `/api`

**Auth**
- `POST /auth/register`, `POST /auth/login`
- `GET /auth/profile`, `PUT /auth/profile` (auth)

**Products (public)**
- `GET /products`. Query parameters: `keyword`, `category`, `minPrice`, `maxPrice`, `sort` (`price-asc`, `price-desc` or `rating`). The price filters and sorts use `discountPrice`.
- `GET /products/categories`
- `GET /products/:id`
- `GET /products/:id/image`
- `POST /products/:id/reviews` (auth)

**Favorites (auth)**
- `GET /favorites`, `POST /favorites`, `POST /favorites/toggle`
- `DELETE /favorites/:itemId`, `DELETE /favorites`

**Collections / playlists (auth)**
- `GET /playlists`, `POST /playlists`
- `GET /playlists/:id`. Owners can always read; so can admins (so chat references open) and anyone, for public playlists.
- `PUT /playlists/:id`, `DELETE /playlists/:id`
- `POST /playlists/:id/items`, `DELETE /playlists/:id/items/:productId`

**Contact / chat**
- For users (auth): `GET /contact/chat`, `POST /contact`, `GET /contact/my`, `GET /contact/:id`, `POST /contact/:id/messages`
- Admin: `GET /contact`, `PUT /contact/:id`, `DELETE /contact/:id`

**Admin (auth + admin role)**
- `GET /admin/products` and `POST /admin/products`. Every field is optional: price and stock default to 0, and category to none. `discountPrice` defaults to the price; a value above the price (or a negative or non-numeric one) is rejected with a 400.
- `PUT /admin/products/reorder` takes `{ products: [{ id, displayOrder }] }` and runs as a single bulk write.
- `POST /admin/products/bulk` creates one product per image and returns the created products.
- `PUT /admin/products/bulk-update` takes `{ updates: [{ id, changes }] }` from the admin multi-select. Only `color`, `beadType`, `price`, `discountPrice`, `stock` and `featuredInCarousel` are applied, with the same discount rules as a single update. Every entry is validated first; any invalid one returns a 400 and nothing is written.
- `POST /admin/products/:id/duplicate`
- `DELETE /admin/products/:id` returns the deleted document (image and reviews included) as `product`, and `POST /admin/products/restore` with `{ product }` puts it back with the same id. The admin page uses the pair to undo deletes; 409 if the product already exists.
- `PUT /admin/products/:id`, `PUT /admin/products/:id/carousel`. When only `price` is updated, `discountPrice` follows it unless the product has a discount that is still below the new price; sending `discountPrice: ""` removes the discount.
- `GET /admin/categories`, `POST /admin/categories`. Categories are returned in `displayOrder` (ties by creation order, never by name); new ones go after the last one, and editing a name or description keeps the position. At startup, categories that share a position are numbered once, keeping any dragged order and otherwise creation order.
- `POST /admin/categories/restore` takes `{ _id, name, description, displayOrder }` and recreates a deleted category with the same id (409 if the id or name is taken).
- `PUT /admin/categories/reorder` takes `{ categories: [{ id, displayOrder }] }` and runs as a single bulk write. The public `GET /products/categories` uses the same order.
- `PUT /admin/categories/:id`. Renaming a category moves its products to the new name.
- `DELETE /admin/categories/:id` is refused while products still use the category.

## Data models
- `User`: name, email, password (hashed), role (`user` or `admin`), phone
- `Product`:
  - name, description, price, discountPrice, category, stock
  - `color: [String]` and `beadType: [String]`
  - image and `imageVersion`
  - rating, reviews and likesCount
  - carousel and display-order fields
- `Category`: name (unique), description, displayOrder
- `Favorite`: one document per user listing product references
- `Playlist`: a user-owned collection of product references
- `Contact`: a chat thread whose messages can reference a product or a collection

## Make a user an admin

```javascript
db.users.updateOne({ email: "admin@example.com" }, { $set: { role: "admin" } })
```

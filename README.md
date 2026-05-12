# Meal Planner

Personal meal planning app for managing a weekly meal schedule, dish library, fridge/freezer stock, and calorie history. Designed for local network use on mobile.

## Features

- **Week view** — plan breakfast, lunch, dinner and snacks per day; track daily calories against a goal with colour-coded totals (green / yellow / red)
- **Dish library** — add and manage dishes with calories, servings, meal types and an optional barcode; sort and filter the list
- **Barcode scanner** — scan a product barcode to add it straight to the fridge, or assign it to a dish for future scans
- **Fridge / freezer** — track cooked portions; move items between fridge and freezer; portions are deducted automatically when assigned to the plan
- **History** — bar chart of daily calorie totals for the past month; click a bar to see the meal breakdown for that day
- **Backup** — export and import the full dataset as JSON

## Stack

- **Frontend** — React 18, Vite 6
- **Backend** — Node.js (stdlib only), flat `data.json` for persistence
- **Barcode scanning** — `@zxing/browser` via device camera

## Development

```bash
npm install
npm run dev       # Vite on :5173 + API server on :3001
```

Access on the same machine via `http://localhost:3001`.

## Production build

```bash
npm run build     # outputs to dist/
npm start         # serves dist/ + API on :3001
```

## HTTPS (required for camera on mobile)

Camera access requires a secure context. For local network use, generate a trusted certificate with [mkcert](https://github.com/FiloSottile/mkcert).

**On the PC (run as administrator):**

```powershell
# Install mkcert and create the local CA
mkcert -install

# Generate a certificate for your local IP (replace with your actual IP)
cd path\to\project
mkcert -cert-file certs\cert.pem -key-file certs\key.pem 192.168.1.100 localhost 127.0.0.1
```

**On the phone (Android):**

1. Find the CA file: run `mkcert -CAROOT` — the file is `rootCA.pem` in that folder
2. Transfer `rootCA.pem` to the phone (WhatsApp, email, etc.)
3. Install it: Settings → Security → Encryption & credentials → Install a certificate → CA certificate

The server automatically detects `certs/cert.pem` and `certs/key.pem` and switches to HTTPS. Without the files it falls back to HTTP.

## Docker

```yaml
services:
  mealplanner:
    build:
      context: /path/to/Meal-Planner
      dockerfile: Dockerfile
    container_name: mealplanner
    restart: unless-stopped
    ports:
      - "3000:3001"
    volumes:
      - ./data.json:/app/data.json
      - ./certs:/app/certs
```

Place `cert.pem` and `key.pem` in a `certs/` folder next to `docker-compose.yml`. The `data.json` volume persists the database between container restarts.

```bash
docker compose up --build
```

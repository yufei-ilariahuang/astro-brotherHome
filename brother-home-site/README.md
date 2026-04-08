# Brother Home Site

Astro website for Brother Home.

## Online Editing (Decap CMS)

This project now includes Decap CMS at `/admin` so a client can add/edit products and upload images in the browser.

### 1) Local test

From this folder:

```sh
npm install
npm run dev
npx decap-server
```

Then open:

- `http://localhost:4321/admin`

### 2) Production setup

Edit `public/admin/config.yml`:

- Set `backend.repo` to your real GitHub repo (`owner/repo`)
- Confirm `backend.branch` (for example `main`)

You also need GitHub authentication for Decap:

- Option A: Use Netlify Identity + Git Gateway
- Option B: Use GitHub OAuth app/proxy for Decap

After backend auth is configured, client can log in at `/admin`, add/edit products, upload images, and publish.

### 3) Where uploads go

- Uploaded files are saved to `public/uploads`
- Product content is stored in `src/content/products`

## Commands

- `npm install` install dependencies
- `npm run dev` start dev server
- `npm run build` production build
- `npm run preview` preview production build

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

## Netlify Identity (Login / Registration)

This project includes a small client UI (`src/components/AuthButtons.astro`) that uses the Netlify Identity widget to provide sign-in / register controls and a link to the admin CMS.

To enable login/registration in production on Netlify:

- Go to your site dashboard on Netlify -> Identity -> "Enable Identity".
- In Identity settings enable "Git Gateway" (if you want Decap/Netlify CMS to commit via Git Gateway).
- Optionally enable "Open registration" if you want users to sign up without an invite.

Local development:

```bash
# from brother-home-site/
npm install
npm run dev
# start Decap CMS local backend (if you want to test /admin locally)
npx decap-server
# for identity endpoints locally use `netlify dev` (Netlify CLI)
# `netlify dev` will proxy Identity endpoints and Git Gateway
```

Notes:
- The widget script is loaded from `https://identity.netlify.com/v1/netlify-identity-widget.js` by `AuthButtons.astro`.
- You must enable Identity and Git Gateway in the Netlify dashboard — this cannot be done from code alone.
- After enabling Identity, visiting `/admin` allows logging in and editing via the CMS.


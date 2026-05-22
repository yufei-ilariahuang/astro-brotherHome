#!/usr/bin/env node
import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import simpleGit from 'simple-git';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.UPLOADER_PORT || 4000;

const repoRoot = path.resolve(__dirname, '..');
const uploadsDir = path.join(repoRoot, 'public', 'uploads');
const productsDir = path.join(repoRoot, 'src', 'content', 'products');

const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      await fs.mkdir(uploadsDir, { recursive: true });
      cb(null, uploadsDir);
    } catch (err) {
      cb(err);
    }
  },
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '-');
    cb(null, `${Date.now()}-${safeName}`);
  }
});

const upload = multer({ storage });
const git = simpleGit(repoRoot);

function slugify(str) {
  return String(str)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

app.get('/', (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(`
    <h2>Local Product Uploader</h2>
    <form method="post" enctype="multipart/form-data" action="/upload">
      <label>Title: <input name="title" required></label><br>
      <label>Category (slug): <input name="category" placeholder="kitchen-cabinets" required></label><br>
      <label>Image: <input type="file" name="image" accept="image/*" required></label><br>
      <button type="submit">Upload & Create Product</button>
    </form>
    <p>After submit this server will save the image to <code>/public/uploads</code>, create a product markdown in <code>src/content/products</code>, commit and push to origin/main.</p>
  `);
});

app.post('/upload', upload.single('image'), async (req, res) => {
  try {
    const { title, category } = req.body;
    if (!title || !category || !req.file) {
      return res.status(400).json({ error: 'title, category and image are required' });
    }

    const filename = path.basename(req.file.filename);
    const imagePath = `/uploads/${filename}`;

    const slug = slugify(title);
    const productFile = path.join(productsDir, `${slug}.md`);

    const frontmatter = `title: ${title}\ncategory: ${category}\nimage: ${imagePath}\nstatus: available\ndraft: false\n`;

    await fs.mkdir(productsDir, { recursive: true });
    await fs.writeFile(productFile, frontmatter, 'utf8');

    // Git add, commit, push
    await git.add([path.relative(repoRoot, path.join('public', 'uploads', filename)), path.relative(repoRoot, path.join('src', 'content', 'products', `${slug}.md`))]);
    await git.commit(`Add product ${title} and image ${filename}`);
    await git.push('origin', 'main');

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(`<p>Success: created ${productFile} and uploaded ${filename}.</p><p><a href="/">Upload another</a></p>`);
  } catch (err) {
    console.error('Upload error', err);
    res.status(500).json({ error: String(err) });
  }
});

app.listen(PORT, () => {
  console.log(`Local uploader running at http://localhost:${PORT}/`);
  console.log('Make sure you have git credentials configured to push to origin/main.');
});

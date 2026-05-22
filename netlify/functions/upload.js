// Use global fetch (available in Node 18+ and Netlify runtime)
// Buffer is available globally

const GITHUB_OWNER = 'yufei-ilariahuang';
const GITHUB_REPO = 'astro-brotherHome';
const GITHUB_BRANCH = 'main';
const PRODUCTS_DIR = 'brother-home-site/src/content/products';
const UPLOADS_DIR = 'brother-home-site/public/uploads';
const ALLOWED_CATEGORIES = [
  'kitchen-cabinets',
  'hardwood-laminate-flooring',
  'quartz-countertops',
  'bathroom-vanities',
  'shower-doors',
  'shower-doors-enclosures',
  'sinks-and-pulls',
  'sinks-basins',
  'cabinet-hardware-pulls',
  'custom-walk-in-closets',
  'storage-cabinets',
  'pantry-storage',
];

function slugify(str) {
  return String(str)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function yamlString(value) {
  return `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`;
}

function parseFrontmatterValue(content, key) {
  const match = content.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
  if (!match) return null;
  return match[1].trim().replace(/^"|"$/g, '');
}

async function getGitHubRef(token) {
  const res = await fetch(
    `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/refs/heads/${GITHUB_BRANCH}`,
    { headers: { Authorization: `token ${token}` } }
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to get ref: ${res.status} ${body}`);
  }
  return res.json();
}

async function getGitHubTree(token, sha) {
  const res = await fetch(
    `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/trees/${sha}`,
    { headers: { Authorization: `token ${token}` } }
  );
  if (!res.ok) throw new Error(`Failed to get tree: ${res.status}`);
  return res.json();
}

async function getGitHubContents(token, path) {
  const res = await fetch(
    `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${encodeURIComponent(path)}?ref=${GITHUB_BRANCH}`,
    {
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github+json',
      },
    }
  );

  if (res.status === 404) return null;
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to get contents for ${path}: ${res.status} ${body}`);
  }

  return res.json();
}

async function createGitHubBlob(token, imageBuffer) {
  const base64 = imageBuffer.toString('base64');
  const res = await fetch(
    `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/blobs`,
    {
      method: 'POST',
      headers: {
        Authorization: `token ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: base64,
        encoding: 'base64',
      }),
    }
  );
  if (!res.ok) throw new Error(`Failed to create blob: ${res.status}`);
  return res.json();
}

async function createGitHubTree(token, baseTree, files) {
  const res = await fetch(
    `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/trees`,
    {
      method: 'POST',
      headers: {
        Authorization: `token ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        base_tree: baseTree,
        tree: files,
      }),
    }
  );
  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Failed to create tree: ${JSON.stringify(err)}`);
  }
  return res.json();
}

async function createGitHubCommit(token, treeSha, parentSha, message) {
  const res = await fetch(
    `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/commits`,
    {
      method: 'POST',
      headers: {
        Authorization: `token ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        tree: treeSha,
        parents: [parentSha],
      }),
    }
  );
  if (!res.ok) throw new Error(`Failed to create commit: ${res.status}`);
  return res.json();
}

async function updateGitHubRef(token, commitSha) {
  const res = await fetch(
    `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/refs/heads/${GITHUB_BRANCH}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `token ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sha: commitSha,
      }),
    }
  );
  if (!res.ok) throw new Error(`Failed to update ref: ${res.status}`);
  return res.json();
}

async function listProducts(token) {
  const dir = await getGitHubContents(token, PRODUCTS_DIR);
  if (!Array.isArray(dir)) return [];

  return dir
    .filter((entry) => entry.type === 'file' && entry.name.endsWith('.md'))
    .filter((entry) => !['.gitkeep', '_placeholder.md'].includes(entry.name))
    .map((entry) => {
      const slug = entry.name.replace(/\.md$/, '');
      return { slug, file: entry.path };
    })
    .sort((a, b) => a.slug.localeCompare(b.slug));
}

export default async (req, context) => {
  console.log('Upload function called, method:', req.method);

  try {
    const token = process.env.GITHUB_TOKEN;
    console.log('GITHUB_TOKEN env var set:', !!token);
    
    if (!token) {
      return new Response(
        JSON.stringify({ error: 'GITHUB_TOKEN not configured in Netlify env vars' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (req.method === 'GET') {
      const url = new URL(req.url);
      const action = url.searchParams.get('action');

      if (action === 'list') {
        const products = await listProducts(token);
        return new Response(
          JSON.stringify({ success: true, products }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ error: 'Invalid action for GET' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const formData = await req.formData();
    const action = String(formData.get('action') || 'upload');
    const title = formData.get('title');
    const category = formData.get('category');
    const imageFile = formData.get('image');
    const sku = formData.get('sku');
    const description = formData.get('description');
    const price = formData.get('price');
    const dimensions = formData.get('dimensions');
    const deleteSlug = formData.get('slug');
    const deleteImage = String(formData.get('deleteImage') || 'false') === 'true';

    console.log('Form data received:', { action, title, category, hasImage: !!imageFile, deleteSlug, deleteImage });

    if (action === 'list') {
      const products = await listProducts(token);
      return new Response(
        JSON.stringify({ success: true, products }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'delete') {
      if (typeof deleteSlug !== 'string' || !deleteSlug.trim()) {
        return new Response(
          JSON.stringify({ error: 'Missing slug for delete' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const safeSlug = slugify(deleteSlug);
      const productPath = `${PRODUCTS_DIR}/${safeSlug}.md`;
      const productFile = await getGitHubContents(token, productPath);

      if (!productFile || !productFile.content) {
        return new Response(
          JSON.stringify({ error: `Product not found: ${safeSlug}` }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const productContent = Buffer.from(productFile.content, 'base64').toString('utf8');
      const imageValue = parseFrontmatterValue(productContent, 'image');
      const deleteEntries = [
        {
          path: productPath,
          mode: '100644',
          type: 'blob',
          sha: null,
        },
      ];

      if (deleteImage && imageValue && imageValue.startsWith('/uploads/')) {
        deleteEntries.push({
          path: `${UPLOADS_DIR}/${imageValue.replace('/uploads/', '')}`,
          mode: '100644',
          type: 'blob',
          sha: null,
        });
      }

      const ref = await getGitHubRef(token);
      const parentSha = ref.object.sha;
      const tree = await createGitHubTree(token, parentSha, deleteEntries);
      const commit = await createGitHubCommit(
        token,
        tree.sha,
        parentSha,
        `Delete product: ${safeSlug}${deleteImage ? ' and image' : ''}`
      );
      await updateGitHubRef(token, commit.sha);

      return new Response(
        JSON.stringify({
          success: true,
          message: `Deleted product: ${safeSlug}${deleteImage ? ' and its image' : ''}`,
          slug: safeSlug,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (action !== 'upload') {
      return new Response(
        JSON.stringify({ error: 'Invalid action' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate required fields
    if (typeof title !== 'string' || !title.trim()) {
      return new Response(
        JSON.stringify({ error: 'Invalid title' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!imageFile) {
      return new Response(
        JSON.stringify({ error: 'Missing image' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Allowed categories must match the site's collection schema
    if (typeof category !== 'string' || !ALLOWED_CATEGORIES.includes(category)) {
      return new Response(
        JSON.stringify({ error: `Invalid category. Allowed: ${ALLOWED_CATEGORIES.join(', ')}` }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const imageBuffer = Buffer.from(await imageFile.arrayBuffer());
    const timestamp = Date.now();
    const filename = `${timestamp}-${imageFile.name.replace(/[^a-zA-Z0-9._-]/g, '-')}`;
    const imagePath = `${UPLOADS_DIR}/${filename}`;
    const slug = slugify(title);
    const productPath = `${PRODUCTS_DIR}/${slug}.md`;

    const frontmatterLines = [
      '---',
      `title: ${yamlString(title.trim())}`,
      `category: ${category}`,
      `image: /uploads/${filename}`,
      'status: available',
      'draft: false',
    ];

    if (typeof sku === 'string' && sku.trim()) {
      frontmatterLines.push(`sku: ${yamlString(sku.trim())}`);
    }
    if (typeof description === 'string' && description.trim()) {
      frontmatterLines.push(`description: ${yamlString(description.trim())}`);
      frontmatterLines.push(`descriptionEn: ${yamlString(description.trim())}`);
    }
    if (typeof price === 'string' && price.trim()) {
      frontmatterLines.push(`price: ${yamlString(price.trim())}`);
    }
    if (typeof dimensions === 'string' && dimensions.trim()) {
      frontmatterLines.push(`dimensions: ${yamlString(dimensions.trim())}`);
    }

    frontmatterLines.push('---', '');
    const frontmatter = frontmatterLines.join('\n');

    // 1. Get current ref
    console.log('Getting current ref...');
    const ref = await getGitHubRef(token);
    const parentSha = ref.object.sha;
    console.log('Parent SHA:', parentSha);

    // 2. Create blob for image
    console.log('Creating image blob...');
    const imageBlob = await createGitHubBlob(token, imageBuffer);
    console.log('Image blob SHA:', imageBlob.sha);

    // 3. Create tree with both image and product markdown
    console.log('Creating tree...');
    const tree = await createGitHubTree(token, parentSha, [
      {
        path: imagePath,
        mode: '100644',
        type: 'blob',
        sha: imageBlob.sha,
      },
      {
        path: productPath,
        mode: '100644',
        type: 'blob',
        content: frontmatter,
      },
    ]);
    console.log('Tree SHA:', tree.sha);

    // 4. Create commit
    console.log('Creating commit...');
    const commit = await createGitHubCommit(
      token,
      tree.sha,
      parentSha,
      `Add product: ${title} + image ${filename}`
    );
    console.log('Commit SHA:', commit.sha);

    // 5. Update ref to point to new commit
    console.log('Updating ref...');
    await updateGitHubRef(token, commit.sha);
    console.log('Ref updated successfully');

    return new Response(
      JSON.stringify({
        success: true,
        message: `Product "${title}" uploaded. Image: ${filename}. Will deploy in a few seconds.`,
        productPath,
        imagePath,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Upload error:', err);
    return new Response(
      JSON.stringify({ error: String(err.message || err) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

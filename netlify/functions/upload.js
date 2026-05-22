// Use global fetch (available in Node 18+ and Netlify runtime)
// Buffer is available globally

const GITHUB_OWNER = 'yufei-ilariahuang';
const GITHUB_REPO = 'astro-brotherHome';
const GITHUB_BRANCH = 'main';

function slugify(str) {
  return String(str)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
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

export default async (req, context) => {
  console.log('Upload function called, method:', req.method);
  
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { 
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const token = process.env.GITHUB_TOKEN;
    console.log('GITHUB_TOKEN env var set:', !!token);
    
    if (!token) {
      return new Response(
        JSON.stringify({ error: 'GITHUB_TOKEN not configured in Netlify env vars' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const formData = await req.formData();
    const title = formData.get('title');
    const category = formData.get('category');
    const imageFile = formData.get('image');

    console.log('Form data received:', { title, category, hasImage: !!imageFile });

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
    const allowedCategories = [
      'kitchen-cabinets','hardwood-laminate-flooring','quartz-countertops','bathroom-vanities','shower-doors','shower-doors-enclosures','sinks-and-pulls','sinks-basins','cabinet-hardware-pulls','custom-walk-in-closets','storage-cabinets','pantry-storage'
    ];

    if (typeof category !== 'string' || !allowedCategories.includes(category)) {
      return new Response(
        JSON.stringify({ error: `Invalid category. Allowed: ${allowedCategories.join(', ')}` }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const imageBuffer = Buffer.from(await imageFile.arrayBuffer());
    const timestamp = Date.now();
    const filename = `${timestamp}-${imageFile.name.replace(/[^a-zA-Z0-9._-]/g, '-')}`;
    const imagePath = `brother-home-site/public/uploads/${filename}`;
    const slug = slugify(title);
    const productPath = `brother-home-site/src/content/products/${slug}.md`;    const frontmatter = `title: ${title}\ncategory: ${category}\nimage: /uploads/${filename}\nstatus: available\ndraft: false\n`;

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

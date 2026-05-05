const express = require('express');
const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;
const TEAM_PASSWORD = process.env.TEAM_PASSWORD || 'channelip';

// ============================================
// Database
// ============================================
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('render.com')
    ? { rejectUnauthorized: false }
    : false,
});

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS votes (
      item_id TEXT NOT NULL,
      voter_name TEXT NOT NULL,
      vote TEXT,
      comment TEXT,
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (item_id, voter_name)
    );
  `);
  console.log('DB ready');
}

// ============================================
// Items (with embedded base64 images at startup)
// ============================================
const ITEMS_RAW = [
  { id: "frank-green-595ml", brand: "Frank Green", category: "Drinkware", name: "Customisable Ceramic Reusable Bottle 20oz / 595ml", price: "$54.95 AUD", image: "frank_green.png", link: "https://frankgreen.com.au/products/customisable-ceramic-reusable-bottle-20oz-595ml", notes: "Premium, multi-award-winning Australian brand. Triple-wall vacuum insulated, ceramic-lined, fits car cup holders. Strong everyday-use anchor item — the kind of thing that lives on a desk or in a car for years." },
  { id: "yeti-rambler-26oz", brand: "YETI", category: "Drinkware", name: "Rambler 26oz Bottle (Navy) — Vacuum Insulated, Stainless Steel", price: "~$80 AUD", image: "yeti_rambler.png", link: "https://www.amazon.com.au/YETI-Rambler-Insulated-Stainless-Matching/dp/B0CTTWP5LB", notes: "Iconic premium drinkware brand with global recognition. Heavier, more rugged read than Frank Green — better fit for tradies. Direct alternative to Frank Green; team should pick one." },
  { id: "momax-powerbank", brand: "MOMAX", category: "Tech", name: "1-Power Mini 3-in-1 Power Bank 5000mAh", price: "~$60 AUD", image: "momax_powerbank.png", link: "https://www.momax.net/products/1-power-mini-3-in-1-power-bank-5000mah", notes: "Echoes Michael's reference to the Aston Martin/Xerox Grand Prix branded power bank he loved. Compact, premium, daily-use — high brand-visibility potential if branded." },
  { id: "ugreen-revodok-1071", brand: "UGREEN", category: "Tech", name: "Revodok 1071 USB-C Hub — 7-in-1 with SD/TF Reader", price: "~$50 AUD", image: "ugreen_1071.png", link: "https://www.amazon.com.au/UGREEN-Delivery-Multiport-Adapter-MacBook/dp/B0BLNDNBG1", notes: "Compact 7-in-1 hub with SD/microSD card readers — useful for photographers, content creators. Pure utility, sits on the desk every day. Branding execution would matter — laser-etch only." },
  { id: "ugreen-revodok-pro-207", brand: "UGREEN", category: "Tech", name: "Revodok Pro 207 USB-C Docking Station — Dual Monitor", price: "~$130 AUD", image: "ugreen_pro_207.png", link: "https://www.amazon.com.au/UGREEN-USB-C-Docking-Station/dp/B0D1XSKZRJ", notes: "Premium step up — dual monitor support, 100W PD, 10Gbps. Closer to Jamie's 'replicator' vision. Could justify being a single-item hero box on its own." },
  { id: "ugreen-revodok-1061", brand: "UGREEN", category: "Tech", name: "Revodok 1061 USB-C Hub — 6-in-1 with Ethernet", price: "~$45 AUD", image: "ugreen_1061.png", link: "https://www.amazon.com.au/UGREEN-Ethernet-Delivery-Compatible-Chromebook/dp/B0BW2TLQ8S", notes: "Middle option in the UGREEN range. 1Gbps Ethernet, 4K HDMI, 100W PD, 3 USB-A. Solid all-rounder for hybrid workers." },
  { id: "t2-melbourne-breakfast", brand: "T2", category: "Edibles — Tea & Chocolate", name: "Melbourne Breakfast Loose Leaf Tea Cube 100g", price: "$22.00 AUD", image: "t2_tea.png", link: "https://www.t2tea.com/products/melbourne-breakfast-loose-leaf-cube-100g", notes: "T2 has strong recognition. Cube tin is design-forward. Safer crowd-pleaser than French Earl Grey for caffeine drinkers. Good shareable item if it ends up in a school staff room." },
  { id: "haighs-frogs", brand: "Haigh's", category: "Edibles — Tea & Chocolate", name: "Milk Chocolate Frogs Gift Box", price: "~$32 AUD", image: "haighs_frogs.png", link: "https://www.haighschocolates.com.au/milk-chocolate-frogs-gift-box", notes: "Iconic, family-owned, premium Australian chocolatier. Recognisable, broadly liked, gift-format packaging. Schools/shared-office friendly because they're shareable. Limited shelf life is the trade-off." },
  { id: "hunted-gathered-almonds", brand: "Hunted + Gathered", category: "Edibles — Tea & Chocolate", name: "Chocolate Coated Almonds 100g", price: "$18.00 AUD", image: "hg_almonds.png", link: "https://huntedandgathered.com.au/products/chocolate-coated-almonds", notes: "Boutique Melbourne chocolatier. Premium positioning, beautiful minimal packaging, design-led. Reads as 'considered gift' rather than mass-produced." },
  { id: "hunted-gathered-drinking-choc", brand: "Hunted + Gathered", category: "Edibles — Tea & Chocolate", name: "Drinking Chocolate 50% Cacao 250g", price: "~$22 AUD", image: "hg_drinking_choc.png", link: "https://huntedandgathered.com.au/products/drinking-chocolate-50", notes: "Same brand as the almonds — would pair well as a duo. Drinking chocolate is more intimate (something they make at home). Aligns with Frank Green ceramic cup if both are in." },
  { id: "gewurzhaus-furikake", brand: "Gewürzhaus", category: "Edibles — Savoury", name: "Citrus Furikake Spice Blend 40g", price: "~$15 AUD", image: "gewurzhaus.png", link: "https://gewurzhaus.com.au/", notes: "Beautiful Australian spice merchant. Citrus furikake is Japanese-inspired — versatile, low-risk dietary-wise, feels like a genuine 'cook's gift'. Long shelf life. The amber jar is a kitchen display piece." },
  { id: "mountain-goat-pale", brand: "Mountain Goat", category: "Beverages", name: "Tasty Pale Ale 375ml Can", price: "~$6 AUD per can", image: "mountain_goat.png", link: "https://beercartel.com.au/products/mountain-goat-tasty-pale-ale-375ml-can", notes: "WARNING: Michael's brief said no alcohol risk. Dave also flagged this. Including for completeness in case team disagrees. A single nicely-presented can creates real B2B policy/religious risk." },
  { id: "somewhere-co-cutlery", brand: "The Somewhere Co.", category: "Lifestyle", name: "Take Me Away Cutlery Kit — Black with Forest Green Handle", price: "$37.00 AUD", image: "somewhere_co.png", link: "https://thesomewhereco.com/products/cutlery-kit-black-with-forest-green-handle", notes: "7-piece stainless steel kit (knife, fork, spoon, chopsticks, straw, cleaner) in a recycled-plastic case. Functional + sustainability + design-forward. Good for office workers but less relevant for principals/tradies." },
  { id: "alivebody-wash-lotion", brand: "Alive Body", category: "Lifestyle", name: "Wash & Lotion Duo Tray — Coconut & Wild Orange", price: "~$45 AUD", image: "alive_body.png", link: "https://alivebody.com.au/collections/best-sellers/products/wash-lotion-duo-tray-coconut-wild-orange", notes: "Premium hand wash + lotion gift set. Reads thoughtful and personal — fits Michael's 'personal' feeling brief well. Risk: recipient might already have a preferred brand." },
  { id: "rm-williams-cap", brand: "R.M. Williams", category: "Lifestyle", name: "Mini Longhorn Twill Cap — Twill Blue Wash", price: "~$60 AUD", image: "rm_williams_cap.png", link: "https://www.rmwilliams.com.au/mini-longhorn-twill-cap-twill-blue-wash.html", notes: "Iconic Australian brand with broad cross-demographic appeal — works for tradies, principals, professionals. Worn out and about = brand visibility. Sizing/style is personal — risk it doesn't get worn." },
  { id: "loop-experience-2-plus", brand: "Loop", category: "Lifestyle", name: "Experience 2 Plus Ear Plugs — 17dB Noise Reduction", price: "~$55 AUD", image: "loop_earplugs.png", link: "https://www.amazon.com.au/dp/B0D4DS4FC8", notes: "Design-led hearing protection — cult product among concert-goers, parents, focus-workers. Reads thoughtful and modern. Strong 'where did you get those?' factor (Ben's walking-advertisement angle)." },
  { id: "alex-lane-notebook", brand: "Alex & Lane", category: "Stationery", name: "A5 Vegan Leather Notebook (Personalised)", price: "~$45 AUD", image: "alex_lane_notebook.png", link: "https://www.alexalane.com.au/products/a5-vegan-leather-notebook", notes: "Premium-feeling notebook, vegan leather, embossed monogram option. Better-than-Moleskine boutique positioning. Easy to add subtle embossed Channel IP branding." },
  { id: "caran-dache-849-pen", brand: "Caran d'Ache", category: "Stationery", name: "849 Bille Ballpoint Pen — White", price: "~$48 AUD", image: "caran_dache_849.png", link: "https://milligram.com/products/caran-dache-849-bille-ballpoint-pen?variant=46228296564923", notes: "Swiss-made aluminium ballpoint, hexagonal barrel, since 1969. Hits Michael's 'I'd keep that' benchmark. White matches the gift box. Engraving available — could carry subtle Channel IP branding." },
  { id: "boxfox-branding-concept", brand: "Channel IP", category: "Packaging — Branding", name: "Logo + 'Agile Excellence' Tagline (mock-up)", price: "Concept only", image: "branding_mockup.png", link: "", notes: "Vote on the BRANDING approach: Channel IP logo + 'Agile Excellence' italic serif tagline, centred on a clean white surface. Decision is about WHAT goes on the box, not which box. Final artwork would be designer-finished." },
  { id: "boxfox-magnetic-box", brand: "boxfox", category: "Packaging — Box", name: "Hamper Box — Square, Magnetic Closure, Large, Matt White", price: "$24.93 ex GST (~$27.42 inc GST)", image: "boxfox_open.png", link: "https://boxfox.com.au/products/hamper-box-square-magnetic-closure-large-matt-white-custom-print", notes: "Vote on the PHYSICAL BOX style. Australian-made, 36×36×12cm internal. 1250gsm board, fine-emboss matt finish, concealed magnetic closure for premium open-and-close feel. Custom-print available. ~$27 inc GST is roughly 14% of Michael's $200 reference budget." },
];

// Load images at startup and inline as base64 data URIs
// Try multiple locations because GitHub flatten-on-upload can put files at the root
const IMAGE_DIRS = [
  path.join(__dirname, 'public', 'product-images'),
  path.join(__dirname, 'product-images'),
  path.join(__dirname, 'public'),
  __dirname, // root of the repo
];
const ITEMS = ITEMS_RAW.map(item => {
  let imageDataUri = '';
  for (const dir of IMAGE_DIRS) {
    const imgPath = path.join(dir, item.image);
    try {
      const data = fs.readFileSync(imgPath);
      imageDataUri = `data:image/png;base64,${data.toString('base64')}`;
      break;
    } catch (e) {
      // try next dir
    }
  }
  if (!imageDataUri) {
    console.warn(`Image missing for ${item.id}: ${item.image}`);
  }
  return { ...item, image: imageDataUri };
});

console.log(`Loaded ${ITEMS.length} items`);

// ============================================
// Middleware
// ============================================
app.use(express.json({ limit: '1mb' }));

// Serve static files from public/ if it exists, otherwise from repo root
const PUBLIC_DIRS = [path.join(__dirname, 'public'), __dirname];
for (const dir of PUBLIC_DIRS) {
  if (fs.existsSync(dir)) app.use(express.static(dir));
}

// Resolve index.html in either location
function findIndexHtml() {
  for (const dir of PUBLIC_DIRS) {
    const candidate = path.join(dir, 'index.html');
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

// Explicit root handler — Express's static doesn't always serve `/` for `index.html`
// when index.html is at the repo root, depending on the static order
app.get('/', (req, res) => {
  const idx = findIndexHtml();
  if (idx) return res.sendFile(idx);
  res.status(500).send('index.html not found in public/ or repo root.');
});

// Simple password gate
function requirePassword(req, res, next) {
  const provided = req.headers['x-team-password'];
  if (provided !== TEAM_PASSWORD) {
    return res.status(401).json({ error: 'Invalid team password' });
  }
  next();
}

// ============================================
// Routes
// ============================================
app.get('/api/health', (req, res) => res.json({ ok: true }));

// Verify password (no-op if correct, 401 if not)
app.post('/api/verify', (req, res) => {
  if (req.body && req.body.password === TEAM_PASSWORD) {
    return res.json({ ok: true });
  }
  return res.status(401).json({ error: 'Invalid password' });
});

// Get items (requires password)
app.get('/api/items', requirePassword, (req, res) => {
  res.json({ items: ITEMS });
});

// Get all votes
app.get('/api/votes', requirePassword, async (req, res) => {
  try {
    const result = await pool.query('SELECT item_id, voter_name, vote, comment FROM votes');
    const grouped = {};
    for (const row of result.rows) {
      if (!grouped[row.item_id]) grouped[row.item_id] = {};
      grouped[row.item_id][row.voter_name] = {
        vote: row.vote || undefined,
        comment: row.comment || undefined,
      };
    }
    res.json({ votes: grouped });
  } catch (e) {
    console.error('GET /api/votes failed:', e);
    res.status(500).json({ error: 'Failed to load votes' });
  }
});

// Cast or update a vote
app.post('/api/vote', requirePassword, async (req, res) => {
  const { item_id, voter_name, vote, comment } = req.body || {};
  if (!item_id || !voter_name) {
    return res.status(400).json({ error: 'item_id and voter_name required' });
  }
  if (vote && !['like', 'neutral', 'dislike'].includes(vote)) {
    return res.status(400).json({ error: 'Invalid vote value' });
  }
  try {
    // If both vote and comment are empty/null, delete the row
    if (!vote && (!comment || comment.trim() === '')) {
      await pool.query('DELETE FROM votes WHERE item_id = $1 AND voter_name = $2', [item_id, voter_name]);
      return res.json({ ok: true, deleted: true });
    }
    await pool.query(`
      INSERT INTO votes (item_id, voter_name, vote, comment, updated_at)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (item_id, voter_name)
      DO UPDATE SET
        vote = COALESCE(EXCLUDED.vote, votes.vote),
        comment = EXCLUDED.comment,
        updated_at = NOW()
    `, [item_id, voter_name, vote || null, comment ? comment.trim() : null]);
    res.json({ ok: true });
  } catch (e) {
    console.error('POST /api/vote failed:', e);
    res.status(500).json({ error: 'Failed to save vote' });
  }
});

// Clear vote (just the vote, keeping comment)
app.post('/api/clear-vote', requirePassword, async (req, res) => {
  const { item_id, voter_name } = req.body || {};
  if (!item_id || !voter_name) {
    return res.status(400).json({ error: 'item_id and voter_name required' });
  }
  try {
    await pool.query(`
      UPDATE votes SET vote = NULL, updated_at = NOW()
      WHERE item_id = $1 AND voter_name = $2
    `, [item_id, voter_name]);
    // If both vote and comment are now null, delete the row
    await pool.query(`
      DELETE FROM votes
      WHERE item_id = $1 AND voter_name = $2 AND vote IS NULL AND (comment IS NULL OR comment = '')
    `, [item_id, voter_name]);
    res.json({ ok: true });
  } catch (e) {
    console.error('clear-vote failed:', e);
    res.status(500).json({ error: 'Failed to clear vote' });
  }
});

// Save/update comment only
app.post('/api/comment', requirePassword, async (req, res) => {
  const { item_id, voter_name, comment } = req.body || {};
  if (!item_id || !voter_name) {
    return res.status(400).json({ error: 'item_id and voter_name required' });
  }
  const trimmed = comment ? comment.trim() : '';
  try {
    if (!trimmed) {
      // Clear comment, but preserve vote if any
      await pool.query(`
        UPDATE votes SET comment = NULL, updated_at = NOW()
        WHERE item_id = $1 AND voter_name = $2
      `, [item_id, voter_name]);
      // Remove if everything is now empty
      await pool.query(`
        DELETE FROM votes
        WHERE item_id = $1 AND voter_name = $2 AND vote IS NULL AND (comment IS NULL OR comment = '')
      `, [item_id, voter_name]);
      return res.json({ ok: true });
    }
    await pool.query(`
      INSERT INTO votes (item_id, voter_name, vote, comment, updated_at)
      VALUES ($1, $2, NULL, $3, NOW())
      ON CONFLICT (item_id, voter_name)
      DO UPDATE SET comment = EXCLUDED.comment, updated_at = NOW()
    `, [item_id, voter_name, trimmed]);
    res.json({ ok: true });
  } catch (e) {
    console.error('comment failed:', e);
    res.status(500).json({ error: 'Failed to save comment' });
  }
});

// ============================================
// Boot
// ============================================
initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`Voter app running on port ${PORT}`);
  });
}).catch(err => {
  console.error('Failed to init DB:', err);
  process.exit(1);
});

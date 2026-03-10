import express, { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import Anthropic from '@anthropic-ai/sdk';

const app = express();
const PORT = process.env.PORT || 3000;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Directories
const DATA_DIR = path.join(__dirname, '..', 'data');
const IMAGES_DIR = path.join(DATA_DIR, 'images');
const DATA_FILE = path.join(DATA_DIR, 'medications.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

for (const dir of [DATA_DIR, IMAGES_DIR]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// Types
interface Medication {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  usage: string;
  warnings: string;
  interactions: string;
  ageDosageNote: string;
  imageFile?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Settings {
  userAge: number | null;
}

// Storage helpers
function loadMedications(): Medication[] {
  if (!fs.existsSync(DATA_FILE)) return [];
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
}

function saveMedications(meds: Medication[]): void {
  fs.writeFileSync(DATA_FILE, JSON.stringify(meds, null, 2));
}

function loadSettings(): Settings {
  if (!fs.existsSync(SETTINGS_FILE)) return { userAge: null };
  return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'));
}

function saveSettings(settings: Settings): void {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
}

// Image upload
const storage = multer.diskStorage({
  destination: IMAGES_DIR,
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    if (allowed.includes(path.extname(file.originalname).toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are supported'));
    }
  },
});

app.use(express.json());
app.use(express.static('public'));
app.use('/images', express.static(IMAGES_DIR));

// ─── Settings ────────────────────────────────────────────────────────────────

app.get('/api/settings', (_req, res) => {
  res.json(loadSettings());
});

app.put('/api/settings', (req: Request, res: Response): void => {
  const { userAge } = req.body;
  if (userAge !== null && userAge !== undefined && (typeof userAge !== 'number' || userAge < 0 || userAge > 120)) {
    res.status(400).json({ error: 'Invalid age' });
    return;
  }
  const settings: Settings = { userAge: userAge ?? null };
  saveSettings(settings);
  res.json(settings);
});

// ─── Parse image ─────────────────────────────────────────────────────────────

app.post('/api/parse-image', upload.single('image'), async (req: Request, res: Response): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ error: 'No image provided' });
    return;
  }

  const { userAge } = loadSettings();
  const ageContext = userAge !== null
    ? `The user is ${userAge} years old. Include age-appropriate dosing notes.`
    : 'No age info available; provide general dosing notes.';

  try {
    const imageData = fs.readFileSync(req.file.path);
    const base64Image = imageData.toString('base64');
    const mimeType = req.file.mimetype as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

    const response = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mimeType, data: base64Image },
          },
          {
            type: 'text',
            text: `Extract all medication information visible in this image. ${ageContext}

Return ONLY valid JSON with these exact fields:
{
  "name": "medication name",
  "dosage": "dosage strength (e.g. 500mg)",
  "frequency": "how often to take (e.g. Twice daily)",
  "usage": "clear, plain-language instructions on how to take this medication",
  "warnings": "important warnings and side effects in plain language",
  "interactions": "known drug or food interactions in plain language",
  "ageDosageNote": "dosage recommendation or caution specific to the user's age group, in plain language"
}

Use simple, easy-to-understand language. If any field is not visible, use an empty string.`,
          },
        ],
      }],
    });

    const textBlock = response.content.find(b => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') throw new Error('No response from Claude');

    const cleaned = textBlock.text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned);

    res.json({ ...parsed, imageFile: req.file.filename });
  } catch (err) {
    // Still return the image filename so frontend can reference it
    res.status(500).json({
      error: `Image parsing failed: ${(err as Error).message}`,
      imageFile: req.file.filename,
    });
  }
});

// ─── Medications CRUD ─────────────────────────────────────────────────────────

app.get('/api/medications', (_req, res) => {
  const meds = loadMedications();
  meds.sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  res.json(meds);
});

app.post('/api/medications', (req: Request, res: Response): void => {
  const { name, dosage, frequency, usage, warnings, interactions, ageDosageNote, imageFile } = req.body;

  if (!name) {
    res.status(400).json({ error: 'Medication name is required' });
    return;
  }

  const med: Medication = {
    id: `med-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name,
    dosage: dosage || '',
    frequency: frequency || '',
    usage: usage || '',
    warnings: warnings || '',
    interactions: interactions || '',
    ageDosageNote: ageDosageNote || '',
    imageFile: imageFile || undefined,
    active: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const meds = loadMedications();
  meds.push(med);
  saveMedications(meds);
  res.json(med);
});

app.put('/api/medications/:id', (req: Request, res: Response): void => {
  const meds = loadMedications();
  const idx = meds.findIndex(m => m.id === req.params.id);
  if (idx === -1) { res.status(404).json({ error: 'Not found' }); return; }

  const fields: (keyof Medication)[] = ['name', 'dosage', 'frequency', 'usage', 'warnings', 'interactions', 'ageDosageNote', 'imageFile'];
  const updated = { ...meds[idx] };
  for (const f of fields) {
    if (req.body[f] !== undefined) (updated as Record<string, unknown>)[f] = req.body[f];
  }
  updated.updatedAt = new Date().toISOString();

  meds[idx] = updated;
  saveMedications(meds);
  res.json(updated);
});

app.delete('/api/medications/:id', (req: Request, res: Response): void => {
  const meds = loadMedications();
  const idx = meds.findIndex(m => m.id === req.params.id);
  if (idx === -1) { res.status(404).json({ error: 'Not found' }); return; }

  if (meds[idx].imageFile) {
    const imgPath = path.join(IMAGES_DIR, meds[idx].imageFile!);
    if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
  }

  meds.splice(idx, 1);
  saveMedications(meds);
  res.json({ success: true });
});

// ─── Toggle active + interaction check ───────────────────────────────────────

app.post('/api/medications/:id/toggle', async (req: Request, res: Response): Promise<void> => {
  const meds = loadMedications();
  const med = meds.find(m => m.id === req.params.id);
  if (!med) { res.status(404).json({ error: 'Not found' }); return; }

  const activating = !med.active;

  // Check interactions when activating a new medication
  if (activating) {
    const activeMeds = meds.filter(m => m.active);
    if (activeMeds.length > 0) {
      try {
        const activeList = activeMeds
          .map(m => `- ${m.name}${m.dosage ? ` (${m.dosage})` : ''}${m.interactions ? `: known interactions: ${m.interactions}` : ''}`)
          .join('\n');

        const response = await client.messages.create({
          model: 'claude-opus-4-6',
          max_tokens: 512,
          messages: [{
            role: 'user',
            content: `Does "${med.name}"${med.dosage ? ` (${med.dosage})` : ''} have any clinically significant interactions with these currently taken medications?

Currently taking:
${activeList}

Known interactions for ${med.name}: ${med.interactions || 'none listed'}

Respond with ONLY valid JSON:
{
  "hasInteractions": true or false,
  "warning": "if hasInteractions is true: a short, plain-language warning listing the specific conflicts. If false: empty string."
}`,
          }],
        });

        const textBlock = response.content.find(b => b.type === 'text');
        if (textBlock && textBlock.type === 'text') {
          const cleaned = textBlock.text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          const result = JSON.parse(cleaned);

          if (result.hasInteractions && result.warning && req.body.confirmed !== true) {
            res.json({ requiresConfirmation: true, warning: result.warning });
            return;
          }
        }
      } catch (err) {
        console.error('Interaction check error:', err);
        // Proceed without interaction check on error
      }
    }
  }

  med.active = activating;
  med.updatedAt = new Date().toISOString();
  saveMedications(meds);
  res.json({ active: med.active, medication: med });
});

// ─── Health & catch-all ───────────────────────────────────────────────────────

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

const server = app.listen(PORT, () => {
  console.log(`\n💊 Prescription Tracker running at http://localhost:${PORT}\n`);
  if (!process.env.ANTHROPIC_API_KEY) console.warn('⚠️  ANTHROPIC_API_KEY is not set.\n');
});

process.on('SIGTERM', () => server.close());
process.on('SIGINT', () => server.close());

export default app;

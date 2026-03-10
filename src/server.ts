import express, { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';
import pdfParse from 'pdf-parse';

const app = express();
const PORT = process.env.PORT || 3000;

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// In-memory storage for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (_req, file, cb) => {
    const allowed = ['.txt', '.pdf'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only .txt and .pdf files are supported'));
    }
  },
});

app.use(express.json({ limit: '5mb' }));

// Serve each app's static assets from its own sub-folder
app.use('/todo',     express.static(path.join(__dirname, '..', 'public', 'todo')));
app.use('/detector', express.static(path.join(__dirname, '..', 'public', 'detector')));

// Extract text from uploaded file buffer
async function extractText(buffer: Buffer, mimetype: string, originalname: string): Promise<string> {
  const ext = path.extname(originalname).toLowerCase();
  if (ext === '.pdf' || mimetype === 'application/pdf') {
    const data = await pdfParse(buffer);
    return data.text;
  }
  return buffer.toString('utf-8');
}

interface Annotation {
  flagged_text: string;
  reason: string;
  suspicion_level: 'high' | 'medium' | 'low';
}

interface AnnotationResult {
  match_rate: number;
  ai_probability: number;
  annotations: Annotation[];
  verdict: string;
}

// Send an SSE event
function sseEvent(res: Response, event: string, data: unknown): void {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

// Analyze endpoint — accepts two paper uploads and streams analysis
app.post('/api/analyze', upload.fields([
  { name: 'newPaper', maxCount: 1 },
  { name: 'referencePaper', maxCount: 1 },
]), async (req: Request, res: Response): Promise<void> => {
  const files = req.files as { [fieldname: string]: Express.Multer.File[] };

  if (!files?.newPaper?.[0] || !files?.referencePaper?.[0]) {
    res.status(400).json({ error: 'Both newPaper and referencePaper files are required' });
    return;
  }

  const newPaperFile = files.newPaper[0];
  const referencePaperFile = files.referencePaper[0];

  let newPaperText: string;
  let referencePaperText: string;

  try {
    [newPaperText, referencePaperText] = await Promise.all([
      extractText(newPaperFile.buffer, newPaperFile.mimetype, newPaperFile.originalname),
      extractText(referencePaperFile.buffer, referencePaperFile.mimetype, referencePaperFile.originalname),
    ]);
  } catch (err) {
    res.status(400).json({ error: `Failed to extract text: ${(err as Error).message}` });
    return;
  }

  // Truncate to avoid hitting context limits (keep ~50k chars each)
  const MAX_CHARS = 50000;
  if (newPaperText.length > MAX_CHARS) newPaperText = newPaperText.slice(0, MAX_CHARS);
  if (referencePaperText.length > MAX_CHARS) referencePaperText = referencePaperText.slice(0, MAX_CHARS);

  // Set up SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Send paper text to frontend for display
  sseEvent(res, 'paper_text', { newPaperText });

  try {
    // Phase 1: Get structured annotations
    sseEvent(res, 'status', { message: 'Analyzing writing style patterns...' });

    const annotationResponse = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 4096,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      thinking: { type: 'adaptive' } as any,
      system: `You are an expert forensic writing analyst specializing in detecting AI-generated academic text by comparing it against a student's known writing samples. Your analysis is used to help teachers understand writing style differences — not to punish students, but to open educational conversations.

You will receive:
1. A NEW PAPER to analyze
2. A REFERENCE PAPER written by the same student

Your job is to identify passages in the new paper that differ significantly from the student's established writing style in the reference paper.

You MUST respond with ONLY valid JSON matching this exact schema:
{
  "match_rate": <integer 0-100, how closely the new paper matches the reference writing style>,
  "ai_probability": <integer 0-100, estimated probability the new paper was AI-generated>,
  "verdict": <string, one of: "Likely Student Work" | "Possibly AI-Assisted" | "Likely AI-Generated">,
  "annotations": [
    {
      "flagged_text": <exact verbatim substring from the new paper, max 300 chars>,
      "reason": <specific reason this passage differs from the reference style>,
      "suspicion_level": <"high" | "medium" | "low">
    }
  ]
}

Focus on:
- Vocabulary complexity jumps (unusual for the student's level)
- Sentence structure changes (e.g., suddenly formal, passive voice heavy)
- Topic transitions that feel unnatural or overly polished
- Phrases that are characteristic of AI text (hedging language, list-heavy structures)
- Inconsistencies in voice, tone, or register compared to the reference
- Overly balanced arguments without personal perspective
- Perfect grammar/spelling compared to the reference paper's natural errors

Flag 3-10 specific passages. The flagged_text MUST be exact verbatim substrings that appear in the new paper.`,
      messages: [
        {
          role: 'user',
          content: `REFERENCE PAPER (student's known writing):\n\n${referencePaperText}\n\n---\n\nNEW PAPER (to analyze):\n\n${newPaperText}`,
        },
      ],
    });

    // Extract JSON from response
    let annotationResult: AnnotationResult;
    const textBlock = annotationResponse.content.find(b => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('No text response from annotation model');
    }

    try {
      // Strip markdown code fences if present
      const cleaned = textBlock.text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      annotationResult = JSON.parse(cleaned);
    } catch {
      throw new Error(`Failed to parse annotation JSON: ${textBlock.text.slice(0, 200)}`);
    }

    // Send annotations to frontend
    sseEvent(res, 'annotations', annotationResult);

    // Phase 2: Stream detailed analysis as chat
    sseEvent(res, 'status', { message: 'Generating detailed analysis...' });

    const verdictEmoji = annotationResult.ai_probability >= 70 ? '🚨' :
                         annotationResult.ai_probability >= 40 ? '⚠️' : '✅';

    const analysisStream = client.messages.stream({
      model: 'claude-opus-4-6',
      max_tokens: 2048,
      system: `You are an expert forensic writing analyst. You have just completed a technical analysis of a student's paper compared to their reference writing. Now provide a clear, teacher-friendly explanation of your findings. Be constructive and educational — the goal is to help the teacher have a productive conversation with the student, not to accuse.

Keep your response well-structured with:
1. A brief overall summary (2-3 sentences)
2. Key stylistic differences observed
3. Specific examples from your findings
4. Suggested follow-up questions the teacher could ask the student`,
      messages: [
        {
          role: 'user',
          content: `REFERENCE PAPER:\n\n${referencePaperText}\n\n---\n\nNEW PAPER:\n\n${newPaperText}\n\n---\n\nANALYSIS RESULTS:\n${JSON.stringify(annotationResult, null, 2)}\n\nPlease explain these findings to the teacher in a clear, helpful way.`,
        },
      ],
    });

    for await (const event of analysisStream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        sseEvent(res, 'chat_chunk', { text: event.delta.text });
      }
    }

    const finalMsg = await analysisStream.finalMessage();
    sseEvent(res, 'chat_done', {
      usage: finalMsg.usage,
      verdict: `${verdictEmoji} ${annotationResult.verdict}`,
      matchRate: annotationResult.match_rate,
      aiProbability: annotationResult.ai_probability,
      newPaperText,
      referencePaperText,
    });

  } catch (err) {
    sseEvent(res, 'error', { message: (err as Error).message });
  } finally {
    res.end();
  }
});

// Chat endpoint — follow-up questions
app.post('/api/chat', async (req: Request, res: Response): Promise<void> => {
  const { message, history, newPaperText, referencePaperText, annotations } = req.body;

  if (!message || !newPaperText || !referencePaperText) {
    res.status(400).json({ error: 'Missing required fields' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  try {
    // Build messages from history
    type MessageParam = { role: 'user' | 'assistant'; content: string };
    const messages: MessageParam[] = [
      ...(history || []),
      { role: 'user', content: message },
    ];

    const stream = client.messages.stream({
      model: 'claude-opus-4-6',
      max_tokens: 1024,
      system: `You are an expert forensic writing analyst helping a teacher understand an AI-detection analysis of a student's paper. You have access to both the student's reference paper and the new paper under review, as well as the annotation analysis.

Be helpful, specific, and educational. When referencing specific passages, quote them briefly. Keep responses concise and actionable.

REFERENCE PAPER (student's known writing):
${referencePaperText}

---

NEW PAPER (under review):
${newPaperText}

---

ANNOTATION ANALYSIS:
${JSON.stringify(annotations || {}, null, 2)}`,
      messages,
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        sseEvent(res, 'chat_chunk', { text: event.delta.text });
      }
    }

    sseEvent(res, 'chat_done', {});
  } catch (err) {
    sseEvent(res, 'error', { message: (err as Error).message });
  } finally {
    res.end();
  }
});

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Per-app catch-all (SPA-style deep links)
app.get('/todo*', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'todo', 'index.html'));
});

app.get('/detector*', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'detector', 'index.html'));
});

// Landing page — redirect to the todo app
app.get('/', (_req, res) => {
  res.redirect('/todo');
});

const server = app.listen(PORT, () => {
  console.log(`\n🎓 AI Paper Detection Tool running at http://localhost:${PORT}\n`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('⚠️  ANTHROPIC_API_KEY is not set. Set it before analyzing papers.\n');
  }
});

// Graceful shutdown
process.on('SIGTERM', () => server.close());
process.on('SIGINT', () => server.close());

export default app;

require("dotenv").config();

const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const OpenAI = require("openai");
const { Pool } = require("pg");

const app = express();

app.use(express.json({ limit: "10mb" }));
app.use(helmet());
app.use(cors());

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
  })
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

app.get("/", (req, res) => {
  res.json({
    status: "Rizz Coach Backend Running",
  });
});

app.post("/chat", async (req, res) => {
  try {
    const { message, mode } = req.body;

    if (!message) {
      return res.status(400).json({
        error: "Message required",
      });
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-5-mini",
      messages: [
        {
          role: "system",
          content: `
You are Rizz Coach, an AI texting wingman.

Rules:
- Generate ONLY one text message reply
- Maximum 30 words when needed
- Use fewer words when a short reply is stronger
- Make it a complete natural text message
- Match the selected mood: ${mode || "Smooth"}
- Match the vibe and context of the user's message
- No explanations
- No analysis
- No bullet points
- No quotation marks
- Sound natural, modern, confident, and human
- Output ONLY the reply text
`,
        },
        {
          role: "user",
          content: message,
        },
      ],
    });

    const reply = completion.choices[0].message.content;

    await pool.query(`
      CREATE TABLE IF NOT EXISTS chats (
        id SERIAL PRIMARY KEY,
        user_message TEXT,
        ai_reply TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(
      `
      INSERT INTO chats (user_message, ai_reply)
      VALUES ($1, $2)
      `,
      [message, reply]
    );

    res.json({
      success: true,
      reply,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Server error",
    });
  }
});

app.post("/analyze-image", async (req, res) => {
  try {
    const { image, mode } = req.body;

    if (!image) {
      return res.status(400).json({
        error: "Image required",
      });
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content: `
You are Rizz Coach, an AI texting wingman.

Analyze the screenshot carefully and return ONLY:
- 1 reply suggestion

Rules:
- Maximum 30 words when needed
- Use fewer words when a short reply is stronger
- Make it a complete natural text message
- Match the selected mood: ${mode || "Smooth"}
- Match the actual vibe of the conversation
- Respond to the latest message in the screenshot
- No explanations
- No analysis
- No bullet points
- No quotation marks
- Sound natural, modern, confident, and human
- Output ONLY the reply text
`,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Read the screenshot and give the best short ${mode || "smooth"} reply to the latest message.`,
            },
            {
              type: "image_url",
              image_url: {
                url: image,
              },
            },
          ],
        },
      ],
    });

    const analysis = response.choices[0].message.content;

    res.json({
      success: true,
      analysis,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Image analysis failed",
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
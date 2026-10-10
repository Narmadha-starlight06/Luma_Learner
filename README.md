# LumaLearn

LumaLearn is a local-first React and Vite study app with a small Node API for Groq note translation.

## Run locally

1. Revoke any Groq API key that has been pasted into chat, screenshots, or another shared place. Create a replacement key in Groq.
2. Set `GROQ_API_KEY` and optionally `GROQ_MODEL` in `.env` or `.env.local` in the project root. Both files are ignored by Git; `.env.local` overrides `.env`. Never put the key in a `VITE_` variable or frontend source.
3. Run `npm install` and `npm run dev`. The app is available at `http://127.0.0.1:5173/`.

Translation requests go from the browser to the local `/api/translate` server, which forwards them to Groq. The default model is `openai/gpt-oss-120b`; set `GROQ_MODEL` in `.env` or `.env.local` to choose another model available to your account. The key is only read by the server. Restart `npm run dev` after changing either env file.

Select a language, enter or upload notes, and choose **Translate notes**. Translation accepts up to 20,000 characters per request. Notes and translations should be reviewed for technical and academic accuracy.

## Other local-first features

- Upload PDF, TXT, or Markdown files from **My notes** or the study buddy. PDF text is extracted in the browser and added to saved notes. Uploads are limited to 25 MB.
- Notes, your editable display name, and study-room memberships and text messages are saved in this browser's local storage.
- Create rooms, join or leave them, and use their local text chat. These rooms do not connect different users or devices.

Scanned PDFs require OCR and cannot be extracted yet. Study-buddy answers are still illustrative and are not grounded in uploaded notes. Cross-device rooms, realtime chat, and audio/video calls need a deployed backend and WebRTC signaling. In production, deploy the API server separately with its secret configured server-side and route `/api` to it; do not expose the Groq key to the browser.

Use `npm run build` to create a production build and `npm run lint` to run Oxlint.

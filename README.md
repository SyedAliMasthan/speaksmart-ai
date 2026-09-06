# 🎓 SpeakSmart AI — Complete Build & Deployment Guide
## (Written so simple, a 10-year-old can follow it)

---

## 📦 WHAT'S IN THIS PACKAGE (30 files)

Think of it like a LEGO set. Each file does ONE job:

| File | What it does (simple) |
|------|----------------------|
| `index.html` | The front door of your website. Has SEO tags so Google can find you. |
| `nginx.conf` | The security guard. Blocks hackers, speeds up loading. |
| `vite.config.js` | The builder. Takes your code and makes it small & fast. |
| `package.json` | The shopping list. Tells npm what libraries to download. |
| `.env.example` | The key template. You fill in YOUR secret keys here. |
| `public/robots.txt` | Tells Google what pages to look at. |
| `public/sitemap.xml` | A map of your website for Google. |
| `public/manifest.json` | Makes it installable as a phone app (PWA). |
| `public/favicon.svg` | The little icon in browser tabs. |
| `public/sw.js` | Makes the app work offline. |
| `src/main.jsx` | The starting point. Everything begins here. |
| `src/config/supabase.js` | Connects to your database (Supabase). |
| `src/config/router.jsx` | Decides which page to show when you click links. |
| `src/hooks/useAuth.jsx` | Handles login/logout. |
| `src/hooks/useVoiceInput.js` | Records your voice and sends to Sarvam AI. |
| `src/utils/sarvam.js` | Talks to Sarvam AI for voice (hear Liya speak + understand you). |
| `src/utils/sanitize.js` | Cleans user input so hackers can't inject bad code. |
| `src/utils/analytics.js` | Tracks how people use the app (optional). |
| `src/styles/global.css` | Makes everything look beautiful (dark theme). |
| `src/components/common/ErrorBoundary.jsx` | Shows a nice error page if something breaks. |
| `src/components/common/LoadingScreen.jsx` | Shows a spinner while pages load. |
| `src/pages/LandingPage.jsx` | The homepage visitors see BEFORE signing up. |
| `src/pages/Practice.jsx` | ⭐ THE MAIN THING — Liya chat with voice + suggestions. |
| `src/pages/PrivacyPolicy.jsx` | Legal page (required). |
| `src/pages/TermsOfService.jsx` | Legal page (required). |
| `supabase/migrations/001_rls_policies.sql` | Database security rules. |
| `supabase/OAUTH_SETUP.sql` | Instructions to enable Google login. |

---

## 🔌 DEPENDENCIES (What SpeakSmart needs to work)

### 1. Supabase (FREE) — Your Database + Login System
- **What:** Stores user accounts, progress, vocabulary, streaks
- **Cost:** Free tier = 50,000 monthly users, 500 MB database
- **You already have this:** `ikeoivqhrnpdfqdsiidj.supabase.co`
- **Keys needed:** `SUPABASE_URL` + `SUPABASE_ANON_KEY`
- **Where to get:** Supabase Dashboard → Settings → API

### 2. Groq AI (FREE) — Liya's Brain
- **What:** Makes Liya understand what you say and respond smartly
- **Cost:** Free tier = very generous (thousands of requests/day)
- **Model used:** `llama-3.3-70b-versatile`
- **Keys needed:** `GROQ_API_KEY`
- **Where to get:** https://console.groq.com → API Keys → Create

### 3. Sarvam AI (FREE tier available) — Liya's Voice + Ears
- **What:** 
  - **Ears (STT):** Saaras v3 — understands Tamil, Hindi, Telugu, English, and mixed speech
  - **Voice (TTS):** Bulbul v3 — Liya speaks as "Priya" (upbeat female voice with personality)
- **Cost:** Free tier available at dashboard.sarvam.ai
- **Keys needed:** `SARVAM_API_KEY`
- **Where to get:** https://dashboard.sarvam.ai → Sign up → API Keys
- **Why Sarvam over browser TTS:**
  - Browser TTS = robotic, doesn't understand Indian accents
  - Sarvam = natural Indian female voice, understands code-mixing (Tamil+English)
  - Works on ALL browsers (Safari, Firefox, Chrome)

### 4. Your Server (you already have this)
- **What:** Nginx on Ubuntu serving your website
- **No new cost:** You already host speaksmarts.in

### 5. Node.js (FREE) — To build the app
- **What:** Runs the build process on your computer
- **Version needed:** Node.js 18 or higher
- **Check:** Run `node --version` on your computer
- **Install if missing:** https://nodejs.org

### 6. Cloudflare (FREE) — Optional but recommended
- **What:** CDN + DDoS protection + faster loading
- **Cost:** Free plan is enough

---

## 🚀 STEP-BY-STEP DEPLOYMENT

### STEP 1: Get Your API Keys (10 minutes)

```
📝 You need 3 keys. Write them down:

KEY 1 — Supabase Anon Key:
  → Go to: https://supabase.com/dashboard
  → Click your project (ikeoivqhrnpdfqdsiidj)
  → Settings → API
  → Copy "anon public" key
  → Save it somewhere safe

KEY 2 — Groq API Key:
  → Go to: https://console.groq.com
  → Sign up / Log in
  → API Keys → Create API Key
  → Copy the key (starts with gsk_)
  → Save it

KEY 3 — Sarvam API Key:
  → Go to: https://dashboard.sarvam.ai
  → Sign up / Log in
  → API Keys → Create
  → Copy the key
  → Save it
```

### STEP 2: Download & Setup (5 minutes)

```bash
# On YOUR computer (not the server):

# 1. Extract the package
tar -xzf speaksmarts-final.tar.gz
cd speaksmarts-final

# 2. Create your secret keys file
cp .env.example .env.local

# 3. Open .env.local in any text editor and paste your keys:
#    VITE_SUPABASE_URL=https://ikeoivqhrnpdfqdsiidj.supabase.co
#    VITE_SUPABASE_ANON_KEY=paste_key_1_here
#    VITE_GROQ_API_KEY=paste_key_2_here
#    VITE_SARVAM_API_KEY=paste_key_3_here

# 4. Install libraries (npm reads package.json and downloads them)
npm install

# 5. Test locally
npm run dev
# Open http://localhost:5173 in your browser
# You should see the landing page!
```

### STEP 3: Build for Production (2 minutes)

```bash
# This creates a "dist" folder with optimized files
npm run build

# Check it worked:
ls dist/
# You should see: index.html, assets/ folder
ls dist/assets/
# You should see multiple .js files (code splitting worked!)
```

### STEP 4: Secure Your Database (5 minutes)

```
→ Go to: https://supabase.com/dashboard
→ Click your project
→ SQL Editor (left sidebar)
→ Click "New Query"
→ Open the file: supabase/migrations/001_rls_policies.sql
→ Copy ALL the text
→ Paste into the SQL Editor
→ Click "Run"
→ You should see "Success" 

This locks your database so users can only see THEIR OWN data.
```

### STEP 5: Enable Google Login (5 minutes)

```
→ Follow the instructions in: supabase/OAUTH_SETUP.sql
→ Short version:
  1. Go to Google Cloud Console → Create OAuth credentials
  2. Go to Supabase Dashboard → Authentication → Providers → Google → Enable
  3. Paste the Google credentials → Save
```

### STEP 6: Upload to Your Server (5 minutes)

```bash
# Upload the built files to your server
scp -r dist/* your-user@your-server-ip:/var/www/speaksmarts.in/dist/

# Upload the nginx config
scp nginx.conf your-user@your-server-ip:/tmp/speaksmarts.conf

# SSH into your server
ssh your-user@your-server-ip

# On the server:
# 1. Backup old config
sudo cp /etc/nginx/sites-available/speaksmarts.in /etc/nginx/sites-available/speaksmarts.in.OLD

# 2. Replace with new config
sudo cp /tmp/speaksmarts.conf /etc/nginx/sites-available/speaksmarts.in

# 3. Test the config (MUST say "syntax is ok")
sudo nginx -t

# 4. If OK, reload nginx
sudo systemctl reload nginx

# 5. Test it!
# Open https://speaksmarts.in in your browser
```

### STEP 7: Verify Everything Works (3 minutes)

```bash
# Test 1: Does the landing page show?
# → Open https://speaksmarts.in
# → You should see "Learn English by speaking, not memorizing"

# Test 2: Does robots.txt work? (not SPA fallback)
curl https://speaksmarts.in/robots.txt
# Should show "User-agent: *"  (NOT html code)

# Test 3: Are security headers set?
curl -sI https://speaksmarts.in | grep -i strict
# Should show: Strict-Transport-Security

# Test 4: Are hackers blocked?
curl -s -o /dev/null -w "%{http_code}" https://speaksmarts.in/.env
# Should show: 444 or 000 (blocked!)

# Test 5: Can you sign up and practice?
# → Click "Start Learning Free"
# → Create account
# → Pick a lesson
# → Liya should greet you with voice!
```

---

## 🔄 HOW THE OLD APP GETS REPLACED

Your OLD app files live in: `/var/www/speaksmarts.in/dist/`

When you run `scp -r dist/* ...` in Step 6, the NEW files 
OVERWRITE the old ones. That's it. 

The new app has ALL your old pages (Dashboard, Lessons, Practice, 
Vocabulary, Progress, Profile, Settings) PLUS the new ones 
(Landing Page, Privacy, Terms).

**What if something goes wrong?**
```bash
# You backed up in Step 6, so just restore:
sudo cp /etc/nginx/sites-available/speaksmarts.in.OLD /etc/nginx/sites-available/speaksmarts.in
sudo systemctl reload nginx
# Old site is back!
```

---

## 🎤 HOW SARVAM AI WORKS IN THIS APP

```
User presses 🎤 mic button
    ↓
Browser records audio (WebM format)
    ↓
Audio sent to Sarvam Saaras v3 API
(understands Tamil/Hindi/Telugu/English/mixed)
    ↓
Sarvam returns text: "my name is vahi"
    ↓
Text sent to Groq AI (Liya's brain)
    ↓
Groq returns: correction + suggestion + follow-up question
    ↓
Response text sent to Sarvam Bulbul v3 TTS
(voice: Kavya — warm female Indian accent)
    ↓
Audio plays automatically — user hears Liya speak!
```

**If Sarvam key is not set:**
- Voice INPUT falls back to browser's Web Speech API (Chrome only)
- Voice OUTPUT falls back to browser TTS (robotic but works)
- The app still works, just with worse voice quality

---

## 💰 COST SUMMARY

| Service | Cost | What you get |
|---------|------|-------------|
| Supabase | FREE | 50K users, 500MB database |
| Groq AI | FREE | Thousands of AI calls/day |
| Sarvam AI | FREE tier | Voice in/out for Indian languages |
| Cloudflare | FREE | CDN + DDoS protection |
| Your Server | Already paid | Nginx hosting |
| **Total** | **₹0** | **Full enterprise app** |

---

## ❓ COMMON PROBLEMS & FIXES

**Problem: "npm install" fails**
→ Make sure Node.js 18+ is installed: `node --version`
→ If not: download from https://nodejs.org

**Problem: "nginx -t" says error**
→ The config has a line `more_clear_headers`. If your nginx 
   doesn't have headers-more module, delete those 2 lines.

**Problem: Liya doesn't speak**
→ Check .env.local has VITE_SARVAM_API_KEY set correctly
→ Check browser console (F12) for errors
→ The app falls back to browser TTS if Sarvam fails

**Problem: Voice input doesn't work**
→ Browser must allow microphone access
→ Check if HTTPS is working (mic needs HTTPS)
→ Check .env.local has VITE_SARVAM_API_KEY set

**Problem: AI gives weird responses**
→ Check .env.local has VITE_GROQ_API_KEY set correctly
→ Check browser console for "401" or "403" errors

**Problem: Can't sign in with Google**
→ Follow supabase/OAUTH_SETUP.sql steps exactly
→ Make sure redirect URL matches your domain

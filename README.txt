GOW PREMIUM STORE - hosting guide

FILES
  index.html  the whole website (one file, nothing else needed)
  worker.js   optional relay for the sturdier setup (email + Telegram, and the admin price page)

HOST THE WEBSITE (free, 2 minutes)
  Cloudflare Pages / Netlify Drop / Vercel: upload this folder (or just index.html). Done.
  Any normal web hosting: upload index.html to the public_html folder.

SETTINGS (open index.html in a text editor, find "var CONFIG=" near the bottom)
  telegram  your Telegram username without @ (now: gowpremium, a placeholder)
  email     your inbox for orders: QUICK OPTION below
  endpoint  your Worker address: STURDY OPTION below (if set, it is used instead of email)
  BANKS     your accounts (already filled in)

GET ORDERS + PAYMENT SCREENSHOT BY EMAIL

  QUICK OPTION (no account, about 3 minutes) - uses the free FormSubmit service
    1. In index.html set  email:'you@example.com'  (your real email), save, upload.
    2. Open your live site and place one TEST order (with a screenshot).
    3. FormSubmit emails you an activation link. Click it. Do this once.
    4. From now on every order arrives as an email with the screenshot attached (up to 10 MB, 500 free orders).
    5. Optional: after activating, FormSubmit gives you a random address. Use that instead of your email so your email is not visible in the page.
    Note: the site cannot see whether FormSubmit accepted an order, so test it once and check your inbox (and spam).

  STURDY OPTION - Cloudflare Worker + Resend (also unlocks the admin price page)
    1. Create a free account at resend.com and make an API key (starts with re_).
    2. Cloudflare dashboard > Workers & Pages > Create > Hello World > Deploy, then Edit code, paste worker.js, Deploy.
    3. Worker > Settings > Variables and Secrets: add RESEND_API_KEY (the key), OWNER_EMAIL (the SAME email you used to sign up at Resend), ORIGIN (your site address, no trailing slash, e.g. https://yoursite.com).
       Optional for Telegram too: BOT_TOKEN and CHAT_ID. For the admin page: ADMIN_PASSWORD, and a KV namespace bound as PRICES.
    4. Copy the Worker address into endpoint:'...' in index.html (no trailing slash), re-upload.
    Resend only delivers to your own account email until you verify a domain. That is what you need here.
    Free limits: 100 emails per day, 3,000 per month.

ADMIN PAGE (hidden, needs the Worker + KV + ADMIN_PASSWORD): your website address followed by #admin

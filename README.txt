MY VOCABULARY HUB - INSTALLATION & RUN GUIDE

Package Contents:
- index.html (Main application layout)
- app.js (JavaScript application logic, API lookups, local database, connection maps)
- manifest.webmanifest (PWA configuration)
- sw.js (Service Worker for offline support)
- icon-192.png (App icon 192x192)
- icon-512.png (App icon 512x512)

HOW TO RUN LOCALLY:
1. Extract all files into a single folder.
2. Open index.html directly in any web browser (Chrome, Edge, Safari, Firefox).
   Or run a local HTTP server:
   - Python: python -m http.server 8000
   - Node: npx serve .
3. Open http://localhost:8000 in your browser.

HOSTING ON GITHUB PAGES (FREE):
1. Create a repository on github.com (e.g. wordhub).
2. Upload all files to the repository.
3. Go to Settings > Pages, choose Branch: main and folder: /(root), then Save.
4. Your website will be live at https://YOUR-USERNAME.github.io/wordhub/

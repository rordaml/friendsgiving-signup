# Friendsgiving Signup

A one-page signup site for Friendsgiving. The page is plain HTML hosted on GitHub Pages; signups are stored in a Google Sheet through a small Apps Script web app.

```
index.html            the whole site
apps-script/Code.gs   the Google Sheet backend (pasted into Apps Script, not hosted on GitHub)
```

Until `SHEET_API` is set in `index.html`, the page runs as a mockup with sample signups and a "Turkey time" slider. Once it's set, the mockup box disappears and the page reads and writes the Sheet.

## 1. Set up the Google Sheet (about 10 minutes)

1. Create a new Google Sheet. Any name works.
2. In the Sheet, open **Extensions → Apps Script**.
3. Delete what's in `Code.gs` there and paste in the full contents of [apps-script/Code.gs](apps-script/Code.gs). Click **Save**.
4. Click **Deploy → New deployment**.
   - Click the gear next to "Select type" and choose **Web app**.
   - **Execute as:** Me
   - **Who has access:** Anyone
   - Click **Deploy**.
5. Google asks you to authorize. Pick your account. When it says "Google hasn't verified this app", click **Advanced → Go to (project name) (unsafe)**. It's your own script; it only gets access to this one spreadsheet.
6. Copy the **Web app URL**. It ends in `/exec`.
7. Open that URL in a browser. You should see `{"ok":true,"claims":[]}`. A `Signups` tab now exists in the Sheet.

## 2. Connect the page

In `index.html`, find this line near the top of the script and paste your URL between the quotes:

```js
const SHEET_API = 'https://script.google.com/macros/s/XXXXXXXX/exec';
```

Open `index.html` in a browser to test: add a dish, then check that a row appears in the Sheet.

## 3. Publish on GitHub Pages

1. Create a new repository on GitHub (for example `friendsgiving-signup`). It can be public.
2. Push this folder to it:

   ```bash
   git init
   git add index.html README.md apps-script
   git commit -m "Friendsgiving signup"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/friendsgiving-signup.git
   git push -u origin main
   ```
3. On GitHub, open **Settings → Pages**. Under "Build and deployment", choose **Deploy from a branch**, branch **main**, folder **/ (root)**, and save.
4. After a minute the site is live at `https://YOUR-USERNAME.github.io/friendsgiving-signup/`. Send that link to your friends.

## Changing things later

- **Edit or delete signups by hand:** do it directly in the Sheet. Keep the header row and the `id` column.
- **Change the event details, host dishes, or countdown time:** edit `index.html` (`HOST_ITEMS`, `PARTY`, and the details block in the header), then commit and push.
- **Add or rename a category:** edit `CATS` in `index.html`. If you add a new category id, also add it to `CATEGORIES` in the Apps Script, then redeploy the script (below).
- **Redeploying the script after an edit:** in Apps Script, **Deploy → Manage deployments → pencil icon → Version: New version → Deploy**. The URL stays the same. (Using "New deployment" instead would give you a new URL.)

## What to know

- Anyone with the page link can add or remove entries. Removing or editing needs the household name that made the entry, which stops accidents but not someone determined. You can always fix things in the Sheet.
- The page refreshes the list every 30 seconds, so people see each other's signups without reloading.
- The countdown uses each visitor's own time zone.
- The turkeys start getting strange after 15 seconds and reach full horror around four minutes. The timing is `GRACE` and `RAMP` in `index.html`.

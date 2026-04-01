# 📱 Flixora App - Installation Guide

Flixora is now a **Progressive Web App (PWA)** that you can install on your phone and desktop!

## 🌟 Features
- ✅ Works like a native app
- ✅ Install on phone home screen
- ✅ Install on desktop
- ✅ Offline support (UI works offline, streaming requires internet)
- ✅ No app store needed
- ✅ Fast loading
- ✅ Full screen mode
- ✅ Works on Android, iOS, Windows, Mac, Linux

---

## 📱 **HOW TO INSTALL ON ANDROID PHONE**

### Method 1: Chrome (Easiest)
1. Open **Chrome browser** on your Android phone
2. Go to your Flixora website
3. Tap the **menu (3 dots)** in top right
4. Tap **"Add to Home screen"** or **"Install app"**
5. Tap **"Install"** or **"Add"**
6. Done! App icon will appear on your home screen

### Method 2: Firefox
1. Open **Firefox browser**
2. Go to your Flixora website
3. Tap the **home icon** in address bar
4. Tap **"Add to Home Screen"**
5. Done!

### Method 3: Samsung Internet
1. Open **Samsung Internet browser**
2. Go to your Flixora website
3. Tap **menu** → **"Add page to"** → **"Home screen"**

---

## 📱 **HOW TO INSTALL ON iPHONE (iOS)**

### Safari Only (iOS requires Safari for PWA)
1. Open **Safari browser** on your iPhone
2. Go to your Flixora website
3. Tap the **Share button** (square with arrow)
4. Scroll down and tap **"Add to Home Screen"**
5. Tap **"Add"** in top right
6. Done! App appears on your home screen

**Note:** You MUST use Safari on iPhone. Chrome/Firefox won't work for installation on iOS.

---

## 💻 **HOW TO INSTALL ON WINDOWS PC**

### Chrome/Edge (Recommended)
1. Open **Chrome** or **Edge** browser
2. Go to your Flixora website
3. Look for **install icon** (⊕) in address bar (top right)
4. Click it and then click **"Install"**
5. OR: Click **menu (3 dots)** → **"Install Flixora"**
6. App will open in its own window!

### Manual Method
1. Click **menu (3 dots)** → **"More tools"** → **"Create shortcut"**
2. Check **"Open as window"**
3. Click **"Create"**

**Where to find installed app:**
- Windows Start Menu → Search "Flixora"
- Desktop shortcut (if you checked that option)

---

## 💻 **HOW TO INSTALL ON MAC**

### Chrome/Safari
1. Open **Chrome** or **Safari**
2. Go to your Flixora website
3. **Chrome:** Click install icon in address bar OR menu → "Install Flixora"
4. **Safari:** File → "Add to Dock"
5. App appears in Dock and Applications folder

---

## 🐧 **HOW TO INSTALL ON LINUX**

### Chrome/Chromium/Brave
1. Open browser
2. Go to your Flixora website
3. Click **menu** → **"Install Flixora"**
4. Or click the install icon in address bar

---

## 🚀 **DEPLOYING YOUR APP**

To make your Flixora app accessible:

### Option 1: GitHub Pages (FREE & Easy)
1. Create GitHub account
2. Create new repository named "flixora"
3. Upload all files from `flixora-app` folder
4. Go to Settings → Pages
5. Select "main" branch
6. Your app will be at: `https://yourusername.github.io/flixora`

### Option 2: Netlify (FREE & Even Easier)
1. Go to netlify.com
2. Drag and drop the `flixora-app` folder
3. Done! You get a free URL

### Option 3: Vercel (FREE)
1. Go to vercel.com
2. Import from GitHub or upload folder
3. Deploy!

### Option 4: Your Own Server
1. Upload all files to your web server
2. Make sure HTTPS is enabled (required for PWA)
3. Access via your domain

---

## 📂 **FILES INCLUDED**

```
flixora-app/
├── index.html          # Main HTML file
├── app.js              # All functionality
├── manifest.json       # PWA manifest
├── sw.js   # Offline support & caching
├── icon-192.png        # App icon (small)
├── icon-512.png        # App icon (large)
├── screenshot.png      # App screenshot
└── README.md           # This file
```

---

## ✨ **USAGE TIPS**

### For Best Experience:
- **Install the app** instead of using browser bookmark
- **Allow notifications** if prompted (future feature)
- **Update regularly** - refresh app occasionally for updates
- **Try different servers** if video doesn't load
- **Use WiFi** for best streaming quality

### Shortcuts:
- **Search:** Type in search box, press Enter
- **Close player:** Press ESC key or click X
- **Navigate:** Click categories at top

---

## 🔧 **TROUBLESHOOTING**

### App won't install?
- Make sure you're using **HTTPS** (not HTTP)
- Try different browser (Chrome works best)
- Clear browser cache
- On iOS, MUST use Safari

### Video won't play?
- Try different server (click server buttons)
- Check internet connection
- Some content may not be available
- Try another title

### App is slow?
- Clear app cache:
  - Android: Settings → Apps → Flixora → Clear cache
  - iOS: Delete and reinstall
  - Desktop: Browser settings → Clear cache

### Can't find installed app?
- **Android:** Check app drawer, search "Flixora"
- **iOS:** Check all home screens
- **Windows:** Start menu or desktop
- **Mac:** Applications folder or Dock

---

## 🔄 **UPDATING THE APP**

The app will auto-update when you deploy changes. Users just need to:
1. Close and reopen the app
2. Or force refresh (Ctrl+Shift+R on desktop)

---

## 🎯 **FEATURES COMPARISON**

| Feature | Browser Version | Installed App |
|---------|----------------|---------------|
| Watch content | ✅ | ✅ |
| Search | ✅ | ✅ |
| Full screen | ✅ | ✅ |
| Home screen icon | ❌ | ✅ |
| App drawer | ❌ | ✅ |
| Standalone window | ❌ | ✅ |
| Faster loading | ❌ | ✅ |
| Offline UI | ❌ | ✅ |
| Native feel | ❌ | ✅ |

---

## 💡 **TIPS FOR DEPLOYMENT**

1. **Always use HTTPS** - PWA requires secure connection
2. **Test on mobile** before deploying
3. **Optimize images** if you add custom ones
4. **Check manifest.json** - update URLs if needed
5. **Service worker** caches files for offline use

---

## 📱 **AFTER INSTALLATION**

Once installed, Flixora will:
- Appear as a regular app icon
- Open in full screen (no browser UI)
- Feel like a native app
- Load faster than browser version
- Work partially offline (UI only)

---

## 🎉 **YOU'RE DONE!**

Enjoy your personal streaming app! 🍿

For issues or questions:
- Check troubleshooting section above
- Make sure you're using latest browser
- Try different device/browser

**Happy Streaming!** 🎬✨

---

## 🗑️ LEGACY FILES (Safe to Delete)

These files are superseded by `room-manager.js` and should be removed:

| File | Replaced By |
|------|-------------|
| `chat-system.js` | `room-manager.js` (built-in chat) |
| `firebase-config.js` | `room-manager.js` (built-in Firebase init) |
| `sync-engine.js` | `room-manager.js` (built-in sync) |
| `ui-components.js` | `room-manager.js` (built-in UI) |
| `service-worker.js` | `sw.js` (improved version) |

**Do NOT include these in `<script>` tags in index.html.**

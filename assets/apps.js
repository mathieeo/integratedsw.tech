/* ============================================================================
   Integrated Software Technologies — the app catalog (single source of truth)
   Used by the browser (assets/app.js, enhance.js) AND the static-site generator
   (build.js). Edit apps here. Each app's `slug` is its /apps/<slug>/ URL.
   TO EDIT LINKS: set `store` (App Store URL); leave "" + status:"soon" for WIP.
   ============================================================================ */
const APPS = [
  { name:"Deck", cat:"Developer Tools", accent:"#22ff8c", icon:"Deck", key:"deck", slug:"deck", status:"soon",
    desc:"A graphical SSH client: browse a host like a file manager with a live terminal docked below.",
    long:"Deck is a full SSH client, SFTP file manager, and live server monitor in one beautifully designed app. Run a real terminal — vim, htop, and nano all work — browse and edit files with save-back, and watch CPU, memory, and disk in real time with trend graphs. Local port forwarding, jump hosts, and auto-reconnect are built in. Credentials live in the iOS Keychain behind Face ID, with on-device key generation and host-key verification. No accounts, no tracking.",
    store:"", github:"" },
  { name:"Spinnit", cat:"Entertainment", accent:"#a78bff", icon:"Spinnit", key:"spinnit", slug:"spinnit", status:"soon",
    desc:"Can't decide? Give the wheel a flick and let it choose — with confetti, haptics, and sound.",
    long:"Spinnit is a delightful decision wheel. Spin for Yes/No or add any custom options, with your own colors, emoji, and 6, 9, or 12 slices. Winners get confetti, fireworks, hearts, or stars. Save unlimited wheels or start from templates — what to eat, truth or dare, dice, names — weight the odds, run best-of series, and use draw mode for raffles. Live tallies, history and stats, share a result or a whole wheel by QR code, and even “Hey Siri, spin the wheel.”",
    store:"", github:"" },
  { name:"Tunnel", cat:"Developer Tools", accent:"#22d3ee", icon:"Tunnel", key:"tunnel", slug:"tunnel",
    desc:"A full SSH terminal, SFTP, and port forwarding in your pocket. Secured with Face ID.",
    long:"Tunnel puts a complete SSH workstation in your pocket: a real terminal, an SFTP file browser, and port forwarding — all secured behind Face ID with keys stored in the iOS Keychain. Connect to servers on your local network or across the internet, manage multiple hosts, and keep sessions alive, entirely on-device.",
    store:"https://apps.apple.com/app/id6788131375", github:"" },
  { name:"NetScan Pro", cat:"Utilities", accent:"#34d399", icon:"NetScanPro", key:"netscan", slug:"netscan",
    desc:"See every device on your network in seconds. Ports, vendors, and latency at a glance.",
    long:"NetScan Pro maps your entire local network in seconds. Discover every connected device with its vendor, IP, and latency, scan open ports, browse Bonjour services, and wake machines with Wake-on-LAN. A fast, native scanner for anyone who wants to know exactly what's on their Wi-Fi.",
    store:"https://apps.apple.com/app/id6778565960", github:"" },
  { name:"DepthTag", cat:"Utilities", accent:"#38bdf8", icon:"DepthTag", key:"depthtag", slug:"depthtag",
    desc:"Point, tap, measure. LiDAR-precise distances tagged onto the real world in AR.",
    long:"DepthTag turns your iPhone's LiDAR sensor into a precise measuring tool. Point at anything and tap to drop a distance tag, pinned onto the real world in augmented reality. Measure heights, gaps, and depths to the centimeter, save a list of readings, and see the live depth map — all on a LiDAR-equipped iPhone.",
    store:"https://apps.apple.com/app/id6788135760", github:"" },
  { name:"SnapSweep", cat:"Photo & Video", accent:"#0ea5e9", icon:"SnapSweep", key:"snapsweep", slug:"snapsweep",
    desc:"Reclaim your storage. Find duplicates, screenshots, and blurry shots, all on-device.",
    long:"SnapSweep cleans up your photo library without ever uploading a thing. An on-device scan finds duplicates, screenshots, blurry shots, and junk using PhotoKit and Vision, then lets you review and sweep them in a fast swipe-to-decide flow. Watch your free storage climb — privately.",
    store:"https://apps.apple.com/app/id6788139595", github:"" },
  { name:"DoughRatio", cat:"Food & Drink", accent:"#f59e0b", icon:"DoughRatioApp", key:"doughratio", slug:"doughratio",
    desc:"Baker's percentages, hydration, and batch scaling, worked out the instant you type.",
    long:"DoughRatio is a baker's percentage calculator that does the math the instant you type. Dial in hydration, salt, and starter, scale any recipe up or down by weight or number of loaves, and follow a timeline from mix to bake. Built for bread bakers who think in ratios.",
    store:"https://apps.apple.com/us/app/doughratio/id6761349279", github:"" },
  { name:"Score Split", cat:"Sports", accent:"#ef4444", icon:"ScoreSplit", key:"scoresplit", slug:"scoresplit",
    desc:"Tap your side to score. Two players, one screen, zero arguments.",
    long:"Score Split is the simplest scorekeeper there is. Split the screen, tap your side to score, and settle any game — cards, ping-pong, backyard basketball — without arguments. Custom themes, quick reset, and a big, readable scoreboard.",
    store:"https://apps.apple.com/us/app/scoresplit-app/id6761349352", github:"" },
  { name:"WaveVision", cat:"Music", accent:"#a855f7", icon:"WaveVision", slug:"wavevision",
    desc:"Turn images into sound and sound back into images, using an on-device FFT.",
    long:"WaveVision is an audio-visual experiment: convert any image into sound by mapping pixels to frequencies, then turn sound back into an image with an on-device FFT. Fully offline, powered by the Accelerate framework, and endlessly fun to explore.",
    store:"https://apps.apple.com/us/app/wavevision/id6761349326" },
  { name:"ToneScape", cat:"Health & Fitness", accent:"#2dd4bf", icon:"ToneScape", slug:"tonescape",
    desc:"Ambient soundscapes for focus and sleep, with a home-screen widget.",
    long:"ToneScape generates calming ambient soundscapes for focus, relaxation, and sleep. Mix layers, set a timer, and keep it playing in the background — with a home-screen widget for one-tap ambience. Simple, beautiful, and easy on the battery.",
    store:"https://apps.apple.com/us/app/tonescape/id6761738557" },
  { name:"BinaryHexCalc", cat:"Developer Tools", accent:"#22d3ee", icon:"BinaryHexCalc", slug:"binaryhexcalc",
    desc:"Binary, hexadecimal, and decimal side by side, with live bit toggling.",
    long:"BinaryHexCalc shows binary, hexadecimal, and decimal side by side and keeps them in sync as you type. Toggle individual bits, run bitwise operations, and switch word sizes — a fast, focused tool for programmers and students working close to the metal.",
    store:"https://apps.apple.com/us/app/binaryhexcalc/id6755499704" },
];

if (typeof module !== 'undefined' && module.exports) module.exports = { APPS };
if (typeof window !== 'undefined') window.APPS = APPS;

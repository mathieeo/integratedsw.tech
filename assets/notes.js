/* ============================================================================
   Integrated Software Technologies — build notes / journal
   Shared by the browser (renders the Journal section) and build.js (generates
   /notes/<slug>/ pages + sitemap). Newest first. Body is trusted HTML.
   ============================================================================ */
const NOTES = [
  {
    slug: "wavevision-dry-exports",
    title: "Why WaveVision exports stay dry",
    date: "2026-07-07",
    tags: ["WaveVision", "DSP", "Audio"],
    dek: "Reverb makes the app sound gorgeous — and quietly destroys the thing that lets a picture survive a round trip.",
    body: `<p>WaveVision turns an image into sound and back again. The decode path runs an on-device FFT and finds spectral peaks: each peak is a pixel's frequency, and its height is the pixel's brightness. That only works if the fundamental stays the tallest thing in every bin.</p>
    <p>Reverb smears energy across time and frequency. It sounds wonderful on playback, but a reverb tail bleeds one column's tone into the next and buries the peaks the decoder is hunting for. So the rule in the codebase is blunt: <b>reverb is a playback-only effect</b>. Exports — the <code>.wvision</code> files and rendered video — are always dry. Add a wet path to an export and images stop decoding.</p>
    <p>The same discipline shows up elsewhere: waveforms are band-limited additive synthesis with harmonics capped below 18 kHz, so the fundamental always dominates. Pretty is a playback concern; correct is an export concern. Keeping those two apart is most of what makes the round trip reliable.</p>`
  },
  {
    slug: "depthtag-lidar",
    title: "Measuring the world with a tap",
    date: "2026-06-20",
    tags: ["DepthTag", "ARKit", "LiDAR"],
    dek: "How DepthTag turns a LiDAR frame into a centimeter-accurate distance you can pin in mid-air.",
    body: `<p>DepthTag runs an ARKit world-tracking session with one extra frame semantic switched on: <code>sceneDepth</code>. Every frame then carries an <code>ARDepthData</code> whose <code>depthMap</code> is a buffer of Float32 distances, in meters, straight from the LiDAR sensor.</p>
    <p>When you tap, the screen point is converted to a coordinate in that depth buffer and the distance is read directly — no photogrammetry, no guessing, just the sensor's own measurement. The tag is then placed in world space so it stays put as you move around it.</p>
    <p>The important engineering decision is the negative space: the entire feature is gated behind a LiDAR capability check. On a phone without the sensor there is no honest depth to report, so DepthTag doesn't pretend. A measuring tool that lies is worse than one that says "not on this device."</p>`
  },
  {
    slug: "snapsweep-on-device",
    title: "Cleaning a photo library without uploading it",
    date: "2026-07-02",
    tags: ["SnapSweep", "Privacy", "Vision"],
    dek: "Duplicate detection, blur scoring, and screenshot classification — all on the phone, nothing leaves it.",
    body: `<p>The obvious way to build a photo cleaner is to ship pixels to a server and let a big model sort them. SnapSweep does the opposite: the scan runs entirely on the device, using PhotoKit to enumerate the library and Vision to do the perceptual work — feature-print similarity for near-duplicates, sharpness scoring for blur, and classification for screenshots and receipts.</p>
    <p>That constraint costs some accuracy and a lot of battery tuning, but it buys the one thing that matters for this app: your photos never travel. There are no accounts and no network calls in the scan path at all. "On-device" isn't a marketing line here — it's the architecture, and it's why the app can promise that reclaiming storage never means handing your camera roll to anyone.</p>`
  }
];

if (typeof module !== 'undefined' && module.exports) module.exports = { NOTES };
if (typeof window !== 'undefined') window.NOTES = NOTES;

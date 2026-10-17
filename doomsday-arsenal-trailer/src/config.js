// ─────────────────────────────────────────────────────────────────────────────
//  DOOMSDAY ARSENAL — trailer configuration
//  Everything a non-programmer is likely to want to change lives in this file:
//  titles, the link, the arsenal, the AI's lines and the gameplay cuts.
// ─────────────────────────────────────────────────────────────────────────────

export const CONFIG = {
  title: ['DOOMSDAY', 'ARSENAL'],
  kicker: 'A MINECRAFT MOD',
  tagline: 'EIGHTEEN WAYS TO END A WORLD.',
  subtagline: 'and what each one leaves behind',
  platform: 'CURSEFORGE',
  link: 'https://www.curseforge.com/minecraft/mc-mods/doomsday-arsenal',

  // Name the AI uses for itself in its on-screen text.
  aiName: 'ARSENAL//OS',

  // Output format.
  width: 1920,
  height: 1080,
  fps: 30,

  // ── In-game footage ──────────────────────────────────────────────────────
  // The clip, and which parts of it to use: [start, end] in seconds of the clip.
  // The slot in the trailer is exactly as long as the cuts added together.
  gameplay: {
    file: 'assets/gameplay/gameplay.mp4',
    cuts: [[5.6, 27.3], [55.2, 62.6]],
    label: 'IN-GAME  //  MILKOMEDA',
  },

  // Screenshots shown as "field tests" before the footage. crop = [x, y, w, h]
  // in source pixels (used to keep debug chat out of frame).
  field: [
    { src: 'assets/screens/sunspear.jpg', caption: 'SUNSPEAR', crop: [196, 0, 1209, 680] },
    { src: 'assets/screens/apophis-hammer.jpg', caption: 'APOPHIS HAMMER', crop: [196, 0, 1209, 680] },
    { src: 'assets/screens/midas-maul.jpg', caption: 'MIDAS MAUL', crop: [196, 0, 1209, 680] },
    { src: 'assets/screens/uplink.jpg', caption: 'THE UPLINK', crop: [0, 0, 1600, 900] },
  ],
  // The in-game arsenal screen, shown arming the weapon in the footage.
  uplinkScreen: { src: 'assets/screens/uplink-arsenal.jpg', highlight: [1125, 640, 444, 62], arming: 'MILKOMEDA' },

  // ── The arsenal (all 18, in uplink order) ────────────────────────────────
  // icon: sun moon storm io hypercane ringed pulsar supernova blackhole galaxy twin
  //       comet asteroid snow swarm cluster rail pinwheel kilonova
  // dist: light-years from Earth (places it on the star map).
  arsenal: [
    { id: 'helios', key: '1', name: 'Helios Lance', sub: 'Dyson Mirror Ring · Sol', color: '#f6b23c', icon: 'sun', dist: 1.58e-5 },
    { id: 'betelgeuse', key: '2', name: 'Betelgeuse Requiem', sub: 'Supernova Shard Harvester', color: '#ff5a46', icon: 'supernova', dist: 550 },
    { id: 'sagittarius', key: '3', name: 'Sagittarius Maw', sub: 'Event Horizon Gate · Sgr A*', color: '#a98bff', icon: 'blackhole', dist: 26000 },
    { id: 'starquake', key: '4', name: 'Starquake Resonator', sub: 'SGR 1806-20 Flare Lance', color: '#5cc8ff', icon: 'pulsar', dist: 50000 },
    { id: 'lunar', key: '5', name: 'Lunar Tide Engine', sub: 'Far-Side Gravitic Array · Luna', color: '#dfe6ff', icon: 'moon', dist: 4.06e-8 },
    { id: 'plutonian', key: '6', name: 'Plutonian Winter', sub: 'Sputnik Cryo Siphon · Pluto', color: '#9fdcff', icon: 'snow', dist: 6e-4 },
    { id: 'tabby', key: '7', name: "Tabby's Swarm", sub: 'KIC 8462852 Dyson Swarm Seed', color: '#d6dbe6', icon: 'swarm', dist: 1470 },
    { id: 'apophis', key: '8', name: 'Apophis Redirect', sub: '99942 Apophis Thruster Harness', color: '#ff8a4a', icon: 'asteroid', dist: 1e-6 },
    { id: 'io', key: '9', name: 'Io Flux Tap', sub: 'Jovian Flux Tube Conduit', color: '#ffb43a', icon: 'io', dist: 8.2e-5 },
    { id: 'sirius', key: '0', name: 'Sirius Railgun', sub: 'Sirius B Degenerate Slug', color: '#6aa8ff', icon: 'rail', dist: 8.6 },
    { id: 'pleiades', key: '-', name: 'Seven Sisters', sub: 'Pleiades Starfire Constellation', color: '#7f9cff', icon: 'cluster', dist: 444 },
    { id: 'hypercane', key: '=', name: 'Jovian Hypercane', sub: 'Storm Siphon · Great Red Spot', color: '#ff9a5a', icon: 'hypercane', dist: 7.5e-5 },
    { id: 'ringfall', key: 'SHIFT+1', name: 'Ringfall', sub: 'Shepherd Fleet · Saturn', color: '#ffd27a', icon: 'ringed', dist: 1.5e-4 },
    { id: 'halley', key: 'SHIFT+2', name: "Halley's Return", sub: 'Comet Mass Driver · 1P/Halley', color: '#9fd4ff', icon: 'comet', dist: 5.5e-4 },
    { id: 'pinwheel', key: 'SHIFT+3', name: 'Pinwheel Burst', sub: 'Gamma-Ray Collimator · WR 104', color: '#e8eef8', icon: 'pinwheel', dist: 8000 },
    { id: 'kilonova', key: 'SHIFT+4', name: 'Kilonova Forge', sub: 'Merger Cage · GW170817', color: '#ffa040', icon: 'kilonova', dist: 1.3e8 },
    { id: 'andromeda', key: 'SHIFT+5', name: 'Andromeda Collision', sub: 'Tide Engine · M31', color: '#c58aff', icon: 'galaxy', dist: 2.5e6 },
    { id: 'milkomeda', key: 'SHIFT+6', name: 'Milkomeda', sub: 'Collider Array · Milky Way + M31', color: '#ffb050', icon: 'twin', dist: 2.6e6 },
  ],

  // ── Hero reveals (6 seconds each) ────────────────────────────────────────
  // type picks the animation: sun moon storm ringed pulsar supernova blackhole galaxy
  bodies: [
    {
      weapon: 'helios', type: 'sun',
      from: 'The Sun — G-type main-sequence star', distance: '1 AU from Earth',
      line: 'A ring of mirrors throws the Sun down one column of the world.',
      stats: [['CORE · REACH', '72 · 650'], ['RECHARGE', '180 S'], ['LEAVES BEHIND', 'GLASSED WASTE']],
    },
    {
      weapon: 'lunar', type: 'moon',
      from: "The Moon — Earth's only natural satellite", distance: '384,400 km from Earth',
      line: 'A gravitic array on the far side. The tides answer to you now.',
      stats: [],
    },
    {
      weapon: 'io', type: 'storm',
      from: 'The Io–Jupiter flux tube', distance: '~5 AU from Earth',
      line: 'Five million amperes, earthed into our mantle.',
      stats: [['CORE · REACH', '260 · 800'], ['RECHARGE', '360 S']],
    },
    {
      weapon: 'ringfall', type: 'ringed',
      from: 'Saturn — the ringed giant', distance: '8–11 AU from Earth',
      line: 'A shepherd fleet, and every ring of Saturn, brought down.',
      stats: [],
    },
    {
      weapon: 'starquake', type: 'pulsar',
      from: 'SGR 1806-20 — a magnetar', distance: '~50,000 ly from Earth',
      line: "A starquake on a magnetar, focused into a lance.",
      stats: [],
    },
    {
      weapon: 'betelgeuse', type: 'supernova',
      from: 'Betelgeuse — red supergiant in Orion', distance: '~550 ly from Earth',
      line: 'A supernova, harvested shard by shard.',
      stats: [],
    },
    {
      weapon: 'sagittarius', type: 'blackhole',
      from: 'Sagittarius A* — the black hole at the heart of the Milky Way', distance: '~26,000 ly from Earth',
      line: 'A gate onto the event horizon. Everything goes in.',
      stats: [],
    },
    {
      weapon: 'andromeda', type: 'galaxy',
      from: 'Andromeda Galaxy — M31, a trillion stars falling toward us', distance: '2.5 million ly from Earth',
      line: 'The collision with the Milky Way, four and a half billion years early.',
      stats: [['CORE · REACH', '90 · 900'], ['RECHARGE', '900 S'], ['LEAVES BEHIND', 'GALACTIC SCAR']],
    },
  ],

  // ── The combat simulation's three test items ─────────────────────────────
  sim: [
    { name: 'SUNSPEAR', note: 'TEST 01 // SOLAR', color: '#ffb43a', icon: 'sun' },
    { name: 'APOPHIS HAMMER', note: 'TEST 02 // IMPACT', color: '#ff8a4a', icon: 'asteroid' },
    { name: 'THE UPLINK', note: 'ARMING: SAGITTARIUS MAW', color: '#a98bff', icon: 'blackhole' },
  ],
};

// Fill in each hero's weapon details from the arsenal list.
for (const b of CONFIG.bodies) Object.assign(b, { ...CONFIG.arsenal.find((w) => w.id === b.weapon), ...b });

const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
  'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
export const numberWord = (n) => WORDS[n] ?? String(n);

// ── The AI's lines ──────────────────────────────────────────────────────────
// Times are seconds from the start of each scene. Wrap a word in [brackets] to
// highlight it in red.
export function aiScript(cfg) {
  const n = numberWord(cfg.arsenal.length);
  return {
    intro: [
      [0.6, 3.8, 'Hello, Operator.'],
      [4.2, 8.9, 'For ten thousand years, your kind has looked up at the sky...'],
      [9.2, 12.2, '...and seen only light.'],
      [12.7, 15.2, 'I looked up...'],
      [15.3, 19.6, '...and saw [AMMUNITION].', { big: true }],
    ],
    starmap: [
      [1.0, 5.6, `I have found ${n} sources of infinite power.`],
      [6.0, 7.9, 'Harvested them.'],
      [8.1, 10.0, 'Contained them.'],
      [10.2, 13.6, '[Weaponized] them.'],
    ],
    sim: [
      [3.8, 7.4, 'Welcome to the Celestial Calibration Chamber.'],
      [7.8, 10.6, 'Please do not look directly at the [Sunspear].'],
      [11.0, 12.9, 'Hostiles detected. Proceed.'],
      [16.2, 17.9, 'Excellent.'],
      [18.2, 20.6, 'Next test: the Apophis Hammer.'],
      [24.1, 27.4, 'And finally... the uplink. Arming [Sagittarius Maw].'],
      [28.6, 31.8, 'Hold still. This will only hurt forever.'],
    ],
    deploy: [
      [0.2, 2.1, 'Simulation complete.'],
      [2.1, 4.6, 'Deploying arsenal to the Overworld...'],
    ],
  };
}

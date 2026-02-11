import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ═══════════════════════════════════════════════════
// 0. SUPABASE CLIENT
// ═══════════════════════════════════════════════════
const SUPABASE_URL = 'https://nyrzmcjjgmtdvvdtfdld.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55cnptY2pqZ210ZHZ2ZHRmZGxkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4MDk3MjIsImV4cCI6MjA4NjM4NTcyMn0.yZzbyuuSPXo08kj9YceRLq2vPVX_oiC1rakpZeb_T_c';
const sbClient = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

// ═══════════════════════════════════════════════════
// 1. CONSTANTS & CONFIG
// ═══════════════════════════════════════════════════
const PRESS_SPEED = 0.004;   // Approach speed (slower, more dramatic)
const CRUSH_SPEED = 0.0006;  // Crush speed (slow, visible animation)
const PISTON_TRAVEL = 5.0;   // Head goes from Y=2.2 to Y=-2.8 (well past platform)
const PLATFORM_Y = -2.0;
const PLATFORM_TOP = PLATFORM_Y + 0.45;  // Actual top surface of platform (base 0.3 + platform 0.15)
const OBJ_Y = PLATFORM_TOP;              // Objects sit on platform surface
const PISTON_START_Y = 3.2;
const SAVE_KEY = 'pressit_save';

let scene, camera, renderer, controls;
let pressGroup, pistonGroup, platformMesh, pressHeadMesh;
let currentObject = null;
let selectedObjId = 'watermelon';
let isHolding = false;
let pressProgress = 0;
let isRetracting = false;
let crushCount = 0;
let particles = [];
let sparks = [];
let fragments = [];
let shakeAmount = 0;
let crushSoundPlayed = false;
let crushCtx = {};
let pressCeilingY = 99;  // Y position of press head bottom — particles can't go above this
let ambientHumOsc = null;
let audioCtx = null;
let recentObjects = ['watermelon'];

// ═══════════════════════════════════════════════════
// 2. CATEGORIES & OBJECTS
// ═══════════════════════════════════════════════════
const CATEGORIES = [
  { id: 'all', name: 'Alle', icon: '📦' },
  { id: 'fruit', name: 'Obst', icon: '🍎' },
  { id: 'metal_can', name: 'Metall', icon: '🥫' },
  { id: 'glass', name: 'Glas', icon: '🍷' },
  { id: 'wood', name: 'Holz', icon: '🪵' },
  { id: 'plastic', name: 'Plastik', icon: '🧴' },
  { id: 'electronics', name: 'Elektronik', icon: '📱' },
  { id: 'food', name: 'Essen', icon: '🍰' },
  { id: 'rubber', name: 'Gummi', icon: '🦆' },
  { id: 'stone', name: 'Stein', icon: '🪨' },
  { id: 'toy', name: 'Spielzeug', icon: '🧸' },
  { id: 'paper', name: 'Papier', icon: '📚' },
  { id: 'wax', name: 'Wachs', icon: '🕯️' },
];

const OBJECTS = [
  // ── FRUIT (17) ──────────────────────────────────
  { id:'watermelon', name:'Wassermelone', icon:'🍉', cat:'fruit', price:0, reward:5, crush:'splat', sound:'wet', sp:{pitch:0.5, dur:1.4, noise:0.9, res:400, attack:0.005, decay:1.3, harmonics:2}, p:{r:0.5, c:'#2d7a2d', ic:'#ff3344', elong:0.85, stem:true} },
  { id:'apple', name:'Apfel', icon:'🍎', cat:'fruit', price:20, reward:5, crush:'splat', sound:'wet', sp:{pitch:1.0, dur:0.9, noise:0.7, res:650, attack:0.01, decay:0.9, harmonics:2}, p:{r:0.22, c:'#cc2222', ic:'#ffffcc', elong:0.95, stem:true} },
  { id:'orange', name:'Orange', icon:'🍊', cat:'fruit', price:25, reward:5, crush:'splat', sound:'wet', sp:{pitch:0.85, dur:1.0, noise:0.8, res:550, attack:0.01, decay:1.0, harmonics:3}, p:{r:0.24, c:'#ff8800', ic:'#ffcc66', elong:1.0, stem:false} },
  { id:'lemon', name:'Zitrone', icon:'🍋', cat:'fruit', price:30, reward:6, crush:'splat', sound:'wet', sp:{pitch:1.3, dur:0.7, noise:0.75, res:800, attack:0.008, decay:0.7, harmonics:2}, p:{r:0.2, c:'#ffee00', ic:'#ffffaa', elong:1.15, stem:false} },
  { id:'banana', name:'Banane', icon:'🍌', cat:'fruit', price:35, reward:7, crush:'splat', sound:'wet', sp:{pitch:1.1, dur:0.8, noise:0.6, res:500, attack:0.02, decay:0.8, harmonics:1}, p:{r:0.15, c:'#ffe135', ic:'#fff8dc', elong:1.5, stem:true} },
  { id:'cherry', name:'Kirsche', icon:'🍒', cat:'fruit', price:40, reward:8, crush:'splat', sound:'wet', sp:{pitch:1.8, dur:0.5, noise:0.65, res:900, attack:0.005, decay:0.5, harmonics:2}, p:{r:0.15, c:'#8b0000', ic:'#cc3333', elong:1.0, stem:true} },
  { id:'strawberry', name:'Erdbeere', icon:'🍓', cat:'fruit', price:45, reward:9, crush:'splat', sound:'wet', sp:{pitch:1.5, dur:0.6, noise:0.7, res:750, attack:0.008, decay:0.6, harmonics:2}, p:{r:0.18, c:'#ff2233', ic:'#ff8899', elong:1.1, stem:true} },
  { id:'pear', name:'Birne', icon:'🍐', cat:'fruit', price:50, reward:10, crush:'splat', sound:'wet', sp:{pitch:0.9, dur:1.0, noise:0.65, res:580, attack:0.012, decay:1.0, harmonics:2}, p:{r:0.22, c:'#a4c639', ic:'#fffff0', elong:1.2, stem:true} },
  { id:'peach', name:'Pfirsich', icon:'🍑', cat:'fruit', price:55, reward:11, crush:'splat', sound:'wet', sp:{pitch:0.95, dur:0.9, noise:0.75, res:620, attack:0.01, decay:0.85, harmonics:3}, p:{r:0.23, c:'#ffcc99', ic:'#ffeeaa', elong:0.95, stem:true} },
  { id:'grape', name:'Traube', icon:'🍇', cat:'fruit', price:60, reward:12, crush:'splat', sound:'wet', sp:{pitch:1.9, dur:0.4, noise:0.6, res:950, attack:0.005, decay:0.4, harmonics:1}, p:{r:0.16, c:'#6b2fa0', ic:'#bb88dd', elong:1.0, stem:true} },
  { id:'kiwi', name:'Kiwi', icon:'🥝', cat:'fruit', price:65, reward:13, crush:'splat', sound:'wet', sp:{pitch:1.2, dur:0.7, noise:0.7, res:700, attack:0.01, decay:0.7, harmonics:2}, p:{r:0.18, c:'#8b6914', ic:'#77bb33', elong:1.05, stem:false} },
  { id:'mango', name:'Mango', icon:'🥭', cat:'fruit', price:70, reward:14, crush:'splat', sound:'wet', sp:{pitch:0.8, dur:1.1, noise:0.85, res:500, attack:0.015, decay:1.1, harmonics:3}, p:{r:0.25, c:'#ff9933', ic:'#ffcc00', elong:1.15, stem:true} },
  { id:'pineapple', name:'Ananas', icon:'🍍', cat:'fruit', price:80, reward:16, crush:'splat', sound:'wet', sp:{pitch:0.7, dur:1.2, noise:0.8, res:480, attack:0.01, decay:1.2, harmonics:3}, p:{r:0.28, c:'#cc9922', ic:'#ffee77', elong:1.3, stem:true} },
  { id:'pomegranate', name:'Granatapfel', icon:'🫐', cat:'fruit', price:90, reward:18, crush:'splat', sound:'wet', sp:{pitch:0.75, dur:1.3, noise:0.9, res:520, attack:0.008, decay:1.1, harmonics:4}, p:{r:0.25, c:'#991133', ic:'#ff3355', elong:0.95, stem:true} },
  { id:'coconut', name:'Kokosnuss', icon:'🥥', cat:'fruit', price:100, reward:20, crush:'splat', sound:'wet', sp:{pitch:0.4, dur:1.5, noise:0.5, res:350, attack:0.005, decay:1.5, harmonics:2}, p:{r:0.28, c:'#8b4513', ic:'#ffffff', elong:1.0, stem:false} },
  { id:'pumpkin', name:'Kuerbis', icon:'🎃', cat:'fruit', price:120, reward:24, crush:'splat', sound:'wet', sp:{pitch:0.45, dur:1.6, noise:0.85, res:380, attack:0.005, decay:1.4, harmonics:3}, p:{r:0.45, c:'#ff7700', ic:'#ffaa33', elong:0.8, stem:true} },
  { id:'plum', name:'Pflaume', icon:'🫐', cat:'fruit', price:35, reward:7, crush:'splat', sound:'wet', sp:{pitch:1.4, dur:0.6, noise:0.7, res:720, attack:0.008, decay:0.6, harmonics:2}, p:{r:0.17, c:'#4a0080', ic:'#cc88ff', elong:1.05, stem:true} },

  // ── METAL_CAN (17) ──────────────────────────────
  { id:'tin_can', name:'Blechdose', icon:'🥫', cat:'metal_can', price:40, reward:8, crush:'crumple', sound:'metallic', sp:{pitch:1.2, dur:0.8, noise:0.4, res:1200, attack:0.005, decay:0.9, harmonics:3}, p:{h:0.4, r:0.15, c:'#cccccc', rimC:'#aaaaaa'} },
  { id:'beer_can', name:'Bierdose', icon:'🍺', cat:'metal_can', price:50, reward:10, crush:'crumple', sound:'metallic', sp:{pitch:1.1, dur:0.7, noise:0.35, res:1100, attack:0.005, decay:0.8, harmonics:3}, p:{h:0.45, r:0.13, c:'#daa520', rimC:'#c0c0c0'} },
  { id:'soda_can', name:'Limodose', icon:'🥤', cat:'metal_can', price:55, reward:11, crush:'crumple', sound:'metallic', sp:{pitch:1.3, dur:0.6, noise:0.4, res:1300, attack:0.003, decay:0.7, harmonics:4}, p:{h:0.45, r:0.13, c:'#ff0000', rimC:'#c0c0c0'} },
  { id:'coffee_can', name:'Kaffeedose', icon:'☕', cat:'metal_can', price:55, reward:11, crush:'crumple', sound:'metallic', sp:{pitch:0.8, dur:1.0, noise:0.3, res:900, attack:0.008, decay:1.1, harmonics:3}, p:{h:0.5, r:0.16, c:'#4a2f1b', rimC:'#8b7355'} },
  { id:'energy_drink', name:'Energydrink', icon:'⚡', cat:'metal_can', price:60, reward:12, crush:'crumple', sound:'metallic', sp:{pitch:1.4, dur:0.5, noise:0.45, res:1400, attack:0.003, decay:0.6, harmonics:4}, p:{h:0.5, r:0.12, c:'#00ff00', rimC:'#c0c0c0'} },
  { id:'tea_tin', name:'Teedose', icon:'🍵', cat:'metal_can', price:60, reward:12, crush:'crumple', sound:'metallic', sp:{pitch:1.0, dur:0.9, noise:0.3, res:1050, attack:0.006, decay:1.0, harmonics:3}, p:{h:0.35, r:0.14, c:'#228b22', rimC:'#daa520'} },
  { id:'cookie_tin', name:'Keksdose', icon:'🍪', cat:'metal_can', price:65, reward:13, crush:'crumple', sound:'metallic', sp:{pitch:0.9, dur:1.1, noise:0.35, res:950, attack:0.008, decay:1.2, harmonics:4}, p:{h:0.3, r:0.2, c:'#b22222', rimC:'#daa520'} },
  { id:'paint_can', name:'Farbdose', icon:'🎨', cat:'metal_can', price:70, reward:14, crush:'crumple', sound:'metallic', sp:{pitch:0.7, dur:1.2, noise:0.5, res:800, attack:0.005, decay:1.3, harmonics:3}, p:{h:0.5, r:0.18, c:'#4169e1', rimC:'#c0c0c0'} },
  { id:'spray_can', name:'Spruuhdose', icon:'🧴', cat:'metal_can', price:75, reward:15, crush:'crumple', sound:'metallic', sp:{pitch:1.5, dur:0.6, noise:0.6, res:1500, attack:0.003, decay:0.5, harmonics:4}, p:{h:0.55, r:0.12, c:'#ff4500', rimC:'#808080'} },
  { id:'oil_can', name:'Oeldose', icon:'🛢️', cat:'metal_can', price:85, reward:17, crush:'crumple', sound:'metallic', sp:{pitch:0.6, dur:1.3, noise:0.4, res:700, attack:0.008, decay:1.4, harmonics:3}, p:{h:0.6, r:0.15, c:'#333333', rimC:'#666666'} },
  { id:'bucket_metal', name:'Metalleimer', icon:'🪣', cat:'metal_can', price:100, reward:20, crush:'crumple', sound:'metallic', sp:{pitch:0.65, dur:1.4, noise:0.45, res:750, attack:0.006, decay:1.5, harmonics:4}, p:{h:0.5, r:0.22, c:'#808080', rimC:'#a9a9a9'} },
  { id:'milk_can', name:'Milchkanne', icon:'🥛', cat:'metal_can', price:120, reward:24, crush:'crumple', sound:'metallic', sp:{pitch:0.55, dur:1.5, noise:0.35, res:650, attack:0.008, decay:1.6, harmonics:4}, p:{h:0.7, r:0.2, c:'#f5f5f5', rimC:'#c0c0c0'} },
  { id:'watering_can', name:'Giesskanne', icon:'🚿', cat:'metal_can', price:130, reward:26, crush:'crumple', sound:'metallic', sp:{pitch:0.75, dur:1.2, noise:0.4, res:850, attack:0.006, decay:1.3, harmonics:3}, p:{h:0.5, r:0.2, c:'#2e8b57', rimC:'#3cb371'} },
  { id:'trash_can', name:'Muelltonne', icon:'🗑️', cat:'metal_can', price:150, reward:30, crush:'crumple', sound:'metallic', sp:{pitch:0.4, dur:1.8, noise:0.5, res:500, attack:0.005, decay:1.8, harmonics:3}, p:{h:0.8, r:0.25, c:'#696969', rimC:'#a9a9a9'} },
  { id:'gas_can', name:'Benzinkanister', icon:'⛽', cat:'metal_can', price:160, reward:32, crush:'crumple', sound:'metallic', sp:{pitch:0.5, dur:1.5, noise:0.55, res:600, attack:0.005, decay:1.6, harmonics:4}, p:{h:0.6, r:0.2, c:'#cc0000', rimC:'#8b0000'} },
  { id:'toolbox', name:'Werkzeugkasten', icon:'🧰', cat:'metal_can', price:180, reward:36, crush:'crumple', sound:'metallic', sp:{pitch:0.45, dur:1.6, noise:0.5, res:550, attack:0.005, decay:1.7, harmonics:5}, p:{h:0.4, r:0.25, c:'#b22222', rimC:'#8b0000'} },
  { id:'ammo_box', name:'Munitionskiste', icon:'📦', cat:'metal_can', price:200, reward:40, crush:'crumple', sound:'metallic', sp:{pitch:0.35, dur:1.8, noise:0.45, res:450, attack:0.003, decay:1.9, harmonics:5}, p:{h:0.35, r:0.22, c:'#556b2f', rimC:'#6b8e23'} },

  // ── GLASS (17) ──────────────────────────────────
  { id:'marble_glass', name:'Murmel', icon:'🔮', cat:'glass', price:30, reward:6, crush:'shatter', sound:'shatter', sp:{pitch:2.0, dur:0.5, noise:0.3, res:4000, attack:0.002, decay:0.4, harmonics:3}, p:{h:0.2, r:0.1, c:'#4488ff', neck:0} },
  { id:'drinking_glass', name:'Trinkglas', icon:'🥛', cat:'glass', price:40, reward:8, crush:'shatter', sound:'shatter', sp:{pitch:1.6, dur:0.8, noise:0.5, res:3500, attack:0.003, decay:0.7, harmonics:4}, p:{h:0.4, r:0.15, c:'#ddeeff', neck:0} },
  { id:'light_bulb', name:'Gluehbirne', icon:'💡', cat:'glass', price:45, reward:9, crush:'shatter', sound:'shatter', sp:{pitch:1.8, dur:0.4, noise:0.6, res:4500, attack:0.002, decay:0.3, harmonics:5}, p:{h:0.35, r:0.15, c:'#ffffee', neck:0.3} },
  { id:'beer_bottle', name:'Bierflasche', icon:'🍺', cat:'glass', price:50, reward:10, crush:'shatter', sound:'shatter', sp:{pitch:1.2, dur:0.9, noise:0.55, res:2800, attack:0.005, decay:0.8, harmonics:4}, p:{h:0.6, r:0.12, c:'#4a3728', neck:0.35} },
  { id:'mason_jar', name:'Einmachglas', icon:'🫙', cat:'glass', price:55, reward:11, crush:'shatter', sound:'shatter', sp:{pitch:1.3, dur:0.85, noise:0.5, res:3000, attack:0.004, decay:0.9, harmonics:4}, p:{h:0.45, r:0.16, c:'#ddeedd', neck:0.1} },
  { id:'wine_bottle', name:'Weinflasche', icon:'🍷', cat:'glass', price:60, reward:12, crush:'shatter', sound:'shatter', sp:{pitch:1.1, dur:1.0, noise:0.5, res:2600, attack:0.005, decay:1.0, harmonics:4}, p:{h:0.7, r:0.12, c:'#2d5a27', neck:0.4} },
  { id:'test_tube', name:'Reagenzglas', icon:'🧪', cat:'glass', price:65, reward:13, crush:'shatter', sound:'shatter', sp:{pitch:2.2, dur:0.3, noise:0.4, res:5000, attack:0.001, decay:0.3, harmonics:3}, p:{h:0.5, r:0.06, c:'#eeffee', neck:0} },
  { id:'wine_glass', name:'Weinglas', icon:'🍷', cat:'glass', price:70, reward:14, crush:'shatter', sound:'shatter', sp:{pitch:1.7, dur:0.7, noise:0.45, res:3800, attack:0.003, decay:0.8, harmonics:5}, p:{h:0.5, r:0.14, c:'#eeeeff', neck:0.15} },
  { id:'mirror', name:'Spiegel', icon:'🪞', cat:'glass', price:80, reward:16, crush:'shatter', sound:'shatter', sp:{pitch:1.5, dur:0.6, noise:0.7, res:3200, attack:0.002, decay:0.5, harmonics:5}, p:{h:0.6, r:0.3, c:'#c0c0c0', neck:0} },
  { id:'magnifier', name:'Lupe', icon:'🔍', cat:'glass', price:85, reward:17, crush:'shatter', sound:'shatter', sp:{pitch:1.9, dur:0.5, noise:0.35, res:4200, attack:0.002, decay:0.4, harmonics:4}, p:{h:0.35, r:0.18, c:'#ddddff', neck:0} },
  { id:'vase', name:'Vase', icon:'🏺', cat:'glass', price:90, reward:18, crush:'shatter', sound:'shatter', sp:{pitch:1.0, dur:1.1, noise:0.55, res:2400, attack:0.005, decay:1.1, harmonics:4}, p:{h:0.55, r:0.18, c:'#cc6633', neck:0.25} },
  { id:'glasses', name:'Brille', icon:'👓', cat:'glass', price:100, reward:20, crush:'shatter', sound:'shatter', sp:{pitch:2.1, dur:0.35, noise:0.3, res:4800, attack:0.001, decay:0.3, harmonics:3}, p:{h:0.2, r:0.12, c:'#333333', neck:0} },
  { id:'window_pane', name:'Fensterscheibe', icon:'🪟', cat:'glass', price:110, reward:22, crush:'shatter', sound:'shatter', sp:{pitch:1.4, dur:0.9, noise:0.65, res:3000, attack:0.003, decay:0.7, harmonics:5}, p:{h:0.6, r:0.4, c:'#aaddff', neck:0} },
  { id:'perfume_bottle', name:'Parfuemflasche', icon:'🧴', cat:'glass', price:120, reward:24, crush:'shatter', sound:'shatter', sp:{pitch:1.85, dur:0.5, noise:0.4, res:4400, attack:0.002, decay:0.5, harmonics:4}, p:{h:0.35, r:0.12, c:'#ffccee', neck:0.3} },
  { id:'snow_globe', name:'Schneekugel', icon:'🔮', cat:'glass', price:150, reward:30, crush:'shatter', sound:'shatter', sp:{pitch:1.3, dur:1.2, noise:0.6, res:2800, attack:0.004, decay:1.2, harmonics:5}, p:{h:0.35, r:0.2, c:'#ddeeff', neck:0} },
  { id:'crystal_ball', name:'Kristallkugel', icon:'🔮', cat:'glass', price:200, reward:40, crush:'shatter', sound:'shatter', sp:{pitch:1.6, dur:1.0, noise:0.35, res:3600, attack:0.002, decay:1.3, harmonics:5}, p:{h:0.3, r:0.25, c:'#bbaaff', neck:0} },
  { id:'aquarium', name:'Aquarium', icon:'🐠', cat:'glass', price:250, reward:50, crush:'shatter', sound:'shatter', sp:{pitch:0.9, dur:1.5, noise:0.7, res:2200, attack:0.005, decay:1.5, harmonics:5}, p:{h:0.5, r:0.35, c:'#88ccff', neck:0} },

  // ── WOOD (17) ────────────────────────────────────
  { id:'dowel', name:'Duebel', icon:'🪵', cat:'wood', price:20, reward:5, crush:'crack', sound:'wood_crack', sp:{pitch:1.5, dur:0.5, noise:0.6, res:1800, attack:0.003, decay:0.4, harmonics:2}, p:{w:0.1, h:0.4, d:0.1, c:'#d2b48c'} },
  { id:'wood_block', name:'Holzklotz', icon:'🪵', cat:'wood', price:25, reward:5, crush:'crack', sound:'wood_crack', sp:{pitch:0.7, dur:0.9, noise:0.7, res:1200, attack:0.005, decay:0.8, harmonics:2}, p:{w:0.3, h:0.3, d:0.3, c:'#deb887'} },
  { id:'pencil', name:'Bleistift', icon:'✏️', cat:'wood', price:30, reward:6, crush:'crack', sound:'wood_crack', sp:{pitch:2.0, dur:0.3, noise:0.5, res:2200, attack:0.002, decay:0.3, harmonics:1}, p:{w:0.05, h:0.6, d:0.05, c:'#f4c430'} },
  { id:'wooden_spoon', name:'Holzloeffel', icon:'🥄', cat:'wood', price:35, reward:7, crush:'crack', sound:'wood_crack', sp:{pitch:1.3, dur:0.6, noise:0.55, res:1600, attack:0.004, decay:0.5, harmonics:2}, p:{w:0.1, h:0.5, d:0.08, c:'#c4a35a'} },
  { id:'hanger_wood', name:'Kleiderbuegel', icon:'🪝', cat:'wood', price:35, reward:7, crush:'crack', sound:'wood_crack', sp:{pitch:1.6, dur:0.4, noise:0.5, res:1900, attack:0.003, decay:0.4, harmonics:2}, p:{w:0.5, h:0.3, d:0.05, c:'#b5895a'} },
  { id:'broom_handle', name:'Besenstiel', icon:'🧹', cat:'wood', price:40, reward:8, crush:'crack', sound:'wood_crack', sp:{pitch:1.1, dur:0.7, noise:0.65, res:1500, attack:0.003, decay:0.6, harmonics:3}, p:{w:0.08, h:1.0, d:0.08, c:'#c9a96e'} },
  { id:'rolling_pin', name:'Nudelholz', icon:'🪵', cat:'wood', price:45, reward:9, crush:'crack', sound:'wood_crack', sp:{pitch:0.9, dur:0.8, noise:0.6, res:1400, attack:0.005, decay:0.7, harmonics:2}, p:{w:0.12, h:0.5, d:0.12, c:'#d2b48c'} },
  { id:'cutting_board', name:'Schneidebrett', icon:'🪵', cat:'wood', price:50, reward:10, crush:'crack', sound:'wood_crack', sp:{pitch:0.8, dur:1.0, noise:0.7, res:1300, attack:0.005, decay:0.9, harmonics:3}, p:{w:0.5, h:0.1, d:0.35, c:'#bc8f5f'} },
  { id:'picture_frame', name:'Bilderrahmen', icon:'🖼️', cat:'wood', price:70, reward:14, crush:'crack', sound:'wood_crack', sp:{pitch:1.4, dur:0.5, noise:0.55, res:1700, attack:0.003, decay:0.5, harmonics:3}, p:{w:0.5, h:0.6, d:0.05, c:'#8b6914'} },
  { id:'wood_crate', name:'Holzkiste', icon:'📦', cat:'wood', price:80, reward:16, crush:'crack', sound:'wood_crack', sp:{pitch:0.6, dur:1.2, noise:0.75, res:1100, attack:0.005, decay:1.1, harmonics:3}, p:{w:0.5, h:0.4, d:0.4, c:'#a0825a'} },
  { id:'clog', name:'Holzschuh', icon:'👞', cat:'wood', price:90, reward:18, crush:'crack', sound:'wood_crack', sp:{pitch:1.0, dur:0.7, noise:0.6, res:1400, attack:0.005, decay:0.7, harmonics:2}, p:{w:0.3, h:0.2, d:0.15, c:'#c68e3f'} },
  { id:'baseball_bat', name:'Baseballschlaeger', icon:'🏏', cat:'wood', price:100, reward:20, crush:'crack', sound:'wood_crack', sp:{pitch:0.75, dur:1.0, noise:0.7, res:1200, attack:0.004, decay:0.9, harmonics:3}, p:{w:0.1, h:0.8, d:0.1, c:'#d4a76a'} },
  { id:'chair', name:'Stuhl', icon:'🪑', cat:'wood', price:120, reward:24, crush:'crack', sound:'wood_crack', sp:{pitch:0.5, dur:1.4, noise:0.8, res:1000, attack:0.005, decay:1.3, harmonics:4}, p:{w:0.5, h:0.8, d:0.5, c:'#8b5e3c'} },
  { id:'birdhouse', name:'Vogelhaus', icon:'🏠', cat:'wood', price:150, reward:30, crush:'crack', sound:'wood_crack', sp:{pitch:0.65, dur:1.2, noise:0.7, res:1100, attack:0.005, decay:1.1, harmonics:3}, p:{w:0.35, h:0.45, d:0.3, c:'#a0522d'} },
  { id:'table_top', name:'Tischplatte', icon:'🪵', cat:'wood', price:160, reward:32, crush:'crack', sound:'wood_crack', sp:{pitch:0.45, dur:1.5, noise:0.75, res:900, attack:0.005, decay:1.4, harmonics:3}, p:{w:0.8, h:0.1, d:0.6, c:'#8b6c42'} },
  { id:'ladder', name:'Leiter', icon:'🪜', cat:'wood', price:180, reward:36, crush:'crack', sound:'wood_crack', sp:{pitch:0.55, dur:1.3, noise:0.8, res:1050, attack:0.005, decay:1.2, harmonics:4}, p:{w:0.4, h:1.0, d:0.15, c:'#b5895a'} },
  { id:'xylophone', name:'Xylophon', icon:'🎵', cat:'wood', price:200, reward:40, crush:'crack', sound:'wood_crack', sp:{pitch:1.2, dur:0.8, noise:0.4, res:2000, attack:0.003, decay:1.0, harmonics:5}, p:{w:0.6, h:0.15, d:0.35, c:'#cd853f'} },

  // ── PLASTIC (17) ─────────────────────────────────
  { id:'cable_tie', name:'Kabelbinder', icon:'🔗', cat:'plastic', price:15, reward:5, crush:'crush', sound:'pop', sp:{pitch:1.8,dur:0.3,noise:0.3,res:1800,attack:0.002,decay:0.3,harmonics:1}, p:{w:0.3, h:0.05, d:0.02, c:'#222222', shiny:false} },
  { id:'clothespin', name:'Waescheklammer', icon:'📌', cat:'plastic', price:20, reward:5, crush:'crush', sound:'pop', sp:{pitch:1.6,dur:0.4,noise:0.35,res:1600,attack:0.003,decay:0.4,harmonics:2}, p:{w:0.1, h:0.25, d:0.05, c:'#ff6699', shiny:false} },
  { id:'plastic_cup', name:'Plastikbecher', icon:'🥤', cat:'plastic', price:20, reward:5, crush:'crush', sound:'pop', sp:{pitch:1.4,dur:0.5,noise:0.4,res:1400,attack:0.003,decay:0.5,harmonics:2}, p:{w:0.15, h:0.3, d:0.15, c:'#ff0000', shiny:true} },
  { id:'toothbrush', name:'Zahnbuerste', icon:'🪥', cat:'plastic', price:25, reward:5, crush:'crush', sound:'pop', sp:{pitch:1.9,dur:0.3,noise:0.3,res:2000,attack:0.002,decay:0.3,harmonics:2}, p:{w:0.05, h:0.5, d:0.05, c:'#00aaff', shiny:true} },
  { id:'yogurt_cup', name:'Joghurtbecher', icon:'🥛', cat:'plastic', price:25, reward:5, crush:'crush', sound:'pop', sp:{pitch:1.5,dur:0.4,noise:0.4,res:1500,attack:0.003,decay:0.4,harmonics:1}, p:{w:0.15, h:0.2, d:0.15, c:'#ffffff', shiny:false} },
  { id:'plastic_plate', name:'Plastikteller', icon:'🍽️', cat:'plastic', price:25, reward:5, crush:'crush', sound:'pop', sp:{pitch:1.3,dur:0.5,noise:0.35,res:1300,attack:0.003,decay:0.5,harmonics:2}, p:{w:0.4, h:0.05, d:0.4, c:'#ffcc00', shiny:true} },
  { id:'hanger_plastic', name:'Plastikbuegel', icon:'🪝', cat:'plastic', price:30, reward:6, crush:'crush', sound:'pop', sp:{pitch:1.7,dur:0.4,noise:0.3,res:1700,attack:0.002,decay:0.4,harmonics:2}, p:{w:0.5, h:0.3, d:0.03, c:'#ff00ff', shiny:true} },
  { id:'sand_mold', name:'Sandform', icon:'🏖️', cat:'plastic', price:30, reward:6, crush:'crush', sound:'pop', sp:{pitch:1.2,dur:0.6,noise:0.45,res:1200,attack:0.005,decay:0.6,harmonics:2}, p:{w:0.2, h:0.15, d:0.2, c:'#ff4444', shiny:true} },
  { id:'flyswatter', name:'Fliegenklatsche', icon:'🪰', cat:'plastic', price:35, reward:7, crush:'crush', sound:'pop', sp:{pitch:1.6,dur:0.35,noise:0.4,res:1650,attack:0.002,decay:0.35,harmonics:1}, p:{w:0.2, h:0.6, d:0.02, c:'#33cc33', shiny:false} },
  { id:'water_bottle', name:'Wasserflasche', icon:'🧴', cat:'plastic', price:40, reward:8, crush:'crush', sound:'pop', sp:{pitch:1.1,dur:0.7,noise:0.5,res:1100,attack:0.005,decay:0.7,harmonics:2}, p:{w:0.12, h:0.6, d:0.12, c:'#66ccff', shiny:true} },
  { id:'dustpan', name:'Kehrschaufel', icon:'🧹', cat:'plastic', price:45, reward:9, crush:'crush', sound:'pop', sp:{pitch:1.0,dur:0.8,noise:0.5,res:1000,attack:0.005,decay:0.8,harmonics:2}, p:{w:0.35, h:0.1, d:0.35, c:'#228833', shiny:false} },
  { id:'frisbee', name:'Frisbee', icon:'🥏', cat:'plastic', price:50, reward:10, crush:'crush', sound:'pop', sp:{pitch:1.5,dur:0.4,noise:0.35,res:1550,attack:0.003,decay:0.4,harmonics:2}, p:{w:0.5, h:0.05, d:0.5, c:'#ff6600', shiny:true} },
  { id:'tupperware', name:'Tupperware', icon:'📦', cat:'plastic', price:50, reward:10, crush:'crush', sound:'pop', sp:{pitch:1.2,dur:0.6,noise:0.4,res:1250,attack:0.005,decay:0.6,harmonics:2}, p:{w:0.3, h:0.15, d:0.2, c:'#33bbff', shiny:true} },
  { id:'soap_dispenser', name:'Seifenspender', icon:'🧴', cat:'plastic', price:55, reward:11, crush:'crush', sound:'pop', sp:{pitch:1.0,dur:0.7,noise:0.5,res:1050,attack:0.005,decay:0.7,harmonics:3}, p:{w:0.12, h:0.4, d:0.12, c:'#ee88cc', shiny:true} },
  { id:'bucket_plastic', name:'Plastikeimer', icon:'🪣', cat:'plastic', price:60, reward:12, crush:'crush', sound:'pop', sp:{pitch:0.8,dur:0.9,noise:0.55,res:900,attack:0.005,decay:0.9,harmonics:2}, p:{w:0.3, h:0.35, d:0.3, c:'#ff4444', shiny:false} },
  { id:'water_gun', name:'Wasserpistole', icon:'🔫', cat:'plastic', price:70, reward:14, crush:'crush', sound:'pop', sp:{pitch:1.3,dur:0.5,noise:0.45,res:1350,attack:0.003,decay:0.5,harmonics:3}, p:{w:0.35, h:0.25, d:0.1, c:'#00cc44', shiny:true} },
  { id:'traffic_cone', name:'Verkehrskegel', icon:'🔶', cat:'plastic', price:80, reward:16, crush:'crush', sound:'pop', sp:{pitch:0.7,dur:1.0,noise:0.5,res:800,attack:0.005,decay:1.0,harmonics:2}, p:{w:0.25, h:0.5, d:0.25, c:'#ff6600', shiny:true} },

  // ── ELECTRONICS (17) ─────────────────────────────
  { id:'usb_stick', name:'USB-Stick', icon:'💾', cat:'electronics', price:35, reward:7, crush:'crack', sound:'electronic', sp:{pitch:2.0,dur:0.3,noise:0.6,res:2200,attack:0.002,decay:0.3,harmonics:3}, p:{w:0.1, h:0.04, d:0.03, sc:'#222222', bc:'#444444'} },
  { id:'led_bulb', name:'LED-Lampe', icon:'💡', cat:'electronics', price:45, reward:9, crush:'crack', sound:'electronic', sp:{pitch:1.7,dur:0.4,noise:0.5,res:1900,attack:0.003,decay:0.4,harmonics:3}, p:{w:0.1, h:0.2, d:0.1, sc:'#ffffcc', bc:'#e0e0e0'} },
  { id:'remote_control', name:'Fernbedienung', icon:'📺', cat:'electronics', price:50, reward:10, crush:'crack', sound:'electronic', sp:{pitch:1.4,dur:0.5,noise:0.55,res:1500,attack:0.003,decay:0.5,harmonics:3}, p:{w:0.1, h:0.35, d:0.04, sc:'#111111', bc:'#333333'} },
  { id:'calculator', name:'Taschenrechner', icon:'🧮', cat:'electronics', price:60, reward:12, crush:'crack', sound:'electronic', sp:{pitch:1.5,dur:0.5,noise:0.5,res:1600,attack:0.003,decay:0.5,harmonics:4}, p:{w:0.15, h:0.25, d:0.03, sc:'#88ccaa', bc:'#222222'} },
  { id:'flashlight', name:'Taschenlampe', icon:'🔦', cat:'electronics', price:65, reward:13, crush:'crack', sound:'electronic', sp:{pitch:1.3,dur:0.6,noise:0.45,res:1400,attack:0.004,decay:0.6,harmonics:3}, p:{w:0.08, h:0.35, d:0.08, sc:'#ffff99', bc:'#333333'} },
  { id:'mouse_e', name:'Computermaus', icon:'🖱️', cat:'electronics', price:70, reward:14, crush:'crack', sound:'electronic', sp:{pitch:1.6,dur:0.4,noise:0.5,res:1700,attack:0.003,decay:0.4,harmonics:3}, p:{w:0.12, h:0.06, d:0.08, sc:'#333333', bc:'#222222'} },
  { id:'digital_watch', name:'Digitaluhr', icon:'⌚', cat:'electronics', price:75, reward:15, crush:'crack', sound:'electronic', sp:{pitch:1.8,dur:0.35,noise:0.55,res:2000,attack:0.002,decay:0.3,harmonics:4}, p:{w:0.08, h:0.1, d:0.04, sc:'#00ff88', bc:'#1a1a1a'} },
  { id:'phone', name:'Handy', icon:'📱', cat:'electronics', price:80, reward:16, crush:'crack', sound:'electronic', sp:{pitch:1.5,dur:0.5,noise:0.6,res:1600,attack:0.003,decay:0.5,harmonics:4}, p:{w:0.14, h:0.28, d:0.02, sc:'#1a1a2e', bc:'#2d2d2d'} },
  { id:'alarm_clock_e', name:'Digitalwecker', icon:'⏰', cat:'electronics', price:90, reward:18, crush:'crack', sound:'electronic', sp:{pitch:1.2,dur:0.7,noise:0.65,res:1300,attack:0.003,decay:0.7,harmonics:4}, p:{w:0.2, h:0.15, d:0.1, sc:'#ff3333', bc:'#111111'} },
  { id:'keyboard', name:'Tastatur', icon:'⌨️', cat:'electronics', price:100, reward:20, crush:'crack', sound:'electronic', sp:{pitch:1.1,dur:0.8,noise:0.7,res:1200,attack:0.004,decay:0.8,harmonics:5}, p:{w:0.5, h:0.05, d:0.2, sc:'#222222', bc:'#333333'} },
  { id:'headphones', name:'Kopfhoerer', icon:'🎧', cat:'electronics', price:110, reward:22, crush:'crack', sound:'electronic', sp:{pitch:1.0,dur:0.9,noise:0.5,res:1100,attack:0.005,decay:0.9,harmonics:3}, p:{w:0.3, h:0.25, d:0.1, sc:'#222222', bc:'#111111'} },
  { id:'speaker', name:'Lautsprecher', icon:'🔊', cat:'electronics', price:130, reward:26, crush:'crack', sound:'electronic', sp:{pitch:0.8,dur:1.1,noise:0.6,res:900,attack:0.005,decay:1.1,harmonics:4}, p:{w:0.2, h:0.35, d:0.2, sc:'#333333', bc:'#1a1a1a'} },
  { id:'walkie_talkie', name:'Walkie-Talkie', icon:'📻', cat:'electronics', price:140, reward:28, crush:'crack', sound:'electronic', sp:{pitch:1.3,dur:0.6,noise:0.6,res:1400,attack:0.004,decay:0.6,harmonics:3}, p:{w:0.1, h:0.3, d:0.06, sc:'#222222', bc:'#556b2f'} },
  { id:'gameboy', name:'Gameboy', icon:'🎮', cat:'electronics', price:180, reward:36, crush:'crack', sound:'electronic', sp:{pitch:1.4,dur:0.5,noise:0.55,res:1500,attack:0.003,decay:0.5,harmonics:4}, p:{w:0.15, h:0.25, d:0.05, sc:'#9bbc0f', bc:'#c0c0c0'} },
  { id:'laptop', name:'Laptop', icon:'💻', cat:'electronics', price:250, reward:50, crush:'crack', sound:'electronic', sp:{pitch:0.7,dur:1.3,noise:0.65,res:800,attack:0.005,decay:1.3,harmonics:5}, p:{w:0.5, h:0.04, d:0.35, sc:'#1a1a2e', bc:'#c0c0c0'} },
  { id:'microwave', name:'Mikrowelle', icon:'📦', cat:'electronics', price:300, reward:60, crush:'crack', sound:'electronic', sp:{pitch:0.5,dur:1.6,noise:0.7,res:600,attack:0.005,decay:1.6,harmonics:4}, p:{w:0.55, h:0.35, d:0.4, sc:'#111111', bc:'#e0e0e0'} },
  { id:'toaster', name:'Toaster', icon:'🍞', cat:'electronics', price:120, reward:24, crush:'crack', sound:'electronic', sp:{pitch:0.9,dur:0.9,noise:0.55,res:1000,attack:0.005,decay:0.9,harmonics:3}, p:{w:0.25, h:0.2, d:0.15, sc:'#cc6600', bc:'#c0c0c0'} },

  // ── FOOD (17) ────────────────────────────────────
  { id:'egg', name:'Ei', icon:'🥚', cat:'food', price:25, reward:5, crush:'splat', sound:'soft', sp:{pitch:1.6,dur:0.4,noise:0.3,res:500,attack:0.003,decay:0.4,harmonics:1}, p:{r:0.15, h:0.2, c:'#fff5e6', tc:'#ffee88'} },
  { id:'bread', name:'Brot', icon:'🍞', cat:'food', price:35, reward:7, crush:'splat', sound:'soft', sp:{pitch:0.8,dur:0.8,noise:0.4,res:350,attack:0.01,decay:0.8,harmonics:1}, p:{r:0.25, h:0.2, c:'#d4a056', tc:'#c89040'} },
  { id:'sandwich', name:'Sandwich', icon:'🥪', cat:'food', price:40, reward:8, crush:'splat', sound:'soft', sp:{pitch:0.9,dur:0.7,noise:0.45,res:380,attack:0.01,decay:0.7,harmonics:1}, p:{r:0.2, h:0.15, c:'#e8c872', tc:'#66aa33'} },
  { id:'chocolate_bar', name:'Schokolade', icon:'🍫', cat:'food', price:40, reward:8, crush:'splat', sound:'soft', sp:{pitch:1.2,dur:0.5,noise:0.3,res:450,attack:0.005,decay:0.5,harmonics:2}, p:{r:0.2, h:0.1, c:'#4a2c0a', tc:'#6b3a1a'} },
  { id:'cheese', name:'Kaese', icon:'🧀', cat:'food', price:45, reward:9, crush:'splat', sound:'soft', sp:{pitch:0.7,dur:0.9,noise:0.5,res:320,attack:0.012,decay:0.9,harmonics:1}, p:{r:0.2, h:0.15, c:'#ffd700', tc:'#ffcc00'} },
  { id:'muffin', name:'Muffin', icon:'🧁', cat:'food', price:45, reward:9, crush:'splat', sound:'soft', sp:{pitch:1.0,dur:0.6,noise:0.4,res:400,attack:0.008,decay:0.6,harmonics:1}, p:{r:0.18, h:0.2, c:'#a0522d', tc:'#ff69b4'} },
  { id:'donut', name:'Donut', icon:'🍩', cat:'food', price:50, reward:10, crush:'splat', sound:'soft', sp:{pitch:0.9,dur:0.7,noise:0.45,res:380,attack:0.01,decay:0.7,harmonics:2}, p:{r:0.2, h:0.12, c:'#d2691e', tc:'#ff69b4'} },
  { id:'pretzel', name:'Brezel', icon:'🥨', cat:'food', price:50, reward:10, crush:'splat', sound:'soft', sp:{pitch:1.3,dur:0.5,noise:0.35,res:500,attack:0.005,decay:0.5,harmonics:2}, p:{r:0.22, h:0.1, c:'#b8860b', tc:'#f5deb3'} },
  { id:'pizza_box', name:'Pizzakarton', icon:'🍕', cat:'food', price:55, reward:11, crush:'splat', sound:'soft', sp:{pitch:0.7,dur:1.0,noise:0.5,res:300,attack:0.012,decay:1.0,harmonics:1}, p:{r:0.35, h:0.1, c:'#d2b48c', tc:'#ff6347'} },
  { id:'ice_cream', name:'Eiscreme', icon:'🍦', cat:'food', price:55, reward:11, crush:'splat', sound:'soft', sp:{pitch:1.4,dur:0.4,noise:0.3,res:550,attack:0.005,decay:0.4,harmonics:1}, p:{r:0.15, h:0.3, c:'#ffe4b5', tc:'#ff69b4'} },
  { id:'hamburger', name:'Hamburger', icon:'🍔', cat:'food', price:60, reward:12, crush:'splat', sound:'soft', sp:{pitch:0.8,dur:0.8,noise:0.55,res:350,attack:0.01,decay:0.8,harmonics:2}, p:{r:0.22, h:0.2, c:'#d2691e', tc:'#228b22'} },
  { id:'noodle_pot', name:'Nudeltopf', icon:'🍜', cat:'food', price:65, reward:13, crush:'splat', sound:'soft', sp:{pitch:0.75,dur:0.9,noise:0.6,res:330,attack:0.01,decay:0.9,harmonics:2}, p:{r:0.2, h:0.25, c:'#ffffff', tc:'#ffd700'} },
  { id:'cake', name:'Torte', icon:'🎂', cat:'food', price:70, reward:14, crush:'splat', sound:'soft', sp:{pitch:0.6,dur:1.1,noise:0.5,res:280,attack:0.015,decay:1.1,harmonics:2}, p:{r:0.3, h:0.25, c:'#ffe4c4', tc:'#ff1493'} },
  { id:'pie', name:'Kuchen', icon:'🥧', cat:'food', price:80, reward:16, crush:'splat', sound:'soft', sp:{pitch:0.65,dur:1.0,noise:0.5,res:300,attack:0.012,decay:1.0,harmonics:2}, p:{r:0.28, h:0.15, c:'#d2691e', tc:'#ff6347'} },
  { id:'sushi', name:'Sushi', icon:'🍣', cat:'food', price:90, reward:18, crush:'splat', sound:'soft', sp:{pitch:1.5,dur:0.4,noise:0.35,res:600,attack:0.005,decay:0.4,harmonics:1}, p:{r:0.15, h:0.12, c:'#ffffff', tc:'#ff4500'} },
  { id:'gingerbread', name:'Lebkuchen', icon:'🍪', cat:'food', price:100, reward:20, crush:'splat', sound:'soft', sp:{pitch:1.1,dur:0.6,noise:0.4,res:480,attack:0.008,decay:0.6,harmonics:2}, p:{r:0.2, h:0.15, c:'#8b4513', tc:'#ffffff'} },
  { id:'praline', name:'Praline', icon:'🍬', cat:'food', price:120, reward:24, crush:'splat', sound:'soft', sp:{pitch:1.7,dur:0.3,noise:0.25,res:650,attack:0.003,decay:0.3,harmonics:1}, p:{r:0.15, h:0.1, c:'#3b1e08', tc:'#daa520'} },

  // ── RUBBER (16) ──────────────────────────────────
  { id:'rubber_band', name:'Gummiband', icon:'⭕', cat:'rubber', price:15, reward:5, crush:'squish', sound:'rubbery', sp:{pitch:1.8,dur:0.4,noise:0.2,res:400,attack:0.005,decay:0.4,harmonics:1}, p:{r:0.15, c:'#cc9900'} },
  { id:'eraser', name:'Radiergummi', icon:'🧽', cat:'rubber', price:25, reward:5, crush:'squish', sound:'rubbery', sp:{pitch:1.3,dur:0.5,noise:0.3,res:350,attack:0.008,decay:0.5,harmonics:1}, p:{r:0.12, c:'#ff6699'} },
  { id:'balloon', name:'Ballon', icon:'🎈', cat:'rubber', price:30, reward:6, crush:'squish', sound:'rubbery', sp:{pitch:2.0,dur:0.3,noise:0.2,res:500,attack:0.002,decay:0.3,harmonics:2}, p:{r:0.3, c:'#ff0000'} },
  { id:'gummy_bear', name:'Gummibaerchen', icon:'🧸', cat:'rubber', price:35, reward:7, crush:'squish', sound:'rubbery', sp:{pitch:1.6,dur:0.4,noise:0.25,res:450,attack:0.005,decay:0.4,harmonics:1}, p:{r:0.12, c:'#ff3300'} },
  { id:'bouncy_ball', name:'Flummi', icon:'⚽', cat:'rubber', price:40, reward:8, crush:'squish', sound:'rubbery', sp:{pitch:1.4,dur:0.5,noise:0.3,res:400,attack:0.005,decay:0.5,harmonics:2}, p:{r:0.14, c:'#00ccff'} },
  { id:'squash_ball', name:'Squashball', icon:'⚫', cat:'rubber', price:45, reward:9, crush:'squish', sound:'rubbery', sp:{pitch:1.1,dur:0.6,noise:0.35,res:350,attack:0.008,decay:0.6,harmonics:2}, p:{r:0.13, c:'#111111'} },
  { id:'stress_ball', name:'Stressball', icon:'🟡', cat:'rubber', price:50, reward:10, crush:'squish', sound:'rubbery', sp:{pitch:0.8,dur:0.8,noise:0.4,res:300,attack:0.01,decay:0.8,harmonics:2}, p:{r:0.16, c:'#ffcc00'} },
  { id:'tennis_ball', name:'Tennisball', icon:'🎾', cat:'rubber', price:50, reward:10, crush:'squish', sound:'rubbery', sp:{pitch:1.2,dur:0.6,noise:0.3,res:380,attack:0.008,decay:0.6,harmonics:2}, p:{r:0.16, c:'#ccff00'} },
  { id:'rubber_duck', name:'Quietscheente', icon:'🦆', cat:'rubber', price:60, reward:12, crush:'squish', sound:'rubbery', sp:{pitch:1.5,dur:0.5,noise:0.25,res:600,attack:0.005,decay:0.5,harmonics:3}, p:{r:0.18, c:'#ffdd00'} },
  { id:'beach_ball', name:'Wasserball', icon:'🏐', cat:'rubber', price:70, reward:14, crush:'squish', sound:'rubbery', sp:{pitch:0.9,dur:0.9,noise:0.4,res:320,attack:0.01,decay:0.9,harmonics:2}, p:{r:0.35, c:'#ff4444'} },
  { id:'soccer_ball', name:'Fussball', icon:'⚽', cat:'rubber', price:80, reward:16, crush:'squish', sound:'rubbery', sp:{pitch:0.7,dur:1.0,noise:0.45,res:280,attack:0.01,decay:1.0,harmonics:2}, p:{r:0.25, c:'#ffffff'} },
  { id:'basketball', name:'Basketball', icon:'🏀', cat:'rubber', price:90, reward:18, crush:'squish', sound:'rubbery', sp:{pitch:0.6,dur:1.1,noise:0.5,res:250,attack:0.012,decay:1.1,harmonics:3}, p:{r:0.28, c:'#ff6600'} },
  { id:'rubber_boot', name:'Gummistiefel', icon:'🥾', cat:'rubber', price:100, reward:20, crush:'squish', sound:'rubbery', sp:{pitch:0.75,dur:0.9,noise:0.4,res:300,attack:0.01,decay:0.9,harmonics:2}, p:{r:0.2, c:'#228b22'} },
  { id:'swim_ring', name:'Schwimmring', icon:'🛟', cat:'rubber', price:110, reward:22, crush:'squish', sound:'rubbery', sp:{pitch:0.85,dur:0.8,noise:0.35,res:340,attack:0.01,decay:0.8,harmonics:2}, p:{r:0.35, c:'#ff6688'} },
  { id:'yoga_mat', name:'Yogamatte', icon:'🧘', cat:'rubber', price:120, reward:24, crush:'squish', sound:'rubbery', sp:{pitch:0.5,dur:1.2,noise:0.5,res:220,attack:0.015,decay:1.2,harmonics:1}, p:{r:0.5, c:'#9966cc'} },
  { id:'car_tire', name:'Autoreifen', icon:'🛞', cat:'rubber', price:150, reward:30, crush:'squish', sound:'rubbery', sp:{pitch:0.35,dur:1.5,noise:0.6,res:200,attack:0.01,decay:1.5,harmonics:3}, p:{r:0.4, c:'#222222'} },

  // ── STONE (16) ───────────────────────────────────
  { id:'brick', name:'Ziegelstein', icon:'🧱', cat:'stone', price:40, reward:8, crush:'shatter', sound:'stone', sp:{pitch:0.7,dur:1.0,noise:0.7,res:300,attack:0.005,decay:1.0,harmonics:2}, p:{w:0.4, h:0.2, d:0.2, c:'#b22222'} },
  { id:'sandstone', name:'Sandstein', icon:'🪨', cat:'stone', price:45, reward:9, crush:'shatter', sound:'stone', sp:{pitch:0.65,dur:1.1,noise:0.75,res:280,attack:0.005,decay:1.1,harmonics:2}, p:{w:0.35, h:0.25, d:0.3, c:'#d2b48c'} },
  { id:'cobblestone', name:'Pflasterstein', icon:'🪨', cat:'stone', price:50, reward:10, crush:'shatter', sound:'stone', sp:{pitch:0.6,dur:1.2,noise:0.7,res:260,attack:0.005,decay:1.2,harmonics:2}, p:{w:0.25, h:0.2, d:0.25, c:'#808080'} },
  { id:'slate', name:'Schiefer', icon:'🪨', cat:'stone', price:55, reward:11, crush:'shatter', sound:'stone', sp:{pitch:0.8,dur:0.8,noise:0.65,res:350,attack:0.003,decay:0.8,harmonics:3}, p:{w:0.4, h:0.1, d:0.35, c:'#2f4f4f'} },
  { id:'concrete_block', name:'Betonblock', icon:'🧱', cat:'stone', price:60, reward:12, crush:'shatter', sound:'stone', sp:{pitch:0.45,dur:1.5,noise:0.8,res:220,attack:0.005,decay:1.5,harmonics:3}, p:{w:0.5, h:0.3, d:0.3, c:'#999999'} },
  { id:'paperweight', name:'Briefbeschwerer', icon:'🪨', cat:'stone', price:70, reward:14, crush:'shatter', sound:'stone', sp:{pitch:0.9,dur:0.7,noise:0.5,res:380,attack:0.005,decay:0.7,harmonics:2}, p:{w:0.2, h:0.15, d:0.2, c:'#4a6741'} },
  { id:'granite', name:'Granit', icon:'🪨', cat:'stone', price:80, reward:16, crush:'shatter', sound:'stone', sp:{pitch:0.4,dur:1.6,noise:0.75,res:200,attack:0.005,decay:1.6,harmonics:3}, p:{w:0.4, h:0.3, d:0.35, c:'#696969'} },
  { id:'boulder', name:'Felsbrocken', icon:'🪨', cat:'stone', price:100, reward:20, crush:'shatter', sound:'stone', sp:{pitch:0.35,dur:1.8,noise:0.85,res:180,attack:0.005,decay:1.8,harmonics:3}, p:{w:0.5, h:0.4, d:0.45, c:'#8b8682'} },
  { id:'millstone', name:'Muehlstein', icon:'⚙️', cat:'stone', price:150, reward:30, crush:'shatter', sound:'stone', sp:{pitch:0.5,dur:1.4,noise:0.7,res:250,attack:0.005,decay:1.4,harmonics:3}, p:{w:0.5, h:0.2, d:0.5, c:'#a9a9a9'} },
  { id:'gravestone', name:'Grabstein', icon:'🪦', cat:'stone', price:180, reward:36, crush:'shatter', sound:'stone', sp:{pitch:0.55,dur:1.3,noise:0.65,res:270,attack:0.005,decay:1.3,harmonics:2}, p:{w:0.35, h:0.6, d:0.15, c:'#778899'} },
  { id:'geode', name:'Geode', icon:'💎', cat:'stone', price:200, reward:40, crush:'shatter', sound:'stone', sp:{pitch:1.2,dur:0.8,noise:0.5,res:500,attack:0.003,decay:0.8,harmonics:4}, p:{w:0.3, h:0.3, d:0.3, c:'#9370db'} },
  { id:'crystal_gem', name:'Kristalledelstein', icon:'💎', cat:'stone', price:250, reward:50, crush:'shatter', sound:'stone', sp:{pitch:1.5,dur:0.6,noise:0.4,res:600,attack:0.002,decay:0.6,harmonics:5}, p:{w:0.2, h:0.3, d:0.2, c:'#00ced1'} },
  { id:'marble_bust', name:'Marmorbueste', icon:'🗿', cat:'stone', price:300, reward:60, crush:'shatter', sound:'stone', sp:{pitch:0.4,dur:1.7,noise:0.7,res:200,attack:0.005,decay:1.7,harmonics:3}, p:{w:0.3, h:0.5, d:0.3, c:'#f5f5dc'} },
  { id:'obsidian', name:'Obsidian', icon:'🖤', cat:'stone', price:350, reward:70, crush:'shatter', sound:'stone', sp:{pitch:1.0,dur:1.0,noise:0.6,res:400,attack:0.003,decay:1.0,harmonics:4}, p:{w:0.25, h:0.35, d:0.25, c:'#0d0d0d'} },
  { id:'stone_statue', name:'Steinstatue', icon:'🗿', cat:'stone', price:400, reward:80, crush:'shatter', sound:'stone', sp:{pitch:0.3,dur:2.0,noise:0.8,res:160,attack:0.005,decay:2.0,harmonics:3}, p:{w:0.3, h:0.7, d:0.3, c:'#b0b0b0'} },
  { id:'diamond', name:'Diamant', icon:'💠', cat:'stone', price:500, reward:100, crush:'shatter', sound:'stone', sp:{pitch:1.8,dur:0.5,noise:0.3,res:800,attack:0.001,decay:0.5,harmonics:5}, p:{w:0.2, h:0.25, d:0.2, c:'#b9f2ff'} },

  // ── TOY (17) ─────────────────────────────────────
  { id:'bubble_wand', name:'Seifenblasenstab', icon:'🫧', cat:'toy', price:30, reward:6, crush:'pop', sound:'toy', sp:{pitch:2.0,dur:0.3,noise:0.2,res:2200,attack:0.002,decay:0.3,harmonics:2}, p:{w:0.05, h:0.4, d:0.05, c:'#ff69b4', ac:'#ffcc00'} },
  { id:'lego_brick', name:'Legostein', icon:'🧱', cat:'toy', price:40, reward:8, crush:'pop', sound:'toy', sp:{pitch:1.5,dur:0.4,noise:0.35,res:1800,attack:0.003,decay:0.4,harmonics:2}, p:{w:0.15, h:0.1, d:0.1, c:'#ff0000', ac:'#ffcc00'} },
  { id:'yoyo', name:'Jo-Jo', icon:'🪀', cat:'toy', price:45, reward:9, crush:'pop', sound:'toy', sp:{pitch:1.3,dur:0.5,noise:0.3,res:1500,attack:0.003,decay:0.5,harmonics:2}, p:{w:0.15, h:0.1, d:0.15, c:'#ff4444', ac:'#ffffff'} },
  { id:'spinning_top', name:'Kreisel', icon:'🪩', cat:'toy', price:50, reward:10, crush:'pop', sound:'toy', sp:{pitch:1.6,dur:0.4,noise:0.25,res:1900,attack:0.002,decay:0.4,harmonics:3}, p:{w:0.15, h:0.2, d:0.15, c:'#4488ff', ac:'#ff4444'} },
  { id:'building_blocks', name:'Bausteinkloetze', icon:'🏗️', cat:'toy', price:55, reward:11, crush:'pop', sound:'toy', sp:{pitch:1.2,dur:0.6,noise:0.4,res:1400,attack:0.005,decay:0.6,harmonics:3}, p:{w:0.3, h:0.15, d:0.15, c:'#33cc33', ac:'#ff9900'} },
  { id:'fidget_spinner', name:'Fidget Spinner', icon:'🌀', cat:'toy', price:55, reward:11, crush:'pop', sound:'toy', sp:{pitch:1.7,dur:0.35,noise:0.3,res:2000,attack:0.002,decay:0.35,harmonics:3}, p:{w:0.2, h:0.05, d:0.2, c:'#3399ff', ac:'#cc0000'} },
  { id:'rubiks_cube', name:'Zauberwuerfel', icon:'🟩', cat:'toy', price:60, reward:12, crush:'pop', sound:'toy', sp:{pitch:1.4,dur:0.5,noise:0.4,res:1600,attack:0.003,decay:0.5,harmonics:3}, p:{w:0.18, h:0.18, d:0.18, c:'#ffffff', ac:'#ff0000'} },
  { id:'kite', name:'Drachen', icon:'🪁', cat:'toy', price:65, reward:13, crush:'pop', sound:'toy', sp:{pitch:1.8,dur:0.3,noise:0.25,res:2100,attack:0.002,decay:0.3,harmonics:2}, p:{w:0.4, h:0.5, d:0.03, c:'#ff6600', ac:'#ffcc00'} },
  { id:'teddy_bear', name:'Teddybaer', icon:'🧸', cat:'toy', price:70, reward:14, crush:'pop', sound:'toy', sp:{pitch:0.7,dur:1.0,noise:0.5,res:600,attack:0.01,decay:1.0,harmonics:1}, p:{w:0.25, h:0.35, d:0.2, c:'#cd853f', ac:'#8b4513'} },
  { id:'toy_car', name:'Spielzeugauto', icon:'🚗', cat:'toy', price:80, reward:16, crush:'pop', sound:'toy', sp:{pitch:1.1,dur:0.7,noise:0.45,res:1200,attack:0.005,decay:0.7,harmonics:3}, p:{w:0.2, h:0.12, d:0.1, c:'#ff0000', ac:'#333333'} },
  { id:'doll', name:'Puppe', icon:'🎎', cat:'toy', price:90, reward:18, crush:'pop', sound:'toy', sp:{pitch:0.9,dur:0.8,noise:0.4,res:900,attack:0.008,decay:0.8,harmonics:2}, p:{w:0.15, h:0.4, d:0.15, c:'#ffb6c1', ac:'#8b4513'} },
  { id:'plush_monkey', name:'Pluschaffe', icon:'🐒', cat:'toy', price:100, reward:20, crush:'pop', sound:'toy', sp:{pitch:0.8,dur:0.9,noise:0.45,res:700,attack:0.01,decay:0.9,harmonics:1}, p:{w:0.25, h:0.35, d:0.2, c:'#8b4513', ac:'#f5deb3'} },
  { id:'action_figure', name:'Actionfigur', icon:'🦸', cat:'toy', price:110, reward:22, crush:'pop', sound:'toy', sp:{pitch:1.2,dur:0.6,noise:0.5,res:1300,attack:0.005,decay:0.6,harmonics:3}, p:{w:0.15, h:0.35, d:0.1, c:'#0000ff', ac:'#ff0000'} },
  { id:'matryoshka', name:'Matroschka', icon:'🪆', cat:'toy', price:120, reward:24, crush:'pop', sound:'toy', sp:{pitch:0.85,dur:0.8,noise:0.35,res:800,attack:0.008,decay:0.8,harmonics:3}, p:{w:0.2, h:0.35, d:0.2, c:'#ff3366', ac:'#ffcc00'} },
  { id:'magic_cube', name:'Zauberkiste', icon:'🎁', cat:'toy', price:150, reward:30, crush:'pop', sound:'toy', sp:{pitch:1.4,dur:0.5,noise:0.3,res:1500,attack:0.003,decay:0.5,harmonics:4}, p:{w:0.2, h:0.2, d:0.2, c:'#9933cc', ac:'#ffcc00'} },
  { id:'toy_robot', name:'Spielzeugroboter', icon:'🤖', cat:'toy', price:180, reward:36, crush:'pop', sound:'toy', sp:{pitch:1.0,dur:0.7,noise:0.55,res:1100,attack:0.005,decay:0.7,harmonics:4}, p:{w:0.2, h:0.4, d:0.15, c:'#c0c0c0', ac:'#ff0000'} },
  { id:'music_box', name:'Spieluhr', icon:'🎵', cat:'toy', price:200, reward:40, crush:'pop', sound:'toy', sp:{pitch:1.6,dur:0.6,noise:0.2,res:2000,attack:0.003,decay:0.8,harmonics:5}, p:{w:0.2, h:0.15, d:0.15, c:'#daa520', ac:'#8b0000'} },

  // ── PAPER (16) ───────────────────────────────────
  { id:'envelope', name:'Briefumschlag', icon:'✉️', cat:'paper', price:15, reward:5, crush:'fold', sound:'paper', sp:{pitch:1.8,dur:0.3,noise:0.8,res:2500,attack:0.002,decay:0.3,harmonics:1}, p:{w:0.35, h:0.25, d:0.02, c:'#f5f5dc'} },
  { id:'newspaper', name:'Zeitung', icon:'📰', cat:'paper', price:20, reward:5, crush:'fold', sound:'paper', sp:{pitch:1.5,dur:0.5,noise:0.9,res:2200,attack:0.003,decay:0.5,harmonics:1}, p:{w:0.5, h:0.6, d:0.03, c:'#f5f5e0'} },
  { id:'paper_stack', name:'Papierstapel', icon:'📄', cat:'paper', price:25, reward:5, crush:'fold', sound:'paper', sp:{pitch:1.2,dur:0.6,noise:0.85,res:2000,attack:0.003,decay:0.6,harmonics:2}, p:{w:0.4, h:0.55, d:0.08, c:'#ffffff'} },
  { id:'notepad', name:'Notizblock', icon:'📝', cat:'paper', price:25, reward:5, crush:'fold', sound:'paper', sp:{pitch:1.4,dur:0.5,noise:0.8,res:2100,attack:0.003,decay:0.5,harmonics:1}, p:{w:0.3, h:0.4, d:0.04, c:'#ffff99'} },
  { id:'toilet_roll', name:'Toilettenpapier', icon:'🧻', cat:'paper', price:30, reward:6, crush:'fold', sound:'paper', sp:{pitch:1.0,dur:0.7,noise:0.9,res:1800,attack:0.005,decay:0.7,harmonics:1}, p:{w:0.2, h:0.2, d:0.15, c:'#ffffff'} },
  { id:'tissue_box', name:'Taschentuchbox', icon:'🤧', cat:'paper', price:30, reward:6, crush:'fold', sound:'paper', sp:{pitch:1.1,dur:0.6,noise:0.85,res:1900,attack:0.005,decay:0.6,harmonics:1}, p:{w:0.3, h:0.15, d:0.2, c:'#aaddff'} },
  { id:'cardboard_box', name:'Karton', icon:'📦', cat:'paper', price:35, reward:7, crush:'fold', sound:'paper', sp:{pitch:0.8,dur:0.9,noise:0.8,res:1500,attack:0.005,decay:0.9,harmonics:2}, p:{w:0.4, h:0.35, d:0.3, c:'#c4a35a'} },
  { id:'playing_cards', name:'Spielkarten', icon:'🃏', cat:'paper', price:35, reward:7, crush:'fold', sound:'paper', sp:{pitch:1.7,dur:0.3,noise:0.7,res:2400,attack:0.002,decay:0.3,harmonics:2}, p:{w:0.2, h:0.3, d:0.05, c:'#ffffff'} },
  { id:'poster', name:'Poster', icon:'🖼️', cat:'paper', price:40, reward:8, crush:'fold', sound:'paper', sp:{pitch:1.6,dur:0.4,noise:0.85,res:2300,attack:0.002,decay:0.4,harmonics:1}, p:{w:0.5, h:0.6, d:0.02, c:'#ffcc88'} },
  { id:'calendar', name:'Kalender', icon:'📅', cat:'paper', price:40, reward:8, crush:'fold', sound:'paper', sp:{pitch:1.3,dur:0.5,noise:0.8,res:2000,attack:0.003,decay:0.5,harmonics:1}, p:{w:0.4, h:0.5, d:0.03, c:'#ffffff'} },
  { id:'binder', name:'Ordner', icon:'📒', cat:'paper', price:45, reward:9, crush:'fold', sound:'paper', sp:{pitch:0.9,dur:0.8,noise:0.7,res:1600,attack:0.005,decay:0.8,harmonics:2}, p:{w:0.35, h:0.45, d:0.1, c:'#0000cc'} },
  { id:'map', name:'Landkarte', icon:'🗺️', cat:'paper', price:50, reward:10, crush:'fold', sound:'paper', sp:{pitch:1.5,dur:0.4,noise:0.9,res:2200,attack:0.002,decay:0.4,harmonics:1}, p:{w:0.5, h:0.4, d:0.02, c:'#f5deb3'} },
  { id:'book', name:'Buch', icon:'📕', cat:'paper', price:50, reward:10, crush:'fold', sound:'paper', sp:{pitch:0.7,dur:1.0,noise:0.7,res:1400,attack:0.005,decay:1.0,harmonics:2}, p:{w:0.3, h:0.4, d:0.06, c:'#8b0000'} },
  { id:'wallpaper_roll', name:'Tapetenrolle', icon:'🧻', cat:'paper', price:55, reward:11, crush:'fold', sound:'paper', sp:{pitch:1.0,dur:0.7,noise:0.85,res:1800,attack:0.005,decay:0.7,harmonics:2}, p:{w:0.2, h:0.5, d:0.15, c:'#daa520'} },
  { id:'gift_box', name:'Geschenkbox', icon:'🎁', cat:'paper', price:60, reward:12, crush:'fold', sound:'paper', sp:{pitch:0.9,dur:0.8,noise:0.75,res:1600,attack:0.005,decay:0.8,harmonics:2}, p:{w:0.35, h:0.3, d:0.3, c:'#ff3366'} },
  { id:'origami_crane', name:'Origami-Kranich', icon:'🦢', cat:'paper', price:80, reward:16, crush:'fold', sound:'paper', sp:{pitch:1.9,dur:0.3,noise:0.7,res:2600,attack:0.002,decay:0.3,harmonics:2}, p:{w:0.25, h:0.2, d:0.15, c:'#ff6699'} },

  // ── WAX (16) ─────────────────────────────────────
  { id:'tea_light', name:'Teelicht', icon:'🕯️', cat:'wax', price:20, reward:5, crush:'melt', sound:'soft', sp:{pitch:1.3,dur:0.5,noise:0.3,res:400,attack:0.008,decay:0.5,harmonics:1}, p:{h:0.08, r:0.1, c:'#ffffff', wc:'#333333'} },
  { id:'crayon', name:'Wachsmalstift', icon:'🖍️', cat:'wax', price:25, reward:5, crush:'melt', sound:'soft', sp:{pitch:1.5,dur:0.4,noise:0.25,res:450,attack:0.005,decay:0.4,harmonics:1}, p:{h:0.3, r:0.05, c:'#ff0000', wc:0} },
  { id:'butter_stick', name:'Butterstab', icon:'🧈', cat:'wax', price:25, reward:5, crush:'melt', sound:'soft', sp:{pitch:1.0,dur:0.6,noise:0.4,res:350,attack:0.01,decay:0.6,harmonics:1}, p:{h:0.15, r:0.08, c:'#fff8dc', wc:0} },
  { id:'shoe_polish', name:'Schuhcreme', icon:'👟', cat:'wax', price:30, reward:6, crush:'melt', sound:'soft', sp:{pitch:0.9,dur:0.7,noise:0.35,res:320,attack:0.01,decay:0.7,harmonics:1}, p:{h:0.1, r:0.12, c:'#1a1a1a', wc:0} },
  { id:'soap_bar', name:'Seifenstueck', icon:'🧼', cat:'wax', price:30, reward:6, crush:'melt', sound:'soft', sp:{pitch:1.1,dur:0.5,noise:0.3,res:380,attack:0.008,decay:0.5,harmonics:1}, p:{h:0.12, r:0.1, c:'#e6e6fa', wc:0} },
  { id:'sealing_wax', name:'Siegelwachs', icon:'🔴', cat:'wax', price:35, reward:7, crush:'melt', sound:'soft', sp:{pitch:1.2,dur:0.5,noise:0.3,res:420,attack:0.005,decay:0.5,harmonics:2}, p:{h:0.25, r:0.06, c:'#8b0000', wc:0} },
  { id:'clay', name:'Ton', icon:'🏺', cat:'wax', price:35, reward:7, crush:'melt', sound:'soft', sp:{pitch:0.6,dur:1.0,noise:0.5,res:250,attack:0.015,decay:1.0,harmonics:2}, p:{h:0.15, r:0.15, c:'#cd853f', wc:0} },
  { id:'candle', name:'Kerze', icon:'🕯️', cat:'wax', price:40, reward:8, crush:'melt', sound:'soft', sp:{pitch:1.0,dur:0.7,noise:0.35,res:380,attack:0.008,decay:0.7,harmonics:2}, p:{h:0.35, r:0.08, c:'#fffdd0', wc:'#333333'} },
  { id:'paraffin', name:'Paraffin', icon:'🧊', cat:'wax', price:40, reward:8, crush:'melt', sound:'soft', sp:{pitch:0.8,dur:0.8,noise:0.4,res:300,attack:0.01,decay:0.8,harmonics:1}, p:{h:0.2, r:0.12, c:'#f5f5f5', wc:0} },
  { id:'lipstick', name:'Lippenstift', icon:'💄', cat:'wax', price:45, reward:9, crush:'melt', sound:'soft', sp:{pitch:1.6,dur:0.3,noise:0.2,res:500,attack:0.005,decay:0.3,harmonics:1}, p:{h:0.25, r:0.05, c:'#cc0033', wc:0} },
  { id:'modeling_clay', name:'Knetmasse', icon:'🎨', cat:'wax', price:45, reward:9, crush:'melt', sound:'soft', sp:{pitch:0.55,dur:1.1,noise:0.55,res:230,attack:0.015,decay:1.1,harmonics:2}, p:{h:0.15, r:0.15, c:'#33cc33', wc:0} },
  { id:'beeswax_block', name:'Bienenwachsblock', icon:'🐝', cat:'wax', price:50, reward:10, crush:'melt', sound:'soft', sp:{pitch:0.7,dur:0.9,noise:0.45,res:280,attack:0.01,decay:0.9,harmonics:2}, p:{h:0.15, r:0.15, c:'#daa520', wc:0} },
  { id:'cheese_wax', name:'Kaesewachs', icon:'🧀', cat:'wax', price:55, reward:11, crush:'melt', sound:'soft', sp:{pitch:0.85,dur:0.7,noise:0.4,res:320,attack:0.01,decay:0.7,harmonics:1}, p:{h:0.12, r:0.18, c:'#cc0000', wc:0} },
  { id:'scented_candle', name:'Duftkerze', icon:'🕯️', cat:'wax', price:60, reward:12, crush:'melt', sound:'soft', sp:{pitch:0.9,dur:0.8,noise:0.35,res:350,attack:0.008,decay:0.8,harmonics:2}, p:{h:0.2, r:0.15, c:'#dda0dd', wc:'#333333'} },
  { id:'wax_rose', name:'Wachsrose', icon:'🌹', cat:'wax', price:150, reward:30, crush:'melt', sound:'soft', sp:{pitch:1.2,dur:0.5,noise:0.3,res:420,attack:0.005,decay:0.5,harmonics:2}, p:{h:0.2, r:0.15, c:'#ff3366', wc:0} },
  { id:'wax_figure', name:'Wachsfigur', icon:'🗿', cat:'wax', price:200, reward:40, crush:'melt', sound:'soft', sp:{pitch:0.5,dur:1.2,noise:0.5,res:220,attack:0.012,decay:1.2,harmonics:2}, p:{h:0.5, r:0.18, c:'#f5deb3', wc:0} },
];

// ═══════════════════════════════════════════════════
// 3. ECONOMY SYSTEM
// ═══════════════════════════════════════════════════
let economy = { coins: 0, unlocked: ['watermelon'], totalCrushed: 0 };

function loadSave() {
  try {
    const d = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (d) { economy = d; }
  } catch(e) {}
}

function saveSave() {
  localStorage.setItem(SAVE_KEY, JSON.stringify(economy));
  saveToCloud();
}

function addCoins(n) {
  economy.coins += n;
  economy.totalCrushed++;
  document.getElementById('coin-amount').textContent = economy.coins;
  document.getElementById('crush-count').textContent = economy.totalCrushed;
  saveSave();
}

function isUnlocked(id) {
  return economy.unlocked.includes(id);
}

function unlockObject(id) {
  const obj = OBJECTS.find(o => o.id === id);
  if (!obj || isUnlocked(id) || economy.coins < obj.price) return false;
  economy.coins -= obj.price;
  economy.unlocked.push(id);
  document.getElementById('coin-amount').textContent = economy.coins;
  saveSave();
  return true;
}

function getObjData(id) {
  return OBJECTS.find(o => o.id === id);
}

// ═══════════════════════════════════════════════════
// 3b. AUTH & CLOUD SAVE SYSTEM
// ═══════════════════════════════════════════════════
let currentUser = null;
let isGuest = false;
let _cloudSaveTimer = null;
let _lastCloudSave = 0;
const CLOUD_SAVE_DEBOUNCE = 3000;

function updateAuthUI() {
  var authBtn = document.getElementById('auth-btn');
  var userDisplay = document.getElementById('user-display-name');
  // Remove old admin link if present
  var oldAdmin = document.getElementById('admin-link');
  if (oldAdmin) oldAdmin.remove();
  if (currentUser) {
    if (authBtn) authBtn.textContent = 'Abmelden';
    if (userDisplay) {
      var name = currentUser.user_metadata && currentUser.user_metadata.display_name
        ? currentUser.user_metadata.display_name
        : currentUser.email;
      userDisplay.textContent = name;
      userDisplay.style.display = 'inline';
    }
    // Check if admin and add admin link
    if (sbClient) {
      sbClient.from('profiles').select('is_admin').eq('id', currentUser.id).single()
        .then(function(res) {
          if (res.data && res.data.is_admin) {
            var userInfo = document.getElementById('user-info');
            if (userInfo && !document.getElementById('admin-link')) {
              var link = document.createElement('a');
              link.id = 'admin-link';
              link.href = '/admin';
              link.textContent = 'ADMIN';
              link.style.cssText = 'padding:6px 12px;border:1px solid rgba(232,122,30,0.4);border-radius:6px;background:rgba(232,122,30,0.15);color:#e87a1e;font-family:"Bebas Neue",sans-serif;font-size:14px;letter-spacing:1.5px;cursor:pointer;transition:all 0.2s;text-decoration:none;';
              link.addEventListener('mouseenter', function() {
                link.style.borderColor = '#e87a1e';
                link.style.boxShadow = '0 0 12px rgba(232,122,30,0.3)';
              });
              link.addEventListener('mouseleave', function() {
                link.style.borderColor = 'rgba(232,122,30,0.4)';
                link.style.boxShadow = 'none';
              });
              userInfo.insertBefore(link, userInfo.firstChild);
            }
          }
        });
    }
  } else {
    if (authBtn) authBtn.textContent = 'Anmelden';
    if (userDisplay) {
      userDisplay.textContent = '';
      userDisplay.style.display = 'none';
    }
  }
}

function showAuthError(msg) {
  // Auth error display moved to separate login/register pages
}

async function signUp(email, password, displayName) {
  if (!sbClient) return { user: null, error: 'Supabase nicht verfügbar' };
  var { data, error } = await sbClient.auth.signUp({
    email: email,
    password: password,
    options: {
      data: { display_name: displayName || email.split('@')[0] },
      emailRedirectTo: window.location.origin + window.location.pathname
    }
  });
  if (error) return { user: null, error: error.message };
  currentUser = data.user;
  isGuest = false;
  updateAuthUI();
  await loadCloudSave();
  return { user: data.user, error: null };
}

async function signIn(email, password) {
  if (!sbClient) return { user: null, error: 'Supabase nicht verfügbar' };
  var { data, error } = await sbClient.auth.signInWithPassword({
    email: email,
    password: password
  });
  if (error) return { user: null, error: error.message };
  currentUser = data.user;
  isGuest = false;
  updateAuthUI();
  await loadCloudSave();
  return { user: data.user, error: null };
}

async function signOut() {
  if (!sbClient) return;
  await sbClient.auth.signOut();
  currentUser = null;
  isGuest = false;
  updateAuthUI();
  window.location.href = '/login';
}

async function loadCloudSave() {
  if (!sbClient || !currentUser) return;
  try {
    var { data, error } = await sbClient
      .from('profiles')
      .select('coins, unlocked, total_crushed, selected_object, recent_objects, updated_at')
      .eq('id', currentUser.id)
      .single();
    if (error || !data) return;
    // Merge: higher coins, union of unlocked, higher totalCrushed
    if (data.coins > economy.coins) economy.coins = data.coins;
    if (data.total_crushed > economy.totalCrushed) economy.totalCrushed = data.total_crushed;
    if (data.unlocked && Array.isArray(data.unlocked)) {
      var merged = new Set(economy.unlocked);
      data.unlocked.forEach(function(id) { merged.add(id); });
      economy.unlocked = Array.from(merged);
    }
    if (data.selected_object) selectedObjId = data.selected_object;
    if (data.recent_objects && Array.isArray(data.recent_objects) && data.recent_objects.length > 0) {
      recentObjects = data.recent_objects;
    }
    // Update UI
    var coinEl = document.getElementById('coin-amount');
    if (coinEl) coinEl.textContent = economy.coins;
    var crushEl = document.getElementById('crush-count');
    if (crushEl) crushEl.textContent = economy.totalCrushed;
    crushCount = economy.totalCrushed;
    saveSave(); // sync merged data back to localStorage
  } catch (e) {
    console.warn('Cloud save load failed:', e);
  }
}

function saveToCloud() {
  if (!sbClient || !currentUser || isGuest) return;
  var now = Date.now();
  if (now - _lastCloudSave < CLOUD_SAVE_DEBOUNCE) {
    if (_cloudSaveTimer) clearTimeout(_cloudSaveTimer);
    _cloudSaveTimer = setTimeout(saveToCloud, CLOUD_SAVE_DEBOUNCE);
    return;
  }
  _lastCloudSave = now;
  if (_cloudSaveTimer) { clearTimeout(_cloudSaveTimer); _cloudSaveTimer = null; }
  sbClient
    .from('profiles')
    .upsert({
      id: currentUser.id,
      coins: economy.coins,
      unlocked: economy.unlocked,
      total_crushed: economy.totalCrushed,
      selected_object: selectedObjId,
      recent_objects: recentObjects,
      updated_at: new Date().toISOString()
    }, { onConflict: 'id' })
    .then(function(res) {
      if (res.error) console.warn('Cloud save failed:', res.error.message);
    });
}

function _saveToCloudImmediate() {
  if (!sbClient || !currentUser || isGuest) return;
  _lastCloudSave = Date.now();
  if (_cloudSaveTimer) { clearTimeout(_cloudSaveTimer); _cloudSaveTimer = null; }
  // Use sendBeacon for beforeunload reliability if available
  var body = JSON.stringify({
    id: currentUser.id,
    coins: economy.coins,
    unlocked: economy.unlocked,
    total_crushed: economy.totalCrushed,
    selected_object: selectedObjId,
    recent_objects: recentObjects,
    updated_at: new Date().toISOString()
  });
  // Fall back to regular upsert
  sbClient
    .from('profiles')
    .upsert(JSON.parse(body), { onConflict: 'id' })
    .then(function(res) {
      if (res.error) console.warn('Cloud save failed:', res.error.message);
    });
}

function wireAuthUI() {
  var authBtn = document.getElementById('auth-btn');

  if (authBtn) {
    authBtn.addEventListener('click', function() {
      if (currentUser) {
        signOut();
      } else {
        window.location.href = '/login';
      }
    });
  }
}

async function initAuth() {
  if (!sbClient) {
    isGuest = true;
    return;
  }
  try {
    var { data } = await sbClient.auth.getSession();
    if (data && data.session && data.session.user) {
      currentUser = data.session.user;
      isGuest = false;
      updateAuthUI();
      await loadCloudSave();
    } else {
      // No session — default to guest mode (user can click Anmelden to go to /login)
      isGuest = true;
    }
  } catch (e) {
    console.warn('Auth session check failed:', e);
    isGuest = true;
  }
  // Listen for auth state changes (token refresh, sign out from other tab)
  sbClient.auth.onAuthStateChange(function(event, session) {
    if (event === 'SIGNED_IN' && session && session.user) {
      currentUser = session.user;
      isGuest = false;
      updateAuthUI();
      loadCloudSave();
    } else if (event === 'SIGNED_OUT') {
      currentUser = null;
      updateAuthUI();
    }
  });
}

// ═══════════════════════════════════════════════════
// 4. AUDIO ENGINE
// ═══════════════════════════════════════════════════
function initAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  ambientHumOsc = audioCtx.createOscillator();
  ambientHumOsc.type = 'sine';
  ambientHumOsc.frequency.value = 50;
  const humGain = audioCtx.createGain();
  humGain.gain.value = 0.015;
  ambientHumOsc.connect(humGain);
  humGain.connect(audioCtx.destination);
  ambientHumOsc.start();
}

function createNoiseBuffer(duration) {
  const sampleRate = audioCtx.sampleRate;
  const length = sampleRate * duration;
  const buffer = audioCtx.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

function playHydraulicPump() {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(30, audioCtx.currentTime);
  osc.frequency.linearRampToValueAtTime(60, audioCtx.currentTime + 0.5);
  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
  gain.gain.linearRampToValueAtTime(0.0, audioCtx.currentTime + 0.5);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.5);
}

function playRetractHiss() {
  if (!audioCtx) return;
  const noiseBuffer = createNoiseBuffer(0.3);
  const src = audioCtx.createBufferSource();
  src.buffer = noiseBuffer;
  const filter = audioCtx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 4000;
  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(audioCtx.destination);
  src.start();
  src.stop(audioCtx.currentTime + 0.3);
}

function playCrushSound(profile, intensity, sp) {
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  const vol = Math.max(0.05, Math.min(1.0, intensity));
  const s = sp || {};
  const pitch = s.pitch || 1.0;
  const dur = s.dur || 1.0;
  const noiseMix = s.noise != null ? s.noise : 0.5;
  const res = s.res || 600;
  const atk = s.attack || 0.01;
  const dec = s.decay || 1.0;
  const harms = s.harmonics || 2;

  if (profile === 'wet') {
    const thudOsc = audioCtx.createOscillator();
    thudOsc.type = 'sine';
    thudOsc.frequency.value = 60 * pitch;
    const thudGain = audioCtx.createGain();
    thudGain.gain.setValueAtTime(0.3 * vol, t + atk);
    thudGain.gain.exponentialRampToValueAtTime(0.001, t + 0.25 * dur * dec);
    thudOsc.connect(thudGain);
    thudGain.connect(audioCtx.destination);
    thudOsc.start(t);
    thudOsc.stop(t + 0.25 * dur * dec);
    const sqBuf = createNoiseBuffer(0.2 * dur);
    const sqSrc = audioCtx.createBufferSource();
    sqSrc.buffer = sqBuf;
    const sqFilter = audioCtx.createBiquadFilter();
    sqFilter.type = 'bandpass';
    sqFilter.frequency.value = res;
    sqFilter.Q.value = 2;
    const sqGain = audioCtx.createGain();
    sqGain.gain.setValueAtTime(0.2 * vol * noiseMix, t + atk + 0.02);
    sqGain.gain.exponentialRampToValueAtTime(0.001, t + 0.2 * dur * dec);
    sqSrc.connect(sqFilter);
    sqFilter.connect(sqGain);
    sqGain.connect(audioCtx.destination);
    sqSrc.start(t + atk + 0.02);
    sqSrc.stop(t + 0.22 * dur);
    for (let i = 1; i < harms; i++) {
      const hOsc = audioCtx.createOscillator();
      hOsc.type = 'sine';
      hOsc.frequency.value = 60 * pitch * (i + 1) * 1.3;
      const hGain = audioCtx.createGain();
      hGain.gain.setValueAtTime(0.08 * vol / (i + 1), t + atk);
      hGain.gain.exponentialRampToValueAtTime(0.001, t + 0.15 * dur * dec);
      hOsc.connect(hGain);
      hGain.connect(audioCtx.destination);
      hOsc.start(t);
      hOsc.stop(t + 0.15 * dur * dec);
    }
  }

  else if (profile === 'metallic') {
    const clangOsc = audioCtx.createOscillator();
    clangOsc.type = 'square';
    clangOsc.frequency.value = 800 * pitch;
    const clangGain = audioCtx.createGain();
    clangGain.gain.setValueAtTime(0.2 * vol, t + atk);
    clangGain.gain.exponentialRampToValueAtTime(0.001, t + 0.15 * dur * dec);
    clangOsc.connect(clangGain);
    clangGain.connect(audioCtx.destination);
    clangOsc.start(t);
    clangOsc.stop(t + 0.15 * dur * dec);
    for (let i = 0; i < harms; i++) {
      const ringOsc = audioCtx.createOscillator();
      ringOsc.type = 'sine';
      ringOsc.frequency.value = res * (i + 2) * pitch;
      const ringGain = audioCtx.createGain();
      ringGain.gain.setValueAtTime(0.15 * vol / (i + 1), t + atk);
      ringGain.gain.exponentialRampToValueAtTime(0.001, t + 0.6 * dur * dec / (i * 0.3 + 1));
      ringOsc.connect(ringGain);
      ringGain.connect(audioCtx.destination);
      ringOsc.start(t);
      ringOsc.stop(t + 0.6 * dur * dec);
    }
    if (noiseMix > 0.2) {
      const mBuf = createNoiseBuffer(0.1 * dur);
      const mSrc = audioCtx.createBufferSource();
      mSrc.buffer = mBuf;
      const mFilt = audioCtx.createBiquadFilter();
      mFilt.type = 'bandpass';
      mFilt.frequency.value = res * pitch;
      mFilt.Q.value = 4;
      const mGain = audioCtx.createGain();
      mGain.gain.setValueAtTime(0.08 * vol * noiseMix, t);
      mGain.gain.exponentialRampToValueAtTime(0.001, t + 0.1 * dur);
      mSrc.connect(mFilt);
      mFilt.connect(mGain);
      mGain.connect(audioCtx.destination);
      mSrc.start(t);
      mSrc.stop(t + 0.1 * dur);
    }
  }

  else if (profile === 'shatter') {
    const shBuf = createNoiseBuffer(0.4 * dur);
    const shSrc = audioCtx.createBufferSource();
    shSrc.buffer = shBuf;
    const shFilter = audioCtx.createBiquadFilter();
    shFilter.type = 'highpass';
    shFilter.frequency.value = res * 0.5;
    const shGain = audioCtx.createGain();
    shGain.gain.setValueAtTime(0.3 * vol * noiseMix, t + atk);
    shGain.gain.exponentialRampToValueAtTime(0.001, t + 0.35 * dur * dec);
    shSrc.connect(shFilter);
    shFilter.connect(shGain);
    shGain.connect(audioCtx.destination);
    shSrc.start(t);
    shSrc.stop(t + 0.4 * dur);
    for (let i = 0; i < harms; i++) {
      const tOsc = audioCtx.createOscillator();
      tOsc.type = 'sine';
      const startFreq = (3000 + Math.random() * 2000) * pitch;
      tOsc.frequency.setValueAtTime(startFreq, t + i * 0.05 * dur);
      tOsc.frequency.exponentialRampToValueAtTime(startFreq * 0.3, t + 0.5 * dur + i * 0.05);
      const tGain = audioCtx.createGain();
      tGain.gain.setValueAtTime(0.06 * vol / (i * 0.2 + 1), t + i * 0.05 * dur);
      tGain.gain.exponentialRampToValueAtTime(0.001, t + 0.4 * dur * dec + i * 0.05);
      tOsc.connect(tGain);
      tGain.connect(audioCtx.destination);
      tOsc.start(t + i * 0.05 * dur);
      tOsc.stop(t + 0.5 * dur + i * 0.05);
    }
  }

  else if (profile === 'wood_crack') {
    const crBuf = createNoiseBuffer(0.08 * dur);
    const crSrc = audioCtx.createBufferSource();
    crSrc.buffer = crBuf;
    const crFilter = audioCtx.createBiquadFilter();
    crFilter.type = 'highpass';
    crFilter.frequency.value = res;
    const crGain = audioCtx.createGain();
    crGain.gain.setValueAtTime(0.35 * vol * noiseMix, t + atk);
    crGain.gain.exponentialRampToValueAtTime(0.001, t + 0.08 * dur * dec);
    crSrc.connect(crFilter);
    crFilter.connect(crGain);
    crGain.connect(audioCtx.destination);
    crSrc.start(t);
    crSrc.stop(t + 0.08 * dur);
    const snapOsc = audioCtx.createOscillator();
    snapOsc.type = 'triangle';
    snapOsc.frequency.value = 400 * pitch;
    const snapGain = audioCtx.createGain();
    snapGain.gain.setValueAtTime(0.2 * vol, t + atk + 0.01);
    snapGain.gain.exponentialRampToValueAtTime(0.001, t + 0.12 * dur * dec);
    snapOsc.connect(snapGain);
    snapGain.connect(audioCtx.destination);
    snapOsc.start(t + atk + 0.01);
    snapOsc.stop(t + 0.12 * dur * dec);
    for (let i = 1; i < harms; i++) {
      const cOsc = audioCtx.createOscillator();
      cOsc.type = 'triangle';
      cOsc.frequency.value = 400 * pitch * (i + 1) * 0.8;
      const cGain = audioCtx.createGain();
      cGain.gain.setValueAtTime(0.06 * vol / (i + 1), t + atk);
      cGain.gain.exponentialRampToValueAtTime(0.001, t + 0.08 * dur * dec);
      cOsc.connect(cGain);
      cGain.connect(audioCtx.destination);
      cOsc.start(t + atk);
      cOsc.stop(t + 0.08 * dur * dec);
    }
  }

  else if (profile === 'pop') {
    const popOsc = audioCtx.createOscillator();
    popOsc.type = 'sine';
    popOsc.frequency.setValueAtTime(100 * pitch, t + atk);
    popOsc.frequency.exponentialRampToValueAtTime(800 * pitch, t + atk + 0.04 * dur);
    const popGain = audioCtx.createGain();
    popGain.gain.setValueAtTime(0.3 * vol, t + atk);
    popGain.gain.setValueAtTime(0.3 * vol, t + atk + 0.04 * dur);
    popGain.gain.exponentialRampToValueAtTime(0.001, t + 0.08 * dur * dec);
    popOsc.connect(popGain);
    popGain.connect(audioCtx.destination);
    popOsc.start(t);
    popOsc.stop(t + 0.08 * dur * dec);
    const airBuf = createNoiseBuffer(0.06 * dur);
    const airSrc = audioCtx.createBufferSource();
    airSrc.buffer = airBuf;
    const airFilter = audioCtx.createBiquadFilter();
    airFilter.type = 'bandpass';
    airFilter.frequency.value = res;
    const airGain = audioCtx.createGain();
    airGain.gain.setValueAtTime(0.12 * vol * noiseMix, t + atk + 0.03);
    airGain.gain.exponentialRampToValueAtTime(0.001, t + 0.09 * dur * dec);
    airSrc.connect(airFilter);
    airFilter.connect(airGain);
    airGain.connect(audioCtx.destination);
    airSrc.start(t + atk + 0.03);
    airSrc.stop(t + 0.09 * dur);
    for (let i = 1; i < harms; i++) {
      const phOsc = audioCtx.createOscillator();
      phOsc.type = 'sine';
      phOsc.frequency.setValueAtTime(200 * pitch * (i + 1), t + atk);
      phOsc.frequency.exponentialRampToValueAtTime(600 * pitch * (i + 1), t + atk + 0.03 * dur);
      const phGain = audioCtx.createGain();
      phGain.gain.setValueAtTime(0.06 * vol / (i + 1), t + atk);
      phGain.gain.exponentialRampToValueAtTime(0.001, t + 0.06 * dur * dec);
      phOsc.connect(phGain);
      phGain.connect(audioCtx.destination);
      phOsc.start(t);
      phOsc.stop(t + 0.06 * dur * dec);
    }
  }

  else if (profile === 'electronic') {
    const burstCount = Math.max(2, Math.min(8, harms + 1));
    for (let i = 0; i < burstCount; i++) {
      const sparkBuf = createNoiseBuffer(0.03 * dur);
      const sparkSrc = audioCtx.createBufferSource();
      sparkSrc.buffer = sparkBuf;
      const sparkFilter = audioCtx.createBiquadFilter();
      sparkFilter.type = 'highpass';
      sparkFilter.frequency.value = res * pitch;
      const sparkGain = audioCtx.createGain();
      const offset = i * 0.06 * dur;
      sparkGain.gain.setValueAtTime(0.2 * vol * noiseMix, t + offset + atk);
      sparkGain.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.03 * dur * dec);
      sparkSrc.connect(sparkFilter);
      sparkFilter.connect(sparkGain);
      sparkGain.connect(audioCtx.destination);
      sparkSrc.start(t + offset);
      sparkSrc.stop(t + offset + 0.03 * dur);
    }
    const buzzOsc = audioCtx.createOscillator();
    buzzOsc.type = 'sawtooth';
    buzzOsc.frequency.setValueAtTime(600 * pitch, t + atk);
    buzzOsc.frequency.exponentialRampToValueAtTime(80 * pitch, t + 0.4 * dur * dec);
    const buzzGain = audioCtx.createGain();
    buzzGain.gain.setValueAtTime(0.12 * vol, t + atk);
    buzzGain.gain.exponentialRampToValueAtTime(0.001, t + 0.4 * dur * dec);
    buzzOsc.connect(buzzGain);
    buzzGain.connect(audioCtx.destination);
    buzzOsc.start(t);
    buzzOsc.stop(t + 0.4 * dur * dec);
  }

  else if (profile === 'stone') {
    const stoneOsc = audioCtx.createOscillator();
    stoneOsc.type = 'sine';
    stoneOsc.frequency.value = 40 * pitch;
    const stoneGain = audioCtx.createGain();
    stoneGain.gain.setValueAtTime(0.35 * vol, t + atk);
    stoneGain.gain.exponentialRampToValueAtTime(0.001, t + 0.3 * dur * dec);
    stoneOsc.connect(stoneGain);
    stoneGain.connect(audioCtx.destination);
    stoneOsc.start(t);
    stoneOsc.stop(t + 0.3 * dur * dec);
    const crumbleBuf = createNoiseBuffer(0.5 * dur);
    const crumbleSrc = audioCtx.createBufferSource();
    crumbleSrc.buffer = crumbleBuf;
    const crumbleFilter = audioCtx.createBiquadFilter();
    crumbleFilter.type = 'bandpass';
    crumbleFilter.frequency.value = res;
    crumbleFilter.Q.value = 1;
    const crumbleGain = audioCtx.createGain();
    crumbleGain.gain.setValueAtTime(0.15 * vol * noiseMix, t + atk + 0.05);
    crumbleGain.gain.exponentialRampToValueAtTime(0.001, t + 0.5 * dur * dec);
    crumbleSrc.connect(crumbleFilter);
    crumbleFilter.connect(crumbleGain);
    crumbleGain.connect(audioCtx.destination);
    crumbleSrc.start(t + atk + 0.05);
    crumbleSrc.stop(t + 0.55 * dur);
    for (let i = 1; i < harms; i++) {
      const shOsc = audioCtx.createOscillator();
      shOsc.type = 'sine';
      shOsc.frequency.value = 40 * pitch * (i * 0.7 + 1);
      const shGain = audioCtx.createGain();
      shGain.gain.setValueAtTime(0.1 * vol / (i + 1), t + atk);
      shGain.gain.exponentialRampToValueAtTime(0.001, t + 0.2 * dur * dec);
      shOsc.connect(shGain);
      shGain.connect(audioCtx.destination);
      shOsc.start(t);
      shOsc.stop(t + 0.2 * dur * dec);
    }
  }

  else if (profile === 'rubbery') {
    const squeakOsc = audioCtx.createOscillator();
    squeakOsc.type = 'sine';
    const baseFreq = 200 * pitch;
    squeakOsc.frequency.setValueAtTime(baseFreq, t + atk);
    squeakOsc.frequency.exponentialRampToValueAtTime(baseFreq * 4.5, t + 0.1 * dur);
    squeakOsc.frequency.exponentialRampToValueAtTime(baseFreq * 2, t + 0.25 * dur);
    squeakOsc.frequency.exponentialRampToValueAtTime(baseFreq * 6, t + 0.35 * dur);
    squeakOsc.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, t + 0.5 * dur * dec);
    const squeakGain = audioCtx.createGain();
    squeakGain.gain.setValueAtTime(0.18 * vol, t + atk);
    squeakGain.gain.setValueAtTime(0.15 * vol, t + 0.2 * dur);
    squeakGain.gain.exponentialRampToValueAtTime(0.001, t + 0.5 * dur * dec);
    squeakOsc.connect(squeakGain);
    squeakGain.connect(audioCtx.destination);
    squeakOsc.start(t);
    squeakOsc.stop(t + 0.5 * dur * dec);
    if (noiseMix > 0.2) {
      const rBuf = createNoiseBuffer(0.15 * dur);
      const rSrc = audioCtx.createBufferSource();
      rSrc.buffer = rBuf;
      const rFilt = audioCtx.createBiquadFilter();
      rFilt.type = 'lowpass';
      rFilt.frequency.value = res;
      const rGain = audioCtx.createGain();
      rGain.gain.setValueAtTime(0.06 * vol * noiseMix, t + atk);
      rGain.gain.exponentialRampToValueAtTime(0.001, t + 0.15 * dur * dec);
      rSrc.connect(rFilt);
      rFilt.connect(rGain);
      rGain.connect(audioCtx.destination);
      rSrc.start(t);
      rSrc.stop(t + 0.15 * dur);
    }
    for (let i = 1; i < harms; i++) {
      const hOsc = audioCtx.createOscillator();
      hOsc.type = 'sine';
      hOsc.frequency.setValueAtTime(baseFreq * (i + 2), t + atk + i * 0.04);
      hOsc.frequency.exponentialRampToValueAtTime(baseFreq * (i + 1), t + 0.2 * dur);
      const hGain = audioCtx.createGain();
      hGain.gain.setValueAtTime(0.05 * vol / (i + 1), t + atk + i * 0.04);
      hGain.gain.exponentialRampToValueAtTime(0.001, t + 0.15 * dur * dec);
      hOsc.connect(hGain);
      hGain.connect(audioCtx.destination);
      hOsc.start(t + i * 0.04);
      hOsc.stop(t + 0.2 * dur * dec);
    }
  }

  else if (profile === 'toy') {
    const chirpOsc = audioCtx.createOscillator();
    chirpOsc.type = 'sine';
    chirpOsc.frequency.setValueAtTime(1800 * pitch, t + atk);
    chirpOsc.frequency.exponentialRampToValueAtTime(2400 * pitch, t + atk + 0.03 * dur);
    chirpOsc.frequency.exponentialRampToValueAtTime(1200 * pitch, t + 0.1 * dur);
    const chirpGain = audioCtx.createGain();
    chirpGain.gain.setValueAtTime(0.2 * vol, t + atk);
    chirpGain.gain.exponentialRampToValueAtTime(0.001, t + 0.12 * dur * dec);
    chirpOsc.connect(chirpGain);
    chirpGain.connect(audioCtx.destination);
    chirpOsc.start(t);
    chirpOsc.stop(t + 0.12 * dur * dec);
    for (let i = 0; i < harms; i++) {
      const ch = audioCtx.createOscillator();
      ch.type = i % 2 === 0 ? 'square' : 'sine';
      ch.frequency.setValueAtTime(res * (i + 2) * pitch, t + atk + 0.02 * (i + 1));
      ch.frequency.exponentialRampToValueAtTime(res * (i + 1) * pitch, t + 0.08 * dur);
      const chGain = audioCtx.createGain();
      chGain.gain.setValueAtTime(0.08 * vol / (i + 1), t + atk + 0.02 * (i + 1));
      chGain.gain.exponentialRampToValueAtTime(0.001, t + 0.1 * dur * dec);
      ch.connect(chGain);
      chGain.connect(audioCtx.destination);
      ch.start(t + 0.02 * (i + 1));
      ch.stop(t + 0.1 * dur * dec);
    }
    if (noiseMix > 0.3) {
      const tBuf = createNoiseBuffer(0.05 * dur);
      const tSrc = audioCtx.createBufferSource();
      tSrc.buffer = tBuf;
      const tFilt = audioCtx.createBiquadFilter();
      tFilt.type = 'bandpass';
      tFilt.frequency.value = res * pitch;
      tFilt.Q.value = 3;
      const tGain = audioCtx.createGain();
      tGain.gain.setValueAtTime(0.05 * vol * noiseMix, t + atk);
      tGain.gain.exponentialRampToValueAtTime(0.001, t + 0.05 * dur);
      tSrc.connect(tFilt);
      tFilt.connect(tGain);
      tGain.connect(audioCtx.destination);
      tSrc.start(t);
      tSrc.stop(t + 0.05 * dur);
    }
  }

  else if (profile === 'paper') {
    const paperBuf = createNoiseBuffer(0.3 * dur);
    const paperSrc = audioCtx.createBufferSource();
    paperSrc.buffer = paperBuf;
    const paperFilter = audioCtx.createBiquadFilter();
    paperFilter.type = 'bandpass';
    paperFilter.frequency.value = res;
    paperFilter.Q.value = 0.5;
    const paperGain = audioCtx.createGain();
    paperGain.gain.setValueAtTime(0.06 * vol * noiseMix, t + atk);
    paperGain.gain.setValueAtTime(0.08 * vol * noiseMix, t + 0.05 * dur);
    paperGain.gain.setValueAtTime(0.04 * vol * noiseMix, t + 0.1 * dur);
    paperGain.gain.setValueAtTime(0.07 * vol * noiseMix, t + 0.15 * dur);
    paperGain.gain.exponentialRampToValueAtTime(0.001, t + 0.3 * dur * dec);
    paperSrc.connect(paperFilter);
    paperFilter.connect(paperGain);
    paperGain.connect(audioCtx.destination);
    paperSrc.start(t);
    paperSrc.stop(t + 0.3 * dur);
    for (let i = 0; i < harms - 1; i++) {
      const pOsc = audioCtx.createOscillator();
      pOsc.type = 'sine';
      pOsc.frequency.setValueAtTime(res * pitch * (i + 2), t + atk + i * 0.03);
      pOsc.frequency.exponentialRampToValueAtTime(res * pitch * (i + 1) * 0.5, t + 0.1 * dur);
      const pGain = audioCtx.createGain();
      pGain.gain.setValueAtTime(0.03 * vol / (i + 1), t + atk + i * 0.03);
      pGain.gain.exponentialRampToValueAtTime(0.001, t + 0.08 * dur * dec);
      pOsc.connect(pGain);
      pGain.connect(audioCtx.destination);
      pOsc.start(t + i * 0.03);
      pOsc.stop(t + 0.08 * dur * dec);
    }
  }

  else if (profile === 'soft') {
    const softOsc = audioCtx.createOscillator();
    softOsc.type = 'sine';
    softOsc.frequency.value = 50 * pitch;
    const softGain = audioCtx.createGain();
    softGain.gain.setValueAtTime(0.1 * vol, t + atk);
    softGain.gain.exponentialRampToValueAtTime(0.001, t + 0.2 * dur * dec);
    softOsc.connect(softGain);
    softGain.connect(audioCtx.destination);
    softOsc.start(t);
    softOsc.stop(t + 0.2 * dur * dec);
    const softBuf = createNoiseBuffer(0.15 * dur);
    const softSrc = audioCtx.createBufferSource();
    softSrc.buffer = softBuf;
    const softFilter = audioCtx.createBiquadFilter();
    softFilter.type = 'lowpass';
    softFilter.frequency.value = res;
    const softNoiseGain = audioCtx.createGain();
    softNoiseGain.gain.setValueAtTime(0.04 * vol * noiseMix, t + atk);
    softNoiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.15 * dur * dec);
    softSrc.connect(softFilter);
    softFilter.connect(softNoiseGain);
    softNoiseGain.connect(audioCtx.destination);
    softSrc.start(t);
    softSrc.stop(t + 0.15 * dur);
    for (let i = 1; i < harms; i++) {
      const shOsc = audioCtx.createOscillator();
      shOsc.type = 'sine';
      shOsc.frequency.value = 50 * pitch * (i + 1);
      const shGain = audioCtx.createGain();
      shGain.gain.setValueAtTime(0.03 * vol / (i + 1), t + atk);
      shGain.gain.exponentialRampToValueAtTime(0.001, t + 0.12 * dur * dec);
      shOsc.connect(shGain);
      shGain.connect(audioCtx.destination);
      shOsc.start(t);
      shOsc.stop(t + 0.12 * dur * dec);
    }
  }
}

// ═══════════════════════════════════════════════════
// 5. TEXTURE GENERATOR
// ═══════════════════════════════════════════════════
const textureCache = {};

function generateTexture(type, baseColor) {
  const key = type + '_' + baseColor;
  if (textureCache[key]) return textureCache[key];
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');

  // Parse hex color to CSS string
  const colorStr = typeof baseColor === 'string' ? baseColor : '#' + baseColor.toString(16).padStart(6, '0');

  switch (type) {
    case 'metal':
      generateMetalTexture(ctx, size, colorStr);
      break;
    case 'wood':
      generateWoodTexture(ctx, size, colorStr);
      break;
    case 'concrete':
      generateConcreteTexture(ctx, size, colorStr);
      break;
    case 'fruit':
      generateFruitTexture(ctx, size, colorStr);
      break;
    case 'fabric':
      generateFabricTexture(ctx, size, colorStr);
      break;
    case 'brick':
      generateBrickTexture(ctx, size, colorStr);
      break;
    case 'paper':
      generatePaperTexture(ctx, size, colorStr);
      break;
    default:
      ctx.fillStyle = colorStr;
      ctx.fillRect(0, 0, size, size);
      break;
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  textureCache[key] = texture;
  return texture;
}

function generateMetalTexture(ctx, size, colorStr) {
  ctx.fillStyle = colorStr;
  ctx.fillRect(0, 0, size, size);
  // Horizontal noise lines - slightly lighter and darker
  for (let y = 0; y < size; y += 2) {
    const brightness = Math.random() * 30 - 15;
    const alpha = 0.1 + Math.random() * 0.1;
    if (brightness > 0) {
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    } else {
      ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
    }
    ctx.fillRect(0, y, size, 1);
  }
  // Faint scratches
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 0.5;
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.moveTo(Math.random() * size, Math.random() * size);
    ctx.lineTo(Math.random() * size, Math.random() * size);
    ctx.stroke();
  }
}

function generateWoodTexture(ctx, size, colorStr) {
  ctx.fillStyle = colorStr;
  ctx.fillRect(0, 0, size, size);
  // Parallel grain lines in slightly darker shade
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.12)';
  ctx.lineWidth = 1;
  for (let y = 0; y < size; y += 4 + Math.random() * 3) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x < size; x += 8) {
      ctx.lineTo(x, y + Math.sin(x * 0.05) * 2);
    }
    ctx.stroke();
  }
  // 1-2 knot circles
  for (let i = 0; i < 2; i++) {
    const kx = 20 + Math.random() * (size - 40);
    const ky = 20 + Math.random() * (size - 40);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(kx, ky, 5 + Math.random() * 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(kx, ky, 2 + Math.random() * 3, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function generateConcreteTexture(ctx, size, colorStr) {
  ctx.fillStyle = colorStr;
  ctx.fillRect(0, 0, size, size);
  // Random speckle dots in varying grays
  for (let i = 0; i < 300; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const gray = Math.floor(80 + Math.random() * 120);
    const alpha = 0.05 + Math.random() * 0.1;
    ctx.fillStyle = `rgba(${gray}, ${gray}, ${gray}, ${alpha})`;
    const dotSize = 1 + Math.random() * 2;
    ctx.fillRect(x, y, dotSize, dotSize);
  }
  // A few larger splotches
  for (let i = 0; i < 8; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const gray = Math.floor(100 + Math.random() * 80);
    ctx.fillStyle = `rgba(${gray}, ${gray}, ${gray}, 0.06)`;
    ctx.beginPath();
    ctx.arc(x, y, 3 + Math.random() * 6, 0, Math.PI * 2);
    ctx.fill();
  }
}

function generateFruitTexture(ctx, size, colorStr) {
  ctx.fillStyle = colorStr;
  ctx.fillRect(0, 0, size, size);
  // Subtle darker organic patches - random circles with low alpha
  for (let i = 0; i < 15; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 4 + Math.random() * 12;
    ctx.fillStyle = `rgba(0, 0, 0, ${0.03 + Math.random() * 0.05})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // A few lighter patches
  for (let i = 0; i < 8; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 3 + Math.random() * 8;
    ctx.fillStyle = `rgba(255, 255, 255, ${0.02 + Math.random() * 0.04})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function generateFabricTexture(ctx, size, colorStr) {
  ctx.fillStyle = colorStr;
  ctx.fillRect(0, 0, size, size);
  // Cross-hatch pattern - thin lines in slightly different shade
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.06)';
  ctx.lineWidth = 0.5;
  // Horizontal threads
  for (let y = 0; y < size; y += 3) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size, y);
    ctx.stroke();
  }
  // Vertical threads
  for (let x = 0; x < size; x += 3) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, size);
    ctx.stroke();
  }
  // Lighter alternating lines for weave effect
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
  for (let y = 1; y < size; y += 6) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size, y);
    ctx.stroke();
  }
}

function generateBrickTexture(ctx, size, colorStr) {
  ctx.fillStyle = colorStr;
  ctx.fillRect(0, 0, size, size);
  // Draw mortar lines in lighter gray
  ctx.fillStyle = 'rgba(180, 170, 160, 0.6)';
  const brickH = 16;
  const brickW = 32;
  const mortarW = 2;
  // Horizontal mortar lines
  for (let y = 0; y < size; y += brickH) {
    ctx.fillRect(0, y, size, mortarW);
  }
  // Vertical mortar lines - offset every other row
  for (let row = 0; row < size / brickH; row++) {
    const offset = (row % 2) * (brickW / 2);
    for (let x = offset; x < size; x += brickW) {
      ctx.fillRect(x, row * brickH, mortarW, brickH);
    }
  }
  // Add some variation to brick colors
  for (let row = 0; row < size / brickH; row++) {
    const offset = (row % 2) * (brickW / 2);
    for (let x = offset; x < size; x += brickW) {
      const variation = Math.random() * 0.06;
      ctx.fillStyle = `rgba(0, 0, 0, ${variation})`;
      ctx.fillRect(x + mortarW, row * brickH + mortarW, brickW - mortarW * 2, brickH - mortarW * 2);
    }
  }
}

function generatePaperTexture(ctx, size, colorStr) {
  // Fill with off-white
  ctx.fillStyle = colorStr || '#f5f2eb';
  ctx.fillRect(0, 0, size, size);
  // Add very faint noise/grain
  for (let i = 0; i < 500; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const gray = Math.floor(150 + Math.random() * 80);
    const alpha = 0.02 + Math.random() * 0.04;
    ctx.fillStyle = `rgba(${gray}, ${gray}, ${gray}, ${alpha})`;
    ctx.fillRect(x, y, 1, 1);
  }
  // Very faint fiber lines
  ctx.strokeStyle = 'rgba(180, 170, 160, 0.04)';
  ctx.lineWidth = 0.5;
  for (let i = 0; i < 10; i++) {
    ctx.beginPath();
    ctx.moveTo(Math.random() * size, Math.random() * size);
    ctx.lineTo(Math.random() * size, Math.random() * size);
    ctx.stroke();
  }
}


// ═══════════════════════════════════════════════════
// 6. MATERIAL LIBRARY
// ═══════════════════════════════════════════════════
const materialCache = {};
let sceneEnvMap = null;

function createEnvMap(rendererRef) {
  const pmrem = new THREE.PMREMGenerator(rendererRef);
  pmrem.compileCubemapShader();
  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color(0x111118);
  const panelGeo = new THREE.PlaneGeometry(6, 0.5);
  const panelMat0 = new THREE.MeshBasicMaterial({ color: 0xccddee, side: THREE.DoubleSide });
  for (let ei = -1; ei <= 1; ei++) {
    const panel = new THREE.Mesh(panelGeo, panelMat0);
    panel.position.set(ei * 3, 4, 0);
    panel.rotation.x = Math.PI / 2;
    envScene.add(panel);
  }
  const accentGeo = new THREE.PlaneGeometry(0.3, 2);
  const accentMat0 = new THREE.MeshBasicMaterial({ color: 0xff8844, side: THREE.DoubleSide });
  const accent = new THREE.Mesh(accentGeo, accentMat0);
  accent.position.set(5, 1, 0);
  accent.rotation.y = Math.PI / 2;
  envScene.add(accent);
  const groundGeo = new THREE.PlaneGeometry(20, 20);
  const groundMat0 = new THREE.MeshBasicMaterial({ color: 0x0a0a0e, side: THREE.DoubleSide });
  const ground = new THREE.Mesh(groundGeo, groundMat0);
  ground.rotation.x = Math.PI / 2;
  ground.position.y = -2;
  envScene.add(ground);
  const rt = pmrem.fromScene(envScene, 0.04);
  sceneEnvMap = rt.texture;
  pmrem.dispose();
  return sceneEnvMap;
}

function getMat(color, roughness, metalness, opts = {}) {
  const key = `${color}_${roughness}_${metalness}_${opts.map || ''}_${opts.transparent || false}_${opts.opacity || 1}_${opts.emissive || ''}_${opts.emissiveIntensity || 0}_${opts.clearcoat || 0}`;
  if (materialCache[key]) return materialCache[key];
  const usePhysical = opts.clearcoat !== undefined || opts.clearcoatRoughness !== undefined;
  const MatClass = usePhysical ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial;
  const mat = new MatClass({
    color, roughness, metalness,
    envMap: sceneEnvMap,
    envMapIntensity: metalness > 0.5 ? 1.2 : 0.4,
    ...opts
  });
  materialCache[key] = mat;
  return mat;
}

// Preset materials — initialized after env map in init()
let frameMat, pistonMat, platformMat, hazardMat, floorMat, wallMat;

function initPresetMaterials() {
  frameMat = getMat(0x2a2a30, 0.45, 0.88, { map: generateTexture('metal', 0x2a2a30), envMapIntensity: 1.0 });
  pistonMat = getMat(0xaaaab0, 0.08, 0.98, { envMapIntensity: 2.0 });
  platformMat = getMat(0x555560, 0.55, 0.75, { map: generateTexture('metal', 0x555560), envMapIntensity: 0.8 });
  hazardMat = getMat(0xf5c542, 0.5, 0.3);
  floorMat = getMat(0x3a3a3e, 0.92, 0.05, { map: generateTexture('concrete', 0x3a3a3e), envMapIntensity: 0.1 });
  wallMat = getMat(0x252528, 0.95, 0.05, { envMapIntensity: 0.05 });
}


// ═══════════════════════════════════════════════════
// 7. CATEGORY BUILDERS
// ═══════════════════════════════════════════════════
function buildObject(objData) {
  const group = new THREE.Group();
  const builders = {
    fruit: buildFruit,
    metal_can: buildCan,
    glass: buildGlass,
    wood: buildWood,
    plastic: buildPlastic,
    electronics: buildElectronic,
    food: buildFood,
    rubber: buildRubber,
    stone: buildStone,
    toy: buildToy,
    paper: buildPaper,
    wax: buildWax
  };
  const builder = builders[objData.cat];
  if (builder) builder(group, objData);
  group.userData = {
    id: objData.id,
    cat: objData.cat,
    crush: objData.crush,
    sound: objData.sound,
    reward: objData.reward,
    height: 0
  };
  // Calculate bounding box for height
  const box = new THREE.Box3().setFromObject(group);
  group.userData.height = box.max.y - box.min.y;
  return group;
}

function buildFruit(group, objData) {
  const p = objData.p;
  const id = objData.id;
  const r = p.r || 0.15;
  const elong = p.elong || 1;
  const skinColor = p.c || 0xff4444;
  const innerColor = p.ic || 0xffccaa;
  const skinMat = getMat(skinColor, 0.6, 0.1, { map: generateTexture('fruit', skinColor) });
  const stemMat = getMat(0x5c3a1e, 0.8, 0.05);

  if (id === 'watermelon') {
    // Segmented compound shape — overlapping elongated spheres create visible melon segments
    const segCount = 10;
    const darkMat = getMat('#145214', 0.65, 0.1);
    for (let i = 0; i < segCount; i++) {
      const angle = (i / segCount) * Math.PI * 2;
      const isLight = i % 2 === 0;
      const seg = new THREE.Mesh(
        new THREE.SphereGeometry(r * 0.55, 10, 8),
        isLight ? skinMat : darkMat
      );
      seg.scale.set(0.55, elong, 0.55);
      seg.position.set(Math.cos(angle) * r * 0.32, 0, Math.sin(angle) * r * 0.32);
      seg.castShadow = true;
      group.add(seg);
    }
    // Inner fill sphere so there are no gaps
    const fill = new THREE.Mesh(new THREE.SphereGeometry(r * 0.6, 12, 8), skinMat);
    fill.scale.y = elong;
    group.add(fill);
    // Flat bottom (ground spot) — flush with fill sphere bottom
    var fillBottom = r * 0.6 * elong;
    const groundSpot = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.35, r * 0.35, 0.02, 12),
      getMat('#c4b44a', 0.7, 0.05));
    groundSpot.position.y = -fillBottom;
    group.add(groundSpot);
    // Stem — small, sits on top of melon body
    if (p.stem) {
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.015, 0.05, 6), stemMat);
      stem.position.y = fillBottom + 0.02;
      group.add(stem);
    }
  } else if (id === 'banana') {
    // Curved banana: torus segment
    const curve = new THREE.TorusGeometry(r * 2.5, r * 0.55, 10, 16, Math.PI * 0.6);
    const body = new THREE.Mesh(curve, skinMat);
    body.rotation.z = Math.PI * 0.2;
    body.position.y = r * 0.4;
    body.castShadow = true;
    group.add(body);
    // Dark tip
    const tip = new THREE.Mesh(new THREE.SphereGeometry(r * 0.35, 8, 6),
      getMat('#8b7a2a', 0.7, 0.05));
    tip.position.set(r * 1.4, r * 1.3, 0);
    tip.scale.set(0.7, 1.2, 0.7);
    group.add(tip);
  } else if (id === 'pineapple') {
    // Cylinder body with diamond bumps + leaf crown
    const body = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.85, r, r * 2.5, 12), skinMat);
    body.position.y = r * 1.25;
    body.castShadow = true;
    group.add(body);
    // Diamond-like bumps on surface
    const bumpMat = getMat('#b8861a', 0.65, 0.1);
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 8; col++) {
        const angle = ((col + (row % 2) * 0.5) / 8) * Math.PI * 2;
        const y = r * 0.4 + row * r * 0.45;
        const bump = new THREE.Mesh(new THREE.OctahedronGeometry(r * 0.1, 0), bumpMat);
        bump.position.set(Math.cos(angle) * r * 0.85, y, Math.sin(angle) * r * 0.85);
        bump.scale.set(0.8, 0.6, 0.5);
        bump.lookAt(0, y, 0);
        group.add(bump);
      }
    }
    // Leaf crown
    const leafMat = getMat('#228b22', 0.6, 0.05);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(r * 0.15, r * 0.8, 4), leafMat);
      leaf.position.set(Math.cos(a) * r * 0.25, r * 2.8, Math.sin(a) * r * 0.25);
      leaf.rotation.z = (Math.random() - 0.5) * 0.4;
      leaf.rotation.x = (Math.random() - 0.5) * 0.3;
      group.add(leaf);
    }
  } else if (id === 'strawberry') {
    // Cone body with seed dots
    const body = new THREE.Mesh(new THREE.ConeGeometry(r, r * 2.2, 12), skinMat);
    body.position.y = r * 1.1;
    body.rotation.x = Math.PI;
    body.position.y = r * 1.3;
    body.castShadow = true;
    group.add(body);
    // Seeds
    const seedMat = getMat('#ffee77', 0.5, 0.1);
    for (let i = 0; i < 20; i++) {
      const seed = new THREE.Mesh(new THREE.SphereGeometry(r * 0.04, 4, 4), seedMat);
      const theta = Math.random() * Math.PI * 2;
      const h = 0.2 + Math.random() * 0.6;
      const rad = r * (1 - h) * 0.9;
      seed.position.set(Math.cos(theta) * rad, r * 0.3 + h * r * 1.8, Math.sin(theta) * rad);
      group.add(seed);
    }
    // Leaf cap on top
    const leafMat = getMat('#228b22', 0.6, 0.05);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const leaf = new THREE.Mesh(new THREE.PlaneGeometry(r * 0.4, r * 0.15), leafMat);
      leaf.position.set(Math.cos(a) * r * 0.15, r * 2.2, Math.sin(a) * r * 0.15);
      leaf.rotation.y = a;
      leaf.rotation.x = -0.5;
      group.add(leaf);
    }
  } else if (id === 'pumpkin') {
    // Segmented pumpkin: sphere with vertical ridges
    const body = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 12), skinMat);
    body.scale.y = elong;
    body.castShadow = true;
    group.add(body);
    // Vertical ridges (indentations via darker strips)
    const ridgeMat = getMat('#cc5500', 0.65, 0.1, { transparent: true, opacity: 0.5 });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.01, r * 2 * elong, r * 0.08), ridgeMat);
      ridge.position.set(Math.cos(a) * r * 0.92, 0, Math.sin(a) * r * 0.92);
      ridge.lookAt(0, 0, 0);
      group.add(ridge);
    }
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.1, 6), stemMat);
    stem.position.y = r * elong + 0.04;
    group.add(stem);
  } else if (id === 'cherry') {
    // Two small spheres with stems joining at top
    const mat = skinMat;
    const b1 = new THREE.Mesh(new THREE.SphereGeometry(r * 0.65, 12, 8), mat);
    b1.position.set(-r * 0.35, 0, 0);
    b1.castShadow = true;
    group.add(b1);
    const b2 = new THREE.Mesh(new THREE.SphereGeometry(r * 0.65, 12, 8), mat);
    b2.position.set(r * 0.35, 0, 0);
    b2.castShadow = true;
    group.add(b2);
    // Stems
    for (let side = -1; side <= 1; side += 2) {
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, r * 1.2, 4), stemMat);
      stem.position.set(side * r * 0.2, r * 0.7, 0);
      stem.rotation.z = side * 0.3;
      group.add(stem);
    }
  } else if (id === 'grape') {
    // Cluster of small spheres
    const mat = skinMat;
    const positions = [
      [0, 0, 0], [-r * 0.5, r * 0.1, 0], [r * 0.5, r * 0.1, 0],
      [-r * 0.25, r * 0.55, 0], [r * 0.25, r * 0.55, 0], [0, r * 0.45, r * 0.3],
      [0, r * 0.45, -r * 0.3], [-r * 0.4, r * 0.5, r * 0.2], [r * 0.4, r * 0.5, -r * 0.2],
      [0, r * 0.9, 0], [-r * 0.2, r * 0.85, r * 0.15], [r * 0.2, r * 0.85, -r * 0.15]
    ];
    positions.forEach(function(pos) {
      const berry = new THREE.Mesh(new THREE.SphereGeometry(r * 0.35, 8, 6), mat);
      berry.position.set(pos[0], pos[1], pos[2]);
      berry.castShadow = true;
      group.add(berry);
    });
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.01, r * 0.6, 4), stemMat);
    stem.position.y = r * 1.15;
    group.add(stem);
  } else if (id === 'coconut') {
    // Brown hairy sphere with three "eyes"
    const body = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12),
      getMat(skinColor, 0.85, 0.05));
    body.castShadow = true;
    group.add(body);
    // Three dark "eyes"
    const eyeMat = getMat('#3a2010', 0.9, 0.0);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const eye = new THREE.Mesh(new THREE.CircleGeometry(r * 0.12, 8), eyeMat);
      eye.position.set(Math.cos(a) * r * 0.6, r * 0.7, Math.sin(a) * r * 0.6);
      eye.lookAt(0, 0, 0);
      group.add(eye);
    }
    // Hairy texture bumps
    const hairMat = getMat('#6b3a1a', 0.9, 0.0);
    for (let i = 0; i < 30; i++) {
      const hair = new THREE.Mesh(new THREE.BoxGeometry(0.005, r * 0.1, 0.005), hairMat);
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      hair.position.set(
        Math.sin(phi) * Math.cos(theta) * r * 1.0,
        Math.cos(phi) * r,
        Math.sin(phi) * Math.sin(theta) * r * 1.0
      );
      hair.lookAt(0, 0, 0);
      group.add(hair);
    }
  } else if (id === 'apple' || id === 'peach' || id === 'plum') {
    // Apple/stone fruit shape: wider at bottom, dimple at top, not a perfect sphere
    const body = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 12), skinMat);
    body.scale.set(1.05, elong * 0.95, 1.05);
    body.castShadow = true;
    group.add(body);
    // Top dimple (dark indentation)
    const dimple = new THREE.Mesh(new THREE.SphereGeometry(r * 0.15, 8, 6),
      getMat(new THREE.Color(skinColor).multiplyScalar(0.6), 0.7, 0.1));
    dimple.position.y = r * elong * 0.85;
    dimple.scale.set(1.5, 0.4, 1.5);
    group.add(dimple);
    // Bottom bump
    const bump = new THREE.Mesh(new THREE.SphereGeometry(r * 0.08, 6, 4), skinMat);
    bump.position.y = -r * elong * 0.92;
    group.add(bump);
    // Slight side bulges for organic shape
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.3;
      const bulge = new THREE.Mesh(new THREE.SphereGeometry(r * 0.3, 8, 6), skinMat);
      bulge.position.set(Math.cos(a) * r * 0.7, -r * elong * 0.15, Math.sin(a) * r * 0.7);
      bulge.scale.set(0.5, 0.7, 0.5);
      group.add(bulge);
    }
    if (p.stem) {
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.012, 0.07, 5), stemMat);
      stem.position.y = r * elong + 0.01;
      stem.rotation.z = 0.15;
      group.add(stem);
      // Small leaf
      const leaf = new THREE.Mesh(new THREE.PlaneGeometry(r * 0.25, r * 0.12),
        getMat('#2d7a1e', 0.6, 0.05, { side: THREE.DoubleSide }));
      leaf.position.set(r * 0.06, r * elong + 0.04, 0);
      leaf.rotation.z = 0.4;
      leaf.rotation.y = 0.5;
      group.add(leaf);
    }
  } else if (id === 'pear') {
    // Pear: narrow at top, wide at bottom (two merged spheres)
    const bottom = new THREE.Mesh(new THREE.SphereGeometry(r * 0.9, 12, 10), skinMat);
    bottom.position.y = -r * 0.1;
    bottom.castShadow = true;
    group.add(bottom);
    const top = new THREE.Mesh(new THREE.SphereGeometry(r * 0.55, 10, 8), skinMat);
    top.position.y = r * 0.7;
    group.add(top);
    // Neck transition
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.45, r * 0.75, r * 0.5, 10), skinMat);
    neck.position.y = r * 0.3;
    group.add(neck);
    if (p.stem) {
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.01, 0.1, 5), stemMat);
      stem.position.y = r * 1.1;
      stem.rotation.z = 0.2;
      group.add(stem);
    }
  } else if (id === 'lemon' || id === 'kiwi') {
    // Lemon/kiwi: elongated oval with pointed ends
    const body = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), skinMat);
    body.scale.set(0.85, elong, 0.85);
    body.castShadow = true;
    group.add(body);
    // Pointed tip at top
    const tipTop = new THREE.Mesh(new THREE.ConeGeometry(r * 0.15, r * 0.2, 8), skinMat);
    tipTop.position.y = r * elong * 0.95;
    group.add(tipTop);
    // Pointed tip at bottom
    const tipBot = new THREE.Mesh(new THREE.ConeGeometry(r * 0.12, r * 0.15, 8), skinMat);
    tipBot.position.y = -r * elong * 0.92;
    tipBot.rotation.x = Math.PI;
    group.add(tipBot);
    // Bumpy skin texture (small bumps for lemon)
    if (id === 'lemon') {
      const bumpMat = getMat(new THREE.Color(skinColor).multiplyScalar(0.9), 0.65, 0.1);
      for (let i = 0; i < 20; i++) {
        const bump = new THREE.Mesh(new THREE.SphereGeometry(r * 0.03, 4, 4), bumpMat);
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI;
        bump.position.set(
          Math.sin(phi) * Math.cos(theta) * r * 0.88,
          Math.cos(phi) * r * elong * 0.88,
          Math.sin(phi) * Math.sin(theta) * r * 0.88
        );
        group.add(bump);
      }
    }
  } else if (id === 'mango') {
    // Mango: kidney/oval shape, asymmetric
    const body = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), skinMat);
    body.scale.set(0.8, elong * 0.9, 1);
    body.castShadow = true;
    group.add(body);
    // Asymmetric bulge on one side
    const bulge = new THREE.Mesh(new THREE.SphereGeometry(r * 0.6, 10, 8), skinMat);
    bulge.position.set(0, r * 0.2, r * 0.3);
    bulge.scale.set(0.8, 0.7, 0.5);
    group.add(bulge);
    // Slight color gradient (blush)
    const blush = new THREE.Mesh(new THREE.SphereGeometry(r * 0.5, 8, 6),
      getMat('#cc3322', 0.6, 0.1, { transparent: true, opacity: 0.35 }));
    blush.position.set(r * 0.3, r * 0.4, 0);
    group.add(blush);
    if (p.stem) {
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.01, 0.05, 5), stemMat);
      stem.position.y = r * elong + 0.01;
      group.add(stem);
    }
  } else {
    // Other fruits: icosahedron for organic non-perfect shape + patches
    const body = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 2), skinMat);
    body.scale.y = elong;
    body.castShadow = true;
    group.add(body);
    if (p.stem) {
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.015, 0.08, 6), stemMat);
      stem.position.y = r * elong + 0.03;
      group.add(stem);
    }
    // Organic bumps for shape variation
    for (let i = 0; i < 5; i++) {
      const bumpR = r * (0.15 + Math.random() * 0.15);
      const bump = new THREE.Mesh(new THREE.SphereGeometry(bumpR, 6, 4), skinMat);
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      bump.position.set(
        Math.sin(phi) * Math.cos(theta) * r * 0.75,
        Math.cos(phi) * r * 0.75 * elong,
        Math.sin(phi) * Math.sin(theta) * r * 0.75
      );
      group.add(bump);
    }
  }

  // Position so bottom sits at y=0
  const tmpBox = new THREE.Box3().setFromObject(group);
  group.children.forEach(function(c) { c.position.y -= tmpBox.min.y; });
}

function buildCan(group, objData) {
  const p = objData.p;
  const id = objData.id;
  const h = p.h || 0.3;
  const r = p.r || 0.08;
  const labelColor = p.c || 0xcc2222;
  const rimColor = p.rimC || 0x888888;
  const bodyMat = getMat(labelColor, 0.3, 0.7, { map: generateTexture('metal', labelColor) });
  const rimMat = getMat(rimColor, 0.2, 0.8);

  if (id === 'spray_can') {
    // Cylinder body + dome top + nozzle cap
    const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h * 0.8, 16), bodyMat);
    body.position.y = h * 0.4;
    body.castShadow = true;
    group.add(body);
    // Dome top
    const dome = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), rimMat);
    dome.position.y = h * 0.8;
    group.add(dome);
    // Nozzle
    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.15, r * 0.2, h * 0.15, 8),
      getMat(0xeeeeee, 0.3, 0.5));
    nozzle.position.y = h * 0.92;
    group.add(nozzle);
    // Spray tip
    const tip = new THREE.Mesh(new THREE.BoxGeometry(r * 0.2, 0.03, r * 0.08),
      getMat(0xeeeeee, 0.3, 0.5));
    tip.position.set(r * 0.15, h * 0.98, 0);
    group.add(tip);
  } else if (id === 'bucket_metal' || id === 'trash_can') {
    // Tapered cylinder (wider at top) + handle
    const body = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.1, r * 0.85, h, 16), bodyMat);
    body.position.y = h / 2;
    body.castShadow = true;
    group.add(body);
    // Rim at top
    const rim = new THREE.Mesh(new THREE.TorusGeometry(r * 1.1, 0.015, 8, 16), rimMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = h;
    group.add(rim);
    // Handle (arc using torus segment)
    const handle = new THREE.Mesh(
      new THREE.TorusGeometry(r * 0.8, 0.012, 6, 12, Math.PI),
      getMat(0x999999, 0.3, 0.8));
    handle.position.y = h + r * 0.3;
    group.add(handle);
  } else if (id === 'toolbox') {
    // Box shape with rounded top + handle
    const body = new THREE.Mesh(new THREE.BoxGeometry(r * 2, h * 0.7, r * 1.2), bodyMat);
    body.position.y = h * 0.35;
    body.castShadow = true;
    group.add(body);
    // Lid (slightly wider box on top)
    const lid = new THREE.Mesh(new THREE.BoxGeometry(r * 2.05, h * 0.15, r * 1.25),
      getMat(new THREE.Color(labelColor).multiplyScalar(0.8), 0.35, 0.7));
    lid.position.y = h * 0.75;
    group.add(lid);
    // Handle
    const handle = new THREE.Mesh(
      new THREE.TorusGeometry(r * 0.5, 0.015, 6, 12, Math.PI),
      getMat(0x333333, 0.4, 0.6));
    handle.position.y = h * 0.85;
    handle.rotation.y = Math.PI / 2;
    group.add(handle);
    // Latch
    const latch = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, r * 0.2),
      getMat(0xcccc00, 0.3, 0.7));
    latch.position.set(0, h * 0.7, r * 0.65);
    group.add(latch);
  } else if (id === 'watering_can') {
    // Body + spout
    const body = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.9, r, h * 0.7, 16), bodyMat);
    body.position.y = h * 0.35;
    body.castShadow = true;
    group.add(body);
    // Spout (angled cylinder)
    const spout = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.12, r * 0.08, h * 0.5, 8), bodyMat);
    spout.position.set(r * 0.7, h * 0.5, 0);
    spout.rotation.z = -0.7;
    group.add(spout);
    // Sprinkle head
    const head = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.2, r * 0.12, 0.04, 8),
      getMat(rimColor, 0.3, 0.7));
    head.position.set(r * 1.1, h * 0.7, 0);
    head.rotation.z = -0.7;
    group.add(head);
    // Handle (arc)
    const handle = new THREE.Mesh(
      new THREE.TorusGeometry(r * 0.5, 0.015, 6, 12, Math.PI),
      getMat(rimColor, 0.3, 0.7));
    handle.position.y = h * 0.75;
    group.add(handle);
  } else if (id === 'gas_can' || id === 'ammo_box') {
    // Box/rectangular can
    const body = new THREE.Mesh(new THREE.BoxGeometry(r * 1.8, h, r * 1.2), bodyMat);
    body.position.y = h / 2;
    body.castShadow = true;
    group.add(body);
    // Handle on top
    const handle = new THREE.Mesh(
      new THREE.TorusGeometry(r * 0.4, 0.012, 6, 10, Math.PI),
      getMat(rimColor, 0.3, 0.7));
    handle.position.y = h + r * 0.15;
    handle.rotation.y = Math.PI / 2;
    group.add(handle);
    // Spout for gas can
    if (id === 'gas_can') {
      const spout = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.12, r * 0.12, h * 0.2, 8), rimMat);
      spout.position.set(r * 0.5, h + h * 0.1, 0);
      group.add(spout);
    }
    // Ridge details
    const ridgeMat = getMat(new THREE.Color(labelColor).multiplyScalar(0.85), 0.35, 0.7);
    for (let i = 0; i < 3; i++) {
      const ridge = new THREE.Mesh(new THREE.BoxGeometry(r * 1.84, 0.01, r * 1.24), ridgeMat);
      ridge.position.y = h * (0.25 + i * 0.25);
      group.add(ridge);
    }
  } else {
    // Default cylindrical can with rims and label
    const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 16), bodyMat);
    body.position.y = h / 2;
    body.castShadow = true;
    group.add(body);
    const topRim = new THREE.Mesh(new THREE.TorusGeometry(r, 0.01, 8, 16), rimMat);
    topRim.rotation.x = Math.PI / 2;
    topRim.position.y = h;
    group.add(topRim);
    const bottomRim = new THREE.Mesh(new THREE.TorusGeometry(r, 0.01, 8, 16), rimMat);
    bottomRim.rotation.x = Math.PI / 2;
    group.add(bottomRim);
    // Label band
    const labelBandColor = new THREE.Color(labelColor).offsetHSL(0.05, 0, 0.1);
    const label = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.003, r + 0.003, h * 0.5, 16),
      getMat(labelBandColor, 0.4, 0.5));
    label.position.y = h / 2;
    group.add(label);
  }
}

function buildGlass(group, objData) {
  const p = objData.p;
  const id = objData.id;
  const h = p.h || 0.25;
  const r = p.r || 0.06;
  const tintColor = p.c || 0x88ccff;
  const neck = p.neck || 0;
  const glassMat = getMat(tintColor, 0.1, 0.2, { transparent: true, opacity: 0.4 });

  if (id === 'light_bulb' || id === 'led_bulb') {
    // Sphere bulb + narrow metal screw base
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), glassMat);
    bulb.position.y = h * 0.55;
    bulb.castShadow = true;
    group.add(bulb);
    // Neck transition
    const neckMesh = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.3, r * 0.7, h * 0.2, 12), glassMat);
    neckMesh.position.y = h * 0.25;
    group.add(neckMesh);
    // Metal screw base
    const baseMat = getMat(0xaaaaaa, 0.3, 0.8);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.3, r * 0.35, h * 0.2, 12), baseMat);
    base.position.y = h * 0.1;
    group.add(base);
    // Screw threads (rings)
    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 0.33, 0.005, 6, 12), baseMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = h * 0.04 + i * 0.03;
      group.add(ring);
    }
    // Inner filament
    if (id === 'light_bulb') {
      const filMat = getMat(0xffcc44, 0.5, 0.3, { emissive: 0xffaa22, emissiveIntensity: 0.3 });
      const fil = new THREE.Mesh(new THREE.BoxGeometry(0.003, r * 0.5, 0.003), filMat);
      fil.position.y = h * 0.5;
      group.add(fil);
    }
  } else if (id === 'wine_glass') {
    // Bowl + stem + foot
    // Bowl (top cylinder tapers inward)
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.3, h * 0.4, 16, 1, true), glassMat);
    bowl.position.y = h * 0.7;
    group.add(bowl);
    // Bowl bottom (half sphere)
    const bowlBottom = new THREE.Mesh(
      new THREE.SphereGeometry(r * 0.3, 12, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), glassMat);
    bowlBottom.position.y = h * 0.5;
    group.add(bowlBottom);
    // Stem
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, h * 0.35, 8), glassMat);
    stem.position.y = h * 0.27;
    group.add(stem);
    // Foot
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.7, r * 0.75, 0.02, 16), glassMat);
    foot.position.y = 0.01;
    group.add(foot);
  } else if (id === 'mirror' || id === 'window_pane') {
    // Flat rectangle with reflective surface
    const frame = id === 'mirror';
    const paneW = r * 2;
    const paneH = h;
    const body = new THREE.Mesh(new THREE.BoxGeometry(paneW, paneH, 0.02),
      getMat(tintColor, 0.05, 0.9, { transparent: true, opacity: frame ? 0.85 : 0.3 }));
    body.position.y = paneH / 2;
    body.castShadow = true;
    group.add(body);
    if (frame) {
      // Wood frame around mirror
      const frameMat2 = getMat(0x8b5e3c, 0.7, 0.1);
      const fW = 0.02;
      // Top
      const t = new THREE.Mesh(new THREE.BoxGeometry(paneW + fW * 2, fW, 0.03), frameMat2);
      t.position.y = paneH + fW / 2;
      group.add(t);
      // Bottom
      const b = new THREE.Mesh(new THREE.BoxGeometry(paneW + fW * 2, fW, 0.03), frameMat2);
      b.position.y = -fW / 2;
      group.add(b);
      // Left
      const l = new THREE.Mesh(new THREE.BoxGeometry(fW, paneH + fW * 2, 0.03), frameMat2);
      l.position.set(-paneW / 2 - fW / 2, paneH / 2, 0);
      group.add(l);
      // Right
      const rr = new THREE.Mesh(new THREE.BoxGeometry(fW, paneH + fW * 2, 0.03), frameMat2);
      rr.position.set(paneW / 2 + fW / 2, paneH / 2, 0);
      group.add(rr);
    }
  } else if (id === 'glasses') {
    // Two circular lenses + bridge + arms
    const lensMat = getMat(tintColor, 0.05, 0.4, { transparent: true, opacity: 0.3 });
    const frameMat2 = getMat(0x333333, 0.3, 0.6);
    const lensR = r * 0.7;
    for (let side = -1; side <= 1; side += 2) {
      // Lens ring
      const ring = new THREE.Mesh(new THREE.TorusGeometry(lensR, 0.008, 8, 16), frameMat2);
      ring.position.set(side * r * 0.8, r, 0);
      group.add(ring);
      // Lens fill
      const lens = new THREE.Mesh(new THREE.CircleGeometry(lensR, 16), lensMat);
      lens.position.set(side * r * 0.8, r, 0.003);
      group.add(lens);
      // Arm
      const arm = new THREE.Mesh(new THREE.BoxGeometry(r * 1.5, 0.006, 0.006), frameMat2);
      arm.position.set(side * r * 1.4, r * 1.1, -r * 0.3);
      arm.rotation.y = side * 0.2;
      group.add(arm);
    }
    // Bridge
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(r * 0.4, 0.006, 0.006), frameMat2);
    bridge.position.set(0, r * 1.05, 0);
    group.add(bridge);
  } else if (id === 'snow_globe') {
    // Glass sphere on a base
    const globe = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), glassMat);
    globe.position.y = h * 0.55;
    group.add(globe);
    // Base
    const base = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.8, r * 0.9, h * 0.2, 16),
      getMat(0x4a2f1b, 0.6, 0.3));
    base.position.y = h * 0.1;
    group.add(base);
    // Tiny tree inside
    const tree = new THREE.Mesh(new THREE.ConeGeometry(r * 0.15, r * 0.4, 6),
      getMat(0x228b22, 0.7, 0.1));
    tree.position.y = h * 0.4;
    group.add(tree);
    // Snow particles inside
    const snowMat = getMat(0xffffff, 0.8, 0.1);
    for (let i = 0; i < 8; i++) {
      const flake = new THREE.Mesh(new THREE.SphereGeometry(0.008, 4, 4), snowMat);
      const a = Math.random() * Math.PI * 2;
      const rr = Math.random() * r * 0.6;
      flake.position.set(Math.cos(a) * rr, h * 0.35 + Math.random() * r * 0.6, Math.sin(a) * rr);
      group.add(flake);
    }
  } else if (id === 'vase') {
    // Curved vase shape using lathe-like approach with cylinders
    const bodyBottom = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.9, r * 0.6, h * 0.3, 16), glassMat);
    bodyBottom.position.y = h * 0.15;
    group.add(bodyBottom);
    const bodyMain = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.7, r * 0.9, h * 0.4, 16), glassMat);
    bodyMain.position.y = h * 0.5;
    group.add(bodyMain);
    const bodyNeck = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.5, r * 0.7, h * 0.3, 16), glassMat);
    bodyNeck.position.y = h * 0.85;
    group.add(bodyNeck);
    // Rim
    const rim = new THREE.Mesh(new THREE.TorusGeometry(r * 0.5, 0.008, 8, 16), glassMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = h;
    group.add(rim);
  } else {
    // Default bottle/cylinder with optional neck
    const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 16), glassMat);
    body.position.y = h / 2;
    body.castShadow = true;
    group.add(body);
    if (neck > 0) {
      const neckR = r * neck;
      const neckH = h * 0.35;
      const neckMesh = new THREE.Mesh(new THREE.CylinderGeometry(neckR, r * 0.8, neckH, 16), glassMat);
      neckMesh.position.y = h + neckH / 2;
      group.add(neckMesh);
      const lip = new THREE.Mesh(new THREE.TorusGeometry(neckR, 0.005, 8, 16),
        getMat(tintColor, 0.1, 0.3, { transparent: true, opacity: 0.5 }));
      lip.rotation.x = Math.PI / 2;
      lip.position.y = h + neckH;
      group.add(lip);
    }
  }
}

function buildWood(group, objData) {
  const p = objData.p;
  const id = objData.id;
  const w = p.w || 0.2;
  const h = p.h || 0.2;
  const d = p.d || 0.2;
  const woodColor = p.c || 0x8b6914;
  const woodMat = getMat(woodColor, 0.8, 0.05, { map: generateTexture('wood', woodColor) });
  const darkWoodMat = getMat(new THREE.Color(woodColor).multiplyScalar(0.7), 0.85, 0.05);

  if (id === 'pencil') {
    // Hexagonal cylinder body + cone tip + eraser
    const body = new THREE.Mesh(new THREE.CylinderGeometry(w / 2, w / 2, h * 0.75, 6), woodMat);
    body.position.y = h * 0.45;
    body.castShadow = true;
    group.add(body);
    // Graphite tip cone
    const tipH = h * 0.12;
    const tip = new THREE.Mesh(new THREE.ConeGeometry(w / 2, tipH, 6),
      getMat(woodColor, 0.8, 0.05));
    tip.position.y = h * 0.07;
    tip.rotation.x = Math.PI;
    group.add(tip);
    // Graphite point
    const point = new THREE.Mesh(new THREE.ConeGeometry(w * 0.15, tipH * 0.4, 6),
      getMat(0x333333, 0.6, 0.3));
    point.position.y = 0.0;
    point.rotation.x = Math.PI;
    group.add(point);
    // Eraser on top (pink)
    const eraser = new THREE.Mesh(new THREE.CylinderGeometry(w / 2, w / 2, h * 0.06, 6),
      getMat(0xff8899, 0.5, 0.05));
    eraser.position.y = h * 0.84;
    group.add(eraser);
    // Metal ferrule
    const ferrule = new THREE.Mesh(new THREE.CylinderGeometry(w / 2 + 0.003, w / 2 + 0.003, h * 0.04, 6),
      getMat(0xccccaa, 0.3, 0.7));
    ferrule.position.y = h * 0.8;
    group.add(ferrule);
  } else if (id === 'chair') {
    // Seat + 4 legs + backrest
    const legR = 0.02;
    const seatH = h * 0.05;
    const seatY = h * 0.45;
    // Seat
    const seat = new THREE.Mesh(new THREE.BoxGeometry(w * 0.8, seatH, d * 0.8), woodMat);
    seat.position.y = seatY;
    seat.castShadow = true;
    group.add(seat);
    // 4 Legs
    const legPositions = [
      [-w * 0.35, seatY / 2, -d * 0.35], [w * 0.35, seatY / 2, -d * 0.35],
      [-w * 0.35, seatY / 2, d * 0.35], [w * 0.35, seatY / 2, d * 0.35]
    ];
    legPositions.forEach(function(pos) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(legR, legR, seatY, 6), darkWoodMat);
      leg.position.set(pos[0], pos[1], pos[2]);
      leg.castShadow = true;
      group.add(leg);
    });
    // Backrest
    const back = new THREE.Mesh(new THREE.BoxGeometry(w * 0.8, h * 0.4, 0.025), woodMat);
    back.position.set(0, seatY + h * 0.22, -d * 0.35);
    group.add(back);
    // Backrest supports (two vertical bars)
    for (let side = -1; side <= 1; side += 2) {
      const support = new THREE.Mesh(new THREE.CylinderGeometry(legR, legR, h * 0.5, 6), darkWoodMat);
      support.position.set(side * w * 0.35, seatY + h * 0.2, -d * 0.35);
      group.add(support);
    }
  } else if (id === 'baseball_bat' || id === 'rolling_pin') {
    // Tapered cylinder
    const bodyR = w / 2;
    const handleR = bodyR * 0.4;
    // Main barrel
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(bodyR, bodyR * 0.7, h * 0.6, 12), woodMat);
    barrel.position.y = h * 0.5;
    barrel.castShadow = true;
    group.add(barrel);
    // Handle (thinner section)
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(handleR, handleR, h * 0.35, 8), darkWoodMat);
    handle.position.y = h * 0.12;
    group.add(handle);
    // Knob at bottom
    const knob = new THREE.Mesh(new THREE.SphereGeometry(handleR * 1.3, 8, 6), darkWoodMat);
    knob.position.y = 0;
    group.add(knob);
  } else if (id === 'birdhouse') {
    // Box body + triangular roof + round hole
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h * 0.6, d), woodMat);
    body.position.y = h * 0.3;
    body.castShadow = true;
    group.add(body);
    // Triangular roof (two angled planes)
    const roofMat = getMat(new THREE.Color(woodColor).multiplyScalar(0.65), 0.85, 0.05);
    for (let side = -1; side <= 1; side += 2) {
      const roof = new THREE.Mesh(new THREE.BoxGeometry(w * 1.1, 0.015, d * 0.65), roofMat);
      roof.position.set(0, h * 0.65 + d * 0.15, side * d * 0.2);
      roof.rotation.x = side * 0.5;
      group.add(roof);
    }
    // Entry hole
    const hole = new THREE.Mesh(new THREE.CircleGeometry(w * 0.18, 12),
      getMat(0x1a1a1a, 0.9, 0.0));
    hole.position.set(0, h * 0.35, d / 2 + 0.005);
    group.add(hole);
    // Perch
    const perch = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.06, 6), darkWoodMat);
    perch.position.set(0, h * 0.2, d / 2 + 0.03);
    perch.rotation.x = Math.PI / 2;
    group.add(perch);
  } else if (id === 'ladder') {
    // Two rails + rungs
    const railW = 0.025;
    const rungCount = Math.floor(h / 0.15);
    for (let side = -1; side <= 1; side += 2) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(railW, h, railW), woodMat);
      rail.position.set(side * w * 0.4, h / 2, 0);
      rail.castShadow = true;
      group.add(rail);
    }
    for (let i = 0; i < rungCount; i++) {
      const rung = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, w * 0.75, 6), darkWoodMat);
      rung.rotation.z = Math.PI / 2;
      rung.position.y = 0.1 + i * (h - 0.15) / Math.max(rungCount - 1, 1);
      group.add(rung);
    }
  } else if (id === 'picture_frame') {
    // Rectangular frame with empty center
    const frameW = 0.03;
    const mat = woodMat;
    // Top bar
    const top = new THREE.Mesh(new THREE.BoxGeometry(w, frameW, d), mat);
    top.position.y = h - frameW / 2;
    group.add(top);
    // Bottom bar
    const bot = new THREE.Mesh(new THREE.BoxGeometry(w, frameW, d), mat);
    bot.position.y = frameW / 2;
    group.add(bot);
    // Left bar
    const left = new THREE.Mesh(new THREE.BoxGeometry(frameW, h, d), mat);
    left.position.set(-w / 2 + frameW / 2, h / 2, 0);
    group.add(left);
    // Right bar
    const right = new THREE.Mesh(new THREE.BoxGeometry(frameW, h, d), mat);
    right.position.set(w / 2 - frameW / 2, h / 2, 0);
    group.add(right);
    // Inner "picture" plane
    const pic = new THREE.Mesh(new THREE.PlaneGeometry(w - frameW * 2, h - frameW * 2),
      getMat(0x667788, 0.8, 0.05));
    pic.position.set(0, h / 2, d / 2 - 0.003);
    group.add(pic);
  } else if (id === 'wood_crate') {
    // Box with slat details
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), woodMat);
    body.position.y = h / 2;
    body.castShadow = true;
    group.add(body);
    // Horizontal slats on front and back faces
    const slatCount = 4;
    for (let i = 0; i < slatCount; i++) {
      const y = h * (0.1 + i * 0.27);
      for (let z = -1; z <= 1; z += 2) {
        const slat = new THREE.Mesh(new THREE.BoxGeometry(w + 0.005, 0.015, 0.005), darkWoodMat);
        slat.position.set(0, y, z * (d / 2 + 0.003));
        group.add(slat);
      }
    }
  } else {
    // Default: box with edge bevels
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), woodMat);
    body.position.y = h / 2;
    body.castShadow = true;
    group.add(body);
    if (w > 0.1 && h > 0.1) {
      const eT = 0.005;
      const vEdge = new THREE.BoxGeometry(eT, h, eT);
      [[w / 2, h / 2, d / 2], [-w / 2, h / 2, d / 2], [w / 2, h / 2, -d / 2], [-w / 2, h / 2, -d / 2]]
        .forEach(function(pos) {
          const e = new THREE.Mesh(vEdge, darkWoodMat);
          e.position.set(pos[0], pos[1], pos[2]);
          group.add(e);
        });
    }
  }
}

function buildPlastic(group, objData) {
  const p = objData.p;
  const id = objData.id;
  const w = p.w || 0.15;
  const h = p.h || 0.15;
  const d = p.d || 0.15;
  const color = p.c || 0x2288ee;
  const shiny = p.shiny || false;
  const roughness = shiny ? 0.2 : 0.5;
  const metalness = shiny ? 0.3 : 0.1;
  const mat = getMat(color, roughness, metalness);

  if (id === 'traffic_cone') {
    // Cone with white stripes and square base
    const cone = new THREE.Mesh(new THREE.ConeGeometry(w * 0.45, h, 12), mat);
    cone.position.y = h / 2;
    cone.castShadow = true;
    group.add(cone);
    // Base
    const base = new THREE.Mesh(new THREE.BoxGeometry(w, h * 0.06, w),
      getMat(0x222222, 0.6, 0.2));
    base.position.y = h * 0.03;
    group.add(base);
    // White reflective stripes
    const stripeMat = getMat(0xffffff, 0.3, 0.2);
    const stripe1 = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.28, w * 0.33, h * 0.08, 12), stripeMat);
    stripe1.position.y = h * 0.35;
    group.add(stripe1);
    const stripe2 = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.18, w * 0.23, h * 0.06, 12), stripeMat);
    stripe2.position.y = h * 0.55;
    group.add(stripe2);
  } else if (id === 'water_bottle') {
    // Cylinder body + narrower cap/neck
    const body = new THREE.Mesh(new THREE.CylinderGeometry(w / 2, w / 2, h * 0.7, 12), mat);
    body.position.y = h * 0.35;
    body.castShadow = true;
    group.add(body);
    // Neck
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.2, w * 0.35, h * 0.15, 10), mat);
    neck.position.y = h * 0.75;
    group.add(neck);
    // Cap
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.22, w * 0.22, h * 0.08, 10),
      getMat(0xffffff, 0.3, 0.2));
    cap.position.y = h * 0.86;
    group.add(cap);
    // Label band
    const labelMat = getMat(new THREE.Color(color).offsetHSL(0.1, 0, -0.1), 0.4, 0.1);
    const label = new THREE.Mesh(new THREE.CylinderGeometry(w / 2 + 0.003, w / 2 + 0.003, h * 0.25, 12), labelMat);
    label.position.y = h * 0.35;
    group.add(label);
  } else if (id === 'frisbee') {
    // Flat disc with curved rim
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(w / 2, w / 2, h, 20), mat);
    disc.position.y = h / 2;
    disc.castShadow = true;
    group.add(disc);
    // Rim ring (thicker edge)
    const rim = new THREE.Mesh(new THREE.TorusGeometry(w / 2, h * 0.3, 8, 20), mat);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = h / 2;
    group.add(rim);
    // Center logo mark
    const logo = new THREE.Mesh(new THREE.CircleGeometry(w * 0.15, 12),
      getMat(new THREE.Color(color).offsetHSL(0.15, 0, 0.1), 0.3, 0.2));
    logo.position.set(0, h + 0.002, 0);
    logo.rotation.x = -Math.PI / 2;
    group.add(logo);
  } else if (id === 'bucket_plastic') {
    // Tapered cylinder (wider at top)
    const body = new THREE.Mesh(new THREE.CylinderGeometry(w / 2 * 1.1, w / 2 * 0.8, h, 16), mat);
    body.position.y = h / 2;
    body.castShadow = true;
    group.add(body);
    // Handle (arc)
    const handle = new THREE.Mesh(
      new THREE.TorusGeometry(w * 0.35, 0.01, 6, 12, Math.PI),
      getMat(0x999999, 0.4, 0.5));
    handle.position.y = h + w * 0.1;
    group.add(handle);
    // Rim
    const rim = new THREE.Mesh(new THREE.TorusGeometry(w / 2 * 1.1, 0.012, 8, 16), mat);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = h;
    group.add(rim);
  } else if (id === 'plastic_cup' || id === 'yogurt_cup') {
    // Tapered cylinder (wider at top)
    const body = new THREE.Mesh(new THREE.CylinderGeometry(w / 2, w / 2 * 0.7, h, 12), mat);
    body.position.y = h / 2;
    body.castShadow = true;
    group.add(body);
    // Rim
    const rim = new THREE.Mesh(new THREE.TorusGeometry(w / 2, 0.006, 6, 12), mat);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = h;
    group.add(rim);
  } else if (id === 'soap_dispenser') {
    // Cylinder body + pump top
    const body = new THREE.Mesh(new THREE.CylinderGeometry(w / 2, w / 2, h * 0.7, 12), mat);
    body.position.y = h * 0.35;
    body.castShadow = true;
    group.add(body);
    // Pump mechanism
    const pump = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.15, w * 0.2, h * 0.1, 8),
      getMat(0xdddddd, 0.3, 0.5));
    pump.position.y = h * 0.72;
    group.add(pump);
    // Nozzle sticking out
    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, w * 0.3, 6),
      getMat(0xdddddd, 0.3, 0.5));
    nozzle.rotation.z = Math.PI / 2;
    nozzle.position.set(w * 0.2, h * 0.75, 0);
    group.add(nozzle);
    // Push button on top
    const btn = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.12, w * 0.12, h * 0.05, 8),
      getMat(0xcccccc, 0.3, 0.5));
    btn.position.y = h * 0.78;
    group.add(btn);
  } else {
    // Default: box or cylinder with highlight stripe
    var body;
    if (d < 0.1) {
      body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    } else {
      body = new THREE.Mesh(new THREE.CylinderGeometry(w / 2, w / 2, h, 16), mat);
    }
    body.position.y = h / 2;
    body.castShadow = true;
    group.add(body);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(w * 0.8, h * 0.05, d + 0.002),
      getMat(new THREE.Color(color).offsetHSL(0, -0.1, 0.15), roughness, metalness));
    stripe.position.y = h * 0.65;
    group.add(stripe);
  }
}

function buildElectronic(group, objData) {
  const p = objData.p;
  const id = objData.id;
  const w = p.w || 0.15;
  const h = p.h || 0.08;
  const d = p.d || 0.01;
  const screenColor = p.sc || 0x1a1a2e;
  const bodyColor = p.bc || 0x222233;
  const bodyMat = getMat(bodyColor, 0.3, 0.5);
  const screenMat = getMat(screenColor, 0.1, 0.3, {
    emissive: new THREE.Color(screenColor).offsetHSL(0, 0, 0.3),
    emissiveIntensity: 0.5
  });

  if (id === 'laptop') {
    // Base slab (keyboard half) + screen half at angle
    const baseH = d * 0.4;
    const base = new THREE.Mesh(new THREE.BoxGeometry(w, baseH, d * 0.9), bodyMat);
    base.position.y = baseH / 2;
    base.castShadow = true;
    group.add(base);
    // Keyboard surface
    const kbMat = getMat(0x1a1a1a, 0.5, 0.3);
    const kb = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.85, d * 0.6), kbMat);
    kb.rotation.x = -Math.PI / 2;
    kb.position.set(0, baseH + 0.002, d * 0.05);
    group.add(kb);
    // Key grid dots
    const keyMat = getMat(0x333333, 0.6, 0.2);
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 10; col++) {
        const key = new THREE.Mesh(new THREE.BoxGeometry(w * 0.06, 0.003, d * 0.08), keyMat);
        key.position.set(-w * 0.37 + col * w * 0.083, baseH + 0.003, d * 0.25 - row * d * 0.13);
        group.add(key);
      }
    }
    // Screen (angled upward)
    const screenPanel = new THREE.Mesh(new THREE.BoxGeometry(w, h * 0.95, baseH * 0.6),
      getMat(new THREE.Color(bodyColor).offsetHSL(0, 0, 0.05), 0.3, 0.5));
    screenPanel.position.set(0, baseH + h * 0.48, -d * 0.35);
    screenPanel.rotation.x = 0.15;
    group.add(screenPanel);
    // Screen surface
    const scrn = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.88, h * 0.8), screenMat);
    scrn.position.set(0, baseH + h * 0.48, -d * 0.35 + baseH * 0.32);
    scrn.rotation.x = 0.15;
    group.add(scrn);
  } else if (id === 'headphones') {
    // Headband arc + two ear cups
    const bandMat = getMat(bodyColor, 0.35, 0.4);
    const band = new THREE.Mesh(new THREE.TorusGeometry(w * 0.45, 0.015, 8, 16, Math.PI), bandMat);
    band.position.y = h * 0.7;
    group.add(band);
    // Ear cups
    const cupMat = getMat(bodyColor, 0.25, 0.5);
    const cushionMat = getMat(0x333333, 0.5, 0.1);
    for (let side = -1; side <= 1; side += 2) {
      // Outer cup
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(d * 0.8, d * 0.8, d * 0.6, 12), cupMat);
      cup.rotation.z = Math.PI / 2;
      cup.position.set(side * w * 0.45, h * 0.25, 0);
      cup.castShadow = true;
      group.add(cup);
      // Cushion
      const cushion = new THREE.Mesh(new THREE.TorusGeometry(d * 0.6, d * 0.15, 8, 12), cushionMat);
      cushion.rotation.y = Math.PI / 2;
      cushion.position.set(side * (w * 0.45 + d * 0.3), h * 0.25, 0);
      group.add(cushion);
    }
    // Padding on top
    const pad = new THREE.Mesh(new THREE.BoxGeometry(w * 0.15, 0.015, d * 0.5),
      getMat(0x444444, 0.5, 0.1));
    pad.position.y = h * 0.92;
    group.add(pad);
  } else if (id === 'keyboard') {
    // Wide flat rectangle with individual key bumps
    const base = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), bodyMat);
    base.position.y = h / 2;
    base.castShadow = true;
    group.add(base);
    // Key grid
    const keyMat = getMat(0x2a2a2a, 0.5, 0.3);
    const rows = 5;
    const cols = Math.floor(w / 0.04);
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const key = new THREE.Mesh(new THREE.BoxGeometry(0.025, h * 0.15, d * 0.12), keyMat);
        key.position.set(-w * 0.45 + col * 0.038, h + 0.002, -d * 0.35 + row * d * 0.18);
        group.add(key);
      }
    }
  } else if (id === 'speaker') {
    // Box body with circular woofer on front
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), bodyMat);
    body.position.y = h / 2;
    body.castShadow = true;
    group.add(body);
    // Woofer circle (large)
    const wooferR = Math.min(w, h) * 0.35;
    const woofer = new THREE.Mesh(new THREE.CircleGeometry(wooferR, 16),
      getMat(0x333333, 0.6, 0.2));
    woofer.position.set(0, h * 0.4, d / 2 + 0.003);
    group.add(woofer);
    // Woofer cone
    const cone = new THREE.Mesh(new THREE.ConeGeometry(wooferR * 0.6, 0.02, 16),
      getMat(0x444444, 0.5, 0.3));
    cone.rotation.x = Math.PI / 2;
    cone.position.set(0, h * 0.4, d / 2 + 0.006);
    group.add(cone);
    // Tweeter (small circle above)
    const tweeter = new THREE.Mesh(new THREE.CircleGeometry(wooferR * 0.3, 12),
      getMat(0x555555, 0.4, 0.4));
    tweeter.position.set(0, h * 0.75, d / 2 + 0.003);
    group.add(tweeter);
    // Grille dots around edge
    const grilleMat = getMat(0x222222, 0.7, 0.1);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.005, 4, 4), grilleMat);
      dot.position.set(Math.cos(a) * wooferR * 0.9, h * 0.4 + Math.sin(a) * wooferR * 0.9, d / 2 + 0.004);
      group.add(dot);
    }
  } else if (id === 'gameboy') {
    // Iconic handheld shape: rectangle body + screen + d-pad + buttons
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), bodyMat);
    body.position.y = h / 2;
    body.castShadow = true;
    group.add(body);
    // Screen
    const scrn = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.7, h * 0.4), screenMat);
    scrn.position.set(0, h * 0.65, d / 2 + 0.002);
    group.add(scrn);
    // Screen bezel
    const bezel = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.8, h * 0.5),
      getMat(0x555555, 0.5, 0.2));
    bezel.position.set(0, h * 0.65, d / 2 + 0.001);
    group.add(bezel);
    // D-pad (cross shape)
    const dpadMat = getMat(0x222222, 0.6, 0.2);
    const dpadH = new THREE.Mesh(new THREE.BoxGeometry(w * 0.25, h * 0.06, 0.008), dpadMat);
    dpadH.position.set(-w * 0.2, h * 0.25, d / 2 + 0.003);
    group.add(dpadH);
    const dpadV = new THREE.Mesh(new THREE.BoxGeometry(w * 0.06, h * 0.15, 0.008), dpadMat);
    dpadV.position.set(-w * 0.2, h * 0.25, d / 2 + 0.003);
    group.add(dpadV);
    // A/B buttons
    const btnMat = getMat(0x880044, 0.4, 0.3);
    const btnA = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.008, 8), btnMat);
    btnA.rotation.x = Math.PI / 2;
    btnA.position.set(w * 0.2, h * 0.28, d / 2 + 0.005);
    group.add(btnA);
    const btnB = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.008, 8), btnMat);
    btnB.rotation.x = Math.PI / 2;
    btnB.position.set(w * 0.1, h * 0.22, d / 2 + 0.005);
    group.add(btnB);
  } else {
    // Default: flat rectangle device with screen + buttons
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), bodyMat);
    body.position.y = h / 2;
    body.castShadow = true;
    group.add(body);
    // Rounded edges
    const edgeR = Math.min(d, h) * 0.15;
    const edgeGeom = new THREE.CylinderGeometry(edgeR, edgeR, w - 0.005, 8);
    const edgeMat = getMat(new THREE.Color(bodyColor).offsetHSL(0, 0, 0.05), 0.3, 0.5);
    [{y: h, z: d / 2}, {y: h, z: -d / 2}, {y: 0, z: d / 2}, {y: 0, z: -d / 2}]
      .forEach(function(pos) {
        const edge = new THREE.Mesh(edgeGeom, edgeMat);
        edge.rotation.z = Math.PI / 2;
        edge.position.set(0, pos.y, pos.z);
        group.add(edge);
      });
    // Screen
    const scrn = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.85, h * 0.75), screenMat);
    scrn.position.set(0, h / 2, d / 2 + 0.001);
    group.add(scrn);
    // Buttons
    const btnMat = getMat(0x444455, 0.4, 0.5);
    const btnGeom = new THREE.CylinderGeometry(0.005, 0.005, 0.004, 8);
    const btn1 = new THREE.Mesh(btnGeom, btnMat);
    btn1.rotation.x = Math.PI / 2;
    btn1.position.set(w * 0.35, h / 2, d / 2 + 0.002);
    group.add(btn1);
  }
}

function buildFood(group, objData) {
  const p = objData.p;
  const id = objData.id;
  const r = p.r || 0.1;
  const h = p.h || r;
  const color = p.c || 0xdda060;
  const toppingColor = p.tc || 0;
  const mat = getMat(color, 0.7, 0.05);

  if (id === 'egg') {
    // Egg shape: sphere slightly tapered (elongated, narrower at top)
    const body = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), getMat(color, 0.5, 0.1));
    body.scale.y = 1.3;
    body.position.y = r * 1.3;
    body.castShadow = true;
    group.add(body);
    // Slight specular highlight spot
    const spot = new THREE.Mesh(new THREE.SphereGeometry(r * 0.15, 8, 6),
      getMat(0xffffff, 0.3, 0.2, { transparent: true, opacity: 0.3 }));
    spot.position.set(r * 0.3, r * 1.6, r * 0.3);
    group.add(spot);
  } else if (id === 'hamburger') {
    // Layered: bottom bun + patty + lettuce + tomato + top bun
    const bunMat = getMat(color, 0.7, 0.05);
    const hh = h * 0.2;
    // Bottom bun
    const bBot = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.95, hh, 14), bunMat);
    bBot.position.y = hh / 2;
    group.add(bBot);
    // Patty
    const patty = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.9, r * 0.9, hh * 0.6, 14),
      getMat(0x5c3a1e, 0.75, 0.05));
    patty.position.y = hh + hh * 0.3;
    group.add(patty);
    // Lettuce (wavy disc)
    const lettuce = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.05, r * 1.05, 0.01, 14),
      getMat(0x44aa22, 0.6, 0.05));
    lettuce.position.y = hh * 1.7;
    group.add(lettuce);
    // Tomato slice
    const tomato = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.8, r * 0.8, 0.015, 12),
      getMat(0xdd3322, 0.5, 0.1));
    tomato.position.y = hh * 1.8;
    group.add(tomato);
    // Top bun (dome)
    const bTop = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), bunMat);
    bTop.position.y = hh * 2.0;
    group.add(bTop);
    // Sesame seeds on top
    const seedMat = getMat(0xfff8dc, 0.6, 0.05);
    for (let i = 0; i < 8; i++) {
      const seed = new THREE.Mesh(new THREE.SphereGeometry(0.008, 4, 4), seedMat);
      const a = Math.random() * Math.PI * 2;
      const rr = Math.random() * r * 0.5;
      seed.position.set(Math.cos(a) * rr, hh * 2.0 + r * Math.sqrt(1 - (rr / r) * (rr / r)) * 0.4, Math.sin(a) * rr);
      group.add(seed);
    }
  } else if (id === 'donut') {
    // Torus shape
    const donut = new THREE.Mesh(new THREE.TorusGeometry(r * 0.6, r * 0.35, 12, 20), mat);
    donut.rotation.x = Math.PI / 2;
    donut.position.y = r * 0.35;
    donut.castShadow = true;
    group.add(donut);
    // Glaze on top (half torus)
    if (toppingColor) {
      const glaze = new THREE.Mesh(
        new THREE.TorusGeometry(r * 0.6, r * 0.36, 12, 20, Math.PI * 2),
        getMat(toppingColor, 0.4, 0.1));
      glaze.rotation.x = Math.PI / 2;
      glaze.position.y = r * 0.37;
      glaze.scale.y = 0.3;
      group.add(glaze);
    }
  } else if (id === 'ice_cream') {
    // Cone + scoop
    const coneMat = getMat(0xdaa520, 0.7, 0.05);
    // Waffle cone
    const cone = new THREE.Mesh(new THREE.ConeGeometry(r * 0.6, h * 0.55, 10), coneMat);
    cone.position.y = h * 0.3;
    cone.castShadow = true;
    group.add(cone);
    // Cross-hatch on cone
    const lineMat = getMat(0xb8860b, 0.75, 0.05);
    for (let i = 0; i < 4; i++) {
      const line = new THREE.Mesh(new THREE.BoxGeometry(0.003, h * 0.4, r * 0.01), lineMat);
      const a = (i / 4) * Math.PI * 2;
      line.position.set(Math.cos(a) * r * 0.25, h * 0.3, Math.sin(a) * r * 0.25);
      line.lookAt(0, h * 0.3, 0);
      group.add(line);
    }
    // Scoop (sphere on top)
    const scoop = new THREE.Mesh(new THREE.SphereGeometry(r * 0.6, 12, 10),
      getMat(toppingColor || 0xffe4b5, 0.55, 0.05));
    scoop.position.y = h * 0.6;
    scoop.castShadow = true;
    group.add(scoop);
  } else if (id === 'cake' || id === 'pie') {
    // Cylinder with frosting layer + decorations
    const cakeH = h * 0.8;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r, cakeH, 16), mat);
    body.position.y = cakeH / 2;
    body.castShadow = true;
    group.add(body);
    // Frosting on top
    const frosting = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.008, r + 0.008, cakeH * 0.12, 16),
      getMat(toppingColor || 0xff69b4, 0.5, 0.05));
    frosting.position.y = cakeH;
    group.add(frosting);
    // Frosting drips on sides
    const dripMat = getMat(toppingColor || 0xff69b4, 0.5, 0.05);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const drip = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.008, cakeH * 0.2, 6), dripMat);
      drip.position.set(Math.cos(a) * r, cakeH * 0.85, Math.sin(a) * r);
      group.add(drip);
    }
    // Candles on cake
    if (id === 'cake') {
      for (let i = 0; i < 3; i++) {
        const a = ((i + 0.5) / 3) * Math.PI * 2;
        const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, h * 0.2, 6),
          getMat(0xffcc00, 0.5, 0.05));
        candle.position.set(Math.cos(a) * r * 0.5, cakeH + h * 0.15, Math.sin(a) * r * 0.5);
        group.add(candle);
      }
    }
  } else if (id === 'sushi') {
    // Rice cylinder + fish slice on top
    const rice = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.8, r * 0.8, h * 0.6, 12),
      getMat(0xffffff, 0.6, 0.05));
    rice.position.y = h * 0.3;
    rice.castShadow = true;
    group.add(rice);
    // Fish slice on top
    const fish = new THREE.Mesh(new THREE.BoxGeometry(r * 1.6, h * 0.12, r * 0.7),
      getMat(toppingColor || 0xff4500, 0.45, 0.1));
    fish.position.y = h * 0.65;
    fish.rotation.y = 0.2;
    group.add(fish);
    // Nori strip around middle
    const nori = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.82, r * 0.82, h * 0.15, 12, 1, true),
      getMat(0x1a2a0a, 0.7, 0.05));
    nori.position.y = h * 0.3;
    group.add(nori);
  } else if (id === 'sandwich') {
    // Two bread slices with filling
    const breadMat = getMat(color, 0.75, 0.05);
    const top = new THREE.Mesh(new THREE.BoxGeometry(r * 1.5, h * 0.25, r * 1.5), breadMat);
    top.position.y = h * 0.8;
    group.add(top);
    const bottom = new THREE.Mesh(new THREE.BoxGeometry(r * 1.5, h * 0.25, r * 1.5), breadMat);
    bottom.position.y = h * 0.15;
    group.add(bottom);
    // Filling layers
    const lettuce = new THREE.Mesh(new THREE.BoxGeometry(r * 1.55, h * 0.06, r * 1.55),
      getMat(toppingColor || 0x44aa22, 0.6, 0.05));
    lettuce.position.y = h * 0.5;
    group.add(lettuce);
    const meat = new THREE.Mesh(new THREE.BoxGeometry(r * 1.4, h * 0.1, r * 1.4),
      getMat(0xcc6644, 0.65, 0.05));
    meat.position.y = h * 0.4;
    group.add(meat);
  } else {
    // Default round or cylindrical food
    var body;
    if (h > r * 1.5) {
      body = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 16), mat);
      body.position.y = h / 2;
    } else {
      body = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), mat);
      body.position.y = r;
    }
    body.castShadow = true;
    group.add(body);
    if (toppingColor) {
      const topMat = getMat(toppingColor, 0.6, 0.05);
      if (h > r * 1.5) {
        const topping = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.005, r + 0.005, h * 0.1, 16), topMat);
        topping.position.y = h + h * 0.05;
        group.add(topping);
      } else {
        const topping = new THREE.Mesh(new THREE.SphereGeometry(r * 0.5, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), topMat);
        topping.position.y = r + r * 0.3;
        group.add(topping);
      }
    }
  }
}

function buildRubber(group, objData) {
  const p = objData.p;
  const id = objData.id;
  const r = p.r || 0.1;
  const color = p.c || 0xff6644;
  const bodyMat = getMat(color, 0.4, 0.05);

  if (id === 'rubber_duck') {
    // Body sphere + smaller head + beak + eyes
    const body = new THREE.Mesh(new THREE.SphereGeometry(r * 0.8, 14, 10), bodyMat);
    body.position.y = r * 0.8;
    body.castShadow = true;
    group.add(body);
    // Head (smaller sphere on top)
    const head = new THREE.Mesh(new THREE.SphereGeometry(r * 0.45, 12, 8), bodyMat);
    head.position.set(r * 0.15, r * 1.55, 0);
    group.add(head);
    // Beak (orange cone)
    const beak = new THREE.Mesh(new THREE.ConeGeometry(r * 0.12, r * 0.25, 6),
      getMat(0xff8800, 0.5, 0.05));
    beak.rotation.z = -Math.PI / 2;
    beak.position.set(r * 0.55, r * 1.5, 0);
    group.add(beak);
    // Eyes
    const eyeMat = getMat(0x111111, 0.3, 0.3);
    for (let side = -1; side <= 1; side += 2) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(r * 0.06, 6, 6), eyeMat);
      eye.position.set(r * 0.35, r * 1.65, side * r * 0.2);
      group.add(eye);
    }
    // Tail (small bump)
    const tail = new THREE.Mesh(new THREE.ConeGeometry(r * 0.1, r * 0.15, 6), bodyMat);
    tail.position.set(-r * 0.7, r * 0.9, 0);
    tail.rotation.z = Math.PI * 0.6;
    group.add(tail);
  } else if (id === 'car_tire') {
    // Torus (tire shape)
    const tire = new THREE.Mesh(new THREE.TorusGeometry(r * 0.6, r * 0.35, 12, 20), bodyMat);
    tire.rotation.x = Math.PI / 2;
    tire.position.y = r * 0.35;
    tire.castShadow = true;
    group.add(tire);
    // Tread pattern (small bumps around exterior)
    const treadMat = getMat(0x1a1a1a, 0.7, 0.05);
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const tread = new THREE.Mesh(new THREE.BoxGeometry(r * 0.04, r * 0.36, r * 0.06), treadMat);
      tread.position.set(Math.cos(a) * r * 0.6, r * 0.35, Math.sin(a) * r * 0.6);
      tread.lookAt(0, r * 0.35, 0);
      group.add(tread);
    }
  } else if (id === 'swim_ring') {
    // Colorful torus
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 0.55, r * 0.3, 12, 20), bodyMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = r * 0.3;
    ring.castShadow = true;
    group.add(ring);
    // Color stripes (alternating sectors)
    const stripeMat = getMat(0xffffff, 0.4, 0.05);
    for (let i = 0; i < 6; i += 2) {
      const stripe = new THREE.Mesh(
        new THREE.TorusGeometry(r * 0.55, r * 0.31, 12, 4, Math.PI / 3),
        stripeMat);
      stripe.rotation.x = Math.PI / 2;
      stripe.rotation.z = (i / 6) * Math.PI * 2;
      stripe.position.y = r * 0.3;
      group.add(stripe);
    }
  } else if (id === 'basketball' || id === 'soccer_ball') {
    // Sphere with seam lines
    const body = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 14), bodyMat);
    body.position.y = r;
    body.castShadow = true;
    group.add(body);
    // Seam lines
    const seamMat = getMat(0x111111, 0.5, 0.1);
    if (id === 'basketball') {
      // Horizontal seam
      const hSeam = new THREE.Mesh(new THREE.TorusGeometry(r * 1.005, 0.004, 4, 24), seamMat);
      hSeam.position.y = r;
      hSeam.rotation.x = Math.PI / 2;
      group.add(hSeam);
      // Vertical seam
      const vSeam = new THREE.Mesh(new THREE.TorusGeometry(r * 1.005, 0.004, 4, 24), seamMat);
      vSeam.position.y = r;
      group.add(vSeam);
      // Side curves
      for (let side = -1; side <= 1; side += 2) {
        const curve = new THREE.Mesh(new THREE.TorusGeometry(r * 1.005, 0.004, 4, 24, Math.PI), seamMat);
        curve.position.y = r;
        curve.rotation.y = Math.PI / 2 + side * 0.4;
        group.add(curve);
      }
    } else {
      // Soccer: pentagon pattern (simplified with dark patches)
      const pentMat = getMat(0x111111, 0.5, 0.1);
      const positions = [
        [0, 1, 0], [0, -1, 0], [0.9, 0.4, 0], [-0.9, 0.4, 0],
        [0, 0.4, 0.9], [0, 0.4, -0.9]
      ];
      positions.forEach(function(pos) {
        const pent = new THREE.Mesh(new THREE.CircleGeometry(r * 0.22, 5), pentMat);
        pent.position.set(pos[0] * r * 0.9, r + pos[1] * r * 0.9, pos[2] * r * 0.9);
        pent.lookAt(0, r, 0);
        group.add(pent);
      });
    }
  } else if (id === 'rubber_boot') {
    // Boot shape: tall cylinder + foot extension
    const legH = r * 1.8;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.4, r * 0.45, legH, 10), bodyMat);
    leg.position.y = legH / 2;
    leg.castShadow = true;
    group.add(leg);
    // Foot
    const foot = new THREE.Mesh(new THREE.BoxGeometry(r * 0.5, r * 0.35, r * 0.9), bodyMat);
    foot.position.set(r * 0.1, r * 0.17, 0);
    group.add(foot);
    // Toe cap
    const toe = new THREE.Mesh(new THREE.SphereGeometry(r * 0.25, 8, 6), bodyMat);
    toe.position.set(r * 0.1, r * 0.15, r * 0.35);
    toe.scale.set(1.2, 0.7, 1);
    group.add(toe);
    // Sole (darker)
    const sole = new THREE.Mesh(new THREE.BoxGeometry(r * 0.55, r * 0.06, r * 0.95),
      getMat(0x222222, 0.6, 0.1));
    sole.position.set(r * 0.1, 0.03, 0);
    group.add(sole);
  } else if (id === 'balloon') {
    // Teardrop: sphere + small knot at bottom
    const body = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), bodyMat);
    body.scale.y = 1.2;
    body.position.y = r * 1.2;
    body.castShadow = true;
    group.add(body);
    // Knot at bottom
    const knot = new THREE.Mesh(new THREE.SphereGeometry(r * 0.08, 6, 4),
      getMat(new THREE.Color(color).multiplyScalar(0.7), 0.4, 0.05));
    knot.position.y = r * 0.05;
    group.add(knot);
    // Highlight
    const highlight = new THREE.Mesh(new THREE.SphereGeometry(r * 0.12, 6, 4),
      getMat(0xffffff, 0.2, 0.1, { transparent: true, opacity: 0.4 }));
    highlight.position.set(r * 0.3, r * 1.5, r * 0.2);
    group.add(highlight);
  } else {
    // Default: sphere with equator ring
    const body = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), bodyMat);
    body.position.y = r;
    body.castShadow = true;
    group.add(body);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 1.01, r * 0.02, 8, 24),
      getMat(new THREE.Color(color).offsetHSL(0, -0.1, 0.15), 0.35, 0.05, { transparent: true, opacity: 0.6 }));
    ring.position.y = r;
    ring.rotation.x = Math.PI / 2;
    group.add(ring);
  }
}

function buildStone(group, objData) {
  const p = objData.p;
  const id = objData.id;
  const w = p.w || 0.2;
  const h = p.h || 0.15;
  const d = p.d || 0.2;
  const color = p.c || 0x888888;
  const maxDim = Math.max(w, h, d);
  const mat = getMat(color, 0.9, 0.1, { map: generateTexture('concrete', color) });

  if (id === 'diamond') {
    // Diamond: octahedron shape, sparkly
    const diamond = new THREE.Mesh(new THREE.OctahedronGeometry(maxDim / 2, 0),
      getMat(color, 0.05, 0.95, { transparent: true, opacity: 0.7 }));
    diamond.position.y = maxDim / 2;
    diamond.scale.y = 1.2;
    diamond.castShadow = true;
    group.add(diamond);
    // Sparkle highlights
    const sparkleMat = getMat(0xffffff, 0.05, 0.9, { transparent: true, opacity: 0.5 });
    for (let i = 0; i < 6; i++) {
      const sparkle = new THREE.Mesh(new THREE.PlaneGeometry(maxDim * 0.1, maxDim * 0.1), sparkleMat);
      const a = Math.random() * Math.PI * 2;
      const hh = 0.3 + Math.random() * 0.4;
      sparkle.position.set(Math.cos(a) * maxDim * 0.3, maxDim * hh, Math.sin(a) * maxDim * 0.3);
      sparkle.lookAt(0, maxDim / 2, 0);
      group.add(sparkle);
    }
  } else if (id === 'crystal_gem') {
    // Elongated hexagonal prism
    const crystal = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.35, w * 0.4, h, 6),
      getMat(color, 0.1, 0.7, { transparent: true, opacity: 0.6 }));
    crystal.position.y = h / 2;
    crystal.castShadow = true;
    group.add(crystal);
    // Pointed top
    const top = new THREE.Mesh(new THREE.ConeGeometry(w * 0.35, h * 0.3, 6),
      getMat(color, 0.1, 0.7, { transparent: true, opacity: 0.6 }));
    top.position.y = h + h * 0.15;
    group.add(top);
    // Small crystal growths
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const sH = h * (0.3 + Math.random() * 0.3);
      const smallCrystal = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.1, w * 0.13, sH, 6),
        getMat(new THREE.Color(color).offsetHSL(0.05, 0, 0.1), 0.1, 0.6, { transparent: true, opacity: 0.5 }));
      smallCrystal.position.set(Math.cos(a) * w * 0.35, sH / 2, Math.sin(a) * w * 0.35);
      smallCrystal.rotation.z = (Math.random() - 0.5) * 0.4;
      group.add(smallCrystal);
    }
  } else if (id === 'geode') {
    // Outer rough hemisphere + inner sparkly crystals
    const outer = new THREE.Mesh(new THREE.SphereGeometry(maxDim / 2, 12, 8),
      getMat(0x777777, 0.95, 0.05));
    outer.position.y = maxDim / 2;
    outer.castShadow = true;
    group.add(outer);
    // Cut face (flat circle showing interior)
    const innerMat = getMat(color, 0.2, 0.6);
    const face = new THREE.Mesh(new THREE.CircleGeometry(maxDim * 0.4, 16), innerMat);
    face.position.set(0, maxDim / 2, maxDim * 0.45);
    group.add(face);
    // Crystal points inside
    for (let i = 0; i < 8; i++) {
      const a = Math.random() * Math.PI * 2;
      const rr = Math.random() * maxDim * 0.25;
      const crystalH = maxDim * (0.05 + Math.random() * 0.12);
      const crystal = new THREE.Mesh(new THREE.ConeGeometry(0.015, crystalH, 4),
        getMat(new THREE.Color(color).offsetHSL(Math.random() * 0.1, 0, 0.1), 0.15, 0.6));
      crystal.position.set(Math.cos(a) * rr, maxDim * 0.35 + Math.sin(a) * rr * 0.3, maxDim * 0.42);
      crystal.rotation.x = -Math.PI / 2 + (Math.random() - 0.5) * 0.5;
      group.add(crystal);
    }
  } else if (id === 'gravestone') {
    // Rectangular slab with rounded top
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h * 0.8, d), mat);
    body.position.y = h * 0.4;
    body.castShadow = true;
    group.add(body);
    // Rounded top (half cylinder)
    const topCurve = new THREE.Mesh(
      new THREE.CylinderGeometry(w / 2, w / 2, d, 12, 1, false, 0, Math.PI),
      mat);
    topCurve.rotation.x = Math.PI / 2;
    topCurve.rotation.z = Math.PI / 2;
    topCurve.position.y = h * 0.8;
    group.add(topCurve);
    // Cross engraving on front
    const engrMat = getMat(new THREE.Color(color).multiplyScalar(0.7), 0.95, 0.05);
    const crossV = new THREE.Mesh(new THREE.BoxGeometry(w * 0.05, h * 0.3, 0.005), engrMat);
    crossV.position.set(0, h * 0.55, d / 2 + 0.003);
    group.add(crossV);
    const crossH = new THREE.Mesh(new THREE.BoxGeometry(w * 0.2, h * 0.04, 0.005), engrMat);
    crossH.position.set(0, h * 0.6, d / 2 + 0.003);
    group.add(crossH);
  } else if (id === 'marble_bust' || id === 'stone_statue') {
    // Simple humanoid bust/figure
    const torsoH = h * 0.5;
    const headR = w * 0.3;
    // Torso (tapered cylinder)
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.35, w * 0.45, torsoH, 10), mat);
    torso.position.y = torsoH / 2;
    torso.castShadow = true;
    group.add(torso);
    // Neck
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(headR * 0.4, headR * 0.5, h * 0.08, 8), mat);
    neck.position.y = torsoH + h * 0.04;
    group.add(neck);
    // Head
    const head = new THREE.Mesh(new THREE.SphereGeometry(headR, 12, 10), mat);
    head.scale.y = 1.15;
    head.position.y = torsoH + h * 0.08 + headR;
    group.add(head);
    // Nose
    const nose = new THREE.Mesh(new THREE.ConeGeometry(headR * 0.12, headR * 0.25, 4), mat);
    nose.rotation.x = -Math.PI / 2;
    nose.position.set(0, torsoH + h * 0.12 + headR * 0.9, headR * 0.85);
    group.add(nose);
    // Base
    if (id === 'marble_bust') {
      const base = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.4, w * 0.45, h * 0.06, 12),
        getMat(new THREE.Color(color).multiplyScalar(0.85), 0.9, 0.1));
      base.position.y = -h * 0.01;
      group.add(base);
    }
  } else if (id === 'brick') {
    // Classic brick shape with mortar lines
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    body.position.y = h / 2;
    body.castShadow = true;
    group.add(body);
    // Frog (indentation on top)
    const frog = new THREE.Mesh(new THREE.BoxGeometry(w * 0.6, 0.005, d * 0.3),
      getMat(new THREE.Color(color).multiplyScalar(0.8), 0.95, 0.05));
    frog.position.set(0, h + 0.002, 0);
    group.add(frog);
  } else {
    // Default: irregular stone with bumps
    const minDim = Math.min(w, h, d);
    var body;
    if (minDim / maxDim > 0.7) {
      body = new THREE.Mesh(new THREE.DodecahedronGeometry(maxDim / 2, 1), mat);
      body.position.y = maxDim / 2;
    } else {
      body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      body.position.y = h / 2;
    }
    body.castShadow = true;
    group.add(body);
    for (let i = 0; i < 4; i++) {
      const bumpColor = new THREE.Color(color).offsetHSL(0, 0, (Math.random() - 0.5) * 0.1);
      const bump = new THREE.Mesh(new THREE.SphereGeometry(maxDim * 0.06, 6, 4),
        getMat(bumpColor, 0.9, 0.1));
      const angle = Math.random() * Math.PI * 2;
      bump.position.set(Math.cos(angle) * w * 0.4, (Math.random() * 0.6 + 0.2) * h, Math.sin(angle) * d * 0.4);
      group.add(bump);
    }
  }
}

function buildToy(group, objData) {
  const p = objData.p;
  const id = objData.id;
  const w = p.w || 0.12;
  const h = p.h || 0.12;
  const d = p.d || 0.12;
  const color = p.c || 0xff3388;
  const accentColor = p.ac || 0x33aaff;
  const mat = getMat(color, 0.5, 0.1);
  const accentMat = getMat(accentColor, 0.4, 0.1);

  if (id === 'rubiks_cube') {
    // Box with colored face panels (3x3 grid on each face)
    const cubeSize = Math.max(w, h, d);
    const body = new THREE.Mesh(new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize),
      getMat(0x111111, 0.6, 0.2));
    body.position.y = cubeSize / 2;
    group.add(body);
    // Colored stickers on faces
    const faceColors = [0xff0000, 0xff8800, 0xffffff, 0xffff00, 0x00aa00, 0x0000ff];
    const faceNormals = [
      { axis: 'x', sign: 1 }, { axis: 'x', sign: -1 },
      { axis: 'y', sign: 1 }, { axis: 'y', sign: -1 },
      { axis: 'z', sign: 1 }, { axis: 'z', sign: -1 }
    ];
    const cellSize = cubeSize * 0.28;
    const gap = cubeSize * 0.02;
    faceNormals.forEach(function(face, fi) {
      const fColor = faceColors[fi];
      for (let row = -1; row <= 1; row++) {
        for (let col = -1; col <= 1; col++) {
          const sticker = new THREE.Mesh(
            new THREE.PlaneGeometry(cellSize, cellSize),
            getMat(fColor, 0.45, 0.15));
          if (face.axis === 'z') {
            sticker.position.set(col * (cellSize + gap), cubeSize / 2 + row * (cellSize + gap), face.sign * (cubeSize / 2 + 0.002));
            if (face.sign < 0) sticker.rotation.y = Math.PI;
          } else if (face.axis === 'x') {
            sticker.position.set(face.sign * (cubeSize / 2 + 0.002), cubeSize / 2 + row * (cellSize + gap), col * (cellSize + gap));
            sticker.rotation.y = face.sign * Math.PI / 2;
          } else {
            sticker.position.set(col * (cellSize + gap), face.sign * (cubeSize / 2 + 0.002) + cubeSize / 2, row * (cellSize + gap));
            sticker.rotation.x = -face.sign * Math.PI / 2;
          }
          group.add(sticker);
        }
      }
    });
  } else if (id === 'teddy_bear' || id === 'plush_monkey') {
    // Body + head + ears + limbs
    const bodyR = Math.max(w, d) * 0.4;
    const headR = bodyR * 0.65;
    // Body
    const body = new THREE.Mesh(new THREE.SphereGeometry(bodyR, 12, 10), mat);
    body.scale.y = 1.1;
    body.position.y = bodyR * 1.1;
    body.castShadow = true;
    group.add(body);
    // Head
    const head = new THREE.Mesh(new THREE.SphereGeometry(headR, 12, 10), mat);
    head.position.y = bodyR * 2.1 + headR * 0.5;
    group.add(head);
    // Ears
    const earMat = getMat(new THREE.Color(color).multiplyScalar(0.8), 0.5, 0.1);
    for (let side = -1; side <= 1; side += 2) {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(headR * 0.35, 8, 6), earMat);
      ear.position.set(side * headR * 0.65, bodyR * 2.1 + headR * 1.1, 0);
      group.add(ear);
    }
    // Snout/muzzle
    const snoutMat = getMat(accentColor, 0.5, 0.05);
    const snout = new THREE.Mesh(new THREE.SphereGeometry(headR * 0.3, 8, 6), snoutMat);
    snout.position.set(0, bodyR * 2.05 + headR * 0.35, headR * 0.65);
    snout.scale.set(1.2, 0.8, 0.8);
    group.add(snout);
    // Eyes
    const eyeMat = getMat(0x111111, 0.3, 0.3);
    for (let side = -1; side <= 1; side += 2) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(headR * 0.08, 6, 6), eyeMat);
      eye.position.set(side * headR * 0.25, bodyR * 2.15 + headR * 0.6, headR * 0.7);
      group.add(eye);
    }
    // Nose
    const nose = new THREE.Mesh(new THREE.SphereGeometry(headR * 0.08, 6, 4),
      getMat(0x1a1a1a, 0.3, 0.2));
    nose.position.set(0, bodyR * 2.1 + headR * 0.5, headR * 0.9);
    group.add(nose);
    // Arms
    for (let side = -1; side <= 1; side += 2) {
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(bodyR * 0.2, bodyR * 0.18, bodyR * 1.1, 8), mat);
      arm.position.set(side * bodyR * 1.1, bodyR * 1.5, 0);
      arm.rotation.z = side * 0.6;
      group.add(arm);
    }
  } else if (id === 'toy_car') {
    // Box body + 4 cylinder wheels + windshield
    const bodyH = h * 0.5;
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, bodyH, d), mat);
    body.position.y = bodyH * 0.8;
    body.castShadow = true;
    group.add(body);
    // Cabin (upper body)
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(w * 0.6, bodyH * 0.6, d * 0.9),
      getMat(new THREE.Color(color).offsetHSL(0, -0.1, 0.1), 0.45, 0.15));
    cabin.position.set(-w * 0.05, bodyH * 1.35, 0);
    group.add(cabin);
    // Windshield
    const windshield = new THREE.Mesh(new THREE.PlaneGeometry(d * 0.7, bodyH * 0.5),
      getMat(0x88bbff, 0.1, 0.3, { transparent: true, opacity: 0.4 }));
    windshield.position.set(w * 0.25, bodyH * 1.3, 0);
    windshield.rotation.y = Math.PI / 2;
    windshield.rotation.x = -0.2;
    group.add(windshield);
    // Wheels (4)
    const wheelMat = getMat(accentColor, 0.6, 0.2);
    const wheelR = bodyH * 0.35;
    const wheelPositions = [
      [w * 0.3, wheelR, d * 0.5], [w * 0.3, wheelR, -d * 0.5],
      [-w * 0.3, wheelR, d * 0.5], [-w * 0.3, wheelR, -d * 0.5]
    ];
    wheelPositions.forEach(function(pos) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(wheelR, wheelR, 0.02, 10), wheelMat);
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(pos[0], pos[1], pos[2]);
      group.add(wheel);
    });
    // Headlights
    const lightMat = getMat(0xffff88, 0.2, 0.5);
    for (let side = -1; side <= 1; side += 2) {
      const light = new THREE.Mesh(new THREE.SphereGeometry(bodyH * 0.1, 6, 4), lightMat);
      light.position.set(w * 0.5, bodyH * 0.75, side * d * 0.3);
      group.add(light);
    }
  } else if (id === 'toy_robot') {
    // Stacked boxes: legs, body, head + arms + antenna
    const unitW = w * 0.35;
    // Legs
    for (let side = -1; side <= 1; side += 2) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(unitW, h * 0.25, d * 0.3), mat);
      leg.position.set(side * unitW * 0.7, h * 0.125, 0);
      group.add(leg);
    }
    // Body
    const body = new THREE.Mesh(new THREE.BoxGeometry(w * 0.7, h * 0.35, d * 0.6), mat);
    body.position.y = h * 0.42;
    body.castShadow = true;
    group.add(body);
    // Chest panel
    const panel = new THREE.Mesh(new THREE.BoxGeometry(w * 0.4, h * 0.15, 0.01),
      getMat(0x333333, 0.4, 0.5));
    panel.position.set(0, h * 0.4, d * 0.31);
    group.add(panel);
    // Chest buttons
    const btnColors = [0xff0000, 0x00ff00, 0x0000ff];
    btnColors.forEach(function(bc, i) {
      const btn = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 4), getMat(bc, 0.3, 0.3));
      btn.position.set(-0.02 + i * 0.02, h * 0.4, d * 0.32);
      group.add(btn);
    });
    // Head
    const head = new THREE.Mesh(new THREE.BoxGeometry(w * 0.45, h * 0.2, d * 0.4),
      getMat(new THREE.Color(color).offsetHSL(0, 0, 0.1), 0.4, 0.2));
    head.position.y = h * 0.7;
    group.add(head);
    // Eyes
    const eyeMat = getMat(accentColor, 0.2, 0.4, { emissive: accentColor, emissiveIntensity: 0.5 });
    for (let side = -1; side <= 1; side += 2) {
      const eye = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.01, 8), eyeMat);
      eye.rotation.x = Math.PI / 2;
      eye.position.set(side * w * 0.12, h * 0.73, d * 0.21);
      group.add(eye);
    }
    // Antenna
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, h * 0.12, 4),
      getMat(0xcccccc, 0.3, 0.7));
    antenna.position.y = h * 0.86;
    group.add(antenna);
    const antennaBall = new THREE.Mesh(new THREE.SphereGeometry(0.015, 6, 4),
      getMat(accentColor, 0.3, 0.3));
    antennaBall.position.y = h * 0.93;
    group.add(antennaBall);
    // Arms
    for (let side = -1; side <= 1; side += 2) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(unitW * 0.5, h * 0.25, d * 0.2), mat);
      arm.position.set(side * w * 0.5, h * 0.4, 0);
      group.add(arm);
    }
  } else if (id === 'lego_brick') {
    // Box with studs on top
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    body.position.y = h / 2;
    body.castShadow = true;
    group.add(body);
    // Studs (2x4 grid on top)
    const studR = Math.min(w, d) * 0.15;
    const studH = h * 0.15;
    const cols = 4;
    const rows = 2;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const stud = new THREE.Mesh(new THREE.CylinderGeometry(studR, studR, studH, 8), mat);
        stud.position.set(
          -w * 0.35 + col * w * 0.23,
          h + studH / 2,
          -d * 0.25 + row * d * 0.5
        );
        group.add(stud);
      }
    }
  } else if (id === 'matryoshka') {
    // Rounded figure shape (egg-like with flat bottom)
    const bodyR = w / 2;
    const body = new THREE.Mesh(new THREE.SphereGeometry(bodyR, 14, 10), mat);
    body.scale.y = 1.4;
    body.position.y = bodyR * 1.4;
    body.castShadow = true;
    group.add(body);
    // Face area (lighter circle)
    const face = new THREE.Mesh(new THREE.CircleGeometry(bodyR * 0.45, 12),
      getMat(0xf5deb3, 0.6, 0.05));
    face.position.set(0, bodyR * 1.8, bodyR * 0.88);
    group.add(face);
    // Headscarf line
    const scarfMat = getMat(accentColor, 0.5, 0.1);
    const scarf = new THREE.Mesh(new THREE.TorusGeometry(bodyR * 0.5, 0.015, 6, 16, Math.PI), scarfMat);
    scarf.position.set(0, bodyR * 1.85, bodyR * 0.2);
    scarf.rotation.x = 0.3;
    group.add(scarf);
    // Flat bottom
    const bottom = new THREE.Mesh(new THREE.CylinderGeometry(bodyR * 0.7, bodyR * 0.7, 0.02, 12), mat);
    bottom.position.y = 0.01;
    group.add(bottom);
  } else {
    // Default: box/sphere with accent details
    const maxDim = Math.max(w, h, d);
    const minDim = Math.min(w, h, d);
    var body;
    if (minDim / maxDim > 0.7) {
      body = new THREE.Mesh(new THREE.SphereGeometry(maxDim / 2, 16, 12), mat);
      body.position.y = maxDim / 2;
    } else {
      body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      body.position.y = h / 2;
    }
    body.castShadow = true;
    group.add(body);
    const accent = new THREE.Mesh(new THREE.SphereGeometry(maxDim * 0.2, 8, 6), accentMat);
    accent.position.set(w * 0.15, h * 0.7, d * 0.2);
    group.add(accent);
  }
}

function buildPaper(group, objData) {
  const p = objData.p;
  const id = objData.id;
  const w = p.w || 0.2;
  const h = p.h || 0.28;
  const d = p.d || 0.02;
  const color = p.c || 0xf5f2eb;
  const paperMat = getMat(color, 0.9, 0.0, { map: generateTexture('paper', color) });

  if (id === 'book') {
    // Box body + spine + pages visible on one side
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), paperMat);
    body.position.y = h / 2;
    body.castShadow = true;
    group.add(body);
    // Spine (thicker on one edge)
    const spineMat = getMat(new THREE.Color(color).multiplyScalar(0.7), 0.7, 0.1);
    const spine = new THREE.Mesh(new THREE.BoxGeometry(0.01, h + 0.005, d + 0.005), spineMat);
    spine.position.set(-w / 2, h / 2, 0);
    group.add(spine);
    // Page edges (white lines on the opposite side from spine)
    const pageMat = getMat(0xfffff0, 0.9, 0.0);
    const pageEdge = new THREE.Mesh(new THREE.BoxGeometry(0.003, h - 0.01, d - 0.01), pageMat);
    pageEdge.position.set(w / 2 - 0.003, h / 2, 0);
    group.add(pageEdge);
    // Title line on front cover
    const titleMat = getMat(new THREE.Color(color).offsetHSL(0.1, 0, -0.2), 0.8, 0.05);
    const title = new THREE.Mesh(new THREE.BoxGeometry(w * 0.6, h * 0.03, 0.002), titleMat);
    title.position.set(0, h * 0.7, d / 2 + 0.002);
    group.add(title);
    const title2 = new THREE.Mesh(new THREE.BoxGeometry(w * 0.4, h * 0.02, 0.002), titleMat);
    title2.position.set(0, h * 0.62, d / 2 + 0.002);
    group.add(title2);
  } else if (id === 'cardboard_box' || id === 'gift_box') {
    // Box with flap lines visible
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), paperMat);
    body.position.y = h / 2;
    body.castShadow = true;
    group.add(body);
    // Top flaps (two angled planes)
    const flapMat = getMat(new THREE.Color(color).multiplyScalar(0.93), 0.9, 0.0);
    for (let side = -1; side <= 1; side += 2) {
      const flap = new THREE.Mesh(new THREE.BoxGeometry(w * 0.48, 0.005, d), flapMat);
      flap.position.set(side * w * 0.25, h + 0.003, 0);
      flap.rotation.z = side * 0.1;
      group.add(flap);
    }
    if (id === 'gift_box') {
      // Ribbon cross
      const ribbonMat = getMat(0xff3366, 0.5, 0.2);
      const ribbonH = new THREE.Mesh(new THREE.BoxGeometry(w + 0.01, 0.02, 0.015), ribbonMat);
      ribbonH.position.y = h / 2;
      group.add(ribbonH);
      const ribbonV = new THREE.Mesh(new THREE.BoxGeometry(0.015, h + 0.01, 0.02), ribbonMat);
      ribbonV.position.y = h / 2;
      group.add(ribbonV);
      // Bow on top
      for (let side = -1; side <= 1; side += 2) {
        const loop = new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.008, 6, 10, Math.PI), ribbonMat);
        loop.position.set(side * 0.02, h + 0.02, 0);
        loop.rotation.z = side * 0.3;
        group.add(loop);
      }
    }
    // Edge tape line
    const tapeMat = getMat(new THREE.Color(color).multiplyScalar(0.8), 0.85, 0.0);
    const tape = new THREE.Mesh(new THREE.BoxGeometry(w * 0.3, 0.005, d + 0.006), tapeMat);
    tape.position.y = h + 0.002;
    group.add(tape);
  } else if (id === 'toilet_roll') {
    // Cylinder with hollow center
    const outerR = w / 2;
    const innerR = outerR * 0.3;
    const rollH = h;
    // Outer cylinder
    const outer = new THREE.Mesh(new THREE.CylinderGeometry(outerR, outerR, rollH, 16), paperMat);
    outer.position.y = rollH / 2;
    outer.castShadow = true;
    group.add(outer);
    // Inner cardboard tube (visible at top and bottom)
    const tubeMat = getMat(0xc4a35a, 0.8, 0.05);
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(innerR, innerR, rollH + 0.002, 12, 1, true), tubeMat);
    tube.position.y = rollH / 2;
    group.add(tube);
    // Top ring showing layers
    const ringMat = getMat(0xeeeedd, 0.85, 0.0);
    const topRing = new THREE.Mesh(new THREE.TorusGeometry((outerR + innerR) / 2, (outerR - innerR) / 2, 4, 20), ringMat);
    topRing.rotation.x = Math.PI / 2;
    topRing.position.y = rollH;
    group.add(topRing);
  } else if (id === 'wallpaper_roll') {
    // Rolled cylinder with visible spiral on ends
    const body = new THREE.Mesh(new THREE.CylinderGeometry(w / 2, w / 2, h, 16), paperMat);
    body.position.y = h / 2;
    body.castShadow = true;
    group.add(body);
    // Pattern on surface (colored stripes)
    const patternMat = getMat(new THREE.Color(color).offsetHSL(0.1, 0.2, -0.1), 0.8, 0.0);
    for (let i = 0; i < 5; i++) {
      const stripe = new THREE.Mesh(new THREE.CylinderGeometry(w / 2 + 0.003, w / 2 + 0.003, h * 0.03, 16), patternMat);
      stripe.position.y = h * 0.15 + i * h * 0.17;
      group.add(stripe);
    }
  } else {
    // Default: flat box with page lines
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), paperMat);
    body.position.y = h / 2;
    body.castShadow = true;
    group.add(body);
    if (d < 0.05) {
      const lineColor = new THREE.Color(color).multiplyScalar(0.85);
      const lineMat = getMat(lineColor, 0.9, 0.0);
      const lineCount = Math.min(Math.floor(d / 0.003), 8);
      for (let i = 0; i < lineCount; i++) {
        const line = new THREE.Mesh(new THREE.BoxGeometry(w + 0.001, 0.001, 0.001), lineMat);
        line.position.set(0, (i / Math.max(lineCount - 1, 1)) * h, d / 2 + 0.001);
        group.add(line);
      }
    }
  }
}

function buildWax(group, objData) {
  const p = objData.p;
  const id = objData.id;
  const h = p.h || 0.12;
  const r = p.r || 0.05;
  const color = p.c || 0xfff4d6;
  const wickColor = p.wc || 0;
  const bodyMat = getMat(color, 0.5, 0.05);

  if (id === 'lipstick') {
    // Tube base + angled wax tip
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h * 0.6, 12),
      getMat(0x333333, 0.3, 0.6));
    tube.position.y = h * 0.3;
    tube.castShadow = true;
    group.add(tube);
    // Inner tube (gold)
    const inner = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.85, r * 0.85, h * 0.15, 12),
      getMat(0xccaa66, 0.3, 0.7));
    inner.position.y = h * 0.65;
    group.add(inner);
    // Wax tip (angled cut cylinder)
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.8, r * 0.8, h * 0.25, 12), bodyMat);
    tip.position.y = h * 0.82;
    tip.rotation.z = 0.25;
    group.add(tip);
    // Cap (small cylinder on the side)
  } else if (id === 'wax_rose') {
    // Layered petals (circles at different rotations)
    const petalMat = bodyMat;
    const layers = 5;
    for (let layer = 0; layer < layers; layer++) {
      const layerR = r * (0.4 + layer * 0.15);
      const petalsInLayer = 4 + layer;
      for (let i = 0; i < petalsInLayer; i++) {
        const angle = (i / petalsInLayer) * Math.PI * 2 + layer * 0.5;
        const petal = new THREE.Mesh(new THREE.CircleGeometry(layerR * 0.4, 8),
          getMat(new THREE.Color(color).offsetHSL(0, layer * 0.02, -layer * 0.04), 0.5, 0.05,
            { side: THREE.DoubleSide }));
        petal.position.set(
          Math.cos(angle) * layerR * 0.3,
          r + layer * r * 0.15,
          Math.sin(angle) * layerR * 0.3
        );
        petal.rotation.x = -0.3 - layer * 0.15;
        petal.rotation.y = angle;
        group.add(petal);
      }
    }
    // Center bud
    const bud = new THREE.Mesh(new THREE.SphereGeometry(r * 0.15, 8, 6),
      getMat(new THREE.Color(color).multiplyScalar(0.85), 0.5, 0.05));
    bud.position.y = r + layers * r * 0.15;
    group.add(bud);
    // Stem
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.06, r * 0.06, r * 0.8, 6),
      getMat(0x2d5a1e, 0.7, 0.05));
    stem.position.y = r * 0.4;
    group.add(stem);
  } else if (id === 'wax_figure') {
    // Simple humanoid figure
    const figMat = bodyMat;
    // Body
    const body = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.6, r * 0.5, h * 0.4, 10), figMat);
    body.position.y = h * 0.35;
    body.castShadow = true;
    group.add(body);
    // Legs (two cylinders)
    for (let side = -1; side <= 1; side += 2) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.18, r * 0.15, h * 0.3, 8), figMat);
      leg.position.set(side * r * 0.25, h * 0.13, 0);
      group.add(leg);
    }
    // Head
    const head = new THREE.Mesh(new THREE.SphereGeometry(r * 0.35, 10, 8), figMat);
    head.position.y = h * 0.68;
    group.add(head);
    // Arms
    for (let side = -1; side <= 1; side += 2) {
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.1, r * 0.08, h * 0.3, 6), figMat);
      arm.position.set(side * r * 0.55, h * 0.4, 0);
      arm.rotation.z = side * 0.3;
      group.add(arm);
    }
  } else if (id === 'crayon') {
    // Hexagonal cylinder with pointed tip and wrapper
    const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h * 0.75, 6), bodyMat);
    body.position.y = h * 0.45;
    body.castShadow = true;
    group.add(body);
    // Paper wrapper (slightly larger, lighter)
    const wrapper = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.02, r * 1.02, h * 0.5, 6),
      getMat(0xffffff, 0.9, 0.0, { transparent: true, opacity: 0.6 }));
    wrapper.position.y = h * 0.3;
    group.add(wrapper);
    // Pointed tip
    const tip = new THREE.Mesh(new THREE.ConeGeometry(r, h * 0.15, 6), bodyMat);
    tip.position.y = h * 0.85;
    group.add(tip);
  } else {
    // Default: candle/cylinder with wick and rim
    const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 16), bodyMat);
    body.position.y = h / 2;
    body.castShadow = true;
    group.add(body);
    if (wickColor) {
      const wick = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.05, 6),
        getMat(wickColor, 0.9, 0.0));
      wick.position.y = h + 0.025;
      group.add(wick);
      // Small flame glow
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.015, 0.04, 6),
        getMat(0xff8800, 0.3, 0.0, { emissive: 0xff6600, emissiveIntensity: 0.8 }));
      flame.position.y = h + 0.06;
      group.add(flame);
    }
    // Rim
    const rim = new THREE.Mesh(new THREE.TorusGeometry(r, 0.005, 8, 16),
      getMat(new THREE.Color(color).multiplyScalar(0.92), 0.5, 0.05));
    rim.rotation.x = Math.PI / 2;
    rim.position.y = h;
    group.add(rim);
    // Wax drip detail
    if (h > 0.2) {
      const dripMat = getMat(new THREE.Color(color).multiplyScalar(0.95), 0.5, 0.05);
      for (let i = 0; i < 2; i++) {
        const a = Math.random() * Math.PI * 2;
        const drip = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.005, h * 0.15, 6), dripMat);
        drip.position.set(Math.cos(a) * r * 0.95, h * 0.85, Math.sin(a) * r * 0.95);
        group.add(drip);
      }
    }
  }
}


// ═══════════════════════════════════════════════════
// 8. CRUSH ANIMATIONS (Progressive Fragmentation)
// ═══════════════════════════════════════════════════

function createFragment(pos, color, size, shapeHint) {
  // Varied fragment shapes: chunks, flat shards, splinters, droplets
  var geom;
  var shape = shapeHint || Math.random();
  if (shapeHint === 'droplet') {
    // Elongated teardrop-like shape for wet objects
    geom = new THREE.SphereGeometry(size * 0.5, 5, 4);
    geom.scale(0.6, 1.8, 0.6);
  } else if (shape < 0.25) {
    // Flat shard — thin and wide
    geom = new THREE.BoxGeometry(size * 1.4, size * 0.15, size * (0.6 + Math.random() * 0.8));
  } else if (shape < 0.5) {
    // Chunky irregular piece
    geom = new THREE.TetrahedronGeometry(size * 0.7, 0);
  } else if (shape < 0.7) {
    // Splinter — long and thin
    geom = new THREE.BoxGeometry(size * 0.25, size * (1.0 + Math.random() * 1.5), size * 0.25);
  } else {
    // Standard chunk with aspect variation
    geom = new THREE.BoxGeometry(size, size * (0.3 + Math.random() * 1.4), size * (0.5 + Math.random() * 0.5));
  }
  var mat = new THREE.MeshStandardMaterial({ color: color, roughness: 0.6, metalness: 0.2 });
  var mesh = new THREE.Mesh(geom, mat);
  mesh.position.copy(pos);
  mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
  mesh.userData.vel = new THREE.Vector3(
    (Math.random() - 0.5) * 5,
    Math.random() * 0.5,
    (Math.random() - 0.5) * 5
  );
  mesh.userData.rotVel = new THREE.Vector3(
    (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10
  );
  mesh.userData.life = 2.5;
  mesh.userData.bounceCount = 0;
  mesh.castShadow = true;
  scene.add(mesh);
  fragments.push(mesh);
  return mesh;
}

function getObjColor(obj) {
  var color = 0xaaaaaa;
  obj.traverse(function(child) {
    if (child.isMesh && child.material && child.material.color && color === 0xaaaaaa) {
      color = child.material.color.getHex();
    }
  });
  return color;
}

function getObjColors(obj) {
  var colors = [];
  obj.traverse(function(child) {
    if (child.isMesh && child.material && child.material.color) {
      var hex = child.material.color.getHex();
      if (colors.indexOf(hex) === -1) colors.push(hex);
    }
  });
  return colors.length > 0 ? colors : [0xaaaaaa];
}

function spawnProgressiveFragments(ctx, count, opts) {
  opts = opts || {};
  var velScale = opts.velScale || 1;
  var sizeMin = opts.sizeMin || 0.01;
  var sizeMax = opts.sizeMax || 0.03;
  var spread = opts.spread || 0.1;
  var upBias = opts.upBias || 1.5;
  var colors = opts.colors || [ctx.objColor];
  var maxFrags = opts.maxFrags || 80;

  for (var i = 0; i < count && ctx.totalFrags < maxFrags; i++) {
    var angle = Math.random() * Math.PI * 2;
    var r = spread * (0.3 + Math.random() * 0.7);
    var color = colors[Math.floor(Math.random() * colors.length)];
    var size = sizeMin + Math.random() * (sizeMax - sizeMin);

    var frag = createFragment(
      new THREE.Vector3(
        Math.cos(angle) * r,
        ctx.contactY + (Math.random() - 0.5) * 0.04,
        Math.sin(angle) * r
      ),
      color,
      size
    );

    frag.userData.vel.set(
      Math.cos(angle) * (2 + Math.random() * 4) * velScale,
      (Math.random() * 0.3) * velScale,
      Math.sin(angle) * (2 + Math.random() * 4) * velScale
    );

    ctx.totalFrags++;
  }
}

function applyCrush(obj, progress, ctx) {
  var crushType = obj.userData.crush || 'squish';

  // Initialize progressive context on first call
  if (ctx.lastProgress === undefined) {
    ctx.lastProgress = 0;
    ctx.totalFrags = 0;
    ctx.objHeight = obj.userData.height || 0.5;
    ctx.objColor = getObjColor(obj);
    ctx.objColors = getObjColors(obj);
    ctx.baseY = obj.position.y;
    ctx.popped = false;
    ctx.snapped = false;
    ctx.halves = [];
    ctx.dripped = 0;
    ctx.crackMeshes = [];

    // Create clipping plane: clips everything ABOVE contactY (world space)
    ctx.clipPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), ctx.baseY + ctx.objHeight * 0.5 + 0.01);
    // CLONE materials before setting clipping planes — never modify cached getMat() materials
    obj.traverse(function(child) {
      if (child.isMesh && child.material) {
        if (Array.isArray(child.material)) {
          child.material = child.material.map(function(m) {
            var cloned = m.clone();
            cloned.clippingPlanes = [ctx.clipPlane];
            cloned.clipShadows = true;
            cloned.needsUpdate = true;
            return cloned;
          });
        } else {
          child.material = child.material.clone();
          child.material.clippingPlanes = [ctx.clipPlane];
          child.material.clipShadows = true;
          child.material.needsUpdate = true;
        }
      }
    });

    // Create cross-section disc showing the "inside" of the object at the cut line
    var innerColor = ctx.objColors.length > 1 ? ctx.objColors[1] :
      new THREE.Color(ctx.objColor).multiplyScalar(0.7).getHex();
    var outerRingColor = new THREE.Color(ctx.objColor);
    var maxR = 0;
    obj.traverse(function(child) {
      if (child.isMesh && child.geometry) {
        if (!child.geometry.boundingSphere) child.geometry.computeBoundingSphere();
        var cr = child.geometry.boundingSphere.radius * Math.max(child.scale.x, child.scale.z);
        if (cr > maxR) maxR = cr;
      }
    });
    ctx.objRadius = maxR || 0.2;
    // Build a layered cross-section: outer rind/shell + inner flesh/core
    var csGroup = new THREE.Group();
    // Outer ring (skin/shell layer)
    var ringGeom = new THREE.RingGeometry(ctx.objRadius * 0.75, ctx.objRadius, 24);
    var ringMat = new THREE.MeshStandardMaterial({
      color: outerRingColor, roughness: 0.5, metalness: 0.05, side: THREE.DoubleSide
    });
    var ring = new THREE.Mesh(ringGeom, ringMat);
    csGroup.add(ring);
    // Inner flesh area
    var innerGeom = new THREE.CircleGeometry(ctx.objRadius * 0.76, 24);
    var innerMat = new THREE.MeshStandardMaterial({
      color: innerColor, roughness: 0.7, metalness: 0.0, side: THREE.DoubleSide
    });
    var innerDisc = new THREE.Mesh(innerGeom, innerMat);
    innerDisc.position.y = 0.001;
    csGroup.add(innerDisc);
    // Seed/texture dots for organic objects
    var seedColor = ctx.objColors.length > 2 ? ctx.objColors[2] :
      new THREE.Color(innerColor).multiplyScalar(0.5).getHex();
    var seedCount = 4 + Math.floor(Math.random() * 5);
    for (var si = 0; si < seedCount; si++) {
      var sa = (si / seedCount) * Math.PI * 2 + Math.random() * 0.3;
      var sr = ctx.objRadius * (0.2 + Math.random() * 0.4);
      var seedGeom = new THREE.CircleGeometry(ctx.objRadius * 0.04, 5);
      var seedMat = new THREE.MeshStandardMaterial({
        color: seedColor, roughness: 0.8, side: THREE.DoubleSide
      });
      var seed = new THREE.Mesh(seedGeom, seedMat);
      seed.position.set(Math.cos(sa) * sr, 0.002, Math.sin(sa) * sr);
      seed.rotation.x = -Math.PI / 2;
      csGroup.add(seed);
    }
    csGroup.rotation.x = -Math.PI / 2;
    csGroup.visible = false;
    scene.add(csGroup);
    ctx.crossSection = csGroup;
  }

  var progressDelta = progress - ctx.lastProgress;
  ctx.lastProgress = progress;

  // Contact Y (where press currently meets object) — moves from top to bottom
  ctx.contactY = OBJ_Y + ctx.objHeight * Math.max(0.02, 1 - progress);

  // Update clipping plane to progressively hide object from top down
  ctx.clipPlane.constant = ctx.contactY;

  // Update cross-section disc — visible cap at the cut line
  if (ctx.crossSection) {
    if (progress > 0.02 && progress < 0.96) {
      ctx.crossSection.visible = true;
      ctx.crossSection.position.set(0, ctx.contactY, 0);
      // Approximate cross-section radius varies with height for round objects
      var normalizedH = Math.max(0.05, 1 - progress);
      var radiusFactor = Math.sin(normalizedH * Math.PI);
      ctx.crossSection.scale.setScalar(Math.max(0.15, radiusFactor));
    } else {
      ctx.crossSection.visible = false;
    }
  }

  var crushFns = {
    squish: crushSquish,
    shatter: crushShatter,
    crumple: crushCrumple,
    splat: crushSplat,
    pop: crushPop,
    crack: crushCrack,
    crush: crushCrush,
    fold: crushFold,
    melt: crushMelt,
    snap: crushSnap
  };

  var fn = crushFns[crushType] || crushSquish;
  fn(obj, progress, ctx, progressDelta);
}

// --- SQUISH: Wobble/jiggle, then soft spread with oozing material ---
function crushSquish(obj, progress, ctx, delta) {
  // Early phase: wobble/jiggle before deforming
  if (progress < 0.2) {
    var wobble = Math.sin(progress * 80) * 0.03 * (1 - progress * 5);
    obj.scale.x = 1 + wobble;
    obj.scale.z = 1 - wobble;
    obj.rotation.z = Math.sin(progress * 60) * 0.02;
  } else {
    // Pancake spread with slight oscillation (material oozes sideways)
    var spreadBase = 1 + (progress - 0.2) * 0.7;
    var oozeWobble = Math.sin(progress * 15) * 0.03 * (1 - progress);
    obj.scale.x = spreadBase + oozeWobble;
    obj.scale.z = spreadBase - oozeWobble;
    obj.rotation.z = 0;
  }

  if (delta > 0.008) {
    var count = Math.max(1, Math.ceil(delta * 12));
    spawnProgressiveFragments(ctx, count, {
      velScale: 0.7, sizeMin: 0.008, sizeMax: 0.02,
      spread: 0.12 + progress * 0.1, upBias: 1.0,
      colors: ctx.objColors
    });
  }

  // Ooze blobs — soft material squeezing out sideways
  if (progress > 0.15 && delta > 0.006 && Math.random() < 0.4) {
    var angle = Math.random() * Math.PI * 2;
    var oozeColor = ctx.objColors.length > 1 ? ctx.objColors[1] : ctx.objColor;
    var frag = createFragment(
      new THREE.Vector3(Math.cos(angle) * ctx.objRadius * 0.3, ctx.contactY - 0.01, Math.sin(angle) * ctx.objRadius * 0.3),
      oozeColor, 0.01 + Math.random() * 0.015, 'droplet'
    );
    frag.userData.vel.set(
      Math.cos(angle) * (1 + Math.random() * 2), -0.2,
      Math.sin(angle) * (1 + Math.random() * 2)
    );
    frag.userData.life = 2.0;
    ctx.totalFrags++;
  }
}

// --- SHATTER: Brief freeze/tension, then explosive breakup with varied sizes ---
function crushShatter(obj, progress, ctx, delta) {
  if (!ctx.shatterPhase) ctx.shatterPhase = 'tension';

  if (ctx.shatterPhase === 'tension' && progress < 0.3) {
    // Tension build — object trembles with increasing intensity, barely moves
    var shake = progress * progress * 0.02;
    obj.position.x = (Math.random() - 0.5) * shake;
    obj.position.z = (Math.random() - 0.5) * shake;
    // Slight compression
    obj.scale.y = 1 - progress * 0.05;
    // Occasional stress creak fragment
    if (delta > 0.01 && Math.random() < 0.2 && ctx.totalFrags < 120) {
      spawnProgressiveFragments(ctx, 1, {
        velScale: 0.3, sizeMin: 0.003, sizeMax: 0.008,
        spread: 0.05, upBias: 1.0,
        colors: ctx.objColors, maxFrags: 120
      });
    }
  } else if (ctx.shatterPhase === 'tension') {
    // Transition to explosive breakup
    ctx.shatterPhase = 'explode';
    ctx.shatterStart = progress;
  }

  if (ctx.shatterPhase === 'explode') {
    // Dramatic explosion — object shatters with varied fragment sizes
    var explodeProg = (progress - ctx.shatterStart) / (1 - ctx.shatterStart);
    var shake2 = 0.01 * (1 - explodeProg);
    obj.position.x = (Math.random() - 0.5) * shake2;
    obj.position.z = (Math.random() - 0.5) * shake2;

    if (progress > 0.85) obj.visible = false;

    if (delta > 0.003) {
      // Burst of varied-size shards
      var count = Math.max(2, Math.ceil(delta * 40 * (1.5 - explodeProg)));
      for (var si = 0; si < count && ctx.totalFrags < 120; si++) {
        var angle = Math.random() * Math.PI * 2;
        var sizeRoll = Math.random();
        // Varied sizes: mostly small, some medium, rare large
        var size = sizeRoll < 0.6 ? (0.004 + Math.random() * 0.01) :
                   sizeRoll < 0.9 ? (0.015 + Math.random() * 0.02) :
                   (0.03 + Math.random() * 0.025);
        var speed = (3 + Math.random() * 6) * (1.5 - explodeProg * 0.5);
        var color = ctx.objColors[Math.floor(Math.random() * ctx.objColors.length)];
        var frag = createFragment(
          new THREE.Vector3(
            Math.cos(angle) * 0.04, ctx.contactY + (Math.random() - 0.5) * 0.04,
            Math.sin(angle) * 0.04
          ), color, size
        );
        frag.userData.vel.set(
          Math.cos(angle) * speed, Math.random() * 0.4,
          Math.sin(angle) * speed
        );
        ctx.totalFrags++;
      }
    }
  }
}

// --- CRUMPLE: Asymmetric denting inward at random points + metal flakes ---
function crushCrumple(obj, progress, ctx, delta) {
  // Initialize random dent points for asymmetric deformation
  if (!ctx.dentPoints) {
    ctx.dentPoints = [];
    for (var di = 0; di < 3 + Math.floor(Math.random() * 3); di++) {
      ctx.dentPoints.push({
        angle: Math.random() * Math.PI * 2,
        strength: 0.5 + Math.random() * 0.5,
        phase: Math.random() * Math.PI * 2
      });
    }
    ctx.crumpleTwist = (Math.random() - 0.5) * 0.4;
  }

  // Asymmetric bulging/denting — different sides deform differently
  var dentX = 0, dentZ = 0;
  for (var d = 0; d < ctx.dentPoints.length; d++) {
    var dp = ctx.dentPoints[d];
    var dentActive = Math.max(0, (progress - 0.1 * d / ctx.dentPoints.length));
    dentX += Math.cos(dp.angle) * dp.strength * dentActive * 0.15;
    dentZ += Math.sin(dp.angle) * dp.strength * dentActive * 0.15;
  }
  obj.scale.x = 1 + dentX + Math.sin(progress * 9) * 0.1 * progress;
  obj.scale.z = 1 + dentZ + Math.cos(progress * 7) * 0.08 * progress;

  // Progressive twist as metal buckles
  obj.rotation.z = Math.sin(progress * 5) * 0.15 * progress + ctx.crumpleTwist * progress;
  obj.rotation.x = Math.cos(progress * 3.5) * 0.1 * progress;

  // Sudden micro-shifts (metal popping/buckling)
  if (Math.random() < progress * 0.15) {
    obj.position.x += (Math.random() - 0.5) * 0.006;
    obj.position.z += (Math.random() - 0.5) * 0.006;
  }

  // Deform individual children — parts dent inward
  if (progress > 0.2) {
    obj.children.forEach(function(child, i) {
      if (child.isMesh) {
        var dentAmt = Math.sin(progress * 4 + i * 2.1) * progress * 0.04;
        child.position.x += dentAmt * (i % 2 ? 1 : -1);
      }
    });
  }

  if (delta > 0.008) {
    var count = Math.max(1, Math.ceil(delta * 10));
    spawnProgressiveFragments(ctx, count, {
      velScale: 1.2, sizeMin: 0.005, sizeMax: 0.018,
      spread: 0.1, upBias: 1.8,
      colors: ctx.objColors, maxFrags: 60
    });
  }
}

// --- SPLAT: Wet spread + arcing juice droplets + dripping streams ---
function crushSplat(obj, progress, ctx, delta) {
  var spreadAmt = 1 + progress * 1.0;
  obj.scale.x = spreadAmt + Math.sin(progress * 12) * 0.05;
  obj.scale.z = spreadAmt - Math.sin(progress * 12) * 0.05;

  if (delta > 0.006) {
    var count = Math.max(1, Math.ceil(delta * 15));
    spawnProgressiveFragments(ctx, count, {
      velScale: 1.0, sizeMin: 0.005, sizeMax: 0.02,
      spread: 0.15 + progress * 0.15, upBias: 0.6,
      colors: [ctx.objColor], maxFrags: 100
    });
  }

  var juiceColor = ctx.objColors.length > 1 ? ctx.objColors[1] : ctx.objColor;
  if (delta > 0.005 && progress > 0.05 && ctx.totalFrags < 100) {
    var dropletCount = Math.min(3, Math.ceil(delta * 25 * progress));
    for (var di = 0; di < dropletCount && ctx.totalFrags < 100; di++) {
      var angle = Math.random() * Math.PI * 2;
      var frag = createFragment(
        new THREE.Vector3(
          Math.cos(angle) * ctx.objRadius * progress * 0.5,
          ctx.contactY - Math.random() * 0.02,
          Math.sin(angle) * ctx.objRadius * progress * 0.5
        ), juiceColor, 0.002 + Math.random() * 0.006, 'droplet'
      );
      var speed = 3 + Math.random() * 5;
      frag.userData.vel.set(Math.cos(angle) * speed, 0.2 + Math.random() * 0.5, Math.sin(angle) * speed);
      frag.userData.life = 1.8;
      ctx.totalFrags++;
    }
  }

  if (progress > 0.3 && delta > 0.008 && Math.random() < 0.3 && ctx.totalFrags < 100) {
    var dripAngle = Math.random() * Math.PI * 2;
    var dripFrag = createFragment(
      new THREE.Vector3(Math.cos(dripAngle) * ctx.objRadius * 0.4, ctx.contactY + 0.02, Math.sin(dripAngle) * ctx.objRadius * 0.4),
      juiceColor, 0.01 + Math.random() * 0.01, 'droplet'
    );
    dripFrag.userData.vel.set(Math.cos(dripAngle) * 0.5, -1.0 + Math.random() * 0.3, Math.sin(dripAngle) * 0.5);
    dripFrag.userData.life = 2.5;
    ctx.totalFrags++;
  }
}

// --- POP: Visible pressure bulge, small leaks, then explosive burst ---
function crushPop(obj, progress, ctx, delta) {
  if (!ctx.popped && progress < 0.45) {
    // Object bulges outward under pressure before popping
    var bulge = 1 + Math.sin(progress * Math.PI / 0.45) * 0.25;
    var compress = 1 - progress * 0.15;
    obj.scale.set(bulge, compress, bulge);

    // Increasing tremor as pressure builds
    if (progress > 0.1) {
      var t = (progress - 0.1) / 0.35;
      var shake = t * t * 0.008;
      obj.position.x = (Math.random() - 0.5) * shake;
      obj.position.z = (Math.random() - 0.5) * shake;
    }

    // Small leak jets escape from sides under pressure
    if (delta > 0.008 && progress > 0.15 && Math.random() < 0.4) {
      var leakAngle = Math.random() * Math.PI * 2;
      var leakFrag = createFragment(
        new THREE.Vector3(Math.cos(leakAngle) * ctx.objRadius * 0.3, ctx.contactY - ctx.objHeight * 0.2, Math.sin(leakAngle) * ctx.objRadius * 0.3),
        ctx.objColors[Math.floor(Math.random() * ctx.objColors.length)], 0.003 + Math.random() * 0.006, 'droplet'
      );
      leakFrag.userData.vel.set(Math.cos(leakAngle) * (2 + Math.random() * 3), 0.1, Math.sin(leakAngle) * (2 + Math.random() * 3));
      leakFrag.userData.life = 1.0;
      ctx.totalFrags++;
    }
  } else if (!ctx.popped) {
    ctx.popped = true;
    obj.visible = false;

    // Explosive burst with varied fragment sizes
    for (var i = 0; i < 30 && ctx.totalFrags < 100; i++) {
      var angle = Math.random() * Math.PI * 2;
      var elev = (Math.random() - 0.3) * Math.PI;
      var speed = 5 + Math.random() * 7;
      var color = ctx.objColors[Math.floor(Math.random() * ctx.objColors.length)];
      var sizeRoll = Math.random();
      var fragSize = sizeRoll < 0.5 ? (0.005 + Math.random() * 0.01) :
                     sizeRoll < 0.85 ? (0.015 + Math.random() * 0.02) : (0.03 + Math.random() * 0.02);
      var frag = createFragment(
        new THREE.Vector3(
          (Math.random() - 0.5) * 0.06,
          ctx.contactY + (Math.random() - 0.5) * ctx.objHeight * 0.3,
          (Math.random() - 0.5) * 0.06
        ), color, fragSize
      );
      frag.userData.vel.set(
        Math.cos(angle) * Math.cos(elev) * speed,
        Math.max(-0.5, Math.sin(elev) * speed * 0.2),
        Math.sin(angle) * Math.cos(elev) * speed
      );
      ctx.totalFrags++;
    }
  }
}

// --- CRACK: Propagating crack lines that widen, then clean split ---
function crushCrack(obj, progress, ctx, delta) {
  if (!ctx.crackOrigins) {
    ctx.crackOrigins = [];
    var numCr = 2 + Math.floor(Math.random() * 3);
    for (var ci = 0; ci < numCr; ci++) {
      ctx.crackOrigins.push({
        ang: (ci / numCr) * Math.PI * 2 + (Math.random() - 0.5) * 0.5,
        startP: 0.08 + Math.random() * 0.15,
        branch: (Math.random() - 0.5) * 0.8
      });
    }
  }
  var h = ctx.objHeight;
  for (var oi = 0; oi < ctx.crackOrigins.length; oi++) {
    var org = ctx.crackOrigins[oi];
    if (progress < org.startP) continue;
    var crP = Math.min(1, (progress - org.startP) / 0.5);
    var expCr = Math.floor(crP * 4);
    var existCr = 0;
    for (var ck = 0; ck < ctx.crackMeshes.length; ck++) {
      if (ctx.crackMeshes[ck].userData.crOi === oi) existCr++;
    }
    if (existCr < expCr) {
      var segLen = h * (0.15 + crP * 0.25);
      var cw = 0.002 + crP * 0.004;
      var crG = new THREE.BoxGeometry(cw, segLen, cw);
      var crMa = new THREE.MeshStandardMaterial({
        color: 0x111111, roughness: 0.9, metalness: 0,
        clippingPlanes: [ctx.clipPlane], clipShadows: true
      });
      var crMe = new THREE.Mesh(crG, crMa);
      var offR = existCr * 0.015;
      crMe.position.set(Math.cos(org.ang) * (0.01 + offR), h * 0.1 + existCr * h * 0.1, Math.sin(org.ang) * (0.01 + offR));
      crMe.rotation.z = (Math.random() - 0.5) * 0.4 + org.branch * existCr * 0.3;
      crMe.rotation.y = org.ang + Math.PI / 2;
      crMe.userData.crOi = oi;
      obj.add(crMe);
      ctx.crackMeshes.push(crMe);
    }
  }
  if (delta > 0.008) {
    var count = Math.max(1, Math.ceil(delta * 10));
    spawnProgressiveFragments(ctx, count, {
      velScale: 1.3, sizeMin: 0.01, sizeMax: 0.035,
      spread: 0.08, upBias: 2.0,
      colors: ctx.objColors, maxFrags: 70
    });
  }
  if (progress > 0.4) {
    var splitAmt = (progress - 0.4) * 0.002;
    obj.children.forEach(function(child, i) {
      if (child.userData.crOi === undefined) {
        child.position.x += (i % 2 ? 1 : -1) * splitAmt;
        child.position.z += (i % 3 ? 0.5 : -0.5) * splitAmt * 0.3;
      }
    });
  }
}

// --- CRUSH: Resistance then accelerating fragmentation ---
function crushCrush(obj, progress, ctx, delta) {
  // Slight spread
  var t = progress < 0.35 ? progress * 0.4 : 0.14 + (progress - 0.35) * 1.32;
  t = Math.min(t, 1);
  obj.scale.x = 1 + t * 0.25;
  obj.scale.z = 1 + t * 0.25;

  if (progress > 0.15 && progress < 0.4) {
    obj.position.x = (Math.random() - 0.5) * 0.003;
    obj.position.z = (Math.random() - 0.5) * 0.003;
  }

  if (delta > 0.006) {
    var intensity = progress < 0.35 ? 0.3 : 1.0;
    var count = Math.max(1, Math.ceil(delta * 15 * intensity));
    spawnProgressiveFragments(ctx, count, {
      velScale: 0.8 + intensity * 0.7, sizeMin: 0.008, sizeMax: 0.025,
      spread: 0.1, upBias: 1.5,
      colors: ctx.objColors, maxFrags: 80
    });
  }
}

// --- FOLD: Paper-like crumpling with visible creases ---
function crushFold(obj, progress, ctx, delta) {
  if (!ctx.foldCreases) {
    ctx.foldCreases = [];
    var numCreases = 3 + Math.floor(Math.random() * 3);
    for (var fi = 0; fi < numCreases; fi++) {
      ctx.foldCreases.push({
        axis: Math.random() > 0.5 ? 'x' : 'z',
        dir: Math.random() > 0.5 ? 1 : -1,
        startP: 0.1 + fi * 0.12,
        strength: 0.3 + Math.random() * 0.5
      });
    }
  }

  if (progress > 0.1) {
    obj.children.forEach(function(child, i) {
      var totalFold = 0, totalTwist = 0;
      for (var fc = 0; fc < ctx.foldCreases.length; fc++) {
        var crease = ctx.foldCreases[fc];
        if (progress < crease.startP) continue;
        var foldP = Math.min(1, (progress - crease.startP) / 0.4);
        var childInfl = Math.sin((i + fc) * 1.7) * 0.5 + 0.5;
        if (crease.axis === 'x') {
          totalFold += crease.dir * foldP * crease.strength * childInfl * 0.04;
        } else {
          totalTwist += crease.dir * foldP * crease.strength * childInfl * 0.03;
        }
      }
      child.rotation.x += totalFold;
      child.rotation.z += totalTwist;
      if (progress > 0.3) {
        child.position.y -= (progress - 0.3) * 0.003 * (i % 2 ? 1 : 0.5);
      }
    });
  }

  if (delta > 0.01) {
    var count = Math.max(1, Math.ceil(delta * 8));
    spawnProgressiveFragments(ctx, count, {
      velScale: 0.5, sizeMin: 0.005, sizeMax: 0.015,
      spread: 0.1, upBias: 0.8,
      colors: ctx.objColors, maxFrags: 50
    });
  }
}

// --- MELT: Visible dripping, pooling on platform, material softening ---
function crushMelt(obj, progress, ctx, delta) {
  if (!ctx.meltPools) ctx.meltPools = [];

  obj.scale.x = 1 + progress * 0.6;
  obj.scale.z = 1 + progress * 0.6;

  obj.traverse(function(child) {
    if (child.isMesh && child.material && child.material.color) {
      if (!child.userData.origColor) {
        child.userData.origColor = child.material.color.clone();
      }
      child.material.color.copy(child.userData.origColor).multiplyScalar(1 - progress * 0.35);
      if (child.material.roughness !== undefined) {
        child.material.roughness = Math.max(0.1, 0.7 - progress * 0.6);
      }
    }
  });

  // Dripping streams with elongated droplets
  if (delta > 0.006 && ctx.dripped < 50) {
    var angle = Math.random() * Math.PI * 2;
    var dripR = 0.05 + progress * 0.12;
    var frag = createFragment(
      new THREE.Vector3(Math.cos(angle) * dripR, ctx.contactY, Math.sin(angle) * dripR),
      ctx.objColor, 0.006 + Math.random() * 0.01, 'droplet'
    );
    frag.userData.vel.set(
      Math.cos(angle) * (0.3 + Math.random() * 0.7), -0.8 + Math.random() * 0.2,
      Math.sin(angle) * (0.3 + Math.random() * 0.7)
    );
    frag.userData.life = 2.5;
    ctx.dripped++;
    ctx.totalFrags++;
  }

  // Pool puddles on platform
  if (progress > 0.3 && ctx.meltPools.length < 5 && Math.random() < delta * 3) {
    var poolAngle = Math.random() * Math.PI * 2;
    var poolR = 0.03 + Math.random() * 0.04;
    var poolGeom = new THREE.CircleGeometry(poolR, 8);
    var poolColor = new THREE.Color(ctx.objColor).multiplyScalar(0.8);
    var poolMat = new THREE.MeshStandardMaterial({
      color: poolColor, roughness: 0.1, metalness: 0.1, side: THREE.DoubleSide
    });
    var pool = new THREE.Mesh(poolGeom, poolMat);
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(Math.cos(poolAngle) * (0.1 + progress * 0.15), PLATFORM_TOP + 0.001, Math.sin(poolAngle) * (0.1 + progress * 0.15));
    pool.userData.life = 3.0;
    scene.add(pool);
    ctx.meltPools.push(pool);
    fragments.push(pool);
  }

  for (var pi = 0; pi < ctx.meltPools.length; pi++) {
    var p = ctx.meltPools[pi];
    if (p.scale.x < 2.0) p.scale.setScalar(p.scale.x + delta * 0.3);
  }
}

// --- SNAP: More dramatic — stress builds, pieces fly apart with spin ---
function crushSnap(obj, progress, ctx, delta) {
  if (!ctx.snapped && progress < 0.4) {
    if (progress > 0.1) {
      var t = (progress - 0.1) / 0.3;
      var shake = t * t * 0.006;
      obj.position.x = (Math.random() - 0.5) * shake;
      obj.position.z = (Math.random() - 0.5) * shake;
      obj.rotation.z = Math.sin(progress * 20) * t * 0.03;
    }

    if (delta > 0.012 && progress > 0.2) {
      spawnProgressiveFragments(ctx, 1, {
        velScale: 1.5, sizeMin: 0.003, sizeMax: 0.01,
        spread: 0.05, upBias: 2.0,
        colors: ctx.objColors, maxFrags: 60
      });
    }
  } else if (!ctx.snapped) {
    ctx.snapped = true;
    obj.visible = false;

    var worldPos = new THREE.Vector3();
    obj.getWorldPosition(worldPos);

    for (var side = -1; side <= 1; side += 2) {
      var halfGroup = new THREE.Group();
      halfGroup.position.copy(worldPos);

      obj.traverse(function(child) {
        if (child.isMesh) {
          var clone = child.clone();
          clone.material = child.material.clone();
          clone.material.clippingPlanes = [];
          clone.position.x += side * 0.02;
          clone.scale.x *= 0.5;
          halfGroup.add(clone);
        }
      });

      halfGroup.userData.rotDir = side;
      halfGroup.userData.slideDir = side;
      halfGroup.userData.spinVel = (Math.random() - 0.5) * 3 * side;
      halfGroup.userData.lateralVel = side * (0.015 + Math.random() * 0.01);
      halfGroup.userData.life = 3.0;
      scene.add(halfGroup);
      ctx.halves.push(halfGroup);
    }

    for (var i = 0; i < 15; i++) {
      var sAngle = Math.random() * Math.PI * 2;
      var sFrag = createFragment(
        new THREE.Vector3(
          worldPos.x + (Math.random() - 0.5) * 0.04,
          ctx.contactY + (Math.random() - 0.5) * 0.05,
          worldPos.z + (Math.random() - 0.5) * 0.04
        ), ctx.objColor, 0.004 + Math.random() * 0.015
      );
      sFrag.userData.vel.set(
        Math.cos(sAngle) * (3 + Math.random() * 4), Math.random() * 0.3,
        Math.sin(sAngle) * (3 + Math.random() * 4)
      );
      sFrag.userData.rotVel.multiplyScalar(2);
      ctx.totalFrags++;
    }
  }

  if (ctx.snapped && ctx.halves.length > 0) {
    var snapProg = Math.min((progress - 0.4) / 0.6, 1);
    ctx.halves.forEach(function(half) {
      var velDecay = Math.max(0.1, 1 - snapProg);
      half.position.x += (half.userData.lateralVel || half.userData.slideDir * 0.004) * velDecay;
      half.rotation.z += (half.userData.spinVel || half.userData.rotDir * 0.75) * 0.016 * velDecay;
      half.position.y -= 0.003;
      if (half.position.y < PLATFORM_TOP + 0.05) {
        half.position.y = PLATFORM_TOP + 0.05;
        if (half.userData.spinVel) half.userData.spinVel *= 0.7;
      }
      if (half.position.y > pressCeilingY - 0.05) half.position.y = pressCeilingY - 0.05;
    });

    if (delta > 0.01 && snapProg < 0.8) {
      spawnProgressiveFragments(ctx, 2, {
        velScale: 1.0, sizeMin: 0.004, sizeMax: 0.015,
        spread: 0.15, upBias: 1.5,
        colors: ctx.objColors, maxFrags: 60
      });
    }
  }
}

// ═══════════════════════════════════════════════════
// 9. PARTICLE SYSTEM
// ═══════════════════════════════════════════════════
const PARTICLE_POOL_SIZE = 200;
const particlePool = [];
const activeParticles = [];
const activeSparks = [];

function initParticlePool() {
  const geo = new THREE.SphereGeometry(0.03, 4, 4);
  for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.visible = false;
    mesh.userData.vel = new THREE.Vector3();
    mesh.userData.life = 0;
    mesh.userData.maxLife = 1.5;
    mesh.userData.active = false;
    scene.add(mesh);
    particlePool.push(mesh);
  }
}

function getParticle() {
  for (let i = 0; i < particlePool.length; i++) {
    if (!particlePool[i].userData.active) {
      particlePool[i].userData.active = true;
      particlePool[i].visible = true;
      return particlePool[i];
    }
  }
  return null;
}

function releaseParticle(p) {
  p.visible = false;
  p.userData.active = false;
  p.userData.life = 0;
}

function spawnParticles(pos, color, count, spread, opts) {
  spread = spread || 0.5;
  opts = opts || {};
  for (let i = 0; i < count; i++) {
    var p = getParticle();
    if (!p) break;
    p.position.set(
      pos.x + (Math.random() - 0.5) * spread * 0.3,
      pos.y + (Math.random() - 0.5) * spread * 0.3,
      pos.z + (Math.random() - 0.5) * spread * 0.3
    );
    p.material.color.set(color);
    // Varied particle sizes
    var sizeVariation = 0.5 + Math.random() * 1.5;
    p.userData.baseScale = sizeVariation;
    // Elongated droplets for wet objects
    if (opts.elongated) {
      p.scale.set(sizeVariation * 0.5, sizeVariation * 1.5, sizeVariation * 0.5);
    } else {
      p.scale.setScalar(sizeVariation);
    }
    p.userData.vel.set(
      (Math.random() - 0.5) * spread * 5,
      Math.random() * 0.4,
      (Math.random() - 0.5) * spread * 5
    );
    p.userData.life = 1.5;
    p.userData.maxLife = 1.5;
    activeParticles.push(p);
  }
}

// Spawn a dust cloud effect for stone/concrete/wood objects
function spawnDustCloud(pos, color, intensity) {
  intensity = intensity || 1;
  var dustColor = new THREE.Color(color).lerp(new THREE.Color(0xccccbb), 0.6);
  var count = Math.ceil(6 * intensity);
  for (var i = 0; i < count; i++) {
    var p = getParticle();
    if (!p) break;
    var angle = Math.random() * Math.PI * 2;
    var r = Math.random() * 0.15;
    p.position.set(pos.x + Math.cos(angle) * r, pos.y + Math.random() * 0.05, pos.z + Math.sin(angle) * r);
    p.material.color.set(dustColor);
    p.material.opacity = 0.4;
    p.material.transparent = true;
    // Dust rises slowly and spreads
    p.userData.baseScale = 1.5 + Math.random() * 2;
    p.scale.setScalar(p.userData.baseScale);
    p.userData.vel.set(
      (Math.random() - 0.5) * 1.5, 0.3 + Math.random() * 0.5, (Math.random() - 0.5) * 1.5
    );
    p.userData.life = 2.0;
    p.userData.maxLife = 2.0;
    p.userData.isDust = true;
    activeParticles.push(p);
  }
}

function spawnSparks(pos, count) {
  for (let i = 0; i < count; i++) {
    var p = getParticle();
    if (!p) break;
    p.position.copy(pos);
    var col = Math.random() > 0.5 ? 0xffaa00 : 0xffdd44;
    p.material.color.set(col);
    p.userData.vel.set(
      (Math.random() - 0.5) * 10,
      Math.random() * 0.5,
      (Math.random() - 0.5) * 10
    );
    p.userData.life = 0.6;
    p.userData.maxLife = 0.6;
    activeSparks.push(p);
  }
}

function updateParticles(delta) {
  // Update active particles
  for (var i = activeParticles.length - 1; i >= 0; i--) {
    var p = activeParticles[i];
    p.userData.vel.y -= 9.8 * delta;
    p.position.x += p.userData.vel.x * delta;
    p.position.y += p.userData.vel.y * delta;
    p.position.z += p.userData.vel.z * delta;
    p.userData.life -= delta;
    // Bounce off press head ceiling
    if (p.position.y > pressCeilingY - 0.02) {
      p.position.y = pressCeilingY - 0.02;
      p.userData.vel.y = -Math.abs(p.userData.vel.y) * 0.2;
    }
    // Bounce off floor
    if (p.position.y < PLATFORM_TOP) {
      p.position.y = PLATFORM_TOP;
      p.userData.vel.y = Math.abs(p.userData.vel.y) * 0.3;
      p.userData.vel.x *= 0.7;
      p.userData.vel.z *= 0.7;
    }
    var ratio = Math.max(0, p.userData.life / p.userData.maxLife);
    var baseS = p.userData.baseScale || 1;
    if (p.userData.isDust) {
      // Dust particles expand as they fade
      p.scale.setScalar(baseS * (1.5 - ratio * 0.5) * ratio);
      p.material.opacity = ratio * 0.4;
    } else {
      p.scale.setScalar(ratio * baseS);
    }
    if (p.userData.life <= 0) {
      if (p.userData.isDust) {
        p.material.opacity = 1;
        p.material.transparent = false;
        p.userData.isDust = false;
      }
      p.userData.baseScale = 1;
      releaseParticle(p);
      activeParticles.splice(i, 1);
    }
  }
  // Update sparks
  for (var j = activeSparks.length - 1; j >= 0; j--) {
    var s = activeSparks[j];
    s.userData.vel.y -= 9.8 * delta;
    s.position.x += s.userData.vel.x * delta;
    s.position.y += s.userData.vel.y * delta;
    s.position.z += s.userData.vel.z * delta;
    s.userData.life -= delta;
    // Bounce off press head ceiling
    if (s.position.y > pressCeilingY - 0.02) {
      s.position.y = pressCeilingY - 0.02;
      s.userData.vel.y = -Math.abs(s.userData.vel.y) * 0.2;
    }
    if (s.position.y < PLATFORM_Y + 0.15) {
      s.position.y = PLATFORM_Y + 0.15;
      s.userData.vel.y = Math.abs(s.userData.vel.y) * 0.2;
    }
    var sRatio = Math.max(0, s.userData.life / s.userData.maxLife);
    s.scale.setScalar(sRatio);
    if (s.userData.life <= 0) {
      releaseParticle(s);
      activeSparks.splice(j, 1);
    }
  }
  // Update fragments with friction, drag, and angular momentum
  for (var k = fragments.length - 1; k >= 0; k--) {
    var f = fragments[k];
    if (!f.userData) { fragments.splice(k, 1); continue; }
    // Gravity
    f.userData.vel.y -= 9.8 * delta;
    // Air drag — slows fragments realistically
    var speed = f.userData.vel.length();
    if (speed > 0.1) {
      var dragFactor = 1 - Math.min(0.95, 2.0 * delta);
      f.userData.vel.multiplyScalar(dragFactor);
    }
    // Rotational drag
    f.userData.rotVel.multiplyScalar(1 - 1.5 * delta);
    // Integrate position
    f.position.x += f.userData.vel.x * delta;
    f.position.y += f.userData.vel.y * delta;
    f.position.z += f.userData.vel.z * delta;
    f.rotation.x += f.userData.rotVel.x * delta;
    f.rotation.y += f.userData.rotVel.y * delta;
    f.rotation.z += f.userData.rotVel.z * delta;
    // Bounce off press head ceiling
    if (f.position.y > pressCeilingY - 0.03) {
      f.position.y = pressCeilingY - 0.03;
      f.userData.vel.y = -Math.abs(f.userData.vel.y) * 0.15;
      f.userData.vel.x *= 1.2;  // Deflect sideways when hitting ceiling
      f.userData.vel.z *= 1.2;
      // Spin changes on ceiling hit
      f.userData.rotVel.x += (Math.random() - 0.5) * 4;
      f.userData.rotVel.z += (Math.random() - 0.5) * 4;
    }
    // Floor bounce with friction and spin transfer
    if (f.position.y < PLATFORM_TOP) {
      f.position.y = PLATFORM_TOP;
      f.userData.bounceCount = (f.userData.bounceCount || 0) + 1;
      var bounceDamp = Math.max(0.05, 0.35 - f.userData.bounceCount * 0.06);
      f.userData.vel.y = Math.abs(f.userData.vel.y) * bounceDamp;
      // Ground friction — fragments slow and scatter
      f.userData.vel.x *= 0.6;
      f.userData.vel.z *= 0.6;
      // Transfer some linear velocity into spin on bounce
      f.userData.rotVel.x += f.userData.vel.z * 2;
      f.userData.rotVel.z -= f.userData.vel.x * 2;
      // Stop bouncing after enough hits — settle on platform
      if (f.userData.bounceCount > 4 && Math.abs(f.userData.vel.y) < 0.3) {
        f.userData.vel.y = 0;
        f.userData.rotVel.multiplyScalar(0.3);
      }
    }
    // Keep fragments on/near platform surface (prevent escape)
    var distFromCenter = Math.sqrt(f.position.x * f.position.x + f.position.z * f.position.z);
    if (distFromCenter > 2.5) {
      f.userData.vel.x *= -0.2;
      f.userData.vel.z *= -0.2;
    }
    f.userData.life -= delta;
    if (f.userData.life <= 0) {
      scene.remove(f);
      if (f.geometry) f.geometry.dispose();
      if (f.material) f.material.dispose();
      fragments.splice(k, 1);
    }
  }
}

// ═══════════════════════════════════════════════════
// 10. PRESS MECHANICS
// ═══════════════════════════════════════════════════
var crushFrameCounter = 0;

function beginHold() {
  if (isRetracting || !currentObject) return;
  isHolding = true;
  crushSoundPlayed = false;
  crushCtx = {};
  var btn = document.getElementById('press-btn');
  if (btn) btn.classList.add('holding');
  initAudio();
  playHydraulicPump();
  var statusEl = document.getElementById('status-text');
  if (statusEl) statusEl.textContent = 'PRESSEN...';
}

function endHold() {
  isHolding = false;
  var btn = document.getElementById('press-btn');
  if (btn) btn.classList.remove('holding');
  if (pressProgress > 0 && pressProgress < 1) {
    startRetract();
  }
}

function updatePress(delta) {
  crushFrameCounter++;

  if (isHolding && pressProgress < 1 && currentObject) {
    var objHeight = currentObject.userData.height || 0.5;
    var objTop = OBJ_Y + objHeight;
    // Head bottom = pistonGroup.y + local(-2.05 - 0.11) = pistonGroup.y - 2.16
    var HEAD_OFFSET = 2.16;
    var headStart = PISTON_START_Y - HEAD_OFFSET;

    // Calculate at which pressProgress the head touches the object top
    var contactStartP = Math.max(0, (headStart - objTop) / PISTON_TRAVEL);

    // Two-phase speed: fast approach until contact, then slow crush
    var headY_pre = PISTON_START_Y - pressProgress * PISTON_TRAVEL - HEAD_OFFSET;
    var speed;
    if (headY_pre > objTop + 0.01) {
      // Fast descent — press hasn't touched object yet
      speed = PRESS_SPEED;
    } else {
      // Slow crush through object — visible progressive animation
      speed = CRUSH_SPEED * (0.6 + pressProgress * 0.5);
    }
    pressProgress = Math.min(1, pressProgress + speed);

    // Move piston down (head moves with it as child — no separate override)
    pistonGroup.position.y = PISTON_START_Y - pressProgress * PISTON_TRAVEL;

    // Update fill bar — show contact-based progress for more feedback
    var fillBar = document.getElementById('fill-bar');

    // Calculate contact — head bottom in world space
    var headY = pistonGroup.position.y - HEAD_OFFSET;
    pressCeilingY = headY;  // Update ceiling for particle clamping
    var contactRange = objHeight;
    var contactProgress = 0;
    if (contactRange > 0) {
      contactProgress = Math.max(0, 1 - (headY - OBJ_Y) / contactRange);
    }
    contactProgress = Math.min(1, contactProgress);

    if (fillBar) fillBar.style.width = (contactProgress * 100) + '%';

    if (contactProgress > 0.04 && currentObject) {
      applyCrush(currentObject, contactProgress, crushCtx);

      // Spawn particles periodically during crush
      if (crushFrameCounter % 3 === 0) {
        var objData = getObjData(selectedObjId);
        var pColor = objData && objData.p && objData.p.c ? objData.p.c : 0xff4444;
        var crushSound = objData ? objData.sound : 'soft';
        var isWet = crushSound === 'wet' || crushSound === 'squish';
        spawnParticles(
          new THREE.Vector3(
            (Math.random() - 0.5) * 0.3,
            OBJ_Y + objHeight * (1 - contactProgress),
            (Math.random() - 0.5) * 0.3
          ),
          pColor,
          2,
          0.3,
          { elongated: isWet }
        );
        // Dust cloud for stone/concrete/wood objects
        var isDusty = objData && (objData.cat === 'stone' || objData.cat === 'wood');
        if (isDusty && crushFrameCounter % 9 === 0) {
          spawnDustCloud(
            new THREE.Vector3(0, OBJ_Y + objHeight * (1 - contactProgress), 0),
            pColor, contactProgress
          );
        }
      }

      // Shake increases with contact
      shakeAmount = contactProgress * 0.03;
    }

    // Play crush sound when contact starts
    if (contactProgress > 0.1 && !crushSoundPlayed) {
      var objData2 = getObjData(selectedObjId);
      var soundProfile = (objData2 && objData2.sound) ? objData2.sound : 'soft';
      var soundParams = (objData2 && objData2.sp) ? objData2.sp : null;
      playCrushSound(soundProfile, contactProgress, soundParams);
      crushSoundPlayed = true;
    }

    // Crush complete when object is fully consumed (not when piston maxes out)
    if (contactProgress >= 0.97) {
      crushComplete();
    }
  }

  if (isRetracting) {
    pressProgress = Math.max(0, pressProgress - 0.012);
    pistonGroup.position.y = PISTON_START_Y - pressProgress * PISTON_TRAVEL;
    pressCeilingY = pistonGroup.position.y - HEAD_OFFSET;
    var fillBar2 = document.getElementById('fill-bar');
    if (fillBar2) fillBar2.style.width = '0%';

    if (pressProgress <= 0) {
      isRetracting = false;
      pressProgress = 0;
      var statusEl2 = document.getElementById('status-text');
      if (statusEl2) statusEl2.textContent = 'BEREIT';
      var btn2 = document.getElementById('press-btn');
      if (btn2) btn2.classList.remove('disabled');
      // Spawn new object
      spawnObject(selectedObjId);
    }
  }

  // Camera shake
  if (shakeAmount > 0.001) {
    camera.position.x += (Math.random() - 0.5) * shakeAmount;
    camera.position.y += (Math.random() - 0.5) * shakeAmount;
    shakeAmount *= 0.92;
  }

  // Update gauge display
  drawGauge(pressProgress * 800);

}

function crushComplete() {
  isHolding = false;
  var btn = document.getElementById('press-btn');
  if (btn) btn.classList.remove('holding');

  var objData = getObjData(selectedObjId);
  var reward = (objData && objData.reward) ? objData.reward : 10;
  addCoins(reward);

  // Update crush count
  crushCount = economy.totalCrushed;
  var crushEl = document.getElementById('crush-count');
  if (crushEl) crushEl.textContent = crushCount;

  // Show floating coin reward
  showCoinReward(reward);

  // Update coin display
  var coinEl = document.getElementById('coin-amount');
  if (coinEl) coinEl.textContent = economy.coins;

  // Final impact burst (smaller since progressive fragmentation already spawned pieces)
  var burstPos = new THREE.Vector3(0, OBJ_Y + 0.05, 0);
  var pColor = (objData && objData.p && objData.p.color) ? objData.p.color : 0xff4444;
  spawnParticles(burstPos, pColor, 15, 0.6);
  spawnSparks(burstPos, 10);

  // Clean up snap halves if any
  if (crushCtx && crushCtx.halves) {
    crushCtx.halves.forEach(function(half) {
      scene.remove(half);
      half.traverse(function(child) {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(function(m) { m.clippingPlanes = []; m.dispose(); });
          } else {
            child.material.clippingPlanes = [];
            child.material.dispose();
          }
        }
      });
    });
  }

  // Clean up cross-section disc
  if (crushCtx && crushCtx.crossSection) {
    scene.remove(crushCtx.crossSection);
    crushCtx.crossSection.geometry.dispose();
    crushCtx.crossSection.material.dispose();
    crushCtx.crossSection = null;
  }

  // Clean up crack meshes
  if (crushCtx && crushCtx.crackMeshes) {
    crushCtx.crackMeshes.forEach(function(cm) {
      if (cm.parent) cm.parent.remove(cm);
      if (cm.geometry) cm.geometry.dispose();
      if (cm.material) cm.material.dispose();
    });
  }

  // Clear clipping planes before disposing object
  if (currentObject) {
    scene.remove(currentObject);
    currentObject.traverse(function(child) {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(function(m) { m.dispose(); });
        } else {
          child.material.dispose();
        }
      }
    });
    currentObject = null;
  }

  // Start retract after delay
  setTimeout(function() {
    startRetract();
  }, 500);
}

function startRetract() {
  isRetracting = true;
  playRetractHiss();
  var statusEl = document.getElementById('status-text');
  if (statusEl) statusEl.textContent = 'ZURÜCKFAHREN...';
  var btn = document.getElementById('press-btn');
  if (btn) btn.classList.add('disabled');
}

function spawnObject(objId) {
  // Remove old object if exists
  if (currentObject) {
    scene.remove(currentObject);
    currentObject.traverse(function(child) {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(function(m) { m.dispose(); });
        } else {
          child.material.dispose();
        }
      }
    });
    currentObject = null;
  }

  // Clean up snap halves from crushCtx
  if (crushCtx && crushCtx.halves) {
    crushCtx.halves.forEach(function(half) {
      if (half.parent) scene.remove(half);
      half.traverse(function(child) {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
      });
    });
  }

  // Clean up cross-section disc from previous crush
  if (crushCtx && crushCtx.crossSection) {
    scene.remove(crushCtx.crossSection);
    if (crushCtx.crossSection.geometry) crushCtx.crossSection.geometry.dispose();
    if (crushCtx.crossSection.material) crushCtx.crossSection.material.dispose();
    crushCtx.crossSection = null;
  }

  var objData = getObjData(objId);
  if (!objData) return;

  var group = buildObject(objData);
  // Position object so its bounding box bottom sits exactly on platform surface
  var tempBox = new THREE.Box3().setFromObject(group);
  var bottomOffset = tempBox.min.y;  // local-space distance from origin to bottom
  group.position.set(0, OBJ_Y - bottomOffset, 0);
  scene.add(group);
  currentObject = group;

  pressProgress = 0;
  isRetracting = false;
  crushCtx = {};
  crushSoundPlayed = false;

  var statusEl = document.getElementById('status-text');
  if (statusEl) statusEl.textContent = objData.name;

  // Add to recent objects (keep last 5 unique)
  var idx = recentObjects.indexOf(objId);
  if (idx !== -1) recentObjects.splice(idx, 1);
  recentObjects.unshift(objId);
  if (recentObjects.length > 5) recentObjects.pop();

  updateSidePanel();
}

function showCoinReward(amount) {
  var div = document.createElement('div');
  div.className = 'coin-reward';
  div.textContent = '+' + amount;
  div.style.position = 'fixed';
  div.style.left = '50%';
  div.style.top = '35%';
  div.style.transform = 'translateX(-50%)';
  div.style.fontSize = '2.5rem';
  div.style.fontWeight = 'bold';
  div.style.color = '#ffd700';
  div.style.textShadow = '0 2px 8px rgba(0,0,0,0.7)';
  div.style.zIndex = '200';
  div.style.pointerEvents = 'none';
  div.style.animation = 'coinFloat 1.2s ease-out forwards';
  document.body.appendChild(div);
  setTimeout(function() {
    if (div.parentNode) div.parentNode.removeChild(div);
  }, 1200);
}


// ═══════════════════════════════════════════════════
// 11. ENVIRONMENT & PRESS MODEL
// ═══════════════════════════════════════════════════

function buildEnvironment() {
  // Floor — large concrete slab with subtle grid
  var floorGeo = new THREE.PlaneGeometry(20, 20, 1, 1);
  var floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = PLATFORM_Y;
  floor.receiveShadow = true;
  scene.add(floor);

  // Expansion joints in concrete (wider, more visible)
  var jointMat = getMat(0x2a2a2e, 0.95, 0.0);
  for (var gi = -8; gi <= 8; gi += 2) {
    var jGeoX = new THREE.BoxGeometry(20, 0.003, 0.025);
    var jX = new THREE.Mesh(jGeoX, jointMat);
    jX.position.set(0, PLATFORM_Y + 0.001, gi);
    scene.add(jX);
    var jGeoZ = new THREE.BoxGeometry(0.025, 0.003, 20);
    var jZ = new THREE.Mesh(jGeoZ, jointMat);
    jZ.position.set(gi, PLATFORM_Y + 0.001, 0);
    scene.add(jZ);
  }

  // Back wall — brick texture for industrial feel
  var backWallMat = getMat(0x282830, 0.88, 0.05, { map: generateTexture('brick', 0x282830), envMapIntensity: 0.05 });
  var wallGeo = new THREE.PlaneGeometry(20, 10);
  var backWall = new THREE.Mesh(wallGeo, backWallMat);
  backWall.position.set(0, PLATFORM_Y + 5, -5);
  backWall.receiveShadow = true;
  scene.add(backWall);

  // Industrial pillars at corners
  var pillarGeo = new THREE.BoxGeometry(0.4, 8, 0.4);
  var pillarMat2 = getMat(0x3a3a40, 0.7, 0.3);
  var pillarPositions = [
    [-4, PLATFORM_Y + 4, -4.8],
    [4, PLATFORM_Y + 4, -4.8],
    [-4, PLATFORM_Y + 4, 4],
    [4, PLATFORM_Y + 4, 4]
  ];
  pillarPositions.forEach(function(pp) {
    var pillar = new THREE.Mesh(pillarGeo, pillarMat2);
    pillar.position.set(pp[0], pp[1], pp[2]);
    pillar.castShadow = true;
    pillar.receiveShadow = true;
    scene.add(pillar);
  });

  // Ceiling beams
  var beamGeo = new THREE.BoxGeometry(10, 0.3, 0.25);
  var beamMat = getMat(0x44444a, 0.8, 0.2);
  var beam1 = new THREE.Mesh(beamGeo, beamMat);
  beam1.position.set(0, PLATFORM_Y + 7.8, -2);
  beam1.castShadow = true;
  scene.add(beam1);
  var beam2 = new THREE.Mesh(beamGeo, beamMat);
  beam2.position.set(0, PLATFORM_Y + 7.8, 2);
  beam2.castShadow = true;
  scene.add(beam2);

  // Safety railing (yellow tubes on sides)
  var railMat = hazardMat;
  var railGeo = new THREE.CylinderGeometry(0.025, 0.025, 4, 8);
  // Left side rails
  var rail1 = new THREE.Mesh(railGeo, railMat);
  rail1.rotation.z = Math.PI / 2;
  rail1.position.set(-2, PLATFORM_Y + 0.6, 2);
  scene.add(rail1);
  var rail2 = new THREE.Mesh(railGeo, railMat);
  rail2.rotation.z = Math.PI / 2;
  rail2.position.set(-2, PLATFORM_Y + 1.0, 2);
  scene.add(rail2);
  // Right side rails
  var rail3 = new THREE.Mesh(railGeo, railMat);
  rail3.rotation.z = Math.PI / 2;
  rail3.position.set(2, PLATFORM_Y + 0.6, 2);
  scene.add(rail3);
  var rail4 = new THREE.Mesh(railGeo, railMat);
  rail4.rotation.z = Math.PI / 2;
  rail4.position.set(2, PLATFORM_Y + 1.0, 2);
  scene.add(rail4);
  // Rail posts
  var postGeo = new THREE.CylinderGeometry(0.025, 0.025, 1.2, 8);
  [[-4, 2], [-2, 2], [0, 2], [2, 2], [4, 2]].forEach(function(pp) {
    var post = new THREE.Mesh(postGeo, railMat);
    post.position.set(pp[0], PLATFORM_Y + 0.6, pp[1]);
    scene.add(post);
  });

  // Oil stains on floor
  var oilMat = new THREE.MeshStandardMaterial({
    color: 0x1a1a1a, roughness: 0.95, metalness: 0.0,
    transparent: true, opacity: 0.6
  });
  var stainPositions = [
    [0.8, -0.3, 0.4],
    [-1.2, 0.5, 0.3],
    [0.3, 1.0, 0.25]
  ];
  stainPositions.forEach(function(sp) {
    var stainGeo = new THREE.CircleGeometry(sp[2], 16);
    var stain = new THREE.Mesh(stainGeo, oilMat);
    stain.rotation.x = -Math.PI / 2;
    stain.position.set(sp[0], PLATFORM_Y + 0.002, sp[1]);
    scene.add(stain);
  });
}

function buildPressModel() {
  pressGroup = new THREE.Group();

  // Base plate
  var baseGeo = new THREE.BoxGeometry(2.5, 0.3, 1.5);
  var basePlate = new THREE.Mesh(baseGeo, frameMat);
  basePlate.position.set(0, PLATFORM_Y + 0.15, 0);
  basePlate.castShadow = true;
  basePlate.receiveShadow = true;
  pressGroup.add(basePlate);

  // 4 columns at corners
  var colGeo = new THREE.CylinderGeometry(0.08, 0.08, 5.5, 12);
  var colPositions = [
    [-0.9, PLATFORM_Y + 3.05, -0.5],
    [0.9, PLATFORM_Y + 3.05, -0.5],
    [-0.9, PLATFORM_Y + 3.05, 0.5],
    [0.9, PLATFORM_Y + 3.05, 0.5]
  ];
  colPositions.forEach(function(cp) {
    var col = new THREE.Mesh(colGeo, frameMat);
    col.position.set(cp[0], cp[1], cp[2]);
    col.castShadow = true;
    pressGroup.add(col);

    // Thread rings at intervals
    var ringGeo = new THREE.TorusGeometry(0.09, 0.015, 6, 12);
    for (var ri = 0; ri < 4; ri++) {
      var ring = new THREE.Mesh(ringGeo, frameMat);
      ring.position.set(cp[0], PLATFORM_Y + 1.0 + ri * 1.2, cp[2]);
      ring.rotation.x = Math.PI / 2;
      pressGroup.add(ring);
    }

    // Hex nuts at top and bottom
    var nutGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.08, 6);
    var nutTop = new THREE.Mesh(nutGeo, frameMat);
    nutTop.position.set(cp[0], PLATFORM_Y + 5.75, cp[2]);
    nutTop.castShadow = true;
    pressGroup.add(nutTop);
    var nutBot = new THREE.Mesh(nutGeo, frameMat);
    nutBot.position.set(cp[0], PLATFORM_Y + 0.35, cp[2]);
    nutBot.castShadow = true;
    pressGroup.add(nutBot);
  });

  // Top beam
  var topBeamGeo = new THREE.BoxGeometry(2.5, 0.35, 1.5);
  var topBeam = new THREE.Mesh(topBeamGeo, frameMat);
  topBeam.position.set(0, PLATFORM_Y + 5.8 + 0.175, 0);
  topBeam.castShadow = true;
  pressGroup.add(topBeam);

  // Reinforcement ribs underneath top beam
  var ribGeo = new THREE.BoxGeometry(2.3, 0.08, 0.06);
  for (var rib = 0; rib < 3; rib++) {
    var ribMesh = new THREE.Mesh(ribGeo, frameMat);
    ribMesh.position.set(0, PLATFORM_Y + 5.78, -0.3 + rib * 0.3);
    pressGroup.add(ribMesh);
  }

  // Hydraulic cylinder on top beam
  var cylGeo = new THREE.CylinderGeometry(0.25, 0.25, 1.5, 16);
  var cylinder = new THREE.Mesh(cylGeo, frameMat);
  cylinder.position.set(0, PLATFORM_Y + 6.0 + 0.75, 0);
  cylinder.castShadow = true;
  pressGroup.add(cylinder);

  // Cylinder bands
  var bandGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.06, 16);
  var bandMat = getMat(0x555560, 0.4, 0.6);
  for (var bi = 0; bi < 3; bi++) {
    var band = new THREE.Mesh(bandGeo, bandMat);
    band.position.set(0, PLATFORM_Y + 6.2 + bi * 0.5, 0);
    pressGroup.add(band);
  }

  // Piston assembly
  pistonGroup = new THREE.Group();

  // Chrome rod
  var rodGeo = new THREE.CylinderGeometry(0.08, 0.08, 2, 12);
  var rod = new THREE.Mesh(rodGeo, pistonMat);
  rod.position.set(0, -1.0, 0);
  rod.castShadow = true;
  pistonGroup.add(rod);

  // Press head — RED painted metal with clearcoat
  var headGeo = new THREE.CylinderGeometry(0.52, 0.56, 0.22, 24);
  var headMat = getMat(0xcc2222, 0.35, 0.25, { emissive: 0x441111, clearcoat: 0.6, clearcoatRoughness: 0.15 });
  pressHeadMesh = new THREE.Mesh(headGeo, headMat);
  pressHeadMesh.position.set(0, -2.05, 0);
  pressHeadMesh.castShadow = true;
  pistonGroup.add(pressHeadMesh);

  // Dark mounting plate above head
  var plateGeo = new THREE.CylinderGeometry(0.44, 0.48, 0.1, 16);
  var plate = new THREE.Mesh(plateGeo, frameMat);
  plate.position.set(0, -1.88, 0);
  plate.castShadow = true;
  pistonGroup.add(plate);

  // Seal ring where rod meets cylinder
  var sealGeo = new THREE.TorusGeometry(0.1, 0.025, 8, 16);
  var sealMat = getMat(0x222222, 0.9, 0.0);
  var seal = new THREE.Mesh(sealGeo, sealMat);
  seal.rotation.x = Math.PI / 2;
  seal.position.set(0, 0, 0);
  pistonGroup.add(seal);

  pistonGroup.position.set(0, PISTON_START_Y, 0);
  pressGroup.add(pistonGroup);

  // Platform
  var platGeo = new THREE.BoxGeometry(1.8, 0.15, 1.2);
  platformMesh = new THREE.Mesh(platGeo, platformMat);
  platformMesh.position.set(0, PLATFORM_Y + 0.375, 0);
  platformMesh.castShadow = true;
  platformMesh.receiveShadow = true;
  pressGroup.add(platformMesh);

  // T-slots on platform surface
  var slotMat = getMat(0x1a1a1e, 0.9, 0.1);
  var slotGeo = new THREE.BoxGeometry(1.5, 0.005, 0.02);
  for (var si = 0; si < 3; si++) {
    var slot = new THREE.Mesh(slotGeo, slotMat);
    slot.position.set(0, PLATFORM_Y + 0.453, -0.25 + si * 0.25);
    pressGroup.add(slot);
  }

  // Side plates
  var sidePlateGeo = new THREE.BoxGeometry(0.05, 3.5, 1.3);
  var sidePlateMat = getMat(0x3a3a42, 0.7, 0.3);
  var leftPlate = new THREE.Mesh(sidePlateGeo, sidePlateMat);
  leftPlate.position.set(-1.15, PLATFORM_Y + 2.3, 0);
  leftPlate.castShadow = true;
  pressGroup.add(leftPlate);
  var rightPlate = new THREE.Mesh(sidePlateGeo, sidePlateMat);
  rightPlate.position.set(1.15, PLATFORM_Y + 2.3, 0);
  rightPlate.castShadow = true;
  pressGroup.add(rightPlate);

  // Cross braces on side plates
  var braceGeo = new THREE.BoxGeometry(0.04, 2.5, 0.04);
  var braceMat = getMat(0x444448, 0.7, 0.3);
  var braceL = new THREE.Mesh(braceGeo, braceMat);
  braceL.position.set(-1.15, PLATFORM_Y + 2.3, 0);
  braceL.rotation.z = Math.PI / 6;
  pressGroup.add(braceL);
  var braceR = new THREE.Mesh(braceGeo, braceMat);
  braceR.position.set(1.15, PLATFORM_Y + 2.3, 0);
  braceR.rotation.z = -Math.PI / 6;
  pressGroup.add(braceR);

  // Warning label (yellow+black striped)
  var warnGeo = new THREE.BoxGeometry(0.3, 0.15, 0.01);
  var warnCanvas = document.createElement('canvas');
  warnCanvas.width = 64;
  warnCanvas.height = 32;
  var wctx = warnCanvas.getContext('2d');
  // Yellow-black hazard stripes
  wctx.fillStyle = '#ffcc00';
  wctx.fillRect(0, 0, 64, 32);
  wctx.fillStyle = '#111';
  for (var ws = 0; ws < 8; ws++) {
    wctx.beginPath();
    wctx.moveTo(ws * 16, 0);
    wctx.lineTo(ws * 16 + 12, 0);
    wctx.lineTo(ws * 16 - 4, 32);
    wctx.lineTo(ws * 16 - 16, 32);
    wctx.closePath();
    wctx.fill();
  }
  // Warning triangle
  wctx.fillStyle = '#ffcc00';
  wctx.beginPath();
  wctx.moveTo(32, 5);
  wctx.lineTo(42, 25);
  wctx.lineTo(22, 25);
  wctx.closePath();
  wctx.fill();
  wctx.strokeStyle = '#111';
  wctx.lineWidth = 2;
  wctx.stroke();
  wctx.fillStyle = '#111';
  wctx.font = 'bold 12px sans-serif';
  wctx.textAlign = 'center';
  wctx.fillText('!', 32, 22);
  var warnTex = new THREE.CanvasTexture(warnCanvas);
  var warnMat = new THREE.MeshStandardMaterial({ map: warnTex, roughness: 0.6 });
  var warnLabel = new THREE.Mesh(warnGeo, warnMat);
  warnLabel.position.set(0.5, PLATFORM_Y + 1.8, 0.76);
  pressGroup.add(warnLabel);

  // Hydraulic hoses (from cylinder area to base)
  var hoseMat = getMat(0x1a1a1a, 0.95, 0.0);
  var hoseGeo = new THREE.CylinderGeometry(0.035, 0.035, 4.5, 8);

  var hoseL = new THREE.Mesh(hoseGeo, hoseMat);
  hoseL.position.set(-0.35, PLATFORM_Y + 3.5, -0.6);
  hoseL.rotation.x = 0.05;
  pressGroup.add(hoseL);
  var hoseR = new THREE.Mesh(hoseGeo, hoseMat);
  hoseR.position.set(0.35, PLATFORM_Y + 3.5, -0.6);
  hoseR.rotation.x = 0.05;
  pressGroup.add(hoseR);

  // Hose fittings
  var fittingGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.08, 8);
  var fittingMat = getMat(0x888888, 0.3, 0.8);
  [[-0.35, -0.6], [0.35, -0.6]].forEach(function(hp) {
    var fitTop = new THREE.Mesh(fittingGeo, fittingMat);
    fitTop.position.set(hp[0], PLATFORM_Y + 5.7, hp[1]);
    pressGroup.add(fitTop);
    var fitBot = new THREE.Mesh(fittingGeo, fittingMat);
    fitBot.position.set(hp[0], PLATFORM_Y + 1.3, hp[1]);
    pressGroup.add(fitBot);
  });

  // Control box on the right side
  var ctrlBoxGeo = new THREE.BoxGeometry(0.3, 0.4, 0.2);
  var ctrlBoxMat = getMat(0x555560, 0.6, 0.3);
  var ctrlBox = new THREE.Mesh(ctrlBoxGeo, ctrlBoxMat);
  ctrlBox.position.set(1.45, PLATFORM_Y + 1.5, 0.3);
  ctrlBox.castShadow = true;
  pressGroup.add(ctrlBox);

  // Green button — glossy painted plastic
  var greenBtnGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.02, 12);
  var greenBtnMat = getMat(0x22cc22, 0.3, 0.2, { emissive: 0x115511, clearcoat: 0.8, clearcoatRoughness: 0.1 });
  var greenBtn = new THREE.Mesh(greenBtnGeo, greenBtnMat);
  greenBtn.position.set(1.45, PLATFORM_Y + 1.72, 0.4);
  greenBtn.rotation.x = Math.PI / 2;
  pressGroup.add(greenBtn);

  // Red E-stop button — glossy painted plastic
  var redBtnGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.03, 12);
  var redBtnMat = getMat(0xcc2222, 0.3, 0.2, { emissive: 0x551111, clearcoat: 0.8, clearcoatRoughness: 0.1 });
  var redBtn = new THREE.Mesh(redBtnGeo, redBtnMat);
  redBtn.position.set(1.45, PLATFORM_Y + 1.72, 0.2);
  redBtn.rotation.x = Math.PI / 2;
  pressGroup.add(redBtn);

  pressGroup.position.set(0, 0, 0);
  scene.add(pressGroup);
}

function setupLighting() {
  // Hemisphere light for subtle sky/ground color variation
  var hemi = new THREE.HemisphereLight(0x8899bb, 0x222211, 0.25);
  scene.add(hemi);

  // Low ambient for shadow fill
  var ambient = new THREE.AmbientLight(0x303038, 0.3);
  scene.add(ambient);

  // Main key light — warm industrial overhead, strong shadows
  var dirLight = new THREE.DirectionalLight(0xffeedd, 1.2);
  dirLight.position.set(4, 10, 3);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 4096;
  dirLight.shadow.mapSize.height = 4096;
  dirLight.shadow.camera.near = 0.5;
  dirLight.shadow.camera.far = 30;
  dirLight.shadow.camera.left = -6;
  dirLight.shadow.camera.right = 6;
  dirLight.shadow.camera.top = 8;
  dirLight.shadow.camera.bottom = -4;
  dirLight.shadow.bias = -0.0005;
  dirLight.shadow.normalBias = 0.02;
  dirLight.shadow.radius = 3;
  scene.add(dirLight);

  // Cool fill light from left — rim separation
  var fillLight = new THREE.DirectionalLight(0x6677aa, 0.35);
  fillLight.position.set(-5, 4, 2);
  scene.add(fillLight);

  // Back rim light — highlights metal edges
  var rimLight = new THREE.DirectionalLight(0xaabbdd, 0.4);
  rimLight.position.set(-1, 5, -5);
  scene.add(rimLight);

  // Main spot — dramatic overhead cone on press platform
  var spotMain = new THREE.SpotLight(0xfff0dd, 0.8);
  spotMain.position.set(0, PLATFORM_Y + 8, 1);
  spotMain.target.position.set(0, PLATFORM_Y + 0.5, 0);
  spotMain.angle = Math.PI / 5;
  spotMain.penumbra = 0.7;
  spotMain.decay = 1.5;
  spotMain.distance = 15;
  spotMain.castShadow = true;
  spotMain.shadow.mapSize.width = 2048;
  spotMain.shadow.mapSize.height = 2048;
  spotMain.shadow.bias = -0.001;
  scene.add(spotMain);
  scene.add(spotMain.target);

  // Red accent spot from right — dramatic color splash
  var spotRed = new THREE.SpotLight(0xff3333, 0.25);
  spotRed.position.set(3, 2, 4);
  spotRed.target.position.set(0, PLATFORM_Y + 0.5, 0);
  spotRed.angle = Math.PI / 7;
  spotRed.penumbra = 0.8;
  spotRed.decay = 2.0;
  spotRed.distance = 12;
  scene.add(spotRed);
  scene.add(spotRed.target);

  // Warm point light inside press frame — simulates hydraulic glow
  var warmPoint = new THREE.PointLight(0xffaa55, 0.3, 8, 2);
  warmPoint.position.set(0, PLATFORM_Y + 4, 0);
  scene.add(warmPoint);

  // Cool point light from back — depth separation
  var coolPoint = new THREE.PointLight(0x5577aa, 0.2, 14, 2);
  coolPoint.position.set(-2, PLATFORM_Y + 3, -4);
  scene.add(coolPoint);
}


// ═══════════════════════════════════════════════════
// 12. GAUGE & UI
// ═══════════════════════════════════════════════════
var gaugeCanvas = document.getElementById('gauge-canvas');
var gaugeCtx2d = gaugeCanvas ? gaugeCanvas.getContext('2d') : null;

function drawGauge(pressure) {
  if (!gaugeCtx2d) return;

  var w = 128, h = 80;
  gaugeCtx2d.clearRect(0, 0, w, h);

  var cx = w / 2, cy = h - 10;
  var radius = 48;
  var startAngle = Math.PI;
  var endAngle = 0;

  // Draw arc background
  gaugeCtx2d.beginPath();
  gaugeCtx2d.arc(cx, cy, radius, startAngle, endAngle, false);
  gaugeCtx2d.lineWidth = 10;
  gaugeCtx2d.strokeStyle = '#222';
  gaugeCtx2d.stroke();

  // Draw gradient arc
  var steps = 40;
  for (var i = 0; i < steps; i++) {
    var t = i / steps;
    var a = startAngle + t * (endAngle - startAngle);
    var a2 = startAngle + (t + 1 / steps) * (endAngle - startAngle);
    var r, g, b;
    if (t < 0.4) {
      r = Math.floor(0 + t / 0.4 * 255);
      g = 200;
      b = 0;
    } else if (t < 0.7) {
      r = 255;
      g = Math.floor(200 - (t - 0.4) / 0.3 * 150);
      b = 0;
    } else {
      r = 255;
      g = Math.floor(50 - (t - 0.7) / 0.3 * 50);
      b = 0;
    }
    gaugeCtx2d.beginPath();
    gaugeCtx2d.arc(cx, cy, radius, a, a2 + 0.02, false);
    gaugeCtx2d.lineWidth = 8;
    gaugeCtx2d.strokeStyle = 'rgb(' + r + ',' + g + ',' + b + ')';
    gaugeCtx2d.stroke();
  }

  // Tick marks
  gaugeCtx2d.strokeStyle = '#aaa';
  gaugeCtx2d.lineWidth = 1;
  for (var ti = 0; ti <= 8; ti++) {
    var ta = startAngle + (ti / 8) * (endAngle - startAngle);
    var innerR = radius - 14;
    var outerR = radius + 4;
    gaugeCtx2d.beginPath();
    gaugeCtx2d.moveTo(cx + Math.cos(ta) * innerR, cy + Math.sin(ta) * innerR);
    gaugeCtx2d.lineTo(cx + Math.cos(ta) * outerR, cy + Math.sin(ta) * outerR);
    gaugeCtx2d.stroke();
  }

  // Needle
  var needleRatio = Math.min(1, Math.max(0, pressure / 800));
  var needleAngle = startAngle + needleRatio * (endAngle - startAngle);
  gaugeCtx2d.beginPath();
  gaugeCtx2d.moveTo(cx, cy);
  gaugeCtx2d.lineTo(
    cx + Math.cos(needleAngle) * (radius - 5),
    cy + Math.sin(needleAngle) * (radius - 5)
  );
  gaugeCtx2d.lineWidth = 2.5;
  gaugeCtx2d.strokeStyle = '#ff3333';
  gaugeCtx2d.stroke();

  // Center dot
  gaugeCtx2d.beginPath();
  gaugeCtx2d.arc(cx, cy, 4, 0, Math.PI * 2);
  gaugeCtx2d.fillStyle = '#cc2222';
  gaugeCtx2d.fill();

  // Update DOM values
  var pressureVal = Math.round(pressure);
  var pressureEl = document.getElementById('pressure-value');
  if (pressureEl) {
    pressureEl.textContent = pressureVal + ' bar';
    if (pressureVal < 200) {
      pressureEl.style.color = '#44cc44';
    } else if (pressureVal < 600) {
      pressureEl.style.color = '#cccc44';
    } else {
      pressureEl.style.color = '#cc4444';
    }
  }

  var forceEl = document.getElementById('force-value');
  if (forceEl) forceEl.textContent = (pressure * 1.5).toFixed(1) + ' kN';

  var strokeEl = document.getElementById('stroke-value');
  if (strokeEl) strokeEl.textContent = (pressProgress * PISTON_TRAVEL * 1000).toFixed(0) + ' mm';

  var machineStatus = document.getElementById('machine-status');
  if (machineStatus) {
    if (isHolding) {
      machineStatus.textContent = 'AKTIV';
      machineStatus.style.color = '#cc4444';
    } else if (isRetracting) {
      machineStatus.textContent = 'RÜCKLAUF';
      machineStatus.style.color = '#cccc44';
    } else {
      machineStatus.textContent = 'BEREIT';
      machineStatus.style.color = '#44cc44';
    }
  }
}


// ═══════════════════════════════════════════════════
// 13. SHOP UI
// ═══════════════════════════════════════════════════
var currentShopCategory = 'all';

function setupShop() {
  var shopBtn = document.getElementById('shop-btn');
  if (shopBtn) {
    shopBtn.addEventListener('click', function() {
      openShop();
    });
  }

  var shopClose = document.getElementById('shop-close');
  if (shopClose) {
    shopClose.addEventListener('click', function() {
      closeShop();
    });
  }

  window.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') closeShop();
  });
}

function openShop() {
  var overlay = document.getElementById('shop-overlay');
  if (overlay) overlay.classList.add('open');
  var shopCoinEl = document.getElementById('shop-coin-amount');
  if (shopCoinEl) shopCoinEl.textContent = economy.coins;
  renderCategoryTabs();
  renderShopGrid();
}

function closeShop() {
  var overlay = document.getElementById('shop-overlay');
  if (overlay) overlay.classList.remove('open');
}

function renderCategoryTabs() {
  var tabsEl = document.getElementById('cat-tabs');
  if (!tabsEl) return;
  tabsEl.innerHTML = '';

  CATEGORIES.forEach(function(cat) {
    var btn = document.createElement('button');
    btn.className = 'cat-tab' + (currentShopCategory === cat.id ? ' active' : '');
    btn.textContent = cat.icon + ' ' + cat.name;
    btn.addEventListener('click', function() {
      currentShopCategory = cat.id;
      renderCategoryTabs();
      renderShopGrid();
    });
    tabsEl.appendChild(btn);
  });
}

function renderShopGrid() {
  var gridEl = document.getElementById('shop-grid');
  if (!gridEl) return;
  gridEl.innerHTML = '';

  var filtered = OBJECTS;
  if (currentShopCategory !== 'all') {
    filtered = OBJECTS.filter(function(obj) {
      return obj.cat === currentShopCategory;
    });
  }

  filtered.forEach(function(obj) {
    var card = document.createElement('div');
    card.className = 'shop-card';
    var unlocked = isUnlocked(obj.id);

    var iconSpan = document.createElement('span');
    iconSpan.className = 'card-icon';
    iconSpan.textContent = obj.icon;
    card.appendChild(iconSpan);

    var nameSpan = document.createElement('span');
    nameSpan.className = 'card-name';
    nameSpan.textContent = obj.name;
    card.appendChild(nameSpan);

    if (unlocked) {
      var ownedSpan = document.createElement('span');
      ownedSpan.className = 'card-owned';
      if (selectedObjId === obj.id) {
        ownedSpan.textContent = 'AUSGEWÄHLT';
        card.classList.add('selected');
      } else {
        ownedSpan.textContent = 'BESITZT';
      }
      card.appendChild(ownedSpan);
    } else {
      var priceSpan = document.createElement('span');
      priceSpan.className = 'card-price';
      priceSpan.textContent = obj.price + ' \uD83E\uDE99';
      card.appendChild(priceSpan);

      var lockSpan = document.createElement('span');
      lockSpan.className = 'lock-icon';
      lockSpan.textContent = '\uD83D\uDD12';
      card.appendChild(lockSpan);

      card.classList.add('locked');
    }

    card.addEventListener('click', function() {
      if (unlocked) {
        selectObject(obj.id);
        closeShop();
      } else if (economy.coins >= obj.price) {
        unlockObject(obj.id);
        renderShopGrid();
      } else {
        // Flash price red
        var priceEl = card.querySelector('.card-price');
        if (priceEl) {
          priceEl.style.color = '#ff3333';
          priceEl.style.transform = 'scale(1.2)';
          setTimeout(function() {
            priceEl.style.color = '';
            priceEl.style.transform = '';
          }, 400);
        }
      }
    });

    gridEl.appendChild(card);
  });
}

function selectObject(id) {
  selectedObjId = id;
  spawnObject(id);
  closeShop();
  updateSidePanel();
}

function updateSidePanel() {
  var panelEl = document.getElementById('side-panel');
  if (!panelEl) return;

  // Clear old buttons but keep label
  var existing = panelEl.querySelectorAll('.obj-btn');
  existing.forEach(function(el) { el.remove(); });

  recentObjects.forEach(function(objId) {
    var objData = getObjData(objId);
    if (!objData) return;

    var btn = document.createElement('button');
    btn.className = 'obj-btn' + (selectedObjId === objId ? ' active' : '');
    btn.textContent = objData.icon;
    btn.title = objData.name;
    btn.addEventListener('click', function() {
      if (!isHolding && !isRetracting) {
        selectObject(objId);
      }
    });
    panelEl.appendChild(btn);
  });
}


// ═══════════════════════════════════════════════════
// 14. MAIN LOOP & INIT
// ═══════════════════════════════════════════════════
var clock;

function animate() {
  requestAnimationFrame(animate);
  var delta = clock.getDelta();
  controls.update();
  updatePress(delta);
  updateParticles(delta);
  drawGauge(pressProgress * 800);
  renderer.render(scene, camera);
}

function onResize() {
  var container = document.getElementById('canvas-container');
  if (!container) return;
  var w = container.clientWidth;
  var h = container.clientHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}

function init() {
  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1a2e);
  scene.fog = new THREE.Fog(0x1a1a2e, 12, 25);

  // Camera
  camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(1.8, 0.3, 2.8);
  camera.lookAt(0, 0, 0);

  // Renderer
  var container = document.getElementById('canvas-container');
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.localClippingEnabled = true;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);

  // Create environment map for realistic metal reflections
  createEnvMap(renderer);
  scene.environment = sceneEnvMap;

  // Initialize materials now that env map exists
  initPresetMaterials();

  // Orbit controls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.minPolarAngle = 0.3;
  controls.maxPolarAngle = 1.5;
  controls.minDistance = 1.5;
  controls.maxDistance = 10;
  controls.target.set(0, -0.8, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.update();

  // Build scene
  setupLighting();
  buildEnvironment();
  buildPressModel();
  initParticlePool();

  // Load saved data
  loadSave();

  // Update UI from economy
  var coinEl = document.getElementById('coin-amount');
  if (coinEl) coinEl.textContent = economy.coins;
  crushCount = economy.totalCrushed;
  var crushEl = document.getElementById('crush-count');
  if (crushEl) crushEl.textContent = crushCount;

  // Spawn initial object
  var initialObj = selectedObjId || 'watermelon';
  if (!getObjData(initialObj)) {
    initialObj = OBJECTS[0].id;
  }
  selectedObjId = initialObj;
  spawnObject(initialObj);

  // Hold-to-press events
  var pressBtn = document.getElementById('press-btn');
  if (pressBtn) {
    pressBtn.addEventListener('mousedown', function(e) {
      e.preventDefault();
      beginHold();
    });
    pressBtn.addEventListener('touchstart', function(e) {
      e.preventDefault();
      beginHold();
    });
  }

  window.addEventListener('mouseup', function() {
    endHold();
  });
  window.addEventListener('touchend', function() {
    endHold();
  });

  var spaceHeld = false;
  window.addEventListener('keydown', function(e) {
    if (e.code === 'Space' && !e.repeat) {
      e.preventDefault();
      var shopOpen = document.getElementById('shop-overlay');
      if (shopOpen && shopOpen.classList.contains('open')) return;
      spaceHeld = true;
      beginHold();
    }
  });
  window.addEventListener('keyup', function(e) {
    if (e.code === 'Space') {
      e.preventDefault();
      spaceHeld = false;
      endHold();
    }
  });

  // Setup shop
  setupShop();
  updateSidePanel();

  // Auth UI wiring & session restore
  wireAuthUI();
  initAuth();

  // Save to cloud before page closes
  window.addEventListener('beforeunload', function() {
    _saveToCloudImmediate();
  });

  // Clock
  clock = new THREE.Clock();

  // Hide loading screen
  var loadBar = document.getElementById('load-bar');
  if (loadBar) loadBar.style.width = '100%';
  setTimeout(function() {
    var loadingEl = document.getElementById('loading');
    if (loadingEl) loadingEl.classList.add('hidden');
  }, 300);

  window.__pressitLoaded = true;

  // Start render loop
  animate();
}

window.addEventListener('resize', onResize);

try {
  init();
} catch (e) {
  console.error(e);
  var hint = document.querySelector('#loading .hint');
  if (hint) {
    hint.textContent = 'Fehler: ' + e.message;
    hint.style.color = '#c41e1e';
  }
}

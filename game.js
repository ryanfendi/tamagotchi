// Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyAN0GNZdIx_xPHT7MZKWJweLtNhies6QxY",
  authDomain: "tamagotchi-2be0c.firebaseapp.com",
  databaseURL: "https://tamagotchi-2be0c-default-rtdb.firebaseio.com",
  projectId: "tamagotchi-2be0c",
  storageBucket: "tamagotchi-2be0c.firebasestorage.app",
  messagingSenderId: "202052432703",
  appId: "1:202052432703:web:cb76b50e42149a2c92998a",
  measurementId: "G-TWGGSJRX26"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const auth = firebase.auth();

let user = null;
let pet = {
  username: "",
  coins: 50,
  level: 1,
  hp: 100,
  hunger: 100,
  energy: 100
};

// ===== AUTH STATE =====
auth.onAuthStateChanged(u => {
  if (u) {
    user = u;
    // Ambil data user
    db.ref("users/" + u.uid).once("value").then(snap => {
      if (snap.exists()) {
        pet = snap.val();
      } else {
        // kalau baru, set default
        pet.username = u.email.split("@")[0];
        db.ref("users/" + u.uid).set(pet);
      }
      updateUI();
    });
  } else {
    // kalau tidak login, balik ke index.html
    window.location.href = "index.html";
  }
});

// ===== SIMPAN DATA =====
function save() {
  if (user) {
    db.ref("users/" + user.uid).set(pet);
  }
}

// ===== UPDATE UI =====
function updateUI() {
  document.getElementById("username").innerText = "👤 " + (pet.username || user.email);
  document.getElementById("coins").innerText = pet.coins.toFixed(2);
  document.getElementById("level").innerText = pet.level;

  document.getElementById("hpBar").style.width = pet.hp + "%";
  document.getElementById("hungerBar").style.width = pet.hunger + "%";
  document.getElementById("energyBar").style.width = pet.energy + "%";
}

// ===== ACTION BUTTONS =====
function feedPet() {
  if (pet.coins < 1) return alert("❌ Coin tidak cukup!");
  pet.coins -= 1;
  pet.hunger = Math.min(100, pet.hunger + 10);
  save();
  updateUI();
}

function sleepPet() {
  if (pet.coins < 1) return alert("❌ Coin tidak cukup!");
  pet.coins -= 1;
  pet.energy = Math.min(100, pet.energy + 10);
  save();
  updateUI();
}

function tapCoin() {
  pet.coins += 0.01;
  save();
  updateUI();
}

function buyLevel() {
  if (pet.coins < 100) return alert("❌ Coin tidak cukup!");
  pet.coins -= 100;
  pet.level += 1;
  save();
  updateUI();
}

function buyPet() {
  if (pet.coins < 200) return alert("❌ Coin tidak cukup!");
  pet.coins -= 200;
  alert("🐕 Pet baru berhasil dibeli! Cek di Inventory.");
  // simpan ke inventory
  db.ref("inventory/" + user.uid).push({ type: "pet", level: 1, time: Date.now() });
  save();
  updateUI();
}

// ===== LOGOUT =====
function logout() {
  auth.signOut();
}

// ===== NAVIGASI =====
function goPage(page) {
  window.location.href = page;
}

// ===== DECAY (status berkurang tiap menit) =====
setInterval(() => {
  if (!user) return;
  pet.hunger = Math.max(0, pet.hunger - 1);
  pet.energy = Math.max(0, pet.energy - 1);

  if (pet.hunger === 0 || pet.energy === 0) {
    pet.hp = Math.max(0, pet.hp - 5);
  }

  if (pet.hp === 0) {
    alert("💀 Pet mati! Reset ke Level 1.");
    pet = { username: pet.username, coins: 0, level: 1, hp: 100, hunger: 100, energy: 100 };
  }

  save();
  updateUI();
}, 60000); // tiap menit

// Di game.js setelah login berhasil
db.ref("users/"+uid+"/coins").on("value", snap => {
  const coins = snap.val() || 0;
  document.getElementById("coins").textContent = coins.toFixed(2);
});

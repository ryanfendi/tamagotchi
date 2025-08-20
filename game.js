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
if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);

const db = firebase.database();
const auth = firebase.auth();

let user = null;
let pet = { level:1, hunger:100, energy:100, hp:100, coins:50 };
let inventory = [];

// ---------- AUTH ----------
function register() {
  let email = document.getElementById("email").value;
  let pass = document.getElementById("password").value;
  auth.createUserWithEmailAndPassword(email, pass).catch(e => alert(e.message));
}

function login() {
  let email = document.getElementById("email").value;
  let pass = document.getElementById("password").value;
  auth.signInWithEmailAndPassword(email, pass).catch(e => alert(e.message));
}

function logout() { auth.signOut(); }

auth.onAuthStateChanged(u => {
  if (u) {
    user = u;
    db.ref("users/" + u.uid).once("value", snap => {
      if (snap.exists()) {
        let data = snap.val();
        pet = data.pet || pet;
        inventory = data.inventory || [];
      }
      save();
      if (document.getElementById("gameUI")) updateUI();
    });
  } else {
    user = null;
  }
});

// ---------- SAVE ----------
function save() {
  if (user) {
    db.ref("users/" + user.uid).set({ pet, inventory });
  }
}

// ---------- UI ----------
function updateUI() {
  if (!user) return;
  document.getElementById("userInfo").innerText = `👤 ${user.email}`;
  document.getElementById("coinInfo").innerText = `💰 ${pet.coins.toFixed(2)} | Level ${pet.level}`;
  document.getElementById("status").innerText = `Hunger:${pet.hunger}% | Energy:${pet.energy}% | HP:${pet.hp}`;
}

// ---------- GAME ACTIONS ----------
function feedPet() {
  if (pet.coins < 1) return alert("Coin tidak cukup!");
  pet.coins -= 1;
  pet.hunger = Math.min(100, pet.hunger + 10);
  updateUI(); save();
}

function sleepPet() {
  if (pet.coins < 1) return alert("Coin tidak cukup!");
  pet.coins -= 1;
  pet.energy = Math.min(100, pet.energy + 10);
  updateUI(); save();
}

function earnCoin() { pet.coins += 0.01; updateUI(); save(); }

function levelUp() {
  if (pet.coins < 100) return alert("Coin tidak cukup!");
  pet.coins -= 100;
  pet.level++;
  updateUI(); save();
}

function buyPet() {
  if (pet.coins < 200) return alert("Coin tidak cukup!");
  pet.coins -= 200;
  let newPet = { name: "Pet Lv1", level:1 };
  inventory.push(newPet);
  alert("Pet baru masuk inventory!");
  updateUI(); save();
}

// HP Decay tiap menit
setInterval(() => {
  if (user) {
    pet.hunger = Math.max(0, pet.hunger - 1);
    pet.energy = Math.max(0, pet.energy - 1);
    if (pet.hunger === 0 || pet.energy === 0) pet.hp = Math.max(0, pet.hp - 20);
    if (pet.hp === 0) {
      alert("Pet mati! Mulai ulang Level 1");
      pet = { level:1,hunger:100,energy:100,hp:100,coins:0 };
    }
    updateUI(); save();
  }
}, 60000);

// ---------- INVENTORY ----------
function loadInventory() {
  auth.onAuthStateChanged(u => {
    if (!u) return;
    db.ref("users/" + u.uid + "/inventory").on("value", snap => {
      let inv = snap.val() || [];
      let box = document.getElementById("inventory");
      box.innerHTML = "";
      inv.forEach((item,i) => {
        let div = document.createElement("div");
        div.className="item";
        div.innerText = `${item.name || "Pet"} (Lv ${item.level || 1})`;
        box.appendChild(div);
      });
    });
  });
}

// ---------- MARKETPLACE ----------
function loadMarketplace() {
  let box = document.getElementById("market");
  db.ref("marketplace").on("value", snap => {
    box.innerHTML = "";
    snap.forEach(data => {
      let item = data.val();
      let div = document.createElement("div");
      div.className="item";
      div.innerHTML = `${item.name} | Harga: ${item.price} coin 
        <br><button onclick="buyFromMarket('${data.key}',${item.price})">Beli</button>`;
      box.appendChild(div);
    });
  });
}
function buyFromMarket(id, price) {
  if (pet.coins < price) return alert("Coin tidak cukup!");
  db.ref("marketplace/"+id).once("value",snap=>{
    if (!snap.exists()) return alert("Item sudah terjual");
    let item = snap.val();
    pet.coins -= price;
    inventory.push(item);
    db.ref("marketplace/"+id).remove();
    save();
    alert("Berhasil membeli item!");
  });
}

// ---------- CHAT ----------
function loadChat() {
  let box = document.getElementById("chatBox");
  db.ref("chat").on("child_added", snap => {
    let msg = snap.val();
    let p = document.createElement("p");
    p.innerText = `${msg.from}: ${msg.text}`;
    box.appendChild(p);
    box.scrollTop = box.scrollHeight;
  });
}
function sendChat() {
  let text = document.getElementById("chatMsg").value;
  if (!text) return;
  db.ref("chat").push({ from:user.email, text, time:Date.now() });
  document.getElementById("chatMsg").value="";
}
function sendPrivateChat() {
  let text = document.getElementById("chatMsg").value;
  let to = document.getElementById("privateTo").value;
  if (!text || !to) return;
  db.ref("privateChat").push({ from:user.email, to, text, time:Date.now() });
  alert("Pesan private terkirim!");
  document.getElementById("chatMsg").value="";
}

// ---------- OWNER PANEL ----------
function loadOwnerPanel() {
  let box = document.getElementById("topupRequests");
  db.ref("topupRequests").on("value", snap => {
    box.innerHTML="";
    snap.forEach(data => {
      let req = data.val();
      let div = document.createElement("div");
      div.className="section";
      div.innerHTML = `${req.email} minta ${req.coin} coin (Rp${req.harga}) - Status: ${req.status}
        <br><button onclick="approveTopup('${data.key}',${req.coin})">Approve</button>`;
      box.appendChild(div);
    });
  });
}
function approveTopup(id, coin) {
  if (!user) return;
  db.ref("topupRequests/"+id).once("value",snap=>{
    if (!snap.exists()) return;
    let req = snap.val();
    db.ref("users/"+req.uid+"/pet/coins").transaction(c => (c||0)+coin);
    db.ref("topupRequests/"+id+"/status").set("approved");
    alert("Top up disetujui!");
  });
}
function saveAd() {
  let txt=document.getElementById("adText").value;
  db.ref("ads/text").set(txt);
  alert("Iklan disimpan!");
}

// ---------- ADS ----------
db.ref("ads/text").on("value",snap=>{
  let el=document.querySelector("#ads p");
  if (el) el.innerText="📢 Iklan Teks: "+(snap.val()||"Pasang iklanmu di sini!");
});

// ---------- QRIS ----------
function topUpQRIS() {
  let jumlah=prompt("Jumlah coin (kelipatan 100):"); 
  jumlah=parseInt(jumlah);
  if(isNaN(jumlah) || jumlah<100 || jumlah%100!==0){ alert("Minimal 100 coin dan harus kelipatan 100!"); return; }
  let harga=(jumlah/100)*10000;
  db.ref("topupRequests").push({uid:user.uid,email:user.email,coin:jumlah,harga,status:"pending"});
  document.getElementById("qrisInfo").innerText=`Beli ${jumlah} coin = Rp${harga}`;
  document.getElementById("qrisImage").src=`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=PAY+${harga}+QRIS`;
  document.getElementById("qrisPopup").style.display="flex";
}
function closeQRIS(){ document.getElementById("qrisPopup").style.display="none"; }

// ---------- ADS POPUP ----------
function showPopupAd(){ alert("📢 Ini iklan pop-up! Hubungi admin untuk pasang iklan."); }

// ---------- NAVIGATION ----------
function goTo(page){ location.href=page; }

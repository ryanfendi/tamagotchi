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

let user=null, pet={level:1,hunger:100,energy:100,hp:100,coins:50};

// Auth listener
auth.onAuthStateChanged(u=>{
  if(u){
    user=u;
    db.ref("users/"+u.uid+"/pet").once("value",snap=>{
      if(snap.exists()) pet=snap.val();
      else db.ref("users/"+u.uid+"/pet").set(pet);
      updateUI(); save();
    });
    db.ref("users/"+u.uid+"/username").once("value",s=>{ 
      document.getElementById("userInfo").innerText=`👤 ${s.val()||u.email}`;
    });
  }else{
    window.location.href="index.html";
  }
});

function logout(){ auth.signOut(); }

// Save ke Firebase
function save(){ if(user) db.ref("users/"+user.uid+"/pet").set(pet); }

// Update UI
function updateUI(){
  document.getElementById("coinInfo").innerText=`💰 ${pet.coins.toFixed(2)} | Level ${pet.level}`;
  document.getElementById("status").innerText=`Hunger:${pet.hunger}% | Energy:${pet.energy}% | HP:${pet.hp}`;
}

// Actions
function feedPet(){ if(pet.coins>=1){ pet.coins--; pet.hunger=Math.min(100,pet.hunger+10); updateUI(); save(); } }
function sleepPet(){ if(pet.coins>=1){ pet.coins--; pet.energy=Math.min(100,pet.energy+10); updateUI(); save(); } }
function earnCoin(){ pet.coins+=0.01; updateUI(); save(); }
function levelUp(){ if(pet.coins>=100){ pet.coins-=100; pet.level++; updateUI(); save(); } }
function buyPet(){ if(pet.coins>=200){ pet.coins-=200; alert("Pet baru masuk inventory!"); updateUI(); save(); } }

// HP Decay per menit
setInterval(()=>{
  if(user){
    pet.hunger=Math.max(0,pet.hunger-1);
    pet.energy=Math.max(0,pet.energy-1);
    if(pet.hunger===0||pet.energy===0) pet.hp=Math.max(0,pet.hp-20);
    if(pet.hp===0){ alert("Pet mati! Reset Level 1"); pet={level:1,hunger:100,energy:100,hp:100,coins:0}; }
    updateUI(); save();
  }
},60000);

// Top Up QRIS
function topUpQRIS(){
  let jumlah=prompt("Jumlah coin (minimal 100, kelipatan 100):");
  jumlah=parseInt(jumlah);
  if(isNaN(jumlah) || jumlah<100 || jumlah%100!==0){ alert("Minimal 100 coin dan kelipatan 100!"); return; }
  let harga=(jumlah/100)*10000;
  db.ref("topupRequests").push({uid:user.uid,email:user.email,coin:jumlah,harga,status:"pending"});
  document.getElementById("qrisInfo").innerText=`Beli ${jumlah} coin = Rp${harga}`;
  document.getElementById("qrisImage").src=`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=PAY+${harga}+QRIS`;
  document.getElementById("qrisPopup").style.display="flex";
}
function closeQRIS(){ document.getElementById("qrisPopup").style.display="none"; }

// Ads
function showPopupAd(){ alert("📢 Ini iklan pop-up! Hubungi admin untuk pasang iklan."); }

// Canvas Pet
const canvas=document.getElementById("gameCanvas");
const ctx=canvas.getContext("2d");
ctx.imageSmoothingEnabled=false;
let frame=0;
function drawPet(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  let px=40+Math.sin(frame/10)*5; let py=60;
  ctx.fillStyle=pet.level<5?"#ffd07a":"#7af"; 
  ctx.fillRect(px,py,40,30);
  ctx.fillStyle="#111"; ctx.fillRect(px+8,py+8,5,5); ctx.fillRect(px+26,py+8,5,5);
  ctx.fillStyle=pet.hunger<20?"#f00":"#fff"; ctx.fillRect(px+18,py+18,4,4);
  frame++; requestAnimationFrame(drawPet);
}
drawPet();

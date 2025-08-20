<script type="module">
/* online.js – adaptor Firebase (Auth + Firestore) */
import { firebaseConfig } from './firebase-config.js';
import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/10.12.3/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, signOut, updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.3/firebase-auth.js";
import {
  getFirestore, collection, doc, getDoc, getDocs, setDoc, updateDoc,
  addDoc, deleteDoc, serverTimestamp, onSnapshot, query, orderBy, where
} from "https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js";

const app  = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getFirestore(app);

// =================== Helpers ===================
export function newPet(level=1){
  return { id: crypto.randomUUID(), level, hunger:100, energy:100, hp:100 };
}
export function nowMs(){ return Date.now(); }

export function onAuth(cb){
  return onAuthStateChanged(auth, user => cb(user));
}

export async function register({username, email, password}){
  // cek username unik (collection 'usernames' → map ke uid)
  const unameDoc = doc(db, 'usernames', username.toLowerCase());
  const unameSnap = await getDoc(unameDoc);
  if(unameSnap.exists()) throw new Error('Username sudah dipakai');

  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName: username });
  // simpan map username→uid
  await setDoc(unameDoc, { uid: cred.user.uid, createdAt: serverTimestamp() });
  // buat dok player
  const pDoc = doc(db, 'players', cred.user.uid);
  await setDoc(pDoc, {
    username: username.toLowerCase(),
    email,
    coins: 1000,
    pets: [ newPet(1) ],
    activePet: 0,
    lastTick: nowMs(),
    createdAt: serverTimestamp()
  });
  return cred.user;
}

export async function login({idOrEmail, password}){
  // jika mengandung '@' anggap email
  let email = idOrEmail.trim().toLowerCase();
  if(!email.includes('@')){
    // resolve dari username → uid → ambil email dari players
    const unameDoc = await getDoc(doc(db, 'usernames', email));
    if(!unameDoc.exists()) throw new Error('Username tidak terdaftar');
    const uid = unameDoc.data().uid;
    const pSnap = await getDoc(doc(db, 'players', uid));
    if(!pSnap.exists()) throw new Error('Akun tidak ditemukan');
    email = (pSnap.data().email || '').toLowerCase();
    if(!email) throw new Error('Akun ini belum punya email. Login memakai email.');
  }
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function logout(){ await signOut(auth); }

// =================== Players ===================
export async function getPlayer(uid){
  const snap = await getDoc(doc(db,'players',uid));
  return snap.exists() ? snap.data() : null;
}
export async function savePlayer(uid, data){
  await updateDoc(doc(db,'players',uid), data);
}
export function subPlayer(uid, cb){
  return onSnapshot(doc(db,'players',uid), (snap)=>{
    if(snap.exists()) cb(snap.data()); 
  });
}

// decay: jalankan di client, simpan lastTick
export function tickDecay(player){
  const p = player.pets[player.activePet] || player.pets[0];
  const now = nowMs();
  const last = player.lastTick || now;
  const diffMin = Math.floor((now - last)/60000);
  if(diffMin>0){
    for(let i=0;i<diffMin;i++){
      p.hunger = Math.max(0, p.hunger - 1);
      p.energy = Math.max(0, p.energy - 1);
      if(p.hunger===0 && p.energy===0){
        p.hp = Math.max(0, p.hp - 20);
      }
      if(p.hp<=0){
        // reset
        p.level=1; p.hunger=100; p.energy=100; p.hp=100;
      }
    }
    player.lastTick = now;
  }
}

// actions
export async function buyFeed(uid){
  const player = await getPlayer(uid);
  const p = player.pets[player.activePet];
  if(player.coins < 100) throw new Error('Coin tidak cukup');
  player.coins -= 100;
  p.hunger = Math.min(100, p.hunger+10);
  await savePlayer(uid, { coins: player.coins, pets: player.pets });
}
export async function buySleep(uid){
  const player = await getPlayer(uid);
  const p = player.pets[player.activePet];
  if(player.coins < 100) throw new Error('Coin tidak cukup');
  player.coins -= 100;
  p.energy = Math.min(100, p.energy+10);
  await savePlayer(uid, { coins: player.coins, pets: player.pets });
}
export async function tapCoin(uid){
  const player = await getPlayer(uid);
  player.coins += 10;
  await savePlayer(uid, { coins: player.coins });
}
export async function levelUp(uid){
  const player = await getPlayer(uid);
  const p = player.pets[player.activePet];
  if(player.coins < 100000) throw new Error('Coin tidak cukup');
  player.coins -= 100000;
  p.level += 1; p.hunger=100; p.energy=100; p.hp=100;
  await savePlayer(uid, { coins: player.coins, pets: player.pets });
}
export async function buyNewPet(uid){
  const player = await getPlayer(uid);
  const price = 200000 * (player.pets.length + 1);
  if(player.coins < price) throw new Error(`Harga ${price}`);
  player.coins -= price;
  player.pets.push(newPet(1));
  await savePlayer(uid, { coins: player.coins, pets: player.pets });
}
export async function setActivePet(uid, index){
  const player = await getPlayer(uid);
  if(index<0 || index>=player.pets.length) throw new Error('Index invalid');
  await savePlayer(uid, { activePet: index });
}

// =================== Marketplace ===================
// collection: market (docId auto) – { sellerUid, sellerName, pet, price, createdAt }
export function subMarket(cb){
  const qRef = query(collection(db,'market'), orderBy('createdAt','desc'));
  return onSnapshot(qRef, (snap)=>{
    const rows = [];
    snap.forEach(d=> rows.push({ id:d.id, ...d.data() }));
    cb(rows);
  });
}
export async function sellPet(uid, index, price){
  const player = await getPlayer(uid);
  if(index<0 || index>=player.pets.length) throw new Error('Index invalid');
  if(index===player.activePet) throw new Error('Tidak bisa menjual pet aktif');
  const pet = player.pets.splice(index,1)[0];
  if(player.activePet>index) player.activePet--;
  await savePlayer(uid, { pets: player.pets, activePet: player.activePet });
  await addDoc(collection(db,'market'), {
    sellerUid: uid, sellerName: player.username, pet, price,
    createdAt: serverTimestamp()
  });
}
export async function cancelSale(uid, saleId){
  const ref = doc(db,'market', saleId);
  const snap = await getDoc(ref);
  if(!snap.exists()) throw new Error('Item tidak ada');
  const item = snap.data();
  if(item.sellerUid!==uid) throw new Error('Bukan penjual');
  // kembalikan ke inventory
  const player = await getPlayer(uid);
  player.pets.push(item.pet);
  await savePlayer(uid, { pets: player.pets });
  await deleteDoc(ref);
}
export async function buy(uid, saleId){
  const ref = doc(db,'market', saleId);
  const snap = await getDoc(ref);
  if(!snap.exists()) throw new Error('Item tidak ada');
  const item = snap.data();
  if(item.sellerUid===uid) throw new Error('Tidak bisa beli item sendiri');

  const buyer  = await getPlayer(uid);
  const seller = await getPlayer(item.sellerUid);
  const price  = parseInt(item.price||0);
  if(buyer.coins < price) throw new Error('Coin tidak cukup');

  buyer.coins -= price;
  seller.coins = (seller.coins||0) + price;
  buyer.pets.push(item.pet);

  await savePlayer(uid, { coins: buyer.coins, pets: buyer.pets });
  await savePlayer(item.sellerUid, { coins: seller.coins });
  await deleteDoc(ref);
}

// =================== Coin Transfer ===================
export async function transfer(uidFrom, toUsername, amount){
  const unameDoc = await getDoc(doc(db,'usernames', toUsername.toLowerCase()));
  if(!unameDoc.exists()) throw new Error('Penerima tidak ditemukan');
  const toUid = unameDoc.data().uid;

  const from = await getPlayer(uidFrom);
  const to   = await getPlayer(toUid);
  const amt = parseInt(amount||0);
  if(!amt || amt<=0) throw new Error('Jumlah tidak valid');
  if(from.coins < amt) throw new Error('Coin tidak cukup');

  from.coins -= amt; to.coins = (to.coins||0) + amt;
  await savePlayer(uidFrom, { coins: from.coins });
  await savePlayer(toUid, { coins: to.coins });
}

// =================== Chat ===================
export function subChat(cb){
  const qRef = query(collection(db,'chats'), orderBy('createdAt','asc'));
  return onSnapshot(qRef, (snap)=>{
    const rows=[]; snap.forEach(d=> rows.push(d.data()));
    cb(rows);
  });
}
export async function sendChat(uid, msg){
  const p = await getPlayer(uid);
  await addDoc(collection(db,'chats'), {
    user: p.username, msg, createdAt: serverTimestamp()
  });
}

// =================== Owner ===================
export async function isOwner(uid){
  const p = await getPlayer(uid);
  return p?.username?.toLowerCase()==='owner';
}
export async function ownerTopup(targetUsername, amount){
  const unameDoc = await getDoc(doc(db,'usernames', targetUsername.toLowerCase()));
  if(!unameDoc.exists()) throw new Error('Player tidak ditemukan');
  const targetUid = unameDoc.data().uid;
  const p = await getPlayer(targetUid);
  p.coins = (p.coins||0) + parseInt(amount||0);
  await savePlayer(targetUid, { coins: p.coins });
}
export async function ownerSetLevel(targetUsername, level){
  const unameDoc = await getDoc(doc(db,'usernames', targetUsername.toLowerCase()));
  if(!unameDoc.exists()) throw new Error('Player tidak ditemukan');
  const targetUid = unameDoc.data().uid;
  const p = await getPlayer(targetUid);
  if(!p.pets?.length) throw new Error('Player tidak punya pet');
  const idx = p.activePet||0;
  p.pets[idx].level = parseInt(level||1);
  p.pets[idx].hunger=100; p.pets[idx].energy=100; p.pets[idx].hp=100;
  await savePlayer(targetUid, { pets: p.pets });
}
export async function ownerDeletePlayer(targetUsername){
  const unameRef = doc(db,'usernames', targetUsername.toLowerCase());
  const unameSnap = await getDoc(unameRef);
  if(!unameSnap.exists()) throw new Error('Player tidak ditemukan');
  const targetUid = unameSnap.data().uid;
  await deleteDoc(doc(db,'players', targetUid));
  await deleteDoc(unameRef);
}

// exported untuk dipakai halaman
export {
  signInWithEmailAndPassword, createUserWithEmailAndPassword
};
</script>

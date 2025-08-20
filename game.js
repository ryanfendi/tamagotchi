<script>
const cfg = {
  apiKey: "AIzaSyAN0GNZdIx_xPHT7MZKWJweLtNhies6QxY",
  authDomain: "tamagotchi-2be0c.firebaseapp.com",
  databaseURL: "https://tamagotchi-2be0c-default-rtdb.firebaseio.com",
  projectId: "tamagotchi-2be0c",
  storageBucket: "tamagotchi-2be0c.firebasestorage.app",
  messagingSenderId: "202052432703",
  appId: "1:202052432703:web:cb76b50e42149a2c92998a",
  measurementId: "G-TWGGSJRX26"
};
firebase.initializeApp(cfg);
const auth = firebase.auth(), db = firebase.database();

let uid = null;

auth.onAuthStateChanged(u=>{
  if(!u){ location.href="index.html"; return; }
  uid = u.uid;

  // === LISTENER REALTIME ===
  db.ref("users/"+uid).on("value", snap=>{
    const data = snap.val();
    if(!data) return;

    document.getElementById("coins").textContent = Number(data.coins||0).toFixed(2);
    document.getElementById("level").textContent = data.level || 1;
    document.getElementById("hunger").textContent = (data.hunger||100)+"%";
    document.getElementById("energy").textContent = (data.energy||100)+"%";
    document.getElementById("hp").textContent = (data.hp||100)+"%";
    
    // tampilkan sprite pet sesuai level
    updatePetSprite(data.level||1);
  });
});

// === contoh fungsi feed ===
function feedPet(){
  db.ref("users/"+uid).transaction(user=>{
    if(user){
      if((user.coins||0) >= 1){
        user.coins -= 1;
        user.hunger = Math.min((user.hunger||100)+10,100);
      }
    }
    return user;
  });
}

// === contoh fungsi sleep ===
function sleepPet(){
  db.ref("users/"+uid).transaction(user=>{
    if(user){
      if((user.coins||0) >= 1){
        user.coins -= 1;
        user.energy = Math.min((user.energy||100)+10,100);
      }
    }
    return user;
  });
}

// === contoh tap coin ===
function tapCoin(){
  db.ref("users/"+uid+"/coins").transaction(c=>(Number(c)||0)+0.01);
}

// === update sprite berdasarkan level ===
function updatePetSprite(level){
  const pet = document.getElementById("pet");
  if(!pet) return;
  if(level < 5){
    pet.src = "img/pet1.gif";
  } else if(level < 10){
    pet.src = "img/pet2.gif";
  } else {
    pet.src = "img/pet3.gif";
  }
}
</script>

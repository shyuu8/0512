let capture;
let faceMesh;
let handPose;
let faces = [];
let hands = [];

// === 耳環相關變數 ===
let earringImgs = [];
let currentEarring;

// === 臉譜相關變數 ===
let maskImgs = [];
let currentMask;
let lastMaskChangeTime = 0; // 記錄上次換臉譜的時間

function preload() {
  faceMesh = ml5.faceMesh({ maxFaces: 1, flipped: false });
  handPose = ml5.handPose({ maxHands: 2, flipped: false }); // 確保支援雙手

  // 載入 5 款耳環圖片
  earringImgs[1] = loadImage('acc1_ring.png');
  earringImgs[2] = loadImage('acc2_pearl.png');
  earringImgs[3] = loadImage('acc3_tassel.png');
  earringImgs[4] = loadImage('acc4_jade.png');
  earringImgs[5] = loadImage('acc5_phoenix.png');

  // 載入 6 款臉譜圖片
  for (let i = 1; i <= 6; i++) {
    maskImgs[i] = loadImage(i + '.png');
  }
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  
  capture = createCapture(VIDEO);
  capture.hide();

  if (faceMesh) faceMesh.detectStart(capture, gotFaces);
  if (handPose) handPose.detectStart(capture, gotHands);

  // 預設一開始顯示的圖片
  currentEarring = earringImgs[1]; 
  currentMask = maskImgs[1]; 
}

function draw() {
  background('#e7c6ff');

  let w = width * 0.5;
  let h = height * 0.5;
  let x = (width - w) / 2;
  let y = (height - h) / 2;

  push();
  translate(x + w, y);
  scale(-1, 1);

  image(capture, 0, 0, w, h);

  // --- 1. 先取得臉部位置資訊 (用來判斷手有沒有經過臉) ---
  let faceNose = null; 
  let faceWidthRaw = 0; // 臉部的原始寬度
  
  if (faces.length > 0) {
    let face = faces[0];
    faceNose = face.keypoints[1]; // 鼻尖特徵點
    let leftCheek = face.keypoints[234];
    let rightCheek = face.keypoints[454];
    // 計算臉頰兩側的距離當作臉寬
    faceWidthRaw = dist(leftCheek.x, leftCheek.y, rightCheek.x, rightCheek.y);
  }

  // --- 2. 🖐️ 手勢判斷邏輯 ---
  for (let i = 0; i < hands.length; i++) {
    let hand = hands[i];
    
    // 💡 鏡頭前 AI 判定的左右通常跟實體相反
    let isRightHand = hand.handedness === "Left";  // 現實的右手
    let isLeftHand = hand.handedness === "Right"; // 現實的左手

    // ➡️ 實體右手：比數字切換耳環
    if (isRightHand) {
      let fingerCount = countFingers(hand);
      if (fingerCount >= 1 && fingerCount <= 5) {
        currentEarring = earringImgs[fingerCount];
      }
    }

    // ⬅️ 實體左手：經過臉龐 (抹臉) 隨機切換臉譜
    if (isLeftHand) {
      if (faceNose) {
        // 取手掌中心點 (中指根部，節點 9) 作為手的座標
        let handCenter = hand.keypoints[9]; 
        // 計算手掌中心到鼻尖的距離
        let d = dist(handCenter.x, handCenter.y, faceNose.x, faceNose.y);

        // 如果手與鼻子的距離小於臉寬的 1.2 倍 (代表手遮住臉了)
        // 並且距離上次切換時間超過 0.8 秒 (800毫秒)
        if (d < faceWidthRaw * 1.2 && millis() - lastMaskChangeTime > 800) {
          let randomIndex = floor(random(1, 7)); // 產生 1~6 隨機整數
          currentMask = maskImgs[randomIndex];   // 換臉譜
          lastMaskChangeTime = millis();         // 更新時間
        }
      }
    }
  }

  // --- 3. 🧑 繪製臉譜與耳環 ---
  if (faces.length > 0) {
    let face = faces[0];
    let scaleX = w / capture.width;
    let scaleY = h / capture.height;

    // 🎭 先畫臉譜 (在底層)
    if (currentMask) {
      let nose = face.keypoints[1];        
      let leftCheek = face.keypoints[234]; 
      let rightCheek = face.keypoints[454];

      let faceWidth = dist(leftCheek.x, leftCheek.y, rightCheek.x, rightCheek.y) * scaleX * 1.8;
      let faceHeight = faceWidth * (currentMask.height / currentMask.width);

      push(); 
      imageMode(CENTER); 
      image(
        currentMask, 
        nose.x * scaleX, 
        nose.y * scaleY, 
        faceWidth, 
        faceHeight
      );
      pop();
    }

    // ✨ 再畫耳環 (在上層)
    if (currentEarring) {
      let leftEarlobe = face.keypoints[132];
      let rightEarlobe = face.keypoints[361];
      let imgSize = 40;

      if (leftEarlobe) {
        image(
          currentEarring,
          leftEarlobe.x * scaleX - imgSize / 2, 
          leftEarlobe.y * scaleY - imgSize / 2,
          imgSize, 
          imgSize 
        );
      }
      if (rightEarlobe) {
        image(
          currentEarring,
          rightEarlobe.x * scaleX - imgSize / 2, 
          rightEarlobe.y * scaleY - imgSize / 2,
          imgSize, 
          imgSize 
        );
      }
    }
  }
  pop();
}

function gotFaces(results) { faces = results; }
function gotHands(results) { hands = results; }

// 計算手指數量的函式
function countFingers(hand) {
  let fingers = 0;
  let kp = hand.keypoints;

  if (kp[8].y < kp[6].y) fingers++;  
  if (kp[12].y < kp[10].y) fingers++; 
  if (kp[16].y < kp[14].y) fingers++; 
  if (kp[20].y < kp[18].y) fingers++; 

  let dTip = dist(kp[4].x, kp[4].y, kp[17].x, kp[17].y);
  let dBase = dist(kp[2].x, kp[2].y, kp[17].x, kp[17].y);
  if (dTip > dBase * 1.1) fingers++;

  return fingers;
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
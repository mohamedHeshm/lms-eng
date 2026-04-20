// ================== Agora Live Video Module ==================
// API Key: 54a77810aa66409c99aaa8272ce1346c

const AGORA_APP_ID = "54a77810aa66409c99aaa8272ce1346c";

// Live Session Storage
let liveSessionState = {
  isTeacher: false,
  sessionActive: false,
  selectedStage: null,
  selectedStudents: [],
  stream: null,
  localAudioTrack: null,
  localVideoTrack: null,
  rtcClient: null,
  channelName: null,
  token: null,
  isMuted: false,
  isVideoOff: false,
  isScreenSharing: false
};

// Initialize Agora Client
async function initAgoraClient() {
  try {
    const AgoraRTC = window.AgoraRTC;
    
    liveSessionState.rtcClient = AgoraRTC.createClient({
      mode: "rtc",
      codec: "h264"
    });

    // Event listeners
    liveSessionState.rtcClient.on("user-published", onUserPublished);
    liveSessionState.rtcClient.on("user-unpublished", onUserUnpublished);
    liveSessionState.rtcClient.on("user-joined", onUserJoined);
    liveSessionState.rtcClient.on("user-left", onUserLeft);

    console.log("✅ Agora Client Initialized");
  } catch (error) {
    console.error("❌ Error initializing Agora:", error);
  }
}

// Generate Token (for production use backend to generate token)
async function generateToken(channelName, userId) {
  // For development, we'll use testing mode
  // In production, call your backend to generate token with RTCTokenBuilder
  return null; // Testing mode
}

// Join Channel
window.joinLiveChannel = async function(channelName, userId, role = 'broadcaster') {
  try {
    if (!liveSessionState.rtcClient) {
      await initAgoraClient();
    }

    const token = await generateToken(channelName, userId);
    
    await liveSessionState.rtcClient.join(AGORA_APP_ID, channelName, token, userId);
    
    liveSessionState.channelName = channelName;
    liveSessionState.sessionActive = true;
    
    if (role === 'broadcaster') {
      await createLocalTracks();
      await liveSessionState.rtcClient.publish([
        liveSessionState.localAudioTrack,
        liveSessionState.localVideoTrack
      ]);
    }

    console.log("✅ Joined channel:", channelName);
    return true;
  } catch (error) {
    console.error("❌ Error joining channel:", error);
    alert("❌ فشل الانضمام للجلسة: " + error.message);
    return false;
  }
}

// Create Local Tracks
async function createLocalTracks() {
  try {
    liveSessionState.localAudioTrack = await window.AgoraRTC.createMicrophoneAudioTrack();
    liveSessionState.localVideoTrack = await window.AgoraRTC.createCameraVideoTrack();

    // Play local video
    const localVideoDiv = document.getElementById("local-video-container");
    if (localVideoDiv) {
      liveSessionState.localVideoTrack.play("local-video-container");
    }

    console.log("✅ Local tracks created");
  } catch (error) {
    console.error("❌ Error creating tracks:", error);
    alert("❌ لا يمكن الوصول للكاميرا والميكروفون. تأكد من السماح بالاستخدام.");
  }
}

// Leave Channel
window.leaveLiveChannel = async function() {
  try {
    if (liveSessionState.localAudioTrack) {
      liveSessionState.localAudioTrack.close();
    }
    if (liveSessionState.localVideoTrack) {
      liveSessionState.localVideoTrack.close();
    }

    if (liveSessionState.rtcClient) {
      await liveSessionState.rtcClient.leave();
    }

    liveSessionState.sessionActive = false;
    
    // Clear video containers
    const localDiv = document.getElementById("local-video-container");
    const remoteDiv = document.getElementById("remote-video-container");
    if (localDiv) localDiv.innerHTML = "";
    if (remoteDiv) remoteDiv.innerHTML = "";

    console.log("✅ Left channel");
    return true;
  } catch (error) {
    console.error("❌ Error leaving channel:", error);
    return false;
  }
}

// Toggle Microphone
window.toggleMicrophone = async function() {
  try {
    if (!liveSessionState.localAudioTrack) return;

    if (liveSessionState.isMuted) {
      await liveSessionState.localAudioTrack.setEnabled(true);
      liveSessionState.isMuted = false;
      updateUI('mic-btn', 'تشغيل الميكروفون ✅', '#25d366');
    } else {
      await liveSessionState.localAudioTrack.setEnabled(false);
      liveSessionState.isMuted = true;
      updateUI('mic-btn', 'إيقاف الميكروفون ❌', '#ff5252');
    }
  } catch (error) {
    console.error("❌ Error toggling microphone:", error);
  }
}

// Toggle Camera
window.toggleCamera = async function() {
  try {
    if (!liveSessionState.localVideoTrack) return;

    if (liveSessionState.isVideoOff) {
      await liveSessionState.localVideoTrack.setEnabled(true);
      liveSessionState.isVideoOff = false;
      updateUI('camera-btn', 'تشغيل الكاميرا ✅', '#25d366');
    } else {
      await liveSessionState.localVideoTrack.setEnabled(false);
      liveSessionState.isVideoOff = true;
      updateUI('camera-btn', 'إيقاف الكاميرا ❌', '#ff5252');
    }
  } catch (error) {
    console.error("❌ Error toggling camera:", error);
  }
}

// Toggle Screen Share
window.toggleScreenShare = async function() {
  try {
    if (!liveSessionState.rtcClient || !liveSessionState.localVideoTrack) return;

    if (liveSessionState.isScreenSharing) {
      // Switch back to camera
      await liveSessionState.rtcClient.unpublish(liveSessionState.localVideoTrack);
      liveSessionState.localVideoTrack.close();
      
      liveSessionState.localVideoTrack = await window.AgoraRTC.createCameraVideoTrack();
      await liveSessionState.rtcClient.publish(liveSessionState.localVideoTrack);
      
      liveSessionState.isScreenSharing = false;
      updateUI('screen-btn', 'فتح مشاركة الشاشة', '#667eea');
    } else {
      // Switch to screen share
      await liveSessionState.rtcClient.unpublish(liveSessionState.localVideoTrack);
      liveSessionState.localVideoTrack.close();
      
      liveSessionState.localVideoTrack = await window.AgoraRTC.createScreenVideoTrack();
      await liveSessionState.rtcClient.publish(liveSessionState.localVideoTrack);
      
      liveSessionState.isScreenSharing = true;
      updateUI('screen-btn', 'إيقاف مشاركة الشاشة', '#ff5252');
    }
  } catch (error) {
    console.error("❌ Error toggling screen share:", error);
    alert("❌ لا يمكن مشاركة الشاشة");
  }
}

// Handle User Published
function onUserPublished(user, mediaType) {
  console.log("👤 User published:", user.uid, mediaType);
  
  liveSessionState.rtcClient.subscribe(user, mediaType).then(() => {
    if (mediaType === "video") {
      const remoteDiv = document.getElementById("remote-video-container");
      if (remoteDiv) {
        const videoDiv = document.createElement("div");
        videoDiv.id = "remote-video-" + user.uid;
        videoDiv.style.cssText = "width:100%; height:100%; object-fit:cover;";
        remoteDiv.appendChild(videoDiv);
        user.videoTrack.play("remote-video-" + user.uid);
      }
    }
    if (mediaType === "audio") {
      user.audioTrack.play();
    }
  }).catch(err => {
    console.error("Subscribe failed:", err);
  });
}

// Handle User Unpublished
function onUserUnpublished(user, mediaType) {
  console.log("👤 User unpublished:", user.uid, mediaType);
  if (mediaType === "video") {
    const videoDiv = document.getElementById("remote-video-" + user.uid);
    if (videoDiv) videoDiv.remove();
  }
}

// Handle User Joined
function onUserJoined(user) {
  console.log("👤 User joined:", user.uid);
  updateParticipantCount();
}

// Handle User Left
function onUserLeft(user) {
  console.log("👤 User left:", user.uid);
  updateParticipantCount();
}

// Update UI Helper
function updateUI(elementId, text, color = null) {
  const element = document.getElementById(elementId);
  if (element) {
    element.innerText = text;
    if (color) element.style.background = color;
  }
}

// Update Participant Count
function updateParticipantCount() {
  if (liveSessionState.rtcClient) {
    const count = liveSessionState.rtcClient.remoteUsers.length + 1;
    const counter = document.getElementById("participant-count");
    if (counter) {
      counter.innerText = count + " متصل";
    }
  }
}

// Load Script Dynamically
function loadAgoraScript() {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://download.agora.io/sdk/release/AgoraRTC_N-latest.js';
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

// Initialize
window.initLiveModule = async function() {
  try {
    await loadAgoraScript();
    await initAgoraClient();
    console.log("✅ Live Video Module Initialized");
  } catch (error) {
    console.error("❌ Error initializing module:", error);
  }
};

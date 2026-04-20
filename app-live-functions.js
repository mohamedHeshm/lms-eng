// ================== إضافة دوال الفيديو لايف إلى app.js ==================

// ================== Live Session Management ==================

// Get Active Live Sessions
window.getActiveLiveSessions = async function(teacherId = null, stage = null) {
  try {
    let query = supabase
      .from("live_sessions")
      .select("*")
      .eq("status", "active");

    if (teacherId) query = query.eq("teacher_id", teacherId);
    if (stage) query = query.eq("stage", stage);

    let { data, error } = await query;

    if (error) {
      console.error("❌ Error fetching sessions:", error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error("Error:", error);
    return [];
  }
};

// Create Live Session (Teacher)
window.createLiveSession = async function(stageId, selectedStudents, sessionName) {
  try {
    const currentUser = getCurrentUser();
    if (!currentUser || currentUser.role !== 'teacher') {
      alert("❌ يجب تسجيل الدخول كمدرس");
      return null;
    }

    const channelName = `live-${currentUser.id}-${Date.now()}`;

    let { data, error } = await supabase.from("live_sessions").insert([{
      teacher_id: currentUser.id,
      teacher_name: currentUser.name,
      stage: stageId,
      channel_name: channelName,
      selected_students: selectedStudents,
      session_name: sessionName || `جلسة ${currentUser.name}`,
      status: "active",
      created_at: new Date().toISOString(),
      started_at: new Date().toISOString()
    }]).select();

    if (error) {
      alert("❌ خطأ: " + error.message);
      return null;
    }

    console.log("✅ Live session created:", data);
    return data[0] || null;
  } catch (error) {
    console.error("Error creating session:", error);
    alert("❌ خطأ في إنشاء الجلسة");
    return null;
  }
};

// End Live Session (Teacher)
window.endLiveSession = async function(sessionId) {
  try {
    let { error } = await supabase
      .from("live_sessions")
      .update({
        status: "ended",
        ended_at: new Date().toISOString()
      })
      .eq("id", sessionId);

    if (error) {
      console.error("❌ Error ending session:", error);
      return false;
    }

    console.log("✅ Live session ended");
    return true;
  } catch (error) {
    console.error("Error:", error);
    return false;
  }
};

// Get Session Participants
window.getSessionParticipants = async function(sessionId) {
  try {
    let { data, error } = await supabase
      .from("live_participants")
      .select("*")
      .eq("session_id", sessionId)
      .eq("active", true);

    if (error) {
      console.error("Error fetching participants:", error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error("Error:", error);
    return [];
  }
};

// Add Participant to Session
window.addSessionParticipant = async function(sessionId, userId, participantType = 'student') {
  try {
    let { error } = await supabase.from("live_participants").insert([{
      session_id: sessionId,
      user_id: userId,
      participant_type: participantType,
      joined_at: new Date().toISOString(),
      active: true
    }]);

    if (error) {
      console.error("Error adding participant:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error:", error);
    return false;
  }
};

// Remove Participant from Session
window.removeSessionParticipant = async function(sessionId, userId) {
  try {
    let { error } = await supabase
      .from("live_participants")
      .update({ active: false, left_at: new Date().toISOString() })
      .eq("session_id", sessionId)
      .eq("user_id", userId);

    if (error) {
      console.error("Error removing participant:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error:", error);
    return false;
  }
};

// Save Chat Message
window.saveChatMessage = async function(sessionId, userId, userName, message) {
  try {
    let { error } = await supabase.from("live_chat").insert([{
      session_id: sessionId,
      user_id: userId,
      user_name: userName,
      message: message,
      timestamp: new Date().toISOString()
    }]);

    if (error) {
      console.error("Error saving message:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error:", error);
    return false;
  }
};

// Get Chat Messages
window.getChatMessages = async function(sessionId, limit = 50) {
  try {
    let { data, error } = await supabase
      .from("live_chat")
      .select("*")
      .eq("session_id", sessionId)
      .order("timestamp", { ascending: true })
      .limit(limit);

    if (error) {
      console.error("Error fetching messages:", error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error("Error:", error);
    return [];
  }
};

// Save Recording
window.saveRecording = async function(sessionId, recordingUrl, duration) {
  try {
    let { error } = await supabase.from("live_recordings").insert([{
      session_id: sessionId,
      recording_url: recordingUrl,
      duration_seconds: duration,
      created_at: new Date().toISOString()
    }]);

    if (error) {
      console.error("Error saving recording:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error:", error);
    return false;
  }
};

// Get Teacher's Stage Students
window.getStageStudents = async function(teacherId, stage) {
  try {
    let { data, error } = await supabase
      .from("users")
      .select("id, name, email, stage")
      .eq("teacher_id", teacherId)
      .eq("stage", stage)
      .eq("role", "student")
      .eq("is_active", true);

    if (error) {
      console.error("Error fetching students:", error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error("Error:", error);
    return [];
  }
};

// Get All Stages
window.getAllStages = async function() {
  try {
    let { data, error } = await supabase
      .from("users")
      .select("stage")
      .eq("role", "student")
      .eq("is_active", true)
      .distinct();

    if (error) {
      console.error("Error fetching stages:", error);
      return [];
    }

    // Map stage codes to names
    const stageMap = {
      'primary': 'المرحلة الابتدائية',
      'middle': 'المرحلة الإعدادية',
      'secondary': 'المرحلة الثانوية'
    };

    return (data || []).map(item => ({
      code: item.stage,
      name: stageMap[item.stage] || item.stage
    })).filter((item, idx, arr) => arr.findIndex(x => x.code === item.code) === idx);
  } catch (error) {
    console.error("Error:", error);
    return [];
  }
};

// Teacher - Load Students for Stage Selection
window.loadTeacherStageStudents = async function() {
  try {
    const currentUser = getCurrentUser();
    if (!currentUser || currentUser.role !== 'teacher') return;

    const stageSelect = document.getElementById('stageSelect');
    if (!stageSelect) return;

    const selectedStage = stageSelect.value;
    const students = await window.getStageStudents(currentUser.id, selectedStage);

    const studentsList = document.getElementById('studentsList');
    if (!studentsList) return;

    if (students.length === 0) {
      studentsList.innerHTML = '<p style="color:#999; text-align:center;">📭 لا يوجد طلاب في هذه المرحلة</p>';
      return;
    }

    let html = '';
    students.forEach(student => {
      html += `
        <div class="student-item">
          <input type="checkbox" class="student-checkbox" value="${student.id}" data-name="${escapeHtml(student.name)}" onchange="updateSelectedCount()">
          <label>${escapeHtml(student.name)}</label>
        </div>
      `;
    });

    studentsList.innerHTML = html;
  } catch (error) {
    console.error("Error loading students:", error);
  }
};

// Initialize Live Feature (Load Stages)
window.initializeLiveFeature = async function() {
  try {
    const stageSelect = document.getElementById('stageSelect');
    if (!stageSelect) return;

    const stages = await window.getAllStages();
    
    let html = '<option value="">-- اختر المرحلة --</option>';
    stages.forEach(stage => {
      html += `<option value="${stage.code}">${stage.name}</option>`;
    });

    stageSelect.innerHTML = html;
    console.log("✅ Live feature initialized");
  } catch (error) {
    console.error("Error initializing live feature:", error);
  }
};

// Check for New Live Sessions (Polling)
window.startLiveSessionChecker = async function(checkInterval = 5000) {
  const currentUser = getCurrentUser();
  
  if (!currentUser) return;

  setInterval(async () => {
    try {
      if (currentUser.role === 'student') {
        // Check if teacher has started a live session
        const sessions = await window.getActiveLiveSessions(
          currentUser.teacher_id,
          currentUser.stage
        );

        if (sessions.length > 0) {
          // Show notification
          const indicator = document.getElementById('liveIndicator');
          if (indicator) {
            indicator.style.display = 'block';
          }

          // Optional: Auto open the live modal
          // openStudentLive();
        }
      }
    } catch (error) {
      console.error("Error checking live sessions:", error);
    }
  }, checkInterval);
};

// Database Schema Required:
/*
CREATE TABLE live_sessions (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  teacher_id BIGINT NOT NULL REFERENCES users(id),
  teacher_name TEXT NOT NULL,
  stage VARCHAR(50) NOT NULL,
  channel_name VARCHAR(255) UNIQUE NOT NULL,
  selected_students TEXT[] DEFAULT '{}',
  session_name TEXT,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'ended')),
  created_at TIMESTAMP DEFAULT NOW(),
  started_at TIMESTAMP,
  ended_at TIMESTAMP
);

CREATE TABLE live_participants (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  session_id BIGINT NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id),
  participant_type VARCHAR(20) DEFAULT 'student',
  joined_at TIMESTAMP DEFAULT NOW(),
  left_at TIMESTAMP,
  active BOOLEAN DEFAULT TRUE
);

CREATE TABLE live_chat (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  session_id BIGINT NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id),
  user_name TEXT NOT NULL,
  message TEXT NOT NULL,
  timestamp TIMESTAMP DEFAULT NOW()
);

CREATE TABLE live_recordings (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  session_id BIGINT NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
  recording_url TEXT NOT NULL,
  duration_seconds INT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for better performance
CREATE INDEX idx_live_sessions_teacher_stage ON live_sessions(teacher_id, stage, status);
CREATE INDEX idx_live_participants_session ON live_participants(session_id, active);
CREATE INDEX idx_live_chat_session ON live_chat(session_id, timestamp);
*/

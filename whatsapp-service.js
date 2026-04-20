// ==================== وظائف إرسال رسائل الواتساب ====================
// هذا الملف يحتوي على الدوال المساعدة لإرسال رسائل الواتساب

/**
 * إرسال رسالة واتساب عبر Twilio API
 * @param {string} toNumber - رقم هاتف المستقبل (بصيغة دولية)
 * @param {string} message - نص الرسالة
 * @param {string} accountSid - معرّف حساب Twilio
 * @param {string} authToken - رمز التفويض
 */
async function sendWhatsAppViaTwilio(toNumber, message, accountSid, authToken) {
  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    
    const params = new URLSearchParams();
    params.append('From', 'whatsapp:+1234567890'); // استبدل برقمك
    params.append('To', `whatsapp:+${toNumber}`);
    params.append('Body', message);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa(accountSid + ':' + authToken),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params
    });
    
    return await response.json();
  } catch (error) {
    console.error('خطأ في إرسال الرسالة عبر Twilio:', error);
    return null;
  }
}

/**
 * إرسال رسالة واتساب عبر WhatsApp Cloud API
 * @param {string} toNumber - رقم هاتف المستقبل
 * @param {string} message - نص الرسالة
 * @param {string} phoneNumberId - معرّف رقم الهاتف
 * @param {string} accessToken - رمز الوصول
 */
async function sendWhatsAppViaCloudAPI(toNumber, message, phoneNumberId, accessToken) {
  try {
    const url = `https://graph.instagram.com/v18.0/${phoneNumberId}/messages`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: toNumber,
        type: 'text',
        text: {
          preview_url: false,
          body: message
        }
      })
    });
    
    return await response.json();
  } catch (error) {
    console.error('خطأ في إرسال الرسالة عبر Cloud API:', error);
    return null;
  }
}

/**
 * إرسال رسالة واتساب عبر خدمة محلية (موصى به)
 * تحفظ الرسالة في قاعدة البيانات للمعالجة اللاحقة
 * @param {string} toPhone - رقم الهاتف
 * @param {string} message - نص الرسالة
 * @param {object} supabase - عميل Supabase
 * @param {string} teacherId - معرّف المدرس
 */
async function sendWhatsAppMessage(toPhone, message, supabase, teacherId) {
  try {
    // حفظ الرسالة في قاعدة البيانات
    const { data, error } = await supabase
      .from('whatsapp_messages')
      .insert([{
        to_phone: toPhone,
        message: message,
        teacher_id: teacherId,
        sent: false,
        created_at: new Date().toISOString()
      }]);
    
    if (error) {
      console.error('خطأ في حفظ الرسالة:', error);
      return { success: false, error: error.message };
    }
    
    console.log('✅ تم حفظ الرسالة في قائمة الانتظار للإرسال');
    return { success: true, data: data };
    
  } catch (error) {
    console.error('خطأ:', error);
    return { success: false, error: error.message };
  }
}

/**
 * دالة معالجة الرسائل المعلقة (للاستخدام في الخادم)
 * يجب تشغيلها بشكل دوري (كل 5 دقائق مثلاً)
 */
async function processPendingMessages(supabase, whatsappConfig) {
  try {
    // الحصول على الرسائل غير المرسلة
    const { data: pendingMessages, error } = await supabase
      .from('whatsapp_messages')
      .select('*')
      .eq('sent', false)
      .limit(10); // معالجة 10 رسائل في كل مرة
    
    if (error || !pendingMessages) {
      console.error('خطأ في جلب الرسائل:', error);
      return;
    }
    
    // إرسال كل رسالة
    for (const msg of pendingMessages) {
      try {
        // اختر طريقة الإرسال حسب الإعدادات
        let result;
        
        if (whatsappConfig.type === 'twilio') {
          result = await sendWhatsAppViaTwilio(
            msg.to_phone,
            msg.message,
            whatsappConfig.accountSid,
            whatsappConfig.authToken
          );
        } else if (whatsappConfig.type === 'cloudapi') {
          result = await sendWhatsAppViaCloudAPI(
            msg.to_phone,
            msg.message,
            whatsappConfig.phoneNumberId,
            whatsappConfig.accessToken
          );
        }
        
        // تحديث حالة الرسالة
        if (result && result.sid) {
          await supabase
            .from('whatsapp_messages')
            .update({
              sent: true,
              sent_at: new Date().toISOString()
            })
            .eq('id', msg.id);
          
          console.log(`✅ تم إرسال رسالة إلى ${msg.to_phone}`);
        }
        
      } catch (err) {
        console.error(`❌ فشل إرسال رسالة إلى ${msg.to_phone}:`, err);
      }
    }
    
  } catch (error) {
    console.error('خطأ في معالجة الرسائل:', error);
  }
}

/**
 * إنشاء نموذج رسالة تنبيه موحد
 * @param {string} studentName - اسم الطالب
 * @param {number} grade - درجة الطالب
 * @param {number} threshold - الحد الأدنى
 * @param {string} gradeType - نوع الدرجة
 * @param {string} teacherName - اسم المدرس
 */
function createGradeAlertMessage(studentName, grade, threshold, gradeType, teacherName) {
  const typeText = gradeType === 'exam' ? 'امتحان' : 'مشاركة';
  
  return `
📢 تنبيه من مدرسك

👤 الطالب: ${studentName}
📝 النوع: ${typeText}
📊 الدرجة: ${grade}
⚠️ الحد الأدنى المطلوب: ${threshold}
👨‍🏫 المدرس: ${teacherName}

💡 يرجى مساعدة الطالب على التركيز في الدراسة

---
تم إرسال هذه الرسالة من نظام إدارة الدرجات
  `.trim();
}

/**
 * إنشاء نموذج رسالة تهنئة للطالب المتفوق
 * @param {string} studentName - اسم الطالب
 * @param {number} grade - الدرجة
 * @param {string} teacherName - اسم المدرس
 */
function createPraiseMessage(studentName, grade, teacherName) {
  return `
🎉 تهانينا!

👤 الطالب: ${studentName}
⭐ حصل على درجة ممتازة: ${grade}/100
👨‍🏫 من: ${teacherName}

🏆 استمر في هذا الأداء الرائع!

---
تم إرسال هذه الرسالة من نظام إدارة الدرجات
  `.trim();
}

/**
 * إرسال رسالة بحالة الطالب الدوري (تقرير أسبوعي)
 * @param {string} parentPhone - رقم هاتف الولي
 * @param {object} studentData - بيانات الطالب
 * @param {object} supabase - عميل Supabase
 */
async function sendWeeklyReportMessage(parentPhone, studentData, supabase, teacherId) {
  try {
    const message = `
📊 تقرير أسبوعي لـ ${studentData.name}

✅ عدد الحاضرات: ${studentData.presentDays}
❌ عدد الغيابات: ${studentData.absentDays}
⏰ عدد التأخرات: ${studentData.lateDays}
📈 متوسط الدرجات: ${studentData.averageGrade}/100

🎯 الأهداف:
- الحضور المنتظم ضروري
- العمل على تحسين الدرجات

📞 للتواصل مع المدرس: تواصل عبر التطبيق

---
تم إرسال هذه الرسالة من نظام إدارة الدرجات
    `.trim();
    
    return await sendWhatsAppMessage(parentPhone, message, supabase, teacherId);
    
  } catch (error) {
    console.error('خطأ في إرسال التقرير:', error);
    return { success: false, error: error.message };
  }
}

/**
 * التحقق من صيغة رقم الهاتف
 * @param {string} phone - رقم الهاتف
 * @returns {boolean} هل الرقم صحيح
 */
function isValidPhoneNumber(phone) {
  // إزالة المسافات والشطوط
  const cleanPhone = phone.replace(/[\s-]/g, '');
  
  // التحقق من أن الرقم يحتوي على أرقام فقط وطول مناسب
  return /^[0-9]{10,15}$/.test(cleanPhone);
}

/**
 * تحويل رقم الهاتف إلى الصيغة الدولية
 * @param {string} phone - رقم الهاتف
 * @param {string} countryCode - رمز الدولة (مثال: 'EG')
 * @returns {string} الرقم بالصيغة الدولية
 */
function formatPhoneNumber(phone, countryCode = 'EG') {
  let cleanPhone = phone.replace(/[\s-]/g, '');
  
  // إذا كان الرقم يبدأ بـ 0، أزله وأضف رمز الدولة
  if (cleanPhone.startsWith('0')) {
    cleanPhone = cleanPhone.slice(1);
  }
  
  // إذا كان الرقم يبدأ برمز الدولة، أزله
  const countryCodeMap = {
    'EG': '20',
    'SA': '966',
    'AE': '971',
    'US': '1'
  };
  
  const code = countryCodeMap[countryCode] || '20';
  
  if (cleanPhone.startsWith(code)) {
    return cleanPhone;
  }
  
  return code + cleanPhone;
}

/**
 * تسجيل محاولة إرسال فاشلة
 * @param {object} supabase - عميل Supabase
 * @param {string} messageId - معرّف الرسالة
 * @param {string} error - نص الخطأ
 */
async function logFailedAttempt(supabase, messageId, error) {
  try {
    await supabase
      .from('whatsapp_send_logs')
      .insert([{
        message_id: messageId,
        error_message: error,
        attempted_at: new Date().toISOString(),
        status: 'failed'
      }]);
  } catch (err) {
    console.error('خطأ في تسجيل محاولة الإرسال:', err);
  }
}

/**
 * الحصول على حالة الرسائل
 * @param {object} supabase - عميل Supabase
 * @param {string} teacherId - معرّف المدرس
 */
async function getMessageStats(supabase, teacherId) {
  try {
    const { data, error } = await supabase
      .from('whatsapp_messages')
      .select('*')
      .eq('teacher_id', teacherId);
    
    if (error || !data) return null;
    
    return {
      total: data.length,
      sent: data.filter(m => m.sent).length,
      pending: data.filter(m => !m.sent).length,
      sentPercentage: Math.round((data.filter(m => m.sent).length / data.length) * 100) || 0
    };
  } catch (error) {
    console.error('خطأ في جلب الإحصائيات:', error);
    return null;
  }
}

/**
 * حذف الرسائل القديمة (أكثر من 30 يوماً)
 * @param {object} supabase - عميل Supabase
 */
async function deleteOldMessages(supabase) {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const { error } = await supabase
      .from('whatsapp_messages')
      .delete()
      .lt('created_at', thirtyDaysAgo.toISOString());
    
    if (error) {
      console.error('خطأ في حذف الرسائل القديمة:', error);
      return false;
    }
    
    console.log('✅ تم حذف الرسائل القديمة');
    return true;
    
  } catch (error) {
    console.error('خطأ:', error);
    return false;
  }
}

// تصدير الدوال للاستخدام في ملفات أخرى
export {
  sendWhatsAppViaTwilio,
  sendWhatsAppViaCloudAPI,
  sendWhatsAppMessage,
  processPendingMessages,
  createGradeAlertMessage,
  createPraiseMessage,
  sendWeeklyReportMessage,
  isValidPhoneNumber,
  formatPhoneNumber,
  logFailedAttempt,
  getMessageStats,
  deleteOldMessages
};

// ==================== ملف خادم Node.js لمعالجة رسائل الواتساب ====================
// استخدم هذا الملف إذا كان لديك خادم Node.js خاص بك

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// تحميل المتغيرات البيئية
dotenv.config()

// تهيئة Supabase
const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

// ==================== إعدادات الواتساب ====================

const WHATSAPP_CONFIG = {
  // اختر واحدة من الخيارات التالية
  type: process.env.WHATSAPP_TYPE || 'cloudapi', // 'twilio' أو 'cloudapi'
  
  // إذا كنت تستخدم Twilio
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    fromNumber: process.env.TWILIO_WHATSAPP_NUMBER
  },
  
  // إذا كنت تستخدم Cloud API
  cloudapi: {
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
    businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID
  }
};

// ==================== دوال المساعدة ====================

/**
 * إرسال رسالة عبر Twilio
 */
async function sendViaTwilio(toNumber, messageText) {
  try {
    const twilio = require('twilio');
    const client = twilio(WHATSAPP_CONFIG.twilio.accountSid, WHATSAPP_CONFIG.twilio.authToken);
    
    const message = await client.messages.create({
      from: `whatsapp:${WHATSAPP_CONFIG.twilio.fromNumber}`,
      to: `whatsapp:+${toNumber}`,
      body: messageText
    });
    
    return { success: true, sid: message.sid };
  } catch (error) {
    console.error('❌ خطأ Twilio:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * إرسال رسالة عبر Cloud API
 */
async function sendViaCloudAPI(toNumber, messageText) {
  try {
    const response = await fetch(
      `https://graph.instagram.com/v18.0/${WHATSAPP_CONFIG.cloudapi.phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${WHATSAPP_CONFIG.cloudapi.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: toNumber,
          type: 'text',
          text: {
            preview_url: false,
            body: messageText
          }
        })
      }
    );
    
    const data = await response.json();
    
    if (data.messages && data.messages[0]) {
      return { success: true, id: data.messages[0].id };
    } else {
      return { success: false, error: data.error?.message || 'خطأ غير معروف' };
    }
  } catch (error) {
    console.error('❌ خطأ Cloud API:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * دالة أساسية لإرسال الرسائل
 */
async function sendMessage(toNumber, messageText) {
  if (WHATSAPP_CONFIG.type === 'twilio') {
    return await sendViaTwilio(toNumber, messageText);
  } else if (WHATSAPP_CONFIG.type === 'cloudapi') {
    return await sendViaCloudAPI(toNumber, messageText);
  } else {
    return { success: false, error: 'نوع الواتساب غير محدد' };
  }
}

/**
 * معالجة الرسائل المعلقة
 */
async function processPendingMessages() {
  try {
    console.log('🔄 جاري معالجة الرسائل المعلقة...');
    
    // جلب الرسائل غير المرسلة
    const { data: pendingMessages, error } = await supabase
      .from('whatsapp_messages')
      .select('*')
      .eq('sent', false)
      .limit(50); // معالجة 50 رسالة في كل دورة
    
    if (error) {
      console.error('❌ خطأ في جلب الرسائل:', error.message);
      return { processed: 0, sent: 0, failed: 0 };
    }
    
    if (!pendingMessages || pendingMessages.length === 0) {
      console.log('✅ لا توجد رسائل معلقة');
      return { processed: 0, sent: 0, failed: 0 };
    }
    
    console.log(`📤 عدد الرسائل المعلقة: ${pendingMessages.length}`);
    
    let sent = 0;
    let failed = 0;
    
    // معالجة كل رسالة
    for (const msg of pendingMessages) {
      try {
        // إرسال الرسالة
        const result = await sendMessage(msg.to_phone, msg.message);
        
        if (result.success) {
          // تحديث حالة الرسالة في قاعدة البيانات
          const { error: updateError } = await supabase
            .from('whatsapp_messages')
            .update({
              sent: true,
              sent_at: new Date().toISOString()
            })
            .eq('id', msg.id);
          
          if (!updateError) {
            console.log(`✅ تم إرسال رسالة إلى: ${msg.to_phone}`);
            sent++;
          } else {
            console.error(`❌ فشل تحديث الرسالة: ${msg.id}`);
            failed++;
          }
        } else {
          console.error(`❌ فشل إرسال رسالة إلى ${msg.to_phone}: ${result.error}`);
          
          // تسجيل محاولة الإرسال الفاشلة
          await logFailedAttempt(msg.id, result.error);
          failed++;
        }
        
        // تأخير صغير لتجنب الحد من معدل الطلبات
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (err) {
        console.error(`❌ خطأ في معالجة الرسالة ${msg.id}:`, err.message);
        failed++;
      }
    }
    
    return {
      processed: pendingMessages.length,
      sent: sent,
      failed: failed
    };
    
  } catch (error) {
    console.error('❌ خطأ في معالجة الرسائل:', error.message);
    return { processed: 0, sent: 0, failed: 0 };
  }
}

/**
 * تسجيل محاولة الإرسال الفاشلة
 */
async function logFailedAttempt(messageId, error) {
  try {
    const { error: logError } = await supabase
      .from('whatsapp_send_logs')
      .insert([{
        message_id: messageId,
        error_message: error,
        attempted_at: new Date().toISOString(),
        status: 'failed'
      }]);
    
    if (logError) {
      console.error('❌ فشل تسجيل الخطأ:', logError.message);
    }
  } catch (err) {
    console.error('❌ خطأ في تسجيل محاولة الإرسال:', err.message);
  }
}

/**
 * حذف الرسائل القديمة
 */
async function deleteOldMessages() {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const { data, error } = await supabase
      .from('whatsapp_messages')
      .delete()
      .lt('created_at', thirtyDaysAgo.toISOString());
    
    if (error) {
      console.error('❌ خطأ في حذف الرسائل القديمة:', error.message);
      return false;
    }
    
    console.log('✅ تم حذف الرسائل القديمة');
    return true;
    
  } catch (error) {
    console.error('❌ خطأ:', error.message);
    return false;
  }
}

/**
 * حساب إحصائيات الرسائل
 */
async function getMessageStatistics() {
  try {
    const { data, error } = await supabase
      .from('whatsapp_messages')
      .select('sent');
    
    if (error || !data) return null;
    
    const total = data.length;
    const sentCount = data.filter(m => m.sent).length;
    const pendingCount = total - sentCount;
    
    return {
      total: total,
      sent: sentCount,
      pending: pendingCount,
      successRate: total > 0 ? Math.round((sentCount / total) * 100) : 0
    };
  } catch (error) {
    console.error('❌ خطأ في حساب الإحصائيات:', error.message);
    return null;
  }
}

// ==================== الدالة الرئيسية ====================

async function main() {
  console.log('🚀 بدء معالج رسائل الواتساب');
  console.log(`⚙️ نوع الواتساب المستخدم: ${WHATSAPP_CONFIG.type}`);
  
  // معالجة الرسائل المعلقة
  const result = await processPendingMessages();
  
  console.log(`
📊 النتائج:
  - إجمالي المعالجة: ${result.processed}
  - تم الإرسال بنجاح: ${result.sent}
  - فشل الإرسال: ${result.failed}
  `);
  
  // الحصول على الإحصائيات
  const stats = await getMessageStatistics();
  if (stats) {
    console.log(`
📈 الإحصائيات الإجمالية:
  - إجمالي الرسائل: ${stats.total}
  - الرسائل المرسلة: ${stats.sent}
  - الرسائل المعلقة: ${stats.pending}
  - معدل النجاح: ${stats.successRate}%
    `);
  }
  
  // حذف الرسائل القديمة (اختياري - مرة واحدة يومياً)
  if (new Date().getHours() === 2) { // في الساعة 2 صباحاً
    console.log('🗑️ جاري حذف الرسائل القديمة...');
    await deleteOldMessages();
  }
}

// ==================== الجدول الزمني ====================

// معالجة الرسائل كل 5 دقائق
setInterval(processPendingMessages, 5 * 60 * 1000);

// تشغيل المعالج الأول فوراً
main();

// ==================== المتغيرات البيئية المطلوبة ====================

/*
أضف هذه المتغيرات في ملف .env:

SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-supabase-key

WHATSAPP_TYPE=cloudapi

# إذا كنت تستخدم Cloud API:
WHATSAPP_PHONE_NUMBER_ID=your-phone-number-id
WHATSAPP_ACCESS_TOKEN=your-access-token
WHATSAPP_BUSINESS_ACCOUNT_ID=your-business-account-id

# أو إذا كنت تستخدم Twilio:
TWILIO_ACCOUNT_SID=your-account-sid
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_WHATSAPP_NUMBER=+1234567890
*/

// ==================== تشغيل البرنامج ====================

// node whatsapp-processor.js

console.log('✅ معالج الواتساب نشط وجاهز للعمل');

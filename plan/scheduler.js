const cron = require('node-cron');
const pool = require('./db/connection'); 
const nodemailer = require('nodemailer');

// --- .env 파일에서 환경 변수 로드 ---
const EMAIL_USER = process.env.EMAIL_USER; 
const EMAIL_PASS = process.env.EMAIL_PASS; // Gmail "앱 비밀번호"

// --- Nodemailer Transporter 설정 ---
// (auth.js, memos.js와 동일하게 transporter를 설정합니다)
let transporter;
if (EMAIL_USER && EMAIL_PASS) {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASS,
    },
  });
}

// --- 날짜 포맷팅 헬퍼 함수 ---
// (new Date()를 'YYYY-MM-DD' 형식으로 변경)
function getFormattedDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// --- (★핵심★) 예약 알림 이메일 전송 작업 ---
const sendReminderEmails = async () => {
  if (!transporter) {
    console.log('[Scheduler] 이메일 전송기 설정 안됨. 예약 알림을 건너뜁니다.');
    return;
  }

  console.log('[Scheduler] 자정 예약 작업 실행: 알림 이메일 발송을 시작합니다...');

  // 1. 오늘 날짜 (D-Day)
  const today = new Date();
  const todayDateKey = getFormattedDate(today);

  // 2. 7일 후 날짜 (D-7)
  const sevenDaysFromNow = new Date();
  sevenDaysFromNow.setDate(today.getDate() + 7);
  const sevenDayDateKey = getFormattedDate(sevenDaysFromNow);

  try {
    // 3. DB에서 오늘 또는 7일 뒤가 D-Day이고, 알림 설정(sendEmail=1)이 켜져 있으며,
    //    아직 해당 알림('notified_today' or 'notified_7day')을 받지 않은 일정을 모두 찾습니다.
    //    (★중요★) users 테이블과 JOIN하여 사용자의 이메일과 닉네임도 가져옵니다.
    const query = `
      SELECT 
        m.id, m.title, m.dateKey,
        u.email, u.nickname
      FROM memos m
      JOIN users u ON m.userId = u.id
      WHERE 
        m.sendEmail = 1 AND (
          (m.dateKey = ? AND m.notified_today = 0) OR 
          (m.dateKey = ? AND m.notified_7day = 0)
        )
    `;
    
    const [reminders] = await pool.query(query, [todayDateKey, sevenDayDateKey]);

    // 3-1. 오늘부터 6일 후까지의 일정 중, 아직 오늘 카운트다운 알림을 받지 않은 일정을 찾습니다.
    const countdownQuery = `
      SELECT
        m.id, m.title, m.dateKey,
        u.email, u.nickname
      FROM memos m
      JOIN users u ON m.userId = u.id
      WHERE
        m.sendEmail = 1 AND
        m.dateKey > ? AND m.dateKey < ? AND
        (m.last_notified_countdown_date IS NULL OR m.last_notified_countdown_date != ?)
    `;
    const [countdownReminders] = await pool.query(countdownQuery, [todayDateKey, sevenDayDateKey, todayDateKey]);

    // ... (rest of the code)

    if (reminders.length === 0 && countdownReminders.length === 0) {
      console.log('[Scheduler] 전송할 예약 알림이 없습니다.');
      return;
    }

    console.log(`[Scheduler] 총 ${reminders.length}건의 예약 알림을 찾았습니다. 전송 시작...`);

    // 4. 찾은 일정들을 하나씩 돌면서 이메일 전송
    for (const reminder of reminders) {
      let subject = '';
      let htmlContent = '';

      if (reminder.dateKey === todayDateKey) {
        // --- D-Day 알림 ---
        subject = `[D-DAY] 오늘 '${reminder.title}' 일정이 있습니다!`;
        htmlContent = `<p>안녕하세요, ${reminder.nickname}님! 잊지 않으셨죠?</p>
                       <p>오늘(${reminder.dateKey})은 <strong>${reminder.title}</strong> 일정이 있는 날입니다. 📅</p>`;
        
        // (DB 업데이트) "오늘 알림 보냈음"으로 표시
        await pool.query("UPDATE memos SET notified_today = 1 WHERE id = ?", [reminder.id]);

      } else if (reminder.dateKey === sevenDayDateKey) {
        // --- D-7 알림 ---
        subject = `[D-7] '${reminder.title}' 일정이 7일 남았습니다.`;
        htmlContent = `<p>안녕하세요, ${reminder.nickname}님! 미리 알려드려요.</p>
                       <p>7일 뒤(${reminder.dateKey})에 <strong>${reminder.title}</strong> 일정이 있습니다. 🗓️</p>`;
        
        // (DB 업데이트) "7일 전 알림 보냈음"으로 표시
        await pool.query("UPDATE memos SET notified_7day = 1 WHERE id = ?", [reminder.id]);
      }

      // 5. 이메일 전송
      await transporter.sendMail({
        from: `"우리들의 다이어리" <${EMAIL_USER}>`,
        to: reminder.email,
        subject: subject,
        html: `<div style="font-family: 'Noto Sans KR', sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 12px;">${htmlContent}</div>`
      });
      console.log(`[Scheduler] 이메일 전송 성공 (To: ${reminder.email}, Subject: ${subject})`);
    }

  } catch (error) {
    console.error('[Scheduler] 예약 알림 작업 중 오류 발생:', error);
  }
};


// --- (★신규★) 일정 '추가' 시 즉시 알림 이메일 전송 ---
const sendImmediateNotification = async (memoId) => {
  if (!transporter) {
    console.log('[Scheduler] 이메일 전송기 설정 안됨. 즉시 알림을 건너뜁니다.');
    return;
  }

  try {
    // 1. 방금 생성된 메모와 사용자 정보를 DB에서 가져옵니다.
    const query = `
      SELECT 
        m.id, m.title, m.dateKey, m.sendEmail,
        u.email, u.nickname
      FROM memos m
      JOIN users u ON m.userId = u.id
      WHERE m.id = ?
    `;
    const [memos] = await pool.query(query, [memoId]);

    if (memos.length === 0) {
      console.log(`[Scheduler] 즉시 알림을 위한 메모(id: ${memoId})를 찾을 수 없습니다.`);
      return;
    }

    const memo = memos[0];

    // 2. 사용자가 이메일 수신을 설정한 경우에만 전송합니다.
    if (!memo.sendEmail) {
      console.log(`[Scheduler] 메모(id: ${memoId})에 이메일 수신이 설정되지 않아 즉시 알림을 보내지 않습니다.`);
      return;
    }

    // 3. (항상 전송) 즉시 등록 완료 이메일 발송
    const subject = `[일정 등록 완료] '${memo.title}' 일정이 추가되었습니다.`;
    const htmlContent = `
      <p>안녕하세요, ${memo.nickname}님!</p>
      <p><strong>${memo.title}</strong> 일정이 <strong>${memo.dateKey}</strong> 날짜로 정상적으로 등록되었습니다. 🗓️</p>
    `;
    await transporter.sendMail({
      from: `"우리들의 다이어리" <${EMAIL_USER}>`,
      to: memo.email,
      subject: subject,
      html: `<div style="font-family: 'Noto Sans KR', sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 12px;">${htmlContent}</div>`
    });
    console.log(`[Scheduler] 즉시 등록 완료 이메일 전송 성공 (To: ${memo.email}, Memo ID: ${memoId})`);


    // 4. (조건부 전송) 7일 이내 일정은 1분 후 추가 알림
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const eventDate = new Date(memo.dateKey);
    eventDate.setHours(0, 0, 0, 0);
    const diffTime = eventDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays >= 0 && diffDays <= 7) {
      console.log(`[Scheduler] 메모(id: ${memoId})가 ${diffDays}일 후 예정되어, 1분 후 추가 알림을 예약합니다.`);
      
      setTimeout(async () => {
        const reminderSubject = `[일정 알림] '${memo.title}' 일정이 ${diffDays === 0 ? '오늘' : `${diffDays}일`} 남았습니다.`;
        const reminderHtmlContent = `
          <p>안녕하세요, ${memo.nickname}님!</p>
          <p><strong>${memo.title}</strong> 일정이 <strong>${diffDays === 0 ? '오늘' : `${diffDays}일`}</strong> 남았습니다. 잊지 마세요! 🗓️</p>
        `;

        try {
          await transporter.sendMail({
            from: `"우리들의 다이어리" <${EMAIL_USER}>`,
            to: memo.email,
            subject: reminderSubject,
            html: `<div style="font-family: 'Noto Sans KR', sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 12px;">${reminderHtmlContent}</div>`
          });
          console.log(`[Scheduler] 1분 지연 추가 알림 이메일 전송 성공 (To: ${memo.email}, Memo ID: ${memoId})`);
        } catch (error) {
          console.error(`[Scheduler] 1분 지연 추가 알림 이메일 전송 중 오류 발생 (Memo ID: ${memoId}):`, error);
        }
      }, 60 * 1000); // 1분 딜레이
    }

  } catch (error) {
    console.error(`[Scheduler] 즉시 알림 이메일 전송 중 오류 발생 (Memo ID: ${memoId}):`, error);
  }
};

// --- (★신규★) 일정 '삭제' 시 알림 이메일 전송 ---
const sendDeletionNotification = async (memo, user) => {
  if (!transporter) {
    console.log('[Scheduler] 이메일 전송기 설정 안됨. 삭제 알림을 건너뜁니다.');
    return;
  }
  if (!memo || !user) {
    console.log('[Scheduler] 삭제 알림을 위한 정보(memo, user)가 부족합니다.');
    return;
  }
  // 이메일 수신 거부한 유저에게는 보내지 않음
  if (!memo.sendEmail) {
    console.log(`[Scheduler] 메모(id: ${memo.id})에 이메일 수신이 설정되지 않아 삭제 알림을 보내지 않습니다.`);
    return;
  }

  try {
    const subject = `[일정 삭제 완료] '${memo.title}' 일정이 삭제되었습니다.`;
    const htmlContent = `
      <p>안녕하세요, ${user.nickname}님!</p>
      <p><strong>${memo.dateKey}</strong> 날짜의 <strong>'${memo.title}'</strong> 일정이 정상적으로 삭제되었습니다.</p>
    `;

    await transporter.sendMail({
      from: `"우리들의 다이어리" <${EMAIL_USER}>`,
      to: user.email,
      subject: subject,
      html: `<div style="font-family: 'Noto Sans KR', sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 12px;">${htmlContent}</div>`
    });

    console.log(`[Scheduler] 삭제 완료 이메일 전송 성공 (To: ${user.email}, Memo ID: ${memo.id})`);

  } catch (error) {
    console.error(`[Scheduler] 삭제 알림 이메일 전송 중 오류 발생 (Memo ID: ${memo.id}):`, error);
  }
};


// --- 스케줄러 내보내기 ---
module.exports = {
  sendImmediateNotification, // 즉시 알림 함수 내보내기
  sendDeletionNotification, // (★추가★) 삭제 알림 함수 내보내기
  // 매일 0시 0분 (자정)에 sendReminderEmails 함수를 실행
  startScheduledJobs: () => {
    // (테스트용: '*/1 * * * *' -> 매 1분마다 실행)
    // (실제용: '0 0 * * *' -> 매일 0시 0분(자정)에 실행)
    cron.schedule('0 0 * * *', sendReminderEmails, {
      timezone: "Asia/Seoul"
    });
    
    console.log('✅ 예약 알림 스케줄러(매일 자정)가 활성화되었습니다.');
  }
};
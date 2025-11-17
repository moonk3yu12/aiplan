const express = require('express');
const router = express.Router();
const pool = require('../db/connection'); 
const { protect } = require('../middleware/authMiddleware'); // (★ 1. protect 임포트)
const { sendImmediateNotification, sendDeletionNotification } = require('../scheduler'); // (★ 추가) 즉시 알림 & 삭제 알림 함수

/**
 * [GET] /api/memos/
 * "로그인한 사용자"의 모든 메모 데이터를 불러옵니다.
 */
router.get('/', protect, async (req, res) => { // (★ 2. protect 적용)
  // 'protect' 미들웨어가 req.user에 사용자 정보를 넣어줌
  const userId = req.user.id; 

  try {
    console.log(`[GET] /api/memos - 사용자(ID: ${userId})의 메모 요청`);
    
    const [rows] = await pool.query(
      "SELECT * FROM memos WHERE userId = ?", 
      [userId]
    );

    // React가 사용하기 좋은 { 'dateKey': { ... } } 객체 형태로 변환
    const memoriesObject = {};
    for (const row of rows) {
        const dateKey = row.dateKey;
        memoriesObject[dateKey] = {
            // (★수정★) DB의 id도 전달 (삭제/수정 시 사용)
            id: row.id, 
            title: row.title,
            location: row.location,
            story: row.story,
            keywords: row.keywords,
            sendEmail: !!row.sendEmail, 
            notified_7day: !!row.notified_7day,
            notified_today: !!row.notified_today
        };
    }
    res.status(200).json(memoriesObject);

  } catch (error) {
    console.error(`DB 'GET /memos' (User: ${userId}) 오류:`, error);
    res.status(500).json({ message: "DB 서버에서 오류가 발생했습니다." });
  }
});

/**
 * [POST] /api/memos/
 * "로그인한 사용자"의 새 메모를 저장/수정합니다. (Upsert)
 */
router.post('/', protect, async (req, res) => { // (★ 3. protect 적용)
  const userId = req.user.id; // 로그인한 사용자 ID
  const { dateKey, memoryData } = req.body;

  if (!dateKey || !memoryData) {
    return res.status(400).json({ message: "dateKey 또는 memoryData가 없습니다." });
  }

  try {
    console.log(`[POST] /api/memos - 사용자(ID: ${userId})가 ${dateKey}에 저장`);
    const { title, location, story, keywords, sendEmail } = memoryData;

    // (★수정★) 'notified' 플래그들도 INSERT/UPDATE 쿼리에 맞게 조정
    const query = `
      INSERT INTO memos (userId, dateKey, title, location, story, keywords, sendEmail, notified_7day, notified_today)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        title = ?, location = ?, story = ?, keywords = ?, sendEmail = ?
    `;
    
    const sendEmailValue = sendEmail ? 1 : 0; 
    const params = [
      userId, dateKey, title, location, story, keywords, sendEmailValue, false, false, // INSERT용
      title, location, story, keywords, sendEmailValue // UPDATE용
    ];

    const [result] = await pool.query(query, params);

    // (★ 수정) 메모가 생성되거나 업데이트 되면 즉시 알림 이메일 발송
    if (result.insertId > 0) {
      // 1. 새로 추가된 경우: insertId를 사용해 알림 발송
      console.log(`새 메모(ID: ${result.insertId}) 생성됨. 즉시 알림 발송.`);
      sendImmediateNotification(result.insertId);
    } else if (result.affectedRows > 0) {
      // 2. 기존 메모가 업데이트된 경우: dateKey로 ID를 찾아 알림 발송
      // (affectedRows > 0 이어야 실제로 변경이 일어난 것)
      const [updatedRows] = await pool.query(
        "SELECT id FROM memos WHERE userId = ? AND dateKey = ?",
        [userId, dateKey]
      );
      if (updatedRows.length > 0) {
        const updatedMemoId = updatedRows[0].id;
        console.log(`기존 메모(ID: ${updatedMemoId}) 수정됨. 즉시 알림 발송.`);
        sendImmediateNotification(updatedMemoId);
      }
    }

    // 저장이 완료되면, "로그인한 사용자의" 최신 데이터를 DB에서 다시 불러와서 반환
    const [rows] = await pool.query(
      "SELECT * FROM memos WHERE userId = ?",
      [userId]
    );
    
    const memoriesObject = {};
    for (const row of rows) {
        const dateKey = row.dateKey;
        memoriesObject[dateKey] = {
            id: row.id,
            title: row.title,
            location: row.location,
            story: row.story,
            keywords: row.keywords,
            sendEmail: !!row.sendEmail,
            notified_7day: !!row.notified_7day,
            notified_today: !!row.notified_today
        };
    }
    res.status(201).json(memoriesObject);

  } catch (error) {
    console.error(`DB 'POST /memos' (User: ${userId}) 오류:`, error);
    res.status(500).json({ message: "DB 서버에서 오류가 발생했습니다." });
  }
});

/**
 * [DELETE] /api/memos/:dateKey
 * "로그인한 사용자"의 특정 날짜(dateKey) 메모를 삭제합니다.
 */
router.delete('/:dateKey', protect, async (req, res) => { // (★ 4. protect 적용)
  const userId = req.user.id; // 로그인한 사용자 ID
  const { dateKey } = req.params;

  try {
    console.log(`[DELETE] /api/memos/${dateKey} - 사용자(ID: ${userId})가 삭제`);

    // (★추가★) 1. 삭제하기 전에 먼저 메모 정보를 가져옵니다. (알림용)
    const [memosToDelete] = await pool.query(
      "SELECT * FROM memos WHERE dateKey = ? AND userId = ?",
      [dateKey, userId]
    );
    const memoToDelete = memosToDelete[0]; // 삭제할 메모 (없을 수도 있음)

    // 2. 메모를 삭제합니다.
    await pool.query(
      "DELETE FROM memos WHERE dateKey = ? AND userId = ?", 
      [dateKey, userId]
    );

    // (★추가★) 3. 위에서 찾은 메모가 실제로 있었다면, 삭제 알림을 보냅니다.
    if (memoToDelete) {
      // req.user는 protect 미들웨어에서 넣어준 사용자 정보입니다.
      sendDeletionNotification(memoToDelete, req.user);
    }
    
    // 4. 삭제가 완료되면, "로그인한 사용자의" 최신 데이터를 반환합니다.
    const [rows] = await pool.query(
      "SELECT * FROM memos WHERE userId = ?",
      [userId]
    );

    const memoriesObject = {};
    for (const row of rows) {
        const dateKey = row.dateKey;
        memoriesObject[dateKey] = {
            id: row.id,
            title: row.title,
            location: row.location,
            story: row.story,
            keywords: row.keywords,
            sendEmail: !!row.sendEmail,
            notified_7day: !!row.notified_7day,
            notified_today: !!row.notified_today
        };
    }
    res.status(200).json(memoriesObject);

  } catch (error) {
    console.error(`DB 'DELETE /memos' (User: ${userId}) 오류:`, error);
    res.status(500).json({ message: "DB 서버에서 오류가 발생했습니다." });
  }
});

module.exports = router;
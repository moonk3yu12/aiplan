// 1. .env 파일 로드 (★중요★ 파일 경로 명시)
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

// 2. 라이브러리 임포트
const express = require('express');
const cors = require('cors'); 
const pool = require('./db/connection'); 

// 3. 라우트 파일 임포트
const authRoutes = require('./routes/auth');
// (★핵심 수정★) 'memos.js'가 아니라, 사용자님의 파일인 'api.js'를 불러옵니다.
const memoRoutes = require('./routes/memo'); 
const aiRoutes = require('./routes/ai');
const scheduler = require('./scheduler'); 

// --- 앱 설정 ---
const app = express();
const PORT = process.env.PORT || 3001; 

// --- 미들웨어 설정 ---
app.use(cors()); 
app.use(express.json()); 
app.use(express.urlencoded({ extended: true }));

// ★추가★: React 빌드 파일을 정적 파일로 제공
app.use(express.static(path.join(__dirname, '..', 'build')));

// --- API 라우트 연결 ---
app.use('/api/auth', authRoutes);
// (★핵심 수정★) '/api/memos' 경로의 요청을 'api.js' (memoRoutes)가 처리하도록 연결합니다.
app.use('/api/memos', memoRoutes); 
app.use('/api/ai', aiRoutes);

// ★추가★: 모든 그 외 요청에 대해 index.html 반환 (React 라우팅 처리)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'build', 'index.html'));
});

// --- 서버 실행 ---
app.listen(PORT, async () => {
  try {
    const connection = await pool.getConnection();
    console.log('✅ MySQL 데이터베이스 연결 성공!');
    connection.release();
    
    console.log(`✅ 백엔드 서버가 http://localhost:${PORT} 에서 실행 중입니다.`);

    scheduler.startScheduledJobs();

  } catch (err) {
    console.error('❌ DB 연결 실패:', err.message);
  }
});
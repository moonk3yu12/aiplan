const jwt = require('jsonwebtoken');
const pool = require('../db/connection');
const JWT_SECRET = process.env.JWT_SECRET;

/**
 * '토큰 검사 미들웨어'
 * React가 보낸 토큰(신분증)이 유효한지 검사합니다.
 */
const protect = async (req, res, next) => {
  let token;

  // 1. React가 'Authorization' 헤더에 토큰을 보냈는지 확인
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // 2. 헤더에서 'Bearer ' 부분을 잘라내고 순수 토큰만 추출
      token = req.headers.authorization.split(' ')[1];

      // 3. 토큰 검증
      const decoded = jwt.verify(token, JWT_SECRET);

      // 4. (★진짜 최종 수정★)
      //    auth.js에서 토큰을 { user: { id: ... } } 구조로 만들었으므로,
      //    'decoded.id'가 아니라 'decoded.user.id'로 사용자를 찾습니다.
      const [users] = await pool.query(
        "SELECT id, username, email, nickname FROM users WHERE id = ?", 
        [decoded.user.id] // ⬅️ 🚨 수정된 부분 (decoded.id -> decoded.user.id)
      );
      
      if (users.length === 0) {
          throw new Error('사용자를 찾을 수 없습니다.');
      }

      // 5. 조회된 사용자 정보를 'req.user'라는 곳에 담습니다.
      req.user = users[0];

      // 6. 다음 단계(실제 API 로직)로 통과
      next();

    } catch (error) {
      console.error('토큰 검증 실패:', error.message);
      return res.status(401).json({ message: "인증에 실패했습니다. (토큰 오류)" });
    }
  }

  // 1-1. 토큰이 아예 없는 경우
  if (!token) {
    return res.status(401).json({ message: "인증에 실패했습니다. (토큰 없음)" });
  }
};

module.exports = { protect };
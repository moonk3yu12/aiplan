// plan/db/connection.js

// 1. .env 파일의 환경 변수를 process.env로 로드
require('dotenv').config();

const mysql = require('mysql2');

// 2. DB 커넥션 풀 생성
// (서버 환경에서는 매번 연결하는 'createConnection'보다 'createPool'이 효율적)
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// 3. 쿼리를 실행할 수 있는 'promise' 버전의 풀을 모듈로 export
// (async/await 구문을 사용하기 위함)
module.exports = pool.promise();
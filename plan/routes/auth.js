const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs'); // 비밀번호 암호화
const jwt = require('jsonwebtoken'); // 토큰 생성
const pool = require('../db/connection'); // DB 커넥션 풀
const { protect } = require('../middleware/authMiddleware'); // 인증 미들웨어
const nodemailer = require('nodemailer'); // 이메일 전송
const { OAuth2Client } = require('google-auth-library'); // 구글 인증
const crypto = require('crypto'); // 랜덤 비밀번호 생성용
const axios = require('axios');

// --- .env 파일에서 환경 변수 로드 ---
const EMAIL_USER = process.env.EMAIL_USER; 
const EMAIL_PASS = process.env.EMAIL_PASS; // Gmail "앱 비밀번호"
const JWT_SECRET = process.env.JWT_SECRET;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;

// --- 클라이언트 설정 ---

// (데모용) 인증 코드를 서버 메모리에 임시 저장
const verificationCodes = {}; 

// Nodemailer Transporter 설정 (Gmail 예시)
let transporter;
if (EMAIL_USER && EMAIL_PASS) {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASS, // .env에 '앱 비밀번호' 16자리를 넣어야 합니다.
    },
  });
  console.log("✅ Nodemailer (Gmail) 전송기 준비 완료.");
} else {
  console.warn("!! 경고: 이메일 전송 기능이 비활성화되었습니다. .env 파일에 EMAIL_USER와 EMAIL_PASS를 설정하세요.");
}


/**
 * [POST] /api/auth/send-verification
 * 회원가입 페이지에서 '인증번호 전송' 시 호출됩니다.
 */
router.post('/send-verification', async (req, res) => {
  const { email } = req.body;

  if (!email || !email.includes('@')) {
    return res.status(400).json({ message: '올바른 이메일 주소를 입력해주세요.' });
  }

  const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

  const mailOptions = {
    from: `"우리들의 다이어리" <${EMAIL_USER}>`,
    to: email,
    subject: '우리들의 다이어리 - 회원가입 인증번호',
    html: `<div style="font-family: 'Noto Sans KR', sans-serif; text-align: center; padding: 20px; border: 1px solid #eee; border-radius: 12px;">
             <h2 style="color: #c026d3;">인증번호 안내</h2>
             <p>우리들의 다이어리에 가입해주셔서 감사합니다.</p>
             <p>인증번호는 <strong style="font-size: 24px; color: #c026d3;">${verificationCode}</strong> 입니다.</p>
             <p style="color: #888; font-size: 12px;">이 번호는 3분 후에 만료됩니다.</p>
           </div>`,
  };

  try {
    if (transporter) {
      await transporter.sendMail(mailOptions);
      console.log(`[Email Verification] 이메일(${email})로 인증번호 (${verificationCode}) 전송 완료`);
    } else {
      console.log(`[Email Verification] 이메일 전송 시뮬레이션 (서버 설정 없음)
      - To: ${email}
      - Code: ${verificationCode}`);
    }

    verificationCodes[email] = {
      code: verificationCode,
      expires: Date.now() + 3 * 60 * 1000, // 3분
    };

    res.status(200).json({ message: '인증번호가 전송되었습니다.' });

  } catch (error) {
    console.error("이메일 전송 실패:", error);
    res.status(500).json({ message: '이메일 전송 중 오류가 발생했습니다. (서버 관리자에게 문의)' });
  }
});


/**
 * [POST] /api/auth/signup
 * 회원가입 페이지에서 '회원가입' 버튼 클릭 시 호출됩니다.
 */
router.post('/signup', async (req, res) => {
  const { nickname, signupId, signupEmail, signupPassword, verificationCode } = req.body;

  // 1. 인증번호 검증
  const storedData = verificationCodes[signupEmail];
  
  if (!storedData) {
    return res.status(400).json({ message: '인증번호가 전송된 이력이 없습니다. 다시 시도해주세요.' });
  }
  if (Date.now() > storedData.expires) {
    return res.status(400).json({ message: '인증번호 유효 시간이 초과되었습니다.' });
  }
  if (storedData.code !== verificationCode) {
    return res.status(400).json({ message: '인증번호가 일치하지 않습니다.' });
  }

  try {
    // 2. 아이디/닉네임/이메일 중복 확인
    const [existingUser] = await pool.query(
      "SELECT * FROM users WHERE username = ? OR nickname = ? OR email = ?",
      [signupId, nickname, signupEmail]
    );

    if (existingUser.length > 0) {
      if (existingUser[0].username === signupId) {
        return res.status(409).json({ message: '이미 사용 중인 아이디입니다.' });
      }
      if (existingUser[0].nickname === nickname) {
        return res.status(409).json({ message: '이미 사용 중인 닉네임입니다.' });
      }
      if (existingUser[0].email === signupEmail) {
        return res.status(409).json({ message: '이미 가입된 이메일입니다.' });
      }
    }

    // 3. 비밀번호 암호화
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(signupPassword, salt);

    // 4. 새 사용자 DB에 저장
    await pool.query(
      "INSERT INTO users (username, nickname, email, password) VALUES (?, ?, ?, ?)",
      [signupId, nickname, signupEmail, hashedPassword]
    );

    // 5. 인증 코드 삭제 (재사용 방지)
    delete verificationCodes[signupEmail];

    res.status(201).json({ 
      message: '회원가입이 성공적으로 완료되었습니다. 로그인해주세요.'
    });

  } catch (error) {
    console.error("DB 'POST /signup' 오류:", error);
    res.status(500).json({ message: "회원가입 중 서버 오류가 발생했습니다." });
  }
});


/**
 * [POST] /api/auth/login
 * 일반 로그인 시 호출됩니다.
 */
router.post('/login', async (req, res) => {
    const { loginId, password } = req.body;

    try {
        const [rows] = await pool.query(
            "SELECT * FROM users WHERE username = ? OR email = ?", 
            [loginId, loginId]
        );
        
        const user = rows[0];
        if (!user) {
            return res.status(401).json({ message: "아이디 또는 비밀번호가 일치하지 않습니다." });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: "아이디 또는 비밀번호가 일치하지 않습니다." });
        }
        
        // (★핵심★) 401 오류 해결을 위해 authMiddleware와 토큰 구조 통일
        const payload = {
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                nickname: user.nickname,
                provider: 'local' // 로컬 로그인
            }
        };

        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });

        res.status(200).json({
            token: token,
            user: payload.user // payload.user 객체를 그대로 전송
        });

    } catch (error) {
        console.error("DB 'POST /login' 오류:", error);
        res.status(500).json({ message: "로그인 중 서버 오류가 발생했습니다." });
    }
});


/**
 * [POST] /api/auth/google
 * 구글 소셜 로그인 성공 시 호출됩니다.
 */
router.post('/google', async (req, res) => {
  // Frontend에서 'credential'이라는 key로 access_token을 보내고 있습니다.
  const accessToken = req.body.credential; 

  if (!accessToken) {
    return res.status(400).json({ message: 'Google access token is required.' });
  }

  try {
    // 1. Access Token을 사용해 Google로부터 사용자 정보 가져오기
    const response = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    const { email, name } = response.data;

    // 2. 우리 DB에 이 이메일로 가입한 유저가 있는지 확인
    const [rows] = await pool.query("SELECT * FROM users WHERE email = ?", [email]);
    let user = rows[0];

    // 3. [신규 유저] DB에 유저가 없으면, 자동 회원가입
    if (!user) {
      console.log(`[Google Auth] 신규 사용자 가입: ${email}`);
      const randomPassword = crypto.randomBytes(16).toString('hex');
      const hashedPassword = await bcrypt.hash(randomPassword, 10);
      
      let newNickname = name;
      // 닉네임 중복 검사
      let [existingNickname] = await pool.query("SELECT id FROM users WHERE nickname = ?", [newNickname]);
      if (existingNickname.length > 0) {
        newNickname = `${name} (${Math.floor(Math.random() * 1000)})`;
      }

      // username은 email로, nickname은 google display name으로 설정
      const [result] = await pool.query(
        "INSERT INTO users (username, nickname, email, password) VALUES (?, ?, ?, ?)",
        [email, newNickname, email, hashedPassword]
      );

      const [newRows] = await pool.query("SELECT * FROM users WHERE id = ?", [result.insertId]);
      user = newRows[0];
    }
    
    console.log(`[Google Auth] 기존 사용자 로그인: ${user.email}`);
    // 4. [로그인 성공] 우리 앱의 JWT 토큰 생성 (위의 /login과 동일한 구조)
    const ourTokenPayload = {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        nickname: user.nickname,
        provider: 'google' // 구글 로그인
      }
    };

    const token = jwt.sign(ourTokenPayload, JWT_SECRET, { expiresIn: '7d' });

    // 5. React로 우리 앱의 토큰과 사용자 정보 전송
    res.status(200).json({
      token: token,
      user: ourTokenPayload.user
    });

  } catch (error) {
    // axios 에러와 다른 에러를 구분하여 로깅
    if (error.response) {
      console.error("Google API Error:", error.response.data);
    } else {
      console.error("Google 인증 중 서버 오류:", error);
    }
    res.status(401).json({ message: "Google 인증에 실패했습니다. 유효하지 않은 토큰일 수 있습니다." });
  }
});


/**
 * [PUT] /api/auth/update-nickname
 * 마이페이지에서 닉네임 변경 시 호출됩니다. (로그인 필요)
 */
router.put('/update-nickname', protect, async (req, res) => {
    const userId = req.user.id;
    const { newNickname } = req.body;

    if (!newNickname || newNickname.trim().length === 0) {
        return res.status(400).json({ message: "닉네임은 비워둘 수 없습니다." });
    }

    try {
        const [existing] = await pool.query(
            "SELECT * FROM users WHERE nickname = ? AND id != ?",
            [newNickname, userId]
        );
        if (existing.length > 0) {
            return res.status(409).json({ message: "이미 사용 중인 닉네임입니다." });
        }

        await pool.query(
            "UPDATE users SET nickname = ? WHERE id = ?",
            [newNickname, userId]
        );

                res.status(200).json({
                    message: `${newNickname}(으)로 닉네임이 성공적으로 변경되었습니다.`,
                    newNickname: newNickname
                });
    } catch (error) {
        console.error("DB 'PUT /update-nickname' 오류:", error);
        res.status(500).json({ message: "닉네임 변경 중 서버 오류가 발생했습니다." });
    }
});


/**
 * [PUT] /api/auth/update-password
 * 마이페이지에서 비밀번호 변경 시 호출됩니다. (로그인 필요)
 */
router.put('/update-password', protect, async (req, res) => {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    if (newPassword.length < 6) {
         return res.status(400).json({ message: "새 비밀번호는 6자 이상이어야 합니다." });
    }

    try {
        const [rows] = await pool.query("SELECT password FROM users WHERE id = ?", [userId]);
        const user = rows[0];

        if (!user) {
            return res.status(404).json({ message: "사용자를 찾을 수 없습니다." });
        }

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: "현재 비밀번호가 일치하지 않습니다." });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        await pool.query(
            "UPDATE users SET password = ? WHERE id = ?",
            [hashedPassword, userId]
        );

        res.status(200).json({ 
            message: "비밀번호가 성공적으로 변경되었습니다. 보안을 위해 다시 로그인해주세요."
        });

    } catch (error) {
        console.error("DB 'PUT /update-password' 오류:", error);
        res.status(500).json({ message: "비밀번호 변경 중 서버 오류가 발생했습니다." });
    }
});


/**
 * [POST] /api/auth/request-delete-code
 * 회원 탈퇴 인증번호를 요청합니다. (로그인 필요)
 */
router.post('/request-delete-code', protect, async (req, res) => {
    const user = req.user; // protect 미들웨어를 통해 얻은 사용자 정보

    if (!user || !user.email) {
        return res.status(400).json({ message: '인증된 사용자 정보가 없습니다.' });
    }

    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const mailOptions = {
        from: `"우리들의 다이어리" <${EMAIL_USER}>`,
        to: user.email,
        subject: '우리들의 다이어리 - 회원 탈퇴 인증번호',
        html: `<div style="font-family: 'Noto Sans KR', sans-serif; text-align: center; padding: 20px; border: 1px solid #eee; border-radius: 12px;">
                 <h2 style="color: #c026d3;">회원 탈퇴 인증번호 안내</h2>
                 <p>계정 삭제를 위해 아래 인증번호를 입력해주세요.</p>
                 <p>인증번호는 <strong style="font-size: 24px; color: #c026d3;">${verificationCode}</strong> 입니다.</p>
                 <p style="color: #888; font-size: 12px;">이 번호는 3분 후에 만료됩니다.</p>
               </div>`,
    };

    try {
        if (transporter) {
            await transporter.sendMail(mailOptions);
        } else {
            console.log(`[Account Deletion] 이메일 전송 시뮬레이션 (서버 설정 없음)
            - To: ${user.email}
            - Code: ${verificationCode}`);
        }

        // 회원가입과 동일한 `verificationCodes` 객체 사용
        verificationCodes[user.email] = {
            code: verificationCode,
            expires: Date.now() + 3 * 60 * 1000, // 3분
        };

        res.status(200).json({ message: '회원 탈퇴 인증번호가 이메일로 전송되었습니다.' });

    } catch (error) {
        console.error("회원 탈퇴 이메일 전송 실패:", error);
        res.status(500).json({ message: '이메일 전송 중 오류가 발생했습니다.' });
    }
});

/**
 * [POST] /api/auth/delete-account
 * 회원 탈퇴를 최종 확정합니다. (로그인 필요)
 */
router.post('/delete-account', protect, async (req, res) => {
    const user = req.user;
    const { code } = req.body;

    if (!user || !user.email) {
        return res.status(400).json({ message: '인증된 사용자 정보가 없습니다.' });
    }

    const storedData = verificationCodes[user.email];

    if (!storedData) {
        return res.status(400).json({ message: '인증번호 요청 기록이 없습니다.' });
    }
    if (Date.now() > storedData.expires) {
        return res.status(400).json({ message: '인증번호 유효 시간이 초과되었습니다.' });
    }
    if (storedData.code !== code) {
        return res.status(400).json({ message: '인증번호가 일치하지 않습니다.' });
    }

    try {
        // ON DELETE CASCADE에 의해 memos도 함께 삭제됨
        await pool.query("DELETE FROM users WHERE id = ?", [user.id]);

        delete verificationCodes[user.email]; // 인증 코드 삭제

        console.log(`[Account Deleted] 사용자 ID ${user.id} (${user.email}) 계정 삭제 완료.`);
        res.status(200).json({ message: '회원 탈퇴가 성공적으로 처리되었습니다.' });

    } catch (error) {
        console.error("DB 'POST /delete-account' 오류:", error);
        res.status(500).json({ message: "회원 탈퇴 처리 중 서버 오류가 발생했습니다." });
    }
});


module.exports = router;
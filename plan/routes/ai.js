// plan/routes/ai.js (AI 전용 라우트)

const express = require('express');
const router = express.Router();
const axios = require('axios'); // 백엔드용 axios
const { protect } = require('../middleware/authMiddleware'); // 로그인 검사

// .env 파일에서 Gemini API 키를 가져옵니다.
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
// ⬇️ [수정됨] 2.5 flash 모델 주소로 변경
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${GEMINI_API_KEY}`;

/**
 * [POST] /api/ai/chat
 * 챗봇 API 요청을 중개합니다.
 */
router.post('/chat', protect, async (req, res) => {
  // React(AppPage.js)가 보낸 프롬프트와 시스템 지침
  const { prompt, systemPrompt } = req.body;

  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    systemInstruction: { parts: [{ text: systemPrompt }] },
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          "type": { "type": "STRING" },
          "date": { "type": "STRING", "nullable": true },
          "title": { "type": "STRING", "nullable": true },
          "responseText": { "type": "STRING" }
        },
        required: ["type", "responseText"]
      }
    }
  };

  try {
    const response = await axios.post(GEMINI_API_URL, payload);
    const text = response.data.candidates[0].content.parts[0].text;
    res.status(200).json({ text: text });

  } catch (error) {
    console.error("Gemini Chat API Error:", error.response ? error.response.data : error.message);
    res.status(500).json({ message: "Gemini 챗봇 API 호출 중 오류 발생" });
  }
});

/**
 * [POST] /api/ai/highlight
 * AI 하이라이트 API 요청을 중개합니다.
 */
router.post('/highlight', protect, async (req, res) => {
  const { prompt, systemPrompt } = req.body;

  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    systemInstruction: { parts: [{ text: systemPrompt }] },
  };

  try {
    const response = await axios.post(GEMINI_API_URL, payload);
    const text = response.data.candidates[0].content.parts[0].text;
    res.status(200).json({ text: text });
    
  } catch (error) {
    console.error("Gemini Highlight API Error:", error.response ? error.response.data : error.message);
    res.status(500).json({ message: "Gemini 하이라이트 API 호출 중 오류 발생" });
  }
});

module.exports = router;
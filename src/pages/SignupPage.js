import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';

// (★수정★) 백엔드 API 주소
const API_URL = 'http://localhost:3001/api/auth';

function SignupPage() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    nickname: '',
    signupId: '',
    signupPassword: '',
    confirmPassword: '',
    signupEmail: '',
    verificationCode: '',
  });
  
  const [isVerificationSent, setIsVerificationSent] = useState(false);
  const [timeLeft, setTimeLeft] = useState(180); 
  const [agreements, setAgreements] = useState({
    terms: false,
    privacy: false,
  });
  const [isSignupButtonEnabled, setIsSignupButtonEnabled] = useState(false);
  
  // (★신규★) API 호출 로딩 상태
  const [isSending, setIsSending] = useState(false); 

  const handleFormChange = (e) => {
    const { id, value, type, checked } = e.target;
    if (type === 'checkbox') {
      setAgreements(prev => ({ ...prev, [id]: checked }));
    } else {
      setFormData(prev => ({ ...prev, [id]: value }));
    }
  };

  // --- (★핵심 수정★) ---
  // 4. [인증번호 전송] 버튼 클릭 시 (API 호출)
  const handleSendVerification = async () => {
    if (!formData.signupEmail || !formData.signupEmail.includes('@')) {
      alert('올바른 이메일 주소를 입력해주세요.');
      return;
    }
    
    setIsSending(true); // 로딩 시작

    try {
      // (★수정★) 백엔드 /api/auth/send-verification 호출
      const response = await axios.post(`${API_URL}/send-verification`, {
        email: formData.signupEmail
      });
      
      alert(response.data.message); // "인증번호가 전송되었습니다."
      
      setIsVerificationSent(true);
      setTimeLeft(180); // 타이머 리셋
      
    } catch (error) {
      alert(error.response?.data?.message || '인증번호 전송에 실패했습니다.');
    } finally {
      setIsSending(false); // 로딩 종료
    }
  };

  // 5. [수정] 버튼 클릭 시 (이메일 수정)
  const handleEditEmail = () => {
    setIsVerificationSent(false);
    setFormData(prev => ({ ...prev, verificationCode: '' }));
  };

  // 6. [회원가입] 버튼 클릭 시 (API 호출)
  const handleSignupSubmit = async (e) => {
    e.preventDefault();
    if (!isSignupButtonEnabled) {
      alert('입력 양식을 모두 채우고 약관에 동의해주세요.');
      return;
    }
    
    setIsSending(true); // 로딩 시작

    try {
      console.log('React: 회원가입 API 호출...', formData);

      const response = await axios.post(`${API_URL}/signup`, {
        nickname: formData.nickname,
        signupId: formData.signupId,
        signupEmail: formData.signupEmail,
        signupPassword: formData.signupPassword,
        verificationCode: formData.verificationCode // (★중요★) 인증 코드 전송
      });

      alert(response.data.message); // "회원가입이 성공적으로 완료되었습니다."
      navigate('/login'); 
      
    } catch (error) {
      alert(error.response?.data?.message || '회원가입 중 오류가 발생했습니다.');
    } finally {
      setIsSending(false); // 로딩 종료
    }
  };

  // 7. [타이머] 로직 (useEffect 사용)
  useEffect(() => {
    if (isVerificationSent && timeLeft > 0) {
      const timerInterval = setInterval(() => {
        setTimeLeft(prevTime => prevTime - 1);
      }, 1000);

      if (timeLeft === 0) {
        clearInterval(timerInterval);
      }
      return () => clearInterval(timerInterval);
    }
  }, [isVerificationSent, timeLeft]);

  
  // 8. [회원가입 버튼 활성화] 로직 (useEffect 사용)
  useEffect(() => {
    const { nickname, signupId, signupPassword, confirmPassword, signupEmail, verificationCode } = formData;
    
    const isTextFieldsFilled =
      nickname !== '' &&
      signupId !== '' &&
      signupPassword !== '' &&
      confirmPassword !== '' &&
      signupEmail !== '' &&
      (isVerificationSent ? verificationCode !== '' : true); 
    
    const doPasswordsMatch = signupPassword === confirmPassword && signupPassword !== '';
    const areCheckboxesChecked = agreements.terms && agreements.privacy;

    setIsSignupButtonEnabled(isTextFieldsFilled && doPasswordsMatch && areCheckboxesChecked && !isSending);

  }, [formData, agreements, isVerificationSent, isSending]); // isSending 추가


  return (
    <div className="page p-6">
      <div className="auth-card w-full max-w-md p-8 md:p-10 space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-fuchsia-600 mb-2"><i className="fas fa-feather-alt mr-2"></i>새로운 이야기의 시작</h1>
          <p className="text-gray-500">우리들의 다이어리에 오신 것을 환영해요</p>
        </div>
        
        <form id="signup-form" className="space-y-4" onSubmit={handleSignupSubmit}>
          <div>
            <label htmlFor="nickname" className="text-sm font-semibold text-gray-600">닉네임</label>
            <input type="text" id="nickname" value={formData.nickname} onChange={handleFormChange} placeholder="사용하실 닉네임을 입력하세요" className="input-field signup-input w-full p-3 mt-1 rounded-lg transition" required />
          </div>
          <div>
            <label htmlFor="signupId" className="text-sm font-semibold text-gray-600">아이디</label>
            <input type="text" id="signupId" value={formData.signupId} onChange={handleFormChange} placeholder="로그인 시 사용할 아이디를 입력하세요" className="input-field signup-input w-full p-3 mt-1 rounded-lg transition" required />
          </div>
          <div>
            <label htmlFor="signupPassword" className="text-sm font-semibold text-gray-600">비밀번호</label>
            <input type="password" id="signupPassword" value={formData.signupPassword} onChange={handleFormChange} placeholder="비밀번호" className="input-field signup-input w-full p-3 mt-1 rounded-lg transition" required />
          </div>
          <div>
            <label htmlFor="confirmPassword" className="text-sm font-semibold text-gray-600">비밀번호 확인</label>
            <input type="password" id="confirmPassword" value={formData.confirmPassword} onChange={handleFormChange} placeholder="비밀번호 확인" className="input-field signup-input w-full p-3 mt-1 rounded-lg transition" required />
          </div>
          
          <div>
            <div className="flex justify-between items-baseline">
              <label htmlFor="signupEmail" className="text-sm font-semibold text-gray-600">이메일 (인증용)</label>
              {isVerificationSent && (
                <button id="edit-email-btn" type="button" onClick={handleEditEmail} className="text-xs font-semibold text-fuchsia-600 hover:underline">수정</button>
              )}
            </div>
            <div className="flex space-x-2 mt-1">
              <input type="email" id="signupEmail" value={formData.signupEmail} onChange={handleFormChange} placeholder="email@example.com" className="input-field signup-input w-full p-3 rounded-lg transition flex-grow" readOnly={isVerificationSent} required />
              {!isVerificationSent && (
                <button id="send-verification-btn" type="button" onClick={handleSendVerification} className="bg-gray-200 text-gray-600 font-semibold px-4 rounded-lg hover:bg-gray-300 transition shrink-0" disabled={isSending}>
                  {isSending ? <i className="fas fa-spinner fa-spin"></i> : '인증번호 전송'}
                </button>
              )}
            </div>
          </div>

          {isVerificationSent && (
            <div id="verification-code-section">
              <label htmlFor="verificationCode" className="text-sm font-semibold text-gray-600">인증번호</label>
              <div className="relative mt-1">
                <input type="text" id="verificationCode" value={formData.verificationCode} onChange={handleFormChange} placeholder="인증번호 6자리를 입력하세요" className="input-field signup-input w-full p-3 rounded-lg transition" required />
                <span id="timer" className="absolute right-3 top-1/2 -translate-y-1/2 text-red-500 text-sm font-semibold">
                  {timeLeft > 0 ? `${Math.floor(timeLeft / 60)}:${String(timeLeft % 60).padStart(2, '0')}` : '시간 초과'}
                </span>
              </div>
            </div>
          )}

          <div className="space-y-3 pt-2">
            <div className="flex items-center">
              <input id="terms" name="terms" type="checkbox" checked={agreements.terms} onChange={handleFormChange} className="signup-input h-4 w-4 rounded border-gray-300 text-fuchsia-600 focus:ring-fuchsia-500" />
              <label htmlFor="terms" className="ml-2 block text-sm text-gray-700">이용약관에 동의합니다. (필수)</label>
            </div>
            <div className="flex items-center">
              <input id="privacy" name="privacy" type="checkbox" checked={agreements.privacy} onChange={handleFormChange} className="signup-input h-4 w-4 rounded border-gray-300 text-fuchsia-600 focus:ring-fuchsia-500" />
              <label htmlFor="privacy" className="ml-2 block text-sm text-gray-700">개인정보 수집 및 이용에 동의합니다. (필수)</label>
            </div>
          </div>

          <button id="signup-btn" type="submit" className="btn-primary w-full py-3 rounded-lg font-bold text-lg" disabled={!isSignupButtonEnabled || isSending}>
            {isSending ? <i className="fas fa-spinner fa-spin"></i> : '회원가입'}
          </button>
        </form>
        
        <div className="text-center text-sm">
          <p className="text-gray-500">이미 계정이 있으신가요? 
            <Link to="/login" className="nav-to-login-from-signup font-semibold text-fuchsia-600 hover:underline"> 로그인</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default SignupPage;
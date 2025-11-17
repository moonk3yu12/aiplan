import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useGoogleLogin } from '@react-oauth/google';

const API_URL = 'http://localhost:3001/api/auth';

function LoginPage({ onLogin }) {
  const navigate = useNavigate(); 
  
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');

  const handleLoginSubmit = async (e) => {
    e.preventDefault(); 
    
    try {
      console.log('React: 일반 로그인 API 호출...');
      const response = await axios.post(`${API_URL}/login`, { loginId, password });
      const { token, user } = response.data;
      onLogin(token, user);
    } catch (error) {
      if (error.response?.data?.message) {
        alert(error.response.data.message);
      } else {
        alert('로그인 중 오류가 발생했습니다.');
      }
    }
  };

  const handleGoogleSuccess = async (tokenResponse) => {
    console.log('Google 로그인 성공, 백엔드로 액세스 토큰 전송...');
    try {
      // 백엔드에 액세스 토큰을 보내 사용자 정보를 가져옵니다.
      const response = await axios.post(`${API_URL}/google`, {
        credential: tokenResponse.access_token,
      });
      const { token, user } = response.data;
      onLogin(token, user);
    } catch (error) {
      console.error('Google 로그인 백엔드 연동 오류:', error);
      alert(error.response?.data?.message || 'Google 로그인에 실패했습니다.');
    }
  };

  const handleGoogleError = () => {
    console.error('Google 로그인 실패');
    alert('Google 로그인에 실패했습니다. 팝업 차단을 확인해주세요.');
  };

  const googleLogin = useGoogleLogin({
    onSuccess: handleGoogleSuccess,
    onError: handleGoogleError,
  });

  return (
    <div className="page p-6">
      <div className="auth-card w-full max-w-md p-8 md:p-10 space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-fuchsia-600 mb-2"><i className="fas fa-book-open mr-2"></i>우리들의 다이어리</h1>
          <p className="text-gray-500">당신의 이야기를 시작해보세요</p>
        </div>
        
        <form id="login-form" className="space-y-4" onSubmit={handleLoginSubmit}>
          <div>
            <label htmlFor="login-id" className="text-sm font-semibold text-gray-600">아이디 또는 이메일</label>
            <input 
              type="text" 
              id="login-id" 
              placeholder="아이디 또는 이메일을 입력하세요" 
              className="input-field w-full p-3 mt-1 rounded-lg transition"
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
            />
          </div>
          <div>
            <div className="flex justify-between items-baseline">
              <label htmlFor="password" className="text-sm font-semibold text-gray-600">비밀번호</label>
              <a href="#/" className="text-xs text-gray-500 hover:text-fuchsia-600">비밀번호를 잊으셨나요?</a>
            </div>
            <input 
              type="password" 
              id="password" 
              placeholder="비밀번호" 
              className="input-field w-full p-3 mt-1 rounded-lg transition"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button type="submit" className="btn-primary w-full py-3 rounded-lg font-bold text-lg">로그인</button>
        </form>

        <div className="flex items-center">
          <hr className="flex-grow border-gray-200" />
          <span className="mx-4 text-sm text-gray-400">또는</span>
          <hr className="flex-grow border-gray-200" />
        </div>

        <div className="flex justify-center">
          <button 
            onClick={() => googleLogin()}
            className="w-full py-3 px-4 flex justify-center items-center bg-white text-gray-800 font-bold rounded-md border border-blue-500 hover:bg-gray-100 transition-colors"
          >
            <svg className="w-5 h-5 mr-3" viewBox="0 0 48 48">
                <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"></path>
                <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C16.318 4 9.656 8.337 6.306 14.691z"></path>
                <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.222 0-9.618-3.226-11.283-7.662l-6.522 5.025C9.505 39.556 16.227 44 24 44z"></path>
                <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C43.021 36.248 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"></path>
            </svg>
            구글 로그인 및 회원가입
          </button>
        </div>
        
        <div className="text-center text-sm">
          <p className="text-gray-500">
            계정이 없으신가요? 
            <Link to="/signup" className="nav-to-signup font-semibold text-fuchsia-600 hover:underline"> 회원가입</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
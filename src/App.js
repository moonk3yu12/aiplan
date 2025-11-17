import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { googleLogout } from '@react-oauth/google';
import './App.css'; 

// 페이지 컴포넌트들
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import AppPage from './pages/AppPage';
import MyPage from './pages/MyPage';

function App() {
  const navigate = useNavigate();
  const location = useLocation();

  // --- 1. App.js가 모든 상태를 직접 관리 ---
  const [user, setUser] = useState(null);
  const [apiClient, setApiClient] = useState(null);
  const [memories, setMemories] = useState({}); 
  const [isEmailEnabled, setIsEmailEnabled] = useState(true); // (★추가★) 이메일 알림 전역 상태
  const [isAuthLoading, setIsAuthLoading] = useState(true); 

  // --- 2. 앱 첫 로드 시 localStorage에서 토큰/사용자 정보 확인 ---
  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');

    if (token && userData) {
      const parsedUser = JSON.parse(userData);
      handleLogin(token, parsedUser, true); 
    }
    setIsAuthLoading(false);
  }, []); 

  // --- 3. 로그인 감지 및 페이지 이동 ---
  useEffect(() => {
    const isOnPublicPage = location.pathname === '/login' || location.pathname === '/signup' || location.pathname === '/';
    if (user && !isAuthLoading && isOnPublicPage) {
      navigate('/app');
    }
  }, [user, isAuthLoading, navigate, location]); 

  // --- 4. 로그인/상태 복원 시 실행되는 함수 ---
  const handleLogin = (token, userData, isInitialLoad = false) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    
    const client = axios.create({
      baseURL: 'http://localhost:3001/api/memos',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    setApiClient(() => client); 
    
    if (!isInitialLoad) {
      setUser(userData); 
    } else {
      setUser(userData); 
    }
  };

  // --- 5. 로그아웃 함수 ---
  const handleLogout = () => {
    googleLogout(); // (★추가★) 구글 로그아웃 처리
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setApiClient(null);
    setMemories({}); 
    navigate('/login');
  };

  // --- 6. 닉네임 수정 함수 ---
  const handleUpdateNickname = (newNickname) => {
    const updatedUser = { ...user, nickname: newNickname };
    setUser(updatedUser);
    localStorage.setItem('user', JSON.stringify(updatedUser));
  };

  // --- 7. 인증 확인 중이면, 로딩 화면 표시 ---
  if (isAuthLoading) {
    return (
      <div className="page p-4 md:p-8 flex items-center justify-center">
        <h2 className="text-xl font-bold text-fuchsia-600">
          <i className="fas fa-spinner fa-spin mr-2"></i>
          인증 정보를 확인 중입니다...
        </h2>
      </div>
    );
  }

  // --- 8. 인증 확인이 끝나면, 라우터 렌더링 ---
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      
      <Route 
        path="/login" 
        element={user ? <Navigate to="/app" replace /> : <LoginPage onLogin={handleLogin} />} 
      />
      <Route 
        path="/signup" 
        element={user ? <Navigate to="/app" replace /> : <SignupPage />} 
      />
      
      {/* (★수정★) isEmailEnabled prop 전달 */}
      <Route 
        path="/app" 
        element={
          user ? (
            <AppPage 
              user={user} 
              apiClient={apiClient} 
              onLogout={handleLogout}
              memories={memories}
              setMemories={setMemories}
              isEmailEnabled={isEmailEnabled} 
            />
          ) : (
            <Navigate to="/login" replace />
          )
        } 
      />
      {/* (★수정★) isEmailEnabled, setIsEmailEnabled props 전달 */}
      <Route 
        path="/mypage" 
        element={
          user ? (
            <MyPage 
              user={user} 
              apiClient={apiClient} 
              onLogout={handleLogout} 
              onUpdateNickname={handleUpdateNickname}
              isEmailEnabled={isEmailEnabled}
              setIsEmailEnabled={setIsEmailEnabled} 
            />
          ) : (
            <Navigate to="/login" replace />
          )
        } 
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
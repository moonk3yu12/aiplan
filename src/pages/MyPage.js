import React, { useState, useEffect } from 'react'; 
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios'; 

// (★수정★) App.js로부터 props를 받습니다.
function MyPage({ user, apiClient, onLogout, onUpdateNickname, isEmailEnabled, setIsEmailEnabled }) {
  
  const navigate = useNavigate();

  // --- State 관리 ---
  const [nickname, setNickname] = useState(user ? user.nickname : ''); 
  const [passwords, setPasswords] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmCode, setDeleteConfirmCode] = useState('');
  
  // (★수정★) props로 받은 isEmailEnabled로 state 초기화
  const [localEmailSetting, setIsLocalEmailEnabled] = useState(isEmailEnabled);

  useEffect(() => {
    if (user) {
      setNickname(user.nickname);
    }
  }, [user]); 

  
  // --- 이벤트 핸들러 ---

  const handleRequestDeleteCode = async () => {
    try {
      // (★신규★) 실제 구현에서는 이메일 등으로 인증번호를 보내야 합니다.
      // 현재는 클라이언트에서 간단히 상태만 변경합니다.
      await axios.post('http://localhost:3001/api/auth/request-delete-code', {}, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      alert('가입하신 이메일로 회원 탈퇴 인증번호가 전송되었습니다.');
      setShowDeleteConfirm(true);
    } catch (error) {
      alert(error.response?.data?.message || "인증번호 요청에 실패했습니다.");
    }
  };

  const handleDeleteAccount = async () => {
    if (!deleteConfirmCode) {
      alert('인증번호를 입력해주세요.');
      return;
    }
    try {
      const response = await axios.post('http://localhost:3001/api/auth/delete-account', {
        code: deleteConfirmCode
      }, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      alert(response.data.message);
      onLogout(); // 로그아웃 처리
      navigate('/login'); // 로그인 페이지로 이동
    } catch (error) {
      alert(error.response?.data?.message || "회원 탈퇴에 실패했습니다.");
    }
  };

  // (★수정★) 닉네임/알림 저장 핸들러
  const handleProfileSave = async (e) => {
    e.preventDefault();
    if (!apiClient && !user) { 
       alert("인증 정보가 없습니다. 다시 로그인해주세요.");
       return;
    }

    // 1. (★수정★) 알림 설정 업데이트 (App.js의 state 변경)
    setIsEmailEnabled(localEmailSetting);

    // 2. 닉네임 변경 API 호출 (변경되었을 경우에만)
    if (nickname.trim() && nickname !== user.nickname) {
      try {
        const response = await axios.put('http://localhost:3001/api/auth/update-nickname', { 
          newNickname: nickname 
        }, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        
        onUpdateNickname(nickname); 
        alert(response.data.message); 
        
      } catch (error) {
        alert(error.response?.data?.message || "닉네임 변경에 실패했습니다.");
      }
    } else {
      alert("설정이 저장되었습니다."); // 닉네임 변경 없이 설정만 저장
    }
    
    navigate('/app'); // 저장 후 앱 페이지로 이동
  };

  // (★수정★) 비밀번호 변경 핸들러
  const handlePasswordSave = async (e) => {
    e.preventDefault();
    if (!apiClient) return;

    if (passwords.newPassword !== passwords.confirmPassword) {
      alert("새 비밀번호와 비밀번호 확인이 일치하지 않습니다.");
      return;
    }
    if (passwords.newPassword.length < 6) {
      alert("새 비밀번호는 6자 이상이어야 합니다.");
      return;
    }

    try {
      const response = await axios.put('http://localhost:3001/api/auth/update-password', {
        currentPassword: passwords.currentPassword,
        newPassword: passwords.newPassword
      }, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      
      alert(response.data.message); 
      onLogout();
      
    } catch (error) {
      alert(error.response?.data?.message || "비밀번호 변경에 실패했습니다.");
    }
  };

  const handlePasswordChange = (e) => {
    const { id, value } = e.target;
    setPasswords(prev => ({ ...prev, [id]: value }));
  };
  
  if (!user) {
     return <Navigate to="/login" replace />; 
  }
  
  // --- JSX 렌더링 ---
  return (
    <div className="page p-6">
      <div className="auth-card w-full max-w-md p-8 md:p-10 space-y-6">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-3xl font-bold text-fuchsia-600"><i className="fas fa-user-edit mr-2"></i>회원 정보 수정</h1>
          <Link to="/app" id="nav-to-app-from-mypage" className="text-sm font-semibold text-gray-500 hover:text-fuchsia-600">돌아가기 &rarr;</Link>
        </div>
        
        {/* --- (★수정★) 닉네임/알림 저장 폼 --- */}
        <form id="mypage-form" className="space-y-4" onSubmit={handleProfileSave}>
          <div>
            <label htmlFor="mypage-nickname" className="text-sm font-semibold text-gray-600">닉네임</label>
            <input type="text" id="mypage-nickname" value={nickname} onChange={(e) => setNickname(e.target.value)} className="input-field w-full p-3 mt-1 rounded-lg transition" />
          </div>
          <div>
            <label htmlFor="mypage-id" className="text-sm font-semibold text-gray-600">아이디 (수정 불가)</label>
            <input type="text" id="mypage-id" value={user.username} className="input-field w-full p-3 mt-1 rounded-lg transition" readOnly />
          </div>
          <div>
            <label htmlFor="mypage-email" className="text-sm font-semibold text-gray-600">이메일 (수정 불가)</label>
            <input type="email" id="mypage-email" value={user.email} className="input-field w-full p-3 mt-1 rounded-lg transition" readOnly />
          </div>
          
          <hr className="my-4" />
          
          {/* --- (★신규★) 알림 설정 섹션 --- */}
          <h3 className="text-lg font-semibold text-gray-700">알림 설정</h3>
          <div className="flex items-center justify-between">
            <label htmlFor="email-notify-global-toggle" className="text-sm font-semibold text-gray-600">전체 이메일 알림 받기</label>
            <div className="relative inline-block w-10 mr-2 align-middle select-none">
              <input 
                type="checkbox" 
                name="toggle" 
                id="email-notify-global-toggle" 
                className="toggle-checkbox absolute opacity-0 w-0 h-0" 
                checked={localEmailSetting} 
                onChange={() => setIsLocalEmailEnabled(!localEmailSetting)} 
              />
              <label htmlFor="email-notify-global-toggle" className="toggle-label block overflow-hidden h-6 w-10 rounded-full bg-gray-300 cursor-pointer relative"></label>
            </div>
          </div>

          <button id="save-profile-btn" type="submit" className="btn-primary w-full py-3 rounded-lg font-bold text-lg">닉네임/설정 저장</button>
        </form>
        
        {user.provider !== 'google' && (
          <>
            <hr className="my-4" />
            
            {/* --- 비밀번호 변경 폼 --- */}
            <h3 className="text-lg font-semibold text-gray-700">비밀번호 변경</h3>
            <form id="password-form" className="space-y-4" onSubmit={handlePasswordSave}>
              <div>
                <label htmlFor="currentPassword" className="text-sm font-semibold text-gray-600">현재 비밀번호</label>
                <input type="password" id="currentPassword" value={passwords.currentPassword} onChange={handlePasswordChange} placeholder="현재 비밀번호" className="input-field w-full p-3 mt-1 rounded-lg transition" />
              </div>
              <div>
                <label htmlFor="newPassword" className="text-sm font-semibold text-gray-600">새 비밀번호</label>
                <input type="password" id="newPassword" value={passwords.newPassword} onChange={handlePasswordChange} placeholder="새 비밀번호 (6자 이상)" className="input-field w-full p-3 mt-1 rounded-lg transition" />
              </div>
              <div>
                <label htmlFor="confirmPassword" className="text-sm font-semibold text-gray-600">새 비밀번호 확인</label>
                <input type="password" id="confirmPassword" value={passwords.confirmPassword} onChange={handlePasswordChange} placeholder="새 비밀번호 확인" className="input-field w-full p-3 mt-1 rounded-lg transition" />
              </div>
              <button id="save-password-btn" type="submit" className="btn-primary w-full py-3 rounded-lg font-bold text-lg">비밀번호 변경</button>
            </form>
          </>
        )}

        <hr className="my-4" />

        {/* --- 회원 탈퇴 섹션 --- */}
        <h3 className="text-lg font-semibold text-gray-700">회원 탈퇴</h3>
        <div id="delete-account-section" className="space-y-4">
          <p className="text-sm text-gray-600">회원 탈퇴를 원하시면 아래 버튼을 눌러 인증번호를 요청하세요. 계정 삭제는 되돌릴 수 없습니다.</p>
          {!showDeleteConfirm ? (
            <button id="request-delete-code-btn" onClick={handleRequestDeleteCode} className="btn-danger w-full py-3 rounded-lg font-bold text-lg">회원 탈퇴 인증번호 요청</button>
          ) : (
            <div className="space-y-4">
              <input
                type="text"
                id="delete-confirm-code"
                value={deleteConfirmCode}
                onChange={(e) => setDeleteConfirmCode(e.target.value)}
                placeholder="인증번호를 입력하세요"
                className="input-field w-full p-3 mt-1 rounded-lg transition"
              />
              <button id="confirm-delete-btn" onClick={handleDeleteAccount} className="btn-danger w-full py-3 rounded-lg font-bold text-lg">계정 삭제 확인</button>
            </div>
          )}
        </div>
        
      </div>
    </div>
  );
}

export default MyPage;
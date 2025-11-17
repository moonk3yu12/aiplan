import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Calendar from 'react-calendar';
import axios from 'axios';
import { HIGHLIGHT_SYSTEM_PROMPT, getChatbotSystemPrompt } from '../prompts';
import { generateHighlightAPI, postToChatbotAPI } from '../api/ai';
import 'react-calendar/dist/Calendar.css';

function AppPage({ user, apiClient, onLogout, memories, setMemories, isEmailEnabled }) {
  const navigate = useNavigate();
  const loggedInUser = user;
  const logout = onLogout;

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [activeStartDate, setActiveStartDate] = useState(new Date());
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [formData, setFormData] = useState({ title: '', location: '', memo: '', sendEmail: false });
  const isGlobalEmailEnabled = isEmailEnabled;

  const [highlightResult, setHighlightResult] = useState(null);
  const [isHighlightLoading, setIsHighlightLoading] = useState(false);
  const [chatbotLog, setChatbotLog] = useState([
    { sender: 'bot', message: '안녕하세요! 어떤 대화를 나눠볼까요?' }
  ]);
  const [chatbotInput, setChatbotInput] = useState('');
  const [isChatbotLoading, setIsChatbotLoading] = useState(false);

  const handleGoToMyPage = () => { navigate('/mypage'); };
  const getDateKey = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  const handleCopyToClipboard = (text) => {
    const unescapedText = text.replace(/\\#/g, '#');
    navigator.clipboard.writeText(unescapedText).then(() => alert('클립보드에 복사되었습니다!'));
  };
  const handleFormChange = (e) => {
    const { id, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [id]: type === 'checkbox' ? checked : value,
    }));
  };
  const handleFormSave = async () => {
    if (typeof apiClient !== 'function') return;
    const dateKey = getDateKey(selectedDate);
    if (!formData.title && !formData.memo) {
      alert('제목이나 메모 중 하나는 입력해주세요.');
      return;
    }
    const newMemory = {
      title: formData.title || '새로운 기록',
      location: formData.location,
      story: formData.memo,
      keywords: `${formData.title}, ${formData.location}, ${formData.memo.substring(0, 20)}`,
      sendEmail: isGlobalEmailEnabled && formData.sendEmail,
      notified: false
    };
    try {
      const response = await apiClient.post('/', { dateKey: dateKey, memoryData: newMemory });
      setMemories(response.data);
      const alertMessage = memories[dateKey] ? '기록이 수정되었습니다.' : '기록이 저장되었습니다.';
      alert(alertMessage);
    } catch (error) {
      if (error.response?.status !== 401) alert('기록 저장에 실패했습니다.');
    }
  };
  const handleDeleteMemory = async () => {
    if (typeof apiClient !== 'function') return;
    const dateKey = getDateKey(selectedDate);
    if (!memories[dateKey]) { alert("삭제할 기록이 없습니다."); return; }
    if (!window.confirm(`'${memories[dateKey].title}' 기록을 정말 삭제하시겠습니까?`)) return;
    try {
      const response = await apiClient.delete(`/${dateKey}`);
      setMemories(response.data);
      alert('기록이 삭제되었습니다.');
    } catch (error) {
      if (error.response?.status !== 401) alert('기록 삭제에 실패했습니다.');
    }
  };

  const handleSubmitChat = async (e) => {
    e.preventDefault();
    if (typeof apiClient !== 'function' || isChatbotLoading) return;
    const userInput = chatbotInput.trim();
    if (!userInput) return;

    const newChatLog = [...chatbotLog, { sender: 'user', message: userInput }];
    setChatbotLog(newChatLog);
    setChatbotInput('');
    setIsChatbotLoading(true);

    const memoriesJson = memories ? JSON.stringify(memories, null, 2) : null;
    const systemPrompt = getChatbotSystemPrompt(memoriesJson);

    try {
      const response = await postToChatbotAPI(userInput, systemPrompt);
      
      const resObj = JSON.parse(response.text);
      setChatbotLog(prevLog => [...prevLog, { sender: 'bot', message: resObj.responseText }]);

      if (resObj.type === 'schedule' && resObj.date && resObj.title) {
        const newMemory = {
          title: resObj.title, story: "챗봇을 통해 추가된 일정입니다.", location: "",
          keywords: resObj.title, sendEmail: isGlobalEmailEnabled, notified: false
        };
        const scheduleResponse = await apiClient.post('/', { dateKey: resObj.date, memoryData: newMemory });
        setMemories(scheduleResponse.data);
        alert(`챗봇: ${resObj.date}에 '${resObj.title}' 일정을 추가했습니다.`);
      } else if (resObj.type === 'delete_schedule' && resObj.date) {
        if (window.confirm(`챗봇: ${resObj.date}의 '${memories[resObj.date]?.title || '기록'}'을(를) 정말 삭제하시겠습니까?`)) {
          const deleteResponse = await apiClient.delete(`/${resObj.date}`);
          setMemories(deleteResponse.data);
          alert(`챗봇: ${resObj.date}의 기록이 삭제되었습니다.`);
        } else {
          setChatbotLog(prevLog => [...prevLog, { sender: 'bot', message: "챗봇: 기록 삭제를 취소했습니다." }]);
        }
      }
    } catch (error) {
      console.error("React: 챗봇 API 호출 오류", error);
      setChatbotLog(prevLog => [...prevLog, { sender: 'bot', message: "앗, 챗봇 API와 통신 중 오류가 발생했어요." }]);
    } finally {
      setIsChatbotLoading(false);
    }
  };

  const handleGenerateHighlight = async () => {
    if (typeof apiClient !== 'function') return;
    const keywords = `${formData.title}, ${formData.location}, ${formData.memo}`;
    if (!keywords.trim() || keywords.trim() === ', ,') {
      alert("하이라이트를 생성할 키워드(제목, 장소, 메모)를 입력해주세요.");
      return;
    }

    setIsHighlightLoading(true);
    setHighlightResult(null);

    const systemPrompt = HIGHLIGHT_SYSTEM_PROMPT;

    try {
      const result = await generateHighlightAPI(keywords, systemPrompt);
      setHighlightResult(result);
    } catch (error) {
      console.error("React: 하이라이트 API 호출 오류", error);
      setHighlightResult("하이라이트 생성 중 오류가 발생했습니다.");
    } finally {
      setIsHighlightLoading(false);
    }
  };

  useEffect(() => {
    if (apiClient) {
      const fetchMemories = async () => {
        setIsLoadingData(true);
        try {
          console.log('React: 백엔드에 (인증된) 메모 요청...');
          const response = await apiClient.get('/');
          setMemories(response.data);
          console.log('React: (인증된) 데이터를 받았습니다.', response.data);
        } catch (error) {
          console.error("React: 메모 로딩 중 오류 발생", error);
          setMemories({});
        } finally {
          setIsLoadingData(false);
        }
      };
      
      fetchMemories();
    }
  }, [apiClient, setMemories]);

  useEffect(() => {
    const safeMemories = memories || {};
    const dateKey = getDateKey(selectedDate);
    const memoryForDay = safeMemories[dateKey];
    
    if (memoryForDay) {
      setFormData({
        title: memoryForDay.title || '',
        location: memoryForDay.location || '',
        memo: memoryForDay.story || '',
        sendEmail: memoryForDay.sendEmail || false,
      });
    } else {
      setFormData({ title: '', location: '', memo: '', sendEmail: false });
    }
    setHighlightResult(null);
  }, [selectedDate, memories]);

  const handleDateChange = (newDate) => {
    setSelectedDate(newDate);
    setHighlightResult(null);
  };

  const handleActiveStartDateChange = ({ activeStartDate }) => {
    setActiveStartDate(activeStartDate);
  };
  
  if (isLoadingData) {
     return (
      <div className="page p-4 md:p-8 flex items-center justify-center">
        <h2 className="text-xl font-bold text-fuchsia-600">
          <i className="fas fa-spinner fa-spin mr-2"></i>
          캘린더 데이터를 불러오는 중입니다...
        </h2>
      </div>
    );
  }
  
  const currentMemory = (memories && memories[getDateKey(selectedDate)]) || null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const upcomingAppointments = memories ? Object.keys(memories)
    .map(dateKey => {
      const memory = memories[dateKey];
      return {
        date: new Date(dateKey + "T00:00:00"),
        dateKey: dateKey,
        ...memory
      };
    })
    .filter(memory => memory.date > today)
    .sort((a, b) => a.date - b.date) : [];

  return (
    <div className="page p-4 md:p-8">
      <div className="app-container w-full max-w-5xl mx-auto bg-white rounded-2xl shadow-2xl flex flex-col md:flex-row overflow-hidden">
        
        <div className="w-full md:w-1/2 lg:w-2/5 p-6 border-b md:border-b-0 md:border-r border-gray-200 flex flex-col">
          <header className="mb-6 flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold text-fuchsia-600"><i className="fas fa-book-open mr-2"></i>우리들의 다이어리</h1>
              <p className="text-sm text-gray-500 mt-1">
                {(loggedInUser.nickname || loggedInUser.username)}님, 환영합니다!
              </p>
            </div>
            <div className="flex space-x-3 items-center">
              <button id="nav-to-mypage" onClick={handleGoToMyPage} className="text-xl text-gray-500 hover:text-fuchsia-600 transition" title="내 정보"><i className="fas fa-user-circle"></i></button>
              <button id="logout-button" onClick={logout} className="text-xl text-gray-500 hover:text-red-500 transition" title="로그아웃"><i className="fas fa-sign-out-alt"></i></button>
            </div>
          </header>

          <Calendar
            onChange={handleDateChange}
            value={selectedDate}
            activeStartDate={activeStartDate}
            onActiveStartDateChange={handleActiveStartDateChange}
            formatDay={(locale, date) => date.getDate()}
            tileContent={({ date, view }) => {
              if (view === 'month') {
                const dateKey = getDateKey(date);
                if (memories && memories[dateKey]) {
                  return <i className="fas fa-pen-nib text-[10px] absolute bottom-2 right-2 text-fuchsia-600"></i>;
                }
              }
              return null;
            }}
          />

          <button
            onClick={() => {
              const today = new Date();
              setSelectedDate(today);
              setActiveStartDate(today);
            }}
            className="mt-4 w-10 h-10 flex items-center justify-center bg-fuchsia-500 text-white rounded-full hover:bg-fuchsia-600 transition duration-200 self-center"
            title="오늘 날짜로 돌아가기"
          >
            <i className="fas fa-calendar-day text-xl"></i>
          </button>

          <div className="mt-auto pt-6">
            <h3 className="font-bold mb-2 text-gray-700">다가오는 약속</h3>
            <div id="upcoming-appointments" className="bg-sky-50 p-3 rounded-lg text-sm min-h-[50px] max-h-[150px] overflow-y-auto">
              {isLoadingData ? (
                 <p className="text-gray-500">데이터 로딩 중...</p>
              ) : upcomingAppointments.length === 0 ? (
                <p id="upcoming-placeholder" className="text-gray-500">새로운 약속을 추가하면 알림이 표시됩니다.</p>
              ) : (
                <div id="upcoming-list" className="space-y-1">
                  {upcomingAppointments.slice(0, 2).map(item => {
                    const diffTime = Math.abs(item.date - today);
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    return (
                      <p key={item.dateKey}>
                        <i className="fas fa-bell text-sky-600 mr-2"></i>
                        <span className="font-semibold text-sky-800">{diffDays}일 후:</span> {item.title}
                      </p>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
        
        <div className="w-full md:w-1/2 lg:w-3/5 main-panel p-6 flex flex-col overflow-y-auto">
          
          <div id="memory-display" className="flex-1 mb-6">
            <div id="memory-content" className="bg-white p-6 rounded-lg shadow-inner min-h-[200px] flex flex-col">

              <h3 id="memory-title" className="font-bold text-lg mb-4 text-fuchsia-600">
                {getDateKey(selectedDate)}
              </h3>

              {currentMemory ? (
                <div id="ai-highlight-generator" className="w-full">
                  <div className="space-y-3">
                    <input type="text" id="title" value={formData.title} onChange={handleFormChange} placeholder="일정 제목" className="input-field w-full p-2 rounded-lg" />
                    <input type="text" id="location" value={formData.location} onChange={handleFormChange} placeholder="장소" className="input-field w-full p-2 rounded-lg" />
                    <textarea id="memo" value={formData.memo} onChange={handleFormChange} className="input-field w-full p-2 rounded-lg h-24" placeholder="그날의 메모..."></textarea>
                    
                    {isGlobalEmailEnabled && (
                      <div className="flex items-center">
                        <input id="sendEmail" type="checkbox" checked={formData.sendEmail} onChange={handleFormChange} className="h-4 w-4 rounded border-gray-300 text-fuchsia-600 focus:ring-fuchsia-500" />
                        <label htmlFor="sendEmail" className="ml-2 block text-sm text-gray-700">이 일정에 대한 이메일 알림 받기</label>
                      </div>
                    )}
                    
                    <button id="save-memory-btn" onClick={handleFormSave} className="btn-primary w-full py-2 mt-2 rounded-lg font-bold">수정하기</button>
                    
                    <button id="generate-highlight-btn" onClick={handleGenerateHighlight} disabled={isHighlightLoading} className="btn-gemini w-full py-2 mt-2 rounded-lg font-bold">
                      {isHighlightLoading ? (
                        <><i className="fas fa-spinner fa-spin mr-2"></i>생성 중...</>
                      ) : (
                        "✨ AI 하이라이트 생성하기"
                      )}
                    </button>

                    <button id="delete-memory-btn" onClick={handleDeleteMemory} className="btn-danger w-full py-2 mt-4 rounded-lg font-semibold text-sm">
                      <i className="fas fa-trash-alt mr-2"></i>이 기록 삭제하기
                    </button>
                  </div>
                  
                  {highlightResult && typeof highlightResult === 'string' && (
                    <div id="highlight-result" className="mt-4 space-y-4">
                      {highlightResult.split('\n').map((part, index) => {
                        const cleanedText = part.replace(/\\#/g, '#');
                        
                        if (cleanedText.startsWith('하이라이트:')) {
                          const styledText = cleanedText.replace('하이라이트:', '').trim();
                          return (
                            <div key={index} className="p-3 bg-sky-50 rounded-lg">
                              <h4 className="font-bold text-sm text-sky-700">✨ 한 줄 하이라이트</h4>
                              <p 
                                className="text-gray-700 mt-1 p-2 rounded-md cursor-pointer transition hover:bg-sky-100"
                                onClick={() => handleCopyToClipboard(styledText)}
                                title="클릭하여 복사"
                                dangerouslySetInnerHTML={{ __html: styledText.replace(/#([\w\uAC00-\uD7AF_]+)/g, '<span className="hashtag">#$1</span>') }}
                              ></p>
                            </div>
                          );
                        } else if (cleanedText.startsWith('SNS:')) {
                          const snsContent = cleanedText.replace('SNS:', '').trim();
                          
                          const hashtags = snsContent.match(/#([\w\uAC00-\uD7AF_]+)/g);
                          
                          const captionToProcess = hashtags ? hashtags.join(' ') : snsContent;
                          const textToCopy = hashtags ? hashtags.join(' ') : snsContent;
                          
                          const styledCaption = captionToProcess.replace(/#([\w\uAC00-\uD7AF_]+)/g, '<span class="hashtag">#$1</span>');

                          return (
                            <div
                              key={index}
                              className="p-3 bg-blue-50 rounded-lg"
                            >
                              <h4 className="font-bold text-sm text-blue-700 flex justify-between items-center">
                                <span><i className="fab fa-instagram"></i> SNS 캡션</span>
                              </h4>
                              <p 
                                className="text-gray-700 mt-1 p-2 rounded-md cursor-pointer transition hover:bg-blue-100"
                                style={{ whiteSpace: 'pre-wrap' }}
                                onClick={() => handleCopyToClipboard(textToCopy)}
                                title="클릭하여 복사"
                                dangerouslySetInnerHTML={{ __html: styledCaption }}
                              ></p>
                            </div>
                          );
                        }
                        else if (!cleanedText.startsWith('SNS:') && !cleanedText.startsWith('하이라이트:')) {
                            return <p key={index} className="text-red-500 text-sm">{part}</p>
                        }
                        return null;
                      })}
                    </div>
                  )}
                </div>

              ) : (
                <div id="add-memory-form" className="w-full">
                  <div className="space-y-3">
                    <input type="text" id="title" value={formData.title} onChange={handleFormChange} placeholder="일정 제목" className="input-field w-full p-2 rounded-lg" />
                    <input type="text" id="location" value={formData.location} onChange={handleFormChange} placeholder="장소" className="input-field w-full p-2 rounded-lg" />
                    <textarea id="memo" value={formData.memo} onChange={handleFormChange} className="input-field w-full p-2 rounded-lg h-24" placeholder="그날의 메모를 남겨보세요..."></textarea>
                    
                    {isGlobalEmailEnabled && (
                      <div className="flex items-center">
                        <input id="sendEmail" type="checkbox" checked={formData.sendEmail} onChange={handleFormChange} className="h-4 w-4 rounded border-gray-300 text-fuchsia-600 focus:ring-fuchsia-500" />
                        <label htmlFor="sendEmail" className="ml-2 block text-sm text-gray-700">이 일정에 대한 이메일 알림 받기</label>
                      </div>
                    )}
                    
                    <button id="save-memory-btn" onClick={handleFormSave} className="btn-primary w-full py-2 rounded-lg font-bold">저장하기</button>
                  </div>
                </div>
              )}

            </div>
          </div>
          
          <div id="chatbot-widget" className="mt-auto">
            <h2 className="text-xl font-bold text-gray-800 mb-4">✨ AI 챗봇</h2>
            <div className="bg-white rounded-lg shadow-inner p-4 h-64 flex flex-col">
              
              <div id="chatbot-log" className="flex-1 overflow-y-auto text-sm space-y-3 p-2">
                {chatbotLog.map((chat, index) => (
                  <div
                    key={index}
                    className={chat.sender === 'user' ?
                      'chat-bubble-user p-3 rounded-lg self-end max-w-xs break-words text-right' :
                      'chat-bubble-bot p-3 rounded-lg self-start max-w-xs break-words'
                    }
                    dangerouslySetInnerHTML={{ __html: chat.message.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }}
                  >
                  </div>
                ))}
                {isChatbotLoading && (
                  <div className="chat-bubble-bot p-3 rounded-lg self-start max-w-min">
                    <div className="typing-indicator"><span></span><span></span><span></span></div>
                  </div>
                )}
              </div>
            <form id="chatbot-form" onSubmit={handleSubmitChat} className="mt-2 border-t pt-3 flex items-center space-x-2">
                <input
                  id="chatbot-input"
                  type="text"
                  className="input-field w-full p-2 rounded-lg"
                  placeholder="자유롭게 질문해보세요..."
                  value={chatbotInput}
                  onChange={(e) => setChatbotInput(e.target.value)}
                  disabled={isChatbotLoading}
                />
                <button
                  type="submit"
                  className="btn-primary rounded-full w-10 h-10 flex-shrink-0 flex items-center justify-center font-bold"
                  disabled={isChatbotLoading}
                >
                  {isChatbotLoading ?
                    <i className="fas fa-spinner fa-spin"></i> :
                    <i className="fas fa-paper-plane"></i>
                  }
                </button>
              </form>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

export default AppPage;
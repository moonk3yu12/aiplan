import React, { useEffect } from 'react'; // 1. useEffect를 import 합니다.
import { Link } from 'react-router-dom';

function LandingPage() {

  // 2. aiplan.html에 있던 스크롤 애니메이션 코드를 useEffect 안으로 가져옵니다.
  useEffect(() => {
    const faders = document.querySelectorAll('.fade-in');
    const appearOptions = { 
      threshold: 0.3, 
      rootMargin: "0px 0px -50px 0px" 
    };

    const appearOnScroll = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, appearOptions);

    faders.forEach(fader => {
      appearOnScroll.observe(fader);
    });

    // 3. 컴포넌트가 사라질 때 Observer를 정리합니다. (메모리 누수 방지)
    return () => {
      faders.forEach(fader => {
        if (fader) {
            appearOnScroll.unobserve(fader);
        }
      });
    };
  }, []); // 4. []를 넣어 이 코드가 "페이지 로드 시 1번"만 실행되도록 합니다.


  // 5. JSX 코드는 이전과 동일합니다. (수정 X)
  return (
    <div id="landing-page">
      <header className="bg-white/80 backdrop-blur-sm fixed top-0 left-0 right-0 z-50 shadow-sm">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <div className="text-xl font-bold text-fuchsia-600"><i className="fas fa-book-open mr-2"></i>우리들의 다이어리</div>
          <nav className="hidden md:flex space-x-8">
            <a href="#features" className="text-gray-600 hover:text-fuchsia-600">핵심 기능</a>
            <a href="#how-it-works" className="text-gray-600 hover:text-fuchsia-600">작동 방식</a>
          </nav>
          <Link to="/login" className="nav-to-login btn-primary py-2 px-5 rounded-full font-bold hidden md:block">시작하기</Link>
        </div>
      </header>

      <section className="hero-section pt-32 pb-20 text-center">
        <div className="container mx-auto px-6">
          {/*
            이 요소들이 .fade-in 클래스를 갖고 있어서 
            useEffect의 스크립트가 실행되어야만 화면에 보이게 됩니다.
          */}
          <h1 className="text-4xl md:text-6xl font-black text-fuchsia-700 leading-tight mb-4 fade-in" style={{ transitionDelay: '0.2s' }}>당신의 모든 날을<br />특별한 이야기로.</h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-8 fade-in" style={{ transitionDelay: '0.4s' }}>흩어져 있던 소중한 순간들, AI가 자동으로 찾아 하나의 이야기로 엮어드려요.<br />'우리들의 다이어리'와 함께 잊고 있던 추억을 다시 만나보세요.</p>
          <Link to="/login" className="nav-to-login btn-primary py-4 px-10 rounded-full font-bold text-lg inline-block fade-in" style={{ transitionDelay: '0.6s' }}>
            지금 바로 시작하기 <i className="fas fa-arrow-right ml-2"></i>
          </Link>
        </div>
      </section>
      
      <section id="features" className="py-20 bg-white">
           <div className="container mx-auto px-6 text-center">
             <h2 className="section-title mb-12 fade-in">당신의 일상이 특별해지는 이유</h2>
             <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
                 <div className="feature-card p-8 fade-in"><div className="text-4xl text-fuchsia-600 mb-4"><i className="fas fa-brain"></i></div><h3 className="text-xl font-bold mb-2">✨ AI 추억 큐레이션</h3><p className="text-gray-500">캘린더와 메모를 분석해 Gemini AI가 자동으로 지난날의 이야기를 만들어줘요.</p></div>
                 <div className="feature-card p-8 fade-in" style={{ transitionDelay: '0.2s' }}><div className="text-4xl text-fuchsia-600 mb-4"><i className="fas fa-bell"></i></div><h3 className="text-xl font-bold mb-2">지능형 알림</h3><p className="text-gray-500">중요한 약속은 물론, 작년 오늘의 추억까지 잊지 않게 챙겨줘요.</p></div>
                 <div className="feature-card p-8 fade-in" style={{ transitionDelay: '0.4s' }}><div className="text-4xl text-fuchsia-600 mb-4"><i className="fas fa-robot"></i></div><h3 className="text-xl font-bold mb-2">✨ AI 챗봇 대화</h3><p className="text-gray-500">Gemini AI 기반 챗봇과 기념일 계산부터 어떤 주제든 자유롭게 대화하세요.</p></div>
                 <div className="feature-card p-8 fade-in" style={{ transitionDelay: '0.6s' }}><div className="text-4xl text-fuchsia-600 mb-4"><i className="fas fa-users"></i></div><h3 className="text-xl font-bold mb-2">공유 다이어리</h3><p className="text-gray-500">연인, 가족, 친구와 함께 공동의 추억을 쌓고 함께 되돌아보세요.</p></div>
             </div>
           </div>
        </section>

        <section id="how-it-works" className="py-20">
             <div className="container mx-auto px-6 text-center">
               <h2 className="section-title mb-12 fade-in">3초면 충분해요</h2>
               <div className="flex flex-col md:flex-row justify-center items-center gap-8 md:gap-16">
                   <div className="text-center max-w-xs fade-in"><div className="text-5xl font-black text-sky-200 mb-2">1</div><div className="text-3xl text-fuchsia-600 mb-4"><i className="fas fa-pen-nib"></i></div><h3 className="text-xl font-bold mb-2">기록하고</h3><p className="text-gray-500">캘린더에 일정을 기록하거나, 간단한 메모를 남겨주세요.</p></div>
                   <div className="text-4xl text-sky-200 hidden md:block fade-in">&rarr;</div>
                   <div className="text-4xl text-sky-200 md:hidden fade-in">&darr;</div>
                   <div className="text-center max-w-xs fade-in" style={{ transitionDelay: '0.3s' }}><div className="text-5xl font-black text-sky-200 mb-2">2</div><div className="text-3xl text-fuchsia-600 mb-4"><i className="fas fa-magic"></i></div><h3 className="text-xl font-bold mb-2">✨ AI가 분석하고</h3><p className="text-gray-500">AI가 기록 속에서 핵심 키워드와 감성을 찾아내요.</p></div>
                   <div className="text-4xl text-sky-200 hidden md:block fade-in">&rarr;</div>
                   <div className="text-4xl text-sky-200 md:hidden fade-in">&darr;</div>
                   <div className="text-center max-w-xs fade-in" style={{ transitionDelay: '0.6s' }}><div className="text-5xl font-black text-sky-200 mb-2">3</div><div className="text-3xl text-fuchsia-600 mb-4"><i className="fas fa-gift"></i></div><h3 className="text-xl font-bold mb-2">추억을 발견해요</h3><p className="text-gray-500">과거의 오늘, AI가 선물처럼 당신의 이야기를 들려줄 거예요.</p></div>
               </div>
             </div>
        </section>

       <footer className="py-8 bg-sky-100">
             <div className="container mx-auto px-6 text-center text-sky-700">
               <p>&copy; 2025 우리들의 다이어리. All Rights Reserved.</p>
               <div className="mt-4 space-x-6"><a href="#" className="hover:text-black"><i className="fab fa-instagram"></i></a><a href="#" className="hover:text-black"><i className="fab fa-facebook"></i></a><a href="#" className="hover:text-black"><i className="fab fa-twitter"></i></a></div>
             </div>
       </footer>
    </div>
  );
}

export default LandingPage;
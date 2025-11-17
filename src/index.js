import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom'; // 1. BrowserRouter 임포트
import App from './App';
import './index.css';
import { GoogleOAuthProvider } from '@react-oauth/google'; // 3. 구글 Provider 임포트

const GOOGLE_CLIENT_ID =  "1058227752456-f28l028lst8th4f6mob9ul69eo8l98nf.apps.googleusercontent.com";

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    {/* (★핵심 수정★) BrowserRouter가 AuthProvider를 감싸야 합니다. */}
    <BrowserRouter>
      <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
        <App />
      </GoogleOAuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
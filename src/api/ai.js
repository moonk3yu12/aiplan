import axios from 'axios';

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return { headers: { 'Authorization': `Bearer ${token}` } };
};

export const generateHighlightAPI = async (prompt, systemPrompt) => {
  const response = await axios.post('http://localhost:3001/api/ai/highlight', 
    { prompt, systemPrompt }, 
    getAuthHeaders()
  );
  return response.data.text;
};

export const postToChatbotAPI = async (prompt, systemPrompt) => {
  const response = await axios.post('http://localhost:3001/api/ai/chat', 
    { prompt, systemPrompt }, 
    getAuthHeaders()
  );
  return response.data;
};
const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  app.use(
    '/1360000', // 기상청 API의 공통 경로
    createProxyMiddleware({
      target: 'http://apis.data.go.kr',
      changeOrigin: true,
    })
  );

  // 만약 다른 API도 프록시해야 한다면 여기에 추가로 app.use(...)를 작성하면 됩니다.
  /*
  app.use(
    '/other-api',
    createProxyMiddleware({
      target: 'http://other-api-server.com',
      changeOrigin: true,
    })
  );
  */
};